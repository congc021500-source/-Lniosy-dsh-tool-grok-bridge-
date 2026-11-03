> 发布说明：本仓库是 https://github.com/congc021500-source/-Lniosy-dsh-tool-grok-bridge- 。包名仍是 `dsh-tool-grok-bridge`，显示名仍是「Grok Bot 双向桥」。安装徽章的 downloadUrl 使用本仓库 `archive/refs/heads/main.zip`。下文里的 `Lniosy/dsh-tool-grok-bridge` 是设计时的目标名，以本仓库 URL 为准。

# Grok Bot 双向桥（dsh-tool-grok-bridge）设计

日期：2026-11-03  
仓库目标：`https://github.com/Lniosy/dsh-tool-grok-bridge`  
显示名：Grok Bot 双向桥  
包名：`dsh-tool-grok-bridge`

## 目标

把 DeepSeek Harness（DSH NEXT）与 Grok Bot 的双向联通打成**一个**可安装 DSH 插件，并上架 GitHub，支持 `dsh://` / `github:Lniosy/dsh-tool-grok-bridge` 一键安装。

双向含义：

1. **正向（DSH → Grok Bot）**：DSH 对话里调用 `grok_bot_*` 工具，向指定 Grok Bot 发消息、读历史、管记忆、指挥 Bot 电脑。
2. **反向（Grok Bot → DSH）**：本机暴露 Streamable HTTP MCP（默认 `127.0.0.1:8931/mcp`），经 Cloudflare quick tunnel 给 Grok Bot 正式连接器使用；Grok Bot 用 `dsh_run_task` / `dsh_task_status` / `dsh_get_task_result` 等指挥 DSH 子代理。
3. **隧道**：安装或启动脚本自动拉起 cloudflared quick tunnel，把 `*.trycloudflare.com` URL 打到日志；**用户在 Grok Bot 里手动添加 MCP 连接器**（不自动改 Grok Bot 账号配置）。

## 非目标

- 不做成 Grok Bot 侧的 Cursor 插件市场条目（连接器仍用 AddMcpServer / 用户粘贴 URL）。
- 不做 Cloudflare named tunnel / 固定域名（首版只用 quick tunnel）。
- 不默认在 DSH 启动时打开 Codex Bridge 开关（保持安全默认：关）。
- 不把任务结果文件默认同步到用户本机磁盘以外的位置。

## 架构

单个 npm/DSH 插件包，内部两个子系统 + 一个隧道助手：

```
DSH 对话 ──grok_bot_*──► Grok Bot 云端
Grok Bot ──HTTPS tunnel──► 127.0.0.1:8931/mcp ──dsh_*──► DSH 子代理
                ▲
         cloudflared quick tunnel
```

组件目录（建议）：

| 路径 | 职责 |
|---|---|
| `lib/grok/` | 正向工具（从 `dsh-tool-grok-bot` 迁入并改包名引用） |
| `lib/bridge/` | 反向 MCP server、tasks、agent、control（从 `dsh-mcp-bridge` 迁入） |
| `lib/tunnel/` | 定位/下载 cloudflared、启动 quick tunnel、解析并记录 URL |
| `lib/index.js` | 插件入口：注册 grok 工具 + 挂载 bridge（受开关控制） |
| `cordis.patch.yml` | 一次写入 profile：工具依赖、mcp-bridge 配置块 |
| `scripts/start-tunnel.ps1` | Windows 下一键起隧道；打印 URL |
| `install.ps1` / `uninstall.ps1` | 拷贝到 DSH、junction、幂等配置、可选安装 cloudflared |
| `README.md` / `README.en.md` | 中英说明 + `dsh://` 安装徽章 |
| `examples/` | grok-bot 配置与连接器 URL 示例 |

## 配置与安全

Bridge 配置（迁入现有语义）：

- `host: 127.0.0.1`，`port: 8931`，`basePath: /mcp`
- `controlPath: /dsh-bridge/control`（挂在 DSH webServer 上）
- `authToken`：非回环绑定时必填
- `defaultCwd` / `workspaceRoots`：任务 cwd 必须落在 roots 内
- DSH 启动时 Bridge **关闭**；Settings → General → Codex Bridge 手动打开

隧道：

- 默认 `cloudflared tunnel --url http://127.0.0.1:8931`
- URL 仅日志/控制台输出；quick tunnel 重启会变，README 写明需更新连接器
- 不把隧道 URL 提交进 git 或硬编码进包

## 安装体验

三条路与现有「接通 Grok Bot」对齐：

1. README 顶栏 `dsh://plugin/install?...` 徽章  
2. `dsh plugin --profile desktop add github:Lniosy/dsh-tool-grok-bridge`（或 web profile，以实际 DSH NEXT 文档为准）  
3. `install.ps1 -DshRoot ... -DefaultCwd ...`

装完必须**完全退出再打开** DSH NEXT。

装完后用户步骤（反向）：

1. Settings 打开 Codex Bridge  
2. 运行 `scripts/start-tunnel.ps1`（或安装器提供的快捷方式）  
3. 复制 URL，在 Grok Bot 添加 MCP：`https://<subdomain>.trycloudflare.com/mcp`

## 与旧插件关系

- 新仓独立：`Lniosy/dsh-tool-grok-bridge`，与 `Lniosy/dsh-tool-grok-bot` 并列。  
- 首版**迁入代码副本**（非 git submodule），便于一键装；README 注明能力来源与上游。  
- 若用户已装旧正向插件，文档建议卸掉旧包或避免重复注册同名工具（实现时：工具名保持 `grok_bot_*` / `dsh_*` 兼容，安装脚本检测冲突并提示）。

## 验收标准

1. 干净 DSH NEXT 上安装本插件后，工具列表出现 `grok_bot_*`。  
2. 打开 Bridge 后本机 `http://127.0.0.1:8931/mcp` 可 MCP initialize。  
3. `start-tunnel.ps1` 输出可访问的 trycloudflare URL；经隧道 initialize / `dsh_ping` 成功。  
4. Grok Bot 用该 URL 添加连接器后可见 `dsh_ping`、`dsh_run_task` 等。  
5. 公开 GitHub 仓库 `Lniosy/dsh-tool-grok-bridge`，main 可 zip 安装，README 含中英与安装徽章。

## 实现顺序

1. 脚手架：package.json、LICENSE、cordis.patch、入口  
2. 迁入 bridge + grok 并改引用  
3. tunnel 脚本与 install/uninstall  
4. README / 徽章 / 示例  
5. 本地冒烟  
6. 创建 GitHub 仓库并推送 main  

## 风险

- quick tunnel URL 易变；文档必须醒目提示。  
- DSH 内嵌依赖（MCP SDK、schemastery 等）可能需安装器拷到 app `node_modules`（沿用现网踩坑经验）。  
- 双插件并存时工具重复注册；安装器需检测。
