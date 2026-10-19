# 飞书办公

协助编写飞书文档、管理多维表格、安排日程和跟进任务。技能来自固定版本的官方 [Lark Suite CLI](https://github.com/larksuite/cli/tree/ac81f5056ab88f37d581d25916f3dab85abfca76/skills)，相对资料与引用保持完整。

这是独立维护的自有 Codex 标准包，没有另行维护 Claude 实现。Codex 可直接消费原生内容；其他目标由宿主按能力派生或投影 Skills。具体目标能否加载仍须运行验证。

在支持 `neuxally-auth/1` 的宿主中，插件的 [授权桥接](.neuxally/auth/README.md) 会先扫码创建飞书应用，再扫码授权用户，最后调用官方 CLI 核验身份与范围。首次使用按固定摘要下载本插件的隔离 CLI 依赖；下载失败或平台不支持时返回未就绪。需要联网并由用户完成真实授权。

私有配置和加密凭据位于宿主分配的数据目录，钥匙串/注册表服务按 profile 摘要隔离。业务执行只使用获准组件的受管环境；不要在聊天中运行 `config init`、`auth login`、`auth logout` 或更改身份目录。共享账号的授权、退出和最后引用清理由宿主管理。

上游版本为 `1.0.98`，受管 CLI 版本为 `1.0.98-neuxally.1`，逻辑插件版本为 `2.0.1`。这些版本分别表示技能来源、隔离构建和逻辑入口。固定资产与源码补丁见 [.neuxally/auth/assets.lock.json](.neuxally/auth/assets.lock.json)、[provenance.json](provenance.json) 与 [第三方声明](../../THIRD_PARTY_NOTICES.md)。自动化协议测试使用隔离外部边界，未执行真实飞书账号验收。
