# 🚀 Gengar Launch & Community Promotion Kit

This kit contains copy-paste ready announcements, titles, and submission templates to boost **Gengar** across major developer, OSINT, and cybersecurity communities.

---

## 1. 🟠 Hacker News (Show HN)

- **Target URL**: [https://news.ycombinator.com/submit](https://news.ycombinator.com/submit)
- **Best Posting Time**: Tuesday or Wednesday between 6:00 AM – 8:00 AM PT (1:00 PM – 3:00 PM UTC)

### Title
> Show HN: Gengar – Dark-web OSINT search engine and on-chain crypto forensics

### URL / Text
Leave URL blank to submit as a text post, or enter `https://github.com/spideydotjs/gengar` and add a top comment immediately:

```markdown
Hey HN! I built Gengar, an open-source dark-web OSINT search and cryptocurrency forensics platform: https://github.com/spideydotjs/gengar

### Why I built this
Investigating hidden services is notoriously painful: Tor circuits are slow, .onion services go offline constantly, and extracting actionable threat intelligence requires stitching together disparate tools.

I wanted a single tool that could:
1. Search Ahmia's .onion index resiliently (handling anti-bot token negotiation and mirror fallbacks without hanging).
2. Concurrently probe hidden services through Tor SOCKS5 to confirm liveness, latency, and titles.
3. Recursively crawl internal .onion subpages to extract cryptocurrency addresses (BTC, ETH, XMR).
4. Run lightweight context NLP to classify intent (ransom extortion, escrow deposit, donation, vendor bond).
5. Correlate discovered addresses on-chain against known threat actors (WannaCry, LockBit, Silk Road, Blender.io, OFAC SDN lists) and produce tamper-evident SHA-256 evidence dossiers with Chain of Custody tracking.

Everything runs locally via Docker Compose with zero clearnet leaks:
$ docker compose up -d

Built with Node.js 20, Express, Playwright Chromium, React 19, and TailwindCSS.

Code is MIT licensed. Would love feedback, ideas, or contributions from fellow researchers and developers!
```

---

## 2. 🔴 Reddit Communities

### A. Subreddit: `r/OSINT`
- **Title**: *Gengar: An open-source dark-web search engine & automated crypto forensics engine*
- **Flair**: *Tools / Resources*

```markdown
Hi r/OSINT!

I recently open-sourced **Gengar**, a tool designed to streamline darknet hidden-service discovery and blockchain asset correlation.

GitHub: https://github.com/spideydotjs/gengar

### What it does:
- **Resilient Ahmia Search**: Queries Ahmia's .onion search engine via Tor SOCKS5 with anti-bot CSRF negotiation and headless Playwright fallbacks.
- **Dynamic Live Prober**: Probes discovered hidden services in real time, reporting HTTP response codes, latency, and HTML titles.
- **Recursive Blockchain Scraper**: Crawls internal .onion pages to extract BTC, ETH, and XMR wallets, categorizing intent via context NLP (`RANSOM_EXTORTION`, `ESCROW_DEPOSIT`, `COMMERCE_PAYMENT`, `DONATION`, `VENDOR_BOND`, `EXCHANGE_MIXER`).
- **On-Chain Threat Intel**: Traces transaction ledgers, detects laundering peeling chains and CoinJoin mixer signatures, and correlates targets against OFAC SDN lists and known syndicates (WannaCry, LockBit, Silk Road, ChipMixer).
- **Tamper-Evident Evidence Vault**: Generates cryptographically sealed SHA-256 dossiers with immutable Chain of Custody audit logs.

Everything can be launched in a single command via Docker Compose. Feedback, feature requests, and PRs are very welcome!
```

---

### B. Subreddit: `r/cybersecurity` & `r/netsec`
- **Title**: *Gengar – Open-source platform for hidden-service intelligence and crypto threat correlation*

```markdown
Gengar is an open-source tool for cybersecurity researchers and forensic examiners investigating darknet infrastructure and extortion payments: https://github.com/spideydotjs/gengar

Key capabilities:
- Zero clearnet leaks: All traffic routes through local/containerized Tor SOCKS5 circuits.
- Automated visual snapshots: Captures screenshots of active .onion services with FIFO disk quota management.
- Multi-input common-ownership heuristic: Clusters co-spent wallet addresses to identify threat actor wallets.
- Tamper-evident evidence certificates: Designed to comply with digital evidence standards (FRE 902(13)/(14)).

Built for academic research, threat intelligence, and lawful digital forensics.
```

---

## 3. 🐦 Twitter / X Launch Thread

**Tweet 1 (Hook)**:
> 👻 Introducing Gengar — an open-source dark-web OSINT search engine & on-chain crypto forensics platform.
>
> 🔍 Search Ahmia .onion
> ⚡ Real-time Tor liveness prober
> 🧠 NLP crypto wallet classifier
> 🚨 OFAC / Ransomware threat correlation
> 🔒 SHA-256 evidence vault
>
> 🧵👇
> https://github.com/spideydotjs/gengar

**Tweet 2 (Architecture)**:
> 1/ Zero clearnet leaks. Every probe, crawler request, and visual snapshot routes strictly through Tor SOCKS5 proxy circuits.
> 
> Features a multi-tier search engine with automated anti-bot token negotiation and Playwright Chromium fallbacks.

**Tweet 3 (Forensics)**:
> 2/ Discovered a wallet on a hidden service? Gengar automatically traces on-chain UTXOs, detects laundering peeling chains & CoinJoin mixer signatures, and cross-references against OFAC, WannaCry, LockBit, and darknet market clusters.

**Tweet 4 (CTA)**:
> 3/ 100% open source under the MIT license. Spin it up locally in one command:
> `docker compose up -d`
> 
> ⭐ Star the repo and join us: https://github.com/spideydotjs/gengar
> 
> #OSINT #CyberSecurity #ThreatIntel #Blockchain #InfoSec #Tor

---

## 4. 📚 Awesome Lists Submissions

Open a pull request to add Gengar under the **Darknet / Threat Intelligence** section of these curated repositories:

### Target: `jivoi/awesome-osint`
- **File**: `README.md` under `Tor and Darknet`
```markdown
- [Gengar](https://github.com/spideydotjs/gengar) - Dark-web OSINT search engine, hidden-service liveness prober, and on-chain cryptocurrency threat intelligence platform.
```

### Target: `hslatman/awesome-threat-intelligence`
- **File**: `README.md` under `Tools & Frameworks`
```markdown
- [Gengar](https://github.com/spideydotjs/gengar) - Open-source darknet crawler and cryptocurrency forensic engine correlating .onion assets with OFAC sanctions and ransomware syndicates.
```
