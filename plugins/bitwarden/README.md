# Bitwarden 0.3.2

使用官方 `@bitwarden/mcp-server@2026.7.0` 和 `@bitwarden/cli@2026.10.1`。需要支持插件连接向导的 Milo 服务。

```text
安装插件 → 连接账户 → 邮箱与主密码 → 必要的验证码 → 已连接
                       ↓ 私密提交
                 独立 CLI 登录目录 → 加密会话 → 官方 MCP
```

安装后打开插件详情，点击“连接账户”。填写 Bitwarden 邮箱和主密码。账户启用两步登录或新设备邮件验证时，按提示输入验证码。验证码步骤使用同一次 CLI 登录，不重新发送登录请求来替换待验证的验证码。登录进程最多保留十分钟，成功或取消后结束。两步登录方式：0 是验证器，1 是邮件，3 是 YubiKey OTP。此版本连接唯一的生产服务 `https://bitwarden.pleamon.com`。

Milo 自动保存会话。用户不需要运行 CLI、复制会话密钥或配置目录。会话失效时点击“重新连接”。取消或登录失败会保留原连接。重连成功后，新任务使用新连接；已接受的任务保留原配置。

主密码和验证码会临时经过 Milo 服务和登录进程，不写入数据库、文件或日志，不发送给 Agent。解锁会话由 Milo 加密保存。CLI 缓存保存在当前 Milo 账户的私有目录，每次重连使用新目录。浏览器中的登录状态不会自动传给 CLI。本方案使用 CLI 登录，不提供个人保险库 OAuth。SSO、CAPTCHA 和安全密钥 WebAuthn 不在本次支持范围。

管理员先准备 Node.js 22、此目录锁定的依赖和 `launch-configured.mjs`。本部署使用 `/var/lib/milo/workspaces/.bitwarden-mcp-runtime-0.3.0`。目录由宿主管理，不是用户表单字段。Milo 的 stdio 用户许可仍需由管理员授予。每个 Milo 账户有独立登录状态；此配置不提供同一服务 Unix 用户内的操作系统隔离。

登录成功后自动同步 MCP 工具目录。同步失败时，在详情中点击“检查连接”，无需再次登录。开放 `status`、`sync`、`list`、`get`、`create_item`、`edit_item`。支持读取、创建和修改项目；不开放删除、组织管理或分享工具。用户明确要求读写测试时，使用唯一名称的测试安全笔记，修改后按 ID 读取验证，并保留笔记供用户核对。凭据读取结果可以进入 Agent 上下文。本插件不保证模型看不到密码。

连接处理器使用版本化私密协议；只有宿主批准的包才能执行。旧 `launch.mjs` 保留给 0.1.x 已接受任务，不能用于新向导。

[官方 MCP](https://github.com/bitwarden/mcp-server) · [官方 CLI](https://bitwarden.com/help/cli/)
