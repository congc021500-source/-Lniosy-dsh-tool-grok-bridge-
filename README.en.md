<p align="center">
  <img src="docs/logo.png" width="168" alt="DeepSeek Harness linked with Grok Bot">
</p>

<h1 align="center">Grok Bot 双向桥</h1>

<p align="center">
  One DeepSeek Harness plugin. Package name <code>dsh-tool-grok-bridge</code>.<br>
  Forward <code>grok_bot_*</code> tools talk to a cloud Grok Bot. The reverse MCP lets Grok Bot drive DSH.
</p>

<p align="center">
  <a href="README.md">中文</a>
  ·
  <a href="https://github.com/congc021500-source/-Lniosy-dsh-tool-grok-bridge-">congc021500-source/-Lniosy-dsh-tool-grok-bridge-</a>
  ·
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>
</p>

<p align="center">
  <a href="dsh://plugin/install?id=dsh-tool-grok-bridge&name=Grok%20Bot%20%E5%8F%8C%E5%90%91%E6%A1%A5&version=0.1.0&repo=congc021500-source%2F-Lniosy-dsh-tool-grok-bridge-&permissions=%E8%AF%BB%E5%8F%96%E6%9C%AC%E6%9C%BA%E7%99%BB%E5%BD%95%2C%E8%B0%83%E7%94%A8%20Grok%20Bot%2C%E6%9A%B4%E9%9C%B2%E6%9C%AC%E6%9C%BA%20MCP&downloadUrl=https%3A%2F%2Fgithub.com%2Fcongc021500-source%2F-Lniosy-dsh-tool-grok-bridge-%2Farchive%2Frefs%2Fheads%2Fmain.zip">
    <img src="https://img.shields.io/badge/DeepSeek%20Harness-Install%20in%20one%20click-0066FF?style=for-the-badge" alt="Install in one click" />
  </a>
</p>

```
DSH chat ──grok_bot_*──► Grok Bot cloud
Grok Bot ──HTTPS quick tunnel──► 127.0.0.1:8931/mcp ──dsh_*──► DSH subagent
                         ▲
                  cloudflared quick tunnel
```

Forward tools are migrated from `dsh-tool-grok-bot`. The reverse bridge is migrated from `dsh-mcp-bridge`. This repository is one copied plugin, not a submodule of those trees.

## Forward: DSH → Grok Bot

| Tool | What it does |
|---|---|
| `grok_bot_status` | Check the local login and count bots |
| `grok_bot_list` | List bots. `kind: team` is a team room |
| `grok_bot_history` | Read recent chat without sending a new message |
| `grok_bot_ask` | Ask one bot, or one team room |
| `grok_bot_ask_team` | Ask up to 8 bots the same text, separately |
| `grok_bot_computer` | Ask a bot to work on its own computer and paste the text back |
| `grok_bot_memory_recall` | Recall facts related to one sentence |
| `grok_bot_memory_list` | Export cloud memory. Returns one finished batch |
| `grok_bot_memory_write` | Write one fact for the account or for this bot only |
| `grok_bot_memory_forget` | Forget one fact by its original text |

Replies, writes, and forgets also show up in that bot's official chat. The `grok-bot` skill states that the bot's computer and memory stay in the cloud. Result files do not land on this machine.

## Reverse: Grok Bot → DSH

Local Streamable HTTP MCP. The default `serverName` is `dsh-bridge`, at `http://127.0.0.1:8931/mcp`. DSH starts with the listener off. Turn it on under **Settings → General → Codex Bridge**.

| Tool | What it does |
|---|---|
| `dsh_ping` | Bridge health and the available subagent providers |
| `dsh_run_task` | Start a DSH subagent asynchronously |
| `dsh_task_status` | Read state without the final text |
| `dsh_get_task_result` | Fetch the result once the task is terminal |
| `dsh_list_tasks` | List bridge tasks created in this DSH process |
| `dsh_cancel_task` | Cancel a queued or running task |

Each `cwd` must sit inside `workspaceRoots`. When no other roots are set, the installer's `defaultCwd` is the only root.

## Install

Three ways, one package. After any of them, quit DeepSeek Harness and open it again. Refresh the web app.

### 1. One click

The blue button opens the desktop app with this address:

```text
dsh://plugin/install?id=dsh-tool-grok-bridge&name=Grok%20Bot%20%E5%8F%8C%E5%90%91%E6%A1%A5&version=0.1.0&repo=congc021500-source%2F-Lniosy-dsh-tool-grok-bridge-&permissions=%E8%AF%BB%E5%8F%96%E6%9C%AC%E6%9C%BA%E7%99%BB%E5%BD%95%2C%E8%B0%83%E7%94%A8%20Grok%20Bot%2C%E6%9A%B4%E9%9C%B2%E6%9C%AC%E6%9C%BA%20MCP&downloadUrl=https%3A%2F%2Fgithub.com%2Fcongc021500-source%2F-Lniosy-dsh-tool-grok-bridge-%2Farchive%2Frefs%2Fheads%2Fmain.zip
```

