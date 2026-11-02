import { ScrapeEngineBase, ScrapeResult, ScrapedPost, ScrapedTag, ScrapeEngineFeature } from "../ScrapeEngine.js";
import { guessContentType } from "../Utility.js";

interface XhsNoteImage {
  url?: string;
  urlDefault?: string;
  width?: number;
  height?: number;
  infoList?: { url?: string; imageScene?: string; width?: number; height?: number }[];
}

interface XhsNote {
  title?: string;
  user?: { nickname?: string };
  imageList?: XhsNoteImage[];
  tagList?: { name?: string }[];
  video?: {
    media?: {
      videoUrl?: string;
      url?: string;
      stream?: { h264?: { masterUrl?: string }[] };
    };
  };
}

/**
 * Picks the best available image URL from an imageList entry.
 * Prefers the original `url` over the re-encoded `urlDefault` and
 * falls back to the largest entry from `infoList`.
 */
function pickImageUrl(image: XhsNoteImage): string | undefined {
  if (image.url) {
    return image.url;
  }
  if (image.urlDefault) {
    return image.urlDefault;
  }
  const best = (image.infoList ?? [])
    .filter((x) => x.url)
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
  return best?.url;
}

function pickVideoUrl(video: XhsNote["video"]): string | undefined {
  return video?.media?.videoUrl ?? video?.media?.url ?? video?.media?.stream?.h264?.[0]?.masterUrl;
}

/** Returns the index just after the closing quote of the string literal starting at `start`. */
function skipString(text: string, start: number): number {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    if (text[i] == "\\") {
      i += 2;
      continue;
    }
    if (text[i] == quote) {
      return i + 1;
    }
    i++;
  }
  return i;
}

/**
 * Matches `Identifier ( ... )` starting at `start` (just after a `new`
 * keyword). Returns the index just after the closing paren when a
 * well-formed constructor call follows, otherwise undefined.
 */
function matchConstructorCall(text: string, start: number): number | undefined {
  const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c);
  const isIdentPart = (c: string) => /[A-Za-z0-9_$]/.test(c);
  let i = start;
  while (i < text.length && /\s/.test(text[i])) {
    i++;
  }
  if (i >= text.length || !isIdentStart(text[i])) {
    return undefined;
  }
  let j = i + 1;
  while (j < text.length && isIdentPart(text[j])) {
    j++;
  }
  while (j < text.length && /\s/.test(text[j])) {
    j++;
  }
  if (text[j] != "(") {
    return undefined;
  }
  let depth = 0;
  while (j < text.length) {
    const c = text[j];
    if (c == '"' || c == "'") {
      j = skipString(text, j);
      continue;
    }
    if (c == "(") {
      depth++;
    } else if (c == ")") {
      depth--;
      if (depth == 0) {
        return j + 1;
      }
    }
    j++;
  }
  return undefined;
}

/**
 * Rewrites the page's JS object literal so it is valid JSON: bare
 * `undefined` / `NaN` / `Infinity` become `null` and `new Set([])`-style
 * constructor calls become `null`. String literals are copied verbatim, so
 * occurrences of these words inside note text cannot corrupt the payload.
 */
function sanitizeJsObjectLiteral(text: string): string {
  const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c);
  const isIdentPart = (c: string) => /[A-Za-z0-9_$]/.test(c);
  const nullKeywords = ["undefined", "NaN", "Infinity"];

  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c == '"' || c == "'") {
      const end = skipString(text, i);
      out += text.slice(i, end);
      i = end;
      continue;
    }
    if (!isIdentStart(c)) {
      out += c;
      i++;
      continue;
    }
    let j = i + 1;
    while (j < text.length && isIdentPart(text[j])) {
      j++;
    }
    const word = text.slice(i, j);
    if (nullKeywords.indexOf(word) != -1) {
      // Signed infinities ("-Infinity") must not leave a dangling minus.
      if (word == "Infinity" && (out.endsWith("-") || out.endsWith("+"))) {
        out = out.slice(0, -1);
      }
      out += "null";
    } else if (word == "new") {
      const end = matchConstructorCall(text, j);
      if (end != undefined) {
        out += "null";
        i = end;
        continue;
      }
      out += word;
    } else {
      out += word;
    }
    i = j;
  }
  return out;
}

