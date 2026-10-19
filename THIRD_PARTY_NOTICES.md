# 第三方来源与许可

本仓库根 MIT 许可仅覆盖 NeuxAlly 自行编写的材料，不改变下列第三方文件的许可、作者与商标归属。目录收录和源码可分发不证明远程服务授权或目标宿主兼容性。

## Codex GitHub 原生包

- 来源：[openai/plugins 固定目录](https://github.com/openai/plugins/tree/0722921d5542fc593105c27bd52630babd8b8c2a/plugins/github)，提交 `0722921d5542fc593105c27bd52630babd8b8c2a`，上游包版本 `0.1.12`。
- 原作者：原始 `.codex-plugin/plugin.json` 声明为 OpenAI；GitHub 名称、图标及服务仍归各自权利人。
- 原生文件按字节保留，包括 README、`.app.json`、`.mcp.json`、清单和全部资产；只新增 `provenance.json`。
- 上游包清单声明 `MIT`，但该固定快照的包目录和仓库根未提供 LICENSE 文件。本仓库如实记录这一证据缺口，不把其他插件的 MIT 文本或自造版权声明当作本包原始许可。
- `.mcp.json` 的 OAuth client ID/secret 是上游有意公开的公共客户端资料，README 原文保留；用户 access/refresh token 仍须保密。托管连接和远程服务实现未由本仓库分发。
- [本地逐文件摘要和来源记录](codex-plugins/github/provenance.json)。

## Claude GitHub 原生包

- 来源：[anthropics/claude-plugins-official 固定目录](https://github.com/anthropics/claude-plugins-official/tree/ea10b213686c90bb1984b2016937310e05336cf3/external_plugins/github)，提交 `ea10b213686c90bb1984b2016937310e05336cf3`。
- 包清单原作者为 GitHub，未声明版本；不能用逻辑插件版本代替原生版本。
- 完整保留原始 `.claude-plugin/plugin.json` 与 `.mcp.json`；新增来源记录及该提交仓库根的 [Apache-2.0 LICENSE 原文](claude-plugins/github/LICENSE.upstream)。包目录没有单独 LICENSE；不把远程 GitHub MCP 服务本身的许可等同于这份声明。
- [逐文件摘要和来源记录](claude-plugins/github/provenance.json)。

## 飞书办公与 Lark Suite CLI

- 上游：[larksuite/cli](https://github.com/larksuite/cli/tree/ac81f5056ab88f37d581d25916f3dab85abfca76)，固定提交 `ac81f5056ab88f37d581d25916f3dab85abfca76`，版本 `1.0.98`。
- 署名：Lark Suite CLI contributors；源码版权声明包含 Lark Technologies Pte. Ltd.，按原文件保留。
- 许可：[原始 MIT 声明](neuxally-plugin/feishu-office/LICENSE.larksuite-cli)。完整官方 skills 及其相对引用保持原样，NeuxAlly 自行维护标准清单与声明驱动授权桥接。
- 受管 CLI 构建版本 `1.0.98-neuxally.1`；固定源码归档摘要、Go 工具链、六个平台可执行文件摘要和下载 URL 在 [资产锁](neuxally-plugin/feishu-office/.neuxally/auth/assets.lock.json)。
- [公开隔离补丁](patches/lark-keychain-isolation.patch) 改变钥匙串服务命名空间；[回归源码](patches/lark-keychain-isolation_test.go) 验证同 profile 复用与不同 profile 隔离，与 [macOS 私有目录回归](patches/lark-storage-isolation_darwin_test.go) 在固定源码中运行。macOS 凭据和 DPoP 文件使用私有数据目录；补丁在修改处明确注明职责，未删除上游版权。
- 交付的 CLI 依赖原始许可收集于 [CLI 第三方声明](neuxally-plugin/feishu-office/.neuxally/auth/THIRD_PARTY_NOTICES.cli.txt)，来自实际跨平台 Go 依赖图。个别模块只有 README 的许可/作者声明而无独立 LICENSE，按原文保留并明确标注；同一声明也作为 Release 伴随资源提供。
- [插件来源及包装修改记录](neuxally-plugin/feishu-office/provenance.json)。CLI 二进制只作为 Release 依赖资产发布，不提交源码仓库；使用时按摘要下载至插件私有目录。

## 保留的 GitHub CLI 隔离材料

`patches/` 保留 v1 集成使用的 GitHub CLI 隔离补丁与回归源码，便于追溯历史固定构建。这些文件不表示 v2 原生 GitHub 包使用或分发了该 CLI。

- 上游 [cli/cli](https://github.com/cli/cli/tree/fc4b137cdef0a6bd28fd461b7cf9c84a5812a8cd)，固定提交 `fc4b137cdef0a6bd28fd461b7cf9c84a5812a8cd`，版本 `2.102.0`。
- [原始 MIT 声明](patches/LICENSE.github-cli)、[历史来源记录](patches/github-cli-provenance.json)、[补丁](patches/github-keyring-isolation.patch) 与 [回归源码](patches/github-keyring-isolation_test.go)。

## 收录与更新规则

逐包核对真实来源、完整提交、实际原生结构、作者与可得许可；保留未知项并明确披露。更新必须重新计算完整原生文件摘要并审阅补丁，不能伪造原生来源或把某一包的许可推广到整个上游仓库。OpenAI 与 Claude Code 官方文档是格式依据，不是所有已收录包已在所有宿主通过验收的证据。
