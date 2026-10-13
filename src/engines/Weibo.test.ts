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

describe("get weibo status with /u/<uid>/<bid> permalink (fixture)", () => {
  const pageUrl = "https://weibo.com/u/1234567890/OBhcAsdf";
  const html = `<html><body>
    <header><a href="/u/1234567890"><span>Some Artist</span></a></header>
    <div><img src="https://wx1.sinaimg.cn/mw2000/abc/def.jpg"></div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find the image post with artist and source", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://wx1.sinaimg.cn/large/abc/def.jpg");
    expect(res.posts[0]).toHaveTag("some_artist", "artist");
    expect(res.posts[0]).toHaveSource(pageUrl);
  });
});

describe("get weibo status with punctuation in bid (fixture)", () => {
  const pageUrl = "https://weibo.com/1234567890/OBhc-As_df";
  const html = `<html><body>
    <div><img src="https://wx1.sinaimg.cn/mw2000/abc/def.jpg"></div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find the image post", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://wx1.sinaimg.cn/large/abc/def.jpg");
  });
});

describe("get weibo status with lazy-loaded images (fixture)", () => {
  const pageUrl = "https://weibo.com/1234567890/OBhcAsdf";
  const html = `<html><body>
    <div>
      <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw" data-src="https://wx1.sinaimg.cn/thumbnail/abc/def.jpg">
      <img src="https://wx2.sinaimg.cn/orj480/abc/ghi.jpg" data-src="https://wx2.sinaimg.cn/large/abc/ghi.jpg">
      <img data-src="//wx3.sinaimg.cn/mw2000/abc/jkl.jpg">
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should read the real image urls from the lazy attributes", () => {
    expect(res.posts.map((x) => x.contentUrl)).toEqual([
      "https://wx1.sinaimg.cn/large/abc/def.jpg",
      "https://wx2.sinaimg.cn/large/abc/ghi.jpg",
      "https://wx3.sinaimg.cn/large/abc/jkl.jpg",
    ]);
  });
});

describe("get weibo image status despite stray off-site video (fixture)", () => {
  const pageUrl = "https://weibo.com/1234567890/OBhcAsdf";
  const html = `<html><body>
    <div><video src="https://media.example.com/ad.mp4" autoplay></video></div>
    <div><img src="https://wx1.sinaimg.cn/mw2000/abc/def.jpg"></div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should scrape the images instead of the off-site video", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentType).toBe("image");
    expect(res.posts[0].contentUrl).toBe("https://wx1.sinaimg.cn/large/abc/def.jpg");
  });
});

