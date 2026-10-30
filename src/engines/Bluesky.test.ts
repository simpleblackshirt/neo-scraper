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
    expect(res.posts[0]).toHaveTag("shannahc", "artist");
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
      expect(post).toHaveTag("simply0silver", "artist");
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
    expect(res.posts[0]).toHaveTag("artista", "artist");

    expect(res.posts[1].tags.find((x) => x.name == "caturday")).toBeUndefined();
    expect(res.posts[1]).toHaveTag("artistb", "artist");
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
    expect(res.posts[0]).toHaveTag("shannahc", "artist");
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
    expect(res.posts[0]).toHaveTag("shirohunter", "artist");
  });

  it("carries the canonical permalink as source and pageUrl", () => {
    const permalink = "https://bsky.app/profile/shirohunter.bsky.social/post/3mymm7qawlc2q";
    expect(res.posts[0]).toHaveSource(permalink);
    expect(res.posts[0].pageUrl).toBe(permalink);
  });

  it("resolves the same post when the post text is clicked", () => {
    const res = scrapeElementFixture("https://bsky.app/", timelinePostHtml, "[data-testid='postText']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0]).toHaveTag("shirohunter", "artist");
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
      expect(post).toHaveTag("violetolya", "artist");
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

describe("element grab: permalink page with liked-by links", () => {
  // Live e2e round 2 finding: on a post's own page the artist tag came from
  // the "Liked by <liker>" link instead of the author. The author is derived
  // from the page handle (/profile/<handle>/post/<id>), never from ambient
  // profile links.
  const pageUrl = "https://bsky.app/profile/author.bsky.social/post/3mauthorpost1";
  const html = `<html><body>
    <div data-testid="postThreadItem-by-author.bsky.social">
      <a href="/profile/liker.bsky.social"><span>Liked by liker</span></a>
      <img data-testid="userAvatarImage" src="https://cdn.bsky.app/img/avatar_thumbnail/plain/did:plc:author/bafkreiavatar">
      <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:author/bafkreiart"></div></div>
      <a href="/profile/author.bsky.social/post/3mauthorpost1/liked-by"><span>12 likes</span></a>
    </div>
    </body></html>`;

  it("resolves the artist from the page handle, not the liked-by link", () => {
    const res = scrapeElementFixture(pageUrl, html, "img[src*='feed_thumbnail']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0]).toHaveTag("author", "artist");
    expect(res.posts[0].tags.find((x) => x.name == "liker")).toBeUndefined();
    expect(res.posts[0].sources).toEqual([]);
    expect(res.posts[0].pageUrl).toBe(pageUrl);
  });
});

describe("element grab: viewer with the underlying post rendered behind", () => {
  const permalink = "https://bsky.app/profile/author.bsky.social/post/3mpost";
  const html = `<html><body>
    <div>
      <a href="/profile/author.bsky.social"><span>Author</span></a>
      <a href="/profile/author.bsky.social/post/3mpost"><span>1h</span></a>
      <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:author/bafkreiart"></div></div>
      <div role="dialog">
        <img src="https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:author/bafkreiart">
      </div>
    </div>
    </body></html>`;

  it("resolves the underlying post's scope for full metadata", () => {
    // The viewer image and the post's thumbnail share the blob id
    // (bafkreiart) - the grab reuses the real post scope.
    const res = scrapeElementFixture("https://bsky.app/", html, "div[role='dialog'] img");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:author/bafkreiart");
    expect(res.posts[0]).toHaveTag("author", "artist");
    expect(res.posts[0]).toHaveSource(permalink);
    expect(res.posts[0].pageUrl).toBe(permalink);
  });
});

describe("toolbar grab with the viewer dialog open (fixture)", () => {
  const permalink = "https://bsky.app/profile/author.bsky.social/post/3mpost";
  const thumb = "https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:author/bafkreiart";
  const fullsize = "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:author/bafkreiart";
  const html = `<html><body>
    <div>
      <a href="/profile/author.bsky.social"><span>Author</span></a>
      <a href="/profile/author.bsky.social/post/3mpost"><span>1h</span></a>
      <div><div><img src="${thumb}"></div></div>
      <div role="dialog">
        <img src="${fullsize}">
      </div>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture("https://bsky.app/", html);
  });

  it("matches the underlying post by blob id for artist and source", () => {
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe(fullsize);
    expect(res.posts[0]).toHaveTag("author", "artist");
    expect(res.posts[0]).toHaveSource(permalink);
    expect(res.posts[0].pageUrl).toBe(permalink);
  });
});

describe("element grab: viewer without the underlying post rendered", () => {
  const pageUrl = "https://bsky.app/profile/author.bsky.social/post/3mpost";
  const fullsizeUrl = "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:author/bafkreilightbox";
  const html = `<html><body>
    <div role="dialog">
      <img src="${fullsizeUrl}">
    </div>
    </body></html>`;

  it("falls back to a content-only post", () => {
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

describe("element grab: quote card is its own target", () => {
  // Live finding: quote cards render no links/testids, but the card wrapper
  // carries the quoted author's handle in an aria-label
  // (div[role="link"][aria-label="Post by <handle>"]).
  const html = `<html><body>
    <div>
      <a href="/profile/outerauthor.bsky.social"><span>Outer</span></a>
      <a href="/profile/outerauthor.bsky.social/post/3mt4vxpaw5k2f"><span>1h</span></a>
      <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:outer/bafkreiown"></div></div>
      <div role="link" aria-label="Post by b4dc84.bsky.social" tabindex="0">
        <img data-testid="userAvatarImage" src="https://cdn.bsky.app/img/avatar_thumbnail/plain/did:plc:quoted/bafkreiavatar">
        <div><span>quoted text</span></div>
        <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:quoted/bafkreiqtd"></div></div>
      </div>
    </div>
    </body></html>`;

  it("grabs the quoted post when the quoted media is clicked", () => {
    const res = scrapeElementFixture("https://bsky.app/", html, "img[src*='bafkreiqtd']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:quoted/bafkreiqtd");
    // Handle comes from the card's aria-label, .bsky.social stripped.
    expect(res.posts[0]).toHaveTag("b4dc84", "artist");
    // The card renders no post id - the profile url is the best source available.
    expect(res.posts[0]).toHaveSource("https://bsky.app/profile/b4dc84.bsky.social");
    expect(res.posts[0].pageUrl).toBe("https://bsky.app/profile/b4dc84.bsky.social");
  });

  it("grabs the quoted post when the quoted text is clicked", () => {
    const res = scrapeElementFixture("https://bsky.app/", html, "div[role='link'] > div > span");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0]).toHaveTag("b4dc84", "artist");
  });

  it("excludes quoted media from the outer post's grab", () => {
    const res = scrapeElementFixture("https://bsky.app/", html, "img[src*='bafkreiown']");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:outer/bafkreiown");
    expect(res.posts[0]).toHaveTag("outerauthor", "artist");
    expect(res.posts[0]).toHaveSource("https://bsky.app/profile/outerauthor.bsky.social/post/3mt4vxpaw5k2f");
  });
});

describe("element grab: viewer dialog nested in the app tree", () => {
  // Live e2e round 1 finding: the walk climbed out of the dialog into the
  // feed behind it and returned the whole timeline. The dialog check must
  // come first.
  const pageUrl = "https://bsky.app/";
  const html = `<html><body>
    <div>
      <a href="/profile/timelineuser.bsky.social"><span>Timeline User</span></a>
      <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:timeline/bafkreitl"></div></div>
      <div role="dialog">
        <img src="https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:viewer/bafkreilightbox">
      </div>
    </div>
    </body></html>`;

  it("grabs only the viewer image, never the feed behind the dialog", () => {
    const res = scrapeElementFixture(pageUrl, html, "div[role='dialog'] img");
    expect(res.posts.length).toBe(1);
    expect(res.posts[0].contentUrl).toBe("https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:viewer/bafkreilightbox");
    expect(res.posts[0].tags).toEqual([]);
  });
});

describe("toolbar grab on a post page with the feed still mounted (fixture)", () => {
  // Live probe (2026-10-30): a post permalink page carried 116 feed images -
  // the stale timeline mounted under the thread view. The scrape must
  // restrict itself to the focused post's thread item.
  const pageUrl = "https://bsky.app/profile/focused.bsky.social/post/3mfocused1";
  const html = `<html><body>
    <div>
      <img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:stale/bafkreistale">
      <div>
        <div data-testid="postThreadItem-by-focused.bsky.social">
          <a href="/profile/focused.bsky.social"><span>Focused</span></a>
          <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:focused/bafkreiown"></div></div>
        </div>
        <div data-testid="postThreadItem-by-replier.bsky.social">
          <a href="/profile/replier.bsky.social"><span>Replier</span></a>
          <div><div><img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:replier/bafkreireply"></div></div>
        </div>
      </div>
    </div>
    </body></html>`;
  let res: ScrapeResults;

  beforeAll(() => {
    res = scrapeFixture(pageUrl, html);
  });

  it("grabs only the focused post, not the mounted feed or the replies", () => {
    expect(res.posts.map((p) => p.contentUrl)).toEqual([
      "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:focused/bafkreiown",
    ]);
    expect(res.posts[0]).toHaveTag("focused", "artist");
    expect(res.posts[0].pageUrl).toBe(pageUrl);
  });

  it("falls back to the whole document when the focused item is missing", () => {
    const res = scrapeFixture(pageUrl, html.replace(' data-testid="postThreadItem-by-focused.bsky.social"', ""));
    // Legacy behavior: one post per feed image (stale feed included).
    expect(res.posts.length).toBe(3);
  });
});
