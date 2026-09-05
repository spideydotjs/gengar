/**
 * gengar/src/logger.js
 * ─────────────────────────────────────────────────────────────────
 * Simple request / event logger with chalk colouring.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const chalk = require('chalk');

const ICONS = {
  info: chalk.cyan('ℹ'),
  ok: chalk.green('✔'),
  warn: chalk.yellow('⚠'),
  error: chalk.red('✖'),
  ghost: chalk.magenta('👻'),
};

function log(level, ...args) {
  const icon = ICONS[level] ?? ICONS.info;
  const timestamp = chalk.dim(new Date().toISOString());
  console.log(`${timestamp} ${icon}`, ...args);
}

const logger = {
  info: (...a) => log('info', ...a),
  ok: (...a) => log('ok', ...a),
  warn: (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a),
  ghost: (...a) => log('ghost', ...a),

  /** Express-compatible request logger middleware */
  middleware(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      const color = status >= 500 ? chalk.red
        : status >= 400 ? chalk.yellow
          : chalk.green;
      console.log(
        `${chalk.dim(new Date().toISOString())} ${chalk.bold('HTTP')}`,
        color(`${status}`),
        chalk.white(`${req.method} ${req.originalUrl}`),
        chalk.dim(`${ms}ms`),
      );
    });
    next();
  },
};

module.exports = logger;
