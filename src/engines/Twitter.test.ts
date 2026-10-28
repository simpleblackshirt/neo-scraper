import { JSDOM } from "jsdom";
import { ScrapeResults } from "../ScrapeEngine.js";
import Twitter from "./Twitter.js";
import { scrapeEvalUrl } from "../test/engine.js";
import { scrapeElementFixture, scrapeFixture } from "../test/fixture.js";

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

// ---------------------------------------------------------------------------
// Element grabs (context menu). Structures mirror live captures from
// 2026-10-19 (logged-in x.com desktop): see SzuruImporter
// docs/plan/20261018-element-context-grab/dom-notes/twitter.md.
// ---------------------------------------------------------------------------

const singleImageTweet = `
  <article data-testid="tweet" tabindex="0">
    <div data-testid="Tweet-User-Avatar"><div data-testid="UserAvatar-Container-ArtistOne"></div></div>
    <div data-testid="User-Name">
      <a href="/ArtistOne"><span>Artist One</span></a>
      <a href="/ArtistOne"><span>@artistone</span></a>
      <a href="/ArtistOne/status/111"><time datetime="2026-10-19T07:00:02.000Z">2h</time></a>
    </div>
    <div lang="en" data-testid="tweetText"><span>some art</span></div>
    <a role="link" href="/ArtistOne/status/111/photo/1">
      <div data-testid="tweetPhoto" aria-label="Image"><img alt="Image" src="https://pbs.twimg.com/media/HU1?format=jpg&amp;name=small"></div>
    </a>
  </article>`;

describe("element grab: single-image tweet", () => {
  const pageUrl = "https://x.com/home";
  const html = `<html><body>${singleImageTweet}</body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeElementFixture(pageUrl, html, "article[data-testid='tweet'] img");
  });

  it("finds exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("upgrades the timeline rendition to name=orig", () => {
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/HU1?format=jpg&name=orig");
  });

  it("carries the handle as artist tag", () => {
    expect(res.posts[0]).toHaveTag("artistone", "artist");
  });

  it("carries the canonical status url as source", () => {
    expect(res.posts[0]).toHaveSource("https://x.com/ArtistOne/status/111");
  });

  it("pageUrl is the tweet's canonical permalink (never the browsing page)", () => {
    expect(res.posts[0].pageUrl).toBe("https://x.com/ArtistOne/status/111");
  });

  it("uploads from client-fetched content (Twitter CDNs 403 server-side downloads)", () => {
    expect(res.posts[0].uploadMode).toBe("content");
  });
});

describe("element grab: multi-image tweet", () => {
  const html = `<html><body>
    <article data-testid="tweet" tabindex="0">
      <div data-testid="User-Name"><a href="/ArtistOne"><span>Artist One</span></a></div>
      <a role="link" href="/ArtistOne/status/111/photo/1"><div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/AAA?format=jpg&amp;name=240x240"></div></a>
      <a role="link" href="/ArtistOne/status/111/photo/2"><div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/BBB?format=jpg&amp;name=360x360"></div></a>
      <a role="link" href="/ArtistOne/status/111/photo/3"><div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/CCC?format=jpg&amp;name=small"></div></a>
      <a role="link" href="/ArtistOne/status/111/photo/4"><div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/DDD?format=jpg&amp;name=360x360"></div></a>
    </article>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    // Right-clicking ANY of the four images grabs the whole tweet.
    res = scrapeElementFixture("https://x.com/home", html, "img[src*='BBB']");
  });

  it("finds one post per image, regardless of which image was clicked", () => {
    expect(res.posts.length).toBe(4);
    expect(res.posts.map((p) => p.contentUrl)).toEqual([
      "https://pbs.twimg.com/media/AAA?format=jpg&name=orig",
      "https://pbs.twimg.com/media/BBB?format=jpg&name=orig",
      "https://pbs.twimg.com/media/CCC?format=jpg&name=orig",
      "https://pbs.twimg.com/media/DDD?format=jpg&name=orig",
    ]);
  });
});

