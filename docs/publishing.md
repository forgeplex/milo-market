# 发布与安装

合并到 stable 即发布。Milo 解析 stable 的完整 SHA，再读取同一提交的两个目录。
插件需要按实际能力配置 MCP、Hook 和 Agent 选择。Skill 安装到指定 Agent。
目录收录不代表用户环境验收通过。需要独立服务的插件必须说明启动、地址、持久数据和账户隔离。
本市场不托管插件服务。经验插件在完成可移植配置前不作为通用包发布。

## 插件分类

在 `.agents/plugins/marketplace.json` 的 `categories` 中维护分类。每项包含稳定的 `id`、显示名称 `name` 和说明 `description`；列表顺序就是页面分组顺序。
每个插件条目用 `category` 引用一个分类 ID。例如 `delivery-check` 使用 `productivity`。CI 拒绝重复 ID、缺少分类和未知引用。
新增分类时先加注册项，再为插件指定分类。修改显示名称不需要修改分类 ID。分类不改变插件路径、内容摘要或已安装任务。页面不显示没有插件的分类。
