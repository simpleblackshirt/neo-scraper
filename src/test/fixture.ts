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

/**
 * Scrapes the post container around the element matched by targetSelector in a
 * static HTML fixture (element-scoped grab path).
 */
export function scrapeElementFixture(url: string, html: string, targetSelector: string) {
  const dom = new JSDOM(html, <ConstructorOptions>{ url });
  const target = dom.window.document.querySelector(targetSelector);
  if (!target) {
    throw new Error(`Fixture has no element matching '${targetSelector}'.`);
  }
  const scraper = new NeoScraper();
  return scraper.scrapeElement(target);
}
