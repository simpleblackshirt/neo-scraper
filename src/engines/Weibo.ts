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

/**
 * Resolves a possibly protocol-relative URL (//wx1.sinaimg.cn/...) against the page URL.
 */
function absoluteUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

// Hostnames that serve weibo's own media; used to tell status videos apart
// from stray players pointing at other CDNs.
const weiboMediaHosts = /(^|\.)(weibocdn\.com|weibo\.com|weibo\.cn|weibo\.com\.cn|sinaimg\.cn|sina\.cn)$/i;

function isWeiboHostedUrl(url: string, baseUrl: string): boolean {
  try {
    return weiboMediaHosts.test(new URL(url, baseUrl).hostname);
  } catch {
    return false;
  }
}

// Real media on sinaimg.cn lives under a size-directory token
// (/large/, /mw2000/, /orj480/, /thumbnail/, /crop.0.0.50.50.50/, ...).
// Chrome assets on d./a.sinaimg.cn (icons, scripts) have no such token.
const sinaPicPathToken = /\/(large|mw\d+|orj\d+|square|thumbnail|bmiddle|thumb\d+|crop[\d.]+)\//i;

function isSinaPicUrl(url: string): boolean {
  return url.indexOf("sinaimg.cn") != -1 && sinaPicPathToken.test(url);
}

// weibo's lazy-loader writes the literal "false" into consumed attributes.
function isRealAttribute(x: string | null | undefined): x is string {
  return x != undefined && x.length > 0 && x != "false" && x != "null";
}

/**
 * Finds the sinaimg.cn media URL of an image element, reading lazy-load
 * attributes: `src` may hold a placeholder (data URI, tiny thumb, empty)
 * until the image scrolls into view, and consumed attributes carry the
 * sentinel "false". srcset candidates are checked largest-last.
 */
function sinaImageUrlFromImg(img: HTMLImageElement): string | undefined {
  const candidates = [
    img.getAttribute("src"),
    img.getAttribute("data-src"),
    img.getAttribute("data-lazy-src"),
    img.getAttribute("data-original"),
  ].filter(isRealAttribute);
  const srcset = img.getAttribute("srcset");
  if (srcset) {
    const urls = srcset
      .split(",")
      .map((x) => x.trim().split(/\s+/)[0])
      .filter(isRealAttribute)
      .reverse();
    candidates.push(...urls);
  }
  return candidates.find(isSinaPicUrl);
}

export default class Weibo extends ScrapeEngineBase {
  name = "weibo";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "Only scrapes status permalinks (weibo.com/<uid>/<bid>, weibo.com/u/<uid>/<bid>, m.weibo.cn/status/…, m.weibo.cn/detail/…).",
    "The author's display name becomes an artist tag. Weibo redesigns its DOM often, so this engine can break at any time.",
    "Multi-image posts are scraped as multiple posts.",
  ];
  supportedHosts = ["weibo.com", "m.weibo.cn", "weibo.cn", "weibo.com.cn"];

  scrapeDocument(document: Document): ScrapeResult {
    const result = new ScrapeResult(this.name);

    // Only act on status permalinks.
    const path = document.location.pathname;
    const segments = path.split("/").filter((x) => x.length > 0);
    const first = segments[0] ?? "";
    const last = segments[segments.length - 1] ?? "";
    const isMobileStatus = /^\/(status|detail)\//.test(path);
    // Desktop permalinks: /<uid>/<bid>, /<screen_name>/<bid>, /u/<uid>/<bid>
    // (also /profile/<uid>/<bid>). Bids may contain dashes/underscores. Feed
    // and tab roots without a trailing bid are not statuses.
    const isDesktopStatus =
      segments.length >= 2 &&
      /^[A-Za-z0-9_-]+$/.test(last) &&
      !/^(home|hot|search)$/.test(first) &&
      (/^(u|profile)$/.test(first) ? segments.length >= 3 : true);
    if (!isDesktopStatus && !isMobileStatus) {
      this.log("Not a status permalink, skipping.");
      return result;
    }

    // Author display name -> artist tag. Hrefs are resolved before matching
    // so both relative (/123) and absolute (https://weibo.com/u/123) forms
    // count; usercard is weibo's own author-link marker. Status links like
    // the post's time link (<uid>/<bid>) never match.
    const tags: ScrapedTag[] = [];
    if (isDesktopStatus) {
      const uid = first == "u" || first == "profile" ? segments[1] ?? "" : first;
      const isAuthorLink = (a: HTMLAnchorElement): boolean => {
        if (a.getAttribute("usercard") == uid) {
          return true;
        }
        try {
          const hrefSegments = new URL(a.href, document.location.href).pathname
            .split("/")
            .filter((x) => x.length > 0);
          return (
            (hrefSegments.length == 1 && hrefSegments[0] == uid) ||
            (hrefSegments.length == 2 && hrefSegments[0] == "u" && hrefSegments[1] == uid)
          );
        } catch {
          return false;
        }
      };
      const authorName = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href], a[usercard]"))
        .filter(isAuthorLink)
        .map((x) => (x.textContent ?? "").trim())
        .find((x) => x.length > 0);
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
    // so when a status video is found we skip the images. Stray players are
    // ignored: only a video in the content area pointing at one of weibo's
    // own media CDNs counts.
    let videoSrc: string | undefined = undefined;
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video")).filter(
      (x) => !x.closest("header, nav, footer, aside, [class*='avatar']")
    );
    for (const video of videos) {
      const sources: string[] = [];
      if (video.src) {
        sources.push(video.src);
      }
      for (const source of Array.from(video.querySelectorAll("source"))) {
        if (source.src) {
          sources.push(source.src);
        }
      }
      const found = sources.find((x) => isWeiboHostedUrl(x, document.location.href));
      if (found) {
        videoSrc = found;
        break;
      }
    }

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

    // Images. The positive scan is scoped to the post article: comment
    // threads, related cards and the lightbox render outside it through the
    // same shared picture component. When the scoped scan yields at least
    // one url the page-global img fallback is skipped entirely; the fallback
    // only rescues pages whose DOM doesn't match the article shape. Exclude
    // avatars, the sidebar author banner and comment/reply containers, skip
    // weibo emoticon imgs, upgrade remaining URLs to /large/.
    const isNotChrome = (x: HTMLImageElement) =>
      !x.closest("header, [class*='avatar'], .avatar, .head, .profile, [class*='side'], [class*='omment'], [class*='eply']");
    // "[...]" alt/title is weibo's emoticon convention; sinaimg-hosted
    // sticker packs carry real size tokens so the URL test can't reject them.
    const isNotEmoticon = (x: HTMLImageElement) => !/^\[.+\]$/.test(x.alt) && !/^\[.+\]$/.test(x.title);
    const sinaUrlsFrom = (imgs: HTMLImageElement[]) =>
      imgs.filter((x) => isNotChrome(x) && isNotEmoticon(x)).map((x) => sinaImageUrlFromImg(x));
    const seenUrls = new Set<string>();
    const imgUrls = sinaUrlsFrom(
      Array.from(
        document.querySelectorAll<HTMLImageElement>("article .wbpro-feed-content img, article .woo-picture-img")
      )
    );
    if (!imgUrls.some(Boolean)) {
      imgUrls.push(...sinaUrlsFrom(Array.from(document.querySelectorAll<HTMLImageElement>("img"))));
    }

    for (const rawUrl of imgUrls) {
      if (!rawUrl) {
        continue;
      }
      const contentUrl = upgradeSinaImageUrl(absoluteUrl(rawUrl, document.location.href));
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
