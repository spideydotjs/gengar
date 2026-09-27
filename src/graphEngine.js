/**
 * gengar/src/graphEngine.js
 * ─────────────────────────────────────────────────────────────────
 * Forensic Entity Graph Engine: Compiles on-chain transactions,
 * multi-input wallet clusters, threat intelligence entities, PGP
 * keys, and darknet .onion dossiers into an interconnected
 * node-link network graph topology.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const {
  fetchAddressOverview,
  fetchAddressTransactions,
  analyzeTransactionsForensics,
  correlateThreatIntel,
  correlateWithGengarDarknet,
  THREAT_INTEL_DB,
  EvidenceManager,
} = require('./cryptoForensics');

const {
  detectChain,
  MULTI_CHAIN_THREAT_INTEL,
  analyzeMultiChainForensics,
} = require('./multiChainForensics');

const { correlatePgpAcrossDossiers, listAllPgpIdentities } = require('./pgpIntelligence');
const { listDossiers, getDossier } = require('./blockchainScraper');


/**
 * Node types supported in the Gengar Entity Graph
 * @typedef {'TARGET_WALLET'|'WALLET'|'THREAT_ACTOR'|'EXCHANGE'|'ONION_SITE'|'PGP_IDENTITY'|'TRANSACTION'} NodeType
 */

/**
 * Edge types supported in the Gengar Entity Graph
 * @typedef {'IDENTIFIED_AS'|'CO_SPENT_CLUSTER'|'TRANSFERRED'|'PEEL_CHAIN'|'COINJOIN_MIXER'|'HOSTS_WALLET'|'USES_PGP'} EdgeType
 */

/**
 * Generate a deterministic ID for graph elements
 */
function makeNodeId(type, identifier) {
  return `${type}:${identifier}`.toLowerCase();
}

/**
 * Build an interconnected entity graph for a cryptocurrency address.
 *
 * @param {string} address - Target Bitcoin address
 * @param {object} [options]
 * @param {number} [options.maxTxs=8] - Maximum counterparty transactions to render
 * @returns {Promise<{
 *   success: boolean,
 *   graph: {
 *     nodes: Array<{ id: string, label: string, type: NodeType, risk: number, meta: object }>,
 *     edges: Array<{ id: string, source: string, target: string, label: string, type: EdgeType, amountBtc?: number, isPeeling?: boolean, isMixer?: boolean }>
 *   },
 *   summary: { totalNodes: number, totalEdges: number, threatScore: number, clusterCount: number }
 * }>}
 */
