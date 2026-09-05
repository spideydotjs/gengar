import React, { useEffect, useRef } from 'react';
import { Terminal, Activity, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export default function LiveConsole({ logs, isActive, onClear }) {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom as logs stream in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!logs || logs.length === 0) return null;

  return (
    <div className="w-full mb-8 font-mono text-xs">
      <div className="w-full rounded-xl bg-black border border-zinc-800 shadow-[0_4px_30px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Terminal Title Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            {/* Window control dots */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="text-zinc-400 text-xs font-semibold ml-2 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              LIVE TOR CIRCUIT & SCRAPER TELEMETRY
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isActive ? (
              <span className="flex items-center gap-1.5 text-[11px] text-cyan-400">
                <Activity className="w-3 h-3 animate-spin text-cyan-400" />
                <span>STREAMING</span>
              </span>
            ) : (
              <span className="text-[11px] text-zinc-500">IDLE</span>
            )}

            {onClear && (
              <button
                onClick={onClear}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Clear terminal"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Terminal Body */}
        <div
          ref={scrollRef}
          className="p-4 max-h-56 overflow-y-auto space-y-1.5 font-mono text-[11px] leading-relaxed bg-[#050507]"
        >
          {logs.map((log, index) => {
            const tagColor =
              log.tag === 'SUCCESS' || log.tag === 'LIVE'
                ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                : log.tag === 'ERROR' || log.tag === 'DEAD'
                  ? 'text-rose-400 bg-rose-950/60 border-rose-800/40'
                  : log.tag === 'TOKEN' || log.tag === 'CIRCUIT'
                    ? 'text-purple-400 bg-purple-950/60 border-purple-800/40'
                    : log.tag === 'PROBE'
                      ? 'text-cyan-400 bg-cyan-950/60 border-cyan-800/40'
                      : 'text-amber-400 bg-amber-950/60 border-amber-800/40';

            return (
              <div key={index} className="flex items-start gap-2 select-text hover:bg-zinc-900/30 px-1 py-0.5 rounded transition-colors">
                <span className="text-zinc-600 shrink-0 select-none">
                  [{log.timestamp || new Date().toLocaleTimeString()}]
                </span>

                {log.tag && (
                  <span className={`px-1.5 py-0.2 rounded border text-[10px] font-bold shrink-0 ${tagColor}`}>
                    {log.tag}
                  </span>
                )}

                <span className={`break-all ${
                  log.tag === 'ERROR'
                    ? 'text-rose-300'
                    : log.tag === 'SUCCESS' || log.tag === 'LIVE'
                      ? 'text-emerald-300'
                      : 'text-zinc-300'
                }`}>
                  {log.message}
                </span>
              </div>
            );
          })}

          {/* Active blinking cursor */}
          {isActive && (
            <div className="flex items-center gap-2 pt-1 text-purple-400">
              <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
              <span className="animate-pulse">▌ Processing Tor packet stream...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
