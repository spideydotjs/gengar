/**
 * gengar/src/routes/search.js
 * ─────────────────────────────────────────────────────────────────
 * Express router for Gengar search + probe endpoints.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const express  = require('express');
const { searchAhmia }  = require('../ahmia');
const { probeMany, probeOnion } = require('../prober');
const {
  checkTorConnectivity,
  cycleTorCircuit,
  getCircuitStatus,
  configureAutoCycle,
} = require('../torClient');
const { captureScreenshot, listScreenshots, deleteScreenshot } = require('../screenshot');
const { scrapeBlockchainSite, listDossiers, getDossier } = require('../blockchainScraper');
const {
  fetchAddressOverview,
  fetchAddressTransactions,
  analyzeTransactionsForensics,
  correlateThreatIntel,
  correlateWithGengarDarknet,
  EvidenceManager,
  DEFAULT_EXAMINER,
} = require('../cryptoForensics');
const {
  parsePgpKey,
  correlatePgpAcrossDossiers,
  listAllPgpIdentities,
  queryKeyserver,
} = require('../pgpIntelligence');
const {
  buildGraphForAddress,
  buildGlobalIntelligenceGraph,
} = require('../graphEngine');
const {
  generateStixBundle,
  generateCourtReportHtml,
} = require('../reportGenerator');
const {
  detectChain,
  analyzeMultiChainForensics,
} = require('../multiChainForensics');



const router = express.Router();

// ── GET /api/tor-status ────────────────────────────────────────────
/**
 * @route  GET /api/tor-status
 * @desc   Check whether Tor connectivity is active
 * @access Public
 */
