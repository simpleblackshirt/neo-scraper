import { ScrapeResults } from "../ScrapeEngine.js";
import { MobileUserAgent, scrapeEvalUrl, scrapePage } from "../test/engine.js";
import { scrapeFixture } from "../test/fixture.js";
import { upgradeUrlToOriginalQuality } from "./Pixiv.js";

test("upgradeUrlToOriginalQuality", async () => {
  expect(
    upgradeUrlToOriginalQuality("https://i.pximg.net/img-master/img/2022/02/15/06/50/28/96268450_p2_master1200.jpg")
  ).toBe("https://i.pximg.net/img-original/img/2022/02/15/06/50/28/96268450_p2.jpg");

  expect(
    upgradeUrlToOriginalQuality(
      "https://i.pximg.net/c/600x1200_90_webp/img-master/img/2022/02/15/06/50/28/96268450_p2_master1200.jpg"
    )
  ).toBe("https://i.pximg.net/img-original/img/2022/02/15/06/50/28/96268450_p2.jpg");
});

describe("get pixiv post 93964654", () => {
  const pageUrl = "https://www.pixiv.net/en/artworks/93964654";
  let res: ScrapeResults;

  beforeAll(async () => {
    res = await scrapeEvalUrl(pageUrl, ".gtm-expand-full-size-illust");
  });

  it("should find exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should grab original image url", () => {
    expect(res.posts[0].contentUrl).toBe("https://i.pximg.net/img-original/img/2021/11/07/00/01/02/93964654_p0.jpg");
  });
});

describe("get pixiv post 93964654 (mobile)", () => {
  const pageUrl = "https://www.pixiv.net/en/artworks/93964654";
  let res: ScrapeResults;

  beforeAll(async () => {
    res = await scrapeEvalUrl(pageUrl, ".work-thumb", MobileUserAgent);
  });

  it("should find exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should grab original image url", () => {
    expect(res.posts[0].contentUrl).toBe("https://i.pximg.net/img-original/img/2021/11/07/00/01/02/93964654_p0.jpg");
  });
});

describe("get pixiv post 96268450 (multipage, not expanded)", () => {
  const pageUrl = "https://www.pixiv.net/en/artworks/96268450";
  let res: ScrapeResults;

  beforeAll(async () => {
    res = await scrapeEvalUrl(pageUrl, "div[role='presentation'] img");
  });

  it("should find exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should grab original image url", () => {
    expect(res.posts[0].contentUrl).toBe("https://i.pximg.net/img-original/img/2022/02/15/06/50/28/96268450_p0.jpg");
  });
});

describe("get pixiv post 96268450 (multipage, expanded)", () => {
  const pageUrl = "https://www.pixiv.net/en/artworks/96268450";
  let res: ScrapeResults;

  beforeAll(async () => {
    await jestPuppeteer.resetPage();
    await page.goto(pageUrl);
    await page.waitForSelector("div[role='presentation'] img", { visible: true });
    await expect(page).toClick("button", { text: "Show all" });
    await page.waitForSelector(".gtm-expand-full-size-illust", { visible: true });
    // await jestPuppeteer.debug();
    // page.waitForTimeout() was removed in puppeteer 22
    await new Promise((resolve) => setTimeout(resolve, 2000));
    res = await scrapePage(pageUrl, page);
  });

  it("should find exactly four posts", () => {
    expect(res.posts.length).toBe(4);
  });

  it("should grab original image url", () => {
    expect(res.posts[0].contentUrl).toBe("https://i.pximg.net/img-original/img/2022/02/15/06/50/28/96268450_p0.jpg");
    expect(res.posts[1].contentUrl).toBe("https://i.pximg.net/img-original/img/2022/02/15/06/50/28/96268450_p1.jpg");
    expect(res.posts[2].contentUrl).toBe("https://i.pximg.net/img-original/img/2022/02/15/06/50/28/96268450_p2.jpg");
    expect(res.posts[3].contentUrl).toBe("https://i.pximg.net/img-original/img/2022/02/15/06/50/28/96268450_p3.jpg");
  });
});

