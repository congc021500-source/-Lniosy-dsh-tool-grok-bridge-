> Publication note: this checkout is https://github.com/congc021500-source/-Lniosy-dsh-tool-grok-bridge- . The package name remains `dsh-tool-grok-bridge` and the display name remains「Grok Bot 双向桥」. The install badge downloadUrl is this repository's `archive/refs/heads/main.zip`. References below to `Lniosy/dsh-tool-grok-bridge` are the original design target.

# Grok Bot 双向桥 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one DSH plugin `dsh-tool-grok-bridge` that bundles DSH→Grok tools, Grok→DSH MCP bridge, and Cloudflare quick-tunnel helpers, published at `https://github.com/Lniosy/dsh-tool-grok-bridge`.

**Architecture:** Single Cordis/DSH plugin package. Forward Grok tools live under `lib/grok/` (migrated from `dsh-tool-grok-bot`). Reverse MCP lives under `lib/bridge/` (migrated from `dsh-mcp-bridge`). Tunnel helpers are scripts that run cloudflared against `127.0.0.1:8931` and print the trycloudflare URL. Installer copies the package beside DSH, patches the profile, and never enables the bridge by default.

**Tech Stack:** Node ≥22 ESM, `@deepseek-ai/dsh-tools` / Cordis, `@modelcontextprotocol/sdk`, `@deepseek-ai/schemastery`, cloudflared CLI, PowerShell installers, GitHub public repo.

## Global Constraints

- Package name exactly `dsh-tool-grok-bridge`; display name「Grok Bot 双向桥」.
- GitHub owner/repo exactly `Lniosy/dsh-tool-grok-bridge`.
- Bridge defaults: `127.0.0.1:8931`, disabled at startup, authToken required off-loopback.
- Quick tunnel only; user manually adds MCP URL in Grok Bot.
- MIT license; bilingual README with `dsh://plugin/install` badge.
- Do not commit live tunnel URLs or user tokens.
- Prefer copying known-good files from `~/.dsh/plugins/dsh-tool-grok-bot`, `~/.dsh/plugins/dsh-mcp-bridge`, or GitHub `Lniosy/dsh-tool-grok-bot` rather than rewriting behavior.

## File map

| Path | Responsibility |
|---|---|
| `package.json` | Manifest, `dsh.bundle.patch`, exports, files list, repository URL |
| `cordis.patch.yml` | Insert grok-bot tool plugin + mcp-bridge config |
| `lib/grok/*` | Migrated forward tools |
| `lib/bridge/*` | Migrated MCP bridge |
| `lib/tunnel/url.js` | Parse cloudflared log line → HTTPS URL |
| `scripts/start-tunnel.ps1` | Find/download cloudflared, start quick tunnel, print URL |
| `install.ps1` / `uninstall.ps1` | Profile + package install |
| `README.md` / `README.en.md` | Install + bidirectional usage |
| `examples/mcp-connector.url.example` | Placeholder URL form |
| `test/tunnel-url.test.js` | URL parser unit tests |
| `docs/superpowers/specs/2026-11-03-dsh-tool-grok-bridge-design.md` | Design spec (keep in repo) |

**Cordis registration:** Prefer two insert entries in `cordis.patch.yml` resolving `dsh-tool-grok-bridge/grok` and `dsh-tool-grok-bridge/bridge` via package `exports`. If Cordis cannot load export subpaths, fall back to a composing `lib/index.js` only after documenting why; do not split into two published packages.

---

### Task 1: Repo scaffold + package manifest

**Files:**
- Create: `package.json`, `LICENSE`, `.gitignore`, `cordis.patch.yml`
- Test: parse package.json with Node

**Interfaces:**
- Produces: package name `dsh-tool-grok-bridge`, version `0.1.0`, `dsh.bundle.patch` → `./cordis.patch.yml`

- [ ] **Step 1: Write package.json** with name `dsh-tool-grok-bridge`, exports for `.`, `./grok`, `./bridge`, `./cordis.patch.yml`, peerDeps matching grok-bot, `engines.node >=22`, scripts `test`/`check`, repository URL `git+https://github.com/Lniosy/dsh-tool-grok-bridge.git`, and `dsh.client.inject` list from mcp-bridge for settings UI.

- [ ] **Step 2: MIT LICENSE and .gitignore** (`node_modules/`, `*.log`, `.env`, `cloudflared*`, `grok-bot.json`)

- [ ] **Step 3: cordis.patch.yml** with inserts id `grok-bot` → `dsh-tool-grok-bridge/grok` and id `mcp-bridge` → `dsh-tool-grok-bridge/bridge` plus bridge config defaults (`host` 127.0.0.1, `port` 8931, `basePath` /mcp, `serverName` dsh-bridge, `controlPath` /dsh-bridge/control, `defaultCwd` placeholder)

- [ ] **Step 4: Commit** `chore: scaffold dsh-tool-grok-bridge package`

---

### Task 2: Migrate forward Grok tools

**Files:**
- Create: `lib/grok/**`, `locale/**`, `examples/grok-bot.json.example`, `icon.png`, `docs/logo.png`
- Test: `node --check lib/grok/index.js`

