'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { torGet } = require('./torClient');

const SCANS_DIR = path.join(__dirname, '..', 'data', 'scans');
if (!fs.existsSync(SCANS_DIR)) {
  fs.mkdirSync(SCANS_DIR, { recursive: true });
}

// ── Multi-Currency Regex Patterns ───────────────────────────────────
const CRYPTO_PATTERNS = {
  BTC: /\b(bc1[a-z0-9]{38,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g,
  ETH: /\b0x[a-fA-F0-9]{40}\b/g,
  XMR: /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93,104}\b/g,
  LTC: /\b([LM3][a-km-zA-HJ-NP-Z1-9]{26,33}|ltc1[a-z0-9]{39,59})\b/g,
  TRX: /\bT[A-Za-z1-9]{33}\b/g,
};

// High-value keyword hints for prioritized link crawling
const PRIORITY_KEYWORDS = [
  'wallet', 'deposit', 'donate', 'donation', 'pay', 'payment',
  'order', 'checkout', 'account', 'cart', 'buy', 'btc', 'bitcoin',
  'crypto', 'escrow', 'contact', 'faq', 'about', 'transfer', 'pricing'
];

// NLP Intent Keyword Vectors
const INTENT_TAXONOMY = {
  DONATION: {
    weight: 1.2,
    keywords: ['donate', 'donation', 'donations', 'tip', 'tips', 'tipjar', 'support', 'supporter', 'contribute', 'coffee', 'fund', 'funding', 'dev fund', 'volunteer'],
  },
  ESCROW_DEPOSIT: {
    weight: 1.3,
    keywords: ['escrow', 'deposit', 'fund account', 'balance', 'topup', 'wallet balance', 'multisig', '2-of-3', '2 of 3', 'fe', 'finalize early', 'order funds'],
  },
  COMMERCE_PAYMENT: {
    weight: 1.1,
    keywords: ['invoice', 'payment', 'pay', 'send exactly', 'amount due', 'checkout', 'order id', 'purchase', 'buy now', 'cart', 'total', 'bill'],
  },
  RANSOM_EXTORTION: {
    weight: 1.5,
    keywords: ['ransom', 'decrypt', 'decryption', 'locked', 'encrypted', 'leak', 'leaked', 'penalty', 'victim', 'countdown', 'deadline', 'timer', 'publish data', 'restore files'],
  },
  VENDOR_BOND: {
    weight: 1.2,
    keywords: ['vendor', 'vendor bond', 'merchant fee', 'seller', 'seller fee', 'registration fee', 'bond deposit', 'commission', 'merchant deposit'],
  },
  EXCHANGE_MIXER: {
    weight: 1.2,
    keywords: ['tumbler', 'mixer', 'swap', 'exchange', 'clean coins', 'launder', 'anonymize', 'peer-to-peer', 'p2p swap', 'conversion fee'],
  },
  PERSONAL_WALLET: {
    weight: 1.0,
    keywords: ['my wallet', 'personal', 'reach me', 'send here', 'contact me', 'admin wallet', 'creator'],
  },
};

// Amount regex for extracting requested cryptocurrency sums
const AMOUNT_REGEX = /\b(?:\$|€|£)?\s*(\d+(?:\.\d+)?)\s*(?:BTC|XMR|ETH|LTC|USDT|USD|EUR|bits|mBTC|sats)\b/gi;

// Contact & PGP patterns
const PGP_REGEX = /-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]+?-----END PGP PUBLIC KEY BLOCK-----/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const JABBER_REGEX = /\b(?:xmpp|jabber):\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)\b/gi;

function isValidAddress(addr, coin) {
  if (!addr || addr.length < 25) return false;
  if (/^(.)\1+$/.test(addr)) return false; // filter repeating single character
  if (/^1+$/.test(addr) || /^3+$/.test(addr)) return false;
  return true;
}

/**
 * NLP Context Analyzer
 * Locates the address in the text, extracts surrounding sentence window,
 * calculates intent classification scores, detects urgency and requested amounts.
 */
