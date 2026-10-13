import { JSDOM, ConstructorOptions } from "jsdom";
import NeoScraper from "../NeoScraper.js";

export const MobileUserAgent = "Mozilla/5.0 (Android 12; Mobile; rv:68.0) Gecko/68.0 Firefox/103.0";

/**
 * Go to an URL and parse it's raw HTML without executing any client-side code.
 * @param url
 * @returns
 */
export async function scrapeUrl(url: string) {
  const dom = await JSDOM.fromURL(url, <ConstructorOptions>{
    userAgent: "PostmanRuntime/7.37.3",
  });
  return scrapeDom(dom.window.document);
}

/**
 * Go to an URL and evaluate the page using Puppeteer.
 * @param url
 * @param waitForSelector
 * @returns
 */
export async function scrapeEvalUrl(
  url: string,
  waitForSelector: string,
  userAgent: string | undefined = "PostmanRuntime/7.37.3"
) {
  await jestPuppeteer.resetPage();

  if (userAgent) {
    page.setUserAgent(userAgent);
  }

  await page.goto(url);

  const res = await page.waitForSelector(waitForSelector, { visible: true, timeout: 10_000 });
  if (res == null) throw new Error("waitForSelector timed out.");

  return scrapePage(url, page);
}

export async function scrapePage(url: string, page: any) {
  const document = await page.content();
  return scrapeHtml(url, document);
}

async function scrapeHtml(url: string, html: string) {
  const dom = new JSDOM(html, <ConstructorOptions>{ url });
  return scrapeDom(dom.window.document);
}

async function scrapeDom(document: Document) {
  // jsdom >= 16 uses per-window interfaces, so the innerText polyfill from
  // jest.setup.ts (defined on one throwaway instance) does not reach documents
  // created here. Re-apply it to this document's realm.
  // See https://github.com/jsdom/jsdom/issues/1245
  const win = document.defaultView;
  if (win && !Object.getOwnPropertyDescriptor(win.Element.prototype, "innerText")) {
    Object.defineProperty(win.Element.prototype, "innerText", {
      get(this: Element) {
        return this.textContent?.replace(/(\r\n|\n|\r|^\s+|\s+$)/gm, "") ?? "";
      },
      configurable: true,
    });
  }

  const scraper = new NeoScraper();
  return scraper.scrapeDocument(document);
}
