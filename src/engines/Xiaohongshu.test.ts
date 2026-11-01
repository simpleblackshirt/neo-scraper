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

describe("get xiaohongshu note with js-only state values (fixture)", () => {
  // Real pages embed JS object literals, not JSON: bare `undefined` values
  // and `new Set([])` constructor calls. The single `: undefined` regex the
  // engine used before could not repair these and every real parse failed.
  const pageUrl =
    "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c?xsec_token=CB0abc123%3D&xsec_source=pc_search";
  const html = `<html><body>
    <script>window.__INITIAL_STATE__={"global":{"login":{"loginMethod":undefined},"originalCommentIds":new Set([]),"channels":undefined},"note":{"noteDetailMap":{"65abc123000000000f0e1d2c":{"note":{"title":"note: undefined demo","user":{"nickname":"Some Artist"},"imageList":[{"width":1080,"height":1440,"url":"https://sns-img-qh.xhscdn.com/abc123.jpg"},{"width":800,"height":800,"urlDefault":"https://sns-webpic-qc.xhscdn.com/def456!nd_dft_wgth_webp_3"}],"tagList":[],"video":undefined}}}}}</script>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should parse the state and find exactly two posts (multi-image)", () => {
    expect(res.posts.length).toBe(2);
    expect(res.posts[0].contentUrl).toBe("https://sns-img-qh.xhscdn.com/abc123.jpg");
    expect(res.posts[1].contentUrl).toBe("https://sns-webpic-qc.xhscdn.com/def456!nd_dft_wgth_webp_3");
  });
});

describe("get xiaohongshu note viewer overlay (fixture)", () => {
  // A note opened as an overlay over a listing page (likes grid / profile):
  // the embedded __INITIAL_STATE__ belongs to the listing and only holds an
  // empty "undefined" placeholder entry, so the viewer's slider DOM is the
  // only source for the note's media and metadata.
  const pageUrl =
    "https://www.rednote.com/discovery/item/6ae339a0000000002b010e55?xsec_token=ABp3S2vfP8R4s2aGcXAT4ekB8blcaN218xAu9HpxThevg=&xsec_source=pc_like";
  const canonical = "https://www.xiaohongshu.com/explore/6ae339a0000000002b010e55";
  const slide = (id: string, extra = "") =>
    `<div class="swiper-slide ${extra}"><div class="img-container"><div class="note-slider-img xhs-webplayer"><img loading="lazy" src="https://sns-web-i10.rednotecdn.com/202611020318/x/notes_pre_post/${id}!nd_dft_wgth_webp_3"></div></div></div>`;
  const html = `<html><body>
    <section class="note-item"><a class="cover mask ld"><img src="https://sns-web-i10.rednotecdn.com/y/grid_cover!nc_n_webp_mw_1"></a>
      <a class="tag" href="/search_result?keyword=GridTag">#GridTag#</a>
      <div class="author-container"><a class="name" href="/user/profile/grid">Grid Author</a></div>
    </section>
    <div id="noteContainer" class="note-container">
      <div class="media-container"><div class="xhs-slider-container"><div class="swiper note-slider">
        <div class="swiper-wrapper">
          ${slide("img4", "swiper-slide-duplicate swiper-slide-prev")}
          ${slide("img1", "swiper-slide-visible swiper-slide-active")}
          ${slide("img2", "swiper-slide-next")}
          ${slide("img3")}
          ${slide("img4")}
          ${slide("img1", "swiper-slide-duplicate swiper-slide-duplicate-prev")}
        </div>
      </div></div></div>
      <div id="detail-title" class="title">T</div>
      <div class="author-container"><a class="name" href="/user/profile/5a">Overlay Artist</a></div>
      <a class="tag" href="/search_result?keyword=SomeTag">#SomeTag#</a>
      <a class="tag" href="/search_result?keyword=OtherTag">#OtherTag#</a>
    </div>
    <script>window.__INITIAL_STATE__={"note":{"noteDetailMap":{"undefined":{"note":{}}}}}</script>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly four posts (unique slides, duplicates dropped)", () => {
    expect(res.posts.length).toBe(4);
  });

  it("should keep the slides in carousel order", () => {
    expect(res.posts.map((x) => x.contentUrl)).toEqual([
      "https://sns-web-i10.rednotecdn.com/202611020318/x/notes_pre_post/img1!nd_dft_wgth_webp_3",
      "https://sns-web-i10.rednotecdn.com/202611020318/x/notes_pre_post/img2!nd_dft_wgth_webp_3",
      "https://sns-web-i10.rednotecdn.com/202611020318/x/notes_pre_post/img3!nd_dft_wgth_webp_3",
      "https://sns-web-i10.rednotecdn.com/202611020318/x/notes_pre_post/img4!nd_dft_wgth_webp_3",
    ]);
  });

  it("should tag the artist and tag chips from the overlay only", () => {
    expect(res.posts[0]).toHaveTag("overlay_artist", "artist");
    expect(res.posts[0]).toHaveTag("sometag");
    expect(res.posts[0]).toHaveTag("othertag");
    // The listing page's card behind the overlay must not bleed in.
    expect(res.posts[0].tags.map((x) => x.name)).not.toContain("grid_tag");
    expect(res.posts[0].tags.map((x) => x.name)).not.toContain("grid_author");
  });

  it("should emit the browsed href first, the canonical url second", () => {
    expect(res.posts[0].sources).toEqual([pageUrl, canonical]);
  });
});

describe("get xiaohongshu note skips placeholder map entries (fixture)", () => {
  // The browsed id is missing from the map; the first-entry fallback must
  // skip the empty "undefined" placeholder and use a real note entry.
  const pageUrl = "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c";
  const html = `<html><body>
    <script>window.__INITIAL_STATE__={"note":{"noteDetailMap":{"undefined":{"note":{}},"deadbeef0000000000000000":{"note":{"user":{"nickname":"Some Artist"},"imageList":[{"url":"https://sns-img-qh.xhscdn.com/abc123.jpg"}],"tagList":[]}}}}}</script>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find one post from the real entry", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://sns-img-qh.xhscdn.com/abc123.jpg");
    expect(res.posts[0]).toHaveTag("some_artist", "artist");
  });
});
