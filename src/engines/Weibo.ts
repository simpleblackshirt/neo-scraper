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
 * Downgrades a sinaimg.cn image url from its /large/ rendition to /mw2000/
 * (same pic id and extension). Consumers use this as a fallback url when
 * fetching /large/ fails; urls without a /large/ segment pass through.
 */
export function downgradeSinaImageUrl(url: string) {
  return url.replace(/\/large\//, "/mw2000/");
}

// Sinaimg.cn hotlink protection 403s direct media requests without a weibo
// referer; the desktop origin is the known-good value for every weibo page
// host (mobile pages included). Weibo's other media CDNs tolerate the header.
const weiboReferer = "https://weibo.com/";

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
function sinaImageUrlFromImg(img: HTMLImageElement, baseUrl: string): string | undefined {
  return imgUrlCandidates(img, baseUrl).find(isSinaPicUrl);
}

function imgUrlCandidates(img: HTMLImageElement, baseUrl: string): string[] {
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
  return candidates.map((x) => absoluteUrl(x, baseUrl));
}

// Avatars live under crop.* tokens (crop.0.0.640.640.1024) inside the post
// header - they must not qualify a container as having content media.
const contentPicToken = /\/(large|mw\d+|orj\d+|square|thumbnail|bmiddle|thumb\d+)\//i;

function contentImageUrlFromImg(img: HTMLImageElement, baseUrl: string): string | undefined {
  return imgUrlCandidates(img, baseUrl).find((x) => x.indexOf("sinaimg.cn") != -1 && contentPicToken.test(x));
}

// Timestamp permalinks: weibo.com/<uid>/<bid> (uid numeric, bid alphanumeric).
const weiboPermalinkRe = /weibo\.com\/\d+\/[A-Za-z0-9_-]{6,}/;

function hasPermalinkLink(el: Element): boolean {
  if (el.matches("a[href]") && weiboPermalinkRe.test(el.getAttribute("href") || "")) {
    return true;
  }
  return Array.from(el.querySelectorAll("a[href]")).some((a) => weiboPermalinkRe.test(a.getAttribute("href") || ""));
}

/**
 * Finds the weibo-hosted video url of a video element (video src or source
 * children). blob: stream pointers fail the host test and yield undefined.
 */
function weiboVideoUrlFrom(video: HTMLVideoElement, baseUrl: string): string | undefined {
  const sources: string[] = [];
  if (video.src) {
    sources.push(video.src);
  }
  for (const source of Array.from(video.querySelectorAll("source"))) {
    if (source.src) {
      sources.push(source.src);
    }
  }
  return sources.find((x) => isWeiboHostedUrl(x, baseUrl));
}

/**
 * Card level: an element that contains both a timestamp permalink and content
 * media (feed images excluding avatar crop.* tokens, or a weibo-hosted video).
 * The post card, and separately each embedded repost's container, satisfy
 * this; the post header alone (permalink but only avatar images) does not.
 */
function isCardLevel(el: Element, baseUrl: string): boolean {
  if (!hasPermalinkLink(el)) {
    return false;
  }
  const hasContentPic = Array.from(el.querySelectorAll("img")).some(
    (img) => contentImageUrlFromImg(img, baseUrl) != undefined
  );
  if (hasContentPic) {
    return true;
  }
  return Array.from(el.querySelectorAll("video")).some((v) => weiboVideoUrlFrom(v, baseUrl) != undefined);
}

/**
 * Whether el sits inside a card nested within scope (an embedded repost) -
 * such media belongs to the nested post, not to the scope's own.
 */
function insideNestedCard(el: Element, scope: Element, baseUrl: string): boolean {
  let node = el.parentElement;
  while (node && node !== scope) {
    if (isCardLevel(node, baseUrl)) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function pageUrlFrom(container: Element): string {
  return container.ownerDocument?.location?.href ?? "";
}

export default class Weibo extends ScrapeEngineBase {
  name = "weibo";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "Document scrape only acts on status permalinks (weibo.com/<uid>/<bid>, weibo.com/u/<uid>/<bid>, m.weibo.cn/status/…, m.weibo.cn/detail/…); element grabs (context menu) work on any card - the user aimed at a specific post.",
    "The author's display name becomes an artist tag. Weibo redesigns its DOM often, so this engine can break at any time.",
    "Multi-image posts are scraped as multiple posts. Element grabs upload from client-fetched content (sinaimg 403s server-side downloads without a referer).",
  ];
  supportedHosts = ["weibo.com", "m.weibo.cn", "weibo.cn", "weibo.com.cn"];

  /**
   * Container resolution for context-menu element grabs: the innermost
   * ancestor that contains both a timestamp permalink and content media.
   * Climbing from the clicked element, link-less media wrappers come first and
   * the post header (permalink but only avatar images) never qualifies - the
   * first qualifying ancestor is exactly the post card. Embedded reposts
   * qualify on their own (they carry their own permalink and media), so
   * clicking embedded content grabs the embedded original.
   */
  findPostContainer(target: Element): Element | null {
    const baseUrl = target.ownerDocument?.location?.href ?? "";
    let node: Element | null = target;
    while (node) {
      node = node.parentElement;
      if (!node || node.tagName === "BODY") {
        break;
      }
      if (isCardLevel(node, baseUrl)) {
        return node;
      }
    }
    return null;
  }

  scrapeElement(container: Element): ScrapeResult {
    return this.scrapeCard(container);
  }

  /**
   * Scrapes a post card resolved by findPostContainer. Works for timeline
   * cards (no permalink gate - the user aimed at a specific post) and for
   * embedded repost cards, whose own permalink, author and media live inside
   * the card boundary.
   */
  private scrapeCard(card: Element): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const baseUrl = pageUrlFrom(card);

    const permalink = Array.from(card.querySelectorAll<HTMLAnchorElement>("a[href]")).find((a) =>
      weiboPermalinkRe.test(a.getAttribute("href") || "")
    );
    const source = permalink ? absoluteUrl(permalink.getAttribute("href") || "", baseUrl) : undefined;
    const pageUrl = source ?? baseUrl;

    // Author display name: the card's numeric-usercard links (avatar + name).
    // Links inside nested repost cards belong to the embedded original.
    let artist: ScrapedTag | undefined = undefined;
    for (const link of Array.from(card.querySelectorAll("[usercard]"))) {
      if (insideNestedCard(link, card, baseUrl)) {
        continue;
      }
      const uid = link.getAttribute("usercard") ?? "";
      if (!/^\d+$/.test(uid)) {
        continue;
      }
      const name = (link.textContent ?? "").trim().replace(/^@+/, "");
      if (name) {
        artist = new ScrapedTag(name, "artist");
        break;
      }
    }

    // Topics (#...# anchors), also excluding nested repost cards.
    const tagNames = new Set<string>();
    for (const a of Array.from(card.querySelectorAll("a"))) {
      if (insideNestedCard(a, card, baseUrl)) {
        continue;
      }
      const name = topicNameFromText(a.textContent ?? "");
      if (name && !tagNames.has(name)) {
        tagNames.add(name);
      }
    }
    const tags = Array.from(tagNames).map((x) => new ScrapedTag(x));
    if (artist) {
      tags.push(artist);
    }

    // Video first: video posts also render poster images. Videos inside
    // nested repost cards belong to the embedded original.
    const videos = Array.from(card.querySelectorAll("video")).filter((v) => !insideNestedCard(v, card, baseUrl));
    let videoSrc: string | undefined = undefined;
    for (const video of videos) {
      const found = weiboVideoUrlFrom(video, baseUrl);
      if (found) {
        videoSrc = absoluteUrl(found, baseUrl);
        break;
      }
    }

    const buildPost = (contentUrl: string, contentType: "image" | "video") => {
      const post = new ScrapedPost();
      post.pageUrl = pageUrl;
      post.contentUrl = contentUrl;
      post.contentType = contentType;
      post.sources = source ? [source] : [];
      post.tags = tags.slice();
      post.referrer = weiboReferer;
      // Sinaimg 403s server-side downloads without a weibo referer - the
      // extension fetches the bytes instead (with the referer rule + the
      // mw2000 download fallback applying client-side).
      post.uploadMode = "content";
      return post;
    };

    // Content images first: gif posts render their animated gifs as poster
    // images plus hidden low-res gif mp4 remuxes (label=gif_mp4) - the images
    // are the actual artwork (full animated gifs at /large/) and win over the
    // remux. Plain video posts (static poster) keep the video preference.
    const contentUrls: string[] = [];
    const seen = new Set<string>();
    for (const img of Array.from(card.querySelectorAll("img"))) {
      if (insideNestedCard(img, card, baseUrl)) {
        continue;
      }
      const raw = contentImageUrlFromImg(img, baseUrl);
      if (!raw) {
        continue;
      }
      const contentUrl = upgradeSinaImageUrl(raw);
      if (seen.has(contentUrl)) {
        continue;
      }
      seen.add(contentUrl);
      contentUrls.push(contentUrl);
    }

    const hasGifPoster = contentUrls.some((x) => /\.gif(\?|$)/i.test(x));

    if (videoSrc && !hasGifPoster) {
      result.tryAddPost(buildPost(videoSrc, "video"));
      return result;
    }

    for (const contentUrl of contentUrls) {
      result.tryAddPost(buildPost(contentUrl, guessContentType(contentUrl)));
    }

    return result;
  }


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

    // Video content, if present. Stray players are ignored: only a video in
    // the content area pointing at one of weibo's own media CDNs counts.
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
      imgs.filter((x) => isNotChrome(x) && isNotEmoticon(x)).map((x) => sinaImageUrlFromImg(x, document.location.href));
    const seenUrls = new Set<string>();
    const imgUrls = sinaUrlsFrom(
      Array.from(
        document.querySelectorAll<HTMLImageElement>("article .wbpro-feed-content img, article .woo-picture-img")
      )
    );
    if (!imgUrls.some(Boolean)) {
      imgUrls.push(...sinaUrlsFrom(Array.from(document.querySelectorAll<HTMLImageElement>("img"))));
    }

    // Gif posts render their animated gifs as poster images plus hidden
    // low-res gif mp4 remuxes (label=gif_mp4) - the gifs at /large/ are the
    // actual artwork and win over the remux. Plain video posts (static
    // poster) keep the video preference.
    const contentUrls: string[] = [];
    for (const rawUrl of imgUrls) {
      if (!rawUrl) {
        continue;
      }
      const contentUrl = upgradeSinaImageUrl(absoluteUrl(rawUrl, document.location.href));
      if (seenUrls.has(contentUrl)) {
        continue;
      }
      seenUrls.add(contentUrl);
      contentUrls.push(contentUrl);
    }
    const hasGifPoster = contentUrls.some((x) => /\.gif(\?|$)/i.test(x));

    if (videoSrc && !hasGifPoster) {
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = videoSrc;
      post.contentType = "video";
      post.sources = [source];
      post.tags = tags.slice();
      post.referrer = weiboReferer;
      post.uploadMode = "content";
      result.tryAddPost(post);
      return result;
    }

    for (const contentUrl of contentUrls) {
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = contentUrl;
      post.contentType = guessContentType(contentUrl);
      post.sources = [source];
      post.tags = tags.slice();
      post.referrer = weiboReferer;
      post.uploadMode = "content";
      result.tryAddPost(post);
    }

    return result;
  }
}
