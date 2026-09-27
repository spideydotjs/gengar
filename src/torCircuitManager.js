/**
 * Gengar Dark-Web OSINT & Forensics Suite
 * Tor Circuit Cycling & Stream Isolation Manager
 * 
 * Standards & Protocols:
 * - Tor Control Protocol (TCPSocket / RFC / Tor control-spec.txt)
 * - Tor SOCKS5 Stream Isolation (IsolateSOCKSAuth / RFC 1928)
 * - On-demand SIGNAL NEWNYM execution & identity rotation
 */

'use strict';

const net = require('net');
const crypto = require('crypto');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const logger = require('./logger');

// Environment & Configuration
const TOR_SOCKS_URL = process.env.TOR_SOCKS || 'socks5h://127.0.0.1:9050';
const TOR_CONTROL_HOST = process.env.TOR_CONTROL_HOST || '127.0.0.1';
const TOR_CONTROL_PORT = parseInt(process.env.TOR_CONTROL_PORT || '9051', 10);
const TOR_CONTROL_PASSWORD = process.env.TOR_CONTROL_PASSWORD || '';

// Internal Circuit State
let activeCircuitToken = `gengar_${crypto.randomBytes(6).toString('hex')}`;
let lastRotatedAt = new Date().toISOString();
let lastControlNewnymAt = 0;
let lastKnownExitIp = null;
let autoCycleTimer = null;
const circuitHistory = [];

/**
 * Parses base SOCKS configuration and injects stream isolation credentials
 * @param {string} token - Custom isolation token (circuit ID)
 * @returns {string} SOCKS URL with isolated credentials
 */
function buildIsolatedSocksUrl(token = activeCircuitToken) {
  try {
    const url = new URL(TOR_SOCKS_URL);
    // Set username/password to enforce Tor IsolateSOCKSAuth
    url.username = token;
    url.password = 'gengar_auth';
    return url.toString();
  } catch (_) {
    // If URL parsing fails, format directly
    return `socks5h://${token}:gengar_auth@127.0.0.1:9050`;
  }
}

/**
 * Returns a SocksProxyAgent for a specific circuit or current active circuit
 * @param {string} [circuitToken]
 * @returns {SocksProxyAgent}
 */
function getIsolatedTorAgent(circuitToken) {
  const socksUrl = buildIsolatedSocksUrl(circuitToken || activeCircuitToken);
  return new SocksProxyAgent(socksUrl);
}

/**
 * Sends a raw command to the Tor ControlPort via TCP socket
 * @param {string} host
 * @param {number} port
 * @param {string} password
 * @param {string} command
 * @param {number} [timeoutMs=4000]
 * @returns {Promise<{ ok: boolean, response: string, message: string }>}
 */
function sendTorControlCommand(host, port, password, command, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let responseData = '';
    let settled = false;

    const finalize = (result) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch (_) {}
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      // Step 1: Authenticate with Tor ControlPort
      const authCmd = password ? `AUTHENTICATE "${password}"\r\n` : `AUTHENTICATE ""\r\n`;
      socket.write(authCmd);
    });

    socket.on('data', (chunk) => {
      responseData += chunk.toString();

      // Check if authentication succeeded
      if (responseData.includes('250 OK') && !responseData.includes('SIGNAL')) {
        // Send actual requested command (e.g. SIGNAL NEWNYM)
        socket.write(`${command}\r\n`);
      } else if (responseData.includes('515 Authentication failed') || responseData.includes('514')) {
        finalize({
          ok: false,
          response: responseData.trim(),
          message: 'Tor ControlPort authentication failed: password required or invalid.',
        });
      } else if (responseData.includes('250 OK') && responseData.includes(command.split(' ')[0])) {
        finalize({
          ok: true,
          response: responseData.trim(),
          message: `Tor ControlPort successfully executed: ${command}`,
        });
      }
    });

    socket.on('timeout', () => {
      finalize({
        ok: false,
        response: responseData.trim(),
        message: `Tor ControlPort connection timed out after ${timeoutMs}ms.`,
      });
    });

    socket.on('error', (err) => {
      finalize({
        ok: false,
        response: '',
        message: `Tor ControlPort unavailable on ${host}:${port} (${err.code || err.message}).`,
      });
    });

    socket.on('close', () => {
      finalize({
        ok: responseData.includes('250 OK') && responseData.includes('SIGNAL'),
        response: responseData.trim(),
        message: responseData.includes('250 OK') ? 'Tor ControlPort command executed.' : 'ControlPort socket closed.',
      });
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      finalize({
        ok: false,
        response: '',
        message: `Tor ControlPort connection attempt failed: ${err.message}`,
      });
    }
  });
}


/**
 * Query current exit IP through Tor
 * @param {string} [circuitToken]
 * @returns {Promise<string|null>}
 */
async function fetchCurrentExitIp(circuitToken) {
  try {
    const agent = getIsolatedTorAgent(circuitToken);
    const res = await axios.get('https://check.torproject.org/api/ip', {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
      },
    });
    if (res.data && res.data.IP) {
      lastKnownExitIp = res.data.IP;
      return res.data.IP;
    }
    return null;
  } catch (err) {
    logger.debug(`Could not determine exit IP through Tor: ${err.message}`);
    return null;
  }
}