router.get('/tor-status', async (req, res) => {
  try {
    const status = await checkTorConnectivity();
    res.json({ success: true, tor: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── TOR CIRCUIT CYCLING ENDPOINTS ───────────────────────────────────

/**
 * @route  GET /api/tor/circuit/status
 * @desc   Get current circuit token, exit IP, control port status & history
 */
router.get('/tor/circuit/status', async (req, res) => {
  try {
    const status = getCircuitStatus();
    res.json({ success: true, circuit: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route  POST /api/tor/circuit/cycle
 * @desc   Cycle Tor identity via SIGNAL NEWNYM and SOCKS5 stream isolation
 * @body   { verifyExitIp?: boolean }
 */
router.post('/tor/circuit/cycle', async (req, res) => {
  try {
    const verifyExitIp = req.body?.verifyExitIp !== false;
    const result = await cycleTorCircuit({ verifyExitIp });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route  POST /api/tor/circuit/auto-cycle
 * @desc   Configure periodic automated circuit cycling
 * @body   { intervalMinutes: number }
 */
router.post('/tor/circuit/auto-cycle', (req, res) => {
  try {
    const { intervalMinutes } = req.body || {};
    const config = configureAutoCycle(intervalMinutes);
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ── GET /api/search ────────────────────────────────────────────────
/**
 * @route  GET /api/search?q=<query>[&page=0][&probe=true][&timeout=25]
 * @desc   Search Ahmia .onion engine and return discovered .onion URLs.
 * @access Public
 */

// ── GET /api/search/stream (SSE Real-time progress) ───────────────
router.get('/search/stream', async (req, res) => {
  const query   = (req.query.q || '').trim();
  const page    = parseInt(req.query.page, 10) || 0;
  const timeout = parseInt(req.query.timeout, 10) || 25;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (type, payload) => {
    res.write(`data: ${JSON.stringify({ type, ...payload, timestamp: new Date().toLocaleTimeString() })}\n\n`);
  };

  if (!query) {
    sendEvent('error', { error: 'Missing required query parameter: q' });
    return res.end();
  }

  try {
    sendEvent('log', { tag: 'INIT', message: `Initializing dark-web search for "${query}"` });
    const torTarget = process.env.TOR_SOCKS || 'socks5h://127.0.0.1:9050';
    sendEvent('log', { tag: 'TOR', message: `Routing socket through Tor SOCKS5 circuit (${torTarget})...` });

    const searchResult = await searchAhmia(query, {
      page,
      timeout: timeout + 15,
      onLog: (message, tag) => {
        sendEvent('log', { tag, message });
      }
    });

    sendEvent('complete', {
      success: true,
      query,
      page,
      source: searchResult.source,
      total: searchResult.results.length,
      results: searchResult.results,
    });
    res.end();
  } catch (err) {
    console.error('[Gengar /search/stream] Error:', err.message);
    sendEvent('error', { error: err.message });
    res.end();
  }
});

// ── GET /api/search (Standard JSON) ────────────────────────────────
router.get('/search', async (req, res) => {
  const query   = (req.query.q || '').trim();
  const page       = parseInt(req.query.page,       10) || 0;
  const doProbe    = req.query.probe === 'true';
  const timeout    = parseInt(req.query.timeout,    10) || 25;
  // Safety cap: probe up to probeLimit items (default 10, max 50) to prevent request hangs
  const probeLimit = Math.min(Math.max(parseInt(req.query.probeLimit, 10) || 10, 1), 50);

  if (!query) {
    return res.status(400).json({
      success: false,
      error  : 'Missing required query parameter: q',
    });
  }

  try {
    // ── 1. Search Ahmia ─────────────────────────────────────────────
    const searchResult = await searchAhmia(query, { page, timeout: timeout + 15 });

    if (!doProbe) {
      return res.json({
        success    : true,
        query,
        page,
        source     : searchResult.source,
        total      : searchResult.results.length,
        results    : searchResult.results,
        probed     : false,
        note       : 'Pass ?probe=true to confirm hidden service reachability (probeLimit defaults to 10).',
      });
    }

    // ── 2. Probe discovered .onion URLs up to probeLimit ────────────
    const targetsToProbe = searchResult.results.slice(0, probeLimit);
    const unprobed       = searchResult.results.slice(probeLimit);

    const urls      = targetsToProbe.map(r => r.onion);
    const probeData = await probeMany(urls, { timeout, concurrency: 5 });

    // Merge probe results
    const probedMerged = targetsToProbe.map((sr, i) => ({
      ...sr,
      probe: probeData[i],
    }));

    const unprobedMerged = unprobed.map(sr => ({
      ...sr,
      probe: null,
    }));

    const merged = [...probedMerged, ...unprobedMerged];
    const alive  = probedMerged.filter(r => r.probe?.alive).length;

    return res.json({
      success     : true,
      query,
      page,
      source      : searchResult.source,
      total       : merged.length,
      probedCount : probedMerged.length,
      alive,
      dead        : probedMerged.length - alive,
      probed      : true,
      results     : merged,
    });

  } catch (err) {
    console.error('[Gengar /search] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/probe ────────────────────────────────────────────────
/**
 * @route  POST /api/probe
 * @desc   Probe a specific .onion URL or list of URLs for liveness
 * @body   { urls: string[] }  or  { url: string }
 * @access Public
 */
router.post('/probe', async (req, res) => {
  const { url, urls, timeout = 25 } = req.body || {};

  const targets = urls ?? (url ? [url] : []);

  if (!targets.length) {
    return res.status(400).json({
      success: false,
      error  : 'Provide body: { "urls": ["http://abc.onion"] } or { "url": "http://abc.onion" }',
    });
  }

  // Validate all targets are .onion
  const invalid = targets.filter(t => !t.includes('.onion'));
  if (invalid.length) {
    return res.status(400).json({
      success: false,
      error  : `Non-.onion URLs detected: ${invalid.join(', ')}`,
    });
  }

  try {
    const results = await probeMany(targets, { timeout, concurrency: 5 });
    const alive   = results.filter(r => r.alive).length;

    // Capture visual screenshots for all alive hidden services
    for (const r of results) {
      if (r.alive) {
        try {
          const snap = await captureScreenshot(r.url, { timeout: 25 });
          if (snap.success) {
            r.screenshot = snap.screenshotUrl;
            r.screenshotId = snap.id;
            if (snap.title && (!r.title || r.title === 'Untitled')) {
              r.title = snap.title;
            }
          }
        } catch (_) {}
      }
    }

    res.json({
      success: true,
      total  : results.length,
      alive,
      dead   : results.length - alive,
      results,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/screenshots ───────────────────────────────────────────
/**
 * @route  GET /api/screenshots
 * @desc   List all captured dark-web site screenshots
 */
router.get('/screenshots', (req, res) => {
  try {
    const screenshots = listScreenshots();
    res.json({
      success: true,
      count: screenshots.length,
      screenshots,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/screenshot ───────────────────────────────────────────
/**
 * @route  POST /api/screenshot
 * @desc   Capture a screenshot for a specific .onion URL on demand
 * @body   { url: string, timeout?: number }
 */
router.post('/screenshot', async (req, res) => {
  const { url, timeout = 30 } = req.body || {};

  if (!url || !url.includes('.onion')) {
    return res.status(400).json({
      success: false,
      error: 'Provide a valid .onion URL in body: { "url": "http://abc.onion" }',
    });
  }

  try {
    const snap = await captureScreenshot(url, { timeout });
    if (!snap.success) {
      return res.status(502).json({ success: false, error: snap.error || 'Failed to capture screenshot' });
    }
    res.json({ success: true, screenshot: snap });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/screenshot/:id ─────────────────────────────────────
/**
 * @route  DELETE /api/screenshot/:id
 * @desc   Delete a captured screenshot by hash or filename
 */
router.delete('/screenshot/:id', (req, res) => {
  try {
    const deleted = deleteScreenshot(req.params.id);
    res.json({ success: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/blockchain-scan ──────────────────────────────────────
/**
 * @route  POST /api/blockchain-scan
 * @desc   Crawl a .onion site recursively for crypto wallets with NLP intent classification
 * @body   { url: string, maxPages?: number, timeout?: number }
 */
router.post('/blockchain-scan', async (req, res) => {
  const { url, maxPages = 5, timeout = 25 } = req.body || {};

  if (!url || !url.includes('.onion')) {
    return res.status(400).json({
      success: false,
      error: 'Provide a valid .onion URL in body: { "url": "http://abc.onion" }',
    });
  }

  try {
    const dossier = await scrapeBlockchainSite(url, { maxPages, timeout });
    res.json({ success: true, dossier });
  } catch (err) {
    console.error('[Gengar /blockchain-scan] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/blockchain-scan/stream ────────────────────────────────
/**
 * @route  GET /api/blockchain-scan/stream?url=<onionUrl>&maxPages=5&timeout=25
 * @desc   SSE stream for real-time crawler logs and discovered wallets
 */
router.get('/blockchain-scan/stream', async (req, res) => {
  const url = (req.query.url || '').trim();
  const maxPages = parseInt(req.query.maxPages, 10) || 5;
  const timeout = parseInt(req.query.timeout, 10) || 25;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (step, data) => {
    res.write(`data: ${JSON.stringify({ step, ...data, timestamp: new Date().toLocaleTimeString() })}\n\n`);
  };

  if (!url || !url.includes('.onion')) {
    sendEvent('ERROR', { error: 'Valid .onion URL required.' });
    return res.end();
  }

  try {
    const dossier = await scrapeBlockchainSite(url, {
      maxPages,
      timeout,
      onProgress: (step, data) => {
        sendEvent(step, data);
      }
    });

    sendEvent('FINISH', { success: true, dossier });
    res.end();
  } catch (err) {
    sendEvent('ERROR', { error: err.message });
    res.end();
  }
});

// ── GET /api/blockchain-scans ──────────────────────────────────────
/**
 * @route  GET /api/blockchain-scans
 * @desc   List previously completed blockchain OSINT dossiers
 */
router.get('/blockchain-scans', (req, res) => {
  try {
    const dossiers = listDossiers();
    res.json({ success: true, count: dossiers.length, dossiers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/blockchain-scan/:id ───────────────────────────────────
/**
 * @route  GET /api/blockchain-scan/:id
 * @desc   Get full dossier details for a specific scan ID
 */
router.get('/blockchain-scan/:id', (req, res) => {
  try {
    const dossier = getDossier(req.params.id);
    if (!dossier) {
      return res.status(404).json({ success: false, error: 'Dossier not found' });
    }
    res.json({ success: true, dossier });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── FORENSICS & CRIMINAL CORRELATION ENDPOINTS ─────────────────────

// ── POST /api/forensics/track ──────────────────────────────────────
/**
 * @route  POST /api/forensics/track
 * @desc   Perform on-chain forensic tracking, clustering, and criminal correlation
 * @body   { address: string, examiner?: string }
 */
router.post('/forensics/track', async (req, res) => {
  const { address, examiner = DEFAULT_EXAMINER } = req.body || {};

  if (!address || typeof address !== 'string' || address.trim().length < 25) {
    return res.status(400).json({ success: false, error: 'Provide a valid cryptocurrency address in body' });
  }

  const cleanAddr = address.trim();

  try {
    const chain = detectChain(cleanAddr);

    // Multi-chain tracking for EVM (Ethereum) and TRON (TRC-20 USDT)
    if (chain === 'ETH' || chain === 'TRON') {
      const multiResult = await analyzeMultiChainForensics(cleanAddr, { examiner, maxTxs: 35 });
      if (multiResult) {
        const darknetMatch = correlateWithGengarDarknet(cleanAddr);
        const caseDossier = EvidenceManager.saveCaseDossier({
          ...multiResult,
          darknetCorrelation: darknetMatch,
          examinerNotes: [`Initial ${chain} forensic trace executed at ${new Date().toISOString()}`],
        });

        return res.json({
          success: true,
          caseId: caseDossier.caseId,
          evidenceSeal: caseDossier.evidenceSeal,
          chain,
          threatScore: multiResult.threatScore,
          overview: multiResult.overview,
          threats: multiResult.correlatedThreats,
          darknetMatch,
          clusteredAddresses: multiResult.clusteredAddresses,
          counterparties: multiResult.clusteredAddresses.map(c => c.address),
          peelingChainsCount: multiResult.ledger.filter(l => l.isPeeling).length,
          coinJoinsCount: multiResult.ledger.filter(l => l.isMixer).length,
          ledger: multiResult.ledger,
          caseDossier,
        });
      }
    }

    // Default Bitcoin UTXO forensics
    const overview = await fetchAddressOverview(cleanAddr);
    const rawTxs = await fetchAddressTransactions(cleanAddr, 35);
    const analysis = analyzeTransactionsForensics(cleanAddr, rawTxs);
    const threats = correlateThreatIntel(cleanAddr, analysis.coSpentAddresses, analysis.counterparties);
    const darknetMatch = correlateWithGengarDarknet(cleanAddr);


    const caseDossier = EvidenceManager.saveCaseDossier({
      targetAddress: cleanAddr,
      leadExaminer: examiner,
      threatScore: threats.threatScore,
      overview,
      correlatedThreats: threats.matches,
      darknetCorrelation: darknetMatch,
      clusteredAddresses: analysis.coSpentAddresses,
      ledger: analysis.ledger,
      examinerNotes: [`Initial forensic trace executed at ${new Date().toISOString()}`],
    });

    res.json({
      success: true,
      caseId: caseDossier.caseId,
      evidenceSeal: caseDossier.evidenceSeal,
      threatScore: threats.threatScore,
      overview,
      threats: threats.matches,
      darknetMatch,
      clusteredAddresses: analysis.coSpentAddresses,
      counterparties: analysis.counterparties,
      peelingChainsCount: analysis.peelingChainsCount,
      coinJoinsCount: analysis.coinJoinsCount,
      ledger: analysis.ledger,
      caseDossier,
    });
  } catch (err) {
    console.error('[Gengar /forensics/track] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/forensics/cases ───────────────────────────────────────
/**
 * @route  GET /api/forensics/cases
 * @desc   List all sealed forensic evidence cases
 */
router.get('/forensics/cases', (req, res) => {
  try {
    const cases = EvidenceManager.listCases();
    res.json({ success: true, count: cases.length, cases });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/forensics/case/:id ────────────────────────────────────
/**
 * @route  GET /api/forensics/case/:id
 * @desc   Get full case record by case ID
 */
router.get('/forensics/case/:id', (req, res) => {
  try {
    const caseRecord = EvidenceManager.getCase(req.params.id);
    if (!caseRecord) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    res.json({ success: true, case: caseRecord });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/forensics/case/note ──────────────────────────────────
/**
 * @route  POST /api/forensics/case/note
 * @desc   Append examiner observation to a case and re-seal cryptographic hash
 * @body   { caseId: string, note: string, examiner?: string }
 */
router.post('/forensics/case/note', (req, res) => {
  const { caseId, note, examiner = 'OPERATOR_API' } = req.body || {};

  if (!caseId || !note) {
    return res.status(400).json({ success: false, error: 'Provide caseId and note in body' });
  }

  try {
    const existing = EvidenceManager.getCase(caseId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    const updatedNotes = [...(existing.examinerNotes || []), `[${new Date().toISOString()} by ${examiner}] ${note}`];
    const updated = EvidenceManager.saveCaseDossier({
      ...existing,
      examinerNotes: updatedNotes,
    });

    res.json({ success: true, caseId, evidenceSeal: updated.evidenceSeal, notes: updatedNotes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/forensics/case/:id/export/stix ────────────────────────
/**
 * @route  GET /api/forensics/case/:id/export/stix
 * @desc   Export case dossier as an OASIS STIX 2.1 compliant CTI JSON bundle
 */
router.get('/forensics/case/:id/export/stix', (req, res) => {
  try {
    const caseRecord = EvidenceManager.getCase(req.params.id);
    if (!caseRecord) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    const stixBundle = generateStixBundle(caseRecord);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="GENGAR_${caseRecord.caseId}_STIX2.1.json"`);
    res.send(JSON.stringify(stixBundle, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/forensics/case/:id/export/html ────────────────────────
/**
 * @route  GET /api/forensics/case/:id/export/html
 * @desc   Render court-ready FRE Rule 902(14) certified evidence report
 */
router.get('/forensics/case/:id/export/html', (req, res) => {
  try {
    const caseRecord = EvidenceManager.getCase(req.params.id);
    if (!caseRecord) {
      return res.status(404).send('<h1>404 Not Found</h1><p>Case not found</p>');
    }
    const autoPrint = req.query.print === 'true' || req.query.autoPrint === 'true';
    const html = generateCourtReportHtml(caseRecord, { autoPrint });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><p>${err.message}</p>`);
  }
});

// ── POST /api/forensics/report/stix ────────────────────────────────
/**
 * @route  POST /api/forensics/report/stix
 * @desc   Generate STIX 2.1 bundle dynamically from active session data
 * @body   { caseData: Object }
 */
router.post('/forensics/report/stix', (req, res) => {
  try {
    const caseData = req.body.caseData || req.body;
    if (!caseData || !caseData.targetAddress) {
      return res.status(400).json({ success: false, error: 'Target address is required' });
    }
    const stixBundle = generateStixBundle(caseData);
    res.json({ success: true, bundle: stixBundle });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/forensics/report/html ────────────────────────────────
/**
 * @route  POST /api/forensics/report/html
 * @desc   Generate court-ready HTML report dynamically from active session data
 * @body   { caseData: Object, autoPrint?: boolean }
 */
router.post('/forensics/report/html', (req, res) => {
  try {
    const { caseData, autoPrint = false } = req.body || {};
    if (!caseData || !caseData.targetAddress) {
      return res.status(400).send('<h1>Error</h1><p>Target address is required</p>');
    }
    const html = generateCourtReportHtml(caseData, { autoPrint });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><p>${err.message}</p>`);
  }
});


// ── PGP IDENTITY & FINGERPRINT INTELLIGENCE ENDPOINTS ───────────────

/**
 * @route  GET /api/pgp/identities
 * @desc   List all unique PGP identities discovered across crawl dossiers
 * @access Public
 */
router.get('/pgp/identities', (req, res) => {
  try {
    const identities = listAllPgpIdentities();
    res.json({
      success: true,
      count: identities.length,
      identities,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route  GET /api/pgp/identity/:fingerprint
 * @desc   Get full identity profile, cross-onion domain linkage, and wallets for a PGP fingerprint
 * @access Public
 */
router.get('/pgp/identity/:fingerprint', (req, res) => {
  try {
    const correlation = correlatePgpAcrossDossiers(req.params.fingerprint);
    res.json({
      success: true,
      ...correlation,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route  POST /api/pgp/parse
 * @desc   Parse any armored PGP public key on demand
 * @body   { rawArmor: string }
 * @access Public
 */
router.post('/pgp/parse', async (req, res) => {
  const { rawArmor } = req.body || {};
  if (!rawArmor || typeof rawArmor !== 'string') {
    return res.status(400).json({ success: false, error: 'Provide rawArmor in request body' });
  }

  try {
    const parsed = await parsePgpKey(rawArmor);
    if (!parsed.success) {
      return res.status(422).json(parsed);
    }
    const correlation = correlatePgpAcrossDossiers(parsed.fingerprint);
    res.json({
      success: true,
      key: parsed,
      crossOnionLinkage: correlation,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route  GET /api/pgp/keyserver/:fingerprint
 * @desc   Query public keyserver (keys.openpgp.org) over Tor for historical registration or leaked clearnet emails
 * @access Public
 */
router.get('/pgp/keyserver/:fingerprint', async (req, res) => {
  const { timeout = 15 } = req.query;
  try {
    const result = await queryKeyserver(req.params.fingerprint, parseInt(timeout, 10) || 15);
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── INTERACTIVE ENTITY GRAPH EXPLORER ENDPOINTS ─────────────────────

/**
 * @route  GET /api/forensics/graph
 * @desc   Generate an interconnected entity network graph for a cryptocurrency address
 * @query  address (string), maxTxs (number)
 * @access Public
 */
router.get('/forensics/graph', async (req, res) => {
  const { address, maxTxs = 8 } = req.query;
  if (!address || typeof address !== 'string' || address.trim().length < 25) {
    return res.status(400).json({ success: false, error: 'Provide a valid address query parameter' });
  }

  try {
    const graphData = await buildGraphForAddress(address.trim(), {
      maxTxs: parseInt(maxTxs, 10) || 8,
    });
    res.json(graphData);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route  GET /api/forensics/graph/global
 * @desc   Generate the global darknet intelligence graph across all stored dossiers and threat actors
 * @access Public
 */
router.get('/forensics/graph/global', (req, res) => {
  try {
    const globalGraph = buildGlobalIntelligenceGraph();
    res.json(globalGraph);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
