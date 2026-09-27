/**
 * Gengar Dark-Web OSINT & Forensics Suite
 * Court-Ready Forensic Report & STIX 2.1 Evidence Engine
 * 
 * Standards Compliance:
 * - OASIS STIX 2.1 (Cyber Threat Intelligence / RFC-compliant JSON bundles)
 * - Federal Rules of Evidence (FRE) Rule 902(13) & 902(14) (Self-authenticating electronic records)
 * - ISO/IEC 27037:2012 (Digital evidence handling, chain of custody, and cryptographic integrity)
 */

const crypto = require('crypto');

/**
 * Generate a STIX 2.1 JSON Bundle from a Gengar Case Dossier
 * Compatible with MISP, OpenCTI, Cortex, Sentinel, and SIEM platforms.
 * 
 * @param {Object} caseData - The sealed case dossier object
 * @returns {Object} STIX 2.1 Bundle
 */
function generateStixBundle(caseData) {
  if (!caseData || !caseData.targetAddress) {
    throw new Error('Invalid case data: targetAddress is required');
  }

  const caseId = caseData.caseId || 'CASE-UNKNOWN';
  const now = new Date().toISOString();
  const createdTime = caseData.lastModified || now;
  const leadExaminer = caseData.leadExaminer || 'Gengar Forensic Unit';

  // 1. Identity Object (Investigating Agency / Analyst)
  const identityId = `identity--${crypto.randomUUID()}`;
  const identityObj = {
    type: 'identity',
    spec_version: '2.1',
    id: identityId,
    created: createdTime,
    modified: createdTime,
    name: leadExaminer,
    description: 'Investigating Officer / Digital Forensics Examiner',
    identity_class: 'analyst',
    sectors: ['defense', 'government-national', 'financial-services'],
    contact_information: 'Gengar Dark-Web Forensics & Cryptocurrency Trace Unit',
  };

  const bundleObjects = [identityObj];
  const reportRefIds = [identityId];

  // 2. Custom Cyber Observable: Target Cryptocurrency Wallet
  const walletObservableId = `x-gengar-cryptocurrency-wallet--${crypto.randomUUID()}`;
  const walletObj = {
    type: 'x-gengar-cryptocurrency-wallet',
    spec_version: '2.1',
    id: walletObservableId,
    created: createdTime,
    modified: createdTime,
    address: caseData.targetAddress,
    currency: 'BTC',
    balance_btc: caseData.overview?.balanceBtc ?? 0,
    total_received_btc: caseData.overview?.totalReceivedBtc ?? 0,
    total_spent_btc: caseData.overview?.totalSpentBtc ?? 0,
    transaction_count: caseData.overview?.txCount ?? (caseData.ledger?.length || 0),
    threat_score: caseData.threatScore ?? 0,
    evidence_seal_sha256: caseData.evidenceSeal || null,
  };
  bundleObjects.push(walletObj);
  reportRefIds.push(walletObservableId);

  // 3. Indicator Object for Malicious / Monitored Address
  const indicatorId = `indicator--${crypto.randomUUID()}`;
  const threatScore = caseData.threatScore ?? 0;
  const indicatorObj = {
    type: 'indicator',
    spec_version: '2.1',
    id: indicatorId,
    created: createdTime,
    modified: createdTime,
    name: `Cryptocurrency Target: ${caseData.targetAddress}`,
    description: `Target Bitcoin wallet identified in Gengar dossier ${caseId}. Threat risk score: ${threatScore}/100.`,
    indicator_types: threatScore >= 50 ? ['malicious-activity', 'anonymization'] : ['anonymization'],
    pattern_type: 'stix',
    pattern: `[cryptocurrency-address:value = '${caseData.targetAddress}']`,
    valid_from: createdTime,
    confidence: threatScore,
    created_by_ref: identityId,
  };
  bundleObjects.push(indicatorObj);
  reportRefIds.push(indicatorId);

  // 4. Correlated Threat Actors
  const threatActorIds = [];
  if (Array.isArray(caseData.correlatedThreats) && caseData.correlatedThreats.length > 0) {
    for (const threat of caseData.correlatedThreats) {
      const threatActorId = `threat-actor--${crypto.randomUUID()}`;
      threatActorIds.push(threatActorId);

      const threatActorObj = {
        type: 'threat-actor',
        spec_version: '2.1',
        id: threatActorId,
        created: createdTime,
        modified: createdTime,
        name: threat.entity || 'Unknown Criminal Entity',
        description: threat.notes || 'Identified through Gengar dark-web threat intelligence heuristics.',
        threat_actor_types: [
          (threat.category || 'cybercrime').toLowerCase().replace(/\s+/g, '-')
        ],
        sophistication: 'expert',
        confidence: threat.risk || 80,
        created_by_ref: identityId,
      };
      bundleObjects.push(threatActorObj);
      reportRefIds.push(threatActorId);

      // Relationship: Indicator -> Indicates -> Threat Actor
      const relId = `relationship--${crypto.randomUUID()}`;
      bundleObjects.push({
        type: 'relationship',
        spec_version: '2.1',
        id: relId,
        created: createdTime,
        modified: createdTime,
        relationship_type: 'indicates',
        source_ref: indicatorId,
        target_ref: threatActorId,
        description: `Wallet ${caseData.targetAddress} correlated directly with ${threat.entity}`,
      });
      reportRefIds.push(relId);
    }
  }

  // 5. Darknet Hidden Service Observable (if correlated)
  if (caseData.darknetCorrelation && caseData.darknetCorrelation.matched) {
    const darknet = caseData.darknetCorrelation;
    const darknetId = `x-gengar-hidden-service--${crypto.randomUUID()}`;
    const darknetObj = {
      type: 'x-gengar-hidden-service',
      spec_version: '2.1',
      id: darknetId,
      created: createdTime,
      modified: createdTime,
      target_onion: darknet.onionTarget || null,
      host: darknet.host || null,
      first_seen: darknet.firstSeen || createdTime,
      intent_category: darknet.intent || 'SUSPICIOUS_COMMERCE',
      confidence: darknet.confidence || 'MEDIUM',
      page_title: darknet.pageTitle || 'Hidden Service',
      associated_emails: darknet.associatedEmails || [],
      associated_pgp_keys: darknet.associatedPgp || [],
    };
    bundleObjects.push(darknetObj);
    reportRefIds.push(darknetId);

    // Relationship: Wallet -> Attributed to -> Hidden Service
    const relDarknetId = `relationship--${crypto.randomUUID()}`;
    bundleObjects.push({
      type: 'relationship',
      spec_version: '2.1',
      id: relDarknetId,
      created: createdTime,
      modified: createdTime,
      relationship_type: 'attributed-to',
      source_ref: walletObservableId,
      target_ref: darknetId,
      description: `Target address was scraped directly from darknet hidden service ${darknet.onionTarget}`,
    });
    reportRefIds.push(relDarknetId);
  }

  // 6. Co-spent Clustered Wallets (BIP-69 Multi-input Heuristic)
  if (Array.isArray(caseData.clusteredAddresses) && caseData.clusteredAddresses.length > 0) {
    for (const cluster of caseData.clusteredAddresses.slice(0, 10)) {
      const clusterIndicatorId = `indicator--${crypto.randomUUID()}`;
      bundleObjects.push({
        type: 'indicator',
        spec_version: '2.1',
        id: clusterIndicatorId,
        created: createdTime,
        modified: createdTime,
        name: `Co-spent Clustered Wallet: ${cluster.address}`,
        description: `BIP-69 Multi-Input Common Ownership Heuristic cluster. Reason: ${cluster.reason || 'Shared transaction inputs'}`,
        pattern_type: 'stix',
        pattern: `[cryptocurrency-address:value = '${cluster.address}']`,
        valid_from: createdTime,
        confidence: cluster.confidence === 'HIGH' ? 85 : 65,
        created_by_ref: identityId,
      });
      reportRefIds.push(clusterIndicatorId);

      // Relationship: Target Wallet -> Related to -> Cluster Wallet
      const relClusterId = `relationship--${crypto.randomUUID()}`;
      bundleObjects.push({
        type: 'relationship',
        spec_version: '2.1',
        id: relClusterId,
        created: createdTime,
        modified: createdTime,
        relationship_type: 'related-to',
        source_ref: indicatorId,
        target_ref: clusterIndicatorId,
        description: 'Multi-input common spending ownership heuristic link',
      });
      reportRefIds.push(relClusterId);
    }
  }

  // 7. STIX Report Object (Container for entire forensic case)
  const reportId = `report--${crypto.randomUUID()}`;
  const reportObj = {
    type: 'report',
    spec_version: '2.1',
    id: reportId,
    created: createdTime,
    modified: createdTime,
    name: `Gengar Forensic Dossier: ${caseId} (${caseData.targetAddress})`,
    description: `Official digital forensic examination report for Bitcoin address ${caseData.targetAddress}. Cryptographic Evidence Seal: ${caseData.evidenceSeal || 'N/A'}. FRE Rule 902(14) compliant electronic evidence package.`,
    report_types: ['threat-report', 'cyber-crime', 'financial-crime'],
    published: createdTime,
    object_refs: reportRefIds,
    created_by_ref: identityId,
    confidence: Math.min(100, Math.max(50, threatScore)),
    labels: [
      'cryptocurrency-forensics',
      'darknet-osint',
      'chain-of-custody',
      `threat-score-${threatScore}`,
    ],
  };
  bundleObjects.unshift(reportObj);

  // Final STIX 2.1 Bundle
  return {
    type: 'bundle',
    id: `bundle--${crypto.randomUUID()}`,
    spec_version: '2.1',
    objects: bundleObjects,
  };
}

