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
const { checkTorConnectivity }  = require('../torClient');
const { captureScreenshot, listScreenshots, deleteScreenshot } = require('../screenshot');
const { scrapeBlockchainSite, listDossiers, getDossier } = require('../blockchainScraper');
const {
  fetchAddressOverview,
  fetchAddressTransactions,
  analyzeTransactionsForensics,
  correlateThreatIntel,
  correlateWithGengarDarknet,
  EvidenceManager,
} = require('../cryptoForensics');

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
    sendEvent('log', { tag: 'TOR', message: 'Routing socket through Tor SOCKS5 circuit (127.0.0.1:9050)...' });

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
  const { address, examiner = 'OPERATOR_API' } = req.body || {};

  if (!address || typeof address !== 'string' || address.trim().length < 25) {
    return res.status(400).json({ success: false, error: 'Provide a valid cryptocurrency address in body' });
  }

  const cleanAddr = address.trim();

  try {
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

module.exports = router;
