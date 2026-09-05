'use strict';

const cheerio = require('cheerio');

// Bitcoin address regexes:
// 1. Legacy P2PKH: starts with '1', base58, 26-35 chars
// 2. P2SH: starts with '3', base58, 26-35 chars
// 3. Bech32 SegWit / Taproot: starts with 'bc1', lowercase, 38-62 chars
const BTC_REGEX = /\b(bc1[a-z0-9]{38,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g;

// Ethereum (ETH): 0x followed by 40 hex chars
const ETH_REGEX = /\b0x[a-fA-F0-9]{40}\b/g;

// Monero (XMR): starts with 4, 95 chars (or integrated 106 chars)
const XMR_REGEX = /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93,104}\b/g;

/**
 * Filter out obvious false positives (e.g., repeating chars, CSS variables)
 */
function isValidBtc(addr) {
  if (!addr || addr.length < 26) return false;
  // Exclude strings with only one repeated character
  if (/^(.)\1+$/.test(addr)) return false;
  // Exclude common false positives like "11111111111111111111111111111111"
  if (/^1+$/.test(addr) || /^3+$/.test(addr)) return false;
  return true;
}

/**
 * extractWallets(html)
 * Extracts Bitcoin, Ethereum, and Monero addresses from raw HTML.
 *
 * @param {string} html
 * @returns {{
 *   btc: string[],
 *   eth: string[],
 *   xmr: string[],
 *   total: number,
 *   hasWallets: boolean
 * }}
 */
function extractWallets(html) {
  if (!html || typeof html !== 'string') {
    return { btc: [], eth: [], xmr: [], total: 0, hasWallets: false };
  }

  // Use Cheerio to strip scripts/styles and parse text + links
  let searchSpace = html;
  try {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg').remove();
    
    // Check text content as well as hrefs like bitcoin:1...
    const textContent = $('body').text() || $.text();
    const hrefs = [];
    $('a[href]').each((_, el) => {
      const h = $(el).attr('href');
      if (h) hrefs.push(h);
    });

    searchSpace = `${textContent}\n${hrefs.join('\n')}\n${html}`;
  } catch (_) {
    // fallback to regex on raw html
  }

  // Match Bitcoin
  const rawBtc = searchSpace.match(BTC_REGEX) || [];
  const btc = [...new Set(rawBtc.filter(isValidBtc))];

  // Match Ethereum
  const rawEth = searchSpace.match(ETH_REGEX) || [];
  const eth = [...new Set(rawEth)];

  // Match Monero
  const rawXmr = searchSpace.match(XMR_REGEX) || [];
  const xmr = [...new Set(rawXmr)];

  const total = btc.length + eth.length + xmr.length;

  return {
    btc,
    eth,
    xmr,
    total,
    hasWallets: total > 0,
  };
}

module.exports = {
  extractWallets,
  isValidBtc,
};
