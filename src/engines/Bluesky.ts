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
 * Bluesky artist tags drop the `.bsky.social` suffix; custom-domain handles
 * are kept as-is.
 */
function artistFromElement(el: Element): ScrapedTag | undefined {
  const authorLink = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="/profile/"]')).find(
    (a) => handleFromProfileHref(a.getAttribute("href") ?? "") != undefined
  );
  const handle = authorLink ? handleFromProfileHref(authorLink.getAttribute("href") ?? "") : undefined;
  if (handle) {
    return artistTagFromHandle(handle);
  }
  return undefined;
}

function artistTagFromHandle(handle: string): ScrapedTag {
  return new ScrapedTag(handle.replace(/\.bsky\.social$/, ""), "artist");
}

/**
 * Embedded quote cards are wrapped in a clickable div carrying the quoted
 * author's handle in its aria-label - the only landmark they render (no
 * profile links, no permalinks, no testids).
 */
const QUOTE_CARD_SELECTOR = '[role="link"][aria-label^="Post by "]';

function quoteCardHandle(card: Element): string | undefined {
  return card.getAttribute("aria-label")?.match(/^Post by (.+)$/)?.[1];
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
 * Extracts the post author's handle from a post url
 * (`/profile/<handle>/post/<id>` - relative or absolute).
 */
function handleFromPostUrl(url: string): string | undefined {
  const path = url.startsWith("http") ? new URL(url).pathname : url;
  return path.match(/^\/profile\/([^/]+)\/post\/[^/]+$/)?.[1];
}

/**
 * The post author's handle, derived from reliable sources in order: the
 * scope's own permalink, the page path (a post open individually IS the
 * canonical url), and only then the first profile link in the scope -
 * permalink pages render OTHER users' profile links (liked-by lines) that
 * would otherwise win in document order.
 */
function authorHandleFromScope(scope: Element, permalink: string | undefined): string | undefined {
  if (permalink) {
    const handle = handleFromPostUrl(permalink);
    if (handle) {
      return handle;
    }
  }
  const path = scope.ownerDocument?.location?.pathname;
  if (path) {
    const handle = handleFromPostUrl(path);
    if (handle) {
      return handle;
    }
  }
  const authorLink = Array.from(scope.querySelectorAll<HTMLAnchorElement>('a[href^="/profile/"]')).find(
    (a) => handleFromProfileHref(a.getAttribute("href") ?? "") != undefined
  );
  return authorLink ? handleFromProfileHref(authorLink.getAttribute("href") ?? "") : undefined;
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
  ];
  supportedHosts = ["bsky.app"];

  /**
   * Container resolution for context-menu element grabs, in priority order:
   * 1. the fullscreen viewer dialog (nested inside the app tree - checking it
   *    first keeps the walk from climbing out into the feed behind it),
   * 2. an embedded quote card (its own grab target; the walk would pass
   *    through it because cards render no profile links),
   * 3. the post container via the postScopeFromImg walk.
   */
  findPostContainer(target: Element): Element | null {
    // The fullscreen viewer dialog is nested inside the app tree AND renders
    // no metadata: check it first, and match the underlying post by blob id so
    // the grab resolves the real post scope (falling back to the dialog for a
    // content-only post when the post is not rendered behind it).
    const dialog = target.closest("[role='dialog']");
    if (dialog) {
      const img = target.tagName === "IMG" ? (target as HTMLImageElement) : dialog.querySelector("img");
      if (img) {
        const scope = this.underlyingScopeForViewerImg(img);
        if (scope) {
          return scope;
        }
      }
      return dialog;
    }
    const card = target.closest(QUOTE_CARD_SELECTOR);
    if (card) {
      return card;
    }
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
    return null;
  }

  /**
   * The viewer dialog renders the same image the underlying post shows as a
   * thumbnail - match by blob id (the last url path segment, unique per image)
   * and resolve that image's post scope.
   */
  private underlyingScopeForViewerImg(img: HTMLImageElement): Element | undefined {
    const blobId = img.src.split("/").pop();
    if (!blobId) {
      return undefined;
    }
    const doc = img.ownerDocument;
    if (!doc) {
      return undefined;
    }
    const match = Array.from(doc.querySelectorAll<HTMLImageElement>("img")).find(
      (x) => x !== img && !x.closest("[role='dialog']") && x.src.split("/").pop() === blobId
    );
    return match ? postScopeFromImg(match) : undefined;
  }

  scrapeElement(container: Element): ScrapeResult {
    if (container.getAttribute("role") === "dialog") {
      return this.scrapeViewerDialog(container);
    }
    if (container.matches(QUOTE_CARD_SELECTOR)) {
      return this.scrapeQuoteCard(container);
    }
    return this.scrapePostContainer(container);
  }

  /**
   * Scrapes an embedded quote card as a post of its own. The card renders no
   * links: the quoted author's handle comes from the aria-label, so the source
   * can only be the author's profile url, not the quoted post.
   */
  private scrapeQuoteCard(card: Element): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const handle = quoteCardHandle(card);
    const pageUrl = handle ? `https://bsky.app/profile/${handle}` : pageUrlFrom(card);
    const artist = handle ? artistTagFromHandle(handle) : undefined;

    const seen = new Set<string>();
    for (const img of feedImgs(card)) {
      const contentUrl = getFullSizeImg(img.src);
      if (seen.has(contentUrl)) {
        continue;
      }
      seen.add(contentUrl);

      const post = new ScrapedPost();
      post.pageUrl = pageUrl;
      post.contentUrl = contentUrl;
      post.sources = handle ? [pageUrl] : [];
      post.tags = artist ? [artist] : [];
      result.tryAddPost(post);
    }

    return result;
  }

  private scrapePostContainer(scope: Element): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const permalink = permalinkFromElement(scope);
    // The author comes from the permalink / page handle - profile links in the
    // scope are unreliable on permalink pages (liked-by lines).
    const authorHandle = authorHandleFromScope(scope, permalink);
    const artist = authorHandle ? artistTagFromHandle(authorHandle) : artistFromElement(scope);
    const hashtags = hashtagsFromElement(scope);
    const tags = artist ? hashtags.concat([artist]) : hashtags.slice();
    // Element grabs identify ONE post: pageUrl is its canonical permalink when
    // the scope carries one, otherwise the page itself (a post's own page IS
    // the canonical url).
    const pageUrl = permalink ?? pageUrlFrom(scope);

    const seen = new Set<string>();
    for (const img of feedImgs(scope)) {
      // Quoted media is excluded: the quote card is its own grab target.
      if (img.closest(QUOTE_CARD_SELECTOR)) {
        continue;
      }
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

    // On a post's own page the SPA keeps the previously visited feed mounted
    // in the DOM (100+ feed images observed on real pages) - restrict the
    // scrape to the focused post's thread item, whose testid embeds the page
    // author's handle.
    const pagePost = document.location.pathname.match(/^\/profile\/([^/]+)\/post\/[^/]+$/);
    let imgEls: HTMLImageElement[];
    if (pagePost && /^[A-Za-z0-9.:_-]+$/.test(pagePost[1])) {
      const focusedItem = document.querySelector(`[data-testid="postThreadItem-by-${pagePost[1]}"]`);
      if (focusedItem) {
        this.log("Post page detected - grabbing only the focused post.");
        imgEls = Array.from(focusedItem.querySelectorAll("img"));
      } else {
        imgEls = Array.from<HTMLImageElement>(document.querySelectorAll("div > img"));
      }
    } else {
      imgEls = Array.from<HTMLImageElement>(document.querySelectorAll("div > img"));
    }

    let els = imgEls.filter((x) => x.src.indexOf("feed_fullsize") != -1);

    // Only add the 'normal' feed elements if no post is in fullscreen.
    if (els.length == 0) {
      this.log("Post is not fullscreen.");
      els = imgEls.filter((x) => x.src.indexOf("feed") != -1);
    }

    for (const el of els) {
      const post = new ScrapedPost();
      post.contentUrl = getFullSizeImg(el.src);

      // Fullscreen viewer images live in a dialog without metadata - match
      // the underlying post by blob id so artist/source still resolve.
      const scope = el.closest("[role='dialog']")
        ? this.underlyingScopeForViewerImg(el)
        : postScopeFromImg(el);
      if (scope) {
        const permalink = permalinkFromElement(scope);
        const authorHandle = authorHandleFromScope(scope, permalink);
        const artist = authorHandle ? artistTagFromHandle(authorHandle) : artistFromElement(scope);
        const hashtags = hashtagsFromElement(scope);
        post.tags = artist ? hashtags.concat([artist]) : hashtags;
        if (permalink) {
          post.sources = [permalink];
          post.pageUrl = permalink;
        }
      }
      if (!post.pageUrl) {
        post.pageUrl = document.location.href;
      }

      result.tryAddPost(post);
    }

    return result;
  }
}
