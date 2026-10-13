import { ScrapeResults } from "../ScrapeEngine.js";
import { scrapeFixture } from "../test/fixture.js";

describe("get lofter post (fixture)", () => {
  const pageUrl = "https://someblog.lofter.com/post/1e8c2_abc123";
  const html = `<html><body>
    <header><a href="https://someblog.lofter.com/"><img src="https://imglf1.lf127.net/avatar.jpg?imageView&amp;thumbnail=48y48"></a></header>
    <div class="content">
      <img src="https://imglf1.lf127.net/img/abc123.png?imageView&amp;thumbnail=500x0&amp;quality=96&amp;stripmeta=1">
      <img src="https://imglf6.lf127.net/img/def456.jpg?imageView&amp;thumbnail=500x0&amp;quality=96&amp;stripmeta=1">
    </div>
    <div class="postdata">
      <a class="tag" href="http://www.lofter.com/tag/%E7%BB%98%E7%94%BB">#绘画#</a>
      <a class="tag" href="http://www.lofter.com/tag/Some%20Fandom">#Some Fandom#</a>
      <a class="tag" href="/tag/%E6%98%8E%E6%97%A5%E6%96%B9%E8%88%9F">●_明日方舟</a>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly two posts (multi-image)", () => {
    expect(res.posts.length).toBe(2);
  });

  it("should strip the image processing query to get the original", () => {
    expect(res.posts[0].contentUrl).toBe("https://imglf1.lf127.net/img/abc123.png");
    expect(res.posts[1].contentUrl).toBe("https://imglf6.lf127.net/img/def456.jpg");
  });

  it("should not scrape the avatar", () => {
    expect(res.posts.find((x) => x.contentUrl.indexOf("avatar") != -1)).toBeUndefined();
  });

  it("should have tags and the blog subdomain as artist tag", () => {
    expect(res.posts[0]).toHaveTag("绘画");
    expect(res.posts[0]).toHaveTag("some_fandom");
    expect(res.posts[0]).toHaveTag("someblog", "artist");
  });

  it("should derive tag names from the tag link href, ignoring decoration glyphs", () => {
    // Live tag anchors render like "●_明日方舟"; the name must come from the
    // encoded /tag/ href instead of the display text.
    expect(res.posts[0]).toHaveTag("明日方舟");
    expect(res.posts[0].tags.find((x) => x.name.indexOf("●") != -1)).toBeUndefined();
  });

  it("should have the permalink as source", () => {
    expect(res.posts[0]).toHaveSource(pageUrl);
  });
});

describe("get lofter video post (fixture)", () => {
  const pageUrl = "https://someblog.lofter.com/post/1e8c2_def456";
  const html = `<html><body>
    <div class="content">
      <video controls><source src="https://vos.lf127.net/xxx/yyy.mp4?download=0"></video>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one video post", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentType).toBe("video");
    expect(res.posts[0].contentUrl).toBe("https://vos.lf127.net/xxx/yyy.mp4?download=0");
  });
});

describe("skip lofter dashboard pages (fixture)", () => {
  const pageUrl = "https://www.lofter.com/";
  const html = `<html><body><img src="https://imglf1.lf127.net/img/abc123.png?imageView&amp;thumbnail=500x0"></body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find no posts on non-permalink pages", () => {
    expect(res.posts.length).toBe(0);
  });
});
