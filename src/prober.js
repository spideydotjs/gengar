/**
 * gengar/src/prober.js
 * ─────────────────────────────────────────────────────────────────
 * Probes .onion URLs to confirm hidden service reachability.
 * Reports HTTP status, title, and latency.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const cheerio  = require('cheerio');
const { torGet } = require('./torClient');
const { extractWallets } = require('./walletScanner');

/**
 * probeOnion(url, timeout?)
 * Sends a GET request to a .onion URL through Tor and returns
 * availability metadata.
 *
 * @param {string} url      Full URL, e.g. http://abc123.onion/
 * @param {number} [timeout=25]  Seconds to wait before declaring unreachable
 * @returns {Promise<{
 *   url:       string,
 *   alive:     boolean,
 *   status:    number|null,
 *   title:     string|null,
 *   latencyMs: number|null,
 *   wallets:   { btc: string[], eth: string[], xmr: string[], total: number, hasWallets: boolean },
 *   error:     string|null
 * }>}
 */
async function probeOnion(url, timeout = 25) {
  const start = Date.now();

  try {
    const res       = await torGet(url, { timeout, maxRedirects: 5 });
    const latencyMs = Date.now() - start;

    // Try to extract page title & crypto wallets
    let title   = null;
    let wallets = { btc: [], eth: [], xmr: [], total: 0, hasWallets: false };

    if (typeof res.data === 'string') {
      const $ = cheerio.load(res.data);
      title   = $('title').first().text().trim() || null;
      wallets = extractWallets(res.data);
    }

    return {
      url,
      alive    : true,
      status   : res.status,
      title,
      latencyMs,
      wallets,
      error    : null,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const status    = err.response?.status ?? null;

    return {
      url,
      alive    : false,
      status,
      title    : null,
      latencyMs: status ? latencyMs : null,  // no latency if we never connected
      wallets  : { btc: [], eth: [], xmr: [], total: 0, hasWallets: false },
      error    : err.message,
    };
  }
}

/**
 * probeMany(urls, options?)
 * Probes multiple .onion URLs concurrently with a concurrency cap.
 *
 * @param {string[]} urls
 * @param {{ timeout?: number, concurrency?: number }} [options]
 * @returns {Promise<ReturnType<probeOnion>[]>}
 */
async function probeMany(urls, options = {}) {
  const timeout     = options.timeout     ?? 25;
  const concurrency = options.concurrency ?? 5;

  const results = [];
  // Process in chunks to avoid overwhelming the Tor circuit
  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    const batch = await Promise.all(chunk.map(u => probeOnion(u, timeout)));
    results.push(...batch);
  }

  return results;
}

module.exports = { probeOnion, probeMany };
