import { ScrapeEngineBase, ScrapeResult, ScrapedPost, ScrapedTag, ScrapeEngineFeature } from "../ScrapeEngine.js";

/**
 * Upgrades a pbs.twimg.com media url to its original-quality rendition:
 * https://pbs.twimg.com/media/stuff?format=jpg&name=900x900
 * -> https://pbs.twimg.com/media/stuff?format=jpg&name=orig
 * Urls without a name param get one appended (raw CDN links may omit it;
 * name=orig is always served). Exported for the extension's tier-1 URL
 * rewrite resolvers, which run in the background without a DOM.
 */
export function getOriginalImageUrlFromUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.searchParams.get("name") != "orig") {
    parsed.searchParams.set("name", "orig");
  }
  return parsed.href;
}

/**
 * Media imgs can render without a usable src (lazy placeholders); one of them
 * must not abort the whole grab - such images are skipped (undefined).
 */
export function getOriginalImageUrl(image: HTMLImageElement): URL | undefined {
  if (!image.getAttribute("src")) {
    return undefined;
  }
  try {
    return new URL(getOriginalImageUrlFromUrl(image.src));
  } catch {
    return undefined;
  }
}

/**
 * The artist tag for an author handle, with the profile url attached.
 */
function artistTagFromHandle(handle: string): ScrapedTag {
  return new ScrapedTag(handle, "artist", "https://x.com/" + handle);
}

/**
 * Extracts the author handle from a tweet article and returns it as an artist tag.
 */
function artistFromArticle(article: Element): ScrapedTag | undefined {
  const authorLink = article.querySelector<HTMLAnchorElement>("div[data-testid='User-Name'] a[href^='/']");
  const handle = authorLink?.getAttribute("href")?.split("/")[1];
  if (handle) {
    return artistTagFromHandle(handle);
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
 * How much of an image's layout box intersects the viewport.
 *
 * 0 without layout metrics (documentElement size 0 in jsdom fixtures and some
 * headless setups) or for zero-sized boxes - callers must treat 0 everywhere
 * as "indistinguishable" and keep their legacy behavior.
 */
function viewportOverlapArea(image: HTMLImageElement): number {
  const rect = image.getBoundingClientRect();
  const doc = image.ownerDocument;
  const viewWidth = doc.documentElement?.clientWidth ?? 0;
  const viewHeight = doc.documentElement?.clientHeight ?? 0;
  if (rect.width <= 0 || rect.height <= 0 || viewWidth <= 0 || viewHeight <= 0) {
    return 0;
  }
  const left = Math.max(rect.left, 0);
  const right = Math.min(rect.right, viewWidth);
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, viewHeight);
  return Math.max(right - left, 0) * Math.max(bottom - top, 0);
}

/**
 * The candidate actually rendered on screen: the one with the largest
 * viewport overlap. x.com's photo lightbox is a carousel whose navigated
 * slides STAY MOUNTED (parked fully offscreen left/right, the next photo
 * preloaded right of the viewport) in stale-first DOM order, so DOM order
 * alone picks the previously-viewed image. Tie-breaks toward DOM order.
 * Returns undefined when no candidate overlaps the viewport or layout
 * metrics are unavailable - callers keep their legacy behavior then.
 */
function pickFocusedImage(images: HTMLImageElement[]): HTMLImageElement | undefined {
  let best: HTMLImageElement | undefined = undefined;
  let bestArea = 0;
  for (const image of images) {
    const area = viewportOverlapArea(image);
    if (area > bestArea) {
      best = image;
      bestArea = area;
    }
  }
  return best;
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
    const url = getOriginalImageUrl(img);
    if (url) {
      seenUrls.add(url.href);
    }
  }

  return [...seenUrls];
}

