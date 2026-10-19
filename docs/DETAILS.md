# Catalog, read-only details and installation archives

[English](DETAILS.md) | [简体中文](DETAILS.zh-CN.md)

Reading a plugin does not require installing it for a partner or authorizing an account. Discovery, documentation and execution have separate artifacts:

| Artifact | Contents | Used when |
| --- | --- | --- |
| `catalog.json` | Small identity/presentation metadata, verified embedded icon, archive reference and optional details reference | Browse the library |
| `<key>.details.json` | Public metadata, English/Chinese README and raw SKILL.md content | Open details, full documentation or skill text |
| `<key>.zip` | Complete standard package, skill resources/scripts, MCP configuration, bridge, licenses and evidence | Prepare, verify and install execution capabilities |

The builder derives all three from the same fixed Git commit. There is no second maintained capability index. It parses standard SKILL frontmatter with the exact locked `yaml` build dependency, including quoted and multiline descriptions; malformed YAML and duplicate keys fail the build. `npm ci` restores the build dependency from `package-lock.json`; it is not installed in a user's CLI or packaged as an authorization dependency.

## Wire contract

Catalog entries retain `schemaVersion: 2`. Optional `detailsURL`, `detailsSHA256`, `detailsSize` are either all present or all absent. New builds always emit them. The details file is UTF-8 JSON, at most **4 MiB** including the complete serialized content; the size is an exact byte count, not a character count. Clients check its size and SHA-256 before using it. Existing catalogs without these fields may follow the host's compatible full-archive path; invalid declared details must not silently switch to a different snapshot or archive.

The [details schema](../schemas/details.schema.json) defines:

```json
{
  "schemaVersion": 1,
  "sourceCommit": "fixed full source commit",
  "archiveSHA256": "digest of the corresponding complete ZIP",
  "packagePath": "plugins/example",
  "package": {
    "manifest": {}, "format": "codex", "presentation": {}, "upstream": {},
    "skills": [], "servers": [], "diagnostics": []
  },
  "readmes": { "en": "English README bytes as UTF-8 text", "zh-CN": "Chinese README text" },
  "skillContents": { "skills/example": "Exact UTF-8 SKILL.md content" }
}
```

`sourceCommit`, `archiveSHA256` and `packagePath` must exactly match the selected catalog entry, and manifest name/version must match that entry. This binds the public material to the installable snapshot. The internal package version stays `0.1.0`; true capability version/author continue to come directly from [upstream provenance](PROVENANCE.md).

`package` is a read-only subset of the host's public Package shape:

- `manifest`: name/version/description, public author name/email/URL, homepage, repository, license and keywords. Standard execution component declarations and arbitrary extensions are omitted.
- `presentation`: supported display strings, safe public policy/website URLs and English/Chinese localized maps; `icon` is a separate verified data URI.
- `upstream`: the original validated provenance declaration, including its fixed source or hosted-service semantics.
- `skills`: key/name/description/path derived from default and explicitly declared standard skills, without execution digest. Each key is a package-relative skill directory such as `skills/lark-doc`.
- `servers`: key/type and an optional public URL only. Standard `http` is normalized to the existing public API value `streamable-http`. URLs with credentials, query parameters or fragments are omitted. Commands, arguments, environment values and headers are excluded.
- `integration.authentication`: strategy/protocol/preferredAction/scopes only. Bridge command/args, bindings, credentials and unknown fields are excluded. `diagnostics` is an empty array for these validated maintained packages.

README is not repeated in `package`; Core selects `readmes` according to locale and sets its existing public README response. `skillContents` keys exactly match the skill directory keys. Values preserve the original SKILL.md text, including frontmatter and newlines; reference documents, scripts and attachments are not copied into the sidecar. Reading other skill resources requires the host's explicitly supported installed-content path, never an implicit full ZIP download triggered by this read-only contract.

Every source README and SKILL.md must be public, reviewed content with no embedded live secrets. Allowlist projection prevents execution configuration or private bridge bindings from being serialized, but does not make it appropriate to publish a secret in documentation. Each document is bounded to 1 MiB, and the complete details object is bounded to 4 MiB. Current Feishu source has 28 SKILL.md files totaling 316,998 raw bytes; the limit leaves room for JSON encoding, two READMEs, metadata and icon without shipping complete resource trees.

## Release and ownership

Build `<key>.details.json`, complete ZIPs, catalog and checksums from the exact commit referenced by the release tag. Upload full ZIPs and both sidecars before replacing catalog, so the new index references available assets. Continue using `v0.1.0` for the current test release. Existing fixed provider binaries/notices keep their identity and digest; documentation changes do not rebuild or replace them.

The host caches verified public details separately from complete archives. This cache creates no partner installation, authentication session or account record. Installation and authorization remain explicit actions, and execution continues to validate the complete ZIP and standard package rather than trusting this presentation-only subset.