const quoteTweetHtml = `<html><body>
  <article data-testid="tweet" tabindex="0">
    <div data-testid="User-Name">
      <a href="/OuterAuthor"><span>Outer Author</span></a>
      <a href="/OuterAuthor"><span>@outerauthor</span></a>
      <a href="/OuterAuthor/status/2112030985659298231"><time datetime="2026-10-19T04:00:01.000Z">5h</time></a>
    </div>
    <div lang="en" data-testid="tweetText"><span>look at this</span></div>
    <a role="link" href="/OuterAuthor/status/2112030985659298231/photo/1">
      <div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/OWN?format=jpg&amp;name=small"></div>
    </a>
    <div data-testid="testCondensedMedia">
      <div role="link">
        <a role="link" href="/QuotedAuthor/status/1971047002982043938/photo/1">
          <div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/QUOTED?format=jpg&amp;name=240x240"></div>
        </a>
      </div>
    </div>
  </article>
  </body></html>`;

describe("element grab: tweet containing a quote card", () => {
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeElementFixture("https://x.com/home", quoteTweetHtml, "img[src*='OWN']");
  });

  it("excludes the quoted tweet's media from the outer tweet", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/OWN?format=jpg&name=orig");
    expect(res.posts[0]).toHaveSource("https://x.com/OuterAuthor/status/2112030985659298231");
  });
});

describe("element grab: the quote card is its own target", () => {
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeElementFixture("https://x.com/home", quoteTweetHtml, "[data-testid='testCondensedMedia'] img");
  });

  it("grabs the quoted tweet, not the outer one", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/QUOTED?format=jpg&name=orig");
  });

  it("derives permalink and author from the card's status link", () => {
    expect(res.posts[0]).toHaveSource("https://x.com/QuotedAuthor/status/1971047002982043938");
    expect(res.posts[0]).toHaveTag("quotedauthor", "artist");
    expect(res.posts[0].tags.find((x) => x.name == "outerauthor")).toBeUndefined();
  });
});

describe("element grab: quote card detection without the A/B testid", () => {
  // Same tweet as above, but the card renders WITHOUT the
  // testCondensedMedia testid (A/B flag) - detection must be id-based.
  // The card carries an author row and text that are NOT inside any status
  // link; only the media is linked (live e2e round 2 finding).
  const bareCardHtml = `<html><body>
    <article data-testid="tweet" tabindex="0">
      <div data-testid="User-Name">
        <a href="/OuterAuthor"><span>Outer Author</span></a>
        <a href="/OuterAuthor/status/2112030985659298231"><time datetime="2026-10-19T04:00:01.000Z">5h</time></a>
      </div>
      <div lang="en" data-testid="tweetText"><span>look at this</span></div>
      <a role="link" href="/OuterAuthor/status/2112030985659298231/photo/1">
        <div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/OWN?format=jpg&amp;name=small"></div>
      </a>
      <div role="link">
        <div data-testid="User-Name"><a href="/QuotedAuthor"><span>Quoted Author</span></a></div>
        <div lang="en" data-testid="tweetText"><span>the quoted text</span></div>
        <a role="link" href="/QuotedAuthor/status/1971047002982043938/photo/1">
          <div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/QUOTED?format=jpg&amp;name=240x240"></div>
        </a>
      </div>
    </article>
    </body></html>`;

  it("grabs the quoted tweet when its image is clicked", () => {
    const res = scrapeElementFixture("https://x.com/home", bareCardHtml, "img[src*='QUOTED']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/QUOTED?format=jpg&name=orig");
    expect(res.posts[0]).toHaveSource("https://x.com/QuotedAuthor/status/1971047002982043938");
    expect(res.posts[0]).toHaveTag("quotedauthor", "artist");
  });

  it("grabs the quoted tweet when its TEXT is clicked (no enclosing status link)", () => {
    const res = scrapeElementFixture(
      "https://x.com/home",
      bareCardHtml,
      "div[role='link'] div[data-testid='tweetText']",
    );
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/QUOTED?format=jpg&name=orig");
    expect(res.posts[0]).toHaveSource("https://x.com/QuotedAuthor/status/1971047002982043938");
    expect(res.posts[0]).toHaveTag("quotedauthor", "artist");
  });

  it("grabs the outer tweet (quote excluded) when its own image is clicked", () => {
    const res = scrapeElementFixture("https://x.com/home", bareCardHtml, "img[src*='OWN']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/OWN?format=jpg&name=orig");
    expect(res.posts[0]).toHaveSource("https://x.com/OuterAuthor/status/2112030985659298231");
  });

  it("grabs the outer tweet when its own TEXT is clicked", () => {
    const res = scrapeElementFixture(
      "https://x.com/home",
      bareCardHtml,
      "article > div[data-testid='tweetText']",
    );
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/OWN?format=jpg&name=orig");
    expect(res.posts[0]).toHaveTag("outerauthor", "artist");
  });
});