export default class Twitter extends ScrapeEngineBase {
  name = "twitter";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "Hashtags become tags and the author's handle becomes an artist tag.",
  ];
  supportedHosts = ["twitter.com", "mobile.twitter.com", "x.com"];

  /**
   * Container resolution for context-menu element grabs, in priority order:
   * 1. the tweet article - UNLESS the clicked element sits inside an embedded
   *    quote card, in which case the card is the post (right-clicking the
   *    quoted art or text grabs the quoted tweet),
   * 2. the lightbox dialog (focused-image clicks land outside any article).
   *
   * Quote detection is status-id based on purpose: the card's
   * testCondensedMedia testid is an A/B flag and cannot be relied on. The card
   * is found by climbing to the outermost ancestor that contains only FOREIGN
   * status links (links into a status other than the article's own): the next
   * level up always also contains the article's own landmarks. This covers
   * quoted text too, which is not itself wrapped in a status link.
   */
  findPostContainer(target: Element): Element | null {
    const article = target.closest("article[data-testid='tweet']");
    if (!article) {
      return target.closest("div[role=dialog]");
    }

    const ownStatusId = statusIdFromHref(statusUrlFromArticle(article));
    if (ownStatusId) {
      let node: Element = target;
      let card: Element | null = null;
      while (true) {
        const parent = node.parentElement;
        if (!parent || parent === article) {
          break;
        }
        // "Contains status links" includes the parent itself: the clicked
        // image's parent is often the status link, which querySelectorAll
        // alone would miss.
        const statusLinks = parent.matches("a[href*='/status/']")
          ? [parent as HTMLAnchorElement, ...Array.from(parent.querySelectorAll("a[href*='/status/']"))]
          : Array.from(parent.querySelectorAll("a[href*='/status/']"));
        // Climb through link-less structural wrappers; remember the outermost
        // ancestor holding only foreign status links; stop at the first
        // ancestor that also carries the article's OWN status links (its
        // layout), which is exactly the card boundary.
        if (statusLinks.some((link) => statusIdFromHref(link.getAttribute("href")) === ownStatusId)) {
          break;
        }
        if (statusLinks.length > 0) {
          card = parent;
        }
        node = parent;
      }
      if (card) {
        // Cap at the A/B card testid when present - it is the tighter container.
        return card.closest("[data-testid='testCondensedMedia']") ?? card;
      }
    }

    return article;
  }

  scrapeElement(container: Element): ScrapeResult {
    if (container.matches("article[data-testid='tweet']")) {
      return this.scrapeTweetArticle(container);
    }
    if (container.getAttribute("role") === "dialog") {
      return this.scrapeLightbox(container);
    }
    // Quote cards (testid or bare link-parent wrappers alike).
    return this.scrapeQuoteCard(container);
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
    const artist = match ? artistTagFromHandle(match[1]) : undefined;

    for (const img of Array.from(card.querySelectorAll<HTMLImageElement>("div[data-testid='tweetPhoto'] img"))) {
      const contentUrl = getOriginalImageUrl(img);
      if (!contentUrl) {
        continue;
      }
      const post = new ScrapedPost();
      post.pageUrl = source ?? pageUrlFrom(card);
      post.contentUrl = contentUrl.href;
      post.contentType = "image";
      post.sources = source ? [source] : [];
      post.tags = artist ? [artist] : [];
      post.uploadMode = "content";
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
    // Element grabs identify ONE post: pageUrl is its canonical permalink (not
    // the browsing page), so the popup's append-page-url-to-source dedup never
    // adds timeline/profile noise to the source.
    const pageUrl = source ?? pageUrlFrom(article);

    for (const contentUrl of ownPhotoUrls(article)) {
      const post = new ScrapedPost();
      post.pageUrl = pageUrl;
      post.contentUrl = contentUrl;
      post.contentType = "image";
      post.sources = source ? [source] : [];
      post.tags = tags.slice();
      // Twitter's CDNs intermittently 403 server-side downloads (rate limits
      // and header filtering) - the client fetches the bytes instead.
      post.uploadMode = "content";
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
    const pageUrl = source ?? pageUrlFrom(dialog);

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
      post.uploadMode = "content";
      result.tryAddPost(post);
    };

    // Focused image in the media pane (outside any article). Query the pane,
    // not the dialog: reply tweets inside the thread also carry images and
    // must not leak into the lightbox grab.
    let focusedImgs = Array.from(dialog.querySelectorAll<HTMLImageElement>("div[aria-label='Image'] img"));
    if (focusedImgs.length == 0) {
      focusedImgs = Array.from(dialog.querySelectorAll<HTMLImageElement>("div[data-testid='swipe-to-dismiss'] img"));
    }

    // The lightbox media pane is a carousel that keeps every navigated slide
    // mounted (parked offscreen left/right, next photo preloaded right) in
    // stale-first DOM order. Element grabs identify ONE post: the slide
    // actually on screen. Without layout metrics (jsdom fixtures) the legacy
    // all-slides behavior is kept.
    const onScreenImg = pickFocusedImage(focusedImgs);
    const targets = onScreenImg ? [onScreenImg] : focusedImgs;
    for (const img of targets) {
      const url = getOriginalImageUrl(img);
      if (url) {
        addPost(url.href);
      }
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
      // Same convention as the element grabs: pageUrl is the post's canonical
      // permalink, not the raw browsing page
      post.pageUrl = source;
      post.contentUrl = contentUrl;
      post.contentType = contentType;
      post.sources = [source];
      post.tags = tags.slice();
      // twimg (pbs.twimg.com, video.twimg.com) rejects non-browser fetches,
      // so the szurubooru server cannot download these urls - the consumer
      // must fetch them itself. Matches the element-grab paths above.
      post.uploadMode = "content";
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
      // The lightbox media pane is a carousel that keeps every navigated slide
      // mounted in stale-first DOM order (parked offscreen left/right, next
      // photo preloaded right). Consumers default to the first post, so the
      // on-screen slide is emitted first; the rest of the legacy sweep (parked
      // slides, thread photos) follows. Without layout metrics (jsdom
      // fixtures) the sweep runs in legacy DOM order.
      const onScreenImg = pickFocusedImage(lightboxImgs);
      const orderedImgs = onScreenImg
        ? [onScreenImg, ...lightboxImgs.filter((img) => img !== onScreenImg)]
        : lightboxImgs;
      const lightboxTags = artist ? hashtags.concat([artist]) : hashtags.slice();
      for (const img of orderedImgs) {
        const url = getOriginalImageUrl(img);
        if (url) {
          addPost(url.href, "image", lightboxTags, source);
        }
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
        const url = getOriginalImageUrl(img);
        if (url) {
          addPost(url.href, "image", articleTags, articleSource);
        }
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