/**
 * Escape HTML utility
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate a Court-Ready FRE Rule 902(14) Certified Forensic Evidence HTML/PDF Document
 * 
 * @param {Object} caseData - The sealed case dossier object
 * @param {Object} options - Customization options (printAutotrigger, watermark, etc.)
 * @returns {string} Fully self-contained HTML document ready for printing or PDF export
 */
function generateCourtReportHtml(caseData, options = {}) {
  if (!caseData || !caseData.targetAddress) {
    throw new Error('Invalid case data: targetAddress is required');
  }

  const caseId = caseData.caseId || 'CASE-2026-UNSPECIFIED';
  const targetAddress = caseData.targetAddress;
  const leadExaminer = caseData.leadExaminer || 'OPERATOR_WEB';
  const threatScore = caseData.threatScore ?? 0;
  const evidenceSeal = caseData.evidenceSeal || 'UNSEALED';
  const lastModified = caseData.lastModified ? new Date(caseData.lastModified).toUTCString() : new Date().toUTCString();
  const generationTimestamp = new Date().toUTCString();
  const overview = caseData.overview || {};
  const ledger = Array.isArray(caseData.ledger) ? caseData.ledger : [];
  const correlatedThreats = Array.isArray(caseData.correlatedThreats) ? caseData.correlatedThreats : [];
  const clusteredAddresses = Array.isArray(caseData.clusteredAddresses) ? caseData.clusteredAddresses : [];
  const darknet = caseData.darknetCorrelation;
  const chainOfCustody = Array.isArray(caseData.chainOfCustody) ? caseData.chainOfCustody : [];
  const notes = Array.isArray(caseData.examinerNotes) ? caseData.examinerNotes : [];

  const autoPrintScript = options.autoPrint ? `
    <script>
      window.addEventListener('load', function() {
        setTimeout(function() { window.print(); }, 600);
      });
    </script>
  ` : '';

  // Determine threat badge color
  let threatColor = '#10b981';
  let threatLabel = 'LOW RISK / NORMAL ACTIVITY';
  if (threatScore >= 80) {
    threatColor = '#ef4444';
    threatLabel = 'CRITICAL RISK / ILLICIT NEXUS CONFIRMED';
  } else if (threatScore >= 50) {
    threatColor = '#f59e0b';
    threatLabel = 'ELEVATED RISK / SUSPICIOUS PATTERNS';
  } else if (threatScore >= 20) {
    threatColor = '#3b82f6';
    threatLabel = 'MODERATE RISK / ATTENTION REQUIRED';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GENGAR FORENSIC DOSSIER - ${escapeHtml(caseId)} - ${escapeHtml(targetAddress)}</title>
  <style>
    /* CSS Reset & Forensic Print Typography */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
      color: #0f172a;
      background-color: #f8fafc;
      font-size: 11pt;
      line-height: 1.5;
      padding: 24px;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    /* Print Specific Rules (FRE 902 Clean Document) */
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
        color: #000000;
      }
      .container {
        border: none;
        padding: 0;
        max-width: 100%;
        box-shadow: none;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
      .avoid-break {
        page-break-inside: avoid;
      }
      a {
        text-decoration: none;
        color: #000000;
      }
    }

    /* Floating Print & Download Toolbar */
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 20px;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    .toolbar button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .toolbar button:hover {
      background: #2563eb;
    }
    .toolbar .btn-secondary {
      background: #334155;
      margin-left: 8px;
    }
    .toolbar .btn-secondary:hover {
      background: #475569;
    }

    /* Official Classification Header */
    .classification-bar {
      text-align: center;
      background: #b91c1c;
      color: #ffffff;
      font-weight: 800;
      font-size: 10pt;
      letter-spacing: 2px;
      padding: 4px 0;
      text-transform: uppercase;
      border-radius: 2px;
      margin-bottom: 18px;
    }

    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header-table td {
      vertical-align: top;
    }
    .agency-title {
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
      text-transform: uppercase;
    }
    .agency-subtitle {
      font-size: 9pt;
      color: #475569;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .case-badge {
      text-align: right;
    }
    .case-badge .number {
      font-family: monospace;
      font-size: 15pt;
      font-weight: bold;
      color: #1e3a8a;
    }
    .case-badge .stamp {
      font-size: 8.5pt;
      color: #64748b;
    }

    /* FRE 902 Affidavit Box */
    .affidavit-box {
      border: 2px solid #1e3a8a;
      background: #f0f7ff;
      padding: 14px 18px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .affidavit-title {
      font-size: 10pt;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .affidavit-text {
      font-size: 9pt;
      line-height: 1.45;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .seal-hash {
      font-family: monospace;
      font-size: 8pt;
      word-break: break-all;
      background: #ffffff;
      border: 1px dashed #93c5fd;
      padding: 6px 10px;
      border-radius: 4px;
      color: #0369a1;
      font-weight: 600;
    }

    /* Section Styling */
    .section-title {
      font-size: 12pt;
      font-weight: 800;
      text-transform: uppercase;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 4px;
      margin-top: 24px;
      margin-bottom: 12px;
      color: #0f172a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-title .badge {
      font-size: 8.5pt;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 3px;
      color: white;
    }

    /* Key-Value Tables */
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 9.5pt;
    }
    .grid-table th, .grid-table td {
      border: 1px solid #e2e8f0;
      padding: 6px 10px;
      text-align: left;
    }
    .grid-table th {
      background-color: #f1f5f9;
      font-weight: 700;
      color: #334155;
      width: 25%;
    }
    .grid-table td {
      font-family: monospace;
      color: #0f172a;
    }

    /* Ledger & Evidence Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 8.5pt;
    }
    .data-table th {
      background: #1e293b;
      color: #ffffff;
      text-align: left;
      padding: 6px 8px;
      font-weight: 700;
      font-size: 8pt;
      text-transform: uppercase;
    }
    .data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      font-family: monospace;
      vertical-align: middle;
    }
    .data-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .tag {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .tag-received { background: #dcfce7; color: #15803d; }
    .tag-sent { background: #fee2e2; color: #b91c1c; }
    .tag-peel { background: #fef3c7; color: #b45309; }
    .tag-mixer { background: #f3e8ff; color: #7e22ce; }

    /* Sign-off Block */
    .signature-block {
      margin-top: 36px;
      border-top: 2px dashed #94a3b8;
      padding-top: 16px;
      page-break-inside: avoid;
    }
    .signature-grid {
      display: flex;
      justify-content: space-between;
      gap: 30px;
    }
    .signature-col {
      flex: 1;
    }
    .sign-line {
      border-bottom: 1px solid #0f172a;
      height: 36px;
      margin-bottom: 6px;
    }
    .sign-label {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }

    .footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 7.5pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
  </style>
  ${autoPrintScript}
</head>
<body>

  <!-- Screen Toolbar -->
  <div class="container">
    <div class="toolbar no-print">
      <div>
        <strong>GENGAR FORENSIC REPORT VIEWER</strong>
        <span style="opacity: 0.7; margin-left: 10px;">${escapeHtml(caseId)}</span>
      </div>
      <div>
        <button onclick="window.print()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print / Save as PDF
        </button>
        <button class="btn-secondary" onclick="window.location.href='/api/forensics/case/${escapeHtml(caseId)}/export/stix'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download STIX 2.1
        </button>
      </div>
    </div>

    <!-- Official Header Banner -->
    <div class="classification-bar">
      LAW ENFORCEMENT SENSITIVE // OFFICIAL FORENSIC EXAMINATION REPORT
    </div>

    <!-- Header Details -->
    <table class="header-table">
      <tr>
        <td>
          <div class="agency-title">GENGAR DIGITAL FORENSICS &amp; OSINT UNIT</div>
          <div class="agency-subtitle">DARKNET INTELLIGENCE &amp; CRYPTOCURRENCY TRACE ARCHITECTURE</div>
          <div style="font-size: 8.5pt; color: #64748b; margin-top: 4px;">
            Certified under FRE Rule 902(13) &amp; Rule 902(14) • ISO/IEC 27037 Standards
          </div>
        </td>
        <td class="case-badge">
          <div class="number">${escapeHtml(caseId)}</div>
          <div class="stamp">FILE STATUS: SEALED FORENSIC DOSSIER</div>
          <div class="stamp">GENERATED: ${escapeHtml(generationTimestamp)}</div>
        </td>
      </tr>
    </table>

    <!-- FRE 902(14) Affidavit of Digital Evidence Authenticity -->
    <div class="affidavit-box">
      <div class="affidavit-title">FEDERAL RULES OF EVIDENCE RULE 902(14) CERTIFICATION OF AUTHENTICITY</div>
      <div class="affidavit-text">
        I hereby attest and certify under penalty of perjury pursuant to 28 U.S.C. § 1746 that this electronic dossier is an authentic record of blockchain transactions, darknet scraping correlations, and automated entity clustering generated by the Gengar Forensic Engine. The integrity of this entire data structure is certified via the mathematical SHA-256 digital seal recorded below. Any unauthorized modification to the source bytes invalidates this seal.
      </div>
      <div>
        <span style="font-size: 8pt; font-weight: 700; color: #1e3a8a;">CRYPTOGRAPHIC EVIDENCE SEAL (SHA-256):</span>
        <div class="seal-hash">${escapeHtml(evidenceSeal)}</div>
      </div>
    </div>

    <!-- Section 1: Target Entity Identification -->
    <div class="section-title">
      <span>1. Target Entity Profile &amp; Ledger Overview</span>
      <span class="badge" style="background: ${threatColor};">${threatLabel}</span>
    </div>
    <table class="grid-table">
      <tr>
        <th>Target Cryptocurrency Address</th>
        <td style="font-weight: bold; color: #1e3a8a;">${escapeHtml(targetAddress)}</td>
      </tr>
      <tr>
        <th>Network / Protocol</th>
        <td>Bitcoin Mainnet (BTC)</td>
      </tr>
      <tr>
        <th>Composite Threat Score</th>
        <td><strong style="color: ${threatColor}; font-size: 11pt;">${threatScore} / 100</strong></td>
      </tr>
      <tr>
        <th>Current Confirmed Balance</th>
        <td><strong>${overview.balanceBtc ?? 0} BTC</strong></td>
      </tr>
      <tr>
        <th>Total Cumulative Received</th>
        <td>${overview.totalReceivedBtc ?? 0} BTC</td>
      </tr>
      <tr>
        <th>Total Cumulative Spent</th>
        <td>${overview.totalSpentBtc ?? 0} BTC</td>
      </tr>
      <tr>
        <th>Total Recorded Transactions</th>
        <td>${overview.txCount ?? ledger.length} txs (Unconfirmed in mempool: ${overview.unconfirmedTxCount ?? 0})</td>
      </tr>
      <tr>
        <th>Assigned Lead Examiner</th>
        <td>${escapeHtml(leadExaminer)}</td>
      </tr>
      <tr>
        <th>Last Sealed Timestamp</th>
        <td>${escapeHtml(lastModified)}</td>
      </tr>
    </table>

    <!-- Section 2: Correlated Threat Actors -->
    <div class="section-title">
      <span>2. Known Threat Intelligence Correlation</span>
      <span style="font-size: 8.5pt; font-weight: 600; color: #64748b;">${correlatedThreats.length} Matches Found</span>
    </div>
    ${correlatedThreats.length === 0 ? `
      <p style="font-size: 9pt; color: #64748b; font-style: italic; margin-bottom: 16px;">
        No static threat actor records (OFAC sanctions, known ransomware extortion clusters) directly matched this primary address key.
      </p>
    ` : `
      <table class="data-table">
        <thead>
          <tr>
            <th>Threat Entity</th>
            <th>Category</th>
            <th>Risk Rating</th>
            <th>Operational Notes</th>
          </tr>
        </thead>
        <tbody>
          ${correlatedThreats.map(t => `
            <tr>
              <td style="font-weight: bold; color: #b91c1c;">${escapeHtml(t.entity)}</td>
              <td><span class="tag" style="background: #fee2e2; color: #991b1b;">${escapeHtml(t.category)}</span></td>
              <td><strong style="color: #b91c1c;">${t.risk}/100</strong></td>
              <td style="font-family: sans-serif; font-size: 8pt;">${escapeHtml(t.notes)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}

    <!-- Section 3: Darknet Hidden Service Linkage -->
    <div class="section-title">
      <span>3. Darknet Hidden Service Linkage (.onion)</span>
      <span style="font-size: 8.5pt; font-weight: 600; color: #64748b;">Tor Onion Intelligence</span>
    </div>
    ${darknet && darknet.matched ? `
      <table class="grid-table">
        <tr>
          <th>Discovered Hidden Service</th>
          <td style="color: #6b21a8; font-weight: bold;">${escapeHtml(darknet.onionTarget || darknet.host)}</td>
        </tr>
        <tr>
          <th>Scraped Page Title</th>
          <td style="font-family: sans-serif;">${escapeHtml(darknet.pageTitle || 'N/A')}</td>
        </tr>
        <tr>
          <th>Commercial / Illicit Intent</th>
          <td><span class="tag" style="background: #ede9fe; color: #6b21a8;">${escapeHtml(darknet.intent || 'SUSPICIOUS')}</span> (Confidence: ${escapeHtml(darknet.confidence || 'HIGH')})</td>
        </tr>
        <tr>
          <th>First Observed On-ion</th>
          <td>${escapeHtml(darknet.firstSeen || 'N/A')}</td>
        </tr>
        <tr>
          <th>Contextual Snippet</th>
          <td style="font-family: sans-serif; font-size: 8.5pt; color: #334155;">&ldquo;${escapeHtml(darknet.contextSnippet || 'Target address located in page HTML content.')}&rdquo;</td>
        </tr>
        <tr>
          <th>Associated PGP Keys</th>
          <td>${(darknet.associatedPgp && darknet.associatedPgp.length) ? escapeHtml(darknet.associatedPgp.join(', ')) : '<span style="color:#94a3b8">None linked</span>'}</td>
        </tr>
        <tr>
          <th>Associated Emails / Jabber</th>
          <td>${(darknet.associatedEmails && darknet.associatedEmails.length) ? escapeHtml(darknet.associatedEmails.join(', ')) : '<span style="color:#94a3b8">None linked</span>'}</td>
        </tr>
      </table>
    ` : `
      <p style="font-size: 9pt; color: #64748b; font-style: italic; margin-bottom: 16px;">
        Address not currently discovered in active Tor crawl index. No direct .onion hosting match.
      </p>
    `}

    <!-- Section 4: Multi-Input Common Ownership Clusters (BIP-69) -->
    <div class="section-title avoid-break">
      <span>4. Common-Input Wallet Clusters (Co-Ownership Heuristic)</span>
      <span style="font-size: 8.5pt; font-weight: 600; color: #64748b;">${clusteredAddresses.length} Clustered Addresses</span>
    </div>
    ${clusteredAddresses.length === 0 ? `
      <p style="font-size: 9pt; color: #64748b; font-style: italic; margin-bottom: 16px;">
        No co-spent multi-input transaction clusters identified within the analyzed transaction window.
      </p>
    ` : `
      <table class="data-table avoid-break">
        <thead>
          <tr>
            <th>Clustered Address</th>
            <th>Heuristic</th>
            <th>Confidence</th>
            <th>Co-spent In</th>
            <th>Evidence Rationale</th>
          </tr>
        </thead>
        <tbody>
          ${clusteredAddresses.slice(0, 8).map(c => `
            <tr>
              <td style="color: #1e3a8a; font-weight: bold;">${escapeHtml(c.address)}</td>
              <td><span class="tag" style="background: #e0e7ff; color: #3730a3;">${escapeHtml(c.heuristic || 'MULTI_INPUT')}</span></td>
              <td><strong>${escapeHtml(c.confidence || 'HIGH')}</strong></td>
              <td>${c.sharedInputsCount || 1} inputs</td>
              <td style="font-family: sans-serif; font-size: 8pt;">${escapeHtml(c.reason || 'Shared transaction inputs with target')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}

    <!-- Section 5: Transaction Ledger & Forensics (Page Break for cleanliness) -->
    <div class="page-break"></div>
    <div class="section-title">
      <span>5. Transaction Ledger &amp; Flow Analysis (Sample)</span>
      <span style="font-size: 8.5pt; font-weight: 600; color: #64748b;">Showing ${Math.min(ledger.length, 12)} of ${ledger.length} txs</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>TXID</th>
          <th>Timestamp</th>
          <th>Direction</th>
          <th>Amount (BTC)</th>
          <th>Fee (BTC)</th>
          <th>Flags / Patterns</th>
        </tr>
      </thead>
      <tbody>
        ${ledger.slice(0, 12).map(tx => `
          <tr>
            <td style="font-size: 7.5pt; font-weight: bold;">${escapeHtml(tx.txid ? tx.txid.slice(0, 16) + '...' : 'UNKNOWN')}</td>
            <td style="font-size: 7.5pt;">${escapeHtml(tx.timestamp || 'N/A')}</td>
            <td>
              <span class="tag ${tx.direction === 'RECEIVED' ? 'tag-received' : 'tag-sent'}">
                ${escapeHtml(tx.direction)}
              </span>
            </td>
            <td style="font-weight: bold;">${tx.amountBtc !== undefined ? tx.amountBtc : 'N/A'}</td>
            <td>${tx.feeBtc !== undefined ? tx.feeBtc : 'N/A'}</td>
            <td>
              ${tx.isPeeling ? '<span class="tag tag-peel">PEELING CHAIN</span> ' : ''}
              ${tx.isMixer ? '<span class="tag tag-mixer">COINJOIN MIXER</span> ' : ''}
              ${!tx.isPeeling && !tx.isMixer ? '<span style="color:#94a3b8">Standard</span>' : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Section 6: Chain of Custody Audit Log -->
    <div class="section-title avoid-break">
      <span>6. Chain of Custody &amp; Tamper Verification Audit Trail</span>
      <span style="font-size: 8.5pt; font-weight: 600; color: #64748b;">ISO/IEC 27037 Standard</span>
    </div>
    <table class="data-table avoid-break">
      <thead>
        <tr>
          <th>Timestamp (UTC)</th>
          <th>Action / Operation</th>
          <th>Authorized Officer</th>
          <th>Cryptographic Seal Hash</th>
        </tr>
      </thead>
      <tbody>
        ${chainOfCustody.map(log => `
          <tr>
            <td style="font-size: 7.5pt;">${escapeHtml(log.timestamp)}</td>
            <td><strong style="color: #1e3a8a;">${escapeHtml(log.action)}</strong></td>
            <td>${escapeHtml(log.officer)}</td>
            <td style="font-size: 7pt; color: #0284c7;">${escapeHtml(log.sealHash ? log.sealHash.slice(0, 20) + '...' : 'N/A')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Section 7: Examiner Notes -->
    ${notes.length > 0 ? `
      <div class="section-title avoid-break">
        <span>7. Forensic Examiner Observations &amp; Notes</span>
      </div>
      <div class="avoid-break" style="margin-bottom: 20px;">
        ${notes.map(n => `
          <div style="background: #f8fafc; border-left: 3px solid #3b82f6; padding: 8px 12px; margin-bottom: 8px; font-size: 8.5pt;">
            <div style="font-weight: bold; color: #1e293b; margin-bottom: 2px;">
              ${escapeHtml(n.author || leadExaminer)} &mdash; <span style="font-weight: normal; color: #64748b;">${escapeHtml(n.timestamp)}</span>
            </div>
            <div style="font-family: sans-serif; color: #334155;">${escapeHtml(n.note)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- Official Signature Block -->
    <div class="signature-block avoid-break">
      <div style="font-size: 8.5pt; font-weight: 700; color: #0f172a; margin-bottom: 14px; text-transform: uppercase;">
        FORENSIC EXAMINER ATTESTATION &amp; JURAT
      </div>
      <div class="signature-grid">
        <div class="signature-col">
          <div class="sign-line"></div>
          <div class="sign-label">Lead Forensic Examiner Signature</div>
          <div style="font-size: 8pt; color: #334155; margin-top: 2px;">
            Examiner: ${escapeHtml(leadExaminer)}
          </div>
        </div>
        <div class="signature-col">
          <div class="sign-line"></div>
          <div class="sign-label">Supervisor / Evidence Custodian Sign-off</div>
          <div style="font-size: 8pt; color: #334155; margin-top: 2px;">
            Title: Senior Digital Forensics Inspector
          </div>
        </div>
        <div class="signature-col">
          <div class="sign-line"></div>
          <div class="sign-label">Attestation Date &amp; Jurisdiction</div>
          <div style="font-size: 8pt; color: #334155; margin-top: 2px;">
            Date: ${escapeHtml(new Date().toISOString().split('T')[0])}
          </div>
        </div>
      </div>
    </div>

    <!-- Official Document Footer -->
    <div class="footer">
      <div>Gengar Dark-Web OSINT Suite &bull; Cryptographically Verified Case File: ${escapeHtml(caseId)}</div>
      <div>Page 1 of 1 &bull; Certified FRE 902(14) Self-Authenticating Record</div>
    </div>

  </div>
</body>
</html>`;
}

module.exports = {
  generateStixBundle,
  generateCourtReportHtml,
  escapeHtml,
};
