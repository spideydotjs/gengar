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
