import { ScrapeResults } from "../ScrapeEngine.js";
import { scrapeFixture } from "../test/fixture.js";
import { upgradeSinaImageUrl } from "./Weibo.js";

test("upgradeSinaImageUrl", () => {
  expect(upgradeSinaImageUrl("https://wx1.sinaimg.cn/mw2000/abc/def.jpg")).toBe("https://wx1.sinaimg.cn/large/abc/def.jpg");
  expect(upgradeSinaImageUrl("https://wx2.sinaimg.cn/orj480/abc/ghi.jpg")).toBe("https://wx2.sinaimg.cn/large/abc/ghi.jpg");
  expect(upgradeSinaImageUrl("https://wx3.sinaimg.cn/thumb180/abc/jkl.jpg")).toBe("https://wx3.sinaimg.cn/large/abc/jkl.jpg");
  expect(upgradeSinaImageUrl("https://wx1.sinaimg.cn/large/abc/def.jpg")).toBe("https://wx1.sinaimg.cn/large/abc/def.jpg");
});

describe("get weibo status (fixture)", () => {
  const pageUrl = "https://weibo.com/1234567890/OBhcAsdf";
  const html = `<html><body>
    <header><a href="/1234567890"><img class="avatar" src="https://tvax4.sinaimg.cn/crop.0.0.50.50.50/008abc.jpg"><span>Some Artist</span></a></header>
    <div>
      <a href="https://s.weibo.com/weibo?q=%23SomeTopic%23"><span>#SomeTopic#</span></a>
    </div>
    <div>
      <img src="https://wx1.sinaimg.cn/mw2000/abc/def.jpg">
      <img src="https://wx2.sinaimg.cn/orj480/abc/ghi.jpg">
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly two posts (multi-image)", () => {
    expect(res.posts.length).toBe(2);
  });

  it("should upgrade image urls to /large/", () => {
    expect(res.posts[0].contentUrl).toBe("https://wx1.sinaimg.cn/large/abc/def.jpg");
    expect(res.posts[1].contentUrl).toBe("https://wx2.sinaimg.cn/large/abc/ghi.jpg");
  });

  it("should not scrape the avatar", () => {
    expect(res.posts.find((x) => x.contentUrl.indexOf("tvax") != -1)).toBeUndefined();
  });

  it("should have the display name as artist tag and the topic as tag", () => {
    expect(res.posts[0]).toHaveTag("some_artist", "artist");
    expect(res.posts[0]).toHaveTag("sometopic");
  });

  it("should have the status url as source", () => {
    expect(res.posts[0]).toHaveSource(pageUrl);
  });
});

describe("get weibo video status (fixture)", () => {
  const pageUrl = "https://weibo.com/1234567890/OBhcAsdf";
  const html = `<html><body>
    <img src="https://wx1.sinaimg.cn/mw2000/abc/poster.jpg">
    <div><video controls><source src="https://f.video.weibocdn.com/xxx.mp4?Expires=0"></video></div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one video post and skip the poster image", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentType).toBe("video");
    expect(res.posts[0].contentUrl).toBe("https://f.video.weibocdn.com/xxx.mp4?Expires=0");
  });
});

describe("skip weibo feed pages (fixture)", () => {
  const pageUrl = "https://weibo.com/u/1234567890";
  const html = `<html><body><img src="https://wx1.sinaimg.cn/mw2000/abc/def.jpg"></body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find no posts on non-status pages", () => {
    expect(res.posts.length).toBe(0);
  });
});
