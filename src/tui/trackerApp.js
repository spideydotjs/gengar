'use strict';

const fs = require('fs');
const path = require('path');
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const chalk = require('chalk');

const {
  fetchAddressOverview,
  fetchAddressTransactions,
  analyzeTransactionsForensics,
  correlateThreatIntel,
  correlateWithGengarDarknet,
  EvidenceManager,
  THREAT_INTEL_DB,
} = require('../cryptoForensics');

function startTrackerTUI(initialAddress) {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'GENGAR // Crypto Forensics & Criminal Correlation TUI',
    fullUnicode: true,
    dockBorders: true,
  });

  // ── Grid Layout ──────────────────────────────────────────────────
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // 1. Header (Top Row: 0..1)
  const headerBox = grid.set(0, 0, 1, 12, blessed.box, {
    content: ' {bold}{magenta-fg}👻 GENGAR FORENSICS{/magenta-fg}{/bold} | Crypto Transaction Tracker & Criminal Intelligence Correlator | {cyan-fg}Tor Circuit: 127.0.0.1:9050{/cyan-fg}',
    tags: true,
    style: {
      fg: 'white',
      bg: 'black',
    },
  });

  // 2. Target Profile & Threat Score (Rows: 1..4, Cols: 0..4)
  const profileBox = grid.set(1, 0, 3, 4, blessed.box, {
    label: ' 🎯 Target Profile & Threat Gauge ',
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'yellow', bold: true },
      fg: 'white',
      bg: 'black',
    },
    content: '{yellow-fg}No target loaded. Press [S] to scan target.{/yellow-fg}',
  });

  // 3. Criminal & Darknet Intelligence Matches (Rows: 4..8, Cols: 0..4)
  const threatBox = grid.set(4, 0, 4, 4, blessed.box, {
    label: ' 🚨 Correlated Criminals & Darknet Links ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: ' ', bg: 'magenta' },
    border: { type: 'line' },
    style: {
      border: { fg: 'red', bold: true },
      fg: 'white',
      bg: 'black',
    },
    content: '{white-fg}Awaiting scan to cross-reference with OFAC, Darknet Markets, and Gengar .onion dossiers...{/white-fg}',
  });

  // 4. Clustered Addresses / Multi-Input Heuristic (Rows: 8..11, Cols: 0..4)
  const clusterBox = grid.set(8, 0, 3, 4, blessed.list, {
    label: ' 🔗 Common-Input Ownership Cluster ',
    tags: true,
    keys: true,
    mouse: true,
    scrollable: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'magenta', bold: true },
      selected: { bg: 'magenta', fg: 'white', bold: true },
      fg: 'white',
      bg: 'black',
    },
    items: ['{white-fg}No co-spent addresses identified yet.{/white-fg}'],
  });

  // 5. Transaction Ledger Table (Rows: 1..7, Cols: 4..12)
  const ledgerTable = grid.set(1, 4, 6, 8, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'black',
    selectedBg: 'cyan',
    interactive: true,
    label: ' 📜 Forensic Transaction Ledger ',
    border: { type: 'line', fg: 'cyan', bold: true },
    columnSpacing: 2,
    columnWidth: [19, 14, 8, 14, 10, 24],
    headers: ['TIMESTAMP', 'TX HASH', 'TYPE', 'AMOUNT (BTC)', 'FEE (BTC)', 'FORENSIC SIGNAL'],
  });

  // 6. Selected Transaction Deep Dive (Rows: 7..10, Cols: 4..8)
  const txDetailBox = grid.set(7, 4, 4, 4, blessed.box, {
    label: ' 🔍 Tx Inspector & Counterparty Flow ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'cyan', bold: true },
      fg: 'white',
      bg: 'black',
    },
    content: '{white-fg}Select a transaction from ledger to inspect inputs, outputs, and counterparty routing.{/white-fg}',
  });

  // 7. Forensic Log & Evidence Vault Stream (Rows: 7..10, Cols: 8..12)
  const logBox = grid.set(7, 8, 4, 4, contrib.log, {
    fg: 'green',
    selectedFg: 'green',
    label: ' 📋 Forensic Audit Stream & Evidence Vault ',
    border: { type: 'line', fg: 'green', bold: true },
    bufferLength: 50,
  });

  // 8. Command & Hotkeys Footer Bar (Row: 11, Cols: 0..12)
  const footerBar = grid.set(11, 0, 1, 12, blessed.box, {
    content: ' {bold}[S]{/bold} Scan Target  {bold}[T]{/bold} Trace Tx  {bold}[C]{/bold} Correlate  {bold}[N]{/bold} Add Note  {bold}[E]{/bold} Seal Evidence  {bold}[L]{/bold} Locker  {bold}[D]{/bold} Gengar Scans  {bold}[Tab]{/bold} Switch Panel  {bold}[Q]{/bold} Quit',
    tags: true,
    style: {
      fg: 'white',
      bg: 'blue',
      bold: true,
    },
  });

  // ── State Management ─────────────────────────────────────────────
  const state = {
    currentAddress: null,
    overview: null,
    rawTxs: [],
    analysis: null,
    threats: null,
    darknetMatch: null,
    currentCase: null,
    examinerNotes: [],
    activeElementIndex: 0,
  };

  const focusable = [ledgerTable.rows, clusterBox, txDetailBox, threatBox];

  function cycleFocus() {
    state.activeElementIndex = (state.activeElementIndex + 1) % focusable.length;
    focusable[state.activeElementIndex].focus();
    screen.render();
  }

  function addLog(msg, tag = 'INFO') {
    const time = new Date().toLocaleTimeString();
    logBox.log(`[${time}] [${tag}] ${msg}`);
    screen.render();
  }

  // ── Render Views ─────────────────────────────────────────────────
  function updateProfileView() {
    if (!state.currentAddress || !state.overview) {
      profileBox.setContent('{yellow-fg}No target loaded. Press [S] to scan.{/yellow-fg}');
      screen.render();
      return;
    }

    const o = state.overview;
    const score = state.threats ? state.threats.threatScore : 15;
    const scoreColor = score >= 80 ? 'red' : score >= 50 ? 'yellow' : 'green';
    const gaugeFilled = Math.round(score / 10);
    const gaugeBar = '█'.repeat(gaugeFilled) + '░'.repeat(10 - gaugeFilled);

    let content = `{bold}{white-fg}Target:{/white-fg}{/bold} {yellow-fg}${state.currentAddress}{/yellow-fg}\n`;
    content += `{bold}Balance:{/bold} {green-fg}${o.balanceBtc.toFixed(6)} BTC{/green-fg}\n`;
    content += `{bold}Total In:{/bold} ${o.totalReceivedBtc.toFixed(4)} BTC | {bold}Out:{/bold} ${o.totalSpentBtc.toFixed(4)} BTC\n`;
    content += `{bold}Tx Count:{/bold} ${o.txCount} confirmed\n`;
    content += `\n{bold}THREAT SCORE:{/bold} {${scoreColor}-fg}[${gaugeBar}] ${score}/100{/${scoreColor}-fg}\n`;

    if (state.currentCase) {
      content += `{magenta-fg}Case ID:{/magenta-fg} {bold}${state.currentCase.caseId}{/bold}\n`;
      content += `{cyan-fg}Evidence Seal:{/cyan-fg} ${state.currentCase.evidenceSeal.slice(0, 16)}...`;
    }

    profileBox.setContent(content);
    screen.render();
  }

  function updateThreatView() {
    let content = '';

    // Gengar Darknet cross-correlation
    if (state.darknetMatch) {
      const dm = state.darknetMatch;
      content += `{bold}{magenta-fg}🌐 GENGAR DARKNET .ONION LINK MATCHED!{/magenta-fg}{/bold}\n`;
      content += `  {bold}Hidden Service:{/bold} {cyan-fg}${dm.onionTarget}{/cyan-fg}\n`;
      content += `  {bold}NLP Context:{/bold} {yellow-fg}${dm.intent}{/yellow-fg} (${Math.round(dm.confidence * 100)}% conf)\n`;
      if (dm.pageTitle) content += `  {bold}Page Title:{/bold} ${dm.pageTitle}\n`;
      if (dm.associatedPgp?.length) content += `  {bold}PGP Public Keys:{/bold} ${dm.associatedPgp.length} keys extracted\n`;
      if (dm.associatedEmails?.length) content += `  {bold}Associated Email:{/bold} ${dm.associatedEmails.join(', ')}\n`;
      content += `\n`;
    }

    // Threat Intel DB matches
    if (state.threats && state.threats.matches.length > 0) {
      content += `{bold}{red-fg}🚨 CRIMINAL ENTITY CORRELATIONS ({bold}${state.threats.matches.length}{/bold}){/red-fg}{/bold}\n`;
      state.threats.matches.forEach(m => {
        content += `  • {bold}${m.entity}{/bold} [{yellow-fg}${m.category}{/yellow-fg}] Risk: {red-fg}${m.risk}%{/red-fg}\n`;
        content += `    {white-fg}${m.notes}{/white-fg}\n`;
      });
    } else {
      content += `{green-fg}✓ No direct OFAC or known ransomware cluster matches in database.{/green-fg}\n`;
    }

    if (state.analysis) {
      content += `\n{bold}{cyan-fg}FORENSIC HEURISTICS:{/cyan-fg}{/bold}\n`;
      content += `  • Peeling Chains: {yellow-fg}${state.analysis.peelingChainsCount}{/yellow-fg}\n`;
      content += `  • CoinJoin Mixers: {yellow-fg}${state.analysis.coinJoinsCount}{/yellow-fg}\n`;
      content += `  • Clustered Wallets: {yellow-fg}${state.analysis.coSpentAddresses.length}{/yellow-fg}\n`;
    }

    threatBox.setContent(content || '{white-fg}No threat intelligence matched.{/white-fg}');
    screen.render();
  }

  function updateClusterView() {
    if (!state.analysis || state.analysis.coSpentAddresses.length === 0) {
      clusterBox.setItems(['{white-fg}No co-spent addresses detected.{/white-fg}']);
    } else {
      const items = state.analysis.coSpentAddresses.map((addr, i) => {
        return `{bold}#${i + 1}{/bold} {cyan-fg}${addr}{/cyan-fg}`;
      });
      clusterBox.setItems(items);
    }
    screen.render();
  }

  function updateLedgerTable() {
    if (!state.analysis || !state.analysis.ledger.length) {
      ledgerTable.setData({
        headers: ['TIMESTAMP', 'TX HASH', 'TYPE', 'AMOUNT (BTC)', 'FEE (BTC)', 'FORENSIC SIGNAL'],
        data: [['N/A', 'No transactions', '-', '-', '-', '-']],
      });
      screen.render();
      return;
    }

    const rows = state.analysis.ledger.map(tx => {
      let signal = 'Normal Transfer';
      if (tx.isPeeling && tx.isMixer) signal = 'PEELING + MIXER';
      else if (tx.isPeeling) signal = 'PEELING CHAIN';
      else if (tx.isMixer) signal = 'COINJOIN MIXER';

      const shortTx = tx.txid.slice(0, 10) + '...';
      const typeStr = tx.direction === 'RECEIVED' ? 'IN' : tx.direction === 'SENT' ? 'OUT' : 'CHANGE';
      const dateStr = tx.timestamp.split('T')[0] || tx.timestamp;

      return [
        dateStr,
        shortTx,
        typeStr,
        tx.amountBtc.toFixed(6),
        tx.feeBtc.toFixed(6),
        signal,
      ];
    });

    ledgerTable.setData({
      headers: ['TIMESTAMP', 'TX HASH', 'TYPE', 'AMOUNT (BTC)', 'FEE (BTC)', 'FORENSIC SIGNAL'],
      data: rows,
    });

    screen.render();
  }

  function updateTxDetail(index = 0) {
    if (!state.analysis || !state.analysis.ledger[index]) {
      txDetailBox.setContent('{white-fg}No transaction selected.{/white-fg}');
      screen.render();
      return;
    }

    const tx = state.analysis.ledger[index];
    let content = `{bold}{white-fg}TxID:{/white-fg}{/bold} {cyan-fg}${tx.txid}{/cyan-fg}\n`;
    content += `{bold}Time:{/bold} ${tx.timestamp} | {bold}Fee:{/bold} ${tx.feeBtc.toFixed(6)} BTC\n`;
    content += `{bold}Direction:{/bold} {yellow-fg}${tx.direction}{/yellow-fg} | {bold}Net Value:{/bold} {green-fg}${tx.amountBtc.toFixed(6)} BTC{/green-fg}\n\n`;

    content += `{bold}{green-fg}INPUTS ({bold}${tx.inputs.length}{/bold}):{/green-fg}{/bold}\n`;
    tx.inputs.slice(0, 4).forEach((inp, i) => {
      content += `  [${i + 1}] ${inp.address.slice(0, 24)}... (${inp.valueBtc.toFixed(4)} BTC)\n`;
    });
    if (tx.inputs.length > 4) content += `  ...and ${tx.inputs.length - 4} more inputs\n`;

    content += `\n{bold}{magenta-fg}OUTPUTS ({bold}${tx.outputs.length}{/bold}):{/magenta-fg}{/bold}\n`;
    tx.outputs.slice(0, 4).forEach((out, i) => {
      content += `  [${i + 1}] ${out.address.slice(0, 24)}... (${out.valueBtc.toFixed(4)} BTC)\n`;
    });
    if (tx.outputs.length > 4) content += `  ...and ${tx.outputs.length - 4} more outputs\n`;

    if (tx.isPeeling) {
      content += `\n{bold}{yellow-fg}⚡ PEELING PATTERN:{/yellow-fg}{/bold} 1 input split into merchant payment and unspent change.\n`;
    }
    if (tx.isMixer) {
      content += `{bold}{red-fg}🌀 COINJOIN PATTERN:{/red-fg}{/bold} Equal denomination output signature detected.\n`;
    }

    txDetailBox.setContent(content);
    screen.render();
  }

  // ── Execute Target Investigation ─────────────────────────────────
  async function investigateAddress(address) {
    const target = address.trim();
    if (!target) return;

    state.currentAddress = target;
    addLog(`Initiating forensic tracking on target: ${target}`, 'START');

    try {
      // 1. Fetch overview
      addLog(`Querying Mempool / Blockstream APIs for ${target}...`, 'QUERY');
      const overview = await fetchAddressOverview(target);
      state.overview = overview;
      addLog(`Loaded stats: ${overview.balanceBtc.toFixed(4)} BTC balance, ${overview.txCount} txs`, 'SUCCESS');

      // 2. Fetch transactions
      addLog(`Fetching transaction ledger for ${target}...`, 'QUERY');
      const rawTxs = await fetchAddressTransactions(target, 35);
      state.rawTxs = rawTxs;
      addLog(`Retrieved ${rawTxs.length} historical transactions`, 'SUCCESS');

      // 3. Run forensic heuristics
      addLog(`Analyzing transaction graphs for peeling chains & CoinJoin...`, 'ANALYSIS');
      const analysis = analyzeTransactionsForensics(target, rawTxs);
      state.analysis = analysis;
      addLog(`Identified ${analysis.coSpentAddresses.length} clustered addresses, ${analysis.peelingChainsCount} peeling chains`, 'CLUSTER');

      // 4. Correlate with Threat Intel DB
      addLog(`Cross-referencing OFAC, Ransomware & Darknet databases...`, 'CORRELATE');
      const threats = correlateThreatIntel(target, analysis.coSpentAddresses, analysis.counterparties);
      state.threats = threats;
      if (threats.matches.length > 0) {
        addLog(`CRITICAL: Matched ${threats.matches.length} known criminal entities! Threat score: ${threats.threatScore}/100`, 'ALERT');
      } else {
        addLog(`No direct threat actor matches. Threat score: ${threats.threatScore}/100`, 'OK');
      }

      // 5. Cross-reference Gengar Darknet Scraper
      addLog(`Searching Gengar .onion crawler dossiers for wallet matches...`, 'GENGAR');
      const darknetMatch = correlateWithGengarDarknet(target);
      state.darknetMatch = darknetMatch;
      if (darknetMatch) {
        addLog(`FOUND DARKNET MATCH: Extracted from ${darknetMatch.onionTarget} (${darknetMatch.intent})`, 'DARKNET');
      }

      // Initialize or update case file
      state.currentCase = EvidenceManager.saveCaseDossier({
        caseId: state.currentCase ? state.currentCase.caseId : EvidenceManager.createCaseId(),
        targetAddress: target,
        leadExaminer: 'OPERATOR_FORENSICS',
        threatScore: threats.threatScore,
        overview,
        correlatedThreats: threats.matches,
        darknetCorrelation: darknetMatch,
        clusteredAddresses: analysis.coSpentAddresses,
        ledger: analysis.ledger,
        examinerNotes: state.examinerNotes,
      });

      addLog(`Case file updated: ${state.currentCase.caseId} (Seal: ${state.currentCase.evidenceSeal.slice(0, 12)}...)`, 'EVIDENCE');

      // Render UI
      updateProfileView();
      updateThreatView();
      updateClusterView();
      updateLedgerTable();
      updateTxDetail(0);

    } catch (err) {
      addLog(`Forensic scan error: ${err.message}`, 'ERROR');
    }
  }

  // ── Interactive Modals ───────────────────────────────────────────
  function showScanModal() {
    const modal = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '60%',
      border: { type: 'line' },
      style: {
        border: { fg: 'yellow', bold: true },
        bg: 'black',
      },
      tags: true,
      label: ' 🎯 Target Bitcoin Address Selector ',
    });

    const form = blessed.form({
      parent: modal,
      keys: true,
      left: 2,
      top: 1,
      right: 2,
      bottom: 1,
    });

    const label = blessed.text({
      parent: form,
      top: 0,
      left: 0,
      content: '{bold}Enter Bitcoin Address:{/bold}',
      tags: true,
    });

    const input = blessed.textbox({
      parent: form,
      top: 2,
      left: 0,
      right: 0,
      height: 3,
      inputOnFocus: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        fg: 'white',
        bg: 'black',
      },
      value: state.currentAddress || '',
    });

    const presetLabel = blessed.text({
      parent: form,
      top: 6,
      left: 0,
      content: '{bold}Quick Presets (Darknet & Case Demos):{/bold}',
      tags: true,
    });

    const presetsList = blessed.list({
      parent: form,
      top: 8,
      left: 0,
      right: 0,
      bottom: 4,
      keys: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'magenta', bold: true },
        selected: { bg: 'magenta', fg: 'white', bold: true },
        fg: 'white',
        bg: 'black',
      },
      items: [
        '1. WannaCry Global Extortion (115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn)',
        '2. Silk Road FBI Seizure Wallet (1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX)',
        '3. LockBit 3.0 Extortion Address (bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh)',
        '4. Satoshi Genesis Block (1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa)',
        '5. Binance Hot VASP Deposit (1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s)',
      ],
    });

    const submitBtn = blessed.button({
      parent: form,
      bottom: 0,
      left: 'center',
      width: 20,
      height: 3,
      content: '  [ SCAN TARGET ]',
      style: {
        bg: '#f59e0b',
        fg: 'white',
        bold: true,
        focus: { bg: '#fbbf24' },
      },
    });

    presetsList.on('select', (item, idx) => {
      const addrs = [
        '115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn',
        '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        '1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s',
      ];
      input.setValue(addrs[idx]);
      screen.render();
    });

    submitBtn.on('press', () => {
      const target = input.getValue().trim();
      modal.destroy();
      screen.render();
      if (target) {
        investigateAddress(target);
      }
    });

    input.key('enter', () => submitBtn.emit('press'));

    modal.key(['escape'], () => {
      modal.destroy();
      screen.render();
    });

    input.focus();
    screen.render();
  }

  function showAddNoteModal() {
    const modal = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '40%',
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan', bold: true },
        bg: 'black',
      },
      tags: true,
      label: ' 📝 Add Forensic Examiner Note to Case File ',
    });

    const input = blessed.textbox({
      parent: modal,
      top: 2,
      left: 2,
      right: 2,
      height: 4,
      inputOnFocus: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        fg: 'white',
        bg: 'black',
      },
    });

    const saveBtn = blessed.button({
      parent: modal,
      bottom: 1,
      left: 'center',
      width: 22,
      height: 3,
      content: '  [ SEAL IN CASE ]',
      style: {
        bg: 'cyan',
        fg: 'white',
        bold: true,
        focus: { bg: '#67e8f9' },
      },
    });

    saveBtn.on('press', () => {
      const note = input.getValue().trim();
      modal.destroy();
      screen.render();
      if (note && state.currentCase) {
        state.examinerNotes.push(`[${new Date().toISOString()}] ${note}`);
        state.currentCase = EvidenceManager.saveCaseDossier({
          ...state.currentCase,
          examinerNotes: state.examinerNotes,
        });
        addLog(`Examiner note recorded & evidence re-sealed: "${note}"`, 'NOTE');
        updateProfileView();
      }
    });

    input.key('enter', () => saveBtn.emit('press'));
    modal.key(['escape'], () => {
      modal.destroy();
      screen.render();
    });

    input.focus();
    screen.render();
  }

  function showSealEvidenceModal() {
    if (!state.currentCase) {
      addLog('No active case loaded to seal. Scan a target first.', 'WARN');
      return;
    }

    const modal = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '75%',
      height: '65%',
      border: { type: 'line' },
      style: {
        border: { fg: '#10b981' },
        bg: 'black',
      },
      tags: true,
      label: ' 🔒 Cryptographic Evidence Certificate & Chain of Custody ',
    });

    const c = state.currentCase;
    let content = `{bold}{green-fg}TAMPER-EVIDENT FORENSIC EVIDENCE CERTIFICATE{/green-fg}{/bold}\n`;
    content += `───────────────────────────────────────────────────────────────────\n`;
    content += `{bold}CASE DOSSIER ID:{/bold} {yellow-fg}${c.caseId}{/yellow-fg}\n`;
    content += `{bold}TARGET ASSET:{/bold}    {cyan-fg}${c.targetAddress}{/cyan-fg}\n`;
    content += `{bold}SHA-256 SEAL:{/bold}    {bold}{green-fg}${c.evidenceSeal}{/green-fg}{/bold}\n`;
    content += `{bold}SEALING TIME:{/bold}    ${c.lastModified}\n`;
    content += `{bold}LEAD EXAMINER:{/bold}   ${c.leadExaminer}\n`;
    content += `{bold}THREAT SCORE:{/bold}    ${c.threatScore}/100\n`;
    content += `───────────────────────────────────────────────────────────────────\n`;
    content += `{bold}CHAIN OF CUSTODY AUDIT ENTRIES ({bold}${c.chainOfCustody?.length || 0}{/bold}):{/bold}\n`;

    (c.chainOfCustody || []).forEach((entry, idx) => {
      content += `  [${idx + 1}] ${entry.timestamp} | Officer: ${entry.officer}\n`;
      content += `      Action: ${entry.action} | Seal: ${entry.sealHash?.slice(0, 20)}...\n`;
    });

    content += `\n{bold}EVIDENCE LOCATION:{/bold} data/evidence/${c.caseId}.json\n`;
    content += `{white-fg}Admissible under Federal Rules of Evidence Rule 902(13)/(14) (Certified Records Generated by an Electronic Process).{/white-fg}\n\n`;
    content += `Press [Escape] or [Enter] to return to forensics terminal.`;

    modal.setContent(content);

    modal.key(['escape', 'enter'], () => {
      modal.destroy();
      screen.render();
    });

    modal.focus();
    screen.render();
  }

  function showGengarDarknetModal() {
    const scansDir = path.join(__dirname, '..', '..', 'data', 'scans');
    const modal = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '70%',
      border: { type: 'line' },
      style: {
        border: { fg: 'magenta', bold: true },
        bg: 'black',
      },
      tags: true,
      label: ' 🌐 Discovered Darknet Wallets from Gengar .onion Scraper ',
    });

    const items = [];
    const walletMap = [];

    if (fs.existsSync(scansDir)) {
      const files = fs.readdirSync(scansDir).filter(f => f.endsWith('.json'));
      files.forEach(f => {
        try {
          const raw = fs.readFileSync(path.join(scansDir, f), 'utf8');
          const d = JSON.parse(raw);
          (d.wallets || []).forEach(w => {
            if (w.coin === 'BTC') {
              items.push(`[${w.intent}] ${w.address} (from ${d.targetUrl})`);
              walletMap.push(w.address);
            }
          });
        } catch (_) {}
      });
    }

    if (items.length === 0) {
      modal.setContent('{yellow-fg}No Bitcoin wallets found in local Gengar darknet crawl dossiers yet.{/yellow-fg}\n\nRun searches in the Gengar web UI or execute deep scans first.\n\nPress [Escape] to close.');
      modal.key(['escape', 'enter'], () => {
        modal.destroy();
        screen.render();
      });
      modal.focus();
      screen.render();
      return;
    }

    const list = blessed.list({
      parent: modal,
      top: 2,
      left: 1,
      right: 1,
      bottom: 2,
      keys: true,
      border: { type: 'line' },
      style: {
        border: { fg: '#a855f7' },
        selected: { bg: 'magenta', fg: 'white', bold: true },
        fg: 'white',
        bg: 'black',
      },
      items,
    });

    list.on('select', (_, idx) => {
      const selectedAddr = walletMap[idx];
      modal.destroy();
      screen.render();
      if (selectedAddr) {
        investigateAddress(selectedAddr);
      }
    });

    modal.key(['escape'], () => {
      modal.destroy();
      screen.render();
    });

    list.focus();
    screen.render();
  }

  // ── Keyboard Navigation ──────────────────────────────────────────
  screen.key(['tab'], () => cycleFocus());

  screen.key(['s', 'S'], () => showScanModal());
  screen.key(['n', 'N'], () => showAddNoteModal());
  screen.key(['e', 'E'], () => showSealEvidenceModal());
  screen.key(['d', 'D'], () => showGengarDarknetModal());

  screen.key(['c', 'C'], () => {
    if (state.currentAddress) {
      investigateAddress(state.currentAddress);
    } else {
      showScanModal();
    }
  });

  screen.key(['q', 'Q', 'C-c'], () => {
    return process.exit(0);
  });

  // Table selection handler
  ledgerTable.rows.on('select', (_, idx) => {
    updateTxDetail(idx);
  });

  // Initial Load
  const initial = initialAddress || '115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn';
  investigateAddress(initial);

  ledgerTable.rows.focus();
  screen.render();
}

module.exports = { startTrackerTUI };
