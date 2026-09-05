import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import AsciiHero from './components/AsciiHero';
import SearchBar from './components/SearchBar';
import StatsBar from './components/StatsBar';
import ResultCard from './components/ResultCard';
import LiveConsole from './components/LiveConsole';
import { Loader2, AlertCircle, Terminal } from 'lucide-react';

export default function App() {
  const [torStatus, setTorStatus] = useState(null);
  const [checkingTor, setCheckingTor] = useState(false);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchMeta, setSearchMeta] = useState(null);
  const [rawResults, setRawResults] = useState([]);
  const [error, setError] = useState(null);

  // Live Console Logs
  const [logs, setLogs] = useState([]);

  // Prober state
  const [probeLimit, setProbeLimit] = useState(25);
  const [autoProbe, setAutoProbe] = useState(true);
  const [probingActive, setProbingActive] = useState(false);
  const [currentProbingUrl, setCurrentProbingUrl] = useState('');

  // Filters
  const [activeFilter, setActiveFilter] = useState('all');
  const [filterText, setFilterText] = useState('');

  const probeAbortRef = useRef(false);
  const activeEventSourceRef = useRef(null);

  // ── Fetch Tor Status on Mount ───────────────────────────────────────
  const fetchTorStatus = async () => {
    setCheckingTor(true);
    try {
      const res = await fetch('/api/tor-status');
      const data = await res.json();
      if (data.success && data.tor) {
        setTorStatus(data.tor);
      } else {
        setTorStatus({ ok: false, message: data.error || 'Tor unavailable' });
      }
    } catch (err) {
      setTorStatus({ ok: false, message: err.message });
    } finally {
      setCheckingTor(false);
    }
  };

  useEffect(() => {
    fetchTorStatus();
  }, []);

  // ── Execute Search with Real-Time SSE Log Streaming ──────────────────
  const handleSearch = async (searchTerm) => {
    if (!searchTerm.trim() || loading) return;

    // Abort previous tasks
    probeAbortRef.current = true;
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
      activeEventSourceRef.current = null;
    }

    setProbingActive(false);
    setCurrentProbingUrl('');

    setQuery(searchTerm);
    setLoading(true);
    setError(null);
    setRawResults([]);
    setSearchMeta(null);

    // Initial log messages
    const now = () => new Date().toLocaleTimeString();
    setLogs([
      { tag: 'INIT', message: `Initializing dark-web search query: "${searchTerm}"`, timestamp: now() },
      { tag: 'TOR', message: 'Routing socket via Tor SOCKS5 proxy (127.0.0.1:9050)...', timestamp: now() }
    ]);

    try {
      const sseUrl = `/api/search/stream?q=${encodeURIComponent(searchTerm)}`;
      const es = new EventSource(sseUrl);
      activeEventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'log') {
            setLogs((prev) => [
              ...prev,
              { tag: payload.tag, message: payload.message, timestamp: payload.timestamp || now() }
            ]);
          } else if (payload.type === 'complete') {
            es.close();
            activeEventSourceRef.current = null;

            setLogs((prev) => [
              ...prev,
              { tag: 'SUCCESS', message: `Found ${payload.total} total hidden services. Rendering results...`, timestamp: now() }
            ]);

            setSearchMeta({
              total: payload.total,
              page: payload.page,
              source: payload.source,
            });

            const initialResults = (payload.results || []).map((item) => ({
              ...item,
              probe: null,
            }));

            setRawResults(initialResults);
            setLoading(false);

            if (autoProbe && initialResults.length > 0) {
              startDynamicProbe(initialResults, probeLimit);
            }
          } else if (payload.type === 'error') {
            es.close();
            activeEventSourceRef.current = null;
            setError(payload.error || 'Dark-web search error');
            setLoading(false);
            setLogs((prev) => [
              ...prev,
              { tag: 'ERROR', message: `Search failed: ${payload.error}`, timestamp: now() }
            ]);
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      es.onerror = (err) => {
        // Fallback to standard fetch if SSE connection closed prematurely
        es.close();
        activeEventSourceRef.current = null;
        if (loading) {
          setLogs((prev) => [
            ...prev,
            { tag: 'WARN', message: 'Stream socket finalized. Fetching complete payload...', timestamp: now() }
          ]);
          fetchStandardSearch(searchTerm);
        }
      };
    } catch (err) {
      console.error('Search init error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Fallback if SSE drops
  const fetchStandardSearch = async (searchTerm) => {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setSearchMeta({ total: data.total, page: data.page, source: data.source });
      const initialResults = (data.results || []).map((item) => ({ ...item, probe: null }));
      setRawResults(initialResults);
      setLoading(false);

      if (autoProbe && initialResults.length > 0) {
        startDynamicProbe(initialResults, probeLimit);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // ── Dynamic Live Prober Stream with Console Logging ─────────────────
  const startDynamicProbe = async (itemsList, limit) => {
    const list = itemsList || rawResults;
    if (!list.length) return;

    probeAbortRef.current = false;
    setProbingActive(true);

    const itemsToProbe = list.slice(0, limit);
    const CONCURRENCY = 2;
    const now = () => new Date().toLocaleTimeString();

    setLogs((prev) => [
      ...prev,
      { tag: 'PROBE', message: `Starting dynamic live prober for top ${itemsToProbe.length} hidden services...`, timestamp: now() }
    ]);

    for (let i = 0; i < itemsToProbe.length; i += CONCURRENCY) {
      if (probeAbortRef.current) break;

      const chunk = itemsToProbe.slice(i, i + CONCURRENCY);
      const urlsToProbe = chunk.map((item) => item.onion);

      setCurrentProbingUrl(urlsToProbe[0]);

      setLogs((prev) => [
        ...prev,
        { tag: 'PROBE', message: `[${i + 1}/${itemsToProbe.length}] Probing hidden service: ${urlsToProbe[0]}`, timestamp: now() }
      ]);

      // Set to probing state
      setRawResults((prev) =>
        prev.map((item) =>
          urlsToProbe.includes(item.onion)
            ? { ...item, probe: { status: 'probing', alive: null } }
            : item
        )
      );

      try {
        const probeRes = await fetch('/api/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: urlsToProbe, timeout: 20 }),
        });

        const probeData = await probeRes.json();
        const resultsMap = {};

        if (probeData.success && Array.isArray(probeData.results)) {
          probeData.results.forEach((r) => {
            resultsMap[r.url] = r;
            setLogs((prevLogs) => [
              ...prevLogs,
              {
                tag: r.alive ? 'LIVE' : 'DEAD',
                message: `${r.url} -> ${r.alive ? `HTTP ${r.status || 200} (${r.latencyMs}ms)${r.title ? ` [${r.title.slice(0, 30)}...]` : ''}` : `OFFLINE (${r.error || 'Timeout'})`}`,
                timestamp: now()
              }
            ]);
          });
        }

        setRawResults((prev) =>
          prev.map((item) => {
            if (resultsMap[item.onion]) {
              return { ...item, probe: resultsMap[item.onion] };
            }
            if (urlsToProbe.includes(item.onion)) {
              return { ...item, probe: { alive: false, error: 'Probe timeout' } };
            }
            return item;
          })
        );
      } catch (err) {
        setRawResults((prev) =>
          prev.map((item) =>
            urlsToProbe.includes(item.onion)
              ? { ...item, probe: { alive: false, error: err.message } }
              : item
          )
        );
      }
    }

    setCurrentProbingUrl('');
    setProbingActive(false);
    setLogs((prev) => [
      ...prev,
      { tag: 'SUCCESS', message: 'Finished all scheduled hidden-service probes.', timestamp: now() }
    ]);
  };

  const handlePauseProbe = () => {
    probeAbortRef.current = true;
    setProbingActive(false);
    setCurrentProbingUrl('');
    setLogs((prev) => [
      ...prev,
      { tag: 'WARN', message: 'Probing paused by user.', timestamp: new Date().toLocaleTimeString() }
    ]);
  };

  const handleReProbeAll = () => {
    startDynamicProbe(rawResults, probeLimit);
  };

  const handleSingleReProbe = async (onionUrl) => {
    setRawResults((prev) =>
      prev.map((item) =>
        item.onion === onionUrl
          ? { ...item, probe: { status: 'probing', alive: null } }
          : item
      )
    );

    const now = () => new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      { tag: 'PROBE', message: `Manual probe initiated for: ${onionUrl}`, timestamp: now() }
    ]);

    try {
      const probeRes = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [onionUrl], timeout: 25 }),
      });
      const probeData = await probeRes.json();
      const singleResult = probeData?.results?.[0];

      setRawResults((prev) =>
        prev.map((item) =>
          item.onion === onionUrl
            ? { ...item, probe: singleResult || { alive: false, error: 'No response' } }
            : item
        )
      );

      if (singleResult) {
        setLogs((prev) => [
          ...prev,
          {
            tag: singleResult.alive ? 'LIVE' : 'DEAD',
            message: `${onionUrl} -> ${singleResult.alive ? `HTTP ${singleResult.status || 200} (${singleResult.latencyMs}ms)` : `OFFLINE (${singleResult.error || 'Timeout'})`}`,
            timestamp: now()
          }
        ]);
      }
    } catch (err) {
      setRawResults((prev) =>
        prev.map((item) =>
          item.onion === onionUrl
            ? { ...item, probe: { alive: false, error: err.message } }
            : item
        )
      );
    }
  };

  // ── Metrics Computation ─────────────────────────────────────────────
  const loadedList = useMemo(() => {
    return rawResults.slice(0, probeLimit);
  }, [rawResults, probeLimit]);

  const probedCount = useMemo(() => {
    return loadedList.filter((r) => r.probe && r.probe.status !== 'probing').length;
  }, [loadedList]);

  const aliveCount = useMemo(() => {
    return loadedList.filter((r) => r.probe?.alive === true).length;
  }, [loadedList]);

  const deadCount = useMemo(() => {
    return loadedList.filter((r) => r.probe && r.probe.alive === false).length;
  }, [loadedList]);

  const displayedResults = useMemo(() => {
    return loadedList.filter((item) => {
      if (activeFilter === 'alive' && item.probe?.alive !== true) return false;
      if (activeFilter === 'dead' && (!item.probe || item.probe.alive !== false)) return false;
      if (activeFilter === 'unprobed' && item.probe !== null) return false;

      if (filterText.trim()) {
        const needle = filterText.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(needle);
        const matchDesc = (item.description || '').toLowerCase().includes(needle);
        const matchOnion = (item.onion || '').toLowerCase().includes(needle);
        return matchTitle || matchDesc || matchOnion;
      }

      return true;
    });
  }, [loadedList, activeFilter, filterText]);

  return (
    <div className="min-h-screen w-full flex flex-col bg-zinc-950 text-zinc-100 font-mono">
      {/* Top Header */}
      <Header
        torStatus={torStatus}
        checkingTor={checkingTor}
        onRefreshTor={fetchTorStatus}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Full ASCII Hero Banner */}
        <AsciiHero />

        {/* Search Bar */}
        <SearchBar
          onSearch={handleSearch}
          loading={loading}
          probeLimit={probeLimit}
          setProbeLimit={setProbeLimit}
          autoProbe={autoProbe}
          setAutoProbe={setAutoProbe}
        />

        {/* Real-Time Streaming Live Console Logs */}
        {(loading || probingActive || logs.length > 0) && (
          <LiveConsole
            logs={logs}
            isActive={loading || probingActive}
            onClear={() => setLogs([])}
          />
        )}

        {/* Error Alert */}
        {error && (
          <div className="w-full mb-6 p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-rose-200">Search Error</div>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Results Section */}
        {!loading && rawResults.length > 0 && (
          <div className="space-y-4 w-full">
            {/* Stats Toolbar */}
            <StatsBar
              totalIndexed={searchMeta?.total}
              loadedCount={loadedList.length}
              probedCount={probedCount}
              aliveCount={aliveCount}
              deadCount={deadCount}
              probingActive={probingActive}
              currentProbingUrl={currentProbingUrl}
              onTriggerProbeAll={handleReProbeAll}
              onPauseProbe={handlePauseProbe}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              filterText={filterText}
              setFilterText={setFilterText}
            />

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {displayedResults.map((item, idx) => (
                <ResultCard
                  key={item.onion + idx}
                  item={item}
                  index={idx}
                  onReProbe={handleSingleReProbe}
                />
              ))}
            </div>

            {displayedResults.length === 0 && (
              <div className="p-8 text-center rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
                No results match the current filter.
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && rawResults.length === 0 && !error && logs.length === 0 && (
          <div className="w-full my-8 p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center">
            <Terminal className="w-8 h-8 text-purple-400/60 mx-auto mb-2" />
            <div className="text-sm font-semibold text-zinc-300">Ready for Exploration</div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
              Enter a search query to discover .onion hidden services. Gengar will stream live Tor circuit events and probe hidden services in real-time.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-800 bg-zinc-950 py-4 px-4 sm:px-6 text-xs text-zinc-500 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>GENGAR OSINT // Powered by Tor & Ahmia</span>
          <span className="text-zinc-600">Educational / research use only.</span>
        </div>
      </footer>
    </div>
  );
}
