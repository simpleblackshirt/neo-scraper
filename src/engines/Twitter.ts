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

export default class Twitter extends ScrapeEngineBase {
  name = "twitter";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "Hashtags become tags and the author's handle becomes an artist tag.",
    "X redesigns its DOM frequently, so this engine can break at any time.",
  ];
  supportedHosts = ["twitter.com", "mobile.twitter.com", "x.com"];

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
