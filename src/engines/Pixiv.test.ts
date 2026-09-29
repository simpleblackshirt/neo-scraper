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
    await page.waitForTimeout(2000);
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
