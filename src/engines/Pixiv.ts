import { ScrapeEngineBase, ScrapeResult, ScrapedPost, ScrapedTag, ScrapeEngineFeature } from "../ScrapeEngine.js";
import { guessContentType } from "../Utility.js";

export function upgradeUrlToOriginalQuality(imgLink: string) {
  if (imgLink.indexOf("img-master") != -1) {
    // Example:
    // Input:  https://i.pximg.net/img-master/img/2022/02/15/06/50/28/96268450_p2_master1200.jpg
    // Input:  https://i.pximg.net/c/600x1200_90_webp/img-master/img/2022/02/15/06/50/28/96268450_p2_master1200.jpg
    // Output: https://i.pximg.net/img-original/img/2022/02/15/06/50/28/96268450_p2.jpg
    //
    // Warning:
    // This will NOT work for a srcset like this:
    // https://i.pximg.net/c/540x540_70/img-master/img/2022/02/15/06/50/28/96268450_p0_master1200.jpg 540w,https://i.pximg.net/img-master/img/2022/02/15/06/50/28/96268450_p0_master1200.jpg
    //
    // See regexr.com/6rcag for an example.

    // TODO: Add a check to verify the newly constructed/guessed url?
    return imgLink.replace(/(https?:\/\/i\.pximg\.net).*\/img-master\/(.*)_master\d+(.*)/, "$1/img-original/$2$3");
  }

  return imgLink;
}

interface PreloadIllustTag {
  tag?: string;
}

interface PreloadIllust {
  userId?: string;
  userName?: string;
  xRestrict?: number;
  // Live payloads wrap the array as { tags: [...] }; older ones use a plain array.
  tags?: PreloadIllustTag[] | { tags?: PreloadIllustTag[] };
}

export default class Pixiv extends ScrapeEngineBase {
  name = "pixiv";
  features: ScrapeEngineFeature[] = ["content", "rating", "tags", "tag_category", "source"];
  notes = ["Artist names are scraped as artist tags, artwork tags are scraped as untagged tags."];
  supportedHosts = ["pixiv.net"];

  /**
   * Builds a single ordered, unique tag list. Names are deduplicated after
   * ScrapedTag normalization, so aliases that normalize identically collapse.
   */
  private static uniqueTags(names: string[]): ScrapedTag[] {
    const seen = new Set<string>();
    const tags: ScrapedTag[] = [];
    for (const name of names) {
      if (!name) {
        continue;
      }
      const tag = new ScrapedTag(name);
      if (!seen.has(tag.name)) {
        seen.add(tag.name);
        tags.push(tag);
      }
    }
    return tags;
  }

