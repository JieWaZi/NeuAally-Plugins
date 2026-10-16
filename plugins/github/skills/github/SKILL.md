---
name: github
description: 使用 GitHub 官方 MCP 与 CLI 查询仓库、Issue、Pull Request 和代码；在用户要求 GitHub 工作时按需使用。
---

# GitHub 操作

本技能由 NeuxAlly contributors 编写，封装 GitHub 官方 MCP 与官方 CLI，并非 GitHub 官方发布的 Skill。

优先使用已经提供的 GitHub MCP 工具，先查询仓库、分支、Issue 或 Pull Request 的当前事实，再执行用户已授权的操作。需要工具组之外的操作或当前智能体不支持远程 MCP 时，使用随应用提供的官方 `gh`，以 `gh <命令> --help` 确认具体参数。尽量使用 `--json` 取得结构化结果。长正文写入临时文件并使用 `--body-file`，不要在 shell 中拼接不可信正文。

## 共享账号

资源库统一拥有登录，运行环境已经指向应用私有配置。不要运行 `gh auth login/logout/switch/setup-git`，不要修改 `GH_CONFIG_DIR` 或 `GH_HOST`，不要读取、输出或复制 `auth token`、`hosts.yml` 和其他 CLI profile。遇到认证失效、权限不足、组织 SSO 或仓库访问被拒绝时保留原始业务错误，并提示用户到资源库的 GitHub 插件详情处理认证或组织授权。

GitHub 设备授权会要求在官方页面输入界面提供的一次性验证码。身份摘要可使用 `gh auth status --hostname github.com --active --json hosts` 查询；不得添加 `--show-token`。

## 操作边界

查询、文件读取和差异分析可以先行。创建 Issue、发布评论、推送提交、创建或更新 Pull Request 等写操作须来自用户当前任务授权。删除仓库、合并 Pull Request、强制推送与修改访问权限必须有对应明确授权。不要把成功提交请求等同于 CI、部署或业务验收通过。
