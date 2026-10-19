# 第三方来源与许可

## 飞书办公

- 上游：[larksuite/cli](https://github.com/larksuite/cli)，固定提交 `ac81f5056ab88f37d581d25916f3dab85abfca76`。
- 署名：Lark Suite CLI contributors。
- 许可：[包内 MIT 声明](plugins/feishu-office/LICENSE.larksuite-cli)。
- [来源及包装修改记录](plugins/feishu-office/provenance.json)；官方技能目录及其相对引用保持完整。

## GitHub

- 业务工具来自 [github/github-mcp-server](https://github.com/github/github-mcp-server) 对应的 GitHub 官方远程服务；本仓库不分发或固定该远程服务的运行实现。
- 当前 NeuxAlly 授权集成使用 [cli/cli](https://github.com/cli/cli)，固定提交 `fc4b137cdef0a6bd28fd461b7cf9c84a5812a8cd`，版本 `2.102.0`。
- 许可：[GitHub CLI MIT 声明](plugins/github/LICENSE.github-cli)。
- [来源记录](plugins/github/provenance.json) 保存 NeuxAlly 包装维护者、隔离构建与补丁摘要。
- 本仓库提供对应 [钥匙串隔离补丁](patches/github-keyring-isolation.patch) 和 [回归源码](patches/github-keyring-isolation_test.go)。实际构建与程序资产由 NeuxAlly 应用构建链交付。

## OpenAI 与 Claude Code 参考

[openai/plugins](https://github.com/openai/plugins/tree/main/plugins)、[OpenAI 插件文档](https://developers.openai.com/plugins/build/plugins) 和 [Claude Code 插件文档](https://code.claude.com/docs/en/plugins-reference) 用于插件结构、目录与原生复用设计参考。本次公开初始化未复制 openai/plugins 的插件正文或资产。

后续实际引入的每份第三方文件需继续保留其自身许可、作者和来源记录；不将其他项目中某个插件的许可推广到整个来源仓库。
