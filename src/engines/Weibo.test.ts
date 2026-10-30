import { ScrapeResults } from "../ScrapeEngine.js";
import { scrapeElementFixture, scrapeFixture } from "../test/fixture.js";
import { downgradeSinaImageUrl, upgradeSinaImageUrl } from "./Weibo.js";

test("upgradeSinaImageUrl", () => {
  expect(upgradeSinaImageUrl("https://wx1.sinaimg.cn/mw2000/abc/def.jpg")).toBe("https://wx1.sinaimg.cn/large/abc/def.jpg");
  expect(upgradeSinaImageUrl("https://wx2.sinaimg.cn/orj480/abc/ghi.jpg")).toBe("https://wx2.sinaimg.cn/large/abc/ghi.jpg");
  expect(upgradeSinaImageUrl("https://wx3.sinaimg.cn/thumb180/abc/jkl.jpg")).toBe("https://wx3.sinaimg.cn/large/abc/jkl.jpg");
  expect(upgradeSinaImageUrl("https://wx1.sinaimg.cn/large/abc/def.jpg")).toBe("https://wx1.sinaimg.cn/large/abc/def.jpg");
});

test("downgradeSinaImageUrl", () => {
  expect(downgradeSinaImageUrl("https://wx1.sinaimg.cn/large/abc/def.jpg")).toBe("https://wx1.sinaimg.cn/mw2000/abc/def.jpg");
  // Renditions without a /large/ segment have no fallback variant and pass through.
  expect(downgradeSinaImageUrl("https://wx2.sinaimg.cn/mw2000/abc/ghi.jpg")).toBe("https://wx2.sinaimg.cn/mw2000/abc/ghi.jpg");
  expect(downgradeSinaImageUrl("https://wx3.sinaimg.cn/orj480/abc/jkl.jpg")).toBe("https://wx3.sinaimg.cn/orj480/abc/jkl.jpg");
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

  it("should declare the weibo referer (sinaimg hotlink protection)", () => {
    expect(res.posts[0].referrer).toBe("https://weibo.com/");
    expect(res.posts[1].referrer).toBe("https://weibo.com/");
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

  it("should declare the weibo referer on the video post", () => {
    expect(res.posts[0].referrer).toBe("https://weibo.com/");
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

// ---------------------------------------------------------------------------
// Element grabs (context menu). Structures from live captures (2026-10-30,
// logged-in weibo.com desktop): see SzuruImporter
// docs/plan/20261018-element-context-grab/dom-notes/weibo.md.
// ---------------------------------------------------------------------------

const timelineCardHtml = `<html><body>
  <div class="css-g5y9jx">
    <div class="woo-box-flex">
      <a href="//weibo.com/u/3150932560" usercard="3150932560"><img src="https://tvax3.sinaimg.cn/crop.0.0.1080.1080.1024/bbcf6a50ly8fxug0g8dcbj20u00u0wg6.jpg?KID="></a>
      <a href="//weibo.com/u/3150932560" usercard="3150932560"><span>_第七定义</span></a>
      <a href="https://weibo.com/3150932560/RoVILhfCJ"><span>昨天 12:03</span></a>
    </div>
    <div>art post text</div>
    <div><img src="https://wx4.sinaimg.cn/orj360/bbcf6a50gy1iijdptbdsnj20w1104qtp.jpg"></div>
  </div>
  </body></html>`;

describe("element grab: single-image timeline card", () => {
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeElementFixture("https://weibo.com/", timelineCardHtml, "img[src*='orj360']");
  });

  it("finds exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("upgrades the orj360 rendition to /large/", () => {
    expect(res.posts[0].contentUrl).toBe("https://wx4.sinaimg.cn/large/bbcf6a50gy1iijdptbdsnj20w1104qtp.jpg");
  });

  it("carries the display name as artist tag", () => {
    expect(res.posts[0]).toHaveTag("_第七定义", "artist");
  });

  it("carries the canonical permalink as source and pageUrl", () => {
    expect(res.posts[0]).toHaveSource("https://weibo.com/3150932560/RoVILhfCJ");
    expect(res.posts[0].pageUrl).toBe("https://weibo.com/3150932560/RoVILhfCJ");
  });

  it("uploads from client-fetched content and declares the weibo referer", () => {
    expect(res.posts[0].uploadMode).toBe("content");
    expect(res.posts[0].referrer).toBe("https://weibo.com/");
  });
});

describe("element grab: multi-image card", () => {
  const html = `<html><body>
    <div>
      <div class="woo-box-flex">
        <a href="//weibo.com/u/3291628783" usercard="3291628783"><span>离渚若寒</span></a>
        <a href="https://weibo.com/3291628783/Mkk95elk5"><span>2022-12-19</span></a>
      </div>
      <div>
        <img src="https://wx1.sinaimg.cn/orj360/c43244efgy1h998vnwsfhj21o0190e82.jpg">
        <img src="https://wx1.sinaimg.cn/orj360/c43244efgy1h998vyeprfj21o0190qv5.jpg">
        <img src="https://wx1.sinaimg.cn/orj360/c43244efgy1h998w808yjj21o0190qv5.jpg">
      </div>
    </div>
    </body></html>`;

  it("returns every image of the card in fullsize", () => {
    const res = scrapeElementFixture("https://weibo.com/", html, "img[src*='h998vyeprfj']");
    expect(res.posts.map((p) => p.contentUrl)).toEqual([
      "https://wx1.sinaimg.cn/large/c43244efgy1h998vnwsfhj21o0190e82.jpg",
      "https://wx1.sinaimg.cn/large/c43244efgy1h998vyeprfj21o0190qv5.jpg",
      "https://wx1.sinaimg.cn/large/c43244efgy1h998w808yjj21o0190qv5.jpg",
    ]);
  });
});

describe("element grab: noise inside the card is excluded", () => {
  const html = `<html><body>
    <div>
      <div class="woo-box-flex">
        <a href="//weibo.com/u/3150932560" usercard="3150932560"><img src="https://tvax3.sinaimg.cn/crop.0.0.1080.1080.1024/bbcf6a50ly8fxug0g8dcbj20u00u0wg6.jpg?KID="><span>_第七定义</span></a>
        <a href="https://weibo.com/3150932560/RoVILhfCJ"><span>昨天 12:03</span></a>
      </div>
      <div>
        <img alt="[捂嘴哭]" src="https://face.t.sinajs.cn/t4/appstyle/expression/ext/normal/b4/2025_wuzuiku_mobile.png">
        <img src="https://wx4.sinaimg.cn/orj360/bbcf6a50gy1iijdptbdsnj20w1104qtp.jpg">
      </div>
    </div>
    </body></html>`;

  it("grabs only the content picture (avatar crop + emoticon excluded)", () => {
    const res = scrapeElementFixture("https://weibo.com/", html, "img[src*='orj360']");
    expect(res.posts.map((p) => p.contentUrl)).toEqual([
      "https://wx4.sinaimg.cn/large/bbcf6a50gy1iijdptbdsnj20w1104qtp.jpg",
    ]);
  });
});

describe("element grab: video card", () => {
  const html = `<html><body>
    <div>
      <div class="woo-box-flex">
        <a href="//weibo.com/u/6279793937" usercard="6279793937"><span>明日方舟Arknights</span></a>
        <a href="https://weibo.com/6279793937/RobdEt83S"><span>10-24 14:40</span></a>
      </div>
      <img src="https://wx2.sinaimg.cn/orj480/006QZngZgy1iigz8s5u71j31hc0u07wi.jpg">
      <div><video controls><source src="https://f.video.weibocdn.com/o0/CwtZ6aCKlx08BTNtXePK01041203jwGh0E020.mp4?label="></video></div>
    </div>
    </body></html>`;

  it("prefers the real video url over the poster image", () => {
    const res = scrapeElementFixture("https://weibo.com/", html, "video");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentType).toBe("video");
    expect(res.posts[0].contentUrl).toBe("https://f.video.weibocdn.com/o0/CwtZ6aCKlx08BTNtXePK01041203jwGh0E020.mp4?label=");
  });
});

describe("element grab: embedded repost card is its own target", () => {
  // Structure from captures: the outer post contains the embedded original in
  // div.retweet with its own permalink, usercard author and media.
  const html = `<html><body>
    <div>
      <div class="woo-box-flex">
        <a href="//weibo.com/u/6559309860" usercard="6559309860"><span>臼朩丕苫</span></a>
        <a href="https://weibo.com/6559309860/RodjRAhhJ"><span>10-24 20:00</span></a>
      </div>
      <div>repost comment</div>
      <div><div><img src="https://wx3.sinaimg.cn/orj360/0079Uc8kgy1idq7p94fa9j30u00u00wd.jpg"></div></div>
      <div class="retweet">
        <a href="/u/6613707036" usercard="6613707036"><span>@香浓豚骨拉面</span></a>
        <div><div><img src="https://wx4.sinaimg.cn/orj360/007dArk8gy1iidsw17kv3j30ol12ute2.jpg"></div></div>
        <a href="https://weibo.com/6613707036/RoceoEsee"><span>10-24 17:14</span></a>
      </div>
    </div>
    </body></html>`;

  it("grabs the embedded original when its media is clicked", () => {
    const res = scrapeElementFixture("https://weibo.com/", html, "img[src*='iidsw17kv3j']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://wx4.sinaimg.cn/large/007dArk8gy1iidsw17kv3j30ol12ute2.jpg");
    expect(res.posts[0]).toHaveTag("香浓豚骨拉面", "artist");
    expect(res.posts[0]).toHaveSource("https://weibo.com/6613707036/RoceoEsee");
  });

  it("excludes the embedded original's media from the outer post's grab", () => {
    const res = scrapeElementFixture("https://weibo.com/", html, "img[src*='idq7p94fa9j']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://wx3.sinaimg.cn/large/0079Uc8kgy1idq7p94fa9j30u00u00wd.jpg");
    expect(res.posts[0]).toHaveTag("臼朩丕苫", "artist");
    expect(res.posts[0]).toHaveSource("https://weibo.com/6559309860/RodjRAhhJ");
  });
});

describe("element grab: text-only card yields nothing", () => {
  const html = `<html><body>
    <div>
      <div class="woo-box-flex">
        <a href="//weibo.com/u/7728507948" usercard="7728507948"><span>轥琹</span></a>
        <a href="https://weibo.com/7728507948/RoD8dBs6L"><span>10-27 12:43</span></a>
      </div>
      <div>just text</div>
    </div>
    </body></html>`;

  it("finds no content media and produces zero posts", () => {
    const res = scrapeElementFixture("https://weibo.com/", html, "div > div");
    expect(res.posts.length).toBe(0);
  });
});

describe("element grab: gif grid beats the hidden low-res remux", () => {
  // Live capture (weibo-1793393630473.html): a 9-image gif post pre-open -
  // woo-picture placeholders, _customPoster gif images, a focus image, and a
  // hidden gif mp4 remux at template=500x726. The video-wins rule used to
  // collapse the grab to that single remux.
  const html = `<html><body>
    <div>
      <div class="woo-box-flex">
        <a href="//weibo.com/u/6279793937" usercard="6279793937"><span>明日方舟Arknights</span></a>
        <a href="https://weibo.com/6279793937/Rp3WZfMbp"><span>5小时前</span></a>
      </div>
      <img class="_focusImg" src="https://wx4.sinaimg.cn/orj360/006QZngZgy1iikcen7nhjj31hc0u04qm.jpg">
      <img class="woo-picture-img" src="data:image/svg+xml;utf-8,placeholder" data-src="false">
      <img class="_customPoster" src="https://wx1.sinaimg.cn/orj360/006QZngZgy1iikceskekfg30dw0k5qva.gif">
      <img class="woo-picture-img" src="data:image/svg+xml;utf-8,placeholder" data-src="false">
      <img class="_customPoster" src="https://wx4.sinaimg.cn/orj360/006QZngZgy1iikceu9vfjg30dw0k51a0.gif">
      <video><source src="https://g.us.sinaimg.cn/o0/remux.mp4?label=gif_mp4&amp;template=500x726.28.0"></video>
    </div>
    </body></html>`;

  it("grabs the focus image and the gif posters, never the remux", () => {
    const res = scrapeElementFixture("https://weibo.com/", html, "img[src*='iikceskekfg']");
    expect(res.posts.length).toBe(3);
    expect(res.posts.map((p) => p.contentType)).toEqual(["image", "image", "image"]);
    expect(res.posts[0].contentUrl).toBe("https://wx4.sinaimg.cn/large/006QZngZgy1iikcen7nhjj31hc0u04qm.jpg");
    expect(res.posts[1].contentUrl).toBe("https://wx1.sinaimg.cn/large/006QZngZgy1iikceskekfg30dw0k5qva.gif");
    expect(res.posts[2].contentUrl).toBe("https://wx4.sinaimg.cn/large/006QZngZgy1iikceu9vfjg30dw0k51a0.gif");
    expect(res.posts.find((p) => p.contentType == "video")).toBeUndefined();
    expect(res.posts.every((p) => p.uploadMode == "content")).toBe(true);
  });
});

describe("element grab: gif post embedded in a repost", () => {
  const html = `<html><body>
    <div>
      <div class="woo-box-flex">
        <a href="//weibo.com/u/5208034187" usercard="5208034187"><span>Reposter</span></a>
        <a href="https://weibo.com/5208034187/RoYhnj5Oi"><span>20小时前</span></a>
      </div>
      <div class="retweet">
        <a href="/u/6279793937" usercard="6279793937"><span>明日方舟Arknights</span></a>
        <img class="_customPoster" src="https://wx1.sinaimg.cn/orj360/006QZngZgy1iikceskekfg30dw0k5qva.gif">
        <video><source src="https://g.us.sinaimg.cn/o0/remux.mp4?label=gif_mp4&amp;template=500x726.28.0"></video>
        <a href="https://weibo.com/6279793937/Rp3WZfMbp"><span>5小时前</span></a>
      </div>
    </div>
    </body></html>`;

  it("grabs the embedded gif (not the remux) with the original's metadata", () => {
    const res = scrapeElementFixture("https://weibo.com/", html, "img[src*='iikceskekfg']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://wx1.sinaimg.cn/large/006QZngZgy1iikceskekfg30dw0k5qva.gif");
    expect(res.posts[0]).toHaveTag("明日方舟arknights", "artist");
    expect(res.posts[0]).toHaveSource("https://weibo.com/6279793937/Rp3WZfMbp");
  });
});

describe("toolbar grab on a gif post page (fixture)", () => {
  // Document path parity: the remux must not collapse the page grab.
  const pageUrl = "https://weibo.com/6279793937/Rp3WZfMbp";
  const html = `<html><body>
    <article>
      <header><a href="//weibo.com/u/6279793937" usercard="6279793937"><span>明日方舟Arknights</span></a></header>
      <div class="wbpro-feed-content">
        <img class="_customPoster" src="https://wx1.sinaimg.cn/orj360/006QZngZgy1iikceskekfg30dw0k5qva.gif">
        <img class="_customPoster" src="https://wx4.sinaimg.cn/orj360/006QZngZgy1iikceu9vfjg30dw0k51a0.gif">
      </div>
      <div><video><source src="https://g.us.sinaimg.cn/o0/remux.mp4?label=gif_mp4"></video></div>
    </article>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("grabs the gif images instead of the remux", () => {
    expect(res.posts.length).toBe(2);
    expect(res.posts.every((p) => p.contentType == "image")).toBe(true);
    expect(res.posts[0].contentUrl).toBe("https://wx1.sinaimg.cn/large/006QZngZgy1iikceskekfg30dw0k5qva.gif");
  });
});