  /**
   * Parses tags, the artist name and the rating from the JSON payload
   * embedded in the `meta#meta-preload-data` element.
   */
  parsePreloadData(document: Document): { tags: ScrapedTag[]; artist: ScrapedTag | undefined; xRestrict: number } {
    let tags: ScrapedTag[] = [];
    let artist: ScrapedTag | undefined = undefined;
    let xRestrict = 0;

    const preloadMeta = document.querySelector<HTMLMetaElement>("meta#meta-preload-data");
    if (preloadMeta?.content) {
      try {
        const data = JSON.parse(preloadMeta.content);
        const illustMap: { [key: string]: PreloadIllust } = data?.body?.illust ?? {};
        const illusts = Object.values(illustMap);
        if (illusts.length > 0) {
          const illust = illusts[0];
          xRestrict = illust.xRestrict ?? 0;
          // The user map (keyed by illust.userId) is the authoritative identity
          // source; illust.userName only exists on older payloads.
          const userMap: { [key: string]: { name?: string } } = data?.body?.user ?? {};
          const name = (illust.userId ? userMap[illust.userId]?.name : undefined) ?? illust.userName;
          if (name) {
            artist = new ScrapedTag(name, "artist");
          }
          const tagList = Array.isArray(illust.tags) ? illust.tags : (illust.tags?.tags ?? []);
          tags = Pixiv.uniqueTags(tagList.map((t) => t?.tag ?? ""));
        }
      } catch (ex) {
        this.log("Couldn't parse meta#meta-preload-data payload. " + ex);
      }
    }

    // Fallback for pages without (or with an unparsable) preload payload.
    if (tags.length == 0) {
      const names: string[] = [];
      // Live pages render one <li> per tag, with the tag anchor followed by a
      // translation anchor inside the same <li>; only the first anchor (the
      // original tag) may contribute a name.
      const consumedLi = new Set<Element>();
      for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href*='/tags/']"))) {
        const li = a.closest("li");
        if (li) {
          if (consumedLi.has(li)) {
            continue;
          }
          consumedLi.add(li);
        }
        if (a.pathname.indexOf("/tags/R-18") != -1) {
          continue; // This is the rating link, not a tag.
        }
        // The /tags/ segment may be preceded by a locale prefix (/en/tags/…),
        // so locate it instead of assuming a fixed index.
        const segments = a.pathname.split("/");
        const tagsIndex = segments.indexOf("tags");
        const name = tagsIndex != -1 ? decodeURIComponent(segments[tagsIndex + 1] ?? "") : "";
        if (name) {
          names.push(name);
        }
      }
      tags = Pixiv.uniqueTags(names);
    }
    if (!artist) {
      // Live artwork pages have no <article>; the author area is an <h2>
      // holding the avatar link (empty text) plus the name link. The viewer's
      // own header profile link is never inside an h2, so an h2-scoped match
      // always beats it; the residual whole-document fallback additionally
      // excludes nav/header-scoped links and empty (avatar) anchors.
      const plainProfile = /^\/(\w{2}\/)?users\/\d+$/;
      const textOf = (a: HTMLAnchorElement) => (a.textContent ?? "").trim();
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href*='/users/']"));
      const authorLink =
        anchors.find((a) => plainProfile.test(a.pathname) && textOf(a) != "" && a.closest("h2") != null) ??
        anchors.find(
          (a) =>
            plainProfile.test(a.pathname) &&
            textOf(a) != "" &&
            a.closest("nav") == null &&
            a.closest("header") == null
        );
      const name = authorLink ? textOf(authorLink) : "";
      if (name) {
        artist = new ScrapedTag(name, "artist");
      }
    }

    return { tags, artist, xRestrict };
  }

  scrapeDocument(document: Document): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const imgLinks = [] as string[];

    // Query for when the user is on the desktop site, is logged in, and has optionally clicked on "Show all".
    // If the user has not clicked on "Show all" then this will only grab the first post.
    imgLinks.push(
      ...Array.from(document.querySelectorAll<HTMLAnchorElement>("div[role='presentation'] > a")).map((x) => x.href)
    );

    if (imgLinks.length == 0) {
      // Query for when the user is on the desktop site and not logged in.
      imgLinks.push(
        ...Array.from(document.querySelectorAll<HTMLImageElement>("div[role='presentation'] img")).map((x) => x.src)
      );
    }

    if (imgLinks.length == 0) {
      // Query for when the user is on the mobile site, and has clicked on "Show all".
      // This only works on pages with multiple posts. The user can optionally be logged in.
      imgLinks.push(
        ...Array.from(document.querySelectorAll<HTMLImageElement>(".manga-page > a > img[data-big]")).map(
          (x) => x.getAttribute("data-big")!
        )
      );
    }

    if (imgLinks.length == 0) {
      // Query for when the user is on the mobile site, and has not clicked on "See all" -or- there is only one post.
      const imgLink = document.querySelector<HTMLImageElement>(".work-main-image img")?.src;
      if (imgLink) {
        imgLinks.push(imgLink);
      }
    }

    const { tags, artist, xRestrict } = this.parsePreloadData(document);

    for (const imgLink of imgLinks) {
      const post = new ScrapedPost();
      post.pageUrl = document.location.href;
      post.contentUrl = upgradeUrlToOriginalQuality(imgLink);
      post.contentType = guessContentType(post.contentUrl);
      post.referrer = document.location.origin;
      post.sources = [document.location.href];
      post.tags = artist ? tags.concat([artist]) : tags.slice();
      if (document.querySelector('a[href*="/tags/R-18/artworks"]')) {
        post.rating = "unsafe";
      } else if (xRestrict == 1 || xRestrict == 2) {
        // xRestrict: 1 = R-18, 2 = R-18G
        post.rating = "unsafe";
      }
      result.tryAddPost(post);
    }

    return result;
  }
}
