# 目录、只读资料与安装归档

[English](DETAILS.md) | [简体中文](DETAILS.zh-CN.md)

阅读插件说明不需要先为伙伴安装插件，也不需要授权账号。发现、阅读与执行使用不同产物：

| 产物 | 内容 | 使用时机 |
| --- | --- | --- |
| `catalog.json` | 少量身份与展示资料、核验后内嵌图标、归档及可选侧车引用 | 浏览插件库 |
| `<key>.details.json` | 公开元数据、中英文 README 与原始 SKILL.md | 打开详情、完整说明或技能正文 |
| `<key>.zip` | 完整标准包、技能资料和脚本、MCP 配置、授权桥接、许可与来源 | 准备、校验和安装实际执行能力 |

构建器从同一固定 Git 提交派生三类产物，不额外维护第二份组件清单。标准 SKILL frontmatter 由精确锁版的 `yaml` 构建依赖解析，正确处理引号和多行描述；非法 YAML、重复键会阻止发布。通过 `npm ci` 按 `package-lock.json` 恢复构建依赖，该依赖不安装到用户 CLI，也不是包内授权程序依赖。

## 协议

目录条目继续使用 `schemaVersion: 2`，可选 `detailsURL`、`detailsSHA256`、`detailsSize` 三字段全有或全无，新构建始终生成。侧车采用 UTF-8 JSON，完整序列化结果最多 **4 MiB**；size 是精确字节数，不是字符数。客户端先验证长度及 SHA-256，再读取资料。旧目录缺少三个字段时可保留宿主既有完整归档兼容路径；已声明的侧车校验失败时不得静默切换其他快照或归档。

[侧车 schema](../schemas/details.schema.json) 定义：

```json
{
  "schemaVersion": 1,
  "sourceCommit": "固定完整来源提交",
  "archiveSHA256": "对应完整ZIP的摘要",
  "packagePath": "plugins/example",
  "package": {
    "manifest": {}, "format": "codex", "presentation": {}, "upstream": {},
    "skills": [], "servers": [], "diagnostics": []
  },
  "readmes": { "en": "英文README原始UTF-8文本", "zh-CN": "中文README文本" },
  "skillContents": { "skills/example": "原始完整UTF-8 SKILL.md正文" }
}
```

`sourceCommit`、`archiveSHA256`、`packagePath` 必须与选中的目录条目逐项一致；manifest 的名称和版本也须与目录一致，将公开说明绑定到可安装快照。内部包版本保持 `0.1.0`，实际业务作者及版本继续直接读取[上游来源](PROVENANCE.zh-CN.md)。

`package` 是宿主现有公开 Package 的只读子集：

- `manifest`：名称、版本、描述、作者公开 name/email/URL、主页、仓库、许可与关键词；不包含组件执行声明和任意扩展。
- `presentation`：受支持的展示文字、安全的公开政策／网站地址和中英文翻译；`icon` 独立保存核验后的内嵌数据 URI。
- `upstream`：原始核验后的来源声明，保留固定源码或托管服务语义。
- `skills`：从标准默认及显式技能路径派生 key/name/description/path，不复制执行 digest。key 是 `skills/lark-doc` 这样的包内技能目录。
- `servers`：仅 key/type 与可选公开 URL，标准 `http` 统一映射为现有公开 API 的 `streamable-http`；含账号、查询参数或片段的 URL 不展示，不复制 command、args、env、headers。
- `integration.authentication`：仅 strategy/protocol/preferredAction/scopes，不复制桥接命令、参数、秘密绑定、凭据与未知字段。已核验维护包的 `diagnostics` 为空数组。

README 不在 `package` 中重复保存；Core 按语言选择 `readmes` 并投射到既有公开 README 响应。`skillContents` 的键与技能目录 key 逐项相同，值保留完整 SKILL.md 文本及其 frontmatter、换行，不复制参考资料、脚本与附件。其他技能资源只走宿主明确支持的已安装内容路径，不能因查看只读资料而隐式下载整个 ZIP。

源 README 与 SKILL.md 必须是经审核的公开内容，不允许嵌入真实秘密。白名单投射防止执行配置及桥接私密绑定被序列化，不代表可以把秘密写进公开说明。单文档上限 1 MiB，完整侧车上限 4 MiB。当前飞书有 28 个 SKILL.md，共 316,998 原始字节，为 JSON 转义、两份 README、元数据和图标留有空间，同时不打包完整资源树。

## 发布及职责

以 Release 标签对应的固定提交生成侧车、完整 ZIP、目录与校验文件。先上传完整 ZIP 及两个侧车，再替换目录，使新索引只引用已就绪资产。当前测试发布继续用 `v0.1.0`。既有固定程序二进制和许可保持原资产身份及摘要，文档变更不重构建或替换它们。

宿主将核验后的公开资料缓存与完整安装归档分开。资料缓存不创建伙伴安装、授权会话或账号记录。安装与授权仍是明确操作；执行继续验证完整 ZIP 和标准包，不把这个展示子集当成可执行配置。
