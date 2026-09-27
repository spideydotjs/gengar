import React, { useState, useEffect } from 'react';
import {
  RotateCw, Shield, Radio, Activity, Check, Copy, AlertTriangle,
  Clock, X, Zap, Globe, Layers, ArrowRight
} from 'lucide-react';

export default function TorCircuitModal({ isOpen, onClose, onCircuitCycled }) {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [cycling, setCycling] = useState(false);
  const [cycleFeedback, setCycleFeedback] = useState(null);
  const [autoCycleInterval, setAutoCycleInterval] = useState(0);
  const [copiedText, setCopiedText] = useState(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/tor/circuit/status');
      const data = await res.json();
      if (data.success && data.circuit) {
        setStatus(data.circuit);
        if (data.circuit.autoCycleActive) {
          setAutoCycleInterval(5); // default estimate if active
        }
      }
    } catch (err) {
      console.error('Failed to fetch Tor circuit status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setCycleFeedback(null);
    }
  }, [isOpen]);

  const handleCycleCircuit = async () => {
    if (cycling) return;
    setCycling(true);
    setCycleFeedback(null);
    try {
      const res = await fetch('/api/tor/circuit/cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verifyExitIp: true }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setCycleFeedback(data.result);
        fetchStatus();
        onCircuitCycled?.(data.result);
      } else {
        setCycleFeedback({ error: data.error || 'Failed to cycle circuit' });
      }
    } catch (err) {
      setCycleFeedback({ error: err.message });
    } finally {
      setCycling(false);
    }
  };

  const handleSetAutoCycle = async (mins) => {
    setAutoCycleInterval(mins);
    try {
      await fetch('/api/tor/circuit/auto-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMinutes: mins }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to configure auto-cycling:', err);
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-purple-500/40 rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-600/40 text-purple-300">
              <RotateCw className={`w-5 h-5 ${cycling ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>TOR CIRCUIT MANAGER</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  NEWNYM &bull; ISOLATION
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                On-demand identity rotation, stream isolation, and exit node cycling
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Active Circuit Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Active Identity Token */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
              <div className="text-[11px] text-zinc-400 font-bold uppercase flex items-center justify-between">
                <span>Active Circuit ID</span>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-cyan-300 break-all select-all">
                  {status?.activeCircuitId || 'Generating...'}
                </span>
                <button
                  onClick={() => handleCopy(status?.activeCircuitId)}
                  className="p-1 text-zinc-400 hover:text-white shrink-0 ml-2"
                  title="Copy Circuit ID"
                >
                  {copiedText === status?.activeCircuitId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="text-[10px] text-zinc-500">
                Rotated: {status?.lastRotatedAt ? new Date(status.lastRotatedAt).toLocaleTimeString() : 'N/A'}
              </div>
            </div>

            {/* Current Exit Node IP */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
              <div className="text-[11px] text-zinc-400 font-bold uppercase flex items-center justify-between">
                <span>Current Exit IP</span>
                <Globe className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-base font-bold text-emerald-400">
                {status?.lastKnownExitIp || 'Tor Exit Node Active'}
              </div>
              <div className="text-[10px] text-zinc-500">
                Resolved via check.torproject.org
              </div>
            </div>
          </div>

          {/* Quick Action: Cycle Circuit Button */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-zinc-900/80 to-purple-950/40 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Instant Identity Rotation</span>
              </div>
              <p className="text-xs text-zinc-400 max-w-md">
                Flushes dirty circuits, issues Tor Control <code className="text-purple-300">SIGNAL NEWNYM</code>, and allocates fresh SOCKS5 stream credentials.
              </p>
            </div>
            <button
              onClick={handleCycleCircuit}
              disabled={cycling}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50 cursor-pointer shrink-0"
            >
              <RotateCw className={`w-4 h-4 ${cycling ? 'animate-spin' : ''}`} />
              <span>{cycling ? 'Cycling Circuit...' : 'Cycle Circuit (NEWNYM)'}</span>
            </button>
          </div>

          {/* Cycle Result Feedback Box */}
          {cycleFeedback && (
            <div className={`p-4 rounded-xl border text-xs space-y-2 animate-fade-in ${
              cycleFeedback.error
                ? 'bg-rose-950/40 border-rose-700/60 text-rose-300'
                : 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
            }`}>
              {cycleFeedback.error ? (
                <div className="flex items-center gap-2 font-bold text-rose-200">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Cycle Error: {cycleFeedback.error}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between font-bold text-emerald-200">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Identity Successfully Rotated ({cycleFeedback.durationMs}ms)</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-700">
                      {cycleFeedback.method}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300 font-mono text-[11px] pt-1">
                    <span className="text-zinc-500">{cycleFeedback.previousIp || 'Previous IP'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-emerald-400 font-bold">{cycleFeedback.newIp || 'New Exit IP'}</span>
                    <span className="text-zinc-500 ml-auto">Token: {cycleFeedback.circuitId?.slice(0, 14)}...</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Automated Circuit Cycling Timer Settings */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Automated Background Cycling</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                status?.autoCycleActive
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  : 'bg-zinc-800 text-zinc-400'
              }`}>
                {status?.autoCycleActive ? 'Active' : 'Disabled'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Off', val: 0 },
                { label: '3 Mins', val: 3 },
                { label: '5 Mins', val: 5 },
                { label: '10 Mins', val: 10 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => handleSetAutoCycle(opt.val)}
                  className={`py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    autoCycleInterval === opt.val
                      ? 'bg-purple-900/50 border-purple-500 text-purple-200'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500">
              Periodically rotates circuits in the background to prevent bot detection and rate limiting while crawling darknet directories.
            </p>
          </div>

          {/* Protocol Specifications & Diagnostics */}
          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/80 space-y-2 text-xs">
            <div className="font-bold text-zinc-400 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Tor Protocol Mechanics</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-400">
              <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-zinc-800">
                <span>ControlPort:</span>
                <span className="font-mono text-zinc-300">
                  {status?.controlPortConfig?.host}:{status?.controlPortConfig?.port}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-zinc-800">
                <span>Stream Isolation:</span>
                <span className="text-emerald-400 font-bold">IsolateSOCKSAuth</span>
              </div>
            </div>
          </div>

          {/* Rotation History Trail */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-zinc-400 flex items-center justify-between">
              <span>Recent Rotation History</span>
              <span className="text-[10px] text-zinc-500">Last 10 events</span>
            </div>
            {!status?.recentCycles || status.recentCycles.length === 0 ? (
              <p className="text-xs text-zinc-600 italic py-2">No circuit rotations logged yet in this session.</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {status.recentCycles.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/70 text-[11px] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400 font-bold">{c.newToken?.slice(0, 12)}...</span>
                      <span className="text-zinc-600">&bull;</span>
                      <span className="text-zinc-400">{c.method === 'CONTROL_PORT_SIGNAL_NEWNYM' ? 'NEWNYM' : 'ISOLATION'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.newIp && <span className="text-emerald-400 font-bold">{c.newIp}</span>}
                      <span className="text-zinc-500 text-[10px]">
                        {new Date(c.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-900/30 text-xs text-zinc-500">
          <span>Gengar Privacy Engine &bull; RFC 1928 &bull; Tor Control-Spec</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