describe("get pixiv post 93964654 (fixture)", () => {
  const pageUrl = "https://www.pixiv.net/en/artworks/93964654";
  const html = `<html><head>
    <meta id="meta-preload-data" content='{"body":{"illust":{"93964654":{"userId":"12345","userName":"Some Artist","xRestrict":1,"tags":[{"tag":"オリジナル"},{"tag":"女の子"}]}}}}'>
    </head><body>
    <div role="presentation"><img src="https://i.pximg.net/c/600x1200_90_webp/img-master/img/2021/11/07/00/01/02/93964654_p0_master1200.jpg"></div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should grab original image url", () => {
    expect(res.posts[0].contentUrl).toBe("https://i.pximg.net/img-original/img/2021/11/07/00/01/02/93964654_p0.jpg");
  });

  it("should have tags and an artist tag", () => {
    expect(res.posts[0]).toHaveTag("オリジナル");
    expect(res.posts[0]).toHaveTag("女の子");
    expect(res.posts[0]).toHaveTag("some_artist", "artist");
  });

  it("should be unsafe (xRestrict 1)", () => {
    expect(res.posts[0].rating).toBe("unsafe");
  });

  it("should have the page url as source", () => {
    expect(res.posts[0]).toHaveSource(pageUrl);
  });
});

describe("get pixiv post 93964654 (fixture, no preload data)", () => {
  // No meta#meta-preload-data: exercises the DOM fallback path. Tag links use
  // the locale-prefixed /en/tags/<name>/artworks shape and the viewer's own
  // profile link in the header comes before the artwork's author link.
  const pageUrl = "https://www.pixiv.net/en/artworks/93964654";
  const html = `<html><head></head><body>
    <header><a href="/en/users/999999">Viewer McOwn</a></header>
    <article>
      <h2><a href="/en/users/12345">Some Artist</a></h2>
      <div role="presentation"><img src="https://i.pximg.net/c/600x1200_90_webp/img-master/img/2021/11/07/00/01/02/93964654_p0_master1200.jpg"></div>
      <div class="tags">
        <a href="/en/tags/%E3%82%AA%E3%83%AA%E3%82%B8%E3%83%8A%E3%83%AB/artworks">オリジナル</a>
        <a href="/en/tags/Some%20Tag/artworks">Some Tag</a>
        <a href="/tags/Legacy%20Path/artworks">Legacy Path</a>
        <a href="/en/tags/R-18/artworks">R-18</a>
      </div>
    </article>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should grab original image url", () => {
    expect(res.posts[0].contentUrl).toBe("https://i.pximg.net/img-original/img/2021/11/07/00/01/02/93964654_p0.jpg");
  });

  it("should derive tag names after the /tags/ path segment for locale-prefixed links", () => {
    expect(res.posts[0]).toHaveTag("オリジナル");
    expect(res.posts[0]).toHaveTag("some_tag");
    expect(res.posts[0]).toHaveTag("legacy_path");
  });

  it("should not emit literal 'tags' entries", () => {
    expect(res.posts[0].tags.find((x) => x.name == "tags")).toBeUndefined();
  });

  it("should not use the viewer's own username as artist", () => {
    expect(res.posts[0].tags.find((x) => x.name.indexOf("viewer") != -1)).toBeUndefined();
    expect(res.posts[0]).toHaveTag("some_artist", "artist");
  });

  it("should skip the rating link as a tag but still mark the post unsafe", () => {
    expect(res.posts[0].tags.find((x) => x.name == "r-18")).toBeUndefined();
    expect(res.posts[0].rating).toBe("unsafe");
  });
});

