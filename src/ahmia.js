/**
 * gengar/src/ahmia.js
 * ─────────────────────────────────────────────────────────────────
 * Queries the Ahmia search engine over Tor SOCKS5.
 *
 * Implements a resilient multi-tier engine:
 * 1. Primary: Fast Tor .onion HTTP with automated anti-bot token negotiation
 *    Extracts dynamic CSRF/nonce tokens from Ahmia's hidden service form,
 *    submitting requests directly through the Tor circuit without heavy browser overhead.
 * 2. Fallback 1: Mirror query via Tor exit nodes (https://ahmia.fi) if the
 *    official .onion rendezvous circuit encounters congestion or timeout.
 * 3. Fallback 2: Headless Playwright Chromium browser session with asset
 *    filtering (blocks media/fonts/trackers to eliminate hangs).
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const cheerio         = require('cheerio');
const { chromium }    = require('playwright');
const { torGet }      = require('./torClient');

const AHMIA_ONION_BASE =
  'http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion';
const AHMIA_CLEARNET_BASE =
  'https://ahmia.fi';

const TOR_SOCKS = process.env.TOR_SOCKS || 'socks5h://127.0.0.1:9050';

let browserPromise = null;
let activeSearches = 0;
const MAX_CONCURRENT_SEARCHES = 3;
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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote'
      ]
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
  if (!html || typeof html !== 'string') return [];
  const $       = cheerio.load(html);
  const results = [];
  const seen    = new Set();

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
      const cleanUrl = onion.trim();
      if (!seen.has(cleanUrl)) {
        seen.add(cleanUrl);
        results.push({ title, onion: cleanUrl, description: desc });
      }
    }
  });

  return results;
}

/**
 * searchAhmiaHttp(baseUrl, query, options)
 * Queries Ahmia via direct Tor HTTP socket with dynamic anti-bot token negotiation.
 */
async function searchAhmiaHttp(baseUrl, query, options = {}) {
  const onLog     = typeof options.onLog === 'function' ? options.onLog : () => {};
  const pageNum   = options.page ?? 0;
  const timeoutSec= Math.max(options.timeout ?? 25, 15);

  onLog(`Fetching search nonce token from ${baseUrl}/...`, 'NONCE');
  const homeRes = await torGet(`${baseUrl}/`, { timeout: timeoutSec });

  // Extract cookies
  const setCookie = homeRes.headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie)
    ? setCookie.map(c => c.split(';')[0]).join('; ')
    : (setCookie ? String(setCookie).split(';')[0] : '');

  // Extract hidden honeypot/anti-bot inputs
  const $ = cheerio.load(homeRes.data);
  const hiddenInputs = {};
  $('form input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const val  = $(el).attr('value');
    if (name && val !== undefined) {
      hiddenInputs[name] = val;
    }
  });

  onLog(`Negotiated anti-bot challenge. Dispatching search for "${query}"...`, 'DISPATCH');
  const params = new URLSearchParams({ q: query, ...hiddenInputs });
  if (pageNum > 0) {
    params.set('page', String(pageNum));
  }

  const searchUrl = `${baseUrl}/search/?${params.toString()}`;
  const searchRes = await torGet(searchUrl, {
    timeout: timeoutSec + 10,
    headers: {
      Cookie: cookieHeader,
      Referer: `${baseUrl}/`,
    }
  });

  const results = parseAhmiaResults(searchRes.data);
  return {
    query,
    source: searchUrl,
    results
  };
}

/**
 * searchAhmiaBrowser(baseUrl, query, options)
 * Headless Chromium browser session with aggressive asset filtering to prevent timeouts.
 */
