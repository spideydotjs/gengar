/**
 * gengar/src/torClient.js
 * ─────────────────────────────────────────────────────────────────
 * Axios instance that routes ALL traffic through the local Tor SOCKS5
 * proxy (127.0.0.1:9050).  Every request made with this client
 * automatically exits through Tor — required to reach .onion addresses.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const axios              = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

// ── Tor SOCKS5 proxy ───────────────────────────────────────────────
const TOR_SOCKS = process.env.TOR_SOCKS || 'socks5h://127.0.0.1:9050';

/**
 * createTorAgent()
 * Returns a fresh SocksProxyAgent for each request.
 * Using socks5h:// ensures DNS is resolved inside Tor (needed for .onion).
 */
function createTorAgent() {
  return new SocksProxyAgent(TOR_SOCKS);
}

/**
 * torGet(url, options?)
 * Performs a GET through Tor.  Throws on HTTP errors or network failure.
 *
 * @param {string} url
 * @param {object} [options]   - axios request config overrides
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function torGet(url, options = {}) {
  const agent = createTorAgent();

  // Destructure timeout + headers out so they don't override our converted values
  const { timeout: timeoutSec, headers: extraHeaders, ...restOptions } = options;

  return axios.get(url, {
    httpAgent : agent,
    httpsAgent: agent,
    timeout   : (timeoutSec ?? 30) * 1000,   // convert seconds → ms (default 30 s)
    headers   : {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
      ...extraHeaders,
    },
    ...restOptions,
  });
}

/**
 * checkTorConnectivity()
 * Quick sanity check – hits check.torproject.org to confirm we're on Tor.
 * Returns { ok: boolean, ip: string|null, message: string }
 */
async function checkTorConnectivity() {
  try {
    const res = await torGet('https://check.torproject.org/api/ip', { timeout: 20 });
    const body = res.data;
    if (body && body.IsTor) {
      return { ok: true, ip: body.IP, message: `Tor is active. Exit IP: ${body.IP}` };
    }
    return { ok: false, ip: body?.IP, message: 'Connected but NOT through Tor!' };
  } catch (err) {
    return { ok: false, ip: null, message: `Tor connectivity check failed: ${err.message}` };
  }
}

module.exports = { torGet, checkTorConnectivity, TOR_SOCKS };