function analyzeContextNLP(address, coin, text) {
  const lowerText = text.toLowerCase();
  const lowerAddr = address.toLowerCase();
  const index = lowerText.indexOf(lowerAddr);

  if (index === -1) {
    return {
      intent: 'GENERIC_TRANSFER',
      confidence: 0.5,
      snippet: `Address referenced in page source: ${address}`,
      urgency: 'LOW',
      amounts: [],
    };
  }

  // Window: 180 chars before and 180 chars after
  const start = Math.max(0, index - 180);
  const end = Math.min(text.length, index + address.length + 180);
  const rawSnippet = text.slice(start, end).replace(/\s+/g, ' ').trim();

  const snippetLower = rawSnippet.toLowerCase();

  // Classify intent using keyword density & weight
  let bestIntent = 'GENERIC_TRANSFER';
  let highestScore = 0;

  for (const [intentName, cfg] of Object.entries(INTENT_TAXONOMY)) {
    let matches = 0;
    for (const kw of cfg.keywords) {
      if (snippetLower.includes(kw)) {
        matches++;
      }
    }
    const score = matches * cfg.weight;
    if (score > highestScore) {
      highestScore = score;
      bestIntent = intentName;
    }
  }

  // Calculate confidence normalized (0.60 to 0.98)
  const confidence = highestScore > 0 ? Math.min(0.98, 0.65 + highestScore * 0.1) : 0.5;

  // Detect urgency
  const urgencyKeywords = ['hours left', 'deadline', 'penalty', 'urgent', 'immediately', 'timer', 'expires', 'minutes left'];
  const hasUrgency = urgencyKeywords.some(k => snippetLower.includes(k));
  const urgency = hasUrgency ? 'HIGH' : 'NORMAL';

  // Extract amounts mentioned in snippet
  const amounts = [];
  let m;
  while ((m = AMOUNT_REGEX.exec(rawSnippet)) !== null) {
    amounts.push(m[0].trim());
  }

  return {
    intent: bestIntent,
    confidence: Number(confidence.toFixed(2)),
    snippet: rawSnippet,
    urgency,
    amounts: [...new Set(amounts)],
  };
}

/**
 * scrapeBlockchainSite(targetUrl, options)
 * Deep multi-page crawler & NLP Blockchain Intelligence Scraper.
 *
 * @param {string} targetUrl
 * @param {{ maxPages?: number, timeout?: number, onProgress?: (step: string, data?: any) => void }} [options]
 */