async function buildGraphForAddress(address, options = {}) {
  const cleanAddr = (address || '').trim();
  if (!cleanAddr || cleanAddr.length < 25) {
    return { success: false, error: 'Valid cryptocurrency address required' };
  }

  const maxTxs = options.maxTxs || 8;
  const nodesMap = new Map();
  const edgesList = [];
  const edgeSet = new Set();

  function addNode(id, label, type, risk = 0, meta = {}) {
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, label, type, risk, meta });
    } else {
      // Update risk if higher
      const existing = nodesMap.get(id);
      if (risk > existing.risk) existing.risk = risk;
      existing.meta = { ...existing.meta, ...meta };
    }
  }

  function addEdge(source, target, label, type, extra = {}) {
    const edgeKey = `${source}->${target}:${type}:${label}`;
    if (!edgeSet.has(edgeKey)) {
      edgeSet.add(edgeKey);
      edgesList.push({
        id: `e_${edgesList.length + 1}`,
        source,
        target,
        label,
        type,
        ...extra,
      });
    }
  }

  // 1. Target Address Root Node
  const targetNodeId = makeNodeId('WALLET', cleanAddr);
  addNode(targetNodeId, `${cleanAddr.slice(0, 10)}...${cleanAddr.slice(-6)}`, 'TARGET_WALLET', 0, {
    fullAddress: cleanAddr,
    coin: 'BTC',
  });

  // Check if target is EVM or TRON
  const chain = detectChain(cleanAddr);
  if (chain === 'ETH' || chain === 'TRON') {
    const multiForensics = await analyzeMultiChainForensics(cleanAddr, { maxTxs });
    if (multiForensics) {
      const threatScore = multiForensics.threatScore || 0;
      nodesMap.get(targetNodeId).risk = threatScore;
      nodesMap.get(targetNodeId).meta.coin = chain;
      nodesMap.get(targetNodeId).meta.balance = chain === 'ETH' ? `${multiForensics.overview.balanceEth} ETH` : `${multiForensics.overview.balanceUsdt} USDT`;
      nodesMap.get(targetNodeId).meta.txCount = multiForensics.overview.txCount;

      // Add Threat Actors
      (multiForensics.correlatedThreats || []).forEach((t) => {
        const threatNodeId = makeNodeId('THREAT', t.entity);
        const nodeType = t.category.includes('EXCHANGE') ? 'EXCHANGE' : 'THREAT_ACTOR';
        addNode(threatNodeId, t.entity, nodeType, t.risk, { category: t.category, notes: t.notes });
        addEdge(targetNodeId, threatNodeId, 'IDENTIFIED_AS', 'IDENTIFIED_AS');
      });

      // Add Clustered Counterparties
      (multiForensics.clusteredAddresses || []).forEach((cl) => {
        const clNodeId = makeNodeId('WALLET', cl.address);
        addNode(clNodeId, `${cl.address.slice(0, 8)}...`, 'WALLET', Math.max(15, threatScore * 0.7), {
          fullAddress: cl.address,
          clusterHeuristic: cl.heuristic,
        });
        addEdge(targetNodeId, clNodeId, 'COUNTERPARTY', 'CO_SPENT_CLUSTER');
      });

      // Add Ledger Transactions & Flows
      (multiForensics.ledger || []).slice(0, maxTxs).forEach((tx) => {
        const edgeType = tx.isMixer ? 'COINJOIN_MIXER' : (tx.isPeeling ? 'PEEL_CHAIN' : 'TRANSFERRED');
        const edgeLabel = `${tx.amount} ${tx.amountSymbol || chain}`;
        if (tx.counterparty && tx.counterparty !== '0x0' && tx.counterparty !== 'N/A') {
          const cpNodeId = makeNodeId('WALLET', tx.counterparty);
          addNode(cpNodeId, `${tx.counterparty.slice(0, 8)}...`, 'WALLET', tx.isMixer ? 90 : 15, {
            fullAddress: tx.counterparty,
          });
          if (tx.direction === 'RECEIVED') {
            addEdge(cpNodeId, targetNodeId, edgeLabel, edgeType);
          } else {
            addEdge(targetNodeId, cpNodeId, edgeLabel, edgeType);
          }
        }
      });

      // Check darknet correlation
      const darknet = correlateWithGengarDarknet(cleanAddr);
      if (darknet && darknet.matched && darknet.onionTarget) {
        const onionNodeId = makeNodeId('ONION', darknet.onionTarget);
        addNode(onionNodeId, darknet.onionTarget.replace(/^https?:\/\//, '').slice(0, 18) + '...', 'ONION_SITE', 60, {
          fullUrl: darknet.onionTarget,
          host: darknet.host,
          scannedAt: darknet.firstSeen,
          intent: darknet.intent,
        });
        addEdge(onionNodeId, targetNodeId, darknet.intent || 'HOSTS_WALLET', 'HOSTS_WALLET');
      }

      return {
        success: true,
        graph: {
          nodes: Array.from(nodesMap.values()),
          edges: edgesList,
        },
        summary: {
          totalNodes: nodesMap.size,
          totalEdges: edgesList.length,
          threatScore,
          clusterCount: multiForensics.clusteredAddresses?.length || 0,
        },
      };
    }
  }

  // 2. Threat Intelligence Correlation (Bitcoin fallback)
  const threats = correlateThreatIntel(cleanAddr);
  const threatScore = threats.threatScore || 0;
  nodesMap.get(targetNodeId).risk = threatScore;

  if (threats.matches && threats.matches.length > 0) {
    threats.matches.forEach((t) => {
      const threatNodeId = makeNodeId('THREAT', t.entity);
      const isExchange = t.category === 'EXCHANGE_KYC';
      const nodeType = isExchange ? 'EXCHANGE' : 'THREAT_ACTOR';

      addNode(threatNodeId, t.entity, nodeType, t.risk, {
        category: t.category,
        notes: t.notes,
      });

      addEdge(targetNodeId, threatNodeId, isExchange ? 'KYC_TARGET' : 'IDENTIFIED_AS', 'IDENTIFIED_AS');
    });
  }

  // 3. On-chain Transactions & UTXO Ledger

  let txs = [];
  let overview = null;
  try {
    overview = await fetchAddressOverview(cleanAddr);
    if (overview) {
      nodesMap.get(targetNodeId).meta.balanceBtc = overview.balanceBtc;
      nodesMap.get(targetNodeId).meta.totalReceivedBtc = overview.totalReceivedBtc;
      nodesMap.get(targetNodeId).meta.txCount = overview.txCount;
    }
    txs = await fetchAddressTransactions(cleanAddr);
  } catch (_) {}

  const analysis = analyzeTransactionsForensics(cleanAddr, txs);

  // 4. Clustered Common-Ownership Addresses
  if (analysis.clusteredAddresses && analysis.clusteredAddresses.length > 0) {
    analysis.clusteredAddresses.slice(0, 6).forEach((clusterAddr) => {
      const clusterNodeId = makeNodeId('WALLET', clusterAddr);
      addNode(clusterNodeId, `${clusterAddr.slice(0, 8)}...`, 'WALLET', Math.max(10, threatScore * 0.8), {
        fullAddress: clusterAddr,
        clusterHeuristic: 'MULTI_INPUT_COMMON_OWNERSHIP',
      });
      addEdge(targetNodeId, clusterNodeId, 'CO_SPENT', 'CO_SPENT_CLUSTER');
    });
  }

  // 5. Counterparty Transaction Flows & Laundering Signals
  const ledgerSlice = analysis.ledger.slice(0, maxTxs);
  ledgerSlice.forEach((tx) => {
    let edgeType = 'TRANSFERRED';
    let edgeLabel = `${tx.amountBtc.toFixed(4)} BTC`;

    if (tx.isPeeling) {
      edgeType = 'PEEL_CHAIN';
      edgeLabel = `⚡ PEEL (${tx.amountBtc.toFixed(4)} BTC)`;
    } else if (tx.isMixer) {
      edgeType = 'COINJOIN_MIXER';
      edgeLabel = `🌀 MIXER (${tx.amountBtc.toFixed(4)} BTC)`;
    }

    // Connect counterparties
    if (tx.direction === 'RECEIVED' && tx.counterparties && tx.counterparties.length > 0) {
      const senderAddr = tx.counterparties[0];
      const senderNodeId = makeNodeId('WALLET', senderAddr);
      addNode(senderNodeId, `${senderAddr.slice(0, 8)}...`, 'WALLET', 15, {
        fullAddress: senderAddr,
      });
      addEdge(senderNodeId, targetNodeId, edgeLabel, edgeType, {
        amountBtc: tx.amountBtc,
        isPeeling: tx.isPeeling,
        isMixer: tx.isMixer,
      });
    } else if (tx.direction === 'SENT' && tx.counterparties && tx.counterparties.length > 0) {
      const recipientAddr = tx.counterparties[0];
      const recipientNodeId = makeNodeId('WALLET', recipientAddr);
      addNode(recipientNodeId, `${recipientAddr.slice(0, 8)}...`, 'WALLET', 15, {
        fullAddress: recipientAddr,
      });
      addEdge(targetNodeId, recipientNodeId, edgeLabel, edgeType, {
        amountBtc: tx.amountBtc,
        isPeeling: tx.isPeeling,
        isMixer: tx.isMixer,
      });
    }
  });

  // 6. Correlate with Gengar Darknet Dossiers & PGP Keys
  const darknet = correlateWithGengarDarknet(cleanAddr);
  if (darknet && darknet.matched && darknet.onionTarget) {
    const onionNodeId = makeNodeId('ONION', darknet.onionTarget);
    addNode(onionNodeId, darknet.onionTarget.replace(/^https?:\/\//, '').slice(0, 18) + '...', 'ONION_SITE', 60, {
      fullUrl: darknet.onionTarget,
      host: darknet.host,
      scannedAt: darknet.firstSeen,
      intent: darknet.intent,
    });
    addEdge(onionNodeId, targetNodeId, darknet.intent || 'HOSTS_WALLET', 'HOSTS_WALLET');

    // Check if site has PGP identities
    const fullDossier = getDossier(darknet.dossierId);
    if (fullDossier?.contacts?.pgpIdentities?.length > 0) {
      fullDossier.contacts.pgpIdentities.forEach((pgp) => {
        const pgpNodeId = makeNodeId('PGP', pgp.fingerprint);
        addNode(pgpNodeId, `PGP: ${pgp.keyId || pgp.fingerprint.slice(0, 8)}`, 'PGP_IDENTITY', 40, {
          fingerprint: pgp.fingerprint,
          primaryUserId: pgp.primaryUserId,
          algorithm: pgp.algorithm,
        });
        addEdge(onionNodeId, pgpNodeId, 'USES_PGP', 'USES_PGP');
      });
    }
  }

  const nodes = Array.from(nodesMap.values());
  const edges = edgesList;

  return {
    success: true,
    graph: {
      nodes,
      edges,
    },
    summary: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      threatScore,
      clusterCount: analysis.clusteredAddresses ? analysis.clusteredAddresses.length : 0,
    },
  };
}

