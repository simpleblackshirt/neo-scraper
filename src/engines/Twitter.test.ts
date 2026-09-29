import { ScrapeResults } from "../ScrapeEngine.js";
import { scrapeEvalUrl } from "../test/engine.js";
import { scrapeFixture } from "../test/fixture.js";

describe("get twitter.com post", () => {
  const pageUrl = "https://twitter.com/Dishwasher1910/status/1171162651461746688/photo/1";
  let res: ScrapeResults;

  beforeAll(async () => {
    res = await scrapeEvalUrl(pageUrl, "img[alt='Image']");
  });

  it("should grab original image url", async () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].pageUrl).toBe(pageUrl);
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/EEDOOCdU0AAHX00?format=jpg&name=orig");
  });
});

describe("get x.com lightbox post (fixture)", () => {
  const pageUrl = "https://x.com/SomeArtist/status/1234567890/photo/1";
  const html = `<html><body>
    <div role="dialog">
      <div role="dialog">
        <div aria-label="Image"><img alt="Image" src="https://pbs.twimg.com/media/XXX?format=jpg&amp;name=large"></div>
        <article>
          <div data-testid="User-Name">
            <a href="/SomeArtist"><span>Some Artist</span></a>
            <a href="/SomeArtist"><span>@someartist</span></a>
          </div>
          <div><a href="/SomeArtist/status/1234567890"><time datetime="2024-01-01T00:00:00.000Z">1h</time></a></div>
          <div><a href="/SomeArtist/status/1234567890/hashtag/SomeTag"><span>#SomeTag</span></a></div>
          <a role="link"><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/XXX?format=jpg&amp;name=large"></div></a>
        </article>
      </div>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one post (lightbox image and article image are deduplicated)", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should grab original image url", () => {
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/XXX?format=jpg&name=orig");
  });

  it("should have the handle as artist tag and the hashtag as tag", () => {
    expect(res.posts[0]).toHaveTag("someartist", "artist");
    expect(res.posts[0]).toHaveTag("sometag");
  });

  it("should have the canonical status url as source", () => {
    expect(res.posts[0]).toHaveSource("https://x.com/SomeArtist/status/1234567890");
  });
});

describe("get x.com timeline (fixture)", () => {
  const pageUrl = "https://x.com/home";
  const html = `<html><body>
    <article>
      <div data-testid="User-Name"><a href="/ArtistOne"><span>Artist One</span></a></div>
      <a role="link"><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/AAA?format=jpg&amp;name=large"></div></a>
    </article>
    <article>
      <div data-testid="User-Name"><a href="/ArtistTwo"><span>Artist Two</span></a></div>
      <div><a href="/ArtistTwo/status/9876543210/hashtag/News"><span>#News</span></a></div>
      <a role="link"><div data-testid="videoPlayer"><video><source src="https://video.twimg.com/xyz.mp4"></video></div></a>
    </article>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find one post per tweet media", () => {
    expect(res.posts.length).toBe(2);
  });

  it("should apply tags per article", () => {
    expect(res.posts[0]).toHaveTag("artistone", "artist");
    expect(res.posts[1]).toHaveTag("artisttwo", "artist");
    expect(res.posts[1]).toHaveTag("news");
    expect(res.posts[0].tags.find((x) => x.name == "artisttwo")).toBeUndefined();
  });

  it("should grab the video", () => {
    expect(res.posts[1].contentType).toBe("video");
    expect(res.posts[1].contentUrl).toBe("https://video.twimg.com/xyz.mp4");
  });
});
