import { ScrapeEngineBase, ScrapeResult, ScrapedPost, ScrapedTag, ScrapeEngineFeature } from "../ScrapeEngine.js";

function getFullSizeImg(link: string) {
  return link.replace("/feed_thumbnail/", "/feed_fullsize/");
}

/**
 * Resolves the handle from a profile link href.
 * Accepts both relative (`/profile/<handle>`) and absolute hrefs and ignores
 * links to nested resources like `/profile/<handle>/post/<id>`.
 */
function handleFromProfileHref(href: string): string | undefined {
  const path = href.startsWith("http") ? new URL(href).pathname : href;
  const segments = path.split("/").filter((x) => x.length > 0);
  if (segments.length == 2 && segments[0] == "profile") {
    return segments[1];
  }
  return undefined;
}

/**
 * Resolves the tag name from a hashtag link href (`/hashtag/<tag>`).
 */
function nameFromHashtagHref(href: string): string | undefined {
  const path = href.startsWith("http") ? new URL(href).pathname : href;
  const segments = path.split("/").filter((x) => x.length > 0);
  if (segments.length == 2 && segments[0] == "hashtag") {
    return decodeURIComponent(segments[1]);
  }
  return undefined;
}

/**
 * Extracts hashtags from a post container and returns them as tags.
 */
function hashtagsFromElement(el: Element): ScrapedTag[] {
  const tags: ScrapedTag[] = [];
  const seen = new Set<string>();
  for (const a of Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="/hashtag/"]'))) {
    const href = a.getAttribute("href") ?? "";
    const name = nameFromHashtagHref(href) ?? (a.textContent ?? "").replace(/^#/g, "").trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      tags.push(new ScrapedTag(name));
    }
  }
  return tags;
}

/**
 * Extracts the author handle from a post container and returns it as an artist tag.
 */
function artistFromElement(el: Element): ScrapedTag | undefined {
  const authorLink = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="/profile/"]')).find(
    (a) => handleFromProfileHref(a.getAttribute("href") ?? "") != undefined
  );
  const handle = authorLink ? handleFromProfileHref(authorLink.getAttribute("href") ?? "") : undefined;
  if (handle) {
    return new ScrapedTag(handle, "artist");
  }
  return undefined;
}

/**
 * Finds the container of the post that the given image belongs to.
 * Every post renders an author link (`/profile/<handle>`) in its header, so the
 * first ancestor that contains one is the post's own container. This keeps tags
 * from leaking between posts on feeds and threads.
 */
function postScopeFromImg(img: HTMLImageElement): Element | undefined {
  let el = img.parentElement;
  while (el) {
    if (artistFromElement(el) != undefined) {
      return el;
    }
    el = el.parentElement;
  }
  return undefined;
}

/**
 * Finds the post permalink (`https://bsky.app/profile/<handle>/post/<id>`) in
 * a post container. Links to a post's sub-pages (/liked-by, /likes, ...) are
 * not permalinks; on a post's own page no permalink link exists at all.
 */
function permalinkFromElement(el: Element): string | undefined {
  const link = Array.from(el.querySelectorAll<HTMLAnchorElement>("a[href]")).find((a) => {
    const href = a.getAttribute("href") ?? "";
    const path = href.startsWith("http") ? new URL(href).pathname : href;
    return /^\/profile\/[^/]+\/post\/[^/]+$/.test(path);
  });
  if (!link) {
    return undefined;
  }
  const href = link.getAttribute("href") ?? "";
  return href.startsWith("http") ? href : "https://bsky.app" + href;
}

/**
 * Content media of a post container: feed thumbnails and fullsize images.
 * Excludes avatar images, which appear inside post scopes (author header) and
 * in standalone avatar scopes.
 */
function feedImgs(container: Element): HTMLImageElement[] {
  return Array.from(container.querySelectorAll<HTMLImageElement>("img")).filter(
    (img) => img.src.indexOf("/feed_thumbnail/") != -1 || img.src.indexOf("/feed_fullsize/") != -1
  );
}

