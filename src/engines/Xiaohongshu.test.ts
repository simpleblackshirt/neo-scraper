import { JSDOM } from "jsdom";
import { ScrapeResult, ScrapeResults } from "../ScrapeEngine.js";
import { scrapeFixture } from "../test/fixture.js";
import Xiaohongshu from "./Xiaohongshu.js";

describe("get xiaohongshu image note (fixture)", () => {
  const pageUrl =
    "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c?xsec_token=CB0abc123%3D&xsec_source=pc_like";
  const canonical = "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c";
  const html = `<html><head>
    <meta property="og:image" content="https://sns-webpic-qc.xhscdn.com/202401/ogimg!nd_dft_wgth_webp_3">
    </head><body>
    <div id="app"></div>
    <script>window.__INITIAL_STATE__={"note":{"noteDetailMap":{"65abc123000000000f0e1d2c":{"note":{"title":"T","desc":"d","type":"normal","user":{"userId":"5a","nickname":"Some Artist"},"imageList":[{"width":1080,"height":1440,"url":"https://sns-img-qh.xhscdn.com/abc123.jpg"},{"width":1080,"height":1440,"urlDefault":"https://sns-webpic-qc.xhscdn.com/def456!nd_dft_wgth_webp_3"}],"tagList":[{"id":"1","name":"SomeTag","type":"topic"}],"video":undefined}}}}}</script>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly two posts (multi-image)", () => {
    expect(res.posts.length).toBe(2);
  });

  it("should prefer the original image url over the re-encoded one", () => {
    expect(res.posts[0].contentUrl).toBe("https://sns-img-qh.xhscdn.com/abc123.jpg");
    expect(res.posts[1].contentUrl).toBe("https://sns-webpic-qc.xhscdn.com/def456!nd_dft_wgth_webp_3");
  });

  it("should have the nickname as artist tag and the tag list as tags", () => {
    expect(res.posts[0]).toHaveTag("some_artist", "artist");
    expect(res.posts[0]).toHaveTag("sometag");
  });

  it("should have the browsed page url as source", () => {
    expect(res.posts[0]).toHaveSource(pageUrl);
  });

  it("should have the canonical explore url as a second source", () => {
    expect(res.posts[0]).toHaveSource(canonical);
  });

  it("should emit the browsed href first, the canonical url second", () => {
    // Exact-order guard: href byte-for-byte (xsec_token verbatim), then canonical.
    expect(res.posts[0].sources).toEqual([pageUrl, canonical]);
  });
});

describe("get xiaohongshu video note (fixture)", () => {
  const pageUrl =
    "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c?xsec_token=CB0abc123%3D&xsec_source=pc_feed";
  const canonical = "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c";
  const html = `<html><body>
    <script>window.__INITIAL_STATE__={"note":{"noteDetailMap":{"65abc123000000000f0e1d2c":{"note":{"user":{"nickname":"Some Artist"},"imageList":[],"tagList":[],"video":{"media":{"videoUrl":"https://video.xhscdn.com/xyz.mp4"}}}}}}}</script>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one video post", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentType).toBe("video");
    expect(res.posts[0].contentUrl).toBe("https://video.xhscdn.com/xyz.mp4");
    expect(res.posts[0]).toHaveSource(pageUrl);
    expect(res.posts[0]).toHaveSource(canonical);
  });
});

describe("get rednote image note (fixture)", () => {
  const pageUrl =
    "https://www.rednote.com/discovery/item/65abc123000000000f0e1d2c?xsec_token=CB0abc123%3D&xsec_source=pc_like";
  const canonical = "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c";
  const html = `<html><head>
    <meta property="og:image" content="https://sns-webpic-qc.xhscdn.com/202401/ogimg!nd_dft_wgth_webp_3">
    </head><body>
    <div id="app"></div>
    <script>window.__INITIAL_STATE__={"note":{"noteDetailMap":{"65abc123000000000f0e1d2c":{"note":{"title":"T","desc":"d","type":"normal","user":{"userId":"5a","nickname":"Some Artist"},"imageList":[{"width":1080,"height":1440,"url":"https://sns-img-qh.xhscdn.com/abc123.jpg"}],"tagList":[{"id":"1","name":"SomeTag","type":"topic"}],"video":undefined}}}}}</script>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should route to the xiaohongshu engine instead of falling through", () => {
    expect(res.results.map((x) => x.engine)).toEqual(["xiaohongshu"]);
    expect(res.posts.length).toBe(1);
  });

  it("should extract the artist tag and tag list on rednote.com", () => {
    expect(res.posts[0]).toHaveTag("some_artist", "artist");
    expect(res.posts[0]).toHaveTag("sometag");
  });

  it("should keep the browsed rednote page url as source", () => {
    expect(res.posts[0]).toHaveSource(pageUrl);
  });

  it("should add the canonical explore url alongside the rednote href", () => {
    expect(res.posts[0]).toHaveSource(canonical);
  });
});

describe("get xiaohongshu note via og:image fallback (fixture)", () => {
  const pageUrl =
    "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c?xsec_token=CB0abc123%3D&xsec_source=pc_search";
  const canonical = "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c";
  const html = `<html><head>
    <meta property="og:image" content="https://sns-webpic-qc.xhscdn.com/202401/ogimg!nd_dft_wgth_webp_3">
    </head><body>
    <div><a class="tag" href="/search_result?keyword=SomeTag">#SomeTag#</a></div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one post from og:image", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://sns-webpic-qc.xhscdn.com/202401/ogimg!nd_dft_wgth_webp_3");
    expect(res.posts[0]).toHaveSource(pageUrl);
    expect(res.posts[0]).toHaveSource(canonical);
  });

  it("should grab tag chips from the dom", () => {
    expect(res.posts[0]).toHaveTag("sometag");
  });
});

describe("get xiaohongshu note browsed at the canonical url (fixture)", () => {
  const pageUrl = "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c";
  const html = `<html><body>
    <script>window.__INITIAL_STATE__={"note":{"noteDetailMap":{"65abc123000000000f0e1d2c":{"note":{"user":{"nickname":"Some Artist"},"imageList":[{"width":1080,"height":1440,"url":"https://sns-img-qh.xhscdn.com/abc123.jpg"}],"tagList":[]}}}}}</script>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should collapse to the single canonical source line", () => {
    expect(res.posts.length).toBe(1);
    // href == canonical: emitting both lines would duplicate the source.
    expect(res.posts[0].sources).toEqual([pageUrl]);
  });
});

describe("get xiaohongshu note when location is unusable (fixture)", () => {
  const html = `<html><body>
    <script>window.__INITIAL_STATE__={"note":{"noteDetailMap":{"65abc123000000000f0e1d2c":{"note":{"user":{"nickname":"Some Artist"},"imageList":[{"width":1080,"height":1440,"url":"https://sns-img-qh.xhscdn.com/abc123.jpg"}],"tagList":[]}}}}}</script>
    </body></html>`;
  let res: ScrapeResult;

  beforeAll(() => {
    // about:blank yields a non-http location.href; the engine must fall back
    // to the constructed explore url instead of emitting the unusable href.
    const dom = new JSDOM(html, { url: "about:blank" });
    res = new Xiaohongshu().scrapeDocument(dom.window.document);
  });

  it("should find one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should fall back to the constructed explore url as the single source", () => {
    // jsdom's about:blank pathname is "blank", so noteId falls back to the
    // last path segment and the canonical line replaces the unusable href.
    expect(res.posts[0].sources).toEqual(["https://www.xiaohongshu.com/explore/blank"]);
  });
});
