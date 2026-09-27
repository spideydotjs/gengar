/**
 * Gengar Dark-Web OSINT & Forensics Suite
 * Multi-Chain Cryptocurrency Forensics Engine
 * 
 * Supported Chains & Protocols:
 * - Bitcoin (BTC): UTXO, BIP-69 Common Input Ownership, Peeling Chains
 * - Ethereum / EVM (ETH & ERC-20): Account model, smart contract calls, Tornado Cash
 * - TRON (TRX & TRC-20 USDT): High-volume darknet stablecoin flow, OTC settlement
 */

'use strict';

const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const logger = require('./logger');

const TOR_SOCKS = process.env.TOR_SOCKS || 'socks5h://127.0.0.1:9050';
const torAgent = new SocksProxyAgent(TOR_SOCKS);

// ── Multi-Chain Threat Intelligence Expansion ───────────────────────
const MULTI_CHAIN_THREAT_INTEL = [
  // ── EVM / Ethereum Threats ─────────────────────────────────────────
  {
    chain: 'ETH',
    category: 'STATE_ACTOR_HEIST',
    entity: 'Lazarus Group (DPRK) / Ronin Bridge Exploiter',
    risk: 100,
    addresses: [
      '0x098b716b8aaf21512996dc57eb0615e2383e2f96',  // $620M Axie Ronin heist (OFAC Apr 2022)
      '0xa0e1c89ef1a489c9c7de96311ed5ce5d32c20e4b',  // Lazarus consolidation wallet
    ],
    notes: 'North Korean cyber warfare group. Stole $620M in ETH and USDC from Ronin validator network. First Ethereum address sanctioned on OFAC SDN list.'
  },
  {
    chain: 'ETH',
    category: 'MIXER_TUMBLER',
    entity: 'Tornado Cash Smart Contracts (OFAC SDN Sanctioned)',
    risk: 96,
    addresses: [
      '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b',  // Tornado Router
      '0x722122df12d4e14e13ac3b6895a86e84145b6967',  // Tornado Proxy
      '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc',  // 0.1 ETH pool
      '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936',  // 1 ETH pool
      '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf',  // 10 ETH pool
      '0xa160cdab225685da1d56aa342ad8841c3b53f291',  // 100 ETH pool
    ],
    notes: 'Zero-knowledge Ethereum mixer sanctioned by US Treasury OFAC August 2022 for laundering $7B+ in stolen assets.'
  },
  {
    chain: 'ETH',
    category: 'CYBERCRIME_HEIST',
    entity: 'WazirX Exchange Exploiter (July 2024)',
    risk: 98,
    addresses: [
      '0x04290e3515f50ab73614fb1c325c2632209f0799',  // Primary drainer wallet
    ],
    notes: '$235M multisig compromise of Indian exchange WazirX. Funds converted into ETH and funneled via decentralized mixers.'
  },

  // ── TRON (TRC-20) Threats ──────────────────────────────────────────
  {
    chain: 'TRON',
    category: 'SANCTIONED_EXCHANGE',
    entity: 'Garantex TRON USDT Gateway (OFAC Sanctioned)',
    risk: 94,
    addresses: [
      'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW6',  // Garantex TRC-20 cash-out bridge (verified active)
    ],
    notes: 'OFAC-sanctioned Russian cryptocurrency exchange processing darknet market settlements and ransomware extortions via TRC-20 USDT.'
  },
  {
    chain: 'TRON',
    category: 'EXCHANGE_KYC',
    entity: 'Binance TRON Hot Wallet / Settlement Node',
    risk: 20,
    addresses: [
      'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',  // Binance TRON primary hot/settlement wallet
    ],
    notes: 'Major centralized VASP TRON gateway. High liquidity settlement cluster subject to international KYC/AML subpoena preservation.'
  },
  {
    chain: 'TRON',
    category: 'VASP_TREASURY',
    entity: 'Tether TRON Official USDT Contract (Authorized Mint / Burn)',
    risk: 10,
    addresses: [
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',  // Official USDT TRC-20 Smart Contract
    ],
    notes: 'Official Tether Treasury and TRC-20 USDT smart contract on TRON network. Authorized issuing and contract freezing entity.'
  }

];

