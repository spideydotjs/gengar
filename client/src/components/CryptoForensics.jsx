import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert, Search, AlertTriangle, Check, Copy, ExternalLink,
  FileText, Download, Layers, Flame, Coins, Lock, RefreshCw,
  Clock, ChevronDown, ChevronUp, FolderArchive, PlusCircle,
  Terminal, Globe, ArrowUpRight, ArrowDownLeft, Shield, Eye
} from 'lucide-react';

const PRESETS = [
  // Bitcoin
  { label: 'WannaCry (BTC)', address: '115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn', category: 'RANSOMWARE', chain: 'BTC' },
  { label: 'Silk Road (BTC)', address: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX', category: 'DARKNET', chain: 'BTC' },
  { label: 'LockBit 3.0 (BTC)', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', category: 'RANSOMWARE', chain: 'BTC' },
  // Ethereum / EVM
  { label: 'Tornado Router (ETH)', address: '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b', category: 'MIXER', chain: 'ETH' },
  { label: 'Lazarus Ronin (ETH)', address: '0x098b716b8aaf21512996dc57eb0615e2383e2f96', category: 'HEIST', chain: 'ETH' },
  // TRON
  { label: 'Garantex Gateway (TRX)', address: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW6', category: 'SANCTIONED', chain: 'TRON' },
  { label: 'Binance Hot (TRX)', address: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7', category: 'EXCHANGE', chain: 'TRON' },
  { label: 'Tether Contract (TRX)', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', category: 'TREASURY', chain: 'TRON' },
];

function detectClientChain(addr) {
  if (!addr) return 'BTC';
  const a = addr.trim();
  if (/^0x[a-fA-F0-9]{40}$/i.test(a)) return 'ETH';
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return 'TRON';
  return 'BTC';
}

export default function CryptoForensics({ initialTarget = '' }) {

  const [targetAddress, setTargetAddress] = useState(initialTarget || '115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [expandedTx, setExpandedTx] = useState(null);
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [searchTxText, setSearchTxText] = useState('');
  const [copiedText, setCopiedText] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [pastCases, setPastCases] = useState([]);
  const [showCasesDrawer, setShowCasesDrawer] = useState(false);

  // Load past cases on mount
  useEffect(() => {
    fetchPastCases();
    executeTrace(targetAddress);
  }, []);

  const fetchPastCases = async () => {
    try {
      const res = await fetch('/api/forensics/cases');
      const data = await res.json();
      if (data.success && Array.isArray(data.cases)) {
        setPastCases(data.cases);
      }
    } catch (_) {}
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const executeTrace = async (addressToTrace) => {
    const addr = (addressToTrace || targetAddress).trim();
    if (!addr) {
      setError('Please provide a valid cryptocurrency address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/forensics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, examiner: 'OPERATOR_WEB' }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Forensic tracking query failed');
      }

      setCaseData(data);
      setTargetAddress(addr);
      fetchPastCases();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExaminerNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !caseData?.caseId || savingNote) return;

    setSavingNote(true);
    try {
      const res = await fetch('/api/forensics/case/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseData.caseId,
          note: newNote.trim(),
          examiner: 'OPERATOR_WEB'
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCaseData((prev) => ({
          ...prev,
          evidenceSeal: data.evidenceSeal,
          caseDossier: {
            ...prev.caseDossier,
            evidenceSeal: data.evidenceSeal,
            examinerNotes: data.notes,
          }
        }));
        setNewNote('');
        fetchPastCases();
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDownloadCase = () => {
    if (!caseData?.caseDossier) return;
    const blob = new Blob([JSON.stringify(caseData.caseDossier, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GENGAR_FORENSIC_EVIDENCE_${caseData.caseId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportStix = () => {
    if (!caseData?.caseId) return;
    window.location.href = `/api/forensics/case/${caseData.caseId}/export/stix`;
  };

  const handleOpenCourtReport = (autoPrint = true) => {
    if (!caseData?.caseId) return;
    const url = `/api/forensics/case/${caseData.caseId}/export/html${autoPrint ? '?print=true' : ''}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };


  const filteredLedger = useMemo(() => {
    if (!caseData || !Array.isArray(caseData.ledger)) return [];
    return caseData.ledger.filter((tx) => {
      if (directionFilter !== 'ALL' && tx.direction !== directionFilter) return false;
      if (searchTxText.trim()) {
        const needle = searchTxText.toLowerCase();
        const inHash = tx.txid.toLowerCase().includes(needle);
        const inInputs = (tx.inputs || []).some((i) => i.address.toLowerCase().includes(needle));
        const inOutputs = (tx.outputs || []).some((o) => o.address.toLowerCase().includes(needle));
        return inHash || inInputs || inOutputs;
      }
      return true;
    });
  }, [caseData, directionFilter, searchTxText]);

  const threatScore = caseData?.threatScore || 0;
  const scoreBadgeColor =
    threatScore >= 80 ? 'bg-red-950/80 border-red-500/60 text-red-300' :
    threatScore >= 50 ? 'bg-amber-950/80 border-amber-500/60 text-amber-300' :
    'bg-emerald-950/80 border-emerald-500/60 text-emerald-300';

  return (
    <div className="space-y-6 font-mono text-xs w-full">
      {/* Header & Target Search Toolbar */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>Crypto Forensics & Criminal Correlation Engine</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  CHAIN EVIDENCE V3.0
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 font-sans">
                On-chain transaction tracing, multi-input clustering heuristics, criminal entity correlation, and cryptographic evidence sealing.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCasesDrawer(!showCasesDrawer)}
            className="px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <FolderArchive className="w-4 h-4 text-purple-400" />
            <span>Evidence Locker ({pastCases.length})</span>
          </button>
        </div>

        {/* Quick Presets Row */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span className="text-zinc-400 text-[11px] font-bold mr-1">Target Presets:</span>
          {PRESETS.map((p) => (
            <button
              key={p.address}
              onClick={() => {
                setTargetAddress(p.address);
                executeTrace(p.address);
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${
                targetAddress === p.address
                  ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-zinc-950/80 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Search Input Bar */}
        <div className="mt-4 flex flex-wrap md:flex-nowrap items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-black rounded-xl px-3.5 py-2.5 border border-zinc-700 focus-within:border-cyan-500 transition-colors">
            <Search className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
              detectClientChain(targetAddress) === 'ETH'
                ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                : detectClientChain(targetAddress) === 'TRON'
                  ? 'bg-red-950 text-red-300 border border-red-700'
                  : 'bg-amber-950 text-amber-300 border border-amber-700'
            }`}>
              {detectClientChain(targetAddress)}
            </span>
            <input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="Enter target address (BTC: 115p..., ETH: 0xd90e..., TRON: TYDz...)"
              className="w-full bg-transparent text-white focus:outline-none placeholder-zinc-500 text-xs font-mono font-semibold"
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && executeTrace(targetAddress)}
            />
          </div>

          <button
            onClick={() => executeTrace(targetAddress)}
            disabled={loading || !targetAddress.trim()}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50 cursor-pointer shrink-0"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4 fill-black" />}
            <span>{loading ? 'Tracing Chain...' : 'Execute Forensic Trace'}</span>
          </button>
        </div>
      </div>


      {/* Past Cases Locker Drawer */}
      {showCasesDrawer && (
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-700 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <FolderArchive className="w-4 h-4 text-purple-400" />
              <span>Sealed Forensic Case Files ({pastCases.length})</span>
            </div>
            <button onClick={() => setShowCasesDrawer(false)} className="text-zinc-400 hover:text-white">
              ✕
            </button>
          </div>

          {pastCases.length === 0 ? (
            <p className="text-zinc-500 py-4 text-center">No previous cases recorded in vault.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pastCases.map((c) => (
                <div
                  key={c.caseId}
                  onClick={() => {
                    executeTrace(c.targetAddress);
                    setShowCasesDrawer(false);
                  }}
                  className="p-3.5 rounded-xl bg-black border border-zinc-800 hover:border-amber-500 cursor-pointer transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">{c.caseId}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 text-zinc-300 border border-zinc-800">
                      Risk: {c.threatScore}/100
                    </span>
                  </div>
                  <div className="text-zinc-400 truncate text-[11px] font-mono">{c.targetAddress}</div>
                  <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-900">
                    <span className="font-mono">Seal: {c.evidenceSeal?.slice(0, 10)}...</span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`/api/forensics/case/${c.caseId}/export/html?print=true`}
                        target="_blank"
                        rel="noreferrer"
                        title="View & Print FRE 902 Court Report (PDF)"
                        className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border border-zinc-800 flex items-center gap-1 text-[10px]"
                      >
                        <FileText className="w-2.5 h-2.5" />
                        <span>PDF</span>
                      </a>
                      <a
                        href={`/api/forensics/case/${c.caseId}/export/stix`}
                        title="Download OASIS STIX 2.1 JSON Bundle"
                        className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 border border-zinc-800 flex items-center gap-1 text-[10px]"
                      >
                        <Shield className="w-2.5 h-2.5" />
                        <span>STIX</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-700/60 text-rose-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-rose-200">Forensic Trace Alert</div>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ACTIVE CASE DOSSIER VIEW */}
      {caseData && (
        <div className="space-y-6">
          {/* Target Profile & Threat Gauge Banner */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                    FORENSIC TARGET PROFILE
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    (caseData.chain || detectClientChain(caseData.overview?.address)) === 'ETH'
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                      : (caseData.chain || detectClientChain(caseData.overview?.address)) === 'TRON'
                        ? 'bg-red-950 text-red-300 border border-red-700'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  }`}>
                    {caseData.chain || detectClientChain(caseData.overview?.address)} ASSET
                  </span>
                </div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 mt-1 select-all">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>{caseData.overview?.address}</span>
                  <button
                    onClick={() => handleCopy(caseData.overview?.address)}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Copy Address"
                  >
                    {copiedText === caseData.overview?.address ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <a
                    href={
                      (caseData.chain || detectClientChain(caseData.overview?.address)) === 'ETH'
                        ? `https://eth.blockscout.com/address/${caseData.overview?.address}`
                        : (caseData.chain || detectClientChain(caseData.overview?.address)) === 'TRON'
                          ? `https://tronscan.org/#/address/${caseData.overview?.address}`
                          : `https://mempool.space/address/${caseData.overview?.address}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-cyan-300 transition-colors"
                    title="Open in Block Explorer"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </h3>
              </div>

              {/* Threat Score Pill & Export Suite */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-lg ${scoreBadgeColor}`}>
                  <Flame className="w-3.5 h-3.5 animate-pulse" />
                  <span>THREAT: {threatScore}/100</span>
                </div>
                <button
                  onClick={() => handleOpenCourtReport(true)}
                  title="Open FRE Rule 902(14) Certified Court Evidence Document (Print to PDF)"
                  className="px-3 py-1.5 rounded-xl bg-amber-950/50 hover:bg-amber-900/70 border border-amber-600/50 text-amber-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Court Report (PDF)</span>
                </button>
                <button
                  onClick={handleExportStix}
                  title="Export OASIS STIX 2.1 Cyber Threat Intelligence JSON bundle for SIEM/MISP"
                  className="px-3 py-1.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-600/50 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>STIX 2.1 (SIEM)</span>
                </button>
                <button
                  onClick={handleDownloadCase}
                  title="Export Raw Sealed Dossier JSON"
                  className="px-3 py-1.5 rounded-xl bg-purple-950/50 hover:bg-purple-900/70 border border-purple-600/50 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* Metrics Grid (Chain-Aware) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {caseData.chain === 'ETH' ? (
                <>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">ETH BALANCE</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">
                      {caseData.overview?.balanceEth ?? 0} ETH
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 font-sans">
                      ≈ ${(caseData.overview?.balanceUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">TOTAL TRANSACTIONS</div>
                    <div className="text-lg font-bold text-white mt-1">
                      {caseData.overview?.txCount ?? caseData.ledger?.length} confirmed
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      Type: {caseData.overview?.isContract ? 'Smart Contract' : 'EOA Wallet'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">METADATA / CONTRACT</div>
                    <div className="text-sm font-bold text-cyan-300 mt-1 truncate">
                      {caseData.overview?.ensDomain || caseData.overview?.contractName || 'Standard Account'}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      EVM Account Architecture
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">PRIVACY MIXER SIGNALS</div>
                    <div className="text-lg font-bold text-amber-300 mt-1 flex items-center gap-1.5">
                      <span>{caseData.coinJoinsCount ?? 0} Mixers</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {caseData.clusteredAddresses?.length || 0} smart contract counterparties
                    </div>
                  </div>
                </>
              ) : caseData.chain === 'TRON' ? (
                <>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">TRC-20 USDT BALANCE</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">
                      {(caseData.overview?.balanceUsdt ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 font-sans">
                      ≈ ${(caseData.overview?.balanceUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">TRX NATIVE BALANCE</div>
                    <div className="text-lg font-bold text-white mt-1">
                      {caseData.overview?.balanceTrx ?? 0} TRX
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {caseData.overview?.accountName || 'TRON Mainnet Wallet'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">TOTAL TRC-20 TRANSFERS</div>
                    <div className="text-lg font-bold text-cyan-300 mt-1">
                      {caseData.overview?.txCount ?? caseData.ledger?.length} transfers
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      High liquidity rail
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">LAYERING / OTC SIGNALS</div>
                    <div className="text-lg font-bold text-amber-300 mt-1 flex items-center gap-1.5">
                      <span>{caseData.peelingChainsCount ?? 0} High-Volume</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {caseData.clusteredAddresses?.length || 0} active counterparties
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">CONFIRMED BALANCE</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">
                      {caseData.overview?.balanceBtc?.toFixed(6)} BTC
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 font-sans">
                      ≈ ${(caseData.overview?.balanceBtc * 65000).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">TOTAL TRANSFERS</div>
                    <div className="text-lg font-bold text-white mt-1">
                      {caseData.overview?.txCount} confirmed
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {caseData.overview?.unconfirmedTxCount || 0} in mempool
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">LIFETIME RECEIVED</div>
                    <div className="text-lg font-bold text-cyan-300 mt-1">
                      {caseData.overview?.totalReceivedBtc?.toFixed(4)} BTC
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      Spent: {caseData.overview?.totalSpentBtc?.toFixed(4)} BTC
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold">HEURISTIC ANOMALIES</div>
                    <div className="text-lg font-bold text-amber-300 mt-1 flex items-center gap-1.5">
                      <span>{caseData.peelingChainsCount} Peeling</span>
                      <span className="text-zinc-600">•</span>
                      <span>{caseData.coinJoinsCount} Mixers</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {caseData.clusteredAddresses?.length || 0} co-spent wallets
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Gengar Darknet Cross-Correlation Alert (If Matched) */}
          {caseData.darknetMatch && (
            <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-500/50 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-purple-800/60">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span>🌐 GENGAR DARKNET .ONION CORRELATION DETECTED</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                  DARK WEB EVIDENCE LINK
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div>
                    <span className="text-zinc-400">Target Hidden Service:</span>{' '}
                    <strong className="text-purple-300 select-all font-mono">{caseData.darknetMatch.onionTarget}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-400">Page Title:</span>{' '}
                    <span className="text-white font-semibold">{caseData.darknetMatch.pageTitle || 'Untitled'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">NLP Context Intent:</span>{' '}
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px]">
                      {caseData.darknetMatch.intent} ({Math.round(caseData.darknetMatch.confidence * 100)}% conf)
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {caseData.darknetMatch.associatedEmails?.length > 0 && (
                    <div>
                      <span className="text-zinc-400">Extracted Emails:</span>{' '}
                      <span className="text-cyan-300 font-mono">{caseData.darknetMatch.associatedEmails.join(', ')}</span>
                    </div>
                  )}
                  {caseData.darknetMatch.associatedPgp?.length > 0 && (
                    <div>
                      <span className="text-zinc-400">PGP Public Keys:</span>{' '}
                      <span className="text-amber-300 font-mono">{caseData.darknetMatch.associatedPgp.length} Key Block(s) extracted</span>
                    </div>
                  )}
                  {caseData.darknetMatch.contextSnippet && (
                    <div className="p-2 rounded bg-black/60 border border-purple-900/50 text-[11px] text-zinc-300 italic">
                      "{caseData.darknetMatch.contextSnippet}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Criminal Entities Matched & Threat Intelligence */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h4 className="text-sm font-bold text-white">Correlated Criminal Syndicates & Threat Intel</h4>
            </div>

            {caseData.threats && caseData.threats.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {caseData.threats.map((threat, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-black border border-red-500/40 space-y-2 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{threat.entity}</span>
                      <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-600/50 text-[10px] font-bold">
                        RISK: {threat.risk}%
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-300 font-semibold">
                      Category: {threat.category}
                    </div>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      {threat.notes}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-black border border-zinc-800 text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>No direct OFAC sanctioned or ransomware addresses matched in database.</span>
              </div>
            )}
          </div>

          {/* Clustered Wallets (Multi-Input Heuristic) */}
          {caseData.clusteredAddresses && caseData.clusteredAddresses.length > 0 && (
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>Common-Input Ownership Cluster ({caseData.clusteredAddresses.length} Wallets)</span>
                </div>
                <span className="text-zinc-400 text-[10px]">Satoshis Heuristic: Co-spent inputs share private key authority</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {caseData.clusteredAddresses.map((addr) => (
                  <div
                    key={addr}
                    className="p-2.5 rounded-lg bg-black border border-zinc-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-cyan-300 font-mono truncate select-all">{addr}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopy(addr)}
                        className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                        title="Copy Address"
                      >
                        {copiedText === addr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => executeTrace(addr)}
                        className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] cursor-pointer"
                        title="Trace this wallet"
                      >
                        Trace
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Forensic Transaction Ledger */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">Forensic Transaction Ledger ({filteredLedger.length})</h4>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {['ALL', 'RECEIVED', 'SENT', 'INTERNAL_CHANGE'].map((dir) => (
                  <button
                    key={dir}
                    onClick={() => setDirectionFilter(dir)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      directionFilter === dir
                        ? 'bg-cyan-500 text-black font-bold'
                        : 'bg-black border border-zinc-700 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {dir}
                  </button>
                ))}

                <input
                  type="text"
                  value={searchTxText}
                  onChange={(e) => setSearchTxText(e.target.value)}
                  placeholder="Search txid, addresses..."
                  className="px-2.5 py-1 rounded-lg bg-black border border-zinc-700 text-white placeholder-zinc-500 text-[10px] w-40 focus:outline-none"
                />
              </div>
            </div>

            {/* Transactions List */}
            <div className="space-y-2.5">
              {filteredLedger.length === 0 ? (
                <div className="p-6 rounded-xl bg-black border border-zinc-800 text-center text-zinc-500">
                  No transactions match the selected filter.
                </div>
              ) : (
                filteredLedger.map((tx) => {
                  const isExpanded = expandedTx === tx.txid;
                  const isReceived = tx.direction === 'RECEIVED';
                  const isSent = tx.direction === 'SENT';

                  return (
                    <div
                      key={tx.txid}
                      className="rounded-xl bg-black border border-zinc-800 hover:border-zinc-700 transition-all overflow-hidden"
                    >
                      {/* Main Tx Row */}
                      <div
                        onClick={() => setExpandedTx(isExpanded ? null : tx.txid)}
                        className="p-3.5 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-[280px]">
                          <span className={`p-1.5 rounded-lg ${
                            isReceived ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40' :
                            isSent ? 'bg-rose-950 text-rose-400 border border-rose-600/40' :
                            'bg-zinc-800 text-zinc-300'
                          }`}>
                            {isReceived ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-xs select-all">
                                {tx.txid.slice(0, 16)}...{tx.txid.slice(-8)}
                              </span>
                              <a
                                href={
                                  caseData.chain === 'ETH'
                                    ? `https://eth.blockscout.com/tx/${tx.txid}`
                                    : caseData.chain === 'TRON'
                                    ? `https://tronscan.org/#/transaction/${tx.txid}`
                                    : `https://mempool.space/tx/${tx.txid}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-zinc-500 hover:text-cyan-400"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                              {tx.timestamp} • Fee: {tx.feeBtc != null ? tx.feeBtc.toFixed(6) : '0.000000'} {tx.feeSymbol || (caseData.chain === 'ETH' ? 'ETH' : caseData.chain === 'TRON' ? 'TRX' : 'BTC')}
                            </div>
                          </div>
                        </div>

                        {/* Anomaly Badges */}
                        <div className="flex items-center gap-2">
                          {tx.method && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/50 text-purple-300 font-bold text-[10px] uppercase font-mono">
                              fn: {tx.method}
                            </span>
                          )}
                          {tx.isPeeling && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-500/50 text-amber-300 font-bold text-[10px]">
                              ⚡ PEELING
                            </span>
                          )}
                          {tx.isMixer && (
                            <span className="px-2 py-0.5 rounded-full bg-red-950 border border-red-500/50 text-red-300 font-bold text-[10px]">
                              🌀 COINJOIN / MIXER
                            </span>
                          )}

                          <span className={`text-sm font-bold font-mono ${
                            isReceived ? 'text-emerald-400' : isSent ? 'text-rose-400' : 'text-zinc-300'
                          }`}>
                            {isReceived ? '+' : isSent ? '-' : ''}{tx.amountBtc != null ? tx.amountBtc.toFixed(4) : '0.0000'} {tx.amountSymbol || (caseData.chain === 'TRON' ? 'USDT' : caseData.chain === 'ETH' ? 'ETH' : 'BTC')}
                          </span>

                          <button className="text-zinc-400 hover:text-white p-1">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Inputs / Outputs Flow */}
                      {isExpanded && (
                        <div className="p-4 bg-zinc-950/80 border-t border-zinc-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Inputs */}
                          <div className="space-y-1.5">
                            <div className="font-bold text-emerald-400 flex items-center gap-1 pb-1 border-b border-zinc-800">
                              <span>Inputs ({tx.inputs?.length || 0})</span>
                            </div>
                            {(tx.inputs || []).map((inp, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                                <span className="text-zinc-300 font-mono truncate select-all">{inp.address}</span>
                                <span className="text-amber-300 font-bold shrink-0">{inp.valueBtc?.toFixed(4)} {tx.amountSymbol || (caseData.chain === 'TRON' ? 'USDT' : caseData.chain === 'ETH' ? 'ETH' : 'BTC')}</span>
                              </div>
                            ))}
                          </div>

                          {/* Outputs */}
                          <div className="space-y-1.5">
                            <div className="font-bold text-rose-400 flex items-center gap-1 pb-1 border-b border-zinc-800">
                              <span>Outputs ({tx.outputs?.length || 0})</span>
                            </div>
                            {(tx.outputs || []).map((out, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                                <span className="text-zinc-300 font-mono truncate select-all">{out.address}</span>
                                <span className="text-cyan-300 font-bold shrink-0">{out.valueBtc?.toFixed(4)} {tx.amountSymbol || (caseData.chain === 'TRON' ? 'USDT' : caseData.chain === 'ETH' ? 'ETH' : 'BTC')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cryptographic Evidence Locker & Examiner Log */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Tamper-Evident Evidence Seal & Examiner Log</h4>
              </div>
              <span className="text-zinc-400 text-[10px]">Federal Rules of Evidence Rule 902(13)/(14) Admissible Format</span>
            </div>

            {/* Seal Box */}
            <div className="p-3.5 rounded-xl bg-black border border-emerald-500/40 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-zinc-400">CASE ID:</span>{' '}
                  <strong className="text-amber-300">{caseData.caseId}</strong>
                </div>
                <div>
                  <span className="text-zinc-400">EXAMINER:</span>{' '}
                  <strong className="text-white">{caseData.caseDossier?.leadExaminer || 'OPERATOR_WEB'}</strong>
                </div>
              </div>
              <div>
                <span className="text-zinc-400 text-[11px]">SHA-256 INTEGRITY SEAL:</span>
                <div className="mt-1 p-2 rounded bg-zinc-950 border border-zinc-800 font-mono text-emerald-400 text-[11px] select-all break-all flex items-center justify-between gap-2">
                  <span>{caseData.evidenceSeal}</span>
                  <button
                    onClick={() => handleCopy(caseData.evidenceSeal)}
                    className="p-1 text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                    title="Copy Seal Hash"
                  >
                    {copiedText === caseData.evidenceSeal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Examiner Notes Form */}
            <form onSubmit={handleAddExaminerNote} className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add investigator forensic observation (e.g. Counterparty address links to Bohemia Market vendor)..."
                  className="flex-1 px-3 py-2 rounded-xl bg-black border border-zinc-700 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-cyan-500"
                  disabled={savingNote}
                />
                <button
                  type="submit"
                  disabled={savingNote || !newNote.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{savingNote ? 'Sealing...' : 'Record Note'}</span>
                </button>
              </div>
            </form>

            {/* Existing Notes List */}
            {caseData.caseDossier?.examinerNotes?.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] text-zinc-400 font-bold">Chain of Custody Examiner Log:</div>
                {caseData.caseDossier.examinerNotes.map((n, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-black border border-zinc-800 text-[11px] text-zinc-300 font-mono">
                    {n}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
