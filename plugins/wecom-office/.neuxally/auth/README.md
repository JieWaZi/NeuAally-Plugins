# 企业微信授权桥接

`authorize.mjs` 实现 `neuxally-auth/1`，用固定版本官方 `wecom-cli` 创建二维码并验证企业微信机器人身份。它不安装用户全局 CLI，不调用第三方 MCP，也不复制官方 token。

`auth/start` 每次新会话执行 `wecom-cli auth init --noninteractive --no-browser --output-qrcode <临时文件>`。官方命令输出的 `page_url` 只作为 `open-url`；二维码取自官方生成的 PNG，以受限 `data:image/png;base64,...` 交给 `show-qr`。PNG 限制为普通文件、128 KiB、1024 像素以内，拒绝符号链接、错误文件头与不完整文件尾。五分钟是本地等待上限，声明为 `deadlineAt`，不伪称服务端二维码的 `expiresAt`。

桥接的 PNG 检查是受限文件读取与头尾预检，不实现完整图片解码。宿主 Core 在接纳挑战时负责完整 PNG 解码，包括块 CRC、压缩内容与像素合法性；未通过宿主校验的图片不能作为有效挑战展示。

官方扫码进程正常退出后，桥接依次执行 `auth show --status`、`auth show` 和联网 `identity whoami`。前两个命令只读取本地状态；账号稳定标识来自官方输出的唯一 `Bot ID:` 行。`whoami` 的工具结构由服务端下发，因此桥接只验证非空 JSON 对象与错误状态，不假设其中的姓名或身份字段，不把返回正文交给宿主。显示名为「企业微信机器人」。企业微信业务权限由上游控制，插件不将一次扫码描述为取得全部业务权限。

`WECOM_CLI_CONFIG_DIR` 固定在宿主分配的数据目录下的 `profile`。桥接清空继承的 `WECOM_CLI_*` 环境覆盖，技能通过私密 `auth/resolve` 获得受管 `PATH` 与同一个 profile。仅允许包内真实存在的 `skills/wecomcli-*` 目录，不绑定外部 MCP 或符号链接目标。

profile 权限为 `0700`，预置随机 `.encryption_key` 权限为 `0600`，已有密钥不覆盖。官方 CLI 使用该文件优先读取密钥，保存时仍可能同步系统 keyring；其 keyring 用户名包含规范化配置目录的 SHA-256，隔离不同 profile。凭据与 token 始终由官方 CLI 的 `credentials.enc` 管理。

取消、stdin EOF 和进程结束信号会等待真实 CLI 退出，必要时升级为强制终止，再删除二维码临时目录。重扫失败不会凭旧凭据发布本次授权成功。`auth/logout` 只删除本插件 profile；它不声称撤销企业微信远端授权，也不修改其他 CLI 的配置。需要撤销远端授权时应在企业微信管理界面处理。

已核对官方发布源码 [f9b28151dc8d42f703db624fc9b26723c3c93fc5](https://github.com/WecomTeam/wecom-cli/tree/f9b28151dc8d42f703db624fc9b26723c3c93fc5)，npm `@wecom/cli@1.3.4` 对应 `--version` 构建标识 `f9b2815`。授权实现见上游 [auth.rs](https://github.com/WecomTeam/wecom-cli/blob/f9b28151dc8d42f703db624fc9b26723c3c93fc5/crates/wecom-cli/src/cmd/auth.rs)，凭据隔离见 [keystore.rs](https://github.com/WecomTeam/wecom-cli/blob/f9b28151dc8d42f703db624fc9b26723c3c93fc5/crates/wecom-cli/src/auth/crypto/keystore.rs)。

定向验证：`node --test scripts/test/wecom-auth-bridge.test.mjs`。测试替代外部 CLI，覆盖二维码交付、线上验证失败、稳定身份、覆盖环境隔离、重新扫码、取消与 EOF 清理，以及组件绑定范围；不代表真实企业账号扫码和业务权限验收。
