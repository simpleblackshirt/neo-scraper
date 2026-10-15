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
 * the noise through.
 */
function isAvatarImage(img: HTMLImageElement) {
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
    const url = new URL(img.src);
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

/**
 * Returns the best URL for the original image: gallery anchors carry a
 * bigimgsrc attribute pointing at the full-size render, which the img src
 * doesn't use on all blog themes (they may serve a cropped thumbnail path).
 */
function getOriginalImgUrl(img: HTMLImageElement) {
  const bigImgSrc = img.closest("a[bigimgsrc]")?.getAttribute("bigimgsrc");
  return bigImgSrc && isLofterCdnUrl(bigImgSrc) ? bigImgSrc : img.src;
}

export default class Lofter extends ScrapeEngineBase {
  name = "lofter";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "Only scrapes post permalinks (…lofter.com/post/…), not the dashboard or blog feeds.",
    "The artist tag is derived from the blog's subdomain.",
    "Multi-image posts are scraped as multiple posts.",
    "User avatars (blog owner icon, like/comment lists) are excluded.",
  ];
  supportedHosts = ["lofter.com"];

  // Blog posts live on subdomains (<user>.lofter.com), so we can't use the
  // exact host matching from ScrapeEngineBase.
  canImport(url: Location): boolean {
    return url.host.replace("www.", "").endsWith("lofter.com");
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

    // Images from the post body. Avatars (the blog owner's icon, the icons of
    // users who liked/commented) are excluded — see isAvatarImage().
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img")).filter(
      (x) => isLofterCdnUrl(x.src) && !isAvatarImage(x)
    );

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
