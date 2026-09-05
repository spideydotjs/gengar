import React, { useState } from 'react';
import { X, Copy, Check, RefreshCw, Globe, Clock, ShieldCheck, AlertTriangle, Terminal, ExternalLink } from 'lucide-react';

export default function DetailsModal({ item, onClose, onReProbe }) {
  const [copied, setCopied] = useState(false);
  if (!item) return null;

  const probe = item.probe;
  const isAlive = probe?.alive === true;
  const isDead = probe && probe.alive === false;
  const isProbing = probe?.status === 'probing';

  const handleCopy = () => {
    navigator.clipboard.writeText(item.onion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-2xl bg-[#0e0a1a] border border-purple-900/60 shadow-[0_10px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(168,85,247,0.15)] font-mono text-xs overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-900/40 bg-[#140e26]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-white text-sm">HIDDEN-SERVICE TELEMETRY</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-purple-950/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Status Banner */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
            isAlive
              ? 'bg-emerald-950/30 border-emerald-600/40 text-emerald-200'
              : isDead
                ? 'bg-rose-950/30 border-rose-600/40 text-rose-200'
                : 'bg-purple-950/30 border-purple-800/40 text-purple-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${
                isAlive ? 'bg-emerald-400 animate-ping' : isDead ? 'bg-rose-500' : 'bg-cyan-400 animate-pulse'
              }`} />
              <div>
                <div className="font-bold text-sm">
                  {isAlive ? `ONLINE (HTTP ${probe.status || 200})` : isDead ? 'OFFLINE / UNREACHABLE' : 'QUEUED / PROBING'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {isAlive
                    ? `Verified alive via Tor SOCKS5 circuit with ${probe.latencyMs}ms round-trip latency.`
                    : isDead
                      ? `Error: ${probe.error || 'Connection timed out or hidden service not publishing descriptors.'}`
                      : 'Probing status in progress over 127.0.0.1:9050.'}
                </div>
              </div>
            </div>

            <button
              onClick={() => onReProbe(item.onion)}
              disabled={isProbing}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-purple-600 text-zinc-200 text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
              <span>Probe</span>
            </button>
          </div>

          {/* Onion Address Section */}
          <div className="space-y-1.5">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Onion Service URL</div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-purple-950/60 gap-2">
              <div className="flex items-center gap-2 truncate text-purple-300 select-all text-xs font-semibold">
                <Globe className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="truncate">{item.onion}</span>
              </div>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/40 text-purple-300 text-xs flex items-center gap-1 transition-colors shrink-0"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Titles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#120e22] border border-purple-900/30">
              <div className="text-[10px] text-zinc-500 uppercase">Live HTML &lt;title&gt;</div>
              <div className="text-white font-semibold mt-1 break-words">
                {probe?.title || <span className="text-zinc-500 italic">Not available (offline)</span>}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#120e22] border border-purple-900/30">
              <div className="text-[10px] text-zinc-500 uppercase">Ahmia Index Title</div>
              <div className="text-zinc-300 mt-1 break-words">
                {item.title || 'Untitled'}
              </div>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-zinc-500 uppercase">Index Description / Keywords</div>
              <div className="p-3 rounded-xl bg-[#120e22] border border-purple-900/30 text-zinc-300 text-xs leading-relaxed font-sans">
                {item.description}
              </div>
            </div>
          )}

          {/* Technical Diagnostics */}
          <div className="p-3 rounded-xl bg-black/40 border border-purple-950/40 text-[11px] text-zinc-400 space-y-1">
            <div className="text-zinc-500 font-semibold mb-1">CIRCUIT SPECS:</div>
            <div>• SOCKS5 Proxy: <span className="text-zinc-200">127.0.0.1:9050</span></div>
            <div>• DNS Resolution: <span className="text-emerald-400">Remote Tor daemon (socks5h)</span></div>
            <div>• User-Agent: <span className="text-zinc-300">TorBrowser Firefox ESR</span></div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-purple-900/40 bg-[#120e22] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors"
          >
            Close Telemetry
          </button>
        </div>
      </div>
    </div>
  );
}
