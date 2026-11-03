<p align="center">
  <img src="docs/logo.png" width="168" alt="DeepSeek Harness 与 Grok Bot 双向桥">
</p>

<h1 align="center">Grok Bot 双向桥</h1>

<p align="center">
  一个 DeepSeek Harness 插件，包名 <code>dsh-tool-grok-bridge</code>。<br>
  正向用 <code>grok_bot_*</code> 问云端 Grok Bot，反向用本机 MCP 让 Grok Bot 指挥 DSH。
</p>

<p align="center">
  <a href="README.en.md">English</a>
  ·
  <a href="https://github.com/congc021500-source/-Lniosy-dsh-tool-grok-bridge-">congc021500-source/-Lniosy-dsh-tool-grok-bridge-</a>
  ·
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>
</p>

<p align="center">
  <a href="dsh://plugin/install?id=dsh-tool-grok-bridge&name=Grok%20Bot%20%E5%8F%8C%E5%90%91%E6%A1%A5&version=0.1.0&repo=congc021500-source%2F-Lniosy-dsh-tool-grok-bridge-&permissions=%E8%AF%BB%E5%8F%96%E6%9C%AC%E6%9C%BA%E7%99%BB%E5%BD%95%2C%E8%B0%83%E7%94%A8%20Grok%20Bot%2C%E6%9A%B4%E9%9C%B2%E6%9C%AC%E6%9C%BA%20MCP&downloadUrl=https%3A%2F%2Fgithub.com%2Fcongc021500-source%2F-Lniosy-dsh-tool-grok-bridge-%2Farchive%2Frefs%2Fheads%2Fmain.zip">
    <img src="https://img.shields.io/badge/DeepSeek%20Harness-%E7%82%B9%E4%B8%80%E4%B8%8B%E5%AE%89%E8%A3%85-0066FF?style=for-the-badge" alt="点一下安装" />
  </a>
</p>

```
DSH 对话 ──grok_bot_*──► Grok Bot 云端
Grok Bot ──HTTPS quick tunnel──► 127.0.0.1:8931/mcp ──dsh_*──► DSH 子代理
                         ▲
                  cloudflared quick tunnel
```

正向代码来自 `dsh-tool-grok-bot`，反向代码来自 `dsh-mcp-bridge`。本仓库是迁入后的一个插件，不是那两个仓库的 submodule。

## 正向：DSH → Grok Bot

| 工具 | 作用 |
|---|---|
| `grok_bot_status` | 看本机登录通不通，并数一下 Bot |
| `grok_bot_list` | 列出 Bot。`kind` 为 `team` 的是团队房间 |
| `grok_bot_history` | 读最近的对话，不新发消息 |
| `grok_bot_ask` | 发给一个 Bot，或一个团队房间 |
| `grok_bot_ask_team` | 同一句话分别发给最多 8 个 Bot |
| `grok_bot_computer` | 请 Bot 在它自己的电脑上做事，把结果文字贴回来 |
| `grok_bot_memory_recall` | 按一句话回忆相关事实 |
| `grok_bot_memory_list` | 导出云端记忆。一批列完就返回，没列完可以再拉 |
| `grok_bot_memory_write` | 写入一条。位置是账号共用或仅此 Bot |
| `grok_bot_memory_forget` | 按原文忘掉一条 |

回复、写入和忘掉都会出现在那个 Bot 的官方对话里。技能 `grok-bot` 会说明：Bot 的电脑和记忆都在云端，结果文件不会落到这台机器。

## 反向：Grok Bot → DSH

本机 Streamable HTTP MCP。默认 `serverName` 是 `dsh-bridge`，地址是 `http://127.0.0.1:8931/mcp`。DSH 启动时监听是关的，要在 **Settings → General → Codex Bridge** 里手动打开。

| 工具 | 作用 |
|---|---|
| `dsh_ping` | 看桥是否在，以及有哪些子代理 provider |
| `dsh_run_task` | 异步启动一个 DSH 子代理 |
| `dsh_task_status` | 查询状态，不返回最终正文 |
| `dsh_get_task_result` | 任务结束后取回结果 |
| `dsh_list_tasks` | 列出这次 DSH 进程里创建的桥任务 |
| `dsh_cancel_task` | 取消排队中或正在跑的任务 |

`cwd` 必须落在 `workspaceRoots` 里。没有另配 roots 时，安装器写入的 `defaultCwd` 就是唯一的根。

## 安装

三条路装的是同一个包。装完要完全退出 DeepSeek Harness 再打开。Web 版刷新页面。

### 1. 点一下

顶部蓝色按钮打开桌面客户端，地址是：

```text
dsh://plugin/install?id=dsh-tool-grok-bridge&name=Grok%20Bot%20%E5%8F%8C%E5%90%91%E6%A1%A5&version=0.1.0&repo=congc021500-source%2F-Lniosy-dsh-tool-grok-bridge-&permissions=%E8%AF%BB%E5%8F%96%E6%9C%AC%E6%9C%BA%E7%99%BB%E5%BD%95%2C%E8%B0%83%E7%94%A8%20Grok%20Bot%2C%E6%9A%B4%E9%9C%B2%E6%9C%AC%E6%9C%BA%20MCP&downloadUrl=https%3A%2F%2Fgithub.com%2Fcongc021500-source%2F-Lniosy-dsh-tool-grok-bridge-%2Farchive%2Frefs%2Fheads%2Fmain.zip
```

