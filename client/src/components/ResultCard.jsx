import React, { useState } from 'react';
import { Copy, Check, RefreshCw, Globe, Clock, AlertTriangle, Camera, ExternalLink, Coins, ChevronDown, ChevronUp } from 'lucide-react';

export default function ResultCard({ item, index, onReProbe, onCaptureScreenshot, onOpenSnapshot, onDeepScan }) {
  const [copied, setCopied] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(null);
  const [showWallets, setShowWallets] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const probe = item.probe;

  const handleCopy = () => {
    navigator.clipboard.writeText(item.onion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyWallet = (e, addr) => {
    e.stopPropagation();
    navigator.clipboard.writeText(addr);
    setCopiedWallet(addr);
    setTimeout(() => setCopiedWallet(null), 2000);
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

  const btcWallets = probe?.wallets?.btc || [];
  const ethWallets = probe?.wallets?.eth || [];
  const xmrWallets = probe?.wallets?.xmr || [];
  const hasCrypto = btcWallets.length > 0 || ethWallets.length > 0 || xmrWallets.length > 0;

  return (
    <div className={`rounded-xl border p-5 font-mono text-xs flex flex-col justify-between transition-all ${
      hasCrypto
        ? 'bg-zinc-900/95 border-amber-500/40 shadow-[0_4px_25px_rgba(245,158,11,0.08)]'
        : isAlive
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

            {/* Deep Scan button */}
            {isAlive && (
              <button
                onClick={() => onDeepScan?.(item.onion)}
                title="Deep scan this .onion for blockchain wallets & NLP intelligence"
                className="flex items-center gap-1 px-2 py-1 rounded bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 hover:border-amber-400 text-amber-300 transition-colors text-[11px] cursor-pointer"
              >
                <Coins className="w-3 h-3 text-amber-400" />
                <span>Deep Scan</span>
              </button>
            )}

            <button
              onClick={() => onReProbe?.(item.onion)}
              disabled={isProbing}
              title="Probe this hidden service"
              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950 hover:bg-purple-950/60 border border-zinc-800 hover:border-purple-800 text-zinc-400 hover:text-purple-300 transition-colors text-[11px] disabled:opacity-50 cursor-pointer"
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

        {/* Crypto Wallet Alert Badge if detected */}
        {hasCrypto && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40 text-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setShowWallets(!showWallets)}
            >
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <Coins className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>
                  {btcWallets.length > 0 && `${btcWallets.length} Bitcoin (BTC)`}
                  {ethWallets.length > 0 && ` • ${ethWallets.length} ETH`}
                  {xmrWallets.length > 0 && ` • ${xmrWallets.length} XMR`} Wallet(s) Found
                </span>
              </div>
              <button className="text-amber-400 hover:text-white">
                {showWallets ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Wallets List Expanded */}
            {showWallets && (
              <div className="mt-2.5 pt-2 border-t border-amber-900/40 space-y-1.5">
                {btcWallets.map((wallet) => (
                  <div key={wallet} className="flex items-center justify-between p-1.5 rounded bg-black/60 border border-amber-900/40 text-[11px] gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">BTC</span>
                      <span className="text-amber-200 truncate select-all">{wallet}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`https://mempool.space/address/${wallet}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300"
                        title="View on Mempool Blockchain Explorer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={(e) => handleCopyWallet(e, wallet)}
                        className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="Copy BTC address"
                      >
                        {copiedWallet === wallet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                ))}

                {ethWallets.map((wallet) => (
                  <div key={wallet} className="flex items-center justify-between p-1.5 rounded bg-black/60 border border-amber-900/40 text-[11px] gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">ETH</span>
                      <span className="text-cyan-200 truncate select-all">{wallet}</span>
                    </div>
                    <button
                      onClick={(e) => handleCopyWallet(e, wallet)}
                      className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0"
                      title="Copy ETH address"
                    >
                      {copiedWallet === wallet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ))}

                {xmrWallets.map((wallet) => (
                  <div key={wallet} className="flex items-center justify-between p-1.5 rounded bg-black/60 border border-amber-900/40 text-[11px] gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="px-1 py-0.2 rounded bg-orange-500/20 text-orange-300 text-[9px] font-bold">XMR</span>
                      <span className="text-orange-200 truncate select-all">{wallet}</span>
                    </div>
                    <button
                      onClick={(e) => handleCopyWallet(e, wallet)}
                      className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0"
                      title="Copy Monero address"
                    >
                      {copiedWallet === wallet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ))}

                {/* Direct link to deep NLP scraper tab */}
                <div className="pt-2 border-t border-amber-900/40 flex items-center justify-between">
                  <span className="text-[10px] text-amber-400/80">Need full site crawl & NLP intent?</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeepScan?.(item.onion);
                    }}
                    className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Run Deep NLP Crawl →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
