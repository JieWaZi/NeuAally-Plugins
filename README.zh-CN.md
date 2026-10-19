# NeuxAlly 插件

[English](README.md) | [简体中文](README.zh-CN.md)

维护 NeuxAlly 插件包、上游来源声明与目录元数据的公开源码仓库。

## 插件包

| 插件 | 用途 | 上游来源 |
| --- | --- | --- |
| [飞书办公](plugins/feishu-office/README.md) | 文档、多维表格、日程和任务 | [Lark Suite CLI](https://github.com/larksuite/cli) |
| [GitHub](plugins/github/README.md) | 仓库、Issue 与 Pull Request 工作 | [GitHub MCP Server](https://github.com/github/github-mcp-server) 与 [GitHub CLI](https://github.com/cli/cli) |

本仓库从应用现有的独立 Git bundle 恢复插件源码及其历史。当前包的账号配置仍依赖 NeuxAlly 集成；公开源码和目录不代表这些能力已经在其他宿主完整运行。

## 格式与查询

插件包采用已有的 [Agent Plugins 格式](https://developers.openai.com/plugins/build/plugins)：根 `plugin.json`、可选 `skills/` 和可选 `mcp.json`。

- [.agents/plugins/marketplace.json](.agents/plugins/marketplace.json) 是按 OpenAI 格式提供的插件来源索引。
- [catalog.json](catalog.json) 是保留给应用现有 bundle 构建流程的目录，不建立新的插件清单标准。
- Git 提交标识源码快照；插件清单和来源记录保留各自上游版本及许可。

应用当前仍消费随包固定快照。在线刷新目录、跨 CLI 原生安装及插件声明式授权属于 v2 设计，本次仓库初始化没有实现这些能力。对应原生包准备好之前，不发布 Claude Code marketplace。

## 参考与来源声明

本仓库参考 [openai/plugins](https://github.com/openai/plugins/tree/main/plugins) 的插件组织、marketplace 查询与原生包复用方式，同时遵循 [OpenAI 插件打包文档](https://developers.openai.com/plugins/build/plugins) 和 [Claude Code 插件文档](https://code.claude.com/docs/en/plugins-reference)。

现有飞书和 GitHub 包来自上表所列上游项目，不将其描述为从 OpenAI 样例复制。后续复用第三方插件时，逐包保留真实作者、许可证、来源提交及修改记录；仓库引用不能替代这些声明。

完整信息见 [第三方声明](THIRD_PARTY_NOTICES.md)、包内许可证和 `provenance.json`。GitHub CLI 的隔离补丁及回归源码保存在 [patches/](patches/)。

## 维护

保留完整包目录，包括技能引用、脚本、资产及原生组件。更新固定版本前审阅上游变更和许可。不提交用户凭据、账号 profile 或生成的 CLI 二进制。

根目录 [MIT 许可](LICENSE) 适用于 NeuxAlly 自行编写的仓库内容；第三方内容继续遵守各自许可与声明。