/**
 * Cycle Tor Circuit
 * 
 * Executes dual-action rotation:
 * 1. Sends SIGNAL NEWNYM to Tor ControlPort (if available, with 10s cooldown check)
 * 2. Generates new SOCKS5 stream isolation token (immediate circuit allocation without delay)
 * 3. Records rotation in history log
 * 
 * @param {object} [options]
 * @param {boolean} [options.verifyExitIp=true] - Whether to hit check.torproject.org to get new IP
 * @returns {Promise<object>} Cycle result
 */
async function cycleCircuit(options = {}) {
  const { verifyExitIp = true } = options;
  const previousToken = activeCircuitToken;
  const previousIp = lastKnownExitIp;
  const startTime = Date.now();

  // 1. Generate fresh stream isolation token
  const newToken = `gengar_${crypto.randomBytes(6).toString('hex')}`;
  activeCircuitToken = newToken;
  lastRotatedAt = new Date().toISOString();

  // 2. Attempt SIGNAL NEWNYM on ControlPort if cooldown permits
  let controlResult = { ok: false, message: 'ControlPort not queried' };
  const now = Date.now();
  const timeSinceLastControl = now - lastControlNewnymAt;

  if (timeSinceLastControl >= 10000) {
    // Tor enforces MaxNewnymRate (typically 10s)
    controlResult = await sendTorControlCommand(
      TOR_CONTROL_HOST,
      TOR_CONTROL_PORT,
      TOR_CONTROL_PASSWORD,
      'SIGNAL NEWNYM',
      2500
    );
    if (controlResult.ok) {
      lastControlNewnymAt = now;
    }
  } else {
    controlResult = {
      ok: false,
      message: `SIGNAL NEWNYM throttled by Tor rate limiter (wait ${Math.ceil((10000 - timeSinceLastControl) / 1000)}s). Using SOCKS5 Stream Isolation.`,
    };
  }

  // 3. Optionally verify new exit IP
  let newIp = null;
  if (verifyExitIp) {
    newIp = await fetchCurrentExitIp(newToken);
  }

  const durationMs = Date.now() - startTime;
  const methodUsed = controlResult.ok ? 'CONTROL_PORT_SIGNAL_NEWNYM' : 'SOCKS5_STREAM_ISOLATION';

  const cycleRecord = {
    id: `cycle_${Date.now()}`,
    timestamp: lastRotatedAt,
    previousToken,
    newToken,
    previousIp,
    newIp,
    method: methodUsed,
    controlPortSuccess: controlResult.ok,
    controlMessage: controlResult.message,
    durationMs,
  };

  // Keep last 25 records
  circuitHistory.unshift(cycleRecord);
  if (circuitHistory.length > 25) {
    circuitHistory.pop();
  }

  logger.info(`[TorCircuit] Cycled identity -> ${newToken} (${methodUsed}) Exit IP: ${newIp || 'Pending'}`);

  return {
    success: true,
    circuitId: newToken,
    previousCircuitId: previousToken,
    previousIp,
    newIp,
    method: methodUsed,
    controlPort: {
      available: controlResult.ok,
      message: controlResult.message,
    },
    rotatedAt: lastRotatedAt,
    durationMs,
  };
}

/**
 * Get current circuit status and history
 * @returns {object} Status details
 */
function getCircuitStatus() {
  return {
    activeCircuitId: activeCircuitToken,
    lastRotatedAt,
    lastKnownExitIp,
    controlPortConfig: {
      host: TOR_CONTROL_HOST,
      port: TOR_CONTROL_PORT,
      hasPassword: Boolean(TOR_CONTROL_PASSWORD),
    },
    streamIsolationEnabled: true,
    autoCycleActive: Boolean(autoCycleTimer),
    historyCount: circuitHistory.length,
    recentCycles: circuitHistory.slice(0, 10),
  };
}

/**
 * Configure or disable automated background circuit rotation
 * @param {number|null} intervalMinutes - Interval in minutes (min 1, max 60), or null/0 to disable
 * @returns {object} Updated auto-cycle state
 */
function configureAutoCycle(intervalMinutes) {
  if (autoCycleTimer) {
    clearInterval(autoCycleTimer);
    autoCycleTimer = null;
  }

  if (!intervalMinutes || intervalMinutes <= 0) {
    logger.info('[TorCircuit] Automated circuit cycling disabled.');
    return { enabled: false, intervalMinutes: 0 };
  }

  const clamped = Math.max(1, Math.min(60, Number(intervalMinutes)));
  const ms = clamped * 60 * 1000;

  autoCycleTimer = setInterval(() => {
    logger.info(`[TorCircuit] Automated cycle triggered (${clamped}m interval).`);
    cycleCircuit({ verifyExitIp: false }).catch((err) => {
      logger.error(`[TorCircuit] Auto-cycle failed: ${err.message}`);
    });
  }, ms);

  // Prevent keeping Node alive if nothing else is running
  if (autoCycleTimer.unref) {
    autoCycleTimer.unref();
  }

  logger.info(`[TorCircuit] Automated circuit cycling enabled every ${clamped} minutes.`);
  return { enabled: true, intervalMinutes: clamped };
}

module.exports = {
  buildIsolatedSocksUrl,
  getIsolatedTorAgent,
  sendTorControlCommand,
  fetchCurrentExitIp,
  cycleCircuit,
  getCircuitStatus,
  configureAutoCycle,
  TOR_CONTROL_HOST,
  TOR_CONTROL_PORT,
};
