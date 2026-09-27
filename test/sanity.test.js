'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

// Test Suite 1: Module Loading
describe('Gengar Core Module Integrity', () => {
  test('all core backend modules load cleanly without throwing', () => {
    assert.doesNotThrow(() => require('../src/logger'));
    assert.doesNotThrow(() => require('../src/torClient'));
    assert.doesNotThrow(() => require('../src/ahmia'));
    assert.doesNotThrow(() => require('../src/prober'));
    assert.doesNotThrow(() => require('../src/walletScanner'));
    assert.doesNotThrow(() => require('../src/blockchainScraper'));
    assert.doesNotThrow(() => require('../src/cryptoForensics'));
    assert.doesNotThrow(() => require('../src/screenshot'));
    assert.doesNotThrow(() => require('../src/pgpIntelligence'));
    assert.doesNotThrow(() => require('../src/graphEngine'));
    assert.doesNotThrow(() => require('../src/routes/search'));
  });
});

// Test Suite 2: Crypto Wallet Scanner
describe('Crypto Wallet Scanner Heuristics', () => {
  const { extractWallets, isValidBtc } = require('../src/walletScanner');

  test('validates authentic Bitcoin address formats', () => {
    assert.strictEqual(isValidBtc('115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn'), true);
    assert.strictEqual(isValidBtc('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'), true);
    assert.strictEqual(isValidBtc('34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo'), true);
  });

  test('filters out obvious false positives and repeated chars', () => {
    assert.strictEqual(isValidBtc('11111111111111111111111111111111'), false);
    assert.strictEqual(isValidBtc('33333333333333333333333333333333'), false);
    assert.strictEqual(isValidBtc('short'), false);
  });

  test('extracts BTC, ETH, and XMR from sample HTML text', () => {
    const validEth = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    const sampleHtml = `
      <div>
        <p>Donate BTC: 115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn</p>
        <p>ETH: ${validEth}</p>
        <p>XMR: 44AFFq5AxYBfmUBWayxEBfZbJAVgQ6Ub2MtQZd4b4EVTd5bKCeFdQPL4wf9aJWU35g2985aE6363aDq2D3962F7642H2x3b</p>
      </div>
    `;
    const result = extractWallets(sampleHtml);
    assert.strictEqual(result.hasWallets, true);
    assert.ok(result.btc.includes('115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn'));
    assert.ok(result.eth.includes(validEth));
    assert.ok(result.xmr.length > 0);
  });
});

// Test Suite 3: NLP Intent Classification
describe('Blockchain Scraper NLP Intent Classifier', () => {
  const { analyzeContextNLP } = require('../src/blockchainScraper');
  const target = '115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn';

  test('correctly identifies RANSOM_EXTORTION context', () => {
    const text = `Your data has been encrypted and locked. Pay the ransom of 5 BTC to ${target} before the countdown timer expires.`;
    const res = analyzeContextNLP(target, 'BTC', text);
    assert.strictEqual(res.intent, 'RANSOM_EXTORTION');
    assert.strictEqual(res.urgency, 'HIGH');
  });

  test('correctly identifies DONATION context', () => {
    const text = `Support our project! Please donate or send tips to ${target} to fund the volunteer development of our tools.`;
    const res = analyzeContextNLP(target, 'BTC', text);
    assert.strictEqual(res.intent, 'DONATION');
    assert.strictEqual(res.urgency, 'NORMAL');
  });
});

// Test Suite 4: Threat Intelligence & Evidence Vault
describe('Threat Intelligence & Evidence Integrity', () => {
  const { correlateThreatIntel, EvidenceManager, THREAT_INTEL_DB } = require('../src/cryptoForensics');

  test('threat intel DB contains verified entries with risk >= 15', () => {
    assert.ok(THREAT_INTEL_DB.length >= 10);
    THREAT_INTEL_DB.forEach(entry => {
      assert.ok(entry.entity);
      assert.ok(entry.category);
      assert.ok(typeof entry.risk === 'number' && entry.risk >= 15);
    });
  });

  test('correlates known ransomware addresses', () => {
    const match = correlateThreatIntel('115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn');
    assert.strictEqual(match.threatScore, 100);
    assert.ok(match.matches.some(m => m.entity.includes('WannaCry')));
  });

  test('evidence manager produces deterministic SHA-256 seal', () => {
    const data = { testKey: 'testValue' };
    const hash1 = EvidenceManager.calculateSha256(data);
    const hash2 = EvidenceManager.calculateSha256(data);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
  });
});

