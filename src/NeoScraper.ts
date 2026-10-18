import { ScrapeEngine, ScrapeResults } from "./ScrapeEngine.js";
import * as engines from "./engines/index.js";

export default class NeoScraper {
  engines: ScrapeEngine[] = [];
  fallbackEngine: ScrapeEngine | null = null;

  constructor(useDefaultEngines = true) {
    if (useDefaultEngines) {
      this.engines.push(
        new engines.AnimePictures(),
        new engines.Bluesky(),
        new engines.Danbooru(),
        new engines.e621(),
        new engines.Ehentai(),
        new engines.FurAffinity(),
        new engines.Gelbooru(),
        new engines.Inkbunny(),
        new engines.Lofter(),
        new engines.Moebooru(),
        new engines.Nozomi(),
        new engines.Philomena(),
        new engines.Pixiv(),
        new engines.Reddit(),
        new engines.Rule34us(),
        new engines.SankakuComplex(),
        new engines.Shimmie2(),
        new engines.Shuushuu(),
        new engines.Twitter(),
        new engines.Weibo(),
        new engines.Xiaohongshu(),
        new engines.Zerochan()
      );
      this.fallbackEngine = new engines.Fallback();
    }
  }

  scrapeDocument(document: Document, allowFallbackEngine = false, ignoreCanImport = false): ScrapeResults {
    const res = new ScrapeResults();

    for (const engine of this.engines) {
      if (ignoreCanImport || engine.canImport(document.location)) {
        console.log("Using engine: " + engine.name);
        res.results.push(engine.scrapeDocument(document));
      }
    }

    if (allowFallbackEngine) {
      if (!this.fallbackEngine) {
        console.error("NeoScraper.fallbackEngine is unset!");
      } else {
        console.log("Using fallback engine");
        res.results.push(this.fallbackEngine.scrapeDocument(document));
      }
    }

    console.dir(res);

    return res;
  }

  /**
   * Scrapes the post container surrounding a context-menu target element.
   * Routes to the first engine claiming the target's document location that
   * supports element-scoped scraping. Returns empty results when no engine
   * applies or when the target sits outside any post container; engines
   * without the element members are skipped, never crash.
   */
  scrapeElement(target: Element): ScrapeResults {
    const res = new ScrapeResults();

    const doc = target.ownerDocument;
    if (!doc) {
      return res;
    }

    for (const engine of this.engines) {
      if (!engine.canImport(doc.location)) {
        continue;
      }
      if (!engine.findPostContainer || !engine.scrapeElement) {
        console.log(`[${engine.name}] Does not support element grabs, skipping.`);
        continue;
      }

      console.log("Using engine: " + engine.name);
      const container = engine.findPostContainer(target);
      if (!container) {
        console.log(`[${engine.name}] Target element is not inside a post container.`);
        return res;
      }

      res.results.push(engine.scrapeElement(container));
      console.dir(res);

      return res;
    }

    return res;
  }
}
