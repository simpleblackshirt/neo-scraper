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

interface PreloadIllust {
  userName?: string;
  xRestrict?: number;
  tags?: { tag?: string }[];
}

export default class Pixiv extends ScrapeEngineBase {
  name = "pixiv";
  features: ScrapeEngineFeature[] = ["content", "rating", "tags", "tag_category", "source"];
  notes = ["Artist names are scraped as artist tags, artwork tags are scraped as untagged tags."];
  supportedHosts = ["pixiv.net"];

  /**
   * Parses tags, the artist name and the rating from the JSON payload
   * embedded in the `meta#meta-preload-data` element.
   */
  parsePreloadData(document: Document): { tags: ScrapedTag[]; artist: ScrapedTag | undefined; xRestrict: number } {
    const tags: ScrapedTag[] = [];
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          xRestrict = (illust as any).xRestrict ?? 0;
          if (illust.userName) {
            artist = new ScrapedTag(illust.userName, "artist");
          }
          for (const t of illust.tags ?? []) {
            if (t?.tag) {
              tags.push(new ScrapedTag(t.tag));
            }
          }
        }
      } catch (ex) {
        this.log("Couldn't parse meta#meta-preload-data payload. " + ex);
      }
    }

    // Fallback for pages without (or with an unparsable) preload payload.
    if (tags.length == 0) {
      for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href*='/tags/']"))) {
        if (a.pathname.indexOf("/tags/R-18") != -1) {
          continue; // This is the rating link, not a tag.
        }
        const name = decodeURIComponent(a.pathname.split("/")[2] ?? "");
        if (name) {
          tags.push(new ScrapedTag(name));
        }
      }
    }
    if (!artist) {
      const authorLink = document.querySelector<HTMLAnchorElement>("a[href*='/users/']");
      const name = authorLink?.textContent?.trim();
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
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
