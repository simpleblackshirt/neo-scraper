import { ScrapeResults } from "../ScrapeEngine.js";
import { scrapeElementFixture, scrapeFixture } from "../test/fixture.js";

describe("get bsky.app post (fixture)", () => {
  const pageUrl = "https://bsky.app/profile/shannahc.bsky.social/post/3mxrucz4mqs2k";
  const thumbUrl =
    "https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:gaq4visjohjdxfn3apanofiy/bafkreid5zuvgz6hh4jvptnd23jx4wqztvdw2uop6ees3wtvfoh3wylu3ji";
  const html = `<html><body>
    <div>
      <a href="/profile/shannahc.bsky.social"></a>
      <a href="/profile/shannahc.bsky.social"><span>ShannahC@shannahc.bsky.social</span></a>
      <div>Tuezday is Sneuzday.
        <a href="/hashtag/blackcatbookclub">#blackcatbookclub</a>
        <a href="/hashtag/blackcats">#blackcats</a>
        <a href="/hashtag/adoptdontshop">#adoptdontshop</a>
        <a href="/hashtag/catsofbluesky">#catsofbluesky</a>
      </div>
      <div><button><div><img src="${thumbUrl}"></div></button></div>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("should grab fullsize image url", () => {
    expect(res.posts[0].contentUrl).toBe(thumbUrl.replace("/feed_thumbnail/", "/feed_fullsize/"));
  });

  it("should have the hashtags as tags", () => {
    expect(res.posts[0]).toHaveTag("blackcatbookclub");
    expect(res.posts[0]).toHaveTag("blackcats");
    expect(res.posts[0]).toHaveTag("adoptdontshop");
    expect(res.posts[0]).toHaveTag("catsofbluesky");
  });

  it("should have the author handle as artist tag", () => {
    expect(res.posts[0]).toHaveTag("shannahc.bsky.social", "artist");
  });
});

describe("get bsky.app post with encoded hashtag (fixture)", () => {
  const pageUrl = "https://bsky.app/profile/neko.example.com/post/3mtestpostaaa1";
  const html = `<html><body>
    <div>
      <a href="/profile/neko.example.com"><span>ねこ</span></a>
      <div>うちの<a href="/hashtag/%E3%83%8D%E3%82%B3">#ネコ</a>です</div>
      <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:neko/bafkreineko"></div></div>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should decode the hashtag from the link href", () => {
    expect(res.posts[0]).toHaveTag("ネコ");
  });
});

describe("get bsky.app multi-image post (fixture)", () => {
  const pageUrl = "https://bsky.app/profile/simply0silver.bsky.social/post/3mxrulztlac25";
  const html = `<html><body>
    <div>
      <a href="/profile/simply0silver.bsky.social"><span>SimplySilver@simply0silver.bsky.social</span></a>
      <div>look at my son
        <a href="/hashtag/cat">#cat</a>
        <a href="/hashtag/pets">#pets</a>
        <a href="/hashtag/art">#art</a>
      </div>
      <div>
        <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:silver/bafkreione"></div></div>
        <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:silver/bafkreitwo"></div></div>
      </div>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find one post per image", () => {
    expect(res.posts.length).toBe(2);
  });

  it("should apply the same tags to every image of the post", () => {
    for (const post of res.posts) {
      expect(post).toHaveTag("cat");
      expect(post).toHaveTag("pets");
      expect(post).toHaveTag("art");
      expect(post).toHaveTag("simply0silver.bsky.social", "artist");
    }
  });
});

describe("get bsky.app feed without leaking tags between posts (fixture)", () => {
  const pageUrl = "https://bsky.app/profile/artista.bsky.social";
  const html = `<html><body>
    <div>
      <a href="/profile/artista.bsky.social"><span>Artist A</span></a>
      <div>my cat <a href="/hashtag/caturday">#caturday</a></div>
      <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:a/bafkreiaaa"></div></div>
    </div>
    <div>
      <a href="/profile/artistb.bsky.social"><span>Artist B</span></a>
      <div>no tags here</div>
      <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:b/bafkreibbb"></div></div>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should find one post per image", () => {
    expect(res.posts.length).toBe(2);
  });

  it("should only apply tags from the post that owns each image", () => {
    expect(res.posts[0]).toHaveTag("caturday");
    expect(res.posts[0]).toHaveTag("artista.bsky.social", "artist");

    expect(res.posts[1].tags.find((x) => x.name == "caturday")).toBeUndefined();
    expect(res.posts[1]).toHaveTag("artistb.bsky.social", "artist");
  });
});

