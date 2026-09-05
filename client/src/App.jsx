import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import AsciiHero from './components/AsciiHero';
import SearchBar from './components/SearchBar';
import StatsBar from './components/StatsBar';
import ResultCard from './components/ResultCard';
import LiveConsole from './components/LiveConsole';
import ScreenshotsGallery from './components/ScreenshotsGallery';
import { Loader2, AlertCircle, Terminal, Camera, ListFilter, ExternalLink } from 'lucide-react';

export default function App() {
  const [torStatus, setTorStatus] = useState(null);
  const [checkingTor, setCheckingTor] = useState(false);

  // Active Main View Tab: 'results' | 'screenshots' | 'logs'
  const [activeTab, setActiveTab] = useState('results');

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchMeta, setSearchMeta] = useState(null);
  const [rawResults, setRawResults] = useState([]);
  const [error, setError] = useState(null);

  // Screenshots state
  const [screenshots, setScreenshots] = useState([]);
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);
  const [lightboxSnapshot, setLightboxSnapshot] = useState(null);

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

  // ── Fetch Screenshots ───────────────────────────────────────────────
  const fetchScreenshots = async () => {
    setLoadingScreenshots(true);
    try {
      const res = await fetch('/api/screenshots');
      const data = await res.json();
      if (data.success && Array.isArray(data.screenshots)) {
        setScreenshots(data.screenshots);
      }
    } catch (err) {
      console.error('Failed to load screenshots:', err);
    } finally {
      setLoadingScreenshots(false);
    }
  };

  useEffect(() => {
    fetchTorStatus();
    fetchScreenshots();
  }, []);

  // ── Execute Search with Real-Time SSE Log Streaming ──────────────────
  const handleSearch = async (searchTerm) => {
    if (!searchTerm.trim() || loading) return;

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
    setActiveTab('results');

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

      es.onerror = () => {
        es.close();
        activeEventSourceRef.current = null;
        if (loading) {
          fetchStandardSearch(searchTerm);
        }
      };
    } catch (err) {
      console.error('Search init error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

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

  // ── Dynamic Live Prober Stream with Auto Screenshot Capture ─────────
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
        { tag: 'PROBE', message: `[${i + 1}/${itemsToProbe.length}] Probing & snapshotting: ${urlsToProbe[0]}`, timestamp: now() }
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
          body: JSON.stringify({ urls: urlsToProbe, timeout: 25 }),
        });

        const probeData = await probeRes.json();
        const resultsMap = {};

        if (probeData.success && Array.isArray(probeData.results)) {
          probeData.results.forEach((r) => {
            resultsMap[r.url] = r;

            // Log status
            setLogs((prevLogs) => [
              ...prevLogs,
              {
                tag: r.alive ? 'LIVE' : 'DEAD',
                message: `${r.url} -> ${r.alive ? `HTTP ${r.status || 200} (${r.latencyMs}ms)${r.screenshot ? ' [Snapshot Saved 📸]' : ''}` : `OFFLINE (${r.error || 'Timeout'})`}`,
                timestamp: now()
              }
            ]);
          });

          // Refresh screenshots list so the Screenshots tab updates live
          fetchScreenshots();
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
    fetchScreenshots();
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

      if (singleResult?.screenshot) {
        fetchScreenshots();
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

  // On-demand manual screenshot capture
  const handleCaptureScreenshot = async (onionUrl) => {
    const now = () => new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      { tag: 'SNAPSHOT', message: `Capturing Playwright browser screenshot for ${onionUrl}...`, timestamp: now() }
    ]);

    try {
      const res = await fetch('/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: onionUrl, timeout: 30 }),
      });
      const data = await res.json();
      if (data.success && data.screenshot) {
        setRawResults((prev) =>
          prev.map((item) =>
            item.onion === onionUrl
              ? {
                  ...item,
                  probe: {
                    ...(item.probe || { alive: true, status: 200 }),
                    screenshot: data.screenshot.screenshotUrl,
                    screenshotId: data.screenshot.id,
                  },
                }
              : item
          )
        );
        fetchScreenshots();
        setLogs((prev) => [
          ...prev,
          { tag: 'SUCCESS', message: `Snapshot saved: ${data.screenshot.screenshotUrl}`, timestamp: now() }
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          { tag: 'ERROR', message: `Snapshot capture failed: ${data.error}`, timestamp: now() }
        ]);
      }
    } catch (err) {
      console.error('Screenshot capture failed:', err);
    }
  };

  const handleDeleteScreenshot = async (id) => {
    try {
      await fetch(`/api/screenshot/${id}`, { method: 'DELETE' });
      setScreenshots((prev) => prev.filter((s) => s.id !== id && s.filename !== id));
    } catch (err) {
      console.error('Delete failed:', err);
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

        {/* Navigation Tabs (Results vs Screenshots vs Logs) */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'results'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Search Results</span>
            {rawResults.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
                {loadedList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('screenshots')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'screenshots'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Screenshots Gallery</span>
            <span className="px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[10px]">
              {screenshots.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Telemetry Logs</span>
            {logs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Real-Time Live Console (Always visible while searching/probing or if on logs tab) */}
        {(activeTab === 'logs' || loading || probingActive) && (
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

        {/* TAB 1: SEARCH RESULTS */}
        {activeTab === 'results' && (
          <>
            {/* Loading Spinner */}
            {loading && (
              <div className="w-full my-12 p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-3" />
                <div className="text-white font-bold text-base">
                  Querying Ahmia .onion Search Index
                </div>
                <p className="text-xs text-zinc-400 mt-1 max-w-md">
                  Traversing Tor SOCKS5 circuit and solving anti-bot tokens via Playwright... (~15s)
                </p>
              </div>
            )}

            {/* Results Grid */}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {displayedResults.map((item, idx) => (
                    <ResultCard
                      key={item.onion + idx}
                      item={item}
                      index={idx}
                      onReProbe={handleSingleReProbe}
                      onCaptureScreenshot={handleCaptureScreenshot}
                      onOpenSnapshot={setLightboxSnapshot}
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
            {!loading && rawResults.length === 0 && !error && (
              <div className="w-full my-8 p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center">
                <Terminal className="w-8 h-8 text-purple-400/60 mx-auto mb-2" />
                <div className="text-sm font-semibold text-zinc-300">Ready for Exploration</div>
                <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
                  Enter a search query above. Gengar will dynamically load 20–30 hidden services, probe their availability, and automatically capture full browser screenshots for verified online sites.
                </p>
              </div>
            )}
          </>
        )}

        {/* TAB 2: SCREENSHOTS GALLERY */}
        {activeTab === 'screenshots' && (
          <ScreenshotsGallery
            screenshots={screenshots}
            loading={loadingScreenshots}
            onRefresh={fetchScreenshots}
            onDelete={handleDeleteScreenshot}
            onReCapture={handleCaptureScreenshot}
          />
        )}

        {/* TAB 3: TELEMETRY LOGS */}
        {activeTab === 'logs' && !loading && !probingActive && logs.length === 0 && (
          <div className="w-full py-16 text-center text-zinc-500 rounded-xl bg-zinc-900/40 border border-zinc-800">
            No telemetry logs recorded yet. Execute a search to view real-time Tor packets.
          </div>
        )}
      </main>

      {/* Snapshot Lightbox Modal */}
      {lightboxSnapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setLightboxSnapshot(null)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950 font-mono text-xs">
              <div className="truncate pr-4">
                <div className="font-bold text-white text-sm truncate">
                  {lightboxSnapshot.title || 'Hidden Service Snapshot'}
                </div>
                <div className="text-purple-400 truncate mt-0.5">
                  {lightboxSnapshot.url}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={lightboxSnapshot.screenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Full Size
                </a>
                <button
                  onClick={() => setLightboxSnapshot(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-2 bg-black max-h-[75vh] overflow-auto flex items-center justify-center">
              <img
                src={lightboxSnapshot.screenshotUrl}
                alt={lightboxSnapshot.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full border-t border-zinc-800 bg-zinc-950 py-4 px-4 sm:px-6 text-xs text-zinc-500 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>GENGAR OSINT // Powered by Tor, Ahmia & Playwright</span>
          <span className="text-zinc-600">Educational / research use only.</span>
        </div>
      </footer>
    </div>
  );
}
