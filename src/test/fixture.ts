import { JSDOM, ConstructorOptions } from "jsdom";
import NeoScraper from "../NeoScraper.js";

/**
 * Scrapes a static HTML fixture without executing any client-side code.
 */
export function scrapeFixture(url: string, html: string) {
  const dom = new JSDOM(html, <ConstructorOptions>{ url });
  const scraper = new NeoScraper();
  return scraper.scrapeDocument(dom.window.document);
}
