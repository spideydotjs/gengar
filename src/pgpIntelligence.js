/**
 * gengar/src/pgpIntelligence.js
 * ─────────────────────────────────────────────────────────────────
 * PGP Key Extraction, RFC 4880 Parsing, Fingerprint Analysis,
 * Cross-Onion Identity Correlation, and Keyserver Lookup.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const fs = require('fs');
const path = require('path');
const openpgp = require('openpgp');
const { torGet } = require('./torClient');

const SCANS_DIR = path.join(__dirname, '..', 'data', 'scans');
const EVIDENCE_DIR = path.join(__dirname, '..', 'data', 'evidence');

const PGP_BLOCK_REGEX = /-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]+?-----END PGP PUBLIC KEY BLOCK-----/g;

/**
 * Format a 40-char fingerprint into standard 4-character chunks:
 * e.g., "4747 7B59 F81B 4D06 79AF  8D30 572E 8BF0 B0F7 4D4F"
 */
function formatFingerprint(fp) {
  if (!fp || typeof fp !== 'string') return '';
  const clean = fp.toUpperCase().replace(/\s+/g, '');
  if (clean.length !== 40) return clean;
  const part1 = clean.slice(0, 20).match(/.{1,4}/g)?.join(' ') || '';
  const part2 = clean.slice(20, 40).match(/.{1,4}/g)?.join(' ') || '';
  return `${part1}  ${part2}`;
}

/**
 * Parse a raw armored PGP public key block into a structured intelligence object.
 *
 * @param {string} rawArmor
 * @returns {Promise<{
 *   success: boolean,
 *   fingerprint?: string,
 *   formattedFingerprint?: string,
 *   keyId?: string,
 *   userIds?: string[],
 *   primaryUserId?: string,
 *   algorithm?: string,
 *   bitLength?: number|null,
 *   created?: string,
 *   expires?: string|null,
 *   isRevoked?: boolean,
 *   rawArmor?: string,
 *   error?: string
 * }>}
 */
