export { default as NeoScraper } from "./NeoScraper.js";
export * from "./ScrapeEngine.js";
export { downgradeSinaImageUrl } from "./engines/Weibo.js";
// Pure url-string helpers consumed by the extension's tier-1 media-URL
// rewrite resolvers (background context - no DOM available there).
export { getOriginalImageUrlFromUrl } from "./engines/Twitter.js";
export { upgradeSinaImageUrl } from "./engines/Weibo.js";
export { upgradeToOriginalQuality } from "./engines/Lofter.js";

import * as Engines from "./ScrapeEngine.js";
export { Engines };

import * as BooruTypes from "./BooruTypes.js";
export { BooruTypes };
