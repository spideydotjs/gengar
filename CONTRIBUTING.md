# Contributing to 👻 Gengar

Thank you for your interest in contributing to Gengar! We welcome contributions from developers, cybersecurity researchers, blockchain forensic analysts, and OSINT practitioners.

---

## 🧭 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and constructive in all discussions.

---

## 🛠️ How Can You Contribute?

- **Threat Intelligence**: Add new verified threat entities or sanctioned addresses to `src/cryptoForensics.js`.
- **Heuristics & Scraping**: Improve NLP intent vectors or expand multi-currency regexes in `src/blockchainScraper.js`.
- **Search Resiliency**: Optimize Ahmia crawler negotiation or add alternate hidden-service indexing mechanisms.
- **Frontend / UI**: Enhance the React OSINT dashboard in `client/` with new visual graphs, filters, or export formats.
- **Documentation & Testing**: Improve setup guides, write automated tests, and add Docker optimization benchmarks.

---

## 🚀 Development Setup

### 1. Fork & Clone
```bash
git clone https://github.com/<your-username>/gengar.git
cd gengar
```

### 2. Install Dependencies
```bash
# Install root backend dependencies
npm install

# Install React client dependencies
cd client && npm install && cd ..
```

### 3. Local Tor Proxy
Ensure a local Tor SOCKS5 daemon is active:
```bash
# Verify Tor is listening on port 9050
curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip
```

### 4. Running the Dev Server
```bash
# Backend with automatic reload
npm run dev

# Frontend with Vite hot-reload (optional if developing UI)
npm run client
```

### 5. Running Tests
```bash
npm test
```

---

## 📝 Pull Request Guidelines

1. **Create a topic branch**:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```
2. **Follow Commit Conventions**:
   Use conventional commits where possible:
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation updates
   - `test:` adding or refactoring tests
   - `refactor:` code refactoring without feature changes
3. **Verify syntax & tests pass**:
   ```bash
   npm test
   npm run build:client
   ```
4. **Open a PR**:
   Reference relevant issues (e.g. `Fixes #12`) and include clear screenshots if your change touches the web interface.

---

## 💬 Community & Questions

Feel free to open an issue or start a GitHub Discussion to propose architectural changes before drafting large PRs.
