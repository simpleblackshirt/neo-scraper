import { ScrapeEngineBase, ScrapeResult, ScrapedPost, ScrapedTag, ScrapeEngineFeature } from "../ScrapeEngine.js";
import { guessContentType } from "../Utility.js";

/**
 * Returns true when the URL points at one of Lofter's image CDNs.
 */
function isLofterCdnUrl(url: string) {
  return /(\.lf127\.net|\.127\.net|imglf)/.test(url);
}

/**
 * Returns true when an image looks like a user avatar (the blog owner's icon,
 * or the icons of users who liked/commented/reblogged) rather than post
 * content. The checks are redundant on purpose: real avatars match all of
 * them, so a single check failing (e.g. on custom blog themes) doesn't let
 * the noise through. `resolvedUrl` is the content url getOriginalImgUrl()
 * resolved, because a lazy-loaded avatar's src is just a placeholder.
 */
function isAvatarImage(img: HTMLImageElement, resolvedUrl: string) {
  // The notes list (likes/reblogs), the comment section and the blog-owner
  // info block.
  if (img.closest(".notes, .note, .selfinfo, #comment")) {
    return true;
  }
  // Avatars are usually tagged with an avatar class. closest() covers the
  // img itself and its wrapping link/containers.
  if (img.closest("[class*='avatar'], [class*='Avatar']")) {
    return true;
  }
  // Avatars are served from a dedicated host and/or carry "avatar" in the
  // path: https://avaimg.lf127.net/img/…, https://lofter.lf127.net/…/avatar_default.jpg
  try {
    const url = new URL(resolvedUrl);
    return url.hostname.startsWith("avaimg.") || /avatar/i.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * Strips Lofter's image processing query to get the original quality image:
 * https://imglf1.lf127.net/img/xxx.png?imageView&thumbnail=500x0&quality=96&stripmeta=1&type=jpg
 * -> https://imglf1.lf127.net/img/xxx.png
 */
export function upgradeToOriginalQuality(imgUrl: string) {
  const queryIndex = imgUrl.indexOf("?");
  if (queryIndex != -1 && /imageView|thumbnail|quality|stripmeta/.test(imgUrl.slice(queryIndex))) {
    return imgUrl.slice(0, queryIndex);
  }
  return imgUrl;
}

// Attributes Lofter's lazy-loader fills with the real CDN url; until an
// image scrolls into view, src only holds a placeholder (data URI).
const lazySrcAttributes = ["data-src", "data-lazy-src", "data-original", "data-origin-src"];

/**
 * Resolves a possibly relative/protocol-relative URL against the page URL.
 */
function absoluteUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Returns the best URL for the original image. Gallery anchors carry a
 * bigimgsrc attribute pointing at the full-size render, which the img src
 * doesn't use on all blog themes (they may serve a cropped thumbnail path).
 * bigimgsrc is only adopted when the anchor wraps a single content img:
 * anchors wrapping several imgs (some themes/lightboxes) would otherwise
 * resolve every wrapped image to the same url, letting the seenUrls dedup
 * collapse the gallery to one post. Otherwise the lazy-load attributes are
 * checked before src, which may hold a placeholder until the image scrolls
 * into view.
 */
function getOriginalImgUrl(img: HTMLImageElement) {
  const anchor = img.closest("a[bigimgsrc]");
  const bigImgSrc = anchor?.getAttribute("bigimgsrc");
  if (bigImgSrc && isLofterCdnUrl(bigImgSrc) && anchor!.querySelectorAll("img").length == 1) {
    return bigImgSrc;
  }
  for (const attr of lazySrcAttributes) {
    const url = img.getAttribute(attr);
    if (url && isLofterCdnUrl(url)) {
      return url;
    }
  }
  return img.src;
}

// Post permalinks: <user>.lofter.com/post/<id> (the dashboard's "查看全文"
// link and themed blog pages alike).
const postPermalinkRe = /lofter\.com\/post\//;

function hasPostPermalinkLink(el: Element): boolean {
  if (el.matches("a[href]") && postPermalinkRe.test(el.getAttribute("href") || "")) {
    return true;
  }
  return Array.from(el.querySelectorAll("a[href]")).some((a) => postPermalinkRe.test(a.getAttribute("href") || ""));
}

/**
 * The artist subdomain from a post permalink
 * (`https://<user>.lofter.com/post/<id>` -> `<user>`).
 */
function artistFromPermalink(permalink: string): string | undefined {
  try {
    const host = new URL(permalink).hostname;
    if (host != "www.lofter.com" && host.endsWith("lofter.com")) {
      return host.split(".")[0];
    }
  } catch {
    // relative or malformed - no artist
  }
  return undefined;
}

/**
 * The artist subdomain from a scope without a permalink link: the blog-root
 * author link (`https://<user>.lofter.com`), skipping tag/edit links.
 */
function artistFromBlogLink(scope: Element, baseUrl: string): ScrapedTag | undefined {
  for (const a of Array.from(scope.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const href = a.getAttribute("href") ?? "";
    if (href.indexOf("lofter.com") == -1 || href.indexOf("/post/") != -1 || href.indexOf("/tag/") != -1) {
      continue;
    }
    try {
      const host = new URL(absoluteUrl(href, baseUrl)).hostname;
      if (host != "www.lofter.com" && host.endsWith("lofter.com")) {
        return new ScrapedTag(host.split(".")[0], "artist");
      }
    } catch {
      // unparseable href - try the next link
    }
  }
  return undefined;
}

function tagsFromScope(scope: Element): ScrapedTag[] {
  const tags: ScrapedTag[] = [];
  for (const a of Array.from(scope.querySelectorAll<HTMLAnchorElement>("a[href*='/tag/']"))) {
    const nameSegment = a.pathname.split("/").pop() ?? "";
    const name = (nameSegment ? decodeURIComponent(nameSegment) : (a.textContent ?? ""))
      .replace(/^#/g, "")
      .replace(/#$/g, "")
      .trim();
    if (name && !tags.some((x) => x.name == name)) {
      tags.push(new ScrapedTag(name));
    }
  }
  return tags;
}

function pageUrlFrom(container: Element): string {
  return container.ownerDocument?.location?.href ?? "";
}

export default class Lofter extends ScrapeEngineBase {
  name = "lofter";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "Document scrape only acts on post permalinks (…lofter.com/post/…); element grabs (context menu) work on any card - the user aimed at a specific post.",
    "The artist tag is derived from the post's blog subdomain (the permalink hostname, or the card's author blog link on the dashboard).",
    "Multi-image posts are scraped as multiple posts.",
    "User avatars (blog owner icon, like/comment lists) are excluded.",
  ];
  supportedHosts = ["lofter.com"];

  // Blog posts live on subdomains (<user>.lofter.com), so we can't use the
  // exact host matching from ScrapeEngineBase.
  canImport(url: Location): boolean {
    return url.host.replace("www.", "").endsWith("lofter.com");
  }

  /**
   * Container resolution for context-menu element grabs: the innermost
   * ancestor containing a post permalink. On the dashboard this is the post's
   * content block (which holds the author link, tags, permalink and media);
   * on themed blog pages it is the theme's post container.
   */
  findPostContainer(target: Element): Element | null {
    let node: Element | null = target;
    while (node) {
      node = node.parentElement;
      if (!node) {
        break;
      }
      if (hasPostPermalinkLink(node)) {
        return node;
      }
    }
    return null;
  }

  scrapeElement(container: Element): ScrapeResult {
    return this.scrapeCard(container);
  }

  /**
   * Scrapes a post card resolved by findPostContainer. Works for dashboard
   * cards and themed permalink pages alike: artist from the permalink's blog
   * subdomain (or the card's author link), tags from /tag/ link hrefs, media
   * via getOriginalImgUrl (gallery anchors, lazy attributes, original
   * quality) with the usual avatar exclusion.
   */
  private scrapeCard(scope: Element): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const baseUrl = pageUrlFrom(scope);

    // The scope itself can be the permalink anchor (gallery images are
    // wrapped in one on themed blog pages) - the element-list lookup below
    // only sees descendants, so check the scope first.
    const permalinkEl = scope.matches("a[href]") && postPermalinkRe.test(scope.getAttribute("href") || "")
      ? scope
      : Array.from(scope.querySelectorAll<HTMLAnchorElement>("a[href]")).find((a) =>
          postPermalinkRe.test(a.getAttribute("href") || "")
        );
    const source = permalinkEl ? absoluteUrl(permalinkEl.getAttribute("href") || "", baseUrl) : undefined;
    const pageUrl = source ?? baseUrl;
    const artistSubdomain = permalinkEl ? artistFromPermalink(source!) : undefined;
    const artist = artistSubdomain ? new ScrapedTag(artistSubdomain, "artist") : artistFromBlogLink(scope, baseUrl);

    const tags = tagsFromScope(scope);
    if (artist) {
      tags.push(artist);
    }

    const buildPost = (contentUrl: string, contentType: "image" | "video") => {
      const post = new ScrapedPost();
      post.pageUrl = pageUrl;
      post.contentUrl = contentUrl;
      post.contentType = contentType;
      post.sources = source ? [source] : [];
      post.tags = tags.slice();
      return post;
    };

    // Video wins when the expanded player is rendered with a real src; blob
    // stream pointers and absent players fall through to images (a video
    // post's cover image).
    const videos = Array.from(scope.querySelectorAll("video"));
    let videoSrc: string | undefined = undefined;
    for (const video of videos) {
      const src = video.querySelector("source")?.src ?? video.src;
      if (src && !src.startsWith("blob:")) {
        videoSrc = src;
        break;
      }
    }
    if (videoSrc) {
      result.tryAddPost(buildPost(videoSrc, "video"));
      return result;
    }

    const seen = new Set<string>();
    for (const img of Array.from(scope.querySelectorAll("img"))) {
      const url = getOriginalImgUrl(img);
      if (!isLofterCdnUrl(url) || isAvatarImage(img, url)) {
        continue;
      }
      const contentUrl = upgradeToOriginalQuality(url);
      if (seen.has(contentUrl)) {
        continue;
      }
      seen.add(contentUrl);

      result.tryAddPost(buildPost(contentUrl, guessContentType(contentUrl)));
    }

    return result;
  }


  scrapeDocument(document: Document): ScrapeResult {
    const result = new ScrapeResult(this.name);

    // Only act on post permalinks. On dashboard/feed pages the images are
    // just thumbnails, there the fallback engine is the better choice.
    if (document.location.pathname.indexOf("/post/") == -1) {
      this.log("Not a post permalink, skipping.");
      return result;
    }

    // Tags from the post's tag links. The name is derived from the encoded
    // /tag/ link target, because the display text can carry decoration glyphs
    // (e.g. "●_明日方舟") that can't be stripped reliably.
    const tags: ScrapedTag[] = [];
    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href*='/tag/']"))) {
      const nameSegment = a.pathname.split("/").pop() ?? "";
      const name = (nameSegment ? decodeURIComponent(nameSegment) : (a.textContent ?? ""))
        .replace(/^#/g, "")
        .replace(/#$/g, "")
        .trim();
      if (name && !tags.some((x) => x.name == name)) {
        tags.push(new ScrapedTag(name));
      }
    }

    // The blog subdomain is a stable identifier for the artist.
    const host = document.location.hostname;
    if (host != "www.lofter.com" && host.endsWith(".lofter.com")) {
      tags.push(new ScrapedTag(host.split(".")[0], "artist"));
    }

    const source = document.location.origin + document.location.pathname;

    // Video content, if present.
    const videoSrc =
      document.querySelector<HTMLSourceElement>("video source")?.src ??
      document.querySelector<HTMLVideoElement>("video")?.src;

    if (videoSrc) {
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = videoSrc;
      post.contentType = "video";
      post.sources = [source];
      post.tags = tags.slice();
      result.tryAddPost(post);
      return result;
    }

    // Images from the post body. getOriginalImgUrl() resolves lazy-loaded
    // images (src may be a placeholder) and gallery anchors. Avatars (the
    // blog owner's icon, the icons of users who liked/commented) are
    // excluded — see isAvatarImage().
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img")).filter((x) => {
      const url = getOriginalImgUrl(x);
      return isLofterCdnUrl(url) && !isAvatarImage(x, url);
    });

    // Each image becomes its own post. Dedup by content URL, since the same
    // image can be rendered more than once on the page.
    const seenUrls = new Set<string>();
    for (const img of imgs) {
      const contentUrl = upgradeToOriginalQuality(getOriginalImgUrl(img));
      if (seenUrls.has(contentUrl)) {
        continue;
      }
      seenUrls.add(contentUrl);

      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = contentUrl;
      post.contentType = guessContentType(post.contentUrl);
      post.sources = [source];
      post.tags = tags.slice();
      result.tryAddPost(post);
    }

    return result;
  }
}