describe("element grab: document scrape keeps legacy quote behavior", () => {
  it("scrapeDocument still collects quoted media (no regression)", () => {
    const res = scrapeFixture("https://x.com/home", quoteTweetHtml);
    expect(res.posts.map((p) => p.contentUrl).sort()).toEqual([
      "https://pbs.twimg.com/media/OWN?format=jpg&name=orig",
      "https://pbs.twimg.com/media/QUOTED?format=jpg&name=orig",
    ].sort());
  });
});

describe("element grab: video-only tweet is skipped", () => {
  const html = `<html><body>
    <article data-testid="tweet" tabindex="0">
      <div data-testid="User-Name">
        <a href="/ArtistOne"><span>Artist One</span></a>
        <a href="/ArtistOne/status/333"><time datetime="2026-10-19T02:30:00.000Z">6h</time></a>
      </div>
      <div data-testid="tweetPhoto">
        <div data-testid="placementTracking">
          <div data-testid="videoPlayer">
            <video preload="none" playsinline="" aria-label="Embedded video" poster="https://pbs.twimg.com/amplify_video_thumb/999/img/abc.jpg" src="blob:https://x.com/4b20164f-79d1-4da5-b72f-0be72e8e18cf"></video>
          </div>
        </div>
      </div>
    </article>
    </body></html>`;

  it("yields zero posts (blob: can never upload; mp4 resolution is API-resolver territory)", () => {
    const res = scrapeElementFixture("https://x.com/home", html, "[data-testid='videoPlayer']");
    expect(res.posts.length).toBe(0);
  });
});

describe("element grab: tweet with both photo and video player", () => {
  const html = `<html><body>
    <article data-testid="tweet" tabindex="0">
      <div data-testid="User-Name"><a href="/ArtistOne"><span>Artist One</span></a></div>
      <a role="link" href="/ArtistOne/status/111/photo/1"><div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/AAA?format=jpg&amp;name=small"></div></a>
      <div data-testid="tweetPhoto">
        <div data-testid="placementTracking"><div data-testid="videoPlayer"><video src="blob:https://x.com/x"></video></div></div>
      </div>
    </article>
    </body></html>`;

  it("grabs the photo and ignores the unresolvable video", () => {
    const res = scrapeElementFixture("https://x.com/home", html, "img");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/AAA?format=jpg&name=orig");
  });
});

