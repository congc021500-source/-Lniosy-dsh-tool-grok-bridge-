# 安全

这个插件自己读取本机已经登录的 Grok Bot，用那个身份发消息。反向桥默认关闭，只在本机 `127.0.0.1:8931` 上听。非回环地址必须配置 `authToken`。

仓库里没有令牌，也没有某一次 quick tunnel 的真实地址。

不要提交这些东西：

- `grok-bot.json`
- 访问令牌、机器标识、`authToken`
- 记忆正文、Bot 的真实名字、账号邮箱
- `TUNNEL_URL` 或任何 `*.trycloudflare.com` 的当次主机名
- `cloudflared.exe` 和 `.env`

问题说明里只写操作步骤和报错。令牌和隧道地址打码后再贴。
