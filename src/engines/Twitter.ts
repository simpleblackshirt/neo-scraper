import { ScrapeEngineBase, ScrapeResult, ScrapedPost, ScrapedTag, ScrapeEngineFeature } from "../ScrapeEngine.js";

export function getOriginalImageUrl(image: HTMLImageElement) {
  // if the link includes a resolution, change it to orig:
  // https://pbs.twimg.com/media/stuff?format=jpg&name=900x900
  // -> https://pbs.twimg.com/media/stuff?format=jpg&name=orig
  const img_url = new URL((image as HTMLImageElement).src);
  if (img_url.searchParams.has("name") && img_url.searchParams.get("name") != "orig") {
    img_url.searchParams.set("name", "orig");
  }
  return img_url;
}

/**
 * Extracts the author handle from a tweet article and returns it as an artist tag.
 */
function artistFromArticle(article: Element): ScrapedTag | undefined {
  const authorLink = article.querySelector<HTMLAnchorElement>("div[data-testid='User-Name'] a[href^='/']");
  const handle = authorLink?.getAttribute("href")?.split("/")[1];
  if (handle) {
    return new ScrapedTag(handle, "artist");
  }
  return undefined;
}

/**
 * Extracts hashtags from a tweet article and returns them as tags.
 */
function hashtagsFromArticle(article: Element): ScrapedTag[] {
  const tags: ScrapedTag[] = [];
  for (const a of Array.from(article.querySelectorAll<HTMLAnchorElement>("a[href*='/hashtag/']"))) {
    const name = (a.textContent ?? "").replace(/^#/g, "").trim();
    if (name) {
      tags.push(new ScrapedTag(name));
    }
  }
  return tags;
}

/**
 * Extracts the canonical status URL from a tweet article.
 */
function statusUrlFromArticle(article: Element): string | undefined {
  const statusLink = article.querySelector<HTMLAnchorElement>("a[href*='/status/'] time")?.parentElement as
    | HTMLAnchorElement
    | undefined;
  const href = statusLink?.getAttribute("href");
  if (href && href.indexOf("/status/") != -1) {
    return "https://x.com" + href.split("?")[0];
  }
  return undefined;
}

/**
 * Extracts the numeric status id from an x.com status path.
 */
function statusIdFromHref(href: string | null | undefined): string | undefined {
  return href?.match(/\/status\/(\d+)/)?.[1];
}

/**
 * The href of the page the grabbed element lives on.
 */
function pageUrlFrom(container: Element): string {
  return container.ownerDocument?.location?.href ?? "";
}

/**
 * Photo urls of a tweet article with quoted-tweet media excluded: quotes
 * render their media inside the condensed card, and that card's media links
 * point at the quoted status, not the article's own.
 */
function ownPhotoUrls(article: Element): string[] {
  const ownStatusId = statusIdFromHref(statusUrlFromArticle(article));
  const seenUrls = new Set<string>();

  for (const img of Array.from(article.querySelectorAll<HTMLImageElement>("div[data-testid='tweetPhoto'] img"))) {
    const photo = img.closest("div[data-testid='tweetPhoto']");
    if (photo?.closest("[data-testid='testCondensedMedia']")) {
      continue;
    }
    const mediaStatusId = statusIdFromHref(photo?.closest("a[href*='/status/']")?.getAttribute("href"));
    if (ownStatusId && mediaStatusId && mediaStatusId !== ownStatusId) {
      continue;
    }
    seenUrls.add(getOriginalImageUrl(img).href);
  }

  return [...seenUrls];
}

export default class Twitter extends ScrapeEngineBase {
  name = "twitter";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "Hashtags become tags and the author's handle becomes an artist tag.",
    "X redesigns its DOM frequently, so this engine can break at any time.",
    "Element grabs (context menu): condensed quote cards are their own grab target, and video-only tweets are skipped because the real mp4 never reaches the DOM (blob: MSE streaming).",
  ];
  supportedHosts = ["twitter.com", "mobile.twitter.com", "x.com"];

  /**
   * Container resolution for context-menu element grabs, in priority order:
   * 1. a condensed quote card (right-clicking the quoted art grabs the quoted tweet),
   * 2. the tweet article,
   * 3. the lightbox dialog (focused-image clicks land outside any article).
   */
  findPostContainer(target: Element): Element | null {
    return (
      target.closest("[data-testid='testCondensedMedia']") ??
      target.closest("article[data-testid='tweet']") ??
      target.closest("div[role=dialog]")
    );
  }

  scrapeElement(container: Element): ScrapeResult {
    if (container.getAttribute("data-testid") === "testCondensedMedia") {
      return this.scrapeQuoteCard(container);
    }
    if (container.matches("article[data-testid='tweet']")) {
      return this.scrapeTweetArticle(container);
    }
    if (container.getAttribute("role") === "dialog") {
      return this.scrapeLightbox(container);
    }
    return new ScrapeResult(this.name);
  }

  /**
   * Scrapes a condensed quote card as a post of its own. The card carries no
   * User-Name and no timestamp - author handle and permalink both come from
   * its single status link (<author>/status/<id>/photo/1).
   */
  private scrapeQuoteCard(card: Element): ScrapeResult {
    const result = new ScrapeResult(this.name);

    const match = card.querySelector("a[href*='/status/']")?.getAttribute("href")?.match(/\/([^/]+)\/status\/(\d+)/);
    const source = match ? `https://x.com/${match[1]}/status/${match[2]}` : undefined;
    const artist = match ? new ScrapedTag(match[1], "artist") : undefined;

    for (const img of Array.from(card.querySelectorAll<HTMLImageElement>("div[data-testid='tweetPhoto'] img"))) {
      const post = new ScrapedPost();
      post.pageUrl = pageUrlFrom(card);
      post.contentUrl = getOriginalImageUrl(img).href;
      post.contentType = "image";
      post.sources = source ? [source] : [];
      post.tags = artist ? [artist] : [];
      result.tryAddPost(post);
    }

    return result;
  }

  private scrapeTweetArticle(article: Element): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const artist = artistFromArticle(article);
    const hashtags = hashtagsFromArticle(article);
    const source = statusUrlFromArticle(article);
    const tags = artist ? hashtags.concat([artist]) : hashtags.slice();
    const pageUrl = pageUrlFrom(article);

    for (const contentUrl of ownPhotoUrls(article)) {
      const post = new ScrapedPost();
      post.pageUrl = pageUrl;
      post.contentUrl = contentUrl;
      post.contentType = "image";
      post.sources = source ? [source] : [];
      post.tags = tags.slice();
      result.tryAddPost(post);
    }

    // Video-only tweets yield nothing: the mp4 url never reaches the DOM and
    // the poster thumb would misrepresent the post (see notes).
    return result;
  }

  /**
   * Scrapes the photo lightbox dialog: the focused image plus metadata from
   * the dialog's FIRST article (the focused tweet). The remaining articles are
   * the reply thread and must not leak in.
   */
  private scrapeLightbox(dialog: Element): ScrapeResult {
    const result = new ScrapeResult(this.name);

    const article = dialog.querySelector("article[data-testid='tweet']");
    const artist = article ? artistFromArticle(article) : undefined;
    const hashtags = article ? hashtagsFromArticle(article) : [];
    const source = article ? statusUrlFromArticle(article) : undefined;
    const tags = artist ? hashtags.concat([artist]) : hashtags.slice();
    const pageUrl = pageUrlFrom(dialog);

    const seenUrls = new Set<string>();
    const addPost = (contentUrl: string) => {
      if (!contentUrl || seenUrls.has(contentUrl)) {
        return;
      }
      seenUrls.add(contentUrl);

      const post = new ScrapedPost();
      post.pageUrl = pageUrl;
      post.contentUrl = contentUrl;
      post.contentType = "image";
      post.sources = source ? [source] : [];
      post.tags = tags.slice();
      result.tryAddPost(post);
    };

    // Focused image in the media pane (outside any article). Query the pane,
    // not the dialog: reply tweets inside the thread also carry images and
    // must not leak into the lightbox grab.
    let focusedImgs = Array.from(dialog.querySelectorAll<HTMLImageElement>("div[aria-label='Image'] img"));
    if (focusedImgs.length == 0) {
      focusedImgs = Array.from(dialog.querySelectorAll<HTMLImageElement>("div[data-testid='swipe-to-dismiss'] img"));
    }
    for (const img of focusedImgs) {
      addPost(getOriginalImageUrl(img).href);
    }

    // No focused image reachable - fall back to the focused tweet's own photos.
    if (result.posts.length == 0 && article) {
      for (const contentUrl of ownPhotoUrls(article)) {
        addPost(contentUrl);
      }
    }

    return result;
  }

  scrapeDocument(document: Document): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const seenUrls = new Set<string>();

    // If a modal dialog is open (tweet detail view / photo lightbox), only scrape inside of it.
    // Otherwise we would pick up unrelated tweets from the timeline behind the dialog.
    const dialogs = Array.from(document.querySelectorAll("div[role=dialog]"));
    const dialog = dialogs.length > 0 ? dialogs[dialogs.length - 1] : undefined;
    const scope = dialog ?? document;

    // Tags, artist and source come from the tweet article inside the current scope.
    const article = scope.querySelector("article");
    const hashtags = article ? hashtagsFromArticle(article) : [];
    const artist = article ? artistFromArticle(article) : undefined;
    const source = article ? statusUrlFromArticle(article) ?? document.location.href : document.location.href;

    const addPost = (contentUrl: string, contentType: "image" | "video", tags: ScrapedTag[], source: string) => {
      if (seenUrls.has(contentUrl)) {
        return;
      }
      seenUrls.add(contentUrl);

      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = contentUrl;
      post.contentType = contentType;
      post.sources = [source];
      post.tags = tags.slice();
      result.tryAddPost(post);
    };

    // Focused image in the photo lightbox. It is rendered outside of any tweet article.
    if (dialog) {
      const lightboxImgs = Array.from(dialog.querySelectorAll<HTMLImageElement>("img[alt='Image']"));
      // Legacy selector for the focused image on older desktop markup.
      const centerImg = document.querySelector<HTMLImageElement>(
        "div[role=dialog] div[role=dialog] div[aria-label=Image] img"
      );
      if (centerImg) {
        lightboxImgs.push(centerImg);
      }
      for (const img of lightboxImgs) {
        addPost(getOriginalImageUrl(img).href, "image", artist ? hashtags.concat([artist]) : hashtags.slice(), source);
      }
    }

    // Images and videos inside tweet articles.
    const articles = Array.from(scope.querySelectorAll("article"));
    for (const tweetArticle of articles) {
      const articleHashtags = hashtagsFromArticle(tweetArticle);
      const articleArtist = artistFromArticle(tweetArticle);
      const articleSource = statusUrlFromArticle(tweetArticle) ?? document.location.href;
      const articleTags = articleArtist ? articleHashtags.concat([articleArtist]) : articleHashtags.slice();

      const imgs = Array.from(tweetArticle.querySelectorAll<HTMLImageElement>("div[data-testid='tweetPhoto'] img"));
      for (const img of imgs) {
        addPost(getOriginalImageUrl(img).href, "image", articleTags, articleSource);
      }

      const videoSrc =
        tweetArticle.querySelector<HTMLSourceElement>("div[data-testid='videoPlayer'] video source")?.src ??
        tweetArticle.querySelector<HTMLVideoElement>("div[data-testid='videoPlayer'] video")?.src;
      if (videoSrc) {
        addPost(videoSrc, "video", articleTags, articleSource);
      }
    }

    return result;
  }
}
