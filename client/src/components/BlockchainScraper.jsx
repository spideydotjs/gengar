import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Coins, Search, Globe, Shield, Terminal, Clock, ExternalLink,
  Copy, Check, RefreshCw, AlertCircle, FileText, Download,
  Layers, Key, Mail, MessageSquare, ChevronDown, ChevronUp,
  Flame, Zap, Filter, ArrowRight
} from 'lucide-react';

export default function BlockchainScraper({ defaultUrl = '', onNavigateToSearch, onForensicTrace }) {
  const [targetUrl, setTargetUrl] = useState(defaultUrl);
  const [depth, setDepth] = useState(5);
  const [scanning, setScanning] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [liveLogs, setLiveLogs] = useState([]);
  const [dossier, setDossier] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [copiedPgp, setCopiedPgp] = useState(null);
  const [coinFilter, setCoinFilter] = useState('ALL');
  const [intentFilter, setIntentFilter] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const eventSourceRef = useRef(null);

  // Update target URL if defaultUrl prop changes (e.g. clicked from search result)
  useEffect(() => {
    if (defaultUrl && defaultUrl !== targetUrl) {
      setTargetUrl(defaultUrl);
      startScan(defaultUrl);
    }
  }, [defaultUrl]);

  // Load scan history on mount
  useEffect(() => {
    fetchHistory();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/blockchain-scans');
      const data = await res.json();
      if (data.success && Array.isArray(data.dossiers)) {
        setHistory(data.dossiers);
      }
    } catch (err) {
      console.error('Failed to load scan history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadPastDossier = async (id) => {
    try {
      const res = await fetch(`/api/blockchain-scan/${id}`);
      const data = await res.json();
      if (data.success && data.dossier) {
        setDossier(data.dossier);
        setTargetUrl(data.dossier.targetUrl);
        setLiveLogs([]);
        setError(null);
      }
    } catch (err) {
      setError(`Failed to load dossier: ${err.message}`);
    }
  };

  const handleCopy = (text, type, setter) => {
    navigator.clipboard.writeText(text);
    setter(text);
    setTimeout(() => setter(null), 2000);
  };

  const handleDownloadDossier = () => {
    if (!dossier) return;
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gengar_crypto_osint_${dossier.host}_${dossier.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startScan = (urlToScan) => {
    const target = (urlToScan || targetUrl).trim();
    if (!target) {
      setError('Please provide a valid .onion service URL.');
      return;
    }
    if (!target.includes('.onion')) {
      setError('Target URL must be a valid Tor hidden service (.onion).');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setScanning(true);
    setError(null);
    setDossier(null);
    setLiveLogs([]);
    setCurrentStep('INIT');

    const now = () => new Date().toLocaleTimeString();
    const initialLog = {
      step: 'START',
      message: `Establishing Tor SOCKS5 circuit to deep crawl: ${target}`,
      timestamp: now()
    };
    setLiveLogs([initialLog]);

    try {
      const sseUrl = `/api/blockchain-scan/stream?url=${encodeURIComponent(target)}&maxPages=${depth}&timeout=30`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setCurrentStep(payload.step);

          if (payload.step === 'FINISH') {
            es.close();
            eventSourceRef.current = null;
            setScanning(false);
            if (payload.dossier) {
              setDossier(payload.dossier);
            }
            fetchHistory();
          } else if (payload.step === 'ERROR') {
            es.close();
            eventSourceRef.current = null;
            setScanning(false);
            setError(payload.error || 'Deep scan encountered an unrecoverable error');
          } else {
            setLiveLogs((prev) => [
              ...prev,
              {
                step: payload.step,
                message: payload.message || `Crawling: ${payload.url || ''}`,
                timestamp: payload.timestamp || now()
              }
            ]);
          }
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        if (scanning) {
          fallbackPostScan(target);
        }
      };
    } catch (err) {
      setError(err.message);
      setScanning(false);
    }
  };

  const fallbackPostScan = async (target) => {
    try {
      const res = await fetch('/api/blockchain-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target, maxPages: depth, timeout: 30 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setDossier(data.dossier);
      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const stopScan = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setScanning(false);
    setLiveLogs((prev) => [
      ...prev,
      { step: 'ABORT', message: 'Scan manually halted by operator.', timestamp: new Date().toLocaleTimeString() }
    ]);
  };

  const getExplorerUrl = (coin, address) => {
    switch (coin) {
      case 'BTC':
        return `https://mempool.space/address/${address}`;
      case 'ETH':
        return `https://etherscan.io/address/${address}`;
      case 'XMR':
        return `https://localmonero.co/blocks/search/${address}`;
      case 'LTC':
        return `https://blockchair.com/litecoin/address/${address}`;
      case 'TRX':
        return `https://tronscan.org/#/address/${address}`;
      default:
        return `https://blockchair.com/search?q=${address}`;
    }
  };

  const getIntentBadge = (intent) => {
    switch (intent) {
      case 'ESCROW_DEPOSIT':
        return { label: 'ESCROW DEPOSIT', color: 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300' };
      case 'DONATION':
        return { label: 'DONATION / TIP', color: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' };
      case 'COMMERCE_PAYMENT':
        return { label: 'COMMERCE CHECKOUT', color: 'bg-blue-950/80 border-blue-500/50 text-blue-300' };
      case 'RANSOM_EXTORTION':
        return { label: 'RANSOM / EXTORTION', color: 'bg-rose-950/80 border-rose-500/50 text-rose-300 animate-pulse' };
      case 'VENDOR_BOND':
        return { label: 'VENDOR BOND', color: 'bg-purple-950/80 border-purple-500/50 text-purple-300' };
      case 'EXCHANGE_MIXER':
        return { label: 'EXCHANGE / MIXER', color: 'bg-amber-950/80 border-amber-500/50 text-amber-300' };
      case 'PERSONAL_WALLET':
        return { label: 'PERSONAL WALLET', color: 'bg-zinc-900 border-zinc-700 text-zinc-300' };
      default:
        return { label: 'DIRECT PAYMENT', color: 'bg-zinc-900 border-zinc-700 text-zinc-400' };
    }
  };

  const getCoinBadge = (coin) => {
    switch (coin) {
      case 'BTC':
        return 'bg-amber-500/20 border-amber-500/40 text-amber-300';
      case 'ETH':
        return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300';
      case 'XMR':
        return 'bg-orange-500/20 border-orange-500/40 text-orange-300';
      case 'LTC':
        return 'bg-slate-400/20 border-slate-400/40 text-slate-300';
      case 'TRX':
        return 'bg-red-500/20 border-red-500/40 text-red-300';
      default:
        return 'bg-zinc-800 text-zinc-300';
    }
  };

  const filteredWallets = useMemo(() => {
    if (!dossier || !Array.isArray(dossier.wallets)) return [];
    return dossier.wallets.filter((w) => {
      if (coinFilter !== 'ALL' && w.coin !== coinFilter) return false;
      if (intentFilter !== 'ALL' && w.intent !== intentFilter) return false;
      if (searchFilter.trim()) {
        const needle = searchFilter.toLowerCase();
        const inAddr = w.address.toLowerCase().includes(needle);
        const inSnippet = (w.contextSnippet || '').toLowerCase().includes(needle);
        const inFound = (w.foundOn || '').toLowerCase().includes(needle);
        return inAddr || inSnippet || inFound;
      }
      return true;
    });
  }, [dossier, coinFilter, intentFilter, searchFilter]);

  return (
    <div className="space-y-6 font-mono text-xs w-full">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Coins className="w-48 h-48 text-amber-400" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Coins className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                  <span>Deep Blockchain & Crypto Intelligence Scraper</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    NLP CONTEXT V2.4
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Multi-page recursive crawler traversing Tor hidden services to extract crypto wallets with NLP intent classification.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>Past Scans ({history.length})</span>
            </button>
          </div>
        </div>

        {/* Input & Launch Toolbar */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3 pt-4 border-t border-zinc-800/80">
          <div className="md:col-span-7 flex items-center gap-2 bg-black/60 rounded-xl px-3.5 py-2 border border-zinc-800 focus-within:border-amber-500/50 transition-colors">
            <Globe className="w-4 h-4 text-purple-400 shrink-0" />
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="e.g. http://darkmarket7xkz...onion"
              className="w-full bg-transparent text-white focus:outline-none placeholder-zinc-600 text-xs font-mono"
              disabled={scanning}
            />
          </div>

          {/* Depth Selector */}
          <div className="md:col-span-2 flex items-center justify-between bg-black/60 rounded-xl px-3 py-2 border border-zinc-800">
            <span className="text-zinc-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-zinc-400" /> Depth:
            </span>
            <select
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              disabled={scanning}
              className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value={3} className="bg-zinc-900 text-white">3 pgs</option>
              <option value={5} className="bg-zinc-900 text-white">5 pgs</option>
              <option value={8} className="bg-zinc-900 text-white">8 pgs</option>
              <option value={12} className="bg-zinc-900 text-white">12 pgs</option>
            </select>
          </div>

          {/* Execution Button */}
          <div className="md:col-span-3 flex gap-2">
            {!scanning ? (
              <button
                onClick={() => startScan(targetUrl)}
                disabled={!targetUrl.trim()}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-black" />
                <span>Execute Deep Scan</span>
              </button>
            ) : (
              <button
                onClick={stopScan}
                className="w-full px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-200 font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Halt Scan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scan History Drawer */}
      {showHistory && (
        <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="font-bold text-zinc-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Previously Scanned Hidden Services Dossiers</span>
            </span>
            <button
              onClick={() => setShowHistory(false)}
              className="text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          {history.length === 0 ? (
            <p className="text-zinc-500 py-4 text-center">No previous scans found in storage.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {history.map((h) => (
                <div
                  key={h.id}
                  onClick={() => {
                    loadPastDossier(h.id);
                    setShowHistory(false);
                  }}
                  className="p-3 rounded-lg bg-black/40 border border-zinc-800 hover:border-amber-500/50 cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-purple-300 font-mono truncate text-[11px] group-hover:text-purple-200">
                      {h.targetUrl}
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0">
                      {h.totalWallets} wallets
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] text-zinc-500 flex items-center justify-between">
                    <span>{h.pagesCrawled} pages explored</span>
                    <span>{new Date(h.scannedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-rose-200">Scraper Notice</div>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Live Crawler Telemetry Feed */}
      {scanning && (
        <div className="p-4 rounded-xl bg-zinc-950 border border-purple-900/50 shadow-[0_0_25px_rgba(147,51,234,0.1)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-purple-300 font-bold">
              <Terminal className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>Tor Crawler & NLP Engine Active</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Routing over Tor SOCKS5 (127.0.0.1:9050)</span>
            </div>
          </div>

          <div className="h-40 overflow-y-auto font-mono text-[11px] space-y-1.5 p-2 bg-black/70 rounded-lg border border-zinc-900">
            {liveLogs.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-zinc-600">[{l.timestamp}]</span>
                <span className={`px-1 rounded text-[10px] font-bold ${
                  l.step === 'PAGE_ANALYZED' ? 'bg-amber-500/20 text-amber-300' :
                  l.step === 'FETCH_PAGE' ? 'bg-purple-950 text-purple-300' :
                  l.step === 'ERROR' ? 'bg-rose-950 text-rose-300' :
                  'bg-zinc-800 text-zinc-300'
                }`}>
                  {l.step}
                </span>
                <span className="text-zinc-300 break-all">{l.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMPLETED DOSSIER VIEW */}
      {dossier && (
        <div className="space-y-6">
          {/* Dossier Meta Summary Banner */}
          <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                  Intelligence Dossier #{dossier.id}
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span>{dossier.targetUrl}</span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadDossier}
                  className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors text-xs"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80">
                <div className="text-[10px] text-zinc-500">PAGES CRAWLED</div>
                <div className="text-lg font-bold text-white mt-1">{dossier.pagesCrawled}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">Internal links traversed</div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-amber-500/20">
                <div className="text-[10px] text-amber-400">TOTAL WALLETS</div>
                <div className="text-lg font-bold text-amber-300 mt-1">{dossier.totalWallets}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">Unique crypto addresses</div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80">
                <div className="text-[10px] text-zinc-500">CRAWL DURATION</div>
                <div className="text-lg font-bold text-white mt-1">
                  {(dossier.durationMs / 1000).toFixed(1)}s
                </div>
                <div className="text-[10px] text-zinc-600 mt-0.5">Tor circuit latency</div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80">
                <div className="text-[10px] text-zinc-500">PGP & CONTACTS</div>
                <div className="text-lg font-bold text-white mt-1">
                  {(dossier.contacts?.pgpKeys?.length || 0) + (dossier.contacts?.emails?.length || 0)}
                </div>
                <div className="text-[10px] text-zinc-600 mt-0.5">Identities detected</div>
              </div>
            </div>

            {/* Intent and Coin Breakdowns */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-zinc-500 text-[11px] mr-1">Currencies:</span>
                {Object.entries(dossier.coinBreakdown || {}).map(([coin, count]) => (
                  <span
                    key={coin}
                    className={`px-2 py-0.5 rounded-md border font-bold text-[10px] ${getCoinBadge(coin)}`}
                  >
                    {coin}: {count}
                  </span>
                ))}
                {Object.keys(dossier.coinBreakdown || {}).length === 0 && (
                  <span className="text-zinc-600 text-[11px]">None detected</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-zinc-500 text-[11px] mr-1">NLP Intents:</span>
                {Object.entries(dossier.intentBreakdown || {}).map(([intent, count]) => (
                  <span
                    key={intent}
                    className="px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-400 text-[10px]"
                  >
                    {intent}: <strong className="text-zinc-200">{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Wallets Filter & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
            {/* Currency Filter */}
            <div className="flex items-center gap-1">
              <span className="text-zinc-500 text-[11px] mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Coin:
              </span>
              {['ALL', 'BTC', 'ETH', 'XMR', 'LTC', 'TRX'].map((coin) => (
                <button
                  key={coin}
                  onClick={() => setCoinFilter(coin)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    coinFilter === coin
                      ? 'bg-amber-500 text-black'
                      : 'bg-black/50 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {coin}
                </button>
              ))}
            </div>

            {/* Keyword search within dossier */}
            <div className="flex items-center gap-2 bg-black/60 rounded-lg px-2.5 py-1 border border-zinc-800 w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search addresses, text..."
                className="bg-transparent text-white focus:outline-none placeholder-zinc-600 text-[11px] w-full font-mono"
              />
            </div>
          </div>

          {/* WALLET CARDS LIST */}
          <div className="space-y-3">
            {filteredWallets.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center text-zinc-500">
                {dossier.totalWallets === 0
                  ? 'No cryptocurrency wallet addresses were discovered across the crawled pages of this hidden service.'
                  : 'No wallets match the selected filters.'}
              </div>
            ) : (
              filteredWallets.map((wallet, idx) => {
                const intentCfg = getIntentBadge(wallet.intent);
                const explorerUrl = getExplorerUrl(wallet.coin, wallet.address);

                return (
                  <div
                    key={wallet.address + idx}
                    className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/40 transition-all space-y-3 shadow-md"
                  >
                    {/* Top Row: Coin Badge + Address + Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getCoinBadge(wallet.coin)}`}>
                          {wallet.coin}
                        </span>

                        <span className="font-mono text-xs text-amber-200 font-semibold select-all break-all">
                          {wallet.address}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleCopy(wallet.address, 'addr', setCopiedAddress)}
                          className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center gap-1 transition-colors text-[11px] cursor-pointer"
                          title="Copy Address"
                        >
                          {copiedAddress === wallet.address ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded bg-zinc-950 hover:bg-amber-950/40 border border-zinc-800 hover:border-amber-700/50 text-zinc-400 hover:text-amber-300 flex items-center gap-1 transition-colors text-[11px]"
                          title="View on Blockchain Explorer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Explorer</span>
                        </a>

                        {wallet.coin === 'BTC' && (
                          <button
                            onClick={() => onForensicTrace?.(wallet.address)}
                            className="px-2 py-1 rounded bg-red-950/70 hover:bg-red-900 border border-red-600/50 text-red-300 hover:text-white flex items-center gap-1 transition-colors text-[11px] cursor-pointer"
                            title="Trace criminal network in Forensics engine"
                          >
                            <Shield className="w-3 h-3 text-red-400" />
                            <span>Forensics</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* NLP Intent & Classification Row */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800/60">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 ${intentCfg.color}`}>
                        <Flame className="w-3 h-3" />
                        <span>NLP INTENT: {intentCfg.label}</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400">
                        Confidence: <strong className="text-white">{Math.round(wallet.confidence * 100)}%</strong>
                      </span>

                      {wallet.urgency === 'HIGH' && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[10px] font-bold animate-pulse">
                          ⚡ HIGH URGENCY
                        </span>
                      )}

                      {wallet.amounts && wallet.amounts.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[10px] font-semibold">
                          Amount: {wallet.amounts.join(', ')}
                        </span>
                      )}
                    </div>

                    {/* NLP Context Snippet Window */}
                    {wallet.contextSnippet && (
                      <div className="p-3 rounded-lg bg-black/60 border border-zinc-800/80 text-[11px] text-zinc-300 leading-relaxed font-mono">
                        <div className="text-[10px] text-zinc-500 mb-1 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-purple-400" />
                          <span>Extracted Context Window (180 chars):</span>
                        </div>
                        <p className="italic text-zinc-400">
                          "...{wallet.contextSnippet}..."
                        </p>
                      </div>
                    )}

                    {/* Source Subpage Location */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                      <span className="flex items-center gap-1 truncate pr-2">
                        <Globe className="w-3 h-3 text-purple-400" />
                        <span>Discovered on: <span className="text-purple-300 select-all">{wallet.foundOn}</span></span>
                      </span>
                      {wallet.pageTitle && (
                        <span className="text-zinc-600 truncate shrink-0 max-w-[200px]">
                          [{wallet.pageTitle}]
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* OSINT CONTACTS & PGP KEYS SECTION */}
          {dossier.contacts && (
            <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                <Shield className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white">Associated OSINT Identifiers & PGP Keys</h4>
              </div>

              {/* Emails & Jabber */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-black/40 border border-zinc-800">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold mb-2">
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    <span>Discovered Email Addresses ({dossier.contacts.emails?.length || 0})</span>
                  </div>
                  {dossier.contacts.emails?.length > 0 ? (
                    <div className="space-y-1">
                      {dossier.contacts.emails.map((m) => (
                        <div key={m} className="text-purple-300 font-mono text-[11px] select-all">
                          {m}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-[11px]">No cleartext email addresses detected.</span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-zinc-800">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold mb-2">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Jabber / XMPP Handles ({dossier.contacts.jabber?.length || 0})</span>
                  </div>
                  {dossier.contacts.jabber?.length > 0 ? (
                    <div className="space-y-1">
                      {dossier.contacts.jabber.map((j) => (
                        <div key={j} className="text-cyan-300 font-mono text-[11px] select-all">
                          {j}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-[11px]">No XMPP/Jabber identifiers found.</span>
                  )}
                </div>
              </div>

              {/* PGP Public Key Blocks */}
              {dossier.contacts.pgpKeys?.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>PGP Public Key Blocks ({dossier.contacts.pgpKeys.length})</span>
                  </div>
                  {dossier.contacts.pgpKeys.map((keyBlock, ki) => (
                    <div key={ki} className="p-3 rounded-xl bg-black/80 border border-zinc-800 font-mono text-[10px] space-y-2">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>PGP KEY #{ki + 1}</span>
                        <button
                          onClick={() => handleCopy(keyBlock, 'pgp', setCopiedPgp)}
                          className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPgp === keyBlock ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedPgp === keyBlock ? 'Copied' : 'Copy Key'}</span>
                        </button>
                      </div>
                      <pre className="max-h-28 overflow-y-auto text-zinc-500 whitespace-pre-wrap select-all font-mono">
                        {keyBlock}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CRAWLED PAGES TREE */}
          {dossier.pages && dossier.pages.length > 0 && (
            <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                <Layers className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white">Crawled Pages Traversal Map</h4>
              </div>

              <div className="space-y-1.5">
                {dossier.pages.map((p, pi) => (
                  <div
                    key={pi}
                    className="p-2 rounded-lg bg-black/40 border border-zinc-800/80 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        p.httpStatus === 200 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                      }`}>
                        {p.httpStatus || 'ERR'}
                      </span>
                      <span className="text-purple-300 truncate font-mono select-all">{p.url}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {p.walletsFound > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                          {p.walletsFound} Wallets
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-[10px]">0 Wallets</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
