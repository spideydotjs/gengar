import React, { useState } from 'react';
import { Copy, Check, RefreshCw, Globe, Clock, AlertTriangle, ExternalLink } from 'lucide-react';

export default function ResultRow({ item, index, onReProbe, onSelect }) {
  const [copied, setCopied] = useState(false);
  const probe = item.probe;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.onion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAlive = probe?.alive === true;
  const isDead = probe && probe.alive === false;
  const isProbing = probe?.status === 'probing';
  const displayTitle = probe?.title || item.title || 'Untitled Hidden Service';

  return (
    <div
      onClick={() => onSelect?.(item)}
      className={`group flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 p-3 sm:px-4 rounded-xl border font-mono text-xs cursor-pointer transition-all ${
        isAlive
          ? 'bg-[#110d1f]/90 border-emerald-900/40 hover:border-emerald-500/50 hover:bg-[#151026]'
          : isDead
            ? 'bg-[#0f0b1a]/70 border-rose-950/40 hover:border-rose-800/40'
            : isProbing
              ? 'bg-[#140e26] border-cyan-500/40'
              : 'bg-[#110d1f]/60 border-purple-950/40 hover:border-purple-800/40 hover:bg-[#151026]'
      }`}
    >
      {/* Left: Index & Status Indicator */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-[130px] shrink-0">
        <span className="text-[10px] text-zinc-500 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
          #{String(index + 1).padStart(2, '0')}
        </span>

        {isProbing ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 text-[10px] animate-probe-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>PROBING</span>
          </div>
        ) : isAlive ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>200 OK</span>
          </div>
        ) : isDead ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-950/60 border border-rose-600/40 text-rose-300 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>OFFLINE</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span>QUEUED</span>
          </div>
        )}

        {isAlive && probe.latencyMs && (
          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-emerald-400" />
            {probe.latencyMs}ms
          </span>
        )}
      </div>

      {/* Middle: Title & Onion Address */}
      <div className="flex-1 min-w-[200px] overflow-hidden pr-2">
        <div className="flex items-center gap-2">
          <span className={`font-semibold truncate text-xs sm:text-sm ${
            isAlive ? 'text-white' : isDead ? 'text-zinc-400 line-through' : 'text-zinc-200'
          }`}>
            {displayTitle}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-purple-300/80 truncate mt-0.5">
          <Globe className="w-3 h-3 text-purple-400 shrink-0" />
          <span className="truncate select-all">{item.onion}</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors text-[11px]"
          title="Copy .onion"
        >
          {copied ? (
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

        <button
          onClick={() => onReProbe?.(item.onion)}
          disabled={isProbing}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900/80 hover:bg-purple-950/60 border border-zinc-800 hover:border-purple-700/50 text-zinc-400 hover:text-purple-300 transition-colors text-[11px] disabled:opacity-40"
          title="Re-probe URL"
        >
          <RefreshCw className={`w-3 h-3 ${isProbing ? 'animate-spin' : ''}`} />
          <span>Probe</span>
        </button>
      </div>
    </div>
  );
}
