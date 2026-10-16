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

describe("exclude lofter avatar noise (fixture)", () => {
  const pageUrl = "https://5159468402.lofter.com/post/874575ad_34f7d6b85";
  const contentImg = "https://imglf4.lf127.net/img/gallery/full.jpg";
  const html = `<html><body>
    <div class="selfinfo">
      <div class="logo"><a href="/"><img src="https://avaimg.lf127.net/img/0b5fb48b60202e02/artist.jpg?imageView&amp;thumbnail=96x96&amp;quality=90&amp;type=jpg"><i></i></a></div>
      <h1><a href="/">好的</a></h1>
      <div class="text">谢谢你的评论和喜欢( ´ ▽｀)♡</div>
    </div>
    <div class="block photo">
      <div class="side">
        <div class="day"><a href="https://5159468402.lofter.com/post/874575ad_34f7d6b85">16</a></div>
        <div class="month"><a href="https://5159468402.lofter.com/post/874575ad_34f7d6b85">10</a></div>
      </div>
      <div class="main">
        <div class="content">
          <div class="img">
            <a href="#" class="imgclasstag" imggroup="gal" bigimgwidth="3527" bigimgheight="2619"
               bigimgsrc="https://imglf4.lf127.net/img/gallery/full.jpg?imageView&amp;thumbnail=1680x0&amp;quality=96&amp;stripmeta=0&amp;type=jpg">
              <img src="https://imglf4.lf127.net/img/gallery/thumb.jpg?imageView&amp;thumbnail=500x500&amp;quality=96&amp;stripmeta=0&amp;type=jpg">
            </a>
            <p class="desc"></p>
          </div>
          <div class="img">
            <img src="https://imglf4.lf127.net/img/gallery/full.jpg?imageView&amp;thumbnail=1680x0&amp;quality=96&amp;stripmeta=0&amp;type=jpg">
          </div>
          <div class="text"><p id="p_u95mv9iabav">Snow&nbsp;was&nbsp;general&nbsp;all&nbsp;over&nbsp;Tara</p></div>
        </div>
        <div class="tag">
          <a href="https://5159468402.lofter.com/tag/%E6%98%8E%E6%97%A5%E6%96%B9%E8%88%9F">● 明日方舟</a>
        </div>
      </div>
    </div>
    <div class="main comment" id="comment">
      <h3 class="nctitle">评论(1)</h3>
      <div class="comment-item"><img src="https://imglf1.lf127.net/img/commenter_icon.jpg?imageView&amp;thumbnail=48y48"></div>
    </div>
    <ol class="notes">
      <li class="note like">
        <a href="//wuyu057267.lofter.com/" title="无语 - 半小时前"><img class="avatar" src="https://avaimg.lf127.net/img/739df8a7ae9618fa/liker1.jpg?imageView&amp;thumbnail=16y16"></a>
        <span class="action"><a href="//wuyu057267.lofter.com/" title="无语 - 半小时前">无语</a> 很喜欢此图片</span>
        <div class="clear"></div>
      </li>
      <li class="note like">
        <a href="//yuqiu85726.lofter.com/" title="yuqiu - 4小时前"><img class="avatar" src="https://lofter.lf127.net/1653290601208/avatar_default.jpg?imageView&amp;thumbnail=16y16"></a>
        <span class="action"><a href="//yuqiu85726.lofter.com/" title="yuqiu - 4小时前">yuqiu</a> 很喜欢此图片</span>
        <div class="clear"></div>
      </li>
      <li class="note share">
        <a href="//jinmu20902.lofter.com/" title="北极圈寻粮真君 - 5小时前"><img class="avatar" src="https://avaimg.lf127.net/img/36aa6fcc2b6fe396/liker2.jpg?imageView&amp;thumbnail=16y16"></a>
        <span class="action"><a href="//jinmu20902.lofter.com/" title="北极圈寻粮真君 - 5小时前">北极圈寻粮真君</a> 推荐了此图片</span>
        <div class="clear"></div>
      </li>
    </ol>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one post (avatars excluded, duplicate images removed)", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should prefer the anchor's bigimgsrc as the original image", () => {
    expect(res.posts[0].contentUrl).toBe(contentImg);
  });

  it("should not scrape any avatars", () => {
    expect(res.posts.find((x) => /avaimg|avatar/i.test(x.contentUrl))).toBeUndefined();
  });

  it("should still have tags and the artist tag", () => {
    expect(res.posts[0]).toHaveTag("明日方舟");
    expect(res.posts[0]).toHaveTag("5159468402", "artist");
  });
});

describe("get lofter post with lazy-loaded images (fixture)", () => {
  // Log pages lazy-load the images after the first: src holds a data-URI
  // placeholder and the real CDN url only sits in data-src /
  // data-lazy-src / data-original / data-origin-src until the image
  // scrolls into view.
  const pageUrl = "https://someblog.lofter.com/post/1e8c2_lzy";
  const placeholder = "data:image/gif;base64,R0lGODlhAQABAAAAACw";
  const html = `<html><body>
    <header><a href="https://someblog.lofter.com/"><img class="avatar" src="${placeholder}" data-src="https://avaimg.lf127.net/img/lazy_icon.jpg?imageView&amp;thumbnail=48y48"></a></header>
    <div class="content">
      <img src="https://imglf1.lf127.net/img/aaa.png?imageView&amp;thumbnail=500x0&amp;quality=96&amp;stripmeta=1">
      <img src="${placeholder}" data-src="https://imglf6.lf127.net/img/bbb.jpg?imageView&amp;thumbnail=500x0&amp;quality=96&amp;stripmeta=1">
      <img src="${placeholder}" data-lazy-src="https://imglf3.lf127.net/img/ccc.jpg?imageView&amp;thumbnail=500x0&amp;quality=96&amp;stripmeta=1">
      <img src="${placeholder}" data-original="https://imglf2.lf127.net/img/ddd.jpg?imageView&amp;thumbnail=500x0&amp;quality=96&amp;stripmeta=1">
      <img src="${placeholder}" data-origin-src="https://imglf5.lf127.net/img/eee.jpg?imageView&amp;thumbnail=500x0&amp;quality=96&amp;stripmeta=1">
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should read the real image urls from the lazy attributes", () => {
    expect(res.posts.map((x) => x.contentUrl)).toEqual([
      "https://imglf1.lf127.net/img/aaa.png",
      "https://imglf6.lf127.net/img/bbb.jpg",
      "https://imglf3.lf127.net/img/ccc.jpg",
      "https://imglf2.lf127.net/img/ddd.jpg",
      "https://imglf5.lf127.net/img/eee.jpg",
    ]);
  });

  it("should not scrape the lazy-loaded avatar", () => {
    expect(res.posts.find((x) => /avaimg|avatar/i.test(x.contentUrl))).toBeUndefined();
  });
});

