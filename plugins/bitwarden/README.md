# Bitwarden 0.2.0

通过官方 `@bitwarden/mcp-server@2026.7.0` 和 `@bitwarden/cli@2026.10.1` 使用网站登录项。需要支持插件 configuration schema 的 Milo 版本。旧版本不能使用这套配置表单。

```text
安装表单 → 加密 MCP 配置 → 官方 MCP → 官方 CLI → Bitwarden
```

## 安装前

管理员必须准备 Node.js 22、锁定依赖和本账户 CLI 登录。此版本的 `.mcp.json` 使用 Milo staging 已准备的 `/var/lib/milo/workspaces/.bitwarden-mcp-runtime-0.1.1` 运行目录。其他部署必须按其实际路径制作对应包，不能直接复用这些路径。

Bitwarden 使用单个生产服务 `https://bitwarden.pleamon.com`。CLI 必须先配置此地址并完成登录。浏览器扩展的登录状态不会自动传给 CLI。状态目录属于一个 Milo 账户；不要指向其他账户的目录。

## 安装与配置

1. 安装插件时填写 CLI 状态目录和 `BW_SESSION` 解锁会话密钥。不能填写主密码。
2. 安装后进入插件详情，点击“检查连接”来同步工具目录。
3. 让 Agent 调用 `status`，确认 `serverUrl` 正确且状态为 `unlocked`。

密钥在 Milo 服务端加密保存。页面只显示“已配置”，不回显值。编辑时留空保留，点击“清除”后保存会删除该值。新配置只用于后续任务。会话失效时需重新解锁并在表单更新密钥，不要在聊天发送。

只开放 `status`、`sync`、`list`、`get`。安装成功和工具发现不表示保险库已解锁。官方 MCP 的凭据读取结果可进入 Agent 上下文，不能承诺模型看不到密码。

`runtime/package-lock.json` 保留上游锁定版本。旧 `runtime/launch.mjs` 是 0.1.x 手动连接的兼容入口，0.2.0 的 schema 连接直接启动官方 MCP，不再读取明文 session 文件。

上游：[Bitwarden 官方 MCP](https://github.com/bitwarden/mcp-server)。