describe("get bsky.app fullscreen post (fixture)", () => {
  const pageUrl = "https://bsky.app/profile/shannahc.bsky.social/post/3mxrucz4mqs2k";
  const fullsizeUrl =
    "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:gaq4visjohjdxfn3apanofiy/bafkreid5zuvgz6hh4jvptnd23jx4wqztvdw2uop6ees3wtvfoh3wylu3ji";
  const html = `<html><body>
    <div>
      <a href="/profile/shannahc.bsky.social"><span>ShannahC@shannahc.bsky.social</span></a>
      <div>hidden behind the lightbox
        <a href="/hashtag/blackcats">#blackcats</a>
      </div>
      <div><div><img src="${fullsizeUrl.replace("/feed_fullsize/", "/feed_thumbnail/")}"></div></div>
    </div>
    <div>
      <a href="/profile/shannahc.bsky.social"><span>ShannahC@shannahc.bsky.social</span></a>
      <div>lightbox view
        <a href="/hashtag/blackcatbookclub">#blackcatbookclub</a>
      </div>
      <div><div><img src="${fullsizeUrl}"></div></div>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should only grab the fullscreen image", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe(fullsizeUrl);
  });

  it("should grab the tags of the fullscreen post", () => {
    expect(res.posts[0]).toHaveTag("blackcatbookclub");
    expect(res.posts[0]).toHaveTag("shannahc.bsky.social", "artist");
  });
});

describe("get bsky.app post without author header (fixture)", () => {
  const pageUrl = "https://bsky.app/profile/orphan.bsky.social/post/3morphanpost01";
  const html = `<html><body>
    <div>
      <div>text with <a href="/hashtag/orphan">#orphan</a> but no author link</div>
      <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:orphan/bafkreiorp"></div></div>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("should still grab the content url", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe(
      "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:orphan/bafkreiorp"
    );
  });

  it("should not guess tags without a post scope", () => {
    expect(res.posts[0].tags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Element grabs (context menu). Structures from live captures (2026-10-19,
// logged-in bsky.app desktop): see SzuruImporter
// docs/plan/20261018-element-context-grab/dom-notes/bluesky.md.
// ---------------------------------------------------------------------------

const timelinePostHtml = `<html><body>
  <div class="css-g5y9jx r-13awgt0">
    <a href="/profile/shirohunter.bsky.social"><span>shiro</span></a>
    <a href="/profile/shirohunter.bsky.social/post/3mymm7qawlc2q"><span>2h</span></a>
    <div lang="ja" data-testid="postText"><span>art post</span></div>
    <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:kh5pgiqrbrthfopzb7lubzm4/bafkreidyfltl4obb46mj"></div></div>
  </div>
  </body></html>`;

describe("element grab: single-image timeline post", () => {
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeElementFixture("https://bsky.app/", timelinePostHtml, "img");
  });

  it("finds exactly one post", () => {
    expect(res.posts.length).toBe(1);
  });

  it("grabs the fullsize rendition, not the thumbnail", () => {
    expect(res.posts[0].contentUrl).toBe(
      "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:kh5pgiqrbrthfopzb7lubzm4/bafkreidyfltl4obb46mj"
    );
  });

  it("carries the handle as artist tag", () => {
    expect(res.posts[0]).toHaveTag("shirohunter.bsky.social", "artist");
  });

  it("carries the canonical permalink as source and pageUrl", () => {
    const permalink = "https://bsky.app/profile/shirohunter.bsky.social/post/3mymm7qawlc2q";
    expect(res.posts[0]).toHaveSource(permalink);
    expect(res.posts[0].pageUrl).toBe(permalink);
  });

  it("resolves the same post when the post text is clicked", () => {
    const res = scrapeElementFixture("https://bsky.app/", timelinePostHtml, "[data-testid='postText']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0]).toHaveTag("shirohunter.bsky.social", "artist");
  });
});

describe("element grab: multi-image timeline post", () => {
  const html = `<html><body>
    <div class="css-g5y9jx r-13awgt0">
      <a href="/profile/violetolya.bsky.social"><span>Violet</span></a>
      <a href="/profile/violetolya.bsky.social/post/3mynqjvuokc2k"><span>1d</span></a>
      <div data-testid="postText"><span>three cats <a href="/hashtag/Arknights">#Arknights</a></span></div>
      <div>
        <div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:violet/bafkreione"></div>
        <div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:violet/bafkreitwo"></div>
        <div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:violet/bafkreithree"></div>
      </div>
    </div>
    </body></html>`;

  it("returns every image of the post, all in fullsize", () => {
    // Right-clicking ANY of the three images returns the whole post.
    const res = scrapeElementFixture("https://bsky.app/", html, "img[src*='bafkreitwo']");
    expect(res.posts.map((p) => p.contentUrl)).toEqual([
      "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:violet/bafkreione",
      "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:violet/bafkreitwo",
      "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:violet/bafkreithree",
    ]);
    for (const post of res.posts) {
      expect(post).toHaveTag("violetolya.bsky.social", "artist");
      expect(post).toHaveTag("arknights");
      expect(post).toHaveSource("https://bsky.app/profile/violetolya.bsky.social/post/3mynqjvuokc2k");
    }
  });
});

describe("element grab: post permalink page", () => {
  const pageUrl = "https://bsky.app/profile/shirohunter.bsky.social/post/3mymm7qawlc2q";
  const html = `<html><body>
    <div data-testid="postThreadItem-by-shirohunter.bsky.social">
      <img data-testid="userAvatarImage" src="https://cdn.bsky.app/img/avatar_thumbnail/plain/did:plc:x/bafkreiavatar">
      <a href="/profile/shirohunter.bsky.social"><span>shiro</span></a>
      <a href="/profile/shirohunter.bsky.social/post/3mymm7qawlc2q/liked-by"><span>12 likes</span></a>
      <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:kh5pgiqrbrthfopzb7lubzm4/bafkreidyfltl4obb46mj"></div></div>
    </div>
    </body></html>`;

  it("excludes avatar images and falls back to the page url", () => {
    const res = scrapeElementFixture(pageUrl, html, "img[src*='feed_thumbnail']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe(
      "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:kh5pgiqrbrthfopzb7lubzm4/bafkreidyfltl4obb46mj"
    );
    // Only a /liked-by sub-page link exists here, which is not a permalink:
    // the page itself IS the canonical url.
    expect(res.posts[0].sources).toEqual([]);
    expect(res.posts[0].pageUrl).toBe(pageUrl);
  });
});

describe("element grab: fullscreen image viewer dialog", () => {
  const pageUrl = "https://bsky.app/profile/shirohunter.bsky.social/post/3mymm7qawlc2q";
  const fullsizeUrl =
    "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:kh5pgiqrbrthfopzb7lubzm4/bafkreidyfltl4obb46mjtccoli4pmib";
  const html = `<html><body>
    <div role="dialog">
      <img src="${fullsizeUrl}">
    </div>
    </body></html>`;

  it("grabs the focused image as a content-only post (dialog renders no metadata)", () => {
    const res = scrapeElementFixture(pageUrl, html, "div[role='dialog'] img");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe(fullsizeUrl);
    expect(res.posts[0].tags).toEqual([]);
    expect(res.posts[0].pageUrl).toBe(pageUrl);
  });
});

describe("element grab: avatar clicks yield nothing", () => {
  const html = `<html><body>
    <div>
      <a href="/profile/shirohunter.bsky.social"><img data-testid="userAvatarImage" src="https://cdn.bsky.app/img/avatar_thumbnail/plain/did:plc:x/bafkreiavatar"></a>
    </div>
    </body></html>`;

  it("produces no post for avatar-only scopes", () => {
    const res = scrapeElementFixture("https://bsky.app/", html, "img");
    expect(res.posts.length).toBe(0);
  });
});

describe("element grab: quoted posts cannot be grabbed independently", () => {
  // Live finding: quote cards render without any links or metadata, so the
  // walk scopes to the outer post and quoted media stays included. Pinned as
  // the documented limitation (parity with the document scrape).
  const html = `<html><body>
    <div>
      <a href="/profile/outerauthor.bsky.social"><span>Outer</span></a>
      <a href="/profile/outerauthor.bsky.social/post/3mt4vxpaw5k2f"><span>1h</span></a>
      <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:outer/bafkreiown"></div></div>
      <div>
        <span>@quoted.bsky.social</span>
        <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:quoted/bafkreiqtd"></div></div>
      </div>
    </div>
    </body></html>`;

  it("returns outer and quoted media with the outer post's metadata", () => {
    const res = scrapeElementFixture("https://bsky.app/", html, "img[src*='bafkreiqtd']");
    expect(res.posts.map((p) => p.contentUrl).sort()).toEqual([
      "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:outer/bafkreiown",
      "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:quoted/bafkreiqtd",
    ].sort());
    for (const post of res.posts) {
      expect(post).toHaveTag("outerauthor.bsky.social", "artist");
      expect(post).toHaveSource("https://bsky.app/profile/outerauthor.bsky.social/post/3mt4vxpaw5k2f");
    }
  });
});
