/**
 * Gengar Dark-Web OSINT & Forensics Suite
 * Federated PGP Intelligence & Cross-Reference Engine
 * ─────────────────────────────────────────────────────────────────
 * Multi-Keyserver Federation (SKS/HKP, Hagrid/VKS, Keybase API,
 * and IETF RFC Web Key Directory WKD verification over Tor).
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const openpgp = require('openpgp');
const { torGet } = require('./torClient');
const logger = require('./logger');

// RFC 6189 / z-base-32 alphabet for WKD local-part 160-bit SHA-1 digest
const ZBASE32_ALPHABET = 'ybndrfg8ejkmcpqxot1uwisza345h769';

/**
 * Encode a binary buffer into z-base-32 representation (32 characters for 20-byte SHA1)
 * @param {Buffer|Uint8Array} buf
 * @returns {string}
 */
function encodeZBase32(buf) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += ZBASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += ZBASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Compute the 32-character WKD hash for an email address
 * @param {string} email
 * @returns {{ localPart: string, domain: string, zhash: string }|null}
 */
function calculateWkdHash(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return null;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [localPart, domain] = parts;
  const sha1Digest = crypto.createHash('sha1').update(localPart).digest();
  const zhash = encodeZBase32(sha1Digest);

  return { localPart, domain, zhash };
}

/**
 * Extract email addresses from PGP User ID strings
 * e.g., "Satoshi Nakamoto <satoshin@gmx.com>" -> ["satoshin@gmx.com"]
 * @param {string[]|string} userIds
 * @returns {string[]}
 */
function extractEmailsFromUserIds(userIds) {
  if (!userIds) return [];
  const list = Array.isArray(userIds) ? userIds : [userIds];
  const emails = new Set();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  for (const uid of list) {
    if (typeof uid !== 'string') continue;
    const matches = uid.match(emailRegex) || [];
    for (const em of matches) {
      emails.add(em.toLowerCase());
    }
  }

  return Array.from(emails);
}

/**
 * Perform WKD (Web Key Directory) lookup for an email address over Tor
 * Checks both Advanced (openpgpkey.domain) and Direct (domain) methods
 * @param {string} email
 * @param {number} [timeout=8]
 * @returns {Promise<{ verified: boolean, email: string, domain: string, fingerprint?: string, keyId?: string, userIds?: string[], method?: string, error?: string }>}
 */
async function lookupWkd(email, timeout = 8) {
  const wkdInfo = calculateWkdHash(email);
  if (!wkdInfo) {
    return { verified: false, email, error: 'Invalid email format' };
  }

  const { localPart, domain, zhash } = wkdInfo;

  // Try Advanced Method first (openpgpkey.domain), then Direct Method (domain)
  const candidateUrls = [
    { method: 'ADVANCED', url: `https://openpgpkey.${domain}/.well-known/openpgpkey/${domain}/hu/${zhash}?l=${encodeURIComponent(localPart)}` },
    { method: 'DIRECT', url: `https://${domain}/.well-known/openpgpkey/hu/${zhash}?l=${encodeURIComponent(localPart)}` }
  ];

  for (const item of candidateUrls) {
    try {
      const res = await torGet(item.url, {
        timeout,
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'application/octet-stream, application/pgp-keys',
        }
      });

      if (res.status === 200 && res.data) {
        try {
          const rawBuffer = Buffer.from(res.data);
          let key;
          // Check if response is armored ASCII or binary key packet
          if (rawBuffer.toString('utf8').includes('BEGIN PGP PUBLIC KEY BLOCK')) {
            key = await openpgp.readKey({ armoredKey: rawBuffer.toString('utf8').trim() });
          } else {
            key = await openpgp.readKey({ binaryKey: new Uint8Array(rawBuffer) });
          }

          const fp = key.getFingerprint().toUpperCase();
          const keyId = key.getKeyID().toHex().toUpperCase();
          const uids = await key.getUserIDs();

          return {
            verified: true,
            email,
            domain,
            method: item.method,
            endpointUrl: item.url,
            fingerprint: fp,
            keyId,
            userIds: uids,
            created: key.getCreationTime()?.toISOString() || null,
          };
        } catch (parseErr) {
          logger.warn(`[WKD] Found key at ${item.url} but parse failed: ${parseErr.message}`);
        }
      }
    } catch (err) {
      // 404 or connection error is normal if domain does not publish WKD for this user
    }
  }

  return { verified: false, email, domain, error: 'No WKD published by domain' };
}

/**
 * Query keys.openpgp.org (VKS Hagrid) over Tor
 * @param {string} cleanFp
 * @param {number} [timeout=10]
 */
