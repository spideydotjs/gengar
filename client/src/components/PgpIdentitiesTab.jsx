import React, { useState, useEffect } from 'react';
import {
  Key, Shield, Fingerprint, Globe, User, Calendar, ExternalLink,
  Copy, Check, Search, AlertCircle, RefreshCw, Layers, ArrowRight, Lock
} from 'lucide-react';
import PgpInspectorModal from './PgpInspectorModal';

export default function PgpIdentitiesTab({ onNavigateToSite }) {
  const [identities, setIdentities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFp, setSelectedFp] = useState(null);
  const [selectedKeyData, setSelectedKeyData] = useState(null);

  // Manual armor parser state
  const [manualArmor, setManualArmor] = useState('');
  const [parsingManual, setParsingManual] = useState(false);
  const [manualError, setManualError] = useState(null);

  useEffect(() => {
    fetchIdentities();
  }, []);

  const fetchIdentities = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pgp/identities');
      const data = await res.json();
      if (data.success && Array.isArray(data.identities)) {
        setIdentities(data.identities);
      } else {
        setError(data.error || 'Failed to retrieve PGP identities');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualParse = async (e) => {
    e.preventDefault();
    if (!manualArmor.trim()) return;
    setParsingManual(true);
    setManualError(null);
    try {
      const res = await fetch('/api/pgp/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawArmor: manualArmor }),
      });
      const data = await res.json();
      if (data.success && data.key) {
        setSelectedKeyData(data.key);
        setSelectedFp(data.key.fingerprint);
        setManualArmor('');
      } else {
        setManualError(data.error || 'Failed to parse armored PGP key');
      }
    } catch (err) {
      setManualError(err.message);
    } finally {
      setParsingManual(false);
    }
  };

  const filteredIdentities = identities.filter((id) => {
    const q = searchQuery.toLowerCase();
    return (
      id.fingerprint?.toLowerCase().includes(q) ||
      id.keyId?.toLowerCase().includes(q) ||
      id.primaryUserId?.toLowerCase().includes(q) ||
      (id.discoveredOn || []).some((url) => url.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 w-full font-mono text-xs">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-zinc-900/90 border border-purple-900/40 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                PGP Identity & Fingerprint Intelligence Hub
              </h2>
              <p className="text-zinc-400 text-xs mt-0.5">
                Cryptographic operator profiling, cross-onion domain linkage, and keyserver correlation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchIdentities}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Vault</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/80">
          <div className="p-3 rounded-xl bg-black/40 border border-zinc-800">
            <div className="text-zinc-500 text-[10px] uppercase font-bold">Total PGP Identities</div>
            <div className="text-lg font-bold text-purple-300 mt-1">{identities.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-zinc-800">
            <div className="text-zinc-500 text-[10px] uppercase font-bold">Multi-Onion Shared Keys</div>
            <div className="text-lg font-bold text-emerald-400 mt-1">
              {identities.filter((id) => (id.discoveredOn || []).length > 1).length}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-zinc-800">
            <div className="text-zinc-500 text-[10px] uppercase font-bold">Standard Standard</div>
            <div className="text-lg font-bold text-cyan-400 mt-1">RFC 4880</div>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-zinc-800">
            <div className="text-zinc-500 text-[10px] uppercase font-bold">Keyserver Verification</div>
            <div className="text-lg font-bold text-amber-400 mt-1">Tor-Routed</div>
          </div>
        </div>
      </div>

      {/* Manual PGP Key Inspector Input Box */}
      <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
        <div className="flex items-center gap-2 text-zinc-300 font-bold text-sm">
          <Shield className="w-4 h-4 text-purple-400" />
          <span>Inspect or Decode Custom PGP Public Key Block</span>
        </div>
        <form onSubmit={handleManualParse} className="space-y-3">
          <textarea
            value={manualArmor}
            onChange={(e) => setManualArmor(e.target.value)}
            rows={3}
            placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;Paste any raw armored public key block here to extract fingerprint, key ID, and cross-reference against darknet dossiers...&#10;-----END PGP PUBLIC KEY BLOCK-----"
            className="w-full p-3 rounded-xl bg-black/70 border border-zinc-800 text-purple-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono text-[11px] resize-y"
          />

          {manualError && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{manualError}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={parsingManual || !manualArmor.trim()}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {parsingManual ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
              <span>{parsingManual ? 'Decoding PGP Packet...' : 'Analyze PGP Identity'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Discovered Identities Directory */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">Discovered PGP Cryptographic Keys</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300 text-[10px] font-bold">
              {filteredIdentities.length}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-black/60 border border-zinc-800 rounded-lg px-3 py-1.5 w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fingerprints, key IDs, handles..."
              className="bg-transparent text-white focus:outline-none placeholder-zinc-600 text-[11px] w-full font-mono"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800 text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="py-12 text-center text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
            Loading PGP identities...
          </div>
        )}

        {!loading && filteredIdentities.length === 0 && (
          <div className="p-12 text-center text-zinc-500 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-2">
            <Key className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="font-bold text-zinc-400 text-sm">No PGP Identities in Vault</div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Run deep blockchain OSINT crawls on hidden services or paste a key block above to decode and archive PGP operator identities.
            </p>
          </div>
        )}

        {!loading && filteredIdentities.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIdentities.map((id) => {
              const sharedCount = (id.discoveredOn || []).length;
              return (
                <div
                  key={id.fingerprint}
                  className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-purple-600/80 transition-all space-y-3 shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* Header: User ID + Algorithm */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate">
                        <div className="font-bold text-white text-xs truncate">
                          {id.primaryUserId || 'Unnamed Operator'}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          ID: <span className="text-purple-300">{id.keyId}</span> • {id.algorithm || 'RSA'} {id.bitLength ? `(${id.bitLength}-bit)` : ''}
                        </div>
                      </div>

                      {sharedCount > 1 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 text-[10px] font-bold shrink-0">
                          {sharedCount} SITES LINKED
                        </span>
                      )}
                    </div>

                    {/* Fingerprint Display */}
                    <div className="p-2 rounded bg-black/70 border border-purple-900/30 text-purple-200 font-mono text-[10px] break-all select-all">
                      {id.formattedFingerprint || id.fingerprint}
                    </div>

                    {/* Discovered on Onion Domains */}
                    <div className="space-y-1 pt-1">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        Linked .Onion Services ({sharedCount}):
                      </div>
                      <div className="space-y-1">
                        {(id.discoveredOn || []).slice(0, 3).map((site, si) => (
                          <div key={si} className="text-purple-300 font-mono text-[10px] truncate select-all">
                            • {site}
                          </div>
                        ))}
                        {sharedCount > 3 && (
                          <div className="text-zinc-500 text-[9px]">
                            + {sharedCount - 3} more hidden services
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">
                      Indexed: {new Date(id.lastSeen || id.firstSeen).toLocaleDateString()}
                    </span>

                    <button
                      onClick={() => {
                        setSelectedFp(id.fingerprint);
                        setSelectedKeyData(id);
                      }}
                      className="px-3 py-1 rounded-lg bg-purple-900/60 hover:bg-purple-800/80 border border-purple-700/60 text-purple-200 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>Inspect Dossier</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PGP Inspector Modal */}
      {(selectedFp || selectedKeyData) && (
        <PgpInspectorModal
          fingerprint={selectedFp}
          initialKeyData={selectedKeyData}
          onClose={() => {
            setSelectedFp(null);
            setSelectedKeyData(null);
          }}
          onNavigateToSite={onNavigateToSite}
        />
      )}
    </div>
  );
}