export default class Xiaohongshu extends ScrapeEngineBase {
  name = "xiaohongshu";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "The author's nickname becomes an artist tag.",
    "Multi-image notes are scraped as multiple posts.",
  ];
  supportedHosts = ["xiaohongshu.com", "rednote.com"];

  /**
   * Content scripts cannot access the page's JavaScript globals, so the
   * initial state is parsed from the script tag's text content instead.
   * The payload is a JS object literal containing `undefined`, `NaN` and
   * `new Set(...)`-style values, which are sanitized to `null` first.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getInitialState(document: Document): any {
    for (const script of Array.from(document.querySelectorAll("script"))) {
      const text = script.textContent ?? "";
      const markerIndex = text.indexOf("__INITIAL_STATE__");
      if (markerIndex == -1) {
        continue;
      }
      const start = text.indexOf("{", markerIndex);
      const end = text.lastIndexOf("}");
      if (start == -1 || end == -1 || end <= start) {
        continue;
      }
      try {
        return JSON.parse(sanitizeJsObjectLiteral(text.slice(start, end + 1)));
      } catch (ex) {
        this.log("Couldn't parse __INITIAL_STATE__. " + ex);
      }
    }
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getNoteFromState(state: any, noteId: string): XhsNote | undefined {
    const noteDetailMap = state?.note?.noteDetailMap;
    if (!noteDetailMap) {
      return undefined;
    }
    // Listing pages embed an empty placeholder entry under the literal key
    // "undefined"; the fallback must skip it and use a real note entry.
    const entry =
      noteDetailMap[noteId] ??
      Object.values(noteDetailMap).find((x) => {
        const note = (x as { note?: XhsNote })?.note;
        return note != undefined && Object.keys(note).length > 0;
      });
    return entry?.note;
  }

  getNoteIdFromUrl(document: Document): string {
    const match = /\/(?:explore|discovery\/item)\/([a-f0-9]+)/.exec(document.location.pathname);
    if (match) {
      return match[1];
    }
    // Note opened as a modal over a user profile: /user/profile/<uid>/<noteId>
    const segments = document.location.pathname.split("/").filter((x) => x.length > 0);
    return segments[segments.length - 1] ?? "";
  }

  /**
   * The URL exactly as browsed (host, path, query verbatim, including
   * xsec_token) is the only usable note reference
   */
  getSourceUrls(document: Document, noteId: string): string[] {
    const href = document.location.href;
    const canonical = "https://www.xiaohongshu.com/explore/" + noteId;
    if (!href.startsWith("http")) {
      return noteId ? [canonical] : [href];
    }
    return href == canonical ? [href] : [href, canonical];
  }

  scrapeDocument(document: Document): ScrapeResult {
    const result = new ScrapeResult(this.name);

    const noteId = this.getNoteIdFromUrl(document);
    const note = this.getNoteFromState(this.getInitialState(document), noteId);

    // Tags from the note's tag list, artist from the author's nickname.
    const tags: ScrapedTag[] = [];
    for (const tag of note?.tagList ?? []) {
      if (tag?.name && !tags.some((x) => x.name == tag.name)) {
        tags.push(new ScrapedTag(tag.name));
      }
    }
    if (note?.user?.nickname) {
      tags.push(new ScrapedTag(note.user.nickname, "artist"));
    }

    const sources = this.getSourceUrls(document, noteId);

    // Video note.
    const videoUrl = pickVideoUrl(note?.video);
    if (videoUrl) {
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = videoUrl;
      post.contentType = "video";
      post.sources = sources;
      post.tags = tags.slice();
      result.tryAddPost(post);
      return result;
    }

    // Image note(s).
    for (const image of note?.imageList ?? []) {
      const contentUrl = pickImageUrl(image);
      if (!contentUrl) {
        continue;
      }
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = contentUrl;
      post.contentType = guessContentType(contentUrl);
      post.sources = sources;
      post.tags = tags.slice();
      result.tryAddPost(post);
    }

    if (result.posts.length > 0) {
      return result;
    }

    // Note viewer overlay (a note opened from a listing without a page
    // load): the page's __INITIAL_STATE__ belongs to the listing page and
    // never contains the viewed note, but the viewer renders every slide
    // into the DOM as it is opened.
    const slider = document.querySelector(".note-slider");
    if (slider) {
      const scope = slider.closest("#noteContainer, .note-container") ?? slider;

      // Tags from the overlay's tag chips, artist from the author row.
      // Both are scoped to the overlay so listing-page cards cannot bleed in.
      const overlayTags: ScrapedTag[] = [];
      for (const a of Array.from(
        scope.querySelectorAll<HTMLAnchorElement>("a[href*='search_result'], a.tag")
      )) {
        const name = (a.textContent ?? "")
          .replace(/^#+/g, "")
          .replace(/#+$/g, "")
          .trim();
        if (name && !overlayTags.some((x) => x.name == name)) {
          overlayTags.push(new ScrapedTag(name));
        }
      }
      const authorName =
        scope.querySelector(".author-container a.name")?.textContent ??
        scope.querySelector(".author-container span.username")?.textContent ??
        scope.querySelector(".author .name")?.textContent;
      if (authorName?.trim()) {
        overlayTags.push(new ScrapedTag(authorName.trim(), "artist"));
      }

      // Video notes render a player into the slider.
      const video = slider.querySelector("video");
      const videoSrc =
        video?.getAttribute("src") ?? video?.querySelector("source")?.getAttribute("src");
      if (videoSrc) {
        const post = new ScrapedPost();
        post.pageUrl = document.location.href;
        post.contentUrl = videoSrc;
        post.contentType = "video";
        post.sources = sources;
        post.tags = overlayTags.slice();
        result.tryAddPost(post);
        return result;
      }

      // One post per unique slide. The swiper loops by duplicating the last
      // slide before the first (and vice versa), so marked duplicates are
      // skipped and urls deduped as a markup-change safety net.
      const seen = new Set<string>();
      for (const img of Array.from(slider.querySelectorAll("img"))) {
        if (img.closest(".swiper-slide-duplicate")) {
          continue;
        }
        const contentUrl = img.getAttribute("src") || img.src;
        if (!contentUrl || contentUrl.startsWith("data:") || seen.has(contentUrl)) {
          continue;
        }
        seen.add(contentUrl);
        const post = new ScrapedPost();
        post.pageUrl = document.location.href;
        post.contentUrl = contentUrl;
        post.contentType = guessContentType(contentUrl);
        post.sources = sources;
        post.tags = overlayTags.slice();
        result.tryAddPost(post);
      }

      if (result.posts.length > 0) {
        return result;
      }
    }

    // Fallback when the state isn't available: og:image + tag chips from the DOM.
    const ogImage = document.querySelector<HTMLMetaElement>("meta[property='og:image']");
    if (ogImage?.content) {
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = ogImage.content;
      post.contentType = guessContentType(post.contentUrl);
      post.sources = this.getSourceUrls(document, noteId);
      for (const a of Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a[href*='search_result'], a.tag")
      )) {
        const name = (a.textContent ?? "")
          .replace(/^#+/g, "")
          .replace(/#+$/g, "")
          .trim();
        if (name && !post.tags.some((x) => x.name == name)) {
          post.tags.push(new ScrapedTag(name));
        }
      }
      result.tryAddPost(post);
    } else {
      this.log("Couldn't find note data.");
    }

    return result;
  }
}
