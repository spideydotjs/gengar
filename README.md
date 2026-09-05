# 👻 Gengar — Dark-Web Search & Hidden-Service Prober

> **For educational / research use only.**  
> This tool queries the [Ahmia](https://ahmia.fi) search engine via its `.onion` address, extracts hidden-service URLs from results, then probes each `.onion` to confirm it's alive — all traffic routed through your local Tor SOCKS5 proxy.

---

## Architecture

```
HTTP Request
    │
    ▼
[ Gengar API :6700 ]
    │
    ├─► POST /api/probe      ─► [ prober.js ]  ─► Tor ──► .onion
    ├─► GET  /api/search     ─► [ ahmia.js  ]  ─► Tor ──► Ahmia .onion ──► results
    │           │                                                              │
    │           └── ?probe=true ─► [ prober.js ] ─► Tor ──► each .onion ─────┘
    └─► GET  /api/tor-status ─► [ torClient.js ] ─► check.torproject.org
```

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Tor** | Must be running locally on `127.0.0.1:9050` (SOCKS5) |
| **Node.js** | ≥ 18 |

### Start Tor

```bash
# Ubuntu / Debian
sudo apt install tor
sudo systemctl start tor

# macOS
brew install tor
brew services start tor

# Verify SOCKS5 is listening
curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip
```

---

## Installation

```bash
cd gengar
npm install
```

---

## Running Gengar

### Quick Start (Server + Web UI)
```bash
npm start
```
Open **http://127.0.0.1:6700** in your browser to access the interactive React Web UI.

### Development Mode
```bash
# Start Express backend with hot-reload
npm run dev

# (Optional) Start Vite client with hot-module reload on http://localhost:5173
npm run client
```

### Build Client
```bash
npm run build
```

---

## Web Interface Features 💻

- **Ascii Core Visuals**: Uses pure ASCII art for the Gengar Ghost and typography banner. Zero bulky images.
- **Dynamic Live Prober**: Searches Ahmia for queries (e.g. `bitcoin`, `cyber`, `forum`) and progressively probes the top 20–30 hidden services through Tor SOCKS5 in real time.
- **Real-Time Telemetry**: Instant feedback on HTTP response status, millisecond latency, live HTML page title, and connection errors.
- **Live Stats & Filters**: Summary counter for online vs offline nodes with instant filters (`All`, `Online`, `Offline`, `Unprobed`) and text filtering.
- **Minimalist Cyberpunk Aesthetics**: Deep obsidian dark theme with violet accents, glow indicators, and JetBrains Mono typography.

---

## Endpoints

### `GET /` — Interactive Web UI
Serves the React single-page application.

### `GET /api/health` — API Health check
```json
{
  "tool": "Gengar",
  "version": "1.0.0",
  "status": "online",
  "tor": "socks5h://127.0.0.1:9050",
  "endpoints": { ... }
}
```

---

### `GET /api/tor-status` — Verify Tor connectivity
```bash
curl http://127.0.0.1:6700/api/tor-status
```
```json
{
  "success": true,
  "tor": {
    "ok": true,
    "ip": "185.220.101.x",
    "message": "Tor is active. Exit IP: 185.220.101.x"
  }
}
```

---

### `GET /api/search` — Search Ahmia & discover .onion URLs

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string | **required** | Search query |
| `probe` | bool | `false` | If `true`, confirm each hidden service is alive |
| `page` | number | `0` | Result page |
| `timeout` | number | `25` | Per-request timeout (seconds) |
| `probeLimit` | number | `10` | Max URLs to probe when probe=true (1–50) |

```bash
# Search only (no probing)
curl "http://127.0.0.1:6700/api/search?q=bitcoin"

# Search + probe hidden services
curl "http://127.0.0.1:6700/api/search?q=bitcoin&probe=true"
```

**Response (probe=true):**
```json
{
  "success": true,
  "query": "bitcoin",
  "total": 8,
  "alive": 5,
  "dead": 3,
  "probed": true,
  "results": [
    {
      "title": "Some Onion Site",
      "onion": "http://abc123xyz.onion/",
      "description": "...",
      "probe": {
        "url": "http://abc123xyz.onion/",
        "alive": true,
        "status": 200,
        "title": "Welcome — Some Onion Site",
        "latencyMs": 4821,
        "error": null
      }
    }
  ]
}
```

---

### `POST /api/probe` — Probe specific .onion URLs

```bash
curl -X POST http://127.0.0.1:6700/api/probe \
  -H "Content-Type: application/json" \
  -d '{ "urls": ["http://abc123.onion", "http://xyz987.onion"] }'
```

```json
{
  "success": true,
  "total": 2,
  "alive": 1,
  "dead": 1,
  "results": [
    { "url": "http://abc123.onion", "alive": true,  "status": 200, "latencyMs": 3200 },
    { "url": "http://xyz987.onion", "alive": false, "status": null, "error": "connect ETIMEDOUT" }
  ]
}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `6700` | API listen port |
| `HOST` | `127.0.0.1` | Bind address |
| `TOR_SOCKS` | `socks5h://127.0.0.1:9050` | Tor SOCKS5 proxy URL |

---

## ⚠️ Legal & Ethical Notice

This tool is intended **strictly for academic research, cybersecurity education, and lawful OSINT**. Do not use it to access illegal content or services. You are responsible for your own actions and compliance with applicable laws.
