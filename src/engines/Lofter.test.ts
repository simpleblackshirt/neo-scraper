import { ScrapeResults } from "../ScrapeEngine.js";
import { scrapeElementFixture, scrapeFixture } from "../test/fixture.js";

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

// ---------------------------------------------------------------------------
// Element grabs (context menu). Structures from live captures (2026-10-31,
// logged-in lofter.com dashboard + a themed user page): see SzuruImporter
// docs/plan/20261018-element-context-grab/dom-notes/lofter.md.
// ---------------------------------------------------------------------------

const dashboardCardHtml = `<html><body>
  <div>
    <div class="isaym">
      <a href="https://jinyu537.lofter.com"><span>Jinyu</span></a>
      <a href="https://jinyu537.lofter.com/post/1fc97862_34f8c4aa8"><span>查看全文</span></a>
      <a href="https://www.lofter.com/tag/%E6%98%8E%E6%97%A5%E6%96%B9%E8%88%9F"><span>#明日方舟</span></a>
      <img class="js-442418">
      <div><img src="https://imglf3.lf127.net/img/18114dadc491284e/YTlDUEFKNWRYd2xZMG9TTE56NHlJaVR5QjJ2aGtKWEpTWjU5cmw2YStxVT0."></div>
    </div>
  </div>
  </body></html>`;

describe("element grab: dashboard single-image card", () => {
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeElementFixture("https://www.lofter.com/", dashboardCardHtml, "img[src*='imglf']");
  });

  it("finds exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("keeps the original-quality url", () => {
    expect(res.posts[0].contentUrl).toBe(
      "https://imglf3.lf127.net/img/18114dadc491284e/YTlDUEFKNWRYd2xZMG9TTE56NHlJaVR5QjJ2aGtKWEpTWjU5cmw2YStxVT0."
    );
  });

  it("derives the artist from the permalink's blog subdomain", () => {
    expect(res.posts[0]).toHaveTag("jinyu537", "artist");
  });

  it("carries the canonical permalink as source and pageUrl", () => {
    expect(res.posts[0]).toHaveSource("https://jinyu537.lofter.com/post/1fc97862_34f8c4aa8");
    expect(res.posts[0].pageUrl).toBe("https://jinyu537.lofter.com/post/1fc97862_34f8c4aa8");
  });

  it("carries the decoded tag", () => {
    expect(res.posts[0]).toHaveTag("明日方舟");
  });

  it("resolves the same card when the post text is clicked", () => {
    const res = scrapeElementFixture("https://www.lofter.com/", dashboardCardHtml, ".isaym a[href*='/tag/']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0]).toHaveTag("jinyu537", "artist");
  });
});

describe("element grab: dashboard multi-image card with dedup", () => {
  const html = `<html><body>
    <div class="isaym">
      <a href="https://sunledeg.lofter.com"><span>Sunle</span></a>
      <a href="https://sunledeg.lofter.com/post/1f5322a1_34f91132a"><span>查看全文</span></a>
      <a href="https://www.lofter.com/tag/%E6%98%8E%E6%97%A5%E6%96%B9%E8%88%9F"><span>#明日方舟</span></a>
      <img class="js-262533">
      <img src="https://imglf4.lf127.net/img/1ee0340607d5120c/Vi96Yk9XS3BKZUVnMHVWaFEzaHQrNm81Qko5eGJEZUJKWVVNT25nUzA1dz0.">
      <img src="https://imglf4.lf127.net/img/1ee0340607d5120c/Vi96Yk9XS3BKZUVnMHVWaFEzaHQrNm81Qko5eGJEZUJKWVVNT25nUzA1dz0.">
      <img src="https://imglf5.lf127.net/img/4659949ca59246c7/Vi96Yk9XS3BKZUVnMHVWaFEzaHQreE54MzkyTzQ1YThHeEFLb0tkczJXMD0.">
    </div>
    </body></html>`;

  it("deduplicates the double-rendered image", () => {
    const res = scrapeElementFixture("https://www.lofter.com/", html, "img[src*='4659949c']");
    expect(res.posts.map((p) => p.contentUrl)).toEqual([
      "https://imglf4.lf127.net/img/1ee0340607d5120c/Vi96Yk9XS3BKZUVnMHVWaFEzaHQrNm81Qko5eGJEZUJKWVVNT25nUzA1dz0.",
      "https://imglf5.lf127.net/img/4659949ca59246c7/Vi96Yk9XS3BKZUVnMHVWaFEzaHQreE54MzkyTzQ1YThHeEFLb0tkczJXMD0.",
    ]);
    expect(res.posts.every((p) => p.contentUrl.length > 0)).toBe(true);
    expect(res.posts[0]).toHaveTag("sunledeg", "artist");
  });
});