describe("keep gallery images under a shared bigimgsrc anchor separate (fixture)", () => {
  // Some themes/lightboxes wrap several content images in ONE anchor that
  // carries bigimgsrc; adopting it for every wrapped img would resolve all
  // of them to the same url and the dedup would collapse the gallery to a
  // single post.
  const pageUrl = "https://someblog.lofter.com/post/1e8c2_shr";
  const html = `<html><body>
    <div class="content">
      <a href="#" bigimgsrc="https://imglf4.lf127.net/img/shared/lightbox.jpg?imageView&amp;thumbnail=1680x0&amp;quality=96&amp;stripmeta=0&amp;type=jpg">
        <img src="https://imglf4.lf127.net/img/shared/one.jpg?imageView&amp;thumbnail=500x0&amp;quality=96&amp;stripmeta=0&amp;type=jpg">
        <img src="https://imglf4.lf127.net/img/shared/two.jpg?imageView&amp;thumbnail=500x0&amp;quality=96&amp;stripmeta=0&amp;type=jpg">
      </a>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should emit one post per wrapped image instead of one collapsed post", () => {
    expect(res.posts.map((x) => x.contentUrl)).toEqual([
      "https://imglf4.lf127.net/img/shared/one.jpg",
      "https://imglf4.lf127.net/img/shared/two.jpg",
    ]);
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
