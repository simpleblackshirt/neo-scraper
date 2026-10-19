import { JSDOM, ConstructorOptions } from "jsdom";
import NeoScraper from "./NeoScraper.js";
import { ScrapeEngineBase, ScrapeEngineFeature, ScrapeResult, ScrapedPost } from "./ScrapeEngine.js";

test("create scraper with default engines", async () => {
  new NeoScraper();
});

test("all default scrapers have unique names", () => {
  const scraper = new NeoScraper();
  const alreadySeen: string[] = [];

  for (const engine of scraper.engines) {
    if (alreadySeen.indexOf(engine.name) != -1) {
      fail(engine.name + " is not a unique name!");
    } else {
      alreadySeen.push(engine.name);
    }
  }
});

class StubElementEngine extends ScrapeEngineBase {
  name = "stub";
  features: ScrapeEngineFeature[] = ["content"];
  notes: string[] = [];
  supportedHosts = ["example.com"];
  containerSelector = ".post";

  scrapeDocument(_document: Document): ScrapeResult {
    return new ScrapeResult(this.name);
  }

  findPostContainer(target: Element): Element | null {
    return target.closest(this.containerSelector);
  }

  scrapeElement(container: Element): ScrapeResult {
    const result = new ScrapeResult(this.name);
    const post = new ScrapedPost();
    post.contentUrl = container.querySelector("img")?.getAttribute("src") ?? "";
    result.tryAddPost(post);
    return result;
  }
}

/** Claims the same host but never opted in to element grabs. */
class StubDocumentOnlyEngine extends ScrapeEngineBase {
  name = "stub-doc-only";
  features: ScrapeEngineFeature[] = ["content"];
  notes: string[] = [];
  supportedHosts = ["example.com"];

  scrapeDocument(_document: Document): ScrapeResult {
    return new ScrapeResult(this.name);
  }
  // No findPostContainer/scrapeElement: the optional members stay unset.
}

function domWith(html: string, url = "https://example.com/feed") {
  return new JSDOM(html, <ConstructorOptions>{ url }).window.document;
}

function scraperWith(...engines: ScrapeEngineBase[]) {
  const scraper = new NeoScraper(false);
  scraper.engines.push(...engines);
  return scraper;
}

const fixtureHtml = `
  <main>
    <div class="post"><img src="https://cdn.example.com/a.jpg"/></div>
    <div class="post"><img src="https://cdn.example.com/b.jpg"/></div>
    <div class="banner">not a post</div>
  </main>`;

describe("NeoScraper.scrapeElement", () => {
  it("routes to the claiming engine and scrapes the surrounding container", () => {
    const engine = new StubElementEngine();
    const scraper = scraperWith(engine);
    const doc = domWith(fixtureHtml);

    const res = scraper.scrapeElement(doc.querySelectorAll(".post img")[1]);

    expect(res.results).toHaveLength(1);
    expect(res.results[0].engine).toBe("stub");
    expect(res.posts.map((p) => p.contentUrl)).toEqual(["https://cdn.example.com/b.jpg"]);
  });

  it("returns empty results when the target is outside any post container", () => {
    const scraper = scraperWith(new StubElementEngine());
    const doc = domWith(fixtureHtml);

    const res = scraper.scrapeElement(doc.querySelector(".banner")!);

    expect(res.results).toHaveLength(0);
    expect(res.posts).toHaveLength(0);
  });

  it("returns empty results when no claiming engine supports element grabs", () => {
    const scraper = scraperWith(new StubDocumentOnlyEngine());
    const doc = domWith(fixtureHtml);

    const res = scraper.scrapeElement(doc.querySelector(".post img")!);

    expect(res.results).toHaveLength(0);
  });

  it("skips non-supporting claimants and uses the supporting one", () => {
    const scraper = scraperWith(new StubDocumentOnlyEngine(), new StubElementEngine());
    const doc = domWith(fixtureHtml);

    const res = scraper.scrapeElement(doc.querySelector(".post img")!);

    expect(res.results.map((r) => r.engine)).toEqual(["stub"]);
    expect(res.posts).toHaveLength(1);
  });

  it("returns empty results for elements not inside any container (detached element)", () => {
    const scraper = scraperWith(new StubElementEngine());
    const detached = domWith(fixtureHtml).createElement("img");

    const res = scraper.scrapeElement(detached);

    expect(res.results).toHaveLength(0);
  });

  it("does not let the fallback engine claim element grabs", () => {
    // scrapeElement routes over this.engines only; the Fallback engine never
    // participates, so unknown hosts stay empty rather than grabbing garbage.
    const scraper = scraperWith(new StubElementEngine());
    const doc = domWith(fixtureHtml, "https://unknown.example.org/feed");

    const res = scraper.scrapeElement(doc.querySelector(".post img")!);

    expect(res.results).toHaveLength(0);
  });
});