async function lookupKeysOpenPgp(cleanFp, timeout = 10) {
  const url = `https://keys.openpgp.org/vks/v1/by-fingerprint/${cleanFp}`;
  try {
    const res = await torGet(url, {
      timeout,
      headers: { Accept: 'application/pgp-keys' }
    });

    if (res.data && typeof res.data === 'string' && res.data.includes('BEGIN PGP PUBLIC KEY BLOCK')) {
      const key = await openpgp.readKey({ armoredKey: res.data.trim() });
      const userIds = await key.getUserIDs();
      return {
        found: true,
        keyserver: 'keys.openpgp.org',
        type: 'VKS_HAGRID',
        fingerprint: key.getFingerprint().toUpperCase(),
        keyId: key.getKeyID().toHex().toUpperCase(),
        primaryUserId: userIds[0] || 'Unspecified Identity',
        userIds,
        created: key.getCreationTime()?.toISOString() || null,
        rawArmor: res.data.trim(),
      };
    }
    return { found: false, keyserver: 'keys.openpgp.org' };
  } catch (err) {
    return { found: false, keyserver: 'keys.openpgp.org', error: err.response?.status === 404 ? 'Not found' : err.message };
  }
}

/**
 * Query Ubuntu SKS/HKP Keyserver over Tor
 * @param {string} cleanFp
 * @param {number} [timeout=10]
 */
async function lookupUbuntuKeyserver(cleanFp, timeout = 10) {
  const url = `https://keyserver.ubuntu.com/pks/lookup?op=get&options=mr&search=0x${cleanFp}`;
  try {
    const res = await torGet(url, {
      timeout,
      headers: { Accept: 'application/pgp-keys, text/plain' }
    });

    if (res.data && typeof res.data === 'string' && res.data.includes('BEGIN PGP PUBLIC KEY BLOCK')) {
      const key = await openpgp.readKey({ armoredKey: res.data.trim() });
      const userIds = await key.getUserIDs();
      return {
        found: true,
        keyserver: 'keyserver.ubuntu.com',
        type: 'SKS_HKP',
        fingerprint: key.getFingerprint().toUpperCase(),
        keyId: key.getKeyID().toHex().toUpperCase(),
        primaryUserId: userIds[0] || 'Unspecified Identity',
        userIds,
        created: key.getCreationTime()?.toISOString() || null,
        rawArmor: res.data.trim(),
      };
    }
    return { found: false, keyserver: 'keyserver.ubuntu.com' };
  } catch (err) {
    return { found: false, keyserver: 'keyserver.ubuntu.com', error: err.response?.status === 404 ? 'Not found' : err.message };
  }
}

/**
 * Query Keybase API over Tor for social identities linked to PGP fingerprint
 * Resolves Twitter, GitHub, Reddit, Hackernews, domains, and crypto wallets
 * @param {string} cleanFp
 * @param {number} [timeout=10]
 */
async function lookupKeybaseIdentity(cleanFp, timeout = 10) {
  const url = `https://keybase.io/_/api/1.0/user/lookup.json?key_fingerprint=${cleanFp}`;
  try {
    const res = await torGet(url, { timeout });
    if (res.data && res.data.status?.code === 0 && res.data.them) {
      const user = res.data.them;
      // If user not found, them is often an empty array or object without basics
      if (!user.basics || !user.basics.username) {
        return { found: false, provider: 'keybase.io' };
      }

      const username = user.basics.username;
      const profile = {
        username,
        fullName: user.profile?.full_name || null,
        bio: user.profile?.bio || null,
        location: user.profile?.location || null,
        keybaseProfileUrl: `https://keybase.io/${username}`,
      };

      const proofs = [];
      const proofsGroup = user.proofs_summary?.by_presentation_group || {};

      for (const groupKey of Object.keys(proofsGroup)) {
        const groupProofs = proofsGroup[groupKey] || [];
        for (const p of groupProofs) {
          proofs.push({
            platform: p.proof_type,
            nametag: p.nametag,
            humanUrl: p.human_url || null,
            serviceUrl: p.service_url || null,
            state: p.state === 1 ? 'VERIFIED' : 'UNVERIFIED',
          });
        }
      }

      // Also check cryptocurrency addresses published on Keybase profile
      const wallets = [];
      if (user.cryptocurrency_addresses) {
        for (const [coin, list] of Object.entries(user.cryptocurrency_addresses)) {
          if (Array.isArray(list)) {
            list.forEach(w => wallets.push({ coin, address: w.address }));
          }
        }
      }

      return {
        found: true,
        provider: 'keybase.io',
        username,
        profile,
        proofs,
        wallets,
      };
    }
    return { found: false, provider: 'keybase.io' };
  } catch (err) {
    return { found: false, provider: 'keybase.io', error: err.response?.status === 404 ? 'Not found' : err.message };
  }
}

