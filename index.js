/**
 * gengar/index.js
 * ─────────────────────────────────────────────────────────────────
 *  ██████╗ ███████╗███╗   ██╗ ██████╗  █████╗ ██████╗
 * ██╔════╝ ██╔════╝████╗  ██║██╔════╝ ██╔══██╗██╔══██╗
 * ██║  ███╗█████╗  ██╔██╗ ██║██║  ███╗███████║██████╔╝
 * ██║   ██║██╔══╝  ██║╚██╗██║██║   ██║██╔══██║██╔══██╗
 * ╚██████╔╝███████╗██║ ╚████║╚██████╔╝██║  ██║██║  ██║
 *  ╚═════╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
 *
 * Dark-web search & hidden-service prober API
 * Powered by Ahmia .onion + Tor SOCKS5 proxy
 * ─────────────────────────────────────────────────────────────────
 * FOR EDUCATIONAL / RESEARCH USE ONLY.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const chalk = require('chalk');
const logger = require('./src/logger');
const searchRoute = require('./src/routes/search');
const { closeBrowser } = require('./src/ahmia');

// ── Config ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 6700;  // 6666 is browser-blocked (ERR_UNSAFE_PORT)
const HOST = process.env.HOST || '127.0.0.1';   // localhost only by default
const TOR_SOCK = process.env.TOR_SOCKS || 'socks5h://127.0.0.1:9050';

// ── App ────────────────────────────────────────────────────────────
const app = express();

app.use(cors());            // ← allow all origins (browser-accessible)
app.use(express.json());
app.use(logger.middleware);

// ── Static Frontend ────────────────────────────────────────────────
const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// ── Health check endpoint ──────────────────────────────────────────
const healthPayload = {
  tool: 'Gengar',
  version: '1.0.0',
  status: 'online',
  tor: TOR_SOCK,
  endpoints: {
    health: 'GET  /api/health',
    torStatus: 'GET  /api/tor-status',
    search: 'GET  /api/search?q=<query>[&probe=true][&page=0][&timeout=25]',
    probe: 'POST /api/probe  body: { urls: ["http://abc.onion"] }',
  },
};

app.get('/api/health', (req, res) => {
  res.json(healthPayload);
});

// Root handler: serve React index.html if built, else fallback to JSON health check
app.get('/', (req, res) => {
  const indexHtml = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  res.json(healthPayload);
});

// ── Mount routes ───────────────────────────────────────────────────
app.use('/api', searchRoute);

// ── Fallback handler for client-side routing & 404s ────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }
  const indexHtml = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global error handler ───────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

// ── Banner ─────────────────────────────────────────────────────────
function printBanner() {
  // Ghost art — each line padded to a fixed width so the info panel sits flush
  const GHOST_W = 36;
  const pad = (s) => {
    // Strip ANSI before measuring, pad with spaces to GHOST_W
    const visLen = s.replace(/\u001b\[[0-9;]*m/g, '').length;
    return s + ' '.repeat(Math.max(0, GHOST_W - visLen));
  };

  const ghost = [
    '⠀⠀⠀⠀⠀⢸⠓⢄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
    '⠀⠀⠀⠀⠀⢸⠀⠀⠑⢤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
    '⠀⠀⠀⠀⠀⢸⡆⠀⠀⠀⠙⢤⡷⣤⣦⣀⠤⠖⠚⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀',
    '⣠⡿⠢⢄⡀⠀⡇⠀⠀⠀⠀⠀⠉⠀⠀⠀⠀⠀⠸⠷⣶⠂⠀⠀⠀⣀⣀⠀⠀⠀',
    '⢸⣃⠀⠀⠉⠳⣷⠞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠉⠉⠉⠉⠉⠉⢉⡭⠋',
    '⠀⠘⣆⠀⠀⠀⠁⠀⢀⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡴⠋⠀⠀',
    '⠀⠀⠘⣦⠆⠀⠀⢀⡎⢹⡀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⡀⣠⠔⠋⠀⠀⠀⠀',
    '⠀⠀⠀⡏⠀⠀⣆⠘⣄⠸⢧⠀⠀⠀⠀⢀⣠⠖⢻⠀⠀⠀⣿⢥⣄⣀⣀⣀⠀⠀',
    '⠀⠀⢸⠁⠀⠀⡏⢣⣌⠙⠚⠀⠀⠠⣖⡛⠀⣠⠏⠀⠀⠀⠇⠀⠀⠀⠀⢙⣣⠄',
    '⠀⠀⢸⡀⠀⠀⠳⡞⠈⢻⠶⠤⣄⣀⣈⣉⣉⣡⡔⠀⠀⢀⠀⠀⣀⡤⠖⠚⠀⠀',
    '⠀⠀⡼⣇⠀⠀⠀⠙⠦⣞⡀⠀⢀⡏⠀⢸⣣⠞⠀⠀⠀⡼⠚⠋⠁⠀⠀⠀⠀⠀',
    '⠀⢰⡇⠙⠀⠀⠀⠀⠀⠀⠉⠙⠚⠒⠚⠉⠀⠀⠀⠀⡼⠁⠀⠀⠀⠀⠀⠀⠀⠀',
    '⠀⠀⢧⡀⠀⢠⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⣞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀',
    '⠀⠀⠀⠙⣶⣶⣿⠢⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
    '⠀⠀⠀⠀⠀⠉⠀⠀⠀⠙⢿⣳⠞⠳⡄⠀⠀⠀⢀⡞⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
    '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠀⠀⠹⣄⣀⡤⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀'
  ];

  // Info panel lines (no emojis)
  const sep   = chalk.dim('─'.repeat(38));
  const info  = [
    chalk.magenta.bold('  GENGAR'),
    chalk.dim('  Dark-web Search + Hidden-Service Prober'),
    chalk.dim('  For educational / research use only.'),
    '  ' + sep,
    '',
    '  ' + chalk.cyan('Tool   ') + chalk.dim(':') + '  ' + chalk.white('Gengar v1.0.0'),
    '  ' + chalk.cyan('Host   ') + chalk.dim(':') + '  ' + chalk.white(`${HOST}:${PORT}`),
    '  ' + chalk.cyan('Proxy  ') + chalk.dim(':') + '  ' + chalk.white(TOR_SOCK),
    '',
    '  ' + chalk.cyan('Routes ') + chalk.dim(':'),
    '  ' + chalk.dim('  GET  ') + chalk.white('/api/tor-status'),
    '  ' + chalk.dim('  GET  ') + chalk.white('/api/search?q=<term>&probe=true'),
    '  ' + chalk.dim('  POST ') + chalk.white('/api/probe'),
    '',
    '  ' + sep,
    '  ' + chalk.dim('All traffic routes through Tor SOCKS5'),
  ];

  // Merge ghost + info side by side
  const totalRows = Math.max(ghost.length, info.length);
  console.log('');
  for (let i = 0; i < totalRows; i++) {
    const leftRaw = ghost[i] ?? '';
    const right   = info[i]  ?? '';
    // Pad ghost column to fixed visual width
    const visLen  = leftRaw.replace(/\u001b\[[0-9;]*m/g, '').length;
    const padded  = leftRaw + ' '.repeat(Math.max(0, GHOST_W - visLen));
    const left    = chalk.magenta.bold(padded);
    console.log('  ' + left + '   ' + right);
  }
  console.log('');
}

// ── Start ──────────────────────────────────────────────────────────
const server = app.listen(PORT, HOST, () => {
  printBanner();
  logger.info(chalk.bold('Gengar is active. Listening on ' + HOST + ':' + PORT));
});

// ── Graceful Shutdown ──────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
  server.close(async () => {
    try {
      await closeBrowser();
    } catch (_) {}
    process.exit(0);
  });

  // Force exit after 5 seconds if connections linger
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