**Interfaces:**
- Produces: Cordis plugin with `inject = ['tools','skills']` and all `grok_bot_*` tools; `export const name = 'grok-bot'`

- [ ] **Step 1: Copy** upstream `dsh-tool-grok-bot` lib files into `lib/grok/` and fix relative imports

- [ ] **Step 2: Copy locale, icon, logo, example session json**

- [ ] **Step 3: Run** `node --check lib/grok/index.js` → exit 0

- [ ] **Step 4: Commit** `feat: migrate grok_bot tools into lib/grok`

---

### Task 3: Migrate reverse MCP bridge

**Files:**
- Create: `lib/bridge/**` (index, server, tasks, agent, client), optional `bin/dsh-bridge-mcp.mjs`
- Test: `node --check` on bridge entry files; copy upstream tests if present

**Interfaces:**
- Produces: MCP `serverName` default `dsh-bridge`; tools `dsh_ping`, `dsh_run_task`, `dsh_task_status`, `dsh_get_task_result`, `dsh_list_tasks`, `dsh_cancel_task`
- Consumes: inject `agentDefaultModel`, `agentPresets`, `agents`, `subagents`, `webServer`

- [ ] **Step 1: Copy** `dsh-mcp-bridge` lib into `lib/bridge/`

- [ ] **Step 2: Keep Config schema and disabled-by-default behavior; keep loopback authToken rule**

- [ ] **Step 3: Syntax check bridge entry**

- [ ] **Step 4: Commit** `feat: migrate MCP bridge into lib/bridge`

---

### Task 4: Tunnel URL helper + tests (TDD)

**Files:**
- Create: `lib/tunnel/url.js`, `test/tunnel-url.test.js`, `scripts/start-tunnel.ps1`

**Interfaces:**
- Produces: `extractTryCloudflareUrl(logText: string): string | null`
- Produces: PowerShell script prints `TUNNEL_URL=https://....trycloudflare.com` and hints `/mcp`

- [ ] **Step 1: Write failing test** for extracting `https://*.trycloudflare.com` and null case

- [ ] **Step 2: Run** `node --test test/tunnel-url.test.js` → FAIL

- [ ] **Step 3: Implement** regex extractor in `lib/tunnel/url.js`

- [ ] **Step 4: Re-run tests → PASS**

- [ ] **Step 5: Write start-tunnel.ps1** targeting `http://127.0.0.1:8931`, cloudflared under `%USERPROFILE%\.dsh\tools\cloudflared.exe`, download from GitHub releases if missing

- [ ] **Step 6: Commit** `feat: cloudflared quick tunnel helper`

---

### Task 5: install.ps1 / uninstall.ps1

**Files:**
- Create: `install.ps1`, `uninstall.ps1`

**Interfaces:**
- Consumes: `-DshRoot` (required), `-DefaultCwd` (required)
- Produces: installed package + marked `# dsh-tool-grok-bridge begin/end` profile patch; bridge remains disabled; warns if old `dsh-tool-grok-bot` / `dsh-mcp-bridge` present

- [ ] **Step 1: Implement install** copying package, updating profile dependencies/bundles, writing cordis patch with DefaultCwd substituted

- [ ] **Step 2: Optional cloudflared bootstrap into `~/.dsh\tools`**

- [ ] **Step 3: uninstall removes only this package markers**

- [ ] **Step 4: Commit** `feat: Windows install and uninstall scripts`

---

### Task 6: Docs + dsh:// badge

**Files:**
- Create: `README.md`, `README.en.md`, `SECURITY.md`, `examples/mcp-connector.url.example`

**Interfaces:**
- Produces: badge linking `dsh://plugin/install?id=dsh-tool-grok-bridge&name=...&version=0.1.0&repo=Lniosy%2Fdsh-tool-grok-bridge&downloadUrl=https%3A%2F%2Fgithub.com%2FLniosy%2Fdsh-tool-grok-bridge%2Farchive%2Frefs%2Fheads%2Fmain.zip`

- [ ] **Step 1: Chinese README** — architecture diagram, tool tables, install paths, tunnel + manual connector steps, safety

- [ ] **Step 2: English README.en.md twin**

- [ ] **Step 3: Commit** `docs: bilingual README and install badge`

---

### Task 7: Publish GitHub repository

**Files:** remote

- [ ] **Step 1: Authenticate as Lniosy via `gh`**

- [ ] **Step 2:** `gh repo create Lniosy/dsh-tool-grok-bridge --public --source=. --remote=origin --push`

- [ ] **Step 3: Verify** `main.zip` HTTP 200

- [ ] **Step 4: Optional tag `v0.1.0`**

**Done when:** public repo exists, README renders, `npm test` and `npm run check` pass locally, design+plan present under `docs/superpowers/`.

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| Unified plugin + display name | 1, 6 |
| Forward DSH→Grok | 2 |
| Reverse MCP | 3 |
| Quick tunnel prints URL | 4 |
| Manual Grok connector | 6 |
| install safety defaults | 5 |
| GitHub Lniosy publish | 7 |
| Old-plugin conflict warning | 5 |
