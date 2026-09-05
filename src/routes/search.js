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

module.exports = router;