| 参数 | 值 | 含义 |
|---|---|---|
| `id` | `dsh-tool-grok-bridge` | 插件包名 |
| `name` | `Grok Bot 双向桥` | 显示名 |
| `version` | `0.1.0` | 跟 main 上的版本一致 |
| `repo` | `congc021500-source/-Lniosy-dsh-tool-grok-bridge-` | 这个 GitHub 仓库 |
| `permissions` | `读取本机登录,调用 Grok Bot,暴露本机 MCP` | 这个插件会做的事 |
| `downloadUrl` | [main.zip](https://github.com/congc021500-source/-Lniosy-dsh-tool-grok-bridge-/archive/refs/heads/main.zip) | 客户端下载这一包 |

`downloadUrl` 用的是本仓库 `archive/refs/heads/main.zip`，不是别的账号下的同名项目。

### 2. 官方命令

```bash
dsh plugin --profile web add github:congc021500-source/-Lniosy-dsh-tool-grok-bridge-
```

桌面版把 `web` 换成 `default`。这条路使用仓库里的 `cordis.patch.yml`。里面的 `defaultCwd` 仍是占位符 `DSH_TOOL_GROK_BRIDGE_DEFAULT_CWD`，要改成这台机器上的工作目录，反向任务才有合法的 `cwd`。

### 3. Windows 脚本

`DshRoot` 和 `DefaultCwd` 都必填。脚本会复制插件、写入 profile 依赖和 bundle，并在 `cordis.yml` 里写下 `# dsh-tool-grok-bridge begin` / `# dsh-tool-grok-bridge end` 标记段。桥保持关闭。已装 `dsh-tool-grok-bot` 或 `dsh-mcp-bridge` 时只会警告，不会卸掉它们。

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -DshRoot 'C:\path\to\DeepSeek Harness' -DefaultCwd 'C:\path\to\workspace'
```

只要装一个 profile 时先设 `DSH_PROFILE`（`web` 或 `default`）。数据目录不在 `%USERPROFILE%\.dsh` 时，传入 `-DshHome`，或先设 `DSH_HOME`。

脚本会顺手把 `cloudflared.exe` 下到 `%USERPROFILE%\.dsh\tools`。不想下载时加 `-SkipCloudflared`。

## 装完以后：让 Grok Bot 连上 DSH

桥默认关闭。quick tunnel 的主机名每次重启都会变，所以连接器要手改。本插件不写 Grok Bot 账号。

1. 完全退出再打开 DSH。
2. 打开 **Settings → General → Codex Bridge**。本机出现 `http://127.0.0.1:8931/mcp`。
3. 运行隧道脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-tunnel.ps1
```

4. 日志里会出现一行 `TUNNEL_URL=https://<subdomain>.trycloudflare.com`。MCP 路径是那个地址再加上 `/mcp`。
5. 在 Grok Bot 里手动添加 MCP 连接器，URL 形如 `https://<subdomain>.trycloudflare.com/mcp`。示例见 [examples/mcp-connector.url.example](examples/mcp-connector.url.example)。
6. 隧道关掉或重开之后，主机名变了，要在 Grok Bot 里改连接器。不要把当次 URL 写进仓库。

首版只有 Cloudflare quick tunnel，没有固定域名。

## 安全

- DSH 启动时桥是关的。关掉开关会停掉监听，并取消还在跑的桥任务。
- 默认只绑 `127.0.0.1:8931`。`host` 不是回环地址时必须填 `authToken`。
- 任务 `cwd` 必须在配置的 workspace root 里面。
- 子代理只能用 DSH 已经露出的工具。`toolAllow` 是收紧，不是额外授权。
- 不要提交 `grok-bot.json`、访问令牌、机器标识，或某一次的隧道 URL。

## 和旧插件

如果 profile 里还有 `dsh-tool-grok-bot` 或 `dsh-mcp-bridge`，同名的 `grok_bot_*` / `dsh_*` 可能注册两次。安装脚本发现它们会警告。卸掉旧包，或不要让两边同时进 bundle。

## 卸载

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -DshRoot 'C:\path\to\DeepSeek Harness'
```

只去掉这个包的标记段、依赖、bundle、junction 和插件目录。不删 cloudflared，也不动别的插件。

## 登录

不用手填。本机的 Grok Bot 已经登录时，正向工具自己读这份登录。先打开一次 Grok Bot，再在 Harness 里调用工具。

没有安装 Grok Bot 的环境，才把登录写到 `~/.dsh/grok-bot.json`，格式见 [examples/grok-bot.json.example](examples/grok-bot.json.example)。这个文件不要提交。`GROK_BOT_ACCESS_TOKEN` 和 `GROK_BOT_MACHINE_ID` 可以盖过本机登录。

## 开发检查

需要 Node ≥ 22。DSH 运行时提供 `@deepseek-ai/dsh-tools`、Cordis、MCP SDK 和 schemastery，源码检查不安装它们。

```bash
npm test
npm run check
```

`node bin/dsh-bridge-mcp.mjs` 只是离线传输冒烟，不能真的跑 DSH 子代理。

## 许可

[MIT](LICENSE)。