describe("get pixiv post 150504540 (fixture, live DOM shape)", () => {
  // Replicates the anonymous desktop artwork page as captured live
  // (2026-10-08, artwork 150504540): no meta#meta-preload-data, no <article> —
  // the author area is an <h2> holding an avatar link (empty text) plus the
  // name link; each tag renders one <li> with the tag anchor followed by a
  // translation anchor; a trending-tags widget elsewhere in the document
  // repeats work-tag names. The viewer's own header profile link comes first.
  const pageUrl = "https://www.pixiv.net/en/artworks/150504540";
  const html = `<html><head></head><body>
    <header><a href="/en/users/888888">Viewer McOwn</a></header>
    <div role="presentation"><img src="https://i.pximg.net/c/600x1200_90_webp/img-master/img/2026/10/06/00/00/00/150504540_p0_master1200.jpg"></div>
    <h2>
      <div><a href="/en/users/552160"></a></div>
      <div><a href="/en/users/552160">Kurenai Sake</a></div>
    </h2>
    <ul>
      <li>
        <a href="/en/tags/ZenlessZoneZero">ZenlessZoneZero</a>
        <a href="/en/tags/%E3%82%BC%E3%83%B3%E3%83%AC%E3%82%B9%E3%82%BE%E3%83%BC%E3%83%B3%E3%82%BC%E3%83%AD">Zenless Zone Zero</a>
      </li>
      <li>
        <a href="/en/tags/%E3%81%82%E3%82%89%E3%81%8B%E3%82%8F%E3%81%84%E3%81%84">あらかわいい</a>
        <a href="/en/tags/%E3%81%82%E3%82%89%E3%81%8B%E3%82%8F%E3%81%84%E3%81%84">oh my, cute</a>
      </li>
    </ul>
    <ol>
      <li><div><a href="/tags/ZenlessZoneZero">ZenlessZoneZero</a></div></li>
      <li><div><a href="/en/tags/%E3%81%82%E3%82%89%E3%81%8B%E3%82%8F%E3%81%84%E3%81%84">あらかわいい</a></div></li>
    </ol>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should grab original image url", () => {
    expect(res.posts[0].contentUrl).toBe("https://i.pximg.net/img-original/img/2026/10/06/00/00/00/150504540_p0.jpg");
  });

  it("should emit each tag exactly once despite tag+translation pairs and repeated widgets", () => {
    const names = res.posts[0].tags.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => n == "zenlesszonezero")).toHaveLength(1);
    expect(names.filter((n) => n == "あらかわいい")).toHaveLength(1);
  });

  it("should keep the original tag name, not the translation alias", () => {
    expect(res.posts[0].tags.find((x) => x.name == "zenless_zone_zero")).toBeUndefined();
    expect(res.posts[0].tags.find((x) => x.name == "oh_my_cute")).toBeUndefined();
  });

  it("should preserve document order for the tag list", () => {
    const names = res.posts[0].tags.map((t) => t.name);
    expect(names.slice(0, 2)).toEqual(["zenlesszonezero", "あらかわいい"]);
  });

  it("should use the artwork author as artist even though the header viewer link comes first", () => {
    expect(res.posts[0].tags.find((x) => x.name.indexOf("viewer") != -1)).toBeUndefined();
    expect(res.posts[0]).toHaveTag("kurenai_sake", "artist");
  });
});

describe("get pixiv post 93964654 (fixture, dual-path merge)", () => {
  // Preload payload in the live logged-in shape: tags wrapped as {tags:[…]}
  // and the author identity only in body.user[<userId>].name. The DOM also
  // offers tag links (which must NOT be merged on top of the preload tags)
  // and a header-first viewer profile link (which must not become the artist).
  const pageUrl = "https://www.pixiv.net/en/artworks/93964654";
  const html = `<html><head>
    <meta id="meta-preload-data" content='{"body":{"illust":{"93964654":{"userId":"12345","xRestrict":0,"tags":{"tags":[{"tag":"オリジナル"},{"tag":"女の子"}]}}},"user":{"12345":{"name":"Some Artist"}}}}'>
    </head><body>
    <header><a href="/en/users/888888">Viewer McOwn</a></header>
    <div role="presentation"><img src="https://i.pximg.net/c/600x1200_90_webp/img-master/img/2021/11/07/00/01/02/93964654_p0_master1200.jpg"></div>
    <ul>
      <li><a href="/en/tags/%E3%83%89%E3%83%A1%E5%A4%A2">ドメ夢</a></li>
    </ul>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should grab original image url", () => {
    expect(res.posts[0].contentUrl).toBe("https://i.pximg.net/img-original/img/2021/11/07/00/01/02/93964654_p0.jpg");
  });

  it("should not merge DOM tag links into the preload tag list", () => {
    const names = res.posts[0].tags.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(["オリジナル", "女の子"]));
    expect(res.posts[0].tags.find((x) => x.name == "ドメ夢")).toBeUndefined();
  });

  it("should take the artist from body.user[<userId>].name, not the header viewer link", () => {
    expect(res.posts[0].tags.find((x) => x.name.indexOf("viewer") != -1)).toBeUndefined();
    expect(res.posts[0]).toHaveTag("some_artist", "artist");
  });
});
