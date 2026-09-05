import React, { useState } from 'react';
import { Camera, Copy, Check, Globe, RefreshCw, Trash2, Maximize2, ExternalLink, Calendar, Search } from 'lucide-react';

export default function ScreenshotsGallery({
  screenshots,
  loading,
  onRefresh,
  onDelete,
  onReCapture
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleCopy = (id, url) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = (screenshots || []).filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (s.title || '').toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q);
  });

  return (
    <div className="w-full font-mono text-xs space-y-4">
      {/* Gallery Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-800/40 text-purple-400">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">DARK-WEB VISUAL SNAPSHOTS</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[11px] font-bold">
                {screenshots.length} Captured
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Automated Playwright Chromium screen captures of verified live .onion services
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* In-gallery filter search */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search snapshots..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh snapshot list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Snapshots Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id || item.filename}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/90 overflow-hidden hover:border-purple-500/50 hover:shadow-[0_8px_30px_rgba(147,51,234,0.15)] transition-all flex flex-col justify-between"
            >
              {/* Image Preview Container */}
              <div
                className="relative aspect-video bg-black/60 cursor-pointer overflow-hidden border-b border-zinc-800"
                onClick={() => setSelectedSnapshot(item)}
              >
                <img
                  src={item.screenshotUrl}
                  alt={item.title || item.url}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Status Pill on top of image */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{item.status || 200} OK</span>
                </div>

                {/* Hover overlay with zoom hint */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-purple-600/90 text-white text-[11px] font-semibold flex items-center gap-1">
                    <Maximize2 className="w-3.5 h-3.5" /> Enlarge Snapshot
                  </span>
                </div>
              </div>

              {/* Card Meta & Details */}
              <div className="p-4 space-y-2.5">
                {/* Title */}
                <h4 className="font-semibold text-white text-xs sm:text-sm truncate">
                  {item.title || 'Untitled Hidden Service'}
                </h4>

                {/* Onion URL */}
                <div className="flex items-center gap-1.5 p-1.5 rounded bg-black/40 border border-zinc-800/80 text-[11px]">
                  <Globe className="w-3 h-3 text-purple-400 shrink-0" />
                  <span className="text-purple-300 truncate font-mono select-all">
                    {item.url}
                  </span>
                </div>

                {/* Footer bar: Timestamp & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {item.capturedAt
                      ? new Date(item.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : 'Just now'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(item.id, item.url)}
                      className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title="Copy .onion"
                    >
                      {copiedId === item.id ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Copied
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Copy className="w-3 h-3" /> Copy
                        </span>
                      )}
                    </button>

                    {onReCapture && (
                      <button
                        onClick={() => onReCapture(item.url)}
                        className="px-2 py-1 rounded bg-zinc-950 hover:bg-purple-950/60 border border-zinc-800 hover:border-purple-800 text-zinc-400 hover:text-purple-300 transition-colors"
                        title="Re-capture screenshot"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}

                    {onDelete && (
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1 rounded bg-zinc-950 hover:bg-rose-950/60 border border-zinc-800 hover:border-rose-800 text-zinc-500 hover:text-rose-400 transition-colors"
                        title="Delete screenshot"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="w-full py-16 px-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center space-y-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-800/40 text-purple-400 mx-auto">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-base">No Screenshots Captured Yet</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            When search results are probed live and found to be <span className="text-emerald-400 font-semibold">ONLINE</span>, Gengar automatically launches Playwright over Tor SOCKS5 to take visual screenshots of the hidden service.
          </p>
        </div>
      )}

      {/* Lightbox Enlarged Modal */}
      {selectedSnapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setSelectedSnapshot(null)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950">
              <div className="truncate pr-4">
                <div className="font-bold text-white text-sm truncate">
                  {selectedSnapshot.title || 'Hidden Service Snapshot'}
                </div>
                <div className="text-[11px] text-purple-400 font-mono truncate mt-0.5">
                  {selectedSnapshot.url}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={selectedSnapshot.screenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={selectedSnapshot.filename}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Full Resolution</span>
                </a>

                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Image */}
            <div className="p-2 bg-black max-h-[75vh] overflow-auto flex items-center justify-center">
              <img
                src={selectedSnapshot.screenshotUrl}
                alt={selectedSnapshot.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
