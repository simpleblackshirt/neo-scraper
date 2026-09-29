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

export default class Xiaohongshu extends ScrapeEngineBase {
  name = "xiaohongshu";
  features: ScrapeEngineFeature[] = ["content", "tags", "tag_category", "source"];
  notes = [
    "Scrapes note pages via the page's embedded __INITIAL_STATE__ JSON, falls back to og:image.",
    "The author's nickname becomes an artist tag. Xiaohongshu changes its internals often, so this engine can break at any time.",
    "Multi-image notes are scraped as multiple posts.",
  ];
  supportedHosts = ["xiaohongshu.com"];

  /**
   * Content scripts cannot access the page's JavaScript globals, so the
   * initial state is parsed from the script tag's text content instead.
   * The payload is a JS object literal and may contain `undefined` values,
   * which are replaced with `null` before parsing.
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
        return JSON.parse(text.slice(start, end + 1).replace(/:\s*undefined/g, ":null"));
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
    const entry = noteDetailMap[noteId] ?? Object.values(noteDetailMap)[0];
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

    const source =
      noteId && noteId.length > 0 ? "https://www.xiaohongshu.com/explore/" + noteId : document.location.href;

    // Video note.
    const videoUrl = pickVideoUrl(note?.video);
    if (videoUrl) {
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = videoUrl;
      post.contentType = "video";
      post.sources = [source];
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
      post.sources = [source];
      post.tags = tags.slice();
      result.tryAddPost(post);
    }

    if (result.posts.length > 0) {
      return result;
    }

    // Fallback when the state isn't available: og:image + tag chips from the DOM.
    const ogImage = document.querySelector<HTMLMetaElement>("meta[property='og:image']");
    if (ogImage?.content) {
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = ogImage.content;
      post.contentType = guessContentType(post.contentUrl);
      post.sources = [document.location.href];
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
