# Maintaining plugin presentation

[English](MAINTAINING.md) | [简体中文](MAINTAINING.zh-CN.md)

The repository [development guide](../README.md) owns source registration, native routing, authorization architecture and release builds. Plugin READMEs describe only the plugin’s native capabilities, access requirements and practical uses. Do not include host roles such as partners, NeuxAlly installation steps, chat prompts or “try asking” instructions. Keep vendor details, source versions, compatibility decisions, validation limits and maintenance instructions in the development guide or [third-party notices](../THIRD_PARTY_NOTICES.md).

## Standard manifest and localized presentation

Maintain each own package's `.codex-plugin/plugin.json` in English. Keep identity and version there; set the supported `interface.displayName`, `shortDescription`, `developerName`, `logo` and `composerIcon` fields. Use the public developer name `NeuxAlly` while preserving truthful original authorship and licenses. Visual paths are package-relative `./assets/` paths, as described in the [official packaging documentation](https://developers.openai.com/plugins/build/plugins).

Use `README.md` for English and `README.zh-CN.md` for Simplified Chinese, with language-switch links. The host selects the corresponding document and falls back to English when a translation is absent.

The optional package-local `.neuxally/presentation.json` contains only translated display text:

```json
{
  "displayNames": { "en": "Feishu Office", "zh-CN": "飞书办公" },
  "localizedDescriptions": {
    "en": "Write documents and follow up on tasks.",
    "zh-CN": "编写文档并跟进任务。"
  }
}
```

Only `en` and `zh-CN` are accepted, each nonempty value is limited to 4 KiB of UTF-8, and control characters are rejected. The file is bounded to 20 KiB. It does not declare identity, components, behavior or arbitrary README paths. Keep English translations consistent with the standard manifest, and keep business meaning equivalent across languages.

## Catalog icons and complete packages

The release builder derives optional `displayNames` and `localizedDescriptions` from that file, and `icon` from the standard manifest's `interface.logo` (or `composerIcon` when logo is absent). Catalog identity remains `key`/`name`; the default description remains English. These display fields do not change `schemaVersion: 2` or install paths.

For release icons, use a static noninterlaced 8-bit PNG under `./assets/`, at most 128 KiB and 2048×2048 pixels. The builder validates the signature, chunk checksums, dimensions, compressed pixels and scanline filters before emitting a canonical `data:image/png;base64,...` URI. It rejects external URLs, unsafe paths, symlinks, SVG and malformed or oversized data. The host also validates catalog icons before presenting them; its broader supported image set does not expand the release policy.

Catalog discovery needs no package download or external icon request. The complete ZIP retains the PNG, localized presentation file and both READMEs. All are read from the fixed source commit; dirty workspace files cannot alter that release. Rebuild and verify with `npm test` and `node scripts/build-catalog.mjs HEAD v0.1.1` after committing the reviewed changes.

## Existing integrations

GitHub's own logical entry references the fixed OpenAI and Claude native packages. Their versions and authentication models remain separate: OpenAI retains managed app/public OAuth declarations; Claude uses protected `GITHUB_PERSONAL_ACCESS_TOKEN` configuration. The own English manifest and localized presentation describe the same user capability without rewriting either upstream manifest.

Feishu Office keeps complete official skills and relative resources. Its package-owned bridge handles successive authorization challenges, verifies identity/scopes, and supplies approved private component bindings. The host owns account/session lifecycle and secret storage. Execution must not bypass that lifecycle with chat-issued CLI login/configuration commands. The fixed isolated CLI and provider versions are recorded in the [asset lock](../neuxally-plugin/feishu-office/.neuxally/auth/assets.lock.json) and [bridge guide](../neuxally-plugin/feishu-office/.neuxally/auth/README.md), independently of the own plugin version.

Publication, CLI schema validation and automated tests do not constitute real account, platform, native runtime or UI acceptance. Record those boundaries in implementation/release reports, rather than inserting internal validation disclaimers into business README content. Preserve brand attribution and actual license gaps in the third-party notices.
