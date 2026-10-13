import { ScrapeEngineBase, ScrapeResult, ScrapedPost, ScrapedTag, ScrapeEngineFeature } from "../ScrapeEngine.js";
import { guessContentType } from "../Utility.js";

/**
 * Returns true when the URL points at one of Lofter's image CDNs.
 */
function isLofterCdnUrl(url: string) {
  return /(\.lf127\.net|\.127\.net|imglf)/.test(url);
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

export default class Lofter extends ScrapeEngineBase {
  name = "lofter";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "Only scrapes post permalinks (…lofter.com/post/…), not the dashboard or blog feeds.",
    "The artist tag is derived from the blog's subdomain.",
    "Multi-image posts are scraped as multiple posts.",
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

    // Images from the post body. Exclude images in author/header/sidebar areas (avatars etc.).
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img")).filter(
      (x) => isLofterCdnUrl(x.src) && !x.closest("header, .info, .profile, .blog-info, .sidebar, .post-author")
    );

    for (const img of imgs) {
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = upgradeToOriginalQuality(img.src);
      post.contentType = guessContentType(post.contentUrl);
      post.sources = [source];
      post.tags = tags.slice();
      result.tryAddPost(post);
    }

    return result;
  }
}
