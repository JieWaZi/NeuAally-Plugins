import { parseDocument } from 'yaml';

export const maxDetailsBytes = 4 * 1024 * 1024;
const maxDocumentBytes = 1024 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(`invalid plugin details: ${message}`); };
const text = value => typeof value === 'string' && value.trim() ? value : undefined;
const pick = (value, keys) => Object.fromEntries(keys.filter(key => text(value?.[key]) !== undefined).map(key => [key, value[key]]));
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string') ? [...value] : [];

// 服务摘要不展示含凭据、查询参数或片段的地址；执行配置仍只保存在安装归档。
function publicURL(value) {
  if (!text(value) || /[\x00-\x20\x7f]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return undefined;
    return value;
  } catch { return undefined; }
}

function relative(value) {
  if (typeof value !== 'string') fail('component path must be a string');
  const result = value.replace(/^\.\//, '').replace(/\/$/, '');
  if (!result || result.includes('\\') || result.includes(':') || /[\x00-\x1f]/.test(result) || result.split('/').some(part => !part || part === '.' || part === '..')) fail('unsafe component path');
  return result;
}

function document(bytes, label) {
  if (!bytes || bytes.length > maxDocumentBytes) fail(`${label} too large or missing`);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail(`${label} is not valid UTF-8`); }
}

function skillMetadata(content, label) {
  const frontmatter = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(content);
  if (!frontmatter) fail(`skill frontmatter missing: ${label}`);
  const parsed = parseDocument(frontmatter[1], { uniqueKeys: true, version: '1.2' });
  if (parsed.errors.length || parsed.warnings.length) fail(`skill YAML invalid: ${label}`);
  let metadata;
  try { metadata = parsed.toJS({ maxAliasCount: 50 }); } catch { fail(`skill YAML aliases invalid: ${label}`); }
  if (!object(metadata) || !text(metadata.name) || !text(metadata.description)) fail(`skill YAML name/description must be strings: ${label}`);
  return { name: metadata.name, description: metadata.description };
}

// 仅从标准清单与实际文件派生只读资料；不复制程序入口、秘密绑定和未知扩展。
export function packageDetails({ sourceCommit, archiveSHA256, packagePath, manifest, presentation, provenance, names, has, read }) {
  for (const value of [provenance.upstream.repository, provenance.upstream.distribution?.url].filter(value => value !== undefined)) if (!publicURL(value)) fail('upstream source URL must be public');
  const manifestInfo = pick(manifest, ['name', 'version', 'description', 'license']);
  manifestInfo.author = pick(manifest.author, ['name', 'email']);
  if (publicURL(manifest.author?.url)) manifestInfo.author.url = manifest.author.url;
  for (const field of ['homepage', 'repository']) if (publicURL(manifest[field])) manifestInfo[field] = manifest[field];
  manifestInfo.keywords = strings(manifest.keywords);
  const display = pick(manifest.interface, ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category']);
  display.displayName ??= manifest.name; display.shortDescription ??= manifest.description;
  for (const field of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL']) if (publicURL(manifest.interface?.[field])) display[field] = manifest.interface[field];
  for (const field of ['displayNames', 'localizedDescriptions']) if (object(presentation[field])) display[field] = pick(presentation[field], ['en', 'zh-CN']);
  const pkg = { manifest: manifestInfo, format: 'codex', presentation: display, upstream: structuredClone(provenance.upstream), skills: [], servers: [], diagnostics: [] };
  if (text(presentation.icon)) pkg.icon = presentation.icon;
  const readmes = {}, skillContents = {};
  for (const [locale, filename] of [['en', 'README.md'], ['zh-CN', 'README.zh-CN.md']]) if (has(`${packagePath}/${filename}`)) readmes[locale] = document(read(`${packagePath}/${filename}`), filename);
  const files = names(); const skillPaths = new Set();
  function discover(value) {
    const root = relative(value);
    if (has(`${packagePath}/${root}/SKILL.md`)) { skillPaths.add(root); return; }
    const prefix = `${packagePath}/${root}/`;
    for (const name of files) if (name.startsWith(prefix) && /^[^/]+\/SKILL\.md$/.test(name.slice(prefix.length))) skillPaths.add(name.slice(packagePath.length + 1, -'/SKILL.md'.length));
  }
  discover('skills');
  if (manifest.skills !== undefined) {
    const declared = typeof manifest.skills === 'string' ? [manifest.skills] : manifest.skills;
    if (!Array.isArray(declared)) fail('invalid declared skills');
    declared.forEach(discover);
  }
  for (const path of [...skillPaths].sort()) {
    const content = document(read(`${packagePath}/${path}/SKILL.md`), `skill ${path}`);
    pkg.skills.push({ key: path, ...skillMetadata(content, path), path }); skillContents[path] = content;
  }
  const servers = new Map(), mcpFiles = new Set();
  function definitions(value) {
    if (!object(value)) fail('MCP definitions must be an object');
    for (const key of Object.keys(value).sort()) {
      const server = value[key]; if (!object(server)) fail('MCP server must be an object');
      let type = text(server.type) ?? (server.url ? 'http' : 'stdio');
      if (type === 'http') type = 'streamable-http';
      if (!['streamable-http', 'sse', 'stdio'].includes(type)) fail('unsupported MCP transport');
      const summary = { key, type };
      if (publicURL(server.url)) summary.url = server.url;
      servers.set(key, summary);
    }
  }
  function mcpFile(value) {
    const filename = `${packagePath}/${relative(value)}`;
    if (mcpFiles.has(filename)) return; mcpFiles.add(filename);
    const raw = JSON.parse(document(read(filename), 'MCP metadata'));
    definitions(raw.mcpServers);
  }
  if (has(`${packagePath}/.mcp.json`)) mcpFile('.mcp.json');
  if (manifest.mcpServers !== undefined) for (const declared of Array.isArray(manifest.mcpServers) ? manifest.mcpServers : [manifest.mcpServers]) {
    if (typeof declared === 'string') mcpFile(declared); else definitions(declared);
  }
  pkg.servers = [...servers.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const integrationPath = `${packagePath}/.neuxally/integration.json`;
  if (has(integrationPath)) {
    const auth = JSON.parse(document(read(integrationPath), 'integration')).authentication;
    if (object(auth)) pkg.integration = { authentication: { ...pick(auth, ['strategy', 'protocol', 'preferredAction']), scopes: strings(auth.scopes) } };
  }
  return { schemaVersion: 1, sourceCommit, archiveSHA256, packagePath, package: pkg, readmes, skillContents };
}

export function encodeDetails(value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  if (bytes.length > maxDetailsBytes) fail('details size exceeds 4 MiB');
  return bytes;
}
