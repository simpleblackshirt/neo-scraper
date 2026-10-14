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

export default class Bluesky extends ScrapeEngineBase {
  name = "bluesky";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category"];
  notes = [
    "Hashtags become tags and the author's handle becomes an artist tag.",
    "Tags may be unavailable in the fullscreen image viewer when the post text is not rendered.",
  ];
  supportedHosts = ["bsky.app"];

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