/**
 * Build a global ecosystem graph from all indexed .onion dossiers, PGP identities,
 * and threat intelligence database entities.
 *
 * @returns {{
 *   success: boolean,
 *   graph: { nodes: Array<object>, edges: Array<object> },
 *   summary: { totalNodes: number, totalEdges: number, totalDossiers: number, totalPgpKeys: number }
 * }}
 */
function buildGlobalIntelligenceGraph() {
  const nodesMap = new Map();
  const edgesList = [];
  const edgeSet = new Set();

  function addNode(id, label, type, risk = 0, meta = {}) {
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, label, type, risk, meta });
    }
  }

  function addEdge(source, target, label, type, extra = {}) {
    const edgeKey = `${source}->${target}:${type}:${label}`;
    if (!edgeSet.has(edgeKey)) {
      edgeSet.add(edgeKey);
      edgesList.push({
        id: `ge_${edgesList.length + 1}`,
        source,
        target,
        label,
        type,
        ...extra,
      });
    }
  }

  // 1. Add Threat Intelligence Hub Nodes
  THREAT_INTEL_DB.slice(0, 8).forEach((t) => {
    const threatId = makeNodeId('THREAT', t.entity);
    const isExchange = t.category === 'EXCHANGE_KYC';
    addNode(threatId, t.entity, isExchange ? 'EXCHANGE' : 'THREAT_ACTOR', t.risk, {
      category: t.category,
      notes: t.notes,
    });

    (t.addresses || []).slice(0, 2).forEach((addr) => {
      const addrId = makeNodeId('WALLET', addr);
      addNode(addrId, `${addr.slice(0, 8)}...`, 'WALLET', t.risk, { fullAddress: addr });
      addEdge(addrId, threatId, 'IDENTIFIED_AS', 'IDENTIFIED_AS');
    });
  });

  // 1b. Add Multi-Chain Threat Hub Nodes (EVM & TRON)
  MULTI_CHAIN_THREAT_INTEL.slice(0, 6).forEach((t) => {
    const threatId = makeNodeId('THREAT', t.entity);
    const isExchange = t.category.includes('EXCHANGE') || t.category.includes('TREASURY');
    addNode(threatId, t.entity, isExchange ? 'EXCHANGE' : 'THREAT_ACTOR', t.risk, {
      category: t.category,
      chain: t.chain,
      notes: t.notes,
    });

    (t.addresses || []).slice(0, 2).forEach((addr) => {
      const addrId = makeNodeId('WALLET', addr);
      addNode(addrId, `${addr.slice(0, 8)}...`, 'WALLET', t.risk, { fullAddress: addr, chain: t.chain });
      addEdge(addrId, threatId, 'IDENTIFIED_AS', 'IDENTIFIED_AS');
    });
  });

  // 2. Add Crawled Dossiers and Wallets

  const dossiers = listDossiers().slice(0, 10);
  dossiers.forEach((d) => {
    const fullDossier = getDossier(d.id);
    if (!fullDossier) return;

    const onionId = makeNodeId('ONION', fullDossier.targetUrl);
    addNode(onionId, fullDossier.targetUrl.replace(/^https?:\/\//, '').slice(0, 16) + '...', 'ONION_SITE', 50, {
      fullUrl: fullDossier.targetUrl,
      host: fullDossier.host,
      pagesCrawled: fullDossier.pagesCrawled,
    });

    // Add discovered wallets
    (fullDossier.wallets || []).slice(0, 4).forEach((w) => {
      const walletId = makeNodeId('WALLET', w.address);
      const isBtc = w.coin === 'BTC';
      addNode(walletId, `${w.address.slice(0, 8)}...`, isBtc ? 'TARGET_WALLET' : 'WALLET', 30, {
        fullAddress: w.address,
        coin: w.coin,
        intent: w.intent,
      });
      addEdge(onionId, walletId, w.intent || 'HOSTS_WALLET', 'HOSTS_WALLET');
    });

    // Add PGP identities
    (fullDossier.contacts?.pgpIdentities || []).forEach((pgp) => {
      const pgpId = makeNodeId('PGP', pgp.fingerprint);
      addNode(pgpId, `PGP: ${pgp.keyId || pgp.fingerprint.slice(0, 8)}`, 'PGP_IDENTITY', 35, {
        fingerprint: pgp.fingerprint,
        primaryUserId: pgp.primaryUserId,
        algorithm: pgp.algorithm,
      });
      addEdge(onionId, pgpId, 'USES_PGP', 'USES_PGP');
    });
  });

  // 3. Connect PGP identities discovered across multiple sites
  const allPgp = listAllPgpIdentities();
  allPgp.forEach((pgp) => {
    if (pgp.discoveredOn && pgp.discoveredOn.length > 1) {
      const pgpId = makeNodeId('PGP', pgp.fingerprint);
      pgp.discoveredOn.forEach((siteUrl) => {
        const onionId = makeNodeId('ONION', siteUrl);
        if (nodesMap.has(onionId)) {
          addEdge(onionId, pgpId, 'SHARED_OPERATOR', 'USES_PGP');
        }
      });
    }
  });

  const nodes = Array.from(nodesMap.values());
  const edges = edgesList;

  return {
    success: true,
    graph: {
      nodes,
      edges,
    },
    summary: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalDossiers: dossiers.length,
      totalPgpKeys: allPgp.length,
    },
  };
}

module.exports = {
  buildGraphForAddress,
  buildGlobalIntelligenceGraph,
  makeNodeId,
};
