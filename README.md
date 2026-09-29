# neo-scraper

Scrape a booru-like post object from the DOM.

## Supported sites

| Engine | Sites | Features | Notes |
|---|---|---|---|
| animepictures | anime-pictures.net | content, resolution, tags, tag_category | Rating is assumed to be safe. |
| bluesky | bsky.app | content |  |
| danbooru | danbooru.donmai.us, safebooru.donmai.us, sonohara.donmai.us, hijiribe.donmai.us | content, rating, resolution, tags, tag_category, source, notes |  |
| e621 | e621.net, e926.net, e6ai.net | content, rating, resolution, tags, tag_category, source |  |
| E-hentai | e-hentai.org, exhentai.org | content, resolution, extra_content, cookies | Rating is assumed to be unsafe. |
| furaffinity | furaffinity.net | content, rating, resolution, tags, tag_category |  |
| gelbooru | safebooru.org, gelbooru.com, rule34.xxx, tbib.org, xbooru.com, mspabooru.com, hypnohub.net | content, rating, resolution, tags, tag_category, source, notes | Supported features might vary between hosts. |
| inkbunny | inkbunny.net | content, rating, resolution, tags |  |
| lofter | lofter.com | content, tags, tag_category, source | Only scrapes post permalinks (…lofter.com/post/…), not the dashboard or blog feeds. The artist tag is derived from the blog's subdomain. Multi-image posts are scraped as multiple posts. |
| moebooru | yande.re, konachan.com, konachan.net, sakugabooru.com, img.genshiken-itb.org | content, rating, resolution, tags, tag_category, source, notes |  |
| nozomi | nozomi.la | content, tags, tag_category | Image preview might not work due to hotlink protection. |
| Philomena | derpibooru.org, trixiebooru.org, ponybooru.org, furbooru.org, ponerpics.org, manebooru.art, twibooru.org | content, rating, resolution, tags, tag_category, source |  |
| pixiv | pixiv.net | content, rating, tags, tag_category, source | Artist names are scraped as artist tags, artwork tags are scraped as untagged tags. |
| reddit | reddit.com, new.reddit.com, old.reddit.com | content |  |
| rule34us | rule34.us | content, resolution, tags, tag_category | Rating is assumed to be unsafe. |
| sankakucomplex | chan.sankakucomplex.com | content, rating, tags, tag_category, notes |  |
| shimmie2 | rule34.paheal.net, rule34hentai.net | content, tags, source | Rating is assumed to be unsafe. |
| shuushuu | e-shuushuu.net | content, rating, resolution, tags, tag_category | Rating is assumed to be safe. |
| twitter | twitter.com, mobile.twitter.com, x.com | content, tags, tag_category, source | Hashtags become tags and the author's handle becomes an artist tag. X redesigns its DOM frequently, so this engine can break at any time. |
| weibo | weibo.com, weibo.cn, weibo.com.cn | content, tags, tag_category, source | Only scrapes status permalinks (weibo.com/<uid>/<bid>, m.weibo.cn/status/…, m.weibo.cn/detail/…). The author's display name becomes an artist tag. Weibo redesigns its DOM often, so this engine can break at any time. Multi-image posts are scraped as multiple posts. |
| xiaohongshu | xiaohongshu.com | content, tags, tag_category, source | Scrapes note pages via the page's embedded __INITIAL_STATE__ JSON, falls back to og:image. The author's nickname becomes an artist tag. Xiaohongshu changes its internals often, so this engine can break at any time. Multi-image notes are scraped as multiple posts. |
| zerochan | zerochan.net | content, resolution, tags, tag_category | Rating is assumed to be safe. |
| fallback |  | content | Tries to find the largest image or video on the current page. |

## Development

Build SzuruChrome with your local version of neo-scraper.

```sh
cd neo-scraper
pnpm install
pnpm build # or pnpm watch in another terminal
pnpm link --global
cd ../SzuruChrome
pnpm link --global neo-scraper
pnpm dev
```
