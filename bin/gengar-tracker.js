#!/usr/bin/env node
'use strict';

const { startTrackerTUI } = require('../src/tui/trackerApp');

const targetAddress = process.argv[2] || null;

try {
  startTrackerTUI(targetAddress);
} catch (err) {
  console.error('[Gengar Forensics TUI Fatal Error]:', err);
  process.exit(1);
}