async function searchAhmiaBrowser(baseUrl, query, options = {}) {
  const onLog     = typeof options.onLog === 'function' ? options.onLog : () => {};
  const pageNum   = options.page ?? 0;
  const timeoutMs = (Math.max(options.timeout ?? 30, 20)) * 1000;

  onLog('Acquiring browser session slot for resilient fallback...', 'BROWSER');
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
  });

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    // Block non-essential media & fonts to prevent Tor bandwidth congestion
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    onLog(`Connecting to ${baseUrl}/ in headless browser...`, 'NAVIGATE');
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    onLog('Populating query inputs...', 'FORM');
    await page.fill('#id_q', query);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: timeoutMs }),
      page.click('input[type="submit"]')
    ]);

    if (pageNum > 0) {
      const currentUrl = new URL(page.url());
      currentUrl.searchParams.set('page', String(pageNum));
      await page.goto(currentUrl.toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    }

    const currentUrl = page.url();
    const html       = await page.content();
    const results    = parseAhmiaResults(html);

    return {
      query,
      source: currentUrl,
      results
    };
  } finally {
    await context.close().catch(() => {});
  }
}

/**
 * searchAhmia(query, options?)
 * Multi-tiered search:
 * 1. Primary: Official Ahmia .onion via fast Tor HTTP socket + token negotiation
 * 2. Fallback: Ahmia mirror via Tor exit circuit
 * 3. Fallback: Headless Chromium browser session
 *
 * @param {string} query
 * @param {{ page?: number, timeout?: number, onLog?: (msg: string, tag: string) => void }} [options]
 * @returns {Promise<{ query: string, source: string, results: object[] }>}
 */
async function searchAhmia(query, options = {}) {
  const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  onLog(`Acquiring concurrency slot for query: "${query}"...`, 'QUEUE');
  await acquireSlot();

  try {
    // ── Tier 1: Fast Tor .onion HTTP with token negotiation ───────────
    try {
      onLog(`Routing to Ahmia .onion (${AHMIA_ONION_BASE})...`, 'ONION');
      const res = await searchAhmiaHttp(AHMIA_ONION_BASE, query, options);
      if (res.results && res.results.length > 0) {
        onLog(`Discovered ${res.results.length} hidden services via .onion socket.`, 'SUCCESS');
        return res;
      }
      onLog('Zero results returned by .onion. Checking mirror...', 'VERIFY');
    } catch (onionErr) {
      onLog(`Ahmia .onion circuit delay/timeout: ${onionErr.message}. Switching to Tor mirror...`, 'MIRROR_FALLBACK');
    }

    // ── Tier 2: Ahmia Tor-routed Mirror ──────────────────────────────
    try {
      onLog(`Querying Ahmia mirror (${AHMIA_CLEARNET_BASE}) through Tor circuit...`, 'MIRROR');
      const res = await searchAhmiaHttp(AHMIA_CLEARNET_BASE, query, options);
      if (res.results && res.results.length > 0) {
        onLog(`Discovered ${res.results.length} hidden services via Tor mirror.`, 'SUCCESS');
        return res;
      }
    } catch (mirrorErr) {
      onLog(`Mirror query failed: ${mirrorErr.message}. Initiating headless browser...`, 'BROWSER_FALLBACK');
    }

    // ── Tier 3: Resilient Playwright Headless Browser Session ────────
    onLog('Launching Playwright browser engine fallback...', 'BROWSER');
    try {
      const res = await searchAhmiaBrowser(AHMIA_CLEARNET_BASE, query, options);
      onLog(`Discovered ${res.results.length} hidden services via browser engine.`, 'SUCCESS');
      return res;
    } catch (browserMirrorErr) {
      onLog(`Browser mirror failed (${browserMirrorErr.message}). Trying browser on .onion...`, 'ONION_BROWSER');
      return await searchAhmiaBrowser(AHMIA_ONION_BASE, query, options);
    }
  } finally {
    releaseSlot();
  }
}

module.exports = {
  searchAhmia,
  parseAhmiaResults,
  AHMIA_ONION_BASE,
  AHMIA_CLEARNET_BASE,
  getBrowser,
  closeBrowser
};
