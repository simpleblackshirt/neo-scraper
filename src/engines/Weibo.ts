import { ScrapeEngineBase, ScrapeResult, ScrapedPost, ScrapedTag, ScrapeEngineFeature } from "../ScrapeEngine.js";
import { guessContentType } from "../Utility.js";

/**
 * Upgrades a sinaimg.cn image URL to its largest available variant:
 * https://wx1.sinaimg.cn/mw2000/abc/def.jpg -> https://wx1.sinaimg.cn/large/abc/def.jpg
 */
export function upgradeSinaImageUrl(url: string) {
  return url.replace(/\/(thumb\d+|bmiddle|mw\d+|orj\d+|square|thumbnail)\//, "/large/");
}

/**
 * Extracts the topic name from a weibo hashtag text like "#SomeTopic#".
 */
function topicNameFromText(text: string): string | undefined {
  const match = /^#(.+?)#?$/.exec(text.trim());
  if (match && match[1]) {
    return match[1].trim();
  }
  return undefined;
}

export default class Weibo extends ScrapeEngineBase {
  name = "weibo";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "Only scrapes status permalinks (weibo.com/<uid>/<bid>, m.weibo.cn/status/…, m.weibo.cn/detail/…).",
    "The author's display name becomes an artist tag. Weibo redesigns its DOM often, so this engine can break at any time.",
    "Multi-image posts are scraped as multiple posts.",
  ];
  supportedHosts = ["weibo.com", "m.weibo.cn", "weibo.cn", "weibo.com.cn"];

  scrapeDocument(document: Document): ScrapeResult {
    const result = new ScrapeResult(this.name);

    // Only act on status permalinks.
    const path = document.location.pathname;
    const isDesktopStatus = /^\/[^/]+\/[A-Za-z0-9]+\/?$/.test(path) && !/^\/(u|profile|home|hot|search)/.test(path);
    const isMobileStatus = /^\/(status|detail)\//.test(path);
    if (!isDesktopStatus && !isMobileStatus) {
      this.log("Not a status permalink, skipping.");
      return result;
    }

    // Author display name -> artist tag.
    const tags: ScrapedTag[] = [];
    if (isDesktopStatus) {
      const uid = path.split("/")[1];
      const authorLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href='/${uid}']`));
      const authorName = authorLinks.map((x) => (x.textContent ?? "").trim()).find((x) => x.length > 0);
      if (authorName) {
        tags.push(new ScrapedTag(authorName, "artist"));
      }
    }

    // Topics from hashtag links: #SomeTopic#
    // Weibo links them to s.weibo.com or /search URLs, but the safest
    // identifier is the "#…#" text itself.
    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>("a"))) {
      const name = topicNameFromText(a.textContent ?? "");
      if (name && !tags.some((x) => x.name == name)) {
        tags.push(new ScrapedTag(name));
      }
    }

    const source = document.location.origin + path;

    // Video content, if present. Video posts also render poster thumbnails,
    // so when a video is found we skip the images.
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

    // Images. Exclude avatars and other chrome, upgrade remaining URLs to /large/.
    const seenUrls = new Set<string>();
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[src*='sinaimg.cn']")).filter(
      (x) => !x.closest("header, [class*='avatar'], .avatar, .head, .profile")
    );

    for (const img of imgs) {
      const contentUrl = upgradeSinaImageUrl(img.src);
      if (seenUrls.has(contentUrl)) {
        continue;
      }
      seenUrls.add(contentUrl);

      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = contentUrl;
      post.contentType = guessContentType(contentUrl);
      post.sources = [source];
      post.tags = tags.slice();
      result.tryAddPost(post);
    }

    return result;
  }
}
