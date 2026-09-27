import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Share2, Shield, Globe, Key, Coins, Search, RefreshCw, ZoomIn, ZoomOut,
  Maximize2, RotateCcw, AlertTriangle, ExternalLink, Copy, Check, ChevronRight,
  Info, Filter, X, ArrowUpRight, Flame, Layers
} from 'lucide-react';

// Preset high-value targets for instant demonstration
const PRESET_TARGETS = [
  { label: 'WannaCry (Lazarus Group)', address: '115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn', type: 'RANSOMWARE' },
  { label: 'LockBit 3.0 Syndicate', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', type: 'RANSOMWARE' },
  { label: 'Silk Road (FBI Seized)', address: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX', type: 'DARKNET_MARKET' },
  { label: 'Blender.io (OFAC SDN)', address: 'bc1qguzeuz02k6rtz5p4l0f6flr6xetzsyp4pvqlx', type: 'MIXER_TUMBLER' },
];

export default function NetworkGraphExplorer({ initialTarget = '', onNavigateToForensics, onNavigateToScraper, onNavigateToPgp }) {
  const [targetAddress, setTargetAddress] = useState(initialTarget || PRESET_TARGETS[0].address);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [graphSummary, setGraphSummary] = useState(null);
  const [isGlobalMode, setIsGlobalMode] = useState(false);

  // Interaction State
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedText, setCopiedText] = useState(null);

  // Canvas & Physics Refs
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const simulationRef = useRef({
    nodes: [],
    edges: [],
    alpha: 1.0,
    camera: { x: 0, y: 0, scale: 1.0 },
    draggingNode: null,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    mousePos: { x: 0, y: 0 },
  });

  // Load target on mount or when initialTarget changes
  useEffect(() => {
    if (initialTarget) {
      setTargetAddress(initialTarget);
      fetchGraphData(initialTarget);
    } else {
      fetchGraphData(targetAddress);
    }
  }, [initialTarget]);

  const fetchGraphData = async (addr) => {
    if (!addr || addr.length < 25) return;
    setLoading(true);
    setError(null);
    setIsGlobalMode(false);
    setSelectedNode(null);

    try {
      const res = await fetch(`/api/forensics/graph?address=${encodeURIComponent(addr.trim())}&maxTxs=10`);
      const data = await res.json();
      if (data.success && data.graph) {
        setGraphData(data.graph);
        setGraphSummary(data.summary);
        initPhysics(data.graph.nodes, data.graph.edges);
      } else {
        setError(data.error || 'Failed to construct entity graph');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalGraph = async () => {
    setLoading(true);
    setError(null);
    setIsGlobalMode(true);
    setSelectedNode(null);

    try {
      const res = await fetch('/api/forensics/graph/global');
      const data = await res.json();
      if (data.success && data.graph) {
        setGraphData(data.graph);
        setGraphSummary(data.summary);
        initPhysics(data.graph.nodes, data.graph.edges);
      } else {
        setError(data.error || 'Failed to construct global entity graph');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Physics Simulation Initialization ──────────────────────────────
  const initPhysics = (rawNodes, rawEdges) => {
    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : 1000;
    const height = canvas ? canvas.height : 700;
    const cx = width / 2;
    const cy = height / 2;

    const nodes = rawNodes.map((n, i) => {
      const angle = (i / Math.max(1, rawNodes.length)) * Math.PI * 2;
      const radius = n.type === 'TARGET_WALLET' ? 0 : 150 + (i % 3) * 60;
      return {
        ...n,
        x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: getNodeRadius(n.type),
      };
    });

    const edges = rawEdges.map((e) => ({
      ...e,
      sourceNode: nodes.find((n) => n.id === e.source),
      targetNode: nodes.find((n) => n.id === e.target),
    })).filter((e) => e.sourceNode && e.targetNode);

    simulationRef.current.nodes = nodes;
    simulationRef.current.edges = edges;
    simulationRef.current.alpha = 1.0;
    simulationRef.current.camera = { x: 0, y: 0, scale: 0.95 };
  };

  const getNodeRadius = (type) => {
    switch (type) {
      case 'TARGET_WALLET': return 28;
      case 'THREAT_ACTOR': return 26;
      case 'ONION_SITE': return 24;
      case 'EXCHANGE': return 22;
      case 'PGP_IDENTITY': return 20;
      default: return 18;
    }
  };

  const getNodeColor = (node) => {
    switch (node.type) {
      case 'TARGET_WALLET': return { bg: '#eab308', border: '#fef08a', text: '#000000', glow: 'rgba(234, 179, 8, 0.4)' };
      case 'THREAT_ACTOR': return { bg: '#dc2626', border: '#fca5a5', text: '#ffffff', glow: 'rgba(220, 38, 38, 0.5)' };
      case 'ONION_SITE': return { bg: '#7c3aed', border: '#c4b5fd', text: '#ffffff', glow: 'rgba(124, 58, 237, 0.4)' };
      case 'EXCHANGE': return { bg: '#0284c7', border: '#7dd3fc', text: '#ffffff', glow: 'rgba(2, 132, 199, 0.4)' };
      case 'PGP_IDENTITY': return { bg: '#9333ea', border: '#e9d5ff', text: '#ffffff', glow: 'rgba(147, 51, 234, 0.4)' };
      case 'WALLET':
      default: return { bg: '#27272a', border: '#71717a', text: '#e4e4e7', glow: 'rgba(113, 113, 122, 0.2)' };
    }
  };

  // ── Physics & Render Animation Loop ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const updatePhysics = () => {
      const sim = simulationRef.current;
      if (!sim.nodes.length) return;

      const { nodes, edges } = sim;
      const kRepulsion = 4500;
      const kSpring = 0.04;
      const damping = 0.88;
      const centerAttraction = 0.01;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // 1. Repulsion between all node pairs (Coulomb)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy + 100;
          const dist = Math.sqrt(distSq);
          const force = (kRepulsion / distSq) * sim.alpha;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (n1 !== sim.draggingNode) {
            n1.vx -= fx;
            n1.vy -= fy;
          }
          if (n2 !== sim.draggingNode) {
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }

      // 2. Spring attraction along edges (Hooke's law)
      for (const e of edges) {
        const n1 = e.sourceNode;
        const n2 = e.targetNode;
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 140;
        const force = (dist - targetDist) * kSpring * sim.alpha;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (n1 !== sim.draggingNode) {
          n1.vx += fx;
          n1.vy += fy;
        }
        if (n2 !== sim.draggingNode) {
          n2.vx -= fx;
          n2.vy -= fy;
        }
      }

      // 3. Weak centering gravity & position integration
      for (const n of nodes) {
        if (n !== sim.draggingNode) {
          n.vx += (cx - n.x) * centerAttraction * sim.alpha;
          n.vy += (cy - n.y) * centerAttraction * sim.alpha;
          n.vx *= damping;
          n.vy *= damping;
          n.x += n.vx;
          n.y += n.vy;
        }
      }

      // Decay alpha until equilibrium
      if (sim.alpha > 0.005) {
        sim.alpha *= 0.985;
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sim = simulationRef.current;
      const { camera, nodes, edges } = sim;

      ctx.save();
      // Apply camera translation & scale
      ctx.translate(canvas.width / 2 + camera.x, canvas.height / 2 + camera.y);
      ctx.scale(camera.scale, camera.scale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // 1. Draw Grid Background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = -canvas.width; x < canvas.width * 2; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -canvas.height);
        ctx.lineTo(x, canvas.height * 2);
        ctx.stroke();
      }
      for (let y = -canvas.height; y < canvas.height * 2; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-canvas.width, y);
        ctx.lineTo(canvas.width * 2, y);
        ctx.stroke();
      }

      // 2. Draw Edges
      for (const e of edges) {
        const src = e.sourceNode;
        const dst = e.targetNode;
        if (!src || !dst) continue;

        const isHighlight =
          (selectedNode && (selectedNode.id === src.id || selectedNode.id === dst.id)) ||
          (hoveredNode && (hoveredNode.id === src.id || hoveredNode.id === dst.id));

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(dst.x, dst.y);

        if (e.type === 'PEEL_CHAIN') {
          ctx.strokeStyle = isHighlight ? '#f59e0b' : 'rgba(245, 158, 11, 0.6)';
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = isHighlight ? 3 : 2;
        } else if (e.type === 'COINJOIN_MIXER') {
          ctx.strokeStyle = isHighlight ? '#06b6d4' : 'rgba(6, 182, 212, 0.6)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = isHighlight ? 3 : 2;
        } else if (e.type === 'IDENTIFIED_AS') {
          ctx.strokeStyle = isHighlight ? '#ef4444' : 'rgba(239, 68, 68, 0.5)';
          ctx.setLineDash([]);
          ctx.lineWidth = isHighlight ? 2.5 : 1.5;
        } else {
          ctx.strokeStyle = isHighlight ? 'rgba(168, 85, 247, 0.8)' : 'rgba(255, 255, 255, 0.15)';
          ctx.setLineDash([]);
          ctx.lineWidth = isHighlight ? 2 : 1;
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Edge Label Pill in the middle
        const midX = (src.x + dst.x) / 2;
        const midY = (src.y + dst.y) / 2;

        if (e.label && (isHighlight || camera.scale > 0.8)) {
          ctx.font = '9px monospace';
          const textWidth = ctx.measureText(e.label).width;
          ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
          ctx.fillRect(midX - textWidth / 2 - 4, midY - 7, textWidth + 8, 14);
          ctx.fillStyle = isHighlight ? '#c084fc' : '#a1a1aa';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(e.label, midX, midY);
        }
      }

      // 3. Draw Nodes
      for (const n of nodes) {
        const colors = getNodeColor(n);
        const isSelected = selectedNode && selectedNode.id === n.id;
        const isHovered = hoveredNode && hoveredNode.id === n.id;

        // Glowing outer halo
        if (isSelected || isHovered || n.type === 'TARGET_WALLET' || n.type === 'THREAT_ACTOR') {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = colors.glow;
          ctx.fill();
        }

        // Main node body circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.bg;
        ctx.fill();
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeStyle = isSelected ? '#ffffff' : colors.border;
        ctx.stroke();

        // Node Label below circle
        ctx.font = isSelected ? 'bold 11px monospace' : '10px monospace';
        ctx.fillStyle = isSelected ? '#ffffff' : '#e4e4e7';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Truncate label for drawing
        const labelText = n.label || n.id;
        ctx.fillText(labelText, n.x, n.y + n.radius + 4);

        // Subtext / Badge (Type or Threat Score)
        if (n.risk > 0) {
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = n.risk >= 80 ? '#f87171' : '#fde047';
          ctx.fillText(`${n.risk}% RISK`, n.x, n.y + n.radius + 17);
        }
      }

      ctx.restore();
    };

    const loop = () => {
      updatePhysics();
      render();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [selectedNode, hoveredNode]);

  // ── Mouse & Drag Handlers ──────────────────────────────────────────
  const getCanvasMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sim = simulationRef.current;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Transform screen coords to world coords via camera matrix
    const screenCenterX = canvas.width / 2;
    const screenCenterY = canvas.height / 2;
    const worldX = (clientX - screenCenterX - sim.camera.x) / sim.camera.scale + screenCenterX;
    const worldY = (clientY - screenCenterY - sim.camera.y) / sim.camera.scale + screenCenterY;

    return { worldX, worldY, clientX, clientY };
  };

  const handleMouseDown = (e) => {
    const { worldX, worldY, clientX, clientY } = getCanvasMousePos(e);
    const sim = simulationRef.current;

    // Check if clicked a node
    const clickedNode = sim.nodes.find((n) => {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      return dx * dx + dy * dy <= (n.radius + 5) * (n.radius + 5);
    });

    if (clickedNode) {
      sim.draggingNode = clickedNode;
      setSelectedNode(clickedNode);
      sim.alpha = 0.5; // wake simulation up
    } else {
      sim.isPanning = true;
      sim.panStart = { x: clientX - sim.camera.x, y: clientY - sim.camera.y };
    }
  };

  const handleMouseMove = (e) => {
    const { worldX, worldY, clientX, clientY } = getCanvasMousePos(e);
    const sim = simulationRef.current;

    if (sim.draggingNode) {
      sim.draggingNode.x = worldX;
      sim.draggingNode.y = worldY;
      sim.alpha = 0.3; // keep moving while dragging
    } else if (sim.isPanning) {
      sim.camera.x = clientX - sim.panStart.x;
      sim.camera.y = clientY - sim.panStart.y;
    } else {
      // Hover check
      const hovered = sim.nodes.find((n) => {
        const dx = n.x - worldX;
        const dy = n.y - worldY;
        return dx * dx + dy * dy <= (n.radius + 5) * (n.radius + 5);
      });
      setHoveredNode(hovered || null);
    }
  };

  const handleMouseUp = () => {
    const sim = simulationRef.current;
    sim.draggingNode = null;
    sim.isPanning = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const sim = simulationRef.current;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    sim.camera.scale = Math.min(2.5, Math.max(0.3, sim.camera.scale * zoomFactor));
  };

  const handleZoom = (direction) => {
    const sim = simulationRef.current;
    const factor = direction === 'in' ? 1.25 : 0.8;
    sim.camera.scale = Math.min(2.5, Math.max(0.3, sim.camera.scale * factor));
  };

  const handleResetView = () => {
    const sim = simulationRef.current;
    sim.camera = { x: 0, y: 0, scale: 0.95 };
    sim.alpha = 1.0;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // ── Connected neighbors of selected node ───────────────────────────
  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return (graphData.edges || []).filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );
  }, [selectedNode, graphData]);

  return (
    <div className="space-y-4 w-full font-mono text-xs">
      {/* Top Controls Toolbar */}
      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>Forensic Entity Network Graph</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-950 text-purple-300 border border-purple-800">
                  INTERACTIVE
                </span>
              </h2>
              <p className="text-zinc-400 text-xs mt-0.5">
                On-chain UTXOs • Co-spent clusters • Peeling chains • PGP identities • Hidden services
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchGlobalGraph}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg border font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isGlobalMode
                  ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-purple-300" />
              <span>Global Darknet Ecosystem</span>
            </button>
          </div>
        </div>

        {/* Address Search Bar & Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800">
          <div className="flex-1 min-w-[280px] flex items-center bg-black/60 border border-zinc-800 rounded-xl px-3 py-2">
            <Coins className="w-4 h-4 text-amber-400 mr-2 shrink-0" />
            <input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="Enter Bitcoin address to generate network graph..."
              className="bg-transparent text-white focus:outline-none placeholder-zinc-600 text-xs w-full font-mono"
            />
          </div>

          <button
            onClick={() => fetchGraphData(targetAddress)}
            disabled={loading || !targetAddress.trim()}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Generate Graph</span>
          </button>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-zinc-500 text-[10px] uppercase font-bold px-1">Presets:</span>
            {PRESET_TARGETS.map((p) => (
              <button
                key={p.address}
                onClick={() => {
                  setTargetAddress(p.address);
                  fetchGraphData(p.address);
                }}
                className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors cursor-pointer ${
                  targetAddress === p.address && !isGlobalMode
                    ? 'bg-amber-950 border-amber-600 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Canvas View Area with Sidebar */}
      <div className="relative w-full h-[650px] rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-2xl flex">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-10 h-10 text-purple-400 animate-spin mb-3" />
            <div className="text-white font-bold text-sm">Traversing Entity Graph & UTXO Flows...</div>
            <p className="text-zinc-500 text-xs mt-1">Resolving co-spent clusters, laundering heuristics, and threat intel</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-30 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Interactive Canvas */}
        <canvas
          ref={canvasRef}
          width={1100}
          height={650}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Graph Floating Controls (Zoom / Reset) */}
        <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-xl backdrop-blur-md">
          <button
            onClick={() => handleZoom('in')}
            title="Zoom In"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom('out')}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            title="Reset View & Physics"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Legend Overlay */}
        <div className="absolute top-4 left-4 z-20 p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-xl backdrop-blur-md space-y-1.5 text-[10px]">
          <div className="font-bold text-zinc-400 uppercase tracking-wider pb-1 border-b border-zinc-800">
            Node Legend ({graphData.nodes.length})
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-300" />
            <span className="text-zinc-300">Target Wallet</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600 border border-red-400" />
            <span className="text-zinc-300">Threat / Sanction Actor</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-600 border border-purple-300" />
            <span className="text-zinc-300">Hidden Service (.onion)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-fuchsia-600 border border-fuchsia-300" />
            <span className="text-zinc-300">PGP Cryptographic Identity</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-sky-600 border border-sky-300" />
            <span className="text-zinc-300">Exchange / VASP</span>
          </div>
        </div>

        {/* Selected Node Inspector Drawer (Right Side) */}
        {selectedNode && (
          <div className="w-80 h-full border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-md p-5 flex flex-col justify-between overflow-y-auto z-20 space-y-4 shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    {selectedNode.type.replace('_', ' ')}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-0.5 truncate max-w-[200px]">
                    {selectedNode.label}
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded text-zinc-500 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Risk Badge if applicable */}
              {selectedNode.risk > 0 && (
                <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                  selectedNode.risk >= 80
                    ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                    : 'bg-amber-950/40 border-amber-800 text-amber-300'
                }`}>
                  <span className="font-bold">THREAT RISK ASSESSMENT</span>
                  <span className="font-bold text-sm">{selectedNode.risk}%</span>
                </div>
              )}

              {/* Full Address / Value Box */}
              <div className="p-3 rounded-xl bg-black/60 border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>IDENTIFIER</span>
                  <button
                    onClick={() => copyToClipboard(selectedNode.meta?.fullAddress || selectedNode.meta?.fullUrl || selectedNode.meta?.fingerprint || selectedNode.label)}
                    className="hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-[11px] font-mono text-purple-300 break-all select-all font-semibold">
                  {selectedNode.meta?.fullAddress || selectedNode.meta?.fullUrl || selectedNode.meta?.fingerprint || selectedNode.label}
                </div>
              </div>

              {/* Specific Metadata Fields */}
              {selectedNode.meta?.balanceBtc !== undefined && (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    <div className="text-[10px] text-zinc-500">Balance</div>
                    <div className="text-amber-400 font-bold mt-0.5">{selectedNode.meta.balanceBtc} BTC</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    <div className="text-[10px] text-zinc-500">Total Txs</div>
                    <div className="text-white font-bold mt-0.5">{selectedNode.meta.txCount || 0}</div>
                  </div>
                </div>
              )}

              {selectedNode.meta?.notes && (
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
                  <div className="font-bold text-white text-[10px] mb-1">INTELLIGENCE BRIEF</div>
                  <p>{selectedNode.meta.notes}</p>
                </div>
              )}

              {/* Connected Edges List */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  Direct Hops ({connectedEdges.length}):
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {connectedEdges.map((e) => (
                    <div
                      key={e.id}
                      className="p-1.5 rounded bg-zinc-900/60 border border-zinc-800/80 text-[10px] flex items-center justify-between text-zinc-400"
                    >
                      <span className="truncate pr-2 font-bold text-purple-300">{e.label}</span>
                      <span className="text-zinc-500 shrink-0 text-[9px]">{e.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-zinc-800 space-y-2">
              {selectedNode.meta?.fullAddress && (
                <button
                  onClick={() => onNavigateToForensics?.(selectedNode.meta.fullAddress)}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Deep Trace in Forensics</span>
                </button>
              )}

              {selectedNode.meta?.fullUrl && (
                <button
                  onClick={() => onNavigateToScraper?.(selectedNode.meta.fullUrl)}
                  className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Crawl Hidden Service</span>
                </button>
              )}

              {selectedNode.meta?.fingerprint && (
                <button
                  onClick={() => onNavigateToPgp?.(selectedNode.meta.fingerprint)}
                  className="w-full py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Inspect PGP Fingerprint</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
