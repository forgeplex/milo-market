# Bitwarden

通过官方 `@bitwarden/mcp-server@2026.7.0` 和 `@bitwarden/cli@2026.10.1` 使用网站登录项。
插件由 Milo 打包，MCP 与 CLI 由 Bitwarden 发布。安装插件不会登录、解锁或自动授予保险库访问权。

```text
Milo Agent → 本地 stdio → 官方 MCP → 官方 CLI → 自托管 Bitwarden
```

## 当前 Milo 接入限制

Milo 插件入口目前只会自动配置 HTTP MCP；本插件声明的 stdio MCP 会显示 `unsupported`。
在不改 Milo 核心的条件下，需由管理员另行配置全局 stdio MCP，并由用户为测试 Agent 分别选择插件和连接器。
禁用本插件只停用 Skill，不会禁用独立配置的全局 MCP；停止访问时必须同时禁用 Agent 的连接器，锁定 CLI 会话。
不能将插件安装、工具发现或目录同步写成保险库已连接。

## 运行配置

官方 MCP 仅提供本地 stdio，不要将它转换成公开 HTTP 服务。上游说明：
https://github.com/bitwarden/mcp-server

`runtime/package-lock.json` 固定官方 MCP、CLI 及其依赖；使用 Node.js 22 或更高版本，运行 `npm ci --ignore-scripts --omit=dev` 安装。
`runtime/launch.mjs` 是一个本地启动入口，不实现或替换 MCP 工具。
它为一个 Milo 账户使用独立的私密目录，将目录中的 `session` 文件传给官方 MCP，退出时关闭子进程。
主密码不得保存在插件、参数、环境配置或日志中；会话文件必须为 0600。目录权限为 0700。

全局 stdio 配置示例（路径由管理员在实际执行环境中设置）：

```json
{
  "command": "/absolute/runtime/node",
  "args": ["/absolute/runtime/launch.mjs", "/absolute/private/account-state"]
}
```

初次测试只启用 `status`、`sync`、`list`、`get`。不要启用写入和组织管理工具。
独立 CLI 必须先执行 `bw config server https://bitwarden.pleamon.com`，再由用户登录、解锁。
浏览器扩展的登录状态不会传入 CLI。无图形界面的 staging 不能使用官方 MCP 的原生解锁窗口。
会话失效或服务重建后，用户可能需要重新解锁。

## staging 验收

1. 安装此插件，并另行保存全局 stdio MCP。
2. 发现工具，调用 `status`；未登录时应明确返回 `unauthenticated`。
3. 由用户完成独立 CLI 登录和解锁，不能在聊天中提交主密码或会话令牌。
4. 只查询专门的测试登录项，再由用户验证目标网站登录。

官方 MCP 返回的凭据可以进入 Agent 上下文，不能承诺模型看不到密码。
该包直接使用官方发布版本，没有自行修补上游依赖；部署前的 npm audit 结果需单独记录。
MCP 握手通过不代表依赖无漏洞，也不代表网站登录验收通过。