/**
 * Aggregated Federated PGP Intelligence Query
 * Concurrently queries keys.openpgp.org, Ubuntu SKS keyserver, Keybase social proofs,
 * and executes Web Key Directory (WKD) lookups for known email addresses.
 *
 * @param {string} fingerprint
 * @param {object} [options]
 * @param {string[]} [options.userIds]
 * @param {number} [options.timeout=10]
 * @returns {Promise<object>}
 */
async function queryFederatedPgpIntelligence(fingerprint, options = {}) {
  const cleanFp = (fingerprint || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleanFp || cleanFp.length < 16) {
    return {
      success: false,
      fingerprint: cleanFp,
      error: 'Valid 40-character fingerprint or 16-character KeyID required',
    };
  }

  const timeout = options.timeout || 10;
  const emailsToCheck = new Set(extractEmailsFromUserIds(options.userIds || []));

  // Run keyserver and Keybase lookups in parallel over Tor
  const [openPgpRes, ubuntuRes, keybaseRes] = await Promise.allSettled([
    lookupKeysOpenPgp(cleanFp, timeout),
    lookupUbuntuKeyserver(cleanFp, timeout),
    lookupKeybaseIdentity(cleanFp, timeout),
  ]);

  const keysOpenPgp = openPgpRes.status === 'fulfilled' ? openPgpRes.value : { found: false, error: openPgpRes.reason?.message };
  const ubuntuHkp = ubuntuRes.status === 'fulfilled' ? ubuntuRes.value : { found: false, error: ubuntuRes.reason?.message };
  const keybase = keybaseRes.status === 'fulfilled' ? keybaseRes.value : { found: false, error: keybaseRes.reason?.message };

  // Add any discovered emails from keyserver userIds into WKD check list
  if (keysOpenPgp.userIds) {
    extractEmailsFromUserIds(keysOpenPgp.userIds).forEach(e => emailsToCheck.add(e));
  }
  if (ubuntuHkp.userIds) {
    extractEmailsFromUserIds(ubuntuHkp.userIds).forEach(e => emailsToCheck.add(e));
  }

  // Execute WKD checks for all detected emails
  const wkdChecks = [];
  for (const em of Array.from(emailsToCheck).slice(0, 3)) { // Cap to top 3 to prevent rate limits
    wkdChecks.push(lookupWkd(em, timeout));
  }
  const wkdResults = (await Promise.allSettled(wkdChecks)).map(r => r.status === 'fulfilled' ? r.value : { verified: false });

  // Merge unique clearnet identities / user IDs
  const clearnetIdentities = new Set();
  (keysOpenPgp.userIds || []).forEach(u => clearnetIdentities.add(u));
  (ubuntuHkp.userIds || []).forEach(u => clearnetIdentities.add(u));

  // Merge social profiles discovered from Keybase
  const socialProfiles = [];
  if (keybase.found && keybase.proofs) {
    keybase.proofs.forEach(p => {
      socialProfiles.push({
        platform: p.platform,
        handle: p.nametag,
        url: p.humanUrl || p.serviceUrl,
        verified: p.state === 'VERIFIED',
      });
    });
  }

  const foundAny = Boolean(
    keysOpenPgp.found ||
    ubuntuHkp.found ||
    keybase.found ||
    wkdResults.some(w => w.verified)
  );

  return {
    success: true,
    fingerprint: cleanFp,
    foundAny,
    summary: {
      keysOpenPgpFound: Boolean(keysOpenPgp.found),
      ubuntuHkpFound: Boolean(ubuntuHkp.found),
      keybaseFound: Boolean(keybase.found),
      wkdVerifiedCount: wkdResults.filter(w => w.verified).length,
      socialProfilesDiscovered: socialProfiles.length,
      totalClearnetIdentities: clearnetIdentities.size,
    },
    clearnetIdentities: Array.from(clearnetIdentities),
    socialProfiles,
    keybaseUser: keybase.found ? keybase.profile : null,
    keybaseWallets: keybase.found ? (keybase.wallets || []) : [],
    federatedKeyservers: {
      keysOpenPgp,
      ubuntuHkp,
      keybase,
      wkd: wkdResults,
    },
  };
}

module.exports = {
  ZBASE32_ALPHABET,
  encodeZBase32,
  calculateWkdHash,
  extractEmailsFromUserIds,
  lookupWkd,
  lookupKeysOpenPgp,
  lookupUbuntuKeyserver,
  lookupKeybaseIdentity,
  queryFederatedPgpIntelligence,
};
