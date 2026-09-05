import React from 'react';
import { Pause, CheckCircle, XCircle, Zap, Search, Activity, Coins } from 'lucide-react';

export default function StatsBar({
  totalIndexed,
  loadedCount,
  probedCount,
  aliveCount,
  deadCount,
  walletCount = 0,
  walletSiteCount = 0,
  probingActive,
  currentProbingUrl,
  onTriggerProbeAll,
  onPauseProbe,
  activeFilter,
  setActiveFilter,
  filterText,
  setFilterText
}) {
  const percentProbed = loadedCount > 0 ? Math.round((probedCount / loadedCount) * 100) : 0;

  return (
    <div className="w-full mb-6 space-y-3 font-mono">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Index Total */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="text-[11px] text-zinc-500 uppercase">Ahmia Total</div>
          <div className="text-lg font-bold text-white mt-0.5 truncate">
            {totalIndexed ? totalIndexed.toLocaleString() : loadedCount}
          </div>
        </div>

        {/* Loaded Batch */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="text-[11px] text-zinc-500 uppercase">Loaded Results</div>
          <div className="text-lg font-bold text-purple-300 mt-0.5">{loadedCount}</div>
        </div>

        {/* Probed Count */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="text-[11px] text-zinc-500 uppercase flex items-center justify-between">
            <span>Probed</span>
            {probingActive && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
          </div>
          <div className="text-lg font-bold text-cyan-400 mt-0.5">
            {probedCount} <span className="text-xs text-zinc-500 font-normal">/ {loadedCount}</span>
          </div>
        </div>

        {/* Online / 200 */}
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
          <div className="text-[11px] text-emerald-400 uppercase flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Online</span>
          </div>
          <div className="text-lg font-bold text-emerald-300 mt-0.5">{aliveCount}</div>
        </div>

        {/* Crypto Wallets Found */}
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/40">
          <div className="text-[11px] text-amber-400 uppercase flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>BTC Wallets</span>
          </div>
          <div className="text-lg font-bold text-amber-300 mt-0.5">
            {walletCount} <span className="text-xs text-zinc-500 font-normal">({walletSiteCount} sites)</span>
          </div>
        </div>

        {/* Probe Control Button */}
        <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 col-span-2 sm:col-span-1 flex flex-col justify-center">
          {probingActive ? (
            <button
              onClick={onPauseProbe}
              className="w-full py-2 px-3 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={onTriggerProbeAll}
              disabled={loadedCount === 0}
              className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)] disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{probedCount > 0 ? 'Re-Probe' : 'Probe All'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar during Probing */}
      {probingActive && (
        <div className="w-full bg-zinc-900/80 rounded-xl p-3 border border-zinc-800 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-zinc-400">
            <div className="flex items-center gap-2 text-cyan-300 truncate max-w-xl">
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span className="font-semibold text-white">Tor Probe & Wallet Extraction:</span>
              <span className="text-zinc-400 truncate text-[11px]">
                {currentProbingUrl || 'Connecting to onion circuit...'}
              </span>
            </div>
            <span className="text-cyan-300 font-semibold">{percentProbed}% ({probedCount}/{loadedCount})</span>
          </div>

          <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${percentProbed}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter and In-Page Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              activeFilter === 'all'
                ? 'bg-purple-900/40 border-purple-500 text-purple-200 font-semibold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            All ({loadedCount})
          </button>
          <button
            onClick={() => setActiveFilter('alive')}
            className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
              activeFilter === 'alive'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-semibold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            Online ({aliveCount})
          </button>

          {/* With Wallets Filter */}
          <button
            onClick={() => setActiveFilter('wallets')}
            className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
              activeFilter === 'wallets'
                ? 'bg-amber-950/80 border-amber-500 text-amber-200 font-semibold shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-amber-300'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>With Wallets ({walletSiteCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('dead')}
            className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
              activeFilter === 'dead'
                ? 'bg-rose-950/60 border-rose-500 text-rose-200 font-semibold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Offline ({deadCount})
          </button>
          <button
            onClick={() => setActiveFilter('unprobed')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              activeFilter === 'unprobed'
                ? 'bg-zinc-800 border-zinc-600 text-white font-semibold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Unprobed ({loadedCount - probedCount})
          </button>
        </div>

        {/* Text Filter Input */}
        <div className="relative flex items-center w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter list or wallet..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>
    </div>
  );
}