/**
 * Detect blockchain network from address syntax
 * @param {string} address
 * @returns {'BTC'|'ETH'|'TRON'|'UNKNOWN'}
 */
function detectChain(address) {
  if (!address || typeof address !== 'string') return 'UNKNOWN';
  const trimmed = address.trim();

  // EVM (Ethereum / Arbitrum / BSC): 0x followed by 40 hex chars
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return 'ETH';
  }

  // TRON: starts with 'T', 34 base58 characters
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed)) {
    return 'TRON';
  }

  // Bitcoin: starts with '1', '3', or 'bc1'
  if (/^(bc1[a-z0-9]{38,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(trimmed)) {
    return 'BTC';
  }

  return 'UNKNOWN';
}

/**
 * Correlate multi-chain address against known threat intelligence
 * @param {string} address
 * @param {'BTC'|'ETH'|'TRON'} [chain]
 * @returns {Array<object>} Matched threats
 */
function correlateMultiChainThreats(address, chain) {
  if (!address || typeof address !== 'string') return [];
  const targetLower = address.trim().toLowerCase();
  const activeChain = chain || detectChain(address);
  const matches = [];

  for (const item of MULTI_CHAIN_THREAT_INTEL) {
    if (activeChain && activeChain !== 'UNKNOWN' && item.chain && item.chain !== activeChain) continue;
    const hit = item.addresses.some(a => a.toLowerCase() === targetLower);
    if (hit) {
      matches.push({
        entity: item.entity,
        category: item.category,
        risk: item.risk,
        chain: item.chain,
        notes: item.notes,
        matchedAddresses: [address],
      });
    }
  }

  matches.matched = matches.length > 0;
  matches.chain = activeChain;
  matches.threats = matches;
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVM (Ethereum) Forensics Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch Ethereum address overview from Blockscout & public RPC
 * @param {string} address
 * @returns {Promise<object>}
 */
async function fetchEvmOverview(address) {
  const normAddr = address.toLowerCase();
  let coinBalanceEth = 0;
  let isContract = false;
  let name = null;
  let ensDomain = null;
  let txCount = 0;

  // 1. Try Blockscout API over Tor
  try {
    const res = await axios.get(`https://eth.blockscout.com/api/v2/addresses/${normAddr}`, {
      httpAgent: torAgent,
      httpsAgent: torAgent,
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0' },
    });

    if (res.data) {
      const d = res.data;
      coinBalanceEth = d.coin_balance ? parseFloat(d.coin_balance) / 1e18 : 0;
      isContract = Boolean(d.is_contract);
      name = d.name || null;
      ensDomain = d.ens_domain_name || null;
    }
  } catch (err) {
    logger.debug(`Blockscout address lookup failed for ${address}: ${err.message}. Trying public RPC.`);
  }

  // 2. Query public Ethereum RPC fallback for balance & nonce
  try {
    const rpcRes = await axios.post('https://ethereum-rpc.publicnode.com', [
      { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] },
      { jsonrpc: '2.0', id: 2, method: 'eth_getTransactionCount', params: [address, 'latest'] }
    ], {
      httpAgent: torAgent,
      httpsAgent: torAgent,
      timeout: 10000,
    });

    if (Array.isArray(rpcRes.data)) {
      const balObj = rpcRes.data.find(r => r.id === 1);
      const nonceObj = rpcRes.data.find(r => r.id === 2);
      if (balObj && balObj.result) {
        coinBalanceEth = parseInt(balObj.result, 16) / 1e18;
      }
      if (nonceObj && nonceObj.result) {
        txCount = parseInt(nonceObj.result, 16);
      }
    }
  } catch (err) {
    logger.debug(`Ethereum RPC lookup failed for ${address}: ${err.message}`);
  }

  return {
    success: true,
    address,
    chain: 'ETH',
    network: 'Ethereum Mainnet',
    balanceEth: parseFloat(coinBalanceEth.toFixed(6)),
    balanceUsd: parseFloat((coinBalanceEth * 2700).toFixed(2)),
    isContract,
    contractName: name,
    ensDomain,
    txCount,
  };
}

/**
 * Fetch Ethereum transactions ledger from Blockscout
 * @param {string} address
 * @param {number} [limit=25]
 * @returns {Promise<Array<object>>}
 */
async function fetchEvmTransactions(address, limit = 25) {
  const normAddr = address.toLowerCase();
  const ledger = [];

  try {
    const res = await axios.get(`https://eth.blockscout.com/api/v2/addresses/${normAddr}/transactions`, {
      httpAgent: torAgent,
      httpsAgent: torAgent,
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0' },
    });

    const items = res.data?.items || [];
    for (const tx of items.slice(0, limit)) {
      const fromAddr = tx.from?.hash ? tx.from.hash.toLowerCase() : '';
      const toAddr = tx.to?.hash ? tx.to.hash.toLowerCase() : '';
      const isReceived = toAddr === normAddr;
      const valueEth = tx.value ? parseFloat(tx.value) / 1e18 : 0;
      const feeEth = tx.fee?.value ? parseFloat(tx.fee.value) / 1e18 : 0;
      const method = tx.method || (isReceived ? 'receive' : 'transfer');

      // Check mixer / privacy smart contract flags
      const isTornado = (
        method.includes('withdraw') ||
        method.includes('deposit') ||
        tx.to?.name?.toLowerCase().includes('tornado') ||
        MULTI_CHAIN_THREAT_INTEL.some(t => t.entity.includes('Tornado') && t.addresses.some(a => a.toLowerCase() === toAddr))
      );

      ledger.push({
        txid: tx.hash,
        timestamp: tx.timestamp || 'N/A',
        confirmed: tx.status === 'ok',
        direction: isReceived ? 'RECEIVED' : 'SENT',
        amount: parseFloat(valueEth.toFixed(6)),
        amountSymbol: 'ETH',
        fee: parseFloat(feeEth.toFixed(6)),
        from: tx.from?.hash || '0x0',
        to: tx.to?.hash || '0x0',
        method,
        isMixer: isTornado,
        isPeeling: false,
        counterparty: isReceived ? tx.from?.hash : tx.to?.hash,
      });
    }
  } catch (err) {
    logger.warn(`Could not load EVM transactions for ${address}: ${err.message}`);
  }

  return ledger;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRON (TRX & TRC-20 USDT) Forensics Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch TRON address overview and TRC-20 USDT balances
 * @param {string} address
 * @returns {Promise<object>}
 */
async function fetchTronOverview(address) {
  let balanceTrx = 0;
  let balanceUsdt = 0;
  let txCount = 0;
  let accountName = null;
  let isContract = false;

  // 1. Query TronGrid Account API over Tor
  try {
    const res = await axios.get(`https://api.trongrid.io/v1/accounts/${address}`, {
      httpAgent: torAgent,
      httpsAgent: torAgent,
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (res.data?.success && res.data.data?.[0]) {
      const acc = res.data.data[0];
      balanceTrx = acc.balance ? acc.balance / 1e6 : 0;
      isContract = Boolean(acc.is_witness || acc.account_type === 'Contract');

      // Check TRC-20 balances inside account object
      if (Array.isArray(acc.trc20)) {
        for (const token of acc.trc20) {
          // Official TRC-20 USDT contract address
          if (token['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t']) {
            balanceUsdt = parseFloat(token['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t']) / 1e6;
          }
        }
      }
    }
  } catch (err) {
    logger.debug(`TronGrid account query error for ${address}: ${err.message}. Trying Tronscan fallback.`);
  }

  // 2. Query Tronscan for token balances & name
  try {
    const tsRes = await axios.get(`https://apilist.tronscanapi.com/api/account?address=${address}`, {
      httpAgent: torAgent,
      httpsAgent: torAgent,
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (tsRes.data) {
      const d = tsRes.data;
      if (d.name) accountName = d.name;
      if (d.totalTransactionCount) txCount = d.totalTransactionCount;
      if (d.balance && balanceTrx === 0) balanceTrx = d.balance / 1e6;

      // Extract USDT balance from trc20token_balances
      if (Array.isArray(d.trc20token_balances)) {
        const usdtObj = d.trc20token_balances.find(t => t.tokenId === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
        if (usdtObj && usdtObj.balance) {
          balanceUsdt = parseFloat(usdtObj.balance);
        }
      }
    }
  } catch (err) {
    logger.debug(`Tronscan lookup fallback error for ${address}: ${err.message}`);
  }

  return {
    success: true,
    address,
    chain: 'TRON',
    network: 'TRON Mainnet',
    balanceTrx: parseFloat(balanceTrx.toFixed(4)),
    balanceUsdt: parseFloat(balanceUsdt.toFixed(2)),
    balanceUsd: parseFloat((balanceUsdt + balanceTrx * 0.15).toFixed(2)),
    txCount,
    accountName,
    isContract,
  };
}

/**
 * Fetch TRON TRC-20 USDT transfer events
 * @param {string} address
 * @param {number} [limit=25]
 * @returns {Promise<Array<object>>}
 */
async function fetchTronTransactions(address, limit = 25) {
  const ledger = [];

  try {
    const res = await axios.get(`https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=${limit}`, {
      httpAgent: torAgent,
      httpsAgent: torAgent,
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const items = res.data?.data || [];
    for (const tx of items) {
      const isReceived = tx.to === address;
      const decimals = tx.token_info?.decimals || 6;
      const rawVal = parseFloat(tx.value || 0);
      const tokenVal = rawVal / Math.pow(10, decimals);
      const symbol = tx.token_info?.symbol || 'USDT';
      const timestamp = tx.block_timestamp ? new Date(tx.block_timestamp).toISOString() : 'N/A';

      // Check rapid high-volume layering flag (> $10,000 USDT)
      const isHighVolumeLayer = tokenVal >= 10000;

      ledger.push({
        txid: tx.transaction_id,
        timestamp,
        confirmed: true,
        direction: isReceived ? 'RECEIVED' : 'SENT',
        amount: parseFloat(tokenVal.toFixed(2)),
        amountSymbol: symbol,
        fee: 0,
        from: tx.from || 'N/A',
        to: tx.to || 'N/A',
        method: `TRC20 ${symbol} Transfer`,
        isMixer: false,
        isPeeling: isHighVolumeLayer,
        counterparty: isReceived ? tx.from : tx.to,
      });
    }
  } catch (err) {
    logger.warn(`Could not load TRON TRC-20 transactions for ${address}: ${err.message}`);
  }

  return ledger;
}

/**
 * Comprehensive Multi-Chain Analysis Facade
 * Dispatches to BTC, ETH, or TRON engine based on address syntax
 * 
 * @param {string} address
 * @param {object} [options]
 * @returns {Promise<object>} Unified Forensics Dossier Payload
 */
async function analyzeMultiChainForensics(address, options = {}) {
  const chain = detectChain(address);
  const examiner = options.examiner || 'OPERATOR_WEB';

  if (chain === 'ETH') {
    const [overview, ledger] = await Promise.all([
      fetchEvmOverview(address),
      fetchEvmTransactions(address, options.maxTxs || 20),
    ]);

    const correlatedThreats = correlateMultiChainThreats(address, 'ETH');
    let threatScore = 15;
    if (correlatedThreats.length > 0) {
      threatScore = Math.max(...correlatedThreats.map(t => t.risk));
    } else if (overview.isContract && overview.contractName?.toLowerCase().includes('tornado')) {
      threatScore = 95;
    } else if (ledger.some(t => t.isMixer)) {
      threatScore = 80;
    }

    // Identify interacting counterparties
    const clusteredAddresses = [];
    const seenCounterparties = new Set();
    for (const tx of ledger) {
      if (tx.counterparty && !seenCounterparties.has(tx.counterparty)) {
        seenCounterparties.add(tx.counterparty);
        clusteredAddresses.push({
          address: tx.counterparty,
          heuristic: 'EVM_CONTRACT_COUNTERPARTY',
          reason: `Smart contract transaction interaction (${tx.method})`,
          confidence: tx.isMixer ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    return {
      chain: 'ETH',
      targetAddress: address,
      leadExaminer: examiner,
      threatScore,
      overview: {
        success: true,
        address,
        chain: 'ETH',
        network: overview.network,
        balanceBtc: overview.balanceEth, // mapped for standard UI balance display
        balanceEth: overview.balanceEth,
        balanceUsd: overview.balanceUsd,
        totalReceivedBtc: overview.balanceEth,
        totalSpentBtc: 0,
        txCount: overview.txCount || ledger.length,
        unconfirmedTxCount: 0,
        contractName: overview.contractName,
        ensDomain: overview.ensDomain,
        isContract: overview.isContract,
      },
      correlatedThreats,
      darknetCorrelation: null,
      clusteredAddresses: clusteredAddresses.slice(0, 10),
      ledger,
    };
  }

  if (chain === 'TRON') {
    const [overview, ledger] = await Promise.all([
      fetchTronOverview(address),
      fetchTronTransactions(address, options.maxTxs || 20),
    ]);

    const correlatedThreats = correlateMultiChainThreats(address, 'TRON');
    let threatScore = 15;
    if (correlatedThreats.length > 0) {
      threatScore = Math.max(...correlatedThreats.map(t => t.risk));
    } else if (ledger.some(t => t.isPeeling)) {
      threatScore = 65; // high-volume rapid stablecoin layering
    }

    const clusteredAddresses = [];
    const seenCounterparties = new Set();
    for (const tx of ledger) {
      if (tx.counterparty && !seenCounterparties.has(tx.counterparty)) {
        seenCounterparties.add(tx.counterparty);
        clusteredAddresses.push({
          address: tx.counterparty,
          heuristic: 'TRC20_TRANSFER_COUNTERPARTY',
          reason: `Direct TRC-20 USDT transfer counterparty (${tx.amount} USDT)`,
          confidence: tx.isPeeling ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    return {
      chain: 'TRON',
      targetAddress: address,
      leadExaminer: examiner,
      threatScore,
      overview: {
        success: true,
        address,
        chain: 'TRON',
        network: overview.network,
        balanceBtc: overview.balanceTrx, // mapped for standard overview
        balanceTrx: overview.balanceTrx,
        balanceUsdt: overview.balanceUsdt,
        balanceUsd: overview.balanceUsd,
        totalReceivedBtc: overview.balanceTrx,
        totalSpentBtc: 0,
        txCount: overview.txCount || ledger.length,
        unconfirmedTxCount: 0,
        accountName: overview.accountName,
        isContract: overview.isContract,
      },
      correlatedThreats,
      darknetCorrelation: null,
      clusteredAddresses: clusteredAddresses.slice(0, 10),
      ledger,
    };
  }

  // Chain is BTC or unknown -> caller handles via Bitcoin engine
  return null;
}

module.exports = {
  detectChain,
  MULTI_CHAIN_THREAT_INTEL,
  correlateMultiChainThreats,
  fetchEvmOverview,
  fetchEvmTransactions,
  fetchTronOverview,
  fetchTronTransactions,
  analyzeMultiChainForensics,
};