const lightboxHtml = `<html><body>
  <div role="dialog">
    <div data-testid="swipe-to-dismiss">
      <div aria-label="Image"><img alt="Image" src="https://pbs.twimg.com/media/HU1?format=jpg&amp;name=large"></div>
    </div>
    <article data-testid="tweet" tabindex="0">
      <div data-testid="User-Name">
        <a href="/ArtistOne"><span>Artist One</span></a>
        <a href="/ArtistOne/status/111"><time datetime="2026-10-19T07:00:02.000Z">2h</time></a>
      </div>
      <div><a href="/ArtistOne/status/111/hashtag/Artnight"><span>#Artnight</span></a></div>
    </article>
    <article data-testid="tweet" tabindex="0">
      <div data-testid="User-Name">
        <a href="/ArtistTwo"><span>Artist Two</span></a>
        <a href="/ArtistTwo/status/222"><time datetime="2026-10-19T06:00:00.000Z">3h</time></a>
      </div>
      <a role="link" href="/ArtistTwo/status/222/photo/1"><div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/REPLY?format=jpg&amp;name=small"></div></a>
      <div><a href="/ArtistTwo/status/222/hashtag/ReplyTag"><span>#ReplyTag</span></a></div>
    </article>
  </div>
  </body></html>`;

describe("element grab: photo lightbox", () => {
  let res: ScrapeResults;

  beforeAll(() => {
    // The focused image lives in the media pane, outside every article.
    res = scrapeElementFixture("https://x.com/ArtistOne/status/111/photo/1", lightboxHtml, "img[alt='Image']");
  });

  it("grabs exactly the focused image (the reply thread must not leak in)", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/HU1?format=jpg&name=orig");
  });

  it("metadata comes from the dialog's first article (the focused tweet)", () => {
    expect(res.posts[0]).toHaveTag("artistone", "artist");
    expect(res.posts[0]).toHaveTag("artnight");
    expect(res.posts[0]).toHaveSource("https://x.com/ArtistOne/status/111");
    expect(res.posts[0].tags.find((x) => x.name == "artisttwo")).toBeUndefined();
    expect(res.posts[0].tags.find((x) => x.name == "replytag")).toBeUndefined();
  });
});

describe("element grab: replying to a tweet inside the lightbox thread", () => {
  it("resolves the clicked reply article, not the dialog", () => {
    const res = scrapeElementFixture(
      "https://x.com/ArtistOne/status/111/photo/1",
      lightboxHtml,
      "article:nth-of-type(2) img[src*='REPLY']",
    );
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://pbs.twimg.com/media/REPLY?format=jpg&name=orig");
    expect(res.posts[0]).toHaveTag("artisttwo", "artist");
    expect(res.posts[0]).toHaveSource("https://x.com/ArtistTwo/status/222");
  });
});

describe("findPostContainer routing", () => {
  const engine = new Twitter();
  const dom = new JSDOM(`<html><body>${quoteTweetHtml.replace(/^<html><body>/, "").replace(/<\/body><\/html>$/, "")}</body></html>`, {
    url: "https://x.com/home",
  });
  const doc = dom.window.document;

  it("prefers the quote card over the outer article", () => {
    const img = doc.querySelector("[data-testid='testCondensedMedia'] img")!;
    expect(engine.findPostContainer!(img)).toBe(doc.querySelector("[data-testid='testCondensedMedia']"));
  });

  it("returns the tweet article for its own media", () => {
    const img = doc.querySelector("img[src*='OWN']")!;
    expect(engine.findPostContainer!(img)).toBe(doc.querySelector("article[data-testid='tweet']"));
  });

  it("falls back to the dialog for lightbox media-pane clicks", () => {
    const lightbox = new JSDOM(lightboxHtml, { url: "https://x.com/x" }).window.document;
    const img = lightbox.querySelector("img[alt='Image']")!;
    expect(engine.findPostContainer!(img)).toBe(lightbox.querySelector("div[role='dialog']"));
  });

  it("returns null outside any post container", () => {
    const stray = new JSDOM("<html><body><div><span>nothing</span></div></body></html>", { url: "https://x.com/home" }).window.document;
    expect(engine.findPostContainer!(stray.querySelector("span")!)).toBeNull();
  });
});
