import React from 'react';
import { RefreshCw, RotateCw, Shield, Zap } from 'lucide-react';

export default function Header({
  torStatus,
  checkingTor,
  onRefreshTor,
  onOpenCircuitModal,
  isCyclingCircuit = false,
  onQuickCycleCircuit,
}) {
  const isTorActive = torStatus?.ok;

  return (
    <header className="w-full border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-2.5 font-mono">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-white text-base tracking-wider">GENGAR</span>
          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-800/40">
            Tor v1.0
          </span>
        </div>

        {/* Tor Telemetry & Circuit Suite */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* SOCKS5 Port */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-400">
            <span>SOCKS5:</span>
            <span className="text-zinc-200">127.0.0.1:9050</span>
          </div>

          {/* Status Badge & Circuit Modal Trigger */}
          <button
            onClick={onOpenCircuitModal}
            title="Click to open Tor Circuit Manager"
            className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs cursor-pointer transition-all hover:border-purple-500 ${
              checkingTor
                ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                : isTorActive
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/50'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-300 hover:bg-rose-950/50'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {isTorActive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  checkingTor ? 'bg-amber-400' : isTorActive ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
              ></span>
            </span>
            <span className="font-semibold">
              {checkingTor ? 'Checking Tor...' : isTorActive ? 'Tor Active' : 'Tor Offline'}
            </span>
            {torStatus?.ip && (
              <span className="hidden md:inline text-zinc-400 border-l border-zinc-700/60 pl-2">
                Exit IP: <span className="text-purple-300 font-semibold">{torStatus.ip}</span>
              </span>
            )}
          </button>

          {/* Quick Cycle Circuit (NEWNYM) Button */}
          <button
            onClick={onQuickCycleCircuit}
            disabled={isCyclingCircuit || checkingTor}
            title="Rotate Tor Circuit Identity (SIGNAL NEWNYM)"
            className="px-2.5 py-1 rounded-lg bg-purple-950/50 hover:bg-purple-900/70 border border-purple-600/50 text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(168,85,247,0.2)] disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 text-purple-300 ${isCyclingCircuit ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isCyclingCircuit ? 'Cycling...' : 'New Circuit'}</span>
          </button>

          {/* Refresh Tor Status Button */}
          <button
            onClick={onRefreshTor}
            disabled={checkingTor}
            title="Refresh Tor status"
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingTor ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}