| Param | Value | Meaning |
|---|---|---|
| `id` | `dsh-tool-grok-bridge` | Package name |
| `name` | `Grok Bot 双向桥` | Display name |
| `version` | `0.1.0` | Matches the version on main |
| `repo` | `congc021500-source/-Lniosy-dsh-tool-grok-bridge-` | This GitHub repository |
| `permissions` | read the local login, call Grok Bot, expose local MCP | What this plugin does |
| `downloadUrl` | [main.zip](https://github.com/congc021500-source/-Lniosy-dsh-tool-grok-bridge-/archive/refs/heads/main.zip) | What the app downloads |

`downloadUrl` is this repository's `archive/refs/heads/main.zip`.

### 2. Official command

```bash
dsh plugin --profile web add github:congc021500-source/-Lniosy-dsh-tool-grok-bridge-
```

Use `default` instead of `web` for the desktop profile. This path loads `cordis.patch.yml` from the package. Its `defaultCwd` is still the placeholder `DSH_TOOL_GROK_BRIDGE_DEFAULT_CWD`. Replace that with a real workspace before reverse tasks can use a legal `cwd`.

### 3. Windows script

`-DshRoot` and `-DefaultCwd` are both required. The script copies the package, updates profile dependencies and bundles, and writes a `# dsh-tool-grok-bridge begin` / `# dsh-tool-grok-bridge end` block in `cordis.yml`. The bridge stays off. If `dsh-tool-grok-bot` or `dsh-mcp-bridge` is already installed, the script warns and leaves those packages alone.

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -DshRoot 'C:\path\to\DeepSeek Harness' -DefaultCwd 'C:\path\to\workspace'
```

Set `DSH_PROFILE` to `web` or `default` to target one profile. Pass `-DshHome`, or set `DSH_HOME`, when the data directory is not `%USERPROFILE%\.dsh`.

The script also downloads `cloudflared.exe` into `%USERPROFILE%\.dsh\tools`. Add `-SkipCloudflared` to skip that download.

## After install: connect Grok Bot to DSH

The bridge is off by default. A quick tunnel hostname changes every restart, so the connector is updated by hand. This plugin does not edit the Grok Bot account.

1. Quit DSH and open it again.
2. Turn on **Settings → General → Codex Bridge**. The local endpoint is `http://127.0.0.1:8931/mcp`.
3. Start the tunnel:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-tunnel.ps1
```

4. The log prints `TUNNEL_URL=https://<subdomain>.trycloudflare.com`. The MCP path is that origin plus `/mcp`.
5. In Grok Bot, add an MCP connector manually. The URL looks like `https://<subdomain>.trycloudflare.com/mcp`. See [examples/mcp-connector.url.example](examples/mcp-connector.url.example).
6. After the tunnel stops or starts again, the hostname is new. Update the Grok Bot connector. Do not commit that URL.

This release is quick tunnel only. It does not create a named Cloudflare tunnel or a fixed hostname.

## Safety

- DSH starts with the bridge disabled. Turning the switch off stops the listener and cancels running bridge tasks.
- The default bind is `127.0.0.1:8931`. A non-loopback `host` requires `authToken`.
- Task `cwd` values must stay inside the configured workspace roots.
- A child agent can use only tools DSH already exposed. `toolAllow` narrows that set.
- Do not commit `grok-bot.json`, access tokens, machine ids, or a live tunnel URL.

## Older plugins

A profile that still loads `dsh-tool-grok-bot` or `dsh-mcp-bridge` can register `grok_bot_*` / `dsh_*` twice. The installer warns when it sees them. Remove the old package, or keep it out of the bundle.

## Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -DshRoot 'C:\path\to\DeepSeek Harness'
```

This removes only this package's marked block, dependency, bundle entry, junctions, and plugin directory. cloudflared and other plugins stay.

## Login

No file to fill in. When Grok Bot is already signed in on this computer, the forward tools read that login. Open Grok Bot once, then call a tool from Harness.

A machine without Grok Bot can still use `~/.dsh/grok-bot.json`. The shape is in [examples/grok-bot.json.example](examples/grok-bot.json.example). Do not commit that file. `GROK_BOT_ACCESS_TOKEN` and `GROK_BOT_MACHINE_ID` override the local login.

## Checks

Node ≥ 22. DSH provides `@deepseek-ai/dsh-tools`, Cordis, the MCP SDK, and schemastery at runtime. Source checks do not install them.

```bash
npm test
npm run check
```

`node bin/dsh-bridge-mcp.mjs` is an offline transport smoke test. It cannot run a DSH subagent.

## License

[MIT](LICENSE).