describe("element grab: themed permalink page with bigimgsrc", () => {
  const pageUrl = "https://wusenangua.lofter.com/post/1d3bb0bb_2be893c63";
  const original = "https://imglf3.lf127.net/img/04cd26a9a07e8625/bC9RU05VOUQvNWdMd2gxNVArNHA1Q0dHYlZSRXo3a1RLbDRKdk1UUT";
  const html = `<html><body>
    <div class="post photo">
      <a href="https://wusenangua.lofter.com/post/1d3bb0bb_2be893c63" bigimgsrc="${original}">
        <img src="${original}?thumbnail=1">
      </a>
      <a href="https://wusenangua.lofter.com/tag/%E6%98%8E%E6%97%A5%E6%96%B9%E8%88%9F"><span>#明日方舟</span></a>
    </div>
    </body></html>`;

  it("resolves the bigimgsrc original and the artist from the permalink subdomain", () => {
    // No blog-root author link exists on this themed page - the permalink's
    // subdomain is the only author signal.
    const res = scrapeElementFixture(pageUrl, html, "img");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe(original);
    expect(res.posts[0]).toHaveTag("wusenangua", "artist");
    expect(res.posts[0]).toHaveSource(pageUrl);
    expect(res.posts[0].pageUrl).toBe(pageUrl);
  });
});

describe("element grab: video card in expanded state", () => {
  const html = `<html><body>
    <div class="isaym">
      <a href="https://luopomengjingbiao.lofter.com/post/31d4fee2_34f55cfdb"><span>查看全文</span></a>
      <img src="https://imglf4.lf127.net/img/8f87634939d49479/SmJhdjlTMXRSYmRsMTF6aUd1Q2luSkNIM3NnTkRpWXUxbGoyOW5lMC9PZz0.">
      <div><video controls><source src="https://vodm2lzexwq.vod.126.net/vodm2lzexwq/zqanefJj_11634000210_sd.mp4?resId=x"></video></div>
    </div>
    </body></html>`;

  it("prefers the real video url over the cover image", () => {
    const res = scrapeElementFixture("https://www.lofter.com/", html, "video");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentType).toBe("video");
    expect(res.posts[0].contentUrl).toBe("https://vodm2lzexwq.vod.126.net/vodm2lzexwq/zqanefJj_11634000210_sd.mp4?resId=x");
    expect(res.posts[0]).toHaveTag("luopomengjingbiao", "artist");
  });
});

describe("element grab: text-only card yields nothing", () => {
  const html = `<html><body>
    <div class="isaym">
      <a href="https://xinjinjumin809976102299.lofter.com"><span>Author</span></a>
      <div>just text</div>
    </div>
    </body></html>`;

  it("finds no content media and produces zero posts", () => {
    const res = scrapeElementFixture("https://www.lofter.com/", html, ".isaym > div");
    expect(res.posts.length).toBe(0);
  });
});

describe("element grab: image viewer overlay (exact gallery match)", () => {
  // Live structure (tag-page dump): multi-picture posts carry a hidden
  // gallery list whose images reference their large rendition via a `large`
  // attribute - the photoshow viewer displays exactly that rendition.
  const viewerLarge =
    "https://imglf3.lf127.net/img/eb7db4dcecbd65d1/QXRheSs4ZXBkczRWRFFXL0d5VnlveVZvSVd0c21FOWN0UitiSlNaUEZGRT0.jpg?imageView&thumbnail=1680x0&quality=96&stripmeta=0&type=jpg";
  const feedThumb =
    "https://imglf4.lf127.net/img/1f87225a922d1fb6/QXRheSs4ZXBkczRWRFFXL0d5Vnlvd3BLdnFLNGpPbDc2d3Avekg0QnlrOD0.jpg?imageView&thumbnail=500x0&quality=96&stripmeta=0&type=jpg";
  const decoyThumb =
    "https://imglf5.lf127.net/img/decoydir/QXRheSs4ZXBkczRWRFFXL0d5Vnlvd3BLdnFLNGpPbDc2d3Avekg0QnlrOD0.jpg";
  const html = `<html><body>
    <div>
      <div class="isaym">
        <a href="https://someauthor.lofter.com"><span>Some Author</span></a>
        <a href="https://someauthor.lofter.com/post/1fabcd12_34efabcd"><span>查看全文</span></a>
        <a href="https://www.lofter.com/tag/%E6%98%8E%E6%97%A5%E6%96%B9%E8%88%9F"><span>#明日方舟</span></a>
        <div class="img">
          <div class="imgc">
            <a href="#"><img src="${feedThumb}"></a>
            <ol style="display:none;">
              <li>
                <div class="imgc">
                  <a href="#"><img large="${viewerLarge}" src="${feedThumb}"></a>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>
      <div class="isaym">
        <a href="https://decoyauthor.lofter.com"><span>Decoy Author</span></a>
        <a href="https://decoyauthor.lofter.com/post/1fdecoy12_34deefabcd"><span>查看全文</span></a>
        <div><img src="${decoyThumb}"></div>
      </div>
      <div class="photos wtag">
        <img src="${viewerLarge}">
      </div>
    </div>
    </body></html>`;

  it("resolves the underlying card by exact large-rendition identity", () => {
    const res = scrapeElementFixture("https://www.lofter.com/", html, "div.photos img");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe(feedThumb.split("?")[0]);
    expect(res.posts[0]).toHaveTag("someauthor", "artist");
    expect(res.posts[0]).toHaveSource("https://someauthor.lofter.com/post/1fabcd12_34efabcd");
    expect(res.posts[0].tags.find((x) => x.name == "decoyauthor")).toBeUndefined();
  });
});

