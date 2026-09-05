import React from 'react';

const GHOST_ASCII = [
  '⠀⠀⠀⠀⠀⢸⠓⢄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⢸⠀⠀⠑⢤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⢸⡆⠀⠀⠀⠙⢤⡷⣤⣦⣀⠤⠖⠚⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⣠⡿⠢⢄⡀⠀⡇⠀⠀⠀⠀⠀⠉⠀⠀⠀⠀⠀⠸⠷⣶⠂⠀⠀⠀⣀⣀⠀⠀⠀',
  '⢸⣃⠀⠀⠉⠳⣷⠞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠉⠉⠉⠉⠉⠉⢉⡭⠋',
  '⠀⠘⣆⠀⠀⠀⠁⠀⢀⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡴⠋⠀⠀',
  '⠀⠀⠘⣦⠆⠀⠀⢀⡎⢹⡀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⡀⣠⠔⠋⠀⠀⠀⠀',
  '⠀⠀⠀⡏⠀⠀⣆⠘⣄⠸⢧⠀⠀⠀⠀⢀⣠⠖⢻⠀⠀⠀⣿⢥⣄⣀⣀⣀⠀⠀',
  '⠀⠀⢸⠁⠀⠀⡏⢣⣌⠙⠚⠀⠀⠠⣖⡛⠀⣠⠏⠀⠀⠀⠇⠀⠀⠀⠀⢙⣣⠄',
  '⠀⠀⢸⡀⠀⠀⠳⡞⠈⢻⠶⠤⣄⣀⣈⣉⣉⣡⡔⠀⠀⢀⠀⠀⣀⡤⠖⠚⠀⠀',
  '⠀⠀⡼⣇⠀⠀⠀⠙⠦⣞⡀⠀⢀⡏⠀⢸⣣⠞⠀⠀⠀⡼⠚⠋⠁⠀⠀⠀⠀⠀',
  '⠀⢰⡇⠙⠀⠀⠀⠀⠀⠀⠉⠙⠚⠒⠚⠉⠀⠀⠀⠀⡼⠁⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⢧⡀⠀⢠⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⣞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠙⣶⣶⣿⠢⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠉⠀⠀⠀⠙⢿⣳⠞⠳⡄⠀⠀⠀⢀⡞⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠀⠀⠹⣄⣀⡤⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀'
].join('\n');

export default function AsciiHero() {
  return (
    <div className="w-full mb-8 font-mono">
      <div className="w-full rounded-2xl bg-zinc-900/70 border border-purple-500/20 p-5 sm:p-6 shadow-[0_0_30px_rgba(147,51,234,0.1)]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left: Ghost ASCII */}
          <div className="md:col-span-5 flex justify-center items-center p-3 rounded-xl bg-black/50 border border-zinc-800/80 overflow-x-auto">
            <pre className="text-purple-400 text-xs sm:text-sm leading-tight select-none drop-shadow-[0_0_12px_rgba(192,132,252,0.45)]">
              {GHOST_ASCII}
            </pre>
          </div>

          {/* Right: Terminal Telemetry & Description */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tracking-wider text-purple-400">GENGAR</span>
                <span className="text-xs px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/50">
                  v1.0.0
                </span>
              </div>
              <h2 className="text-sm sm:text-base text-zinc-300 font-semibold mt-1">
                Dark-web Search + Hidden-Service Prober
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                For educational / research use only. All traffic routes through Tor SOCKS5.
              </p>
            </div>

            {/* Spec Table */}
            <div className="space-y-1.5 text-xs text-zinc-400 border-t border-zinc-800 pt-3">
              <div className="flex justify-between">
                <span className="text-zinc-500">Host:</span>
                <span className="text-zinc-200">127.0.0.1:6700</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Proxy:</span>
                <span className="text-emerald-400">socks5h://127.0.0.1:9050</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Search Engine:</span>
                <span className="text-purple-300">Ahmia .onion (Playwright Handshake)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Routes:</span>
                <span className="text-zinc-300">GET /api/search • POST /api/probe</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
