/**
 * gengar/src/ahmia.js
 * ─────────────────────────────────────────────────────────────────
 * Queries the Ahmia .onion search engine using Playwright over Tor SOCKS5.
 * Using a real browser engine maintains the persistent session, cookies,
 * and circuit needed to pass Ahmia's anti-bot token verification.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const cheerio       = require('cheerio');
const { chromium }  = require('playwright');

const AHMIA_ONION_BASE =
  'http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion';

const TOR_SOCKS = process.env.TOR_SOCKS || 'socks5h://127.0.0.1:9050';

let browserPromise = null;
let activeSearches = 0;
const MAX_CONCURRENT_SEARCHES = 2;
const searchQueue = [];

function acquireSlot() {
  if (activeSearches < MAX_CONCURRENT_SEARCHES) {
    activeSearches++;
    return Promise.resolve();
  }
  return new Promise(resolve => searchQueue.push(resolve));
}

function releaseSlot() {
  activeSearches--;
  if (searchQueue.length > 0) {
    activeSearches++;
    const next = searchQueue.shift();
    next();
  }
}

/**
 * closeBrowser()
 * Closes the Playwright browser cleanly to avoid zombie processes.
 */
async function closeBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch (_) {}
    browserPromise = null;
  }
}

/**
 * getBrowser()
 * Returns a shared Playwright Chromium instance routing through Tor SOCKS5.
 */
async function getBrowser() {
  if (!browserPromise) {
    const proxyServer = TOR_SOCKS.replace(/^socks5h:\/\//, 'socks5://');
    browserPromise = chromium.launch({
      headless: true,
      proxy: { server: proxyServer },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }).catch(err => {
      browserPromise = null;
      throw err;
    });
  }

  const browser = await browserPromise;
  if (!browser.isConnected()) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

/**
 * parseAhmiaResults(html)
 * Parses Ahmia search results HTML and extracts .onion URLs + titles.
 *
 * @param {string} html
 * @returns {{ title: string, onion: string, description: string }[]}
 */
function parseAhmiaResults(html) {
  const $       = cheerio.load(html);
  const results = [];

  $('li.result').each((_, el) => {
    const $el     = $(el);
    const title   = $el.find('h4, h3, .title').first().text().trim() || 'Untitled';
    const desc    = $el.find('p, .description').first().text().trim() || '';
    const rawHref = $el.find('a').first().attr('href') || '';
    let onion = '';

    try {
      if (rawHref.includes('redirect_url=')) {
        const qs = new URL(rawHref, AHMIA_ONION_BASE);
        onion    = qs.searchParams.get('redirect_url') || '';
      } else if (rawHref.includes('.onion')) {
        onion = rawHref;
      }
    } catch (_) {
      onion = rawHref;
    }

    if (!onion) {
      const cite = $el.find('cite').first().text().trim();
      if (cite.includes('.onion')) {
        onion = cite.startsWith('http') ? cite : `http://${cite}/`;
      }
    }

    if (onion && onion.includes('.onion')) {
      results.push({ title, onion, description: desc });
    }
  });

  return results;
}

/**
 * searchAhmia(query, options?)
 * Searches Ahmia .onion via Playwright browser session.
 *
 * @param {string} query
 * @param {{ page?: number, timeout?: number }} [options]
 * @returns {Promise<{ query: string, source: string, results: object[] }>}
 */
async function searchAhmia(query, options = {}) {
  const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  onLog(`Acquiring concurrency slot for query: "${query}"...`, 'QUEUE');
  await acquireSlot();
  const pageNum   = options.page ?? 0;
  const timeoutMs = (options.timeout ?? 45) * 1000;

  try {
    onLog(`Connecting to Tor proxy on ${TOR_SOCKS}...`, 'PROXY');
    const browser = await getBrowser();
    onLog('Creating isolated browser context for session...', 'CONTEXT');
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      // 1. Go to Ahmia home page
      onLog(`Navigating to Ahmia hidden service (${AHMIA_ONION_BASE})...`, 'CIRCUIT');
      await page.goto(`${AHMIA_ONION_BASE}/`, { waitUntil: 'domcontentloaded' });
      onLog('Connected to Ahmia. Extracting anti-bot token & cookies...', 'TOKEN');

      // 2. Fill query and submit form
      await page.fill('#id_q', query);
      onLog(`Search form populated. Dispatching GET query "${query}" over Tor...`, 'SEARCH');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.click('input[type="submit"]')
      ]);

      // 3. Handle pagination if requested
      if (pageNum > 0) {
        onLog(`Navigating to result page ${pageNum}...`, 'PAGE');
        const currentUrl = new URL(page.url());
        currentUrl.searchParams.set('page', String(pageNum));
        await page.goto(currentUrl.toString(), { waitUntil: 'domcontentloaded' });
      }

      onLog('HTTP 200 OK received from .onion backend. Reading DOM content...', 'EXTRACT');
      const currentUrl = page.url();
      const html       = await page.content();

      onLog('Parsing .onion endpoints, titles, and descriptions...', 'PARSER');
      const results    = parseAhmiaResults(html);
      onLog(`Discovered ${results.length} hidden services in Ahmia index.`, 'SUCCESS');

      return {
        query,
        source: currentUrl,
        results
      };
    } finally {
      await context.close().catch(() => {});
    }
  } finally {
    releaseSlot();
  }
}

module.exports = { searchAhmia, parseAhmiaResults, AHMIA_ONION_BASE, getBrowser, closeBrowser };