async function scrapeBlockchainSite(targetUrl, options = {}) {
  const maxPages = Math.min(Math.max(options.maxPages ?? 5, 1), 12);
  const timeout = options.timeout ?? 25;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

  const cleanBase = targetUrl.trim().replace(/\/+$/, '');
  const urlObj = new URL(cleanBase);
  const originHost = urlObj.hostname;

  onProgress('START', { message: `Initializing Blockchain OSINT Crawl for: ${cleanBase}` });

  const visited = new Set();
  const queue = [cleanBase];
  const discoveredWallets = new Map(); // address -> walletData
  const siteContacts = { pgp: [], emails: [], jabber: [] };
  const crawledPages = [];

  const startTime = Date.now();

  while (queue.length > 0 && visited.size < maxPages) {
    const currentUrl = queue.shift();
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    onProgress('FETCH_PAGE', {
      pageIndex: visited.size,
      maxPages,
      url: currentUrl,
      message: `[${visited.size}/${maxPages}] Scraping .onion page: ${currentUrl}`
    });

    try {
      const res = await torGet(currentUrl, { timeout });
      if (typeof res.data !== 'string') continue;

      const html = res.data;
      const $ = cheerio.load(html);

      const pageTitle = $('title').first().text().trim() || currentUrl;

      // Extract PGP blocks & contact identifiers
      const pgpMatches = html.match(PGP_REGEX) || [];
      const emailMatches = html.match(EMAIL_REGEX) || [];
      const jabberMatches = html.match(JABBER_REGEX) || [];
      siteContacts.pgp.push(...pgpMatches);
      siteContacts.emails.push(...emailMatches);
      siteContacts.jabber.push(...jabberMatches);

      // Clean text for NLP analysis
      $('script, style, noscript, svg').remove();
      const pageText = $('body').text().replace(/\s+/g, ' ');

      // Extract links for crawl queue prioritization
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const resolved = new URL(href, currentUrl).toString();
          if (resolved.includes(originHost) && !visited.has(resolved) && !queue.includes(resolved)) {
            // Prioritize high-value crypto/escrow/donation links to the front of queue
            const lowerResolved = resolved.toLowerCase();
            const isPriority = PRIORITY_KEYWORDS.some(k => lowerResolved.includes(k));
            if (isPriority) {
              queue.unshift(resolved);
            } else if (queue.length < maxPages * 2) {
              queue.push(resolved);
            }
          }
        } catch (_) {}
      });

      // Extract and analyze wallets on this page
      let pageWalletsCount = 0;
      for (const [coin, regex] of Object.entries(CRYPTO_PATTERNS)) {
        const matches = html.match(regex) || [];
        for (const addr of matches) {
          if (!isValidAddress(addr, coin)) continue;

          // Run NLP Context Analysis
          const nlp = analyzeContextNLP(addr, coin, pageText);

          if (!discoveredWallets.has(addr)) {
            pageWalletsCount++;
            discoveredWallets.set(addr, {
              address: addr,
              coin,
              intent: nlp.intent,
              confidence: nlp.confidence,
              urgency: nlp.urgency,
              amounts: nlp.amounts,
              contextSnippet: nlp.snippet,
              foundOn: currentUrl,
              pageTitle,
              firstSeen: new Date().toISOString(),
            });
          }
        }
      }

      crawledPages.push({
        url: currentUrl,
        title: pageTitle,
        httpStatus: res.status,
        walletsFound: pageWalletsCount,
      });

      onProgress('PAGE_ANALYZED', {
        url: currentUrl,
        pageTitle,
        walletsFound: pageWalletsCount,
        totalWallets: discoveredWallets.size,
        message: `Parsed ${currentUrl} — Found ${pageWalletsCount} crypto wallets.`
      });

    } catch (err) {
      crawledPages.push({
        url: currentUrl,
        title: 'Error',
        httpStatus: null,
        error: err.message,
      });
      onProgress('PAGE_ERROR', { url: currentUrl, error: err.message });
    }
  }

  const durationMs = Date.now() - startTime;
  const walletsList = Array.from(discoveredWallets.values());

  // Aggregate summary stats
  const coinCounts = {};
  const intentCounts = {};
  walletsList.forEach((w) => {
    coinCounts[w.coin] = (coinCounts[w.coin] || 0) + 1;
    intentCounts[w.intent] = (intentCounts[w.intent] || 0) + 1;
  });

  const dossierId = crypto.createHash('sha256').update(`${cleanBase}_${Date.now()}`).digest('hex').slice(0, 16);

  const dossier = {
    id: dossierId,
    targetUrl: cleanBase,
    host: originHost,
    scannedAt: new Date().toISOString(),
    durationMs,
    pagesCrawled: crawledPages.length,
    totalWallets: walletsList.length,
    coinBreakdown: coinCounts,
    intentBreakdown: intentCounts,
    contacts: {
      pgpKeys: [...new Set(siteContacts.pgp)],
      emails: [...new Set(siteContacts.emails)],
      jabber: [...new Set(siteContacts.jabber)],
    },
    wallets: walletsList,
    pages: crawledPages,
  };

  // Save dossier to data/scans/
  const filepath = path.join(SCANS_DIR, `dossier_${dossierId}.json`);
  fs.writeFileSync(filepath, JSON.stringify(dossier, null, 2), 'utf8');

  onProgress('COMPLETE', {
    dossierId,
    totalWallets: walletsList.length,
    durationMs,
    message: `Deep Blockchain Scan complete! Discovered ${walletsList.length} wallets across ${crawledPages.length} pages.`
  });

  return dossier;
}

function listDossiers() {
  if (!fs.existsSync(SCANS_DIR)) return [];
  const files = fs.readdirSync(SCANS_DIR).filter(f => f.endsWith('.json'));
  const list = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(SCANS_DIR, f), 'utf8');
      const d = JSON.parse(raw);
      list.push({
        id: d.id,
        targetUrl: d.targetUrl,
        scannedAt: d.scannedAt,
        pagesCrawled: d.pagesCrawled,
        totalWallets: d.totalWallets,
        coinBreakdown: d.coinBreakdown,
        intentBreakdown: d.intentBreakdown,
      });
    } catch (_) {}
  }
  return list.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
}

function getDossier(id) {
  const filepath = path.join(SCANS_DIR, `dossier_${id}.json`);
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (_) {
    return null;
  }
}

module.exports = {
  scrapeBlockchainSite,
  listDossiers,
  getDossier,
  analyzeContextNLP,
  CRYPTO_PATTERNS,
};
