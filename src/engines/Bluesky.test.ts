import { ScrapeResults } from "../ScrapeEngine.js";
import { scrapeFixture } from "../test/fixture.js";

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
