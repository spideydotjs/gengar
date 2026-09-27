import React, { useState, useEffect } from 'react';
import {
  Key, Shield, Fingerprint, Globe, User, Calendar, ExternalLink,
  Copy, Check, Search, AlertCircle, RefreshCw, X, Hash, ChevronRight, Lock,
  Share2, AtSign, Cpu, CheckCircle2, XCircle
} from 'lucide-react';

export default function PgpInspectorModal({ fingerprint, initialKeyData, onClose, onNavigateToSite }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [checkingKeyserver, setCheckingKeyserver] = useState(false);
  const [keyserverResult, setKeyserverResult] = useState(null);

  const activeFingerprint = fingerprint || initialKeyData?.fingerprint;

  useEffect(() => {
    if (activeFingerprint) {
      loadPgpDetails(activeFingerprint);
    } else if (initialKeyData) {
      setData({
        matched: true,
        fingerprint: initialKeyData.fingerprint,
        keyDetails: initialKeyData,
        onionSites: [],
        associatedWallets: [],
      });
    }
  }, [activeFingerprint]);

  const loadPgpDetails = async (fp) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pgp/identity/${fp}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || 'Failed to resolve PGP fingerprint intelligence');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyserverCheck = async () => {
    if (!activeFingerprint || checkingKeyserver) return;
    setCheckingKeyserver(true);
    try {
      const res = await fetch(`/api/pgp/federation/${activeFingerprint}`);
      const json = await res.json();
      if (json.success) {
        setKeyserverResult(json);
      } else {
        setKeyserverResult({ foundAny: false, error: json.error || 'Federation check failed' });
      }
    } catch (err) {
      setKeyserverResult({ foundAny: false, error: err.message });
    } finally {
      setCheckingKeyserver(false);
    }
  };

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const keyDetails = data?.keyDetails || initialKeyData || {};
  const formattedFp = keyDetails.formattedFingerprint || (keyDetails.fingerprint ? keyDetails.fingerprint.match(/.{1,4}/g)?.join(' ') : 'Unknown');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-zinc-950 border border-purple-800/60 shadow-[0_0_50px_rgba(168,85,247,0.2)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">PGP Identity Dossier</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-900/60 border border-purple-700/60 text-purple-300">
                  {keyDetails.algorithm || 'OpenPGP'}
                </span>
                {keyDetails.bitLength && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400">
                    {keyDetails.bitLength}-bit
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Key ID: <span className="text-purple-300">{keyDetails.keyId || 'Unknown'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 font-mono text-xs">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-400">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-3" />
              <span>Resolving PGP Identity & Cross-Onion Linkage...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && (
            <>
              {/* Fingerprint Card */}
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 space-y-2">
                <div className="flex items-center justify-between text-zinc-400 text-[11px] font-bold">
                  <div className="flex items-center gap-1.5 text-purple-400">
                    <Fingerprint className="w-4 h-4" />
                    <span>CRYPTOGRAPHIC FINGERPRINT</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(keyDetails.fingerprint, 'fp')}
                    className="px-2.5 py-1 rounded bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 text-purple-200 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    {copiedField === 'fp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'fp' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-black/60 border border-purple-900/30 text-center select-all font-mono text-purple-200 text-sm font-bold tracking-wider break-all">
                  {formattedFp}
                </div>
              </div>

              {/* Identity & Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User IDs */}
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-bold">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span>DECLARED IDENTITIES / USER IDS</span>
                  </div>
                  {keyDetails.userIds && keyDetails.userIds.length > 0 ? (
                    <div className="space-y-1.5">
                      {keyDetails.userIds.map((uid, i) => (
                        <div key={i} className="p-2 rounded bg-black/50 border border-zinc-800 text-cyan-200 font-mono text-[11px] select-all">
                          {uid}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-zinc-500 italic text-[11px]">No User ID embedded in public key packet</div>
                  )}
                </div>

                {/* Timestamps & Security Status */}
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-bold">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>LIFECYCLE & SECURITY</span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Created:</span>
                      <span className="text-zinc-200">{keyDetails.created ? new Date(keyDetails.created).toLocaleDateString() : 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Expires:</span>
                      <span className={keyDetails.expires ? 'text-amber-300' : 'text-emerald-400'}>
                        {keyDetails.expires ? new Date(keyDetails.expires).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-400">Revocation Status:</span>
                      <span className={keyDetails.isRevoked ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                        {keyDetails.isRevoked ? 'REVOKED' : 'VALID / ACTIVE'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cross-Onion Correlation (The Superpower) */}
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-purple-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-white text-[12px]">CROSS-ONION DOMAIN CORRELATION</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                    {data?.totalSites || 0} HIDDEN SERVICES LINKED
                  </span>
                </div>

                <p className="text-zinc-400 text-[11px]">
                  Hidden services sharing this exact cryptographic PGP identity across historical scans:
                </p>

                {data?.onionSites && data.onionSites.length > 0 ? (
                  <div className="space-y-2">
                    {data.onionSites.map((site) => (
                      <div
                        key={site.id + site.targetUrl}
                        className="p-3 rounded-lg bg-black/60 border border-zinc-800 hover:border-purple-600 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="truncate">
                          <div className="font-bold text-purple-300 truncate select-all">{site.targetUrl}</div>
                          <div className="text-[10px] text-zinc-500">First indexed: {new Date(site.scannedAt).toLocaleDateString()}</div>
                        </div>

                        {onNavigateToSite && (
                          <button
                            onClick={() => {
                              onNavigateToSite(site.targetUrl);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded bg-purple-900/50 hover:bg-purple-700 text-white font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <span>Inspect Site</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-black/40 border border-zinc-800 text-zinc-500 text-center text-[11px]">
                    No other indexed hidden services share this key yet. Run deep scans on more .onion sites to build correlation links.
                  </div>
                )}
              </div>

              {/* Federated Clearnet Keyserver & WKD Intelligence */}
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-zinc-300 font-bold text-[12px]">
                    <Search className="w-4 h-4 text-emerald-400" />
                    <span>FEDERATED KEYSERVER & WKD CROSS-REFERENCE (TOR)</span>
                  </div>

                  <button
                    onClick={handleKeyserverCheck}
                    disabled={checkingKeyserver}
                    className="px-3 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {checkingKeyserver ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
                    <span>{checkingKeyserver ? 'Querying Tor Federation...' : 'Deep Federated Scan'}</span>
                  </button>
                </div>

                <p className="text-zinc-500 text-[11px]">
                  Queries clearnet OpenPGP federated infrastructure over Tor: SKS (Ubuntu), Hagrid (keys.openpgp.org), Keybase Social Identity graph, and Web Key Directory (WKD) domain verification.
                </p>

                {keyserverResult && (
                  <div className="space-y-3 pt-1">
                    {/* Federation Status Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                      {/* keys.openpgp.org */}
                      <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                        keyserverResult.federatedKeyservers?.keysOpenPgp?.found
                          ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
                          : 'bg-black/40 border-zinc-800 text-zinc-500'
                      }`}>
                        <div className="font-bold">keys.openpgp.org</div>
                        <div className="flex items-center gap-1 mt-1">
                          {keyserverResult.federatedKeyservers?.keysOpenPgp?.found ? (
                            <><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span>Verified (VKS)</span></>
                          ) : (
                            <><XCircle className="w-3 h-3 text-zinc-600" /><span>Not Listed</span></>
                          )}
                        </div>
                      </div>

                      {/* Ubuntu SKS */}
                      <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                        keyserverResult.federatedKeyservers?.ubuntuHkp?.found
                          ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
                          : 'bg-black/40 border-zinc-800 text-zinc-500'
                      }`}>
                        <div className="font-bold">Ubuntu SKS Keyserver</div>
                        <div className="flex items-center gap-1 mt-1">
                          {keyserverResult.federatedKeyservers?.ubuntuHkp?.found ? (
                            <><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span>Found (HKP)</span></>
                          ) : (
                            <><XCircle className="w-3 h-3 text-zinc-600" /><span>Not Listed</span></>
                          )}
                        </div>
                      </div>

                      {/* Keybase */}
                      <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                        keyserverResult.federatedKeyservers?.keybase?.found
                          ? 'bg-purple-950/40 border-purple-600/50 text-purple-300'
                          : 'bg-black/40 border-zinc-800 text-zinc-500'
                      }`}>
                        <div className="font-bold">Keybase Identity</div>
                        <div className="flex items-center gap-1 mt-1">
                          {keyserverResult.federatedKeyservers?.keybase?.found ? (
                            <><CheckCircle2 className="w-3 h-3 text-purple-400" /><span>Linked Account</span></>
                          ) : (
                            <><XCircle className="w-3 h-3 text-zinc-600" /><span>No Profile</span></>
                          )}
                        </div>
                      </div>

                      {/* WKD */}
                      <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                        (keyserverResult.federatedKeyservers?.wkd || []).some(w => w.verified)
                          ? 'bg-cyan-950/40 border-cyan-600/50 text-cyan-300'
                          : 'bg-black/40 border-zinc-800 text-zinc-500'
                      }`}>
                        <div className="font-bold">Web Key Directory</div>
                        <div className="flex items-center gap-1 mt-1">
                          {(keyserverResult.federatedKeyservers?.wkd || []).some(w => w.verified) ? (
                            <><CheckCircle2 className="w-3 h-3 text-cyan-400" /><span>Domain Certified</span></>
                          ) : (
                            <><XCircle className="w-3 h-3 text-zinc-600" /><span>Unpublished</span></>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Keybase Social OSINT Card (If Profile Found) */}
                    {keyserverResult.keybaseUser && (
                      <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-purple-400" />
                            <span className="font-bold text-white text-[11px]">KEYBASE PROFILE OSINT</span>
                          </div>
                          <a
                            href={keyserverResult.keybaseUser.keybaseProfileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-purple-300 hover:text-white flex items-center gap-1 text-[10px]"
                          >
                            <span>keybase.io/{keyserverResult.keybaseUser.username}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        {keyserverResult.keybaseUser.fullName && (
                          <div className="text-[11px] text-zinc-300">
                            <span className="text-zinc-500">Name: </span>{keyserverResult.keybaseUser.fullName}
                          </div>
                        )}
                        {keyserverResult.keybaseUser.location && (
                          <div className="text-[10px] text-zinc-400">
                            <span className="text-zinc-500">Location: </span>{keyserverResult.keybaseUser.location}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Discovered Social Profiles */}
                    {keyserverResult.socialProfiles?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-zinc-400 font-bold flex items-center gap-1">
                          <Share2 className="w-3 h-3 text-cyan-400" />
                          <span>Linked Clearnet Social Handles ({keyserverResult.socialProfiles.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {keyserverResult.socialProfiles.map((p, idx) => (
                            <a
                              key={idx}
                              href={p.url || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded bg-black border border-zinc-700 hover:border-cyan-400 text-zinc-200 text-[10px] flex items-center gap-1.5 transition-colors"
                            >
                              <span className="uppercase font-bold text-cyan-400">{p.platform}:</span>
                              <span>{p.handle}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Discovered Clearnet User IDs / Emails */}
                    {keyserverResult.clearnetIdentities?.length > 0 && (
                      <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-700/40 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-emerald-400 text-[11px]">
                          <Check className="w-3.5 h-3.5" />
                          <span>CLEARNET IDENTITIES & EMAILS DISCOVERED:</span>
                        </div>
                        <div className="text-[11px] text-white space-y-0.5 pt-0.5">
                          {keyserverResult.clearnetIdentities.map((id, idx) => (
                            <div key={idx} className="select-all font-mono text-emerald-200">• {id}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!keyserverResult.foundAny && !keyserverResult.error && (
                      <div className="p-3 rounded-lg bg-black/40 border border-zinc-800 text-zinc-500 text-center text-[11px]">
                        No public records discovered across SKS keyservers, VKS, Keybase, or WKD. Key appears exclusively scoped to darknet hidden services.
                      </div>
                    )}

                    {keyserverResult.error && (
                      <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800 text-rose-300 text-[11px]">
                        Lookup error: {keyserverResult.error}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Raw Armored Key Export */}
              {keyDetails.rawArmor && (
                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-zinc-400 text-[11px] font-bold">
                    <span>RAW ARMORED PUBLIC KEY BLOCK</span>
                    <button
                      onClick={() => copyToClipboard(keyDetails.rawArmor, 'armor')}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedField === 'armor' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'armor' ? 'Copied' : 'Copy ASCII Block'}</span>
                    </button>
                  </div>
                  <pre className="max-h-24 overflow-y-auto text-zinc-500 font-mono text-[9px] select-all bg-black/60 p-2.5 rounded-lg">
                    {keyDetails.rawArmor}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