function pageUrlFrom(container: Element): string {
  return container.ownerDocument?.location?.href ?? "";
}

export default class Bluesky extends ScrapeEngineBase {
  name = "bluesky";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category"];
  notes = [
    "Hashtags become tags and the author's handle becomes an artist tag.",
    "Tags may be unavailable in the fullscreen image viewer when the post text is not rendered.",
    "Element grabs (context menu): the fullscreen viewer yields a content-only post (the dialog renders no metadata), and quoted posts cannot be grabbed independently - quote cards render without any links or metadata, so quoted clicks grab the outer post including the quoted media.",
  ];
  supportedHosts = ["bsky.app"];

  /**
   * Container resolution for context-menu element grabs: the same walk as
   * postScopeFromImg, generalized to any target (text, media). Falls back to
   * the fullscreen viewer dialog, which contains no profile links.
   */
  findPostContainer(target: Element): Element | null {
    let node: Element | null = target;
    while (node) {
      node = node.parentElement;
      if (!node) {
        break;
      }
      if (artistFromElement(node)) {
        return node;
      }
    }
    return target.closest("[role='dialog']");
  }

  scrapeElement(container: Element): ScrapeResult {
    if (container.getAttribute("role") === "dialog") {
      return this.scrapeViewerDialog(container);
    }
    return this.scrapePostContainer(container);
  }

  private scrapePostContainer(scope: Element): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const artist = artistFromElement(scope);
    const hashtags = hashtagsFromElement(scope);
    const tags = artist ? hashtags.concat([artist]) : hashtags.slice();
    const permalink = permalinkFromElement(scope);
    // Element grabs identify ONE post: pageUrl is its canonical permalink when
    // the scope carries one, otherwise the page itself (a post's own page IS
    // the canonical url).
    const pageUrl = permalink ?? pageUrlFrom(scope);

    const seen = new Set<string>();
    for (const img of feedImgs(scope)) {
      const contentUrl = getFullSizeImg(img.src);
      if (seen.has(contentUrl)) {
        continue;
      }
      seen.add(contentUrl);

      const post = new ScrapedPost();
      post.pageUrl = pageUrl;
      post.contentUrl = contentUrl;
      post.sources = permalink ? [permalink] : [];
      post.tags = tags.slice();
      result.tryAddPost(post);
    }

    return result;
  }

  /**
   * Scrapes the fullscreen image viewer: content only - the dialog renders no
   * author, permalink or tag information (see notes).
   */
  private scrapeViewerDialog(dialog: Element): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const pageUrl = pageUrlFrom(dialog);

    const seen = new Set<string>();
    for (const img of feedImgs(dialog)) {
      const contentUrl = getFullSizeImg(img.src);
      if (seen.has(contentUrl)) {
        continue;
      }
      seen.add(contentUrl);

      const post = new ScrapedPost();
      post.pageUrl = pageUrl;
      post.contentUrl = contentUrl;
      result.tryAddPost(post);
    }

    return result;
  }


  scrapeDocument(document: Document): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const imgEls = Array.from<HTMLImageElement>(document.querySelectorAll("div > img"));

    let els = imgEls.filter((x) => x.src.indexOf("feed_fullsize") != -1);

    // Only add the 'normal' feed elements if no post is in fullscreen.
    if (els.length == 0) {
      this.log("Post is not fullscreen.");
      els = imgEls.filter((x) => x.src.indexOf("feed") != -1);
    }

    for (const el of els) {
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = getFullSizeImg(el.src);

      // Hashtags and the artist come from the post container that owns this image.
      const scope = postScopeFromImg(el);
      if (scope) {
        const hashtags = hashtagsFromElement(scope);
        const artist = artistFromElement(scope);
        post.tags = artist ? hashtags.concat([artist]) : hashtags;
      }

      result.tryAddPost(post);
    }

    return result;
  }
}
