import React, { useState } from 'react';
import { Copy, Check, RefreshCw, Globe, Clock, AlertTriangle, Camera, ExternalLink } from 'lucide-react';

export default function ResultCard({ item, index, onReProbe, onCaptureScreenshot, onOpenSnapshot }) {
  const [copied, setCopied] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const probe = item.probe;

  const handleCopy = () => {
    navigator.clipboard.writeText(item.onion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScreenshotClick = async () => {
    if (probe?.screenshot) {
      onOpenSnapshot?.({
        screenshotUrl: probe.screenshot,
        title: probe.title || item.title,
        url: item.onion,
      });
      return;
    }
    if (!onCaptureScreenshot) return;
    setCapturing(true);
    await onCaptureScreenshot(item.onion);
    setCapturing(false);
  };

  const isAlive = probe?.alive === true;
  const isDead = probe && probe.alive === false;
  const isProbing = probe?.status === 'probing';
  const displayTitle = probe?.title || item.title || 'Untitled Hidden Service';

  return (
    <div className={`rounded-xl border p-5 font-mono text-xs flex flex-col justify-between transition-all ${
      isAlive
        ? 'bg-zinc-900/90 border-emerald-900/50 hover:border-emerald-500/50 shadow-[0_4px_20px_rgba(16,185,129,0.08)]'
        : isDead
          ? 'bg-zinc-900/50 border-rose-950/40 opacity-80 hover:opacity-100 hover:border-rose-800/40'
          : isProbing
            ? 'bg-zinc-900 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
            : 'bg-zinc-900/80 border-zinc-800 hover:border-purple-500/40'
    }`}>
      <div>
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-bold px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800">
              #{String(index + 1).padStart(2, '0')}
            </span>

            {/* Status Pill */}
            {isProbing ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 text-[11px] animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>PROBING...</span>
              </div>
            ) : isAlive ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>ONLINE ({probe.status || 200})</span>
              </div>
            ) : isDead ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-950/50 border border-rose-600/40 text-rose-300 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>OFFLINE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <span>QUEUED</span>
              </div>
            )}

            {/* Latency */}
            {isAlive && probe.latencyMs && (
              <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>{probe.latencyMs}ms</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Snapshot button */}
            {isAlive && (
              <button
                onClick={handleScreenshotClick}
                disabled={capturing}
                title={probe?.screenshot ? 'View screenshot' : 'Take screenshot'}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-colors ${
                  probe?.screenshot
                    ? 'bg-purple-950/80 border-purple-600/60 text-purple-300 hover:bg-purple-900/60'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Camera className={`w-3 h-3 ${capturing ? 'animate-spin' : ''}`} />
                <span>{probe?.screenshot ? 'Snapshot' : 'Capture'}</span>
              </button>
            )}

            <button
              onClick={() => onReProbe?.(item.onion)}
              disabled={isProbing}
              title="Probe this hidden service"
              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950 hover:bg-purple-950/60 border border-zinc-800 hover:border-purple-800 text-zinc-400 hover:text-purple-300 transition-colors text-[11px] disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isProbing ? 'animate-spin' : ''}`} />
              <span>Probe</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors text-[11px]"
              title="Copy .onion URL"
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
          </div>
        </div>

        {/* Title */}
        <h3 className={`text-sm font-semibold tracking-wide ${
          isAlive ? 'text-white' : isDead ? 'text-zinc-400 line-through' : 'text-zinc-200'
        }`}>
          {displayTitle}
        </h3>

        {/* Onion URL */}
        <div className="mt-2.5 flex items-center gap-1.5 p-2 rounded-lg bg-black/40 border border-zinc-800 text-[11px]">
          <Globe className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="text-purple-300 select-all truncate font-mono">
            {item.onion}
          </span>
        </div>

        {/* Screenshot Image Preview if captured */}
        {probe?.screenshot && (
          <div
            className="mt-3 relative rounded-lg overflow-hidden border border-purple-800/40 bg-black/60 aspect-video cursor-pointer group"
            onClick={handleScreenshotClick}
          >
            <img
              src={probe.screenshot}
              alt={displayTitle}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-bold flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> View Full Screenshot
              </span>
            </div>
          </div>
        )}

        {/* Description snippet */}
        {item.description && (
          <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed font-sans line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Error Details */}
        {isDead && probe.error && (
          <div className="mt-2.5 p-2 rounded bg-rose-950/20 border border-rose-900/30 text-[11px] text-rose-300/80 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">Error: {probe.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
