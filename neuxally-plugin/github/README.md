# GitHub

检索 GitHub 仓库、议题和拉取请求，协助代码审查与协作。可用于查找实现、跟进问题、整理变更、检查持续集成结果和评审拉取请求。

使用 NeuxAlly 时为伙伴安装本插件，需要时按当前目标的授权方式提供账号。目录存在、归档可下载和账号可用分别核验；本说明不表示真实 GitHub 账号已通过验收。

## 原生来源与开发说明

此标准逻辑入口版本为 `0.1.0`，同一次伙伴安装按当前智能体选择固定快照内的原生实现。入口只声明引用，不重复上游组件定义。

| 目标 | 固定原生来源 | 实际版本 |
| --- | --- | --- |
| Codex | [OpenAI GitHub 固定目录](https://github.com/openai/plugins/tree/0722921d5542fc593105c27bd52630babd8b8c2a/plugins/github)，[来源锁](../../codex-plugins/github/source.json) | `0.1.12` |
| Claude Code | [官方 marketplace 固定目录](https://github.com/anthropics/claude-plugins-official/tree/ea10b213686c90bb1984b2016937310e05336cf3/external_plugins/github)，[来源锁](../../claude-plugins/github/source.json) | 上游未声明版本 |

源码仓库只登记上游地址、固定提交、包路径和完整性/许可证据；发布构建通过 HTTP 还原完整原生内容。安装 ZIP 内仍包含相同 `codex-plugins/github` 与 `claude-plugins/github` 路径和原生索引，客户端不用 Git。

Codex 原生包保留 OpenAI 托管 `.app.json` 与公共 OAuth 客户端声明，取决于当前宿主及账号能否提供托管连接。Claude 原生包要求通过受保护配置提供 `GITHUB_PERSONAL_ACCESS_TOKEN`。两种账号模型不互相替换，用户 token 必须保密。

本入口没有自有 Skill/MCP；目标没有引用时明确无实现，引用解析或认证失败时准确报错。完整来源和许可边界见 [第三方声明](../../THIRD_PARTY_NOTICES.md)。
