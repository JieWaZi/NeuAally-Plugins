# NeuxAlly Plugins

[English](README.md) | [简体中文](README.zh-CN.md)

Public source repository for NeuxAlly plugin packages, upstream attribution, and catalog metadata.

## Packages

| Package | Purpose | Upstream |
| --- | --- | --- |
| [Feishu Office](plugins/feishu-office/README.md) | Documents, tables, calendars, and tasks | [Lark Suite CLI](https://github.com/larksuite/cli) |
| [GitHub](plugins/github/README.md) | Repository, issue, and pull request workflows | [GitHub MCP Server](https://github.com/github/github-mcp-server) and [GitHub CLI](https://github.com/cli/cli) |

These are the existing NeuxAlly packages recovered from the application's independent Git bundle, including its source history. Their current account setup relies on the NeuxAlly integration. Publishing their sources and catalog does not establish that all capabilities work in another host.

## Formats and discovery

Packages use the existing [Agent Plugins format](https://developers.openai.com/plugins/build/plugins): root `plugin.json`, optional `skills/`, and optional `mcp.json`.

- [.agents/plugins/marketplace.json](.agents/plugins/marketplace.json) is a standard OpenAI marketplace index of the package sources.
- [catalog.json](catalog.json) is the existing NeuxAlly build index, retained for the application's current bundle pipeline.
- Git commits identify source snapshots. Package manifests and provenance files retain the upstream versions and licenses.

The application currently consumes its bundled fixed snapshot. Online catalog refresh, cross-CLI native installation, and plugin-declared authorization are v2 design work and are not delivered by this repository initialization. No Claude Code marketplace is published until the corresponding native packages exist.

## References and attribution

This repository uses [openai/plugins](https://github.com/openai/plugins/tree/main/plugins) as a reference for plugin organization, marketplace discovery, and native package reuse. It also follows the [OpenAI packaging documentation](https://developers.openai.com/plugins/build/plugins) and [Claude Code plugin documentation](https://code.claude.com/docs/en/plugins-reference).

The existing Feishu and GitHub packages were assembled from the upstream projects listed above; they are not represented as copies of the OpenAI examples. Future reuse of third-party plugins must retain each package's actual authorship, license, source revision, and modification records. A repository reference does not replace those declarations.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), the package-local licenses and `provenance.json` files. The GitHub CLI isolation patch and its regression source are included under [patches/](patches/).

## Maintenance

Maintain the complete package tree, including skill references, scripts, assets, and native components. Review upstream changes and licenses before updating fixed revisions. Do not commit user credentials, account profiles, or generated CLI binaries.

The root [MIT license](LICENSE) covers NeuxAlly-authored repository material. Third-party material retains its own license and notices.