async function parsePgpKey(rawArmor) {
  if (!rawArmor || typeof rawArmor !== 'string') {
    return { success: false, error: 'Empty or invalid PGP armor input' };
  }

  // Safety length cap (100KB) to prevent ReDoS / CPU starvation
  if (rawArmor.length > 100 * 1024) {
    return { success: false, error: 'PGP block exceeds maximum allowed size (100KB)' };
  }

  try {
    const key = await openpgp.readKey({ armoredKey: rawArmor.trim() });
    const fingerprint = key.getFingerprint().toUpperCase();
    const keyId = key.getKeyID().toHex().toUpperCase();
    const userIds = await key.getUserIDs();
    const primaryUserId = userIds[0] || 'Unknown Identity';

    let algorithmName = 'Unknown';
    let bitLength = null;

    if (key.getAlgorithmInfo) {
      const info = key.getAlgorithmInfo();
      algorithmName = info.algorithm || 'Unknown';
      bitLength = info.bits || null;
    } else if (key.keyPacket && key.keyPacket.algorithm) {
      algorithmName = String(key.keyPacket.algorithm);
    }

    const creationTime = key.getCreationTime();
    let expirationTime = null;
    try {
      const exp = await key.getExpirationTime();
      if (exp && exp !== Infinity && exp instanceof Date && !isNaN(exp.getTime())) {
        expirationTime = exp.toISOString();
      }
    } catch (_) {}

    let isRevoked = false;
    try {
      isRevoked = await key.isRevoked();
    } catch (_) {}

    return {
      success: true,
      fingerprint,
      formattedFingerprint: formatFingerprint(fingerprint),
      keyId,
      userIds,
      primaryUserId,
      algorithm: algorithmName,
      bitLength,
      created: creationTime ? creationTime.toISOString() : null,
      expires: expirationTime,
      isRevoked: Boolean(isRevoked),
      rawArmor: rawArmor.trim(),
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse PGP public key: ${err.message}`,
      rawArmor: rawArmor.trim(),
    };
  }
}

/**
 * Extract and parse all PGP public keys from an HTML document or raw text string.
 *
 * @param {string} text
 * @returns {Promise<Array<object>>}
 */
async function extractAndParseAllPgpKeys(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(PGP_BLOCK_REGEX) || [];
  const parsedKeys = [];
  const seenFp = new Set();

  for (const block of matches) {
    const parsed = await parsePgpKey(block);
    if (parsed.success && parsed.fingerprint) {
      if (!seenFp.has(parsed.fingerprint)) {
        seenFp.add(parsed.fingerprint);
        parsedKeys.push(parsed);
      }
    } else if (!parsed.success) {
      // Store unparseable block for fallback reference
      parsedKeys.push(parsed);
    }
  }

  return parsedKeys;
}

/**
 * Correlate a PGP fingerprint across all historical Gengar darknet crawl dossiers.
 * Finds all hidden services, subpages, and cryptocurrency wallets linked to this key.
 *
 * @param {string} targetFingerprint
 * @returns {{
 *   matched: boolean,
 *   fingerprint: string,
 *   totalSites: number,
 *   onionSites: Array<{ id: string, targetUrl: string, host: string, scannedAt: string, pageTitle?: string }>,
 *   associatedWallets: Array<{ address: string, coin: string, intent: string, urgency: string, foundOn: string }>,
 *   keyDetails: object|null
 * }}
 */
function correlatePgpAcrossDossiers(targetFingerprint) {
  const cleanFp = (targetFingerprint || '').trim().toUpperCase().replace(/\s+/g, '');
  const matchedSites = [];
  const matchedWallets = [];
  let keyDetails = null;

  if (!cleanFp || !fs.existsSync(SCANS_DIR)) {
    return {
      matched: false,
      fingerprint: cleanFp,
      totalSites: 0,
      onionSites: [],
      associatedWallets: [],
      keyDetails: null,
    };
  }

  const files = fs.readdirSync(SCANS_DIR).filter(f => f.endsWith('.json'));

  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(SCANS_DIR, f), 'utf8');
      const dossier = JSON.parse(raw);

      let matchedInThisDossier = false;

      // Check parsed PGP identities
      const pgpIdentities = dossier.contacts?.pgpIdentities || [];
      for (const id of pgpIdentities) {
        if (id.fingerprint && id.fingerprint.toUpperCase() === cleanFp) {
          matchedInThisDossier = true;
          if (!keyDetails) keyDetails = id;
          break;
        }
      }

      // Check raw PGP blocks fallback
      if (!matchedInThisDossier && Array.isArray(dossier.contacts?.pgpKeys)) {
        for (const rawBlock of dossier.contacts.pgpKeys) {
          if (rawBlock.includes(cleanFp) || rawBlock.includes(cleanFp.slice(-16))) {
            matchedInThisDossier = true;
            break;
          }
        }
      }

      if (matchedInThisDossier) {
        matchedSites.push({
          id: dossier.id,
          targetUrl: dossier.targetUrl,
          host: dossier.host,
          scannedAt: dossier.scannedAt,
          pagesCrawled: dossier.pagesCrawled || 1,
        });

        // Collect wallets discovered on the same site
        if (Array.isArray(dossier.wallets)) {
          dossier.wallets.forEach(w => {
            matchedWallets.push({
              address: w.address,
              coin: w.coin,
              intent: w.intent,
              urgency: w.urgency,
              foundOn: w.foundOn,
              sourceSite: dossier.targetUrl,
            });
          });
        }
      }
    } catch (_) {}
  }

  // De-duplicate wallets
  const uniqueWallets = [];
  const seenAddr = new Set();
  matchedWallets.forEach(w => {
    if (!seenAddr.has(w.address)) {
      seenAddr.add(w.address);
      uniqueWallets.push(w);
    }
  });

  return {
    matched: matchedSites.length > 0,
    fingerprint: cleanFp,
    totalSites: matchedSites.length,
    onionSites: matchedSites,
    associatedWallets: uniqueWallets,
    keyDetails,
  };
}

/**
 * List all unique PGP identities discovered across all stored crawl dossiers.
 *
 * @returns {Array<object>}
 */
function listAllPgpIdentities() {
  if (!fs.existsSync(SCANS_DIR)) return [];
  const files = fs.readdirSync(SCANS_DIR).filter(f => f.endsWith('.json'));
  const identitiesMap = new Map();

  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(SCANS_DIR, f), 'utf8');
      const dossier = JSON.parse(raw);
      const pgpIdentities = dossier.contacts?.pgpIdentities || [];

      pgpIdentities.forEach(id => {
        if (!id.fingerprint) return;
        const fp = id.fingerprint.toUpperCase();
        if (!identitiesMap.has(fp)) {
          identitiesMap.set(fp, {
            fingerprint: fp,
            formattedFingerprint: formatFingerprint(fp),
            keyId: id.keyId,
            primaryUserId: id.primaryUserId || id.userIds?.[0] || 'Unknown Identity',
            userIds: id.userIds || [],
            algorithm: id.algorithm,
            bitLength: id.bitLength,
            created: id.created,
            expires: id.expires,
            isRevoked: id.isRevoked,
            discoveredOn: [dossier.targetUrl],
            firstSeen: dossier.scannedAt,
            lastSeen: dossier.scannedAt,
          });
        } else {
          const existing = identitiesMap.get(fp);
          if (!existing.discoveredOn.includes(dossier.targetUrl)) {
            existing.discoveredOn.push(dossier.targetUrl);
          }
          if (new Date(dossier.scannedAt) > new Date(existing.lastSeen)) {
            existing.lastSeen = dossier.scannedAt;
          }
        }
      });
    } catch (_) {}
  }

  return Array.from(identitiesMap.values()).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );
}

/**
 * Check public keyserver (keys.openpgp.org) for registration and clearnet email linkage.
 * Strictly routed through Tor SOCKS5 proxy to prevent clearnet IP leakage.
 *
 * @param {string} fingerprint
 * @param {number} [timeout=15]
 * @returns {Promise<{ found: boolean, fingerprint: string, keyserver: string, userIds?: string[], error?: string }>}
 */
async function queryKeyserver(fingerprint, timeout = 15) {
  const cleanFp = (fingerprint || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleanFp || cleanFp.length < 16) {
    return { found: false, fingerprint: cleanFp, error: 'Valid fingerprint or KeyID required' };
  }

  // Target: keys.openpgp.org VKS (Verifying Key Server) API over Tor
  const url = `https://keys.openpgp.org/vks/v1/by-fingerprint/${cleanFp}`;

  try {
    const res = await torGet(url, {
      timeout,
      headers: {
        Accept: 'application/pgp-keys',
      }
    });

    if (res.data && typeof res.data === 'string' && res.data.includes('BEGIN PGP PUBLIC KEY BLOCK')) {
      const parsed = await parsePgpKey(res.data);
      return {
        found: true,
        fingerprint: cleanFp,
        keyserver: 'keys.openpgp.org',
        keyId: parsed.keyId,
        primaryUserId: parsed.primaryUserId,
        userIds: parsed.userIds,
        created: parsed.created,
        rawArmor: res.data,
      };
    }

    return { found: false, fingerprint: cleanFp, keyserver: 'keys.openpgp.org' };
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return { found: false, fingerprint: cleanFp, keyserver: 'keys.openpgp.org' };
    }
    return {
      found: false,
      fingerprint: cleanFp,
      keyserver: 'keys.openpgp.org',
      error: err.message,
    };
  }
}

const {
  queryFederatedPgpIntelligence,
  lookupWkd,
  lookupKeybaseIdentity,
  calculateWkdHash,
} = require('./pgpFederation');

module.exports = {
  parsePgpKey,
  extractAndParseAllPgpKeys,
  formatFingerprint,
  correlatePgpAcrossDossiers,
  listAllPgpIdentities,
  queryKeyserver,
  queryFederatedPgpIntelligence,
  lookupWkd,
  lookupKeybaseIdentity,
  calculateWkdHash,
  PGP_BLOCK_REGEX,
};