describe("ignore weibo video in page chrome (fixture)", () => {
  const pageUrl = "https://weibo.com/1234567890/OBhcAsdf";
  const html = `<html><body>
    <header><video src="https://f.video.weibocdn.com/xxx.mp4?Expires=0"></video></header>
    <div><img src="https://wx1.sinaimg.cn/mw2000/abc/def.jpg"></div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should scrape the images instead of the chrome video", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentType).toBe("image");
    expect(res.posts[0].contentUrl).toBe("https://wx1.sinaimg.cn/large/abc/def.jpg");
  });
});

// Real page shape of https://weibo.com/7751610237/PDv9O4ebt (weibo-pro-next
// desktop frontend), distilled from the capture D:/repos/page/微博正文 - 微博.html.
// Pic-ids below are the ones actually present in that capture.

describe("get weibo pro-next status from consumed lazy state (fixture)", () => {
  // After the lazy-loader runs, the real url sits in src and the consumed
  // data-src holds the literal "false".
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <article>
      <header>
        <a href="https://weibo.com/u/7751610237"><img class="woo-avatar-img" src="https://tvax4.sinaimg.cn/crop.0.0.50.50.50/008sAXVzly8ifcwphlmc8j30u00u0jv3.jpg"><span>Some Artist</span></a>
      </header>
      <div class="wbpro-feed-content">
        <div class="picture"><div class="woo-picture-main">
          <img class="woo-picture-img" src="https://wx1.sinaimg.cn/mw2000/008sAXVzgy1i3w4hziy4yj3180140an2.jpg" data-src="false" data-tag="false" loading="false">
        </div></div>
      </div>
    </article>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should yield the feed image from the weibo engine itself (no fallback)", () => {
    expect(res.results[0].engine).toBe("weibo");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://wx1.sinaimg.cn/large/008sAXVzgy1i3w4hziy4yj3180140an2.jpg");
  });

  it("should have the author as artist tag", () => {
    expect(res.posts[0]).toHaveTag("some_artist", "artist");
  });
});

describe("get weibo pro-next status from pre-lazy state (fixture)", () => {
  // The race that produced the empty result: grabbed before the lazy-loader
  // swapped the url into src, so the real url only lives in data-src.
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <article><div class="wbpro-feed-content">
      <div class="picture"><div class="woo-picture-main">
        <img class="woo-picture-img" src="" data-src="//wx1.sinaimg.cn/thumbnail/008sAXVzgy1i3w4hziy4yj3180140an2.jpg" loading="false">
        <img class="woo-picture-img" srcset="//wx2.sinaimg.cn/thumbnail/008sAXVzly8ifcwphlmc8j30u00u0jv3.jpg 480w, //wx2.sinaimg.cn/mw2000/008sAXVzly8ifcwphlmc8j30u00u0jv3.jpg 1080w">
      </div></div>
    </div></article>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should read the pre-lazy data-src url and upgrade it to /large/", () => {
    expect(res.posts[0].contentUrl).toBe("https://wx1.sinaimg.cn/large/008sAXVzgy1i3w4hziy4yj3180140an2.jpg");
  });

  it("should read the largest srcset candidate", () => {
    expect(res.posts[1].contentUrl).toBe("https://wx2.sinaimg.cn/large/008sAXVzly8ifcwphlmc8j30u00u0jv3.jpg");
  });
});

describe("reject weibo chrome images hosted on sinaimg.cn (fixture)", () => {
  // d./a.sinaimg.cn serve icons and scripts, not post media; their urls
  // carry no size-directory token.
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <div><img src="https://d.sinaimg.cn/prd/1008/253/2025/10/16/AI_big_icon.png"></div>
    <div><img src="https://a.sinaimg.cn/mintra/pic/2025/10/16/48po.js"></div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find no posts from chrome assets", () => {
    expect(res.posts.length).toBe(0);
  });
});

describe("exclude the pro-next sidebar author banner (fixture)", () => {
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <article><div class="wbpro-feed-content">
      <div class="picture"><div class="woo-picture-main">
        <img class="woo-picture-img" src="https://wx1.sinaimg.cn/mw2000/008sAXVzgy1i3w4hziy4yj3180140an2.jpg" data-src="false">
      </div></div>
    </div></article>
    <div class="rightSide"><div class="wbpro-side">
      <div class="_top_6q8k4_7"><div class="woo-picture-main _pic_6q8k4_12">
        <img class="woo-picture-img" src="https://wx1.sinaimg.cn/mw2000/008sAXVzgy1ihml8ip9i7j3111111gvv.jpg" data-src="false">
      </div></div>
    </div></div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should only scrape the feed image, not the sidebar banner", () => {
    expect(res.posts.map((x) => x.contentUrl)).toEqual([
      "https://wx1.sinaimg.cn/large/008sAXVzgy1i3w4hziy4yj3180140an2.jpg",
    ]);
  });
});

describe("identify the author from pro-next author links (fixture)", () => {
  // pro-next renders absolute hrefs and usercard markers; the time link
  // points at the status itself and must not become the artist.
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <article>
      <header>
        <a href="https://weibo.com/7751610237/PDv9O4ebt"><span>10-16</span></a>
        <a href="https://weibo.com/u/7751610237"><span>Some Artist</span></a>
        <a usercard="7751610237"><span>Some Artist</span></a>
      </header>
      <div class="wbpro-feed-content">
        <div class="picture"><div class="woo-picture-main">
          <img class="woo-picture-img" src="https://wx1.sinaimg.cn/mw2000/008sAXVzgy1i3w4hziy4yj3180140an2.jpg">
        </div></div>
      </div>
    </article>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should pick the artist from the absolute profile link, not the time link", () => {
    expect(res.posts[0]).toHaveTag("some_artist", "artist");
  });
});

describe("get weibo image status despite empty video-js shell (fixture)", () => {
  // pro-next ships an empty video-js shell on image posts; an empty-src
  // <video> must neither short-circuit the scrape nor become a post.
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <div class="video-js"><video class="vjs-tech" id="vjs_video_3_html5_api"></video></div>
    <div class="wbpro-feed-content">
      <div class="picture"><div class="woo-picture-main">
        <img class="woo-picture-img" src="https://wx1.sinaimg.cn/mw2000/008sAXVzgy1i3w4hziy4yj3180140an2.jpg">
      </div></div>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should scrape the image post only", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentType).toBe("image");
    expect(res.posts[0].contentUrl).toBe("https://wx1.sinaimg.cn/large/008sAXVzgy1i3w4hziy4yj3180140an2.jpg");
  });
});

describe("ignore weibo emoticons (fixture)", () => {
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <div class="wbpro-feed-content">
      <img title="[doge]" src="https://img.t.sinajs.cn/t4/style/images/common/face/ext/normal/doge/mobile.png">
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find no posts from non-sinaimg emoticons", () => {
    expect(res.posts.length).toBe(0);
  });
});

// Gating: the positive scan is scoped to the post article. Comment threads
// and page noise render outside it through the same shared picture component.

describe("exclude weibo comment-area and page noise via article scoping (fixture)", () => {
  // Pic-ids from the capture: commenter avatar 008GTexBly8ifam7xy797j30u00u043c,
  // author avatar 008sAXVzly8ifcwphlmc8j30u00u0jv3.
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <article><div class="wbpro-feed-content">
      <div class="picture"><div class="woo-picture-main">
        <img class="woo-picture-img" src="https://wx1.sinaimg.cn/mw2000/008sAXVzgy1i3w4hziy4yj3180140an2.jpg">
      </div></div>
    </div></article>
    <div class="wbpro-comments"><div class="woo-comment-item">
      <img class="woo-avatar-img" src="https://wx1.sinaimg.cn/thumbnail/008GTexBly8ifam7xy797j30u00u043c.jpg">
      <img class="woo-picture-img" src="//wx1.sinaimg.cn/thumbnail/008GTexBly8ifam7xy797j30u00u043c.jpg">
    </div></div>
    <img src="//wx1.sinaimg.cn/mw690/008sAXVzly8ifcwphlmc8j30u00u0jv3.jpg">
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should only scrape the article feed image", () => {
    expect(res.posts.map((x) => x.contentUrl)).toEqual([
      "https://wx1.sinaimg.cn/large/008sAXVzgy1i3w4hziy4yj3180140an2.jpg",
    ]);
  });
});

describe("rescue weibo images via the page-global fallback scan (fixture)", () => {
  // Pages whose DOM doesn't match the article shape must still extract
  // through the global img scan.
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <div class="main-wrap"><img src="https://wx1.sinaimg.cn/mw2000/008sAXVzgy1i3w4hziy4yj3180140an2.jpg"></div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should extract the image when the scoped scan is empty", () => {
    expect(res.posts.map((x) => x.contentUrl)).toEqual([
      "https://wx1.sinaimg.cn/large/008sAXVzgy1i3w4hziy4yj3180140an2.jpg",
    ]);
  });
});

describe("reject weibo emoticon stickers hosted on sinaimg.cn (fixture)", () => {
  // Sticker packs are real sinaimg media carrying size tokens; the
  // bracketed alt/title emoticon marker is the only rejection signal.
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <article><div class="wbpro-feed-content">
      <img alt="[doge]" title="[doge]" src="https://wx1.sinaimg.cn/mw690/008GTexBly8ifam7xy797j30u00u043c.jpg">
    </div></article>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find no posts from bracket-alt emoticons", () => {
    expect(res.posts.length).toBe(0);
  });
});

describe("exclude weibo comment/reply containers in the fallback scan (fixture)", () => {
  // No article shape: the fallback scan runs, so the comment/reply
  // container exclusion and the emoticon rejection backstop it.
  const pageUrl = "https://weibo.com/7751610237/PDv9O4ebt";
  const html = `<html><body>
    <div><img src="https://wx1.sinaimg.cn/mw2000/008sAXVzgy1i3w4hziy4yj3180140an2.jpg"></div>
    <div class="wbpro-comment">
      <img src="https://wx1.sinaimg.cn/mw690/008GTexBly8ifam7xy797j30u00u043c.jpg">
    </div>
    <div class="reply-list">
      <img title="[哈哈]" src="https://wx1.sinaimg.cn/orj480/008GTexBly8ifam7xy797j30u00u043c.jpg">
    </div>
    <img alt="[微笑]" src="//wx1.sinaimg.cn/mw690/008sAXVzly8ifcwphlmc8j30u00u0jv3.jpg">
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should scrape only the post image", () => {
    expect(res.posts.map((x) => x.contentUrl)).toEqual([
      "https://wx1.sinaimg.cn/large/008sAXVzgy1i3w4hziy4yj3180140an2.jpg",
    ]);
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
