import { ScrapeResults } from "../ScrapeEngine.js";
import { scrapeFixture } from "../test/fixture.js";

describe("get xiaohongshu image note (fixture)", () => {
  const pageUrl = "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c";
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

  it("should have the canonical note url as source", () => {
    expect(res.posts[0]).toHaveSource(pageUrl);
  });
});

describe("get xiaohongshu video note (fixture)", () => {
  const pageUrl = "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c";
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
  });
});

describe("get xiaohongshu note via og:image fallback (fixture)", () => {
  const pageUrl = "https://www.xiaohongshu.com/explore/65abc123000000000f0e1d2c";
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
  });

  it("should grab tag chips from the dom", () => {
    expect(res.posts[0]).toHaveTag("sometag");
  });
});