describe("element grab: viewer overlay with no matching feed image", () => {
  // The viewed image is not referenced by any card behind the overlay (e.g. a
  // viewer opened over a page that no longer contains the post) - grab
  // nothing. Falling through to the walk here would return the whole feed.
  const html = `<html><body>
    <div class="photos wtag">
      <img src="https://imglf3.lf127.net/img/eb7db4dcecbd65d1/QXRheSs4ZXBkczRWRFFXL0d5VnlveVZvSVd0c21FOWN0UitiSlNaUEZGRT0.jpg?imageView&thumbnail=1680x0&quality=96&stripmeta=0&type=jpg">
    </div>
    <div>
      <div class="isaym">
        <a href="https://someauthor.lofter.com/post/1fabcd12_34efabcd"><span>查看全文</span></a>
        <div><img src="https://imglf5.lf127.net/img/different/QXRheSs4ZXBkczRWRFFXL0d5Vnlvd3BLdnFLNGpPbDc2d3Avekg0QnlrOD0"></div>
      </div>
    </div>
    </body></html>`;

  it("produces zero posts", () => {
    const res = scrapeElementFixture("https://www.lofter.com/", html, "div.photos img");
    expect(res.posts.length).toBe(0);
  });
});

describe("element grab: same-blog cards are told apart by exact file identity", () => {
  // Live e2e round 2 finding (user report): several single-picture posts by
  // ONE author share a long imglf prefix (the blog's image directory), so any
  // prefix-based matching always returned the first card. Exact file identity
  // tells them apart.
  const cardAImg =
    "https://imglf5.lf127.net/img/15ec0c4e721ad7b6/QjRvUW1sblNldDYvTS9ZdlJsNDl6eUloblhVOUNKNTArS3cwMEFyZTNoaz0.jpg?imageView&thumbnail=1000x0&type=jpg";
  const cardBImg =
    "https://imglf5.lf127.net/img/32467c48db918591/QjRvUW1sblNldDYvTS9ZdlJsNDl6MjdPWHRHZnFiTmRVUjhma3J6MG90OD0.jpg?imageView&thumbnail=1000x0&type=jpg";
  const html = `<html><body>
    <div>
      <div class="isaym">
        <a href="https://atractylodec.lofter.com"><span>白术不苦</span></a>
        <a href="https://atractylodec.lofter.com/post/30d2a938_34f7d1ba2"><span>查看全文</span></a>
        <img src="${cardAImg}">
      </div>
      <div class="isaym">
        <a href="https://atractylodec.lofter.com"><span>白术不苦</span></a>
        <a href="https://atractylodec.lofter.com/post/30d2a938_34f7d7352"><span>查看全文</span></a>
        <img src="${cardBImg}">
      </div>
      <div class="photos wtag">
        <img src="${cardAImg}">
      </div>
    </div>
    </body></html>`;

  it("grabs the card owning the viewed file, not the first same-blog card", () => {
    const res = scrapeElementFixture("https://www.lofter.com/", html, "div.photos img");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe(cardAImg.split("?")[0]);
    expect(res.posts[0]).toHaveSource("https://atractylodec.lofter.com/post/30d2a938_34f7d1ba2");
    expect(res.posts[0].contentUrl).not.toBe(cardBImg.split("?")[0]);
  });
});

describe("element grab: hot-section permalink fragment is stripped", () => {
  const html = `<html><body>
    <div class="post photo">
      <a href="https://wusenangua.lofter.com/post/1d3bb0bb_2be893c63#hot" bigimgsrc="https://imglf3.lf127.net/img/04cd26a9a07e8625/bC9RU05VOUQvNWdMd2gxNVArNHA1Q0dHYlZSRXo3a1RLbDRKdk1UUT">
        <img src="https://imglf3.lf127.net/img/04cd26a9a07e8625/bC9RU05VOUQvNWdMd2gxNVArNHA1Q0dHYlZSRXo3a1RLbDRKdk1UUT?thumbnail=1">
      </a>
    </div>
    </body></html>`;

  it("does not append #hot to the source", () => {
    const res = scrapeElementFixture(
      "https://wusenangua.lofter.com/post/1d3bb0bb_2be893c63",
      html,
      "img"
    );
    expect(res.posts.length).toBe(1);
    expect(res.posts[0]).toHaveSource("https://wusenangua.lofter.com/post/1d3bb0bb_2be893c63");
    expect(res.posts[0].pageUrl).toBe("https://wusenangua.lofter.com/post/1d3bb0bb_2be893c63");
  });
});
