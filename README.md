# Milo Market

Milo 官方插件与独立 Skill 目录。

- `plugins/`：账户安装后为 Agent 选择的插件。
- `skills/`：直接安装到指定 Agent 的独立 Skill。
- `stable`：发布分支。安装固定完整提交和内容摘要。

首批内容：交付检查插件、任务交接 Skill。两者不需要 MCP 或 Hook。
安装不执行脚本，也不自动授予权限。参见 [发布说明](docs/publishing.md)。

插件按清单中的 `categories` 分组；每项插件通过 `category` 引用分类。分类维护方法见 [发布说明](docs/publishing.md#插件分类)。