// Test Suite 5: PGP Intelligence Engine
describe('PGP Identity & Fingerprint Intelligence Engine', () => {
  const { parsePgpKey, formatFingerprint, correlatePgpAcrossDossiers } = require('../src/pgpIntelligence');
  const openpgp = require('openpgp');

  test('formats 40-character fingerprint into standard 4-char chunks', () => {
    const rawFp = '47477B59F81B4D0679AF8D30572E8BF0B0F74D4F';
    const formatted = formatFingerprint(rawFp);
    assert.strictEqual(formatted, '4747 7B59 F81B 4D06 79AF  8D30 572E 8BF0 B0F7 4D4F');
  });

  test('parses generated OpenPGP public key and extracts fingerprint and user ID', async () => {
    const { publicKey } = await openpgp.generateKey({
      type: 'rsa',
      rsaBits: 2048,
      userIDs: [{ name: 'Darknet Market Vendor', email: 'vendor@hydra.onion' }]
    });

    const parsed = await parsePgpKey(publicKey);
    assert.strictEqual(parsed.success, true);
    assert.ok(parsed.fingerprint);
    assert.strictEqual(parsed.fingerprint.length, 40);
    assert.strictEqual(parsed.keyId.length, 16);
    assert.ok(parsed.userIds.some(u => u.includes('Darknet Market Vendor')));
    assert.strictEqual(parsed.isRevoked, false);
  });

  test('gracefully rejects malformed or truncated PGP blocks without throwing', async () => {
    const malformed = '-----BEGIN PGP PUBLIC KEY BLOCK-----\ninvalid data\n-----END PGP PUBLIC KEY BLOCK-----';
    const res = await parsePgpKey(malformed);
    assert.strictEqual(res.success, false);
    assert.ok(res.error);
  });

  test('correlates PGP fingerprint queries against scan directory safely', () => {
    const res = correlatePgpAcrossDossiers('47477B59F81B4D0679AF8D30572E8BF0B0F74D4F');
    assert.strictEqual(typeof res.matched, 'boolean');
    assert.ok(Array.isArray(res.onionSites));
    assert.ok(Array.isArray(res.associatedWallets));
  });
});

// Test Suite 6: Forensic Entity Graph Engine
describe('Forensic Entity Graph Engine', () => {
  const { buildGlobalIntelligenceGraph, buildGraphForAddress, makeNodeId } = require('../src/graphEngine');

  test('generates standard node identifiers with type prefix', () => {
    assert.strictEqual(makeNodeId('WALLET', '115p7UMMngoj'), 'wallet:115p7ummngoj');
    assert.strictEqual(makeNodeId('ONION', 'HTTP://TEST.ONION'), 'onion:http://test.onion');
  });

  test('builds global darknet intelligence graph from threat DB and scan dossiers', () => {
    const res = buildGlobalIntelligenceGraph();
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.graph.nodes));
    assert.ok(Array.isArray(res.graph.edges));
    assert.ok(res.graph.nodes.length > 0);
    assert.ok(res.summary.totalNodes > 0);

    // Verify presence of threat nodes
    const hasThreat = res.graph.nodes.some(n => n.type === 'THREAT_ACTOR');
    assert.strictEqual(hasThreat, true);
  });

  test('generates entity graph for target wallet address with threat correlation', async () => {
    const target = '115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn';
    const res = await buildGraphForAddress(target, { maxTxs: 2 });
    assert.strictEqual(res.success, true);
    assert.ok(res.graph.nodes.length >= 2);
    assert.ok(res.graph.edges.length >= 1);

    const rootNode = res.graph.nodes.find(n => n.type === 'TARGET_WALLET');
    assert.ok(rootNode);
    assert.strictEqual(rootNode.risk, 100);
  });
});
