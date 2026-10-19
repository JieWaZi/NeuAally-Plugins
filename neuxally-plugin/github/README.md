# GitHub

NeuxAlly 系统逻辑入口。安装一次后由当前智能体选择固定快照中的原生实现，不复制原生组件定义。

| 目标 | 原生包 | 上游与版本 |
| --- | --- | --- |
| Codex | [OpenAI GitHub](../../codex-plugins/github/README.md) | `openai/plugins`，`0722921d5542fc593105c27bd52630babd8b8c2a`，`0.1.12` |
| Claude Code | [GitHub 原生目录](../../claude-plugins/github/) | `anthropics/claude-plugins-official`，`ea10b213686c90bb1984b2016937310e05336cf3`；上游未声明版本 |

Codex 包保留 OpenAI 托管 `.app.json` 与公共 OAuth 客户端配置。公共 `client_secret` 不能证明客户端身份，用户 token 必须保密；是否能使用托管连接取决于当前宿主和账号。Claude 包使用官方远程 MCP，要求由受保护配置提供 `GITHUB_PERSONAL_ACCESS_TOKEN`。这两种账号模型不相互替换。

本入口只有原生引用，没有自有 Skill/MCP。目标不匹配时应返回无实现；原生解析或认证失败时应报告失败。目录收录与可下载不代表真实 CLI 加载或账号验证已经通过。

许可与固定文件摘要见对应 `provenance.json` 及 [第三方声明](../../THIRD_PARTY_NOTICES.md)。
