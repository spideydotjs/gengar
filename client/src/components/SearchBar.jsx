import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, Zap } from 'lucide-react';

const SUGGESTED_TAGS = [
  'bitcoin',
  'marketplace',
  'cyber security',
  'forums',
  'pgp keys',
  'tor directory'
];

export default function SearchBar({
  onSearch,
  loading,
  probeLimit,
  setProbeLimit,
  autoProbe,
  setAutoProbe
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    onSearch(query.trim());
  };

  const handleTagClick = (tag) => {
    setQuery(tag);
    onSearch(tag);
  };

  return (
    <div className="w-full mb-8 font-mono">
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        {/* Search Input */}
        <div className="relative flex items-center w-full">
          <div className="absolute left-4 text-purple-400 pointer-events-none">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Ahmia dark-web hidden services (e.g. bitcoin, forum)... [/ to focus]"
            disabled={loading}
            className="w-full pl-12 pr-28 py-3.5 sm:py-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-lg"
          />

          <div className="absolute right-2.5 sm:right-3 flex items-center gap-1.5">
            {query && !loading && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold tracking-wide transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <span>Execute</span>
              )}
            </button>
          </div>
        </div>

        {/* Probing Options & Suggestions */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tag suggestions */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-zinc-500 text-[11px] mr-1">Suggestions:</span>
            {SUGGESTED_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagClick(tag)}
                className="px-2 py-1 rounded bg-zinc-900 hover:bg-purple-950/60 border border-zinc-800 hover:border-purple-800 text-zinc-300 hover:text-purple-300 text-[11px] transition-colors"
              >
                #{tag}
              </button>
            ))}
          </div>

          {/* Prober controls */}
          <div className="flex items-center gap-3 ml-auto">
            <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-300">
              <input
                type="checkbox"
                checked={autoProbe}
                onChange={(e) => setAutoProbe(e.target.checked)}
                className="rounded bg-zinc-900 border-zinc-700 text-purple-600 focus:ring-purple-500"
              />
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                Auto-Probe Live
              </span>
            </label>

            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
              <span className="text-zinc-500 text-[11px] px-1">Depth:</span>
              {[10, 20, 25, 30].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setProbeLimit(num)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    probeLimit === num
                      ? 'bg-purple-600 text-white font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
