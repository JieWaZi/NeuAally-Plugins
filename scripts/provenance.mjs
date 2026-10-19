import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const schema = JSON.parse(readFileSync(new URL('../schemas/provenance.schema.json', import.meta.url), 'utf8'));
const fail = message => { throw new Error(`invalid provenance: ${message}`); };

// 仅解释本仓库 schema 使用的基础关键字；增加关键字时同步扩充验证器与回归。
function validateShape(value, rule, location) {
  if (rule === false) fail(`${location} must not be declared for this distribution mode`);
  if (rule === true) return;
  const matches = rule.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : rule.type === 'array' ? Array.isArray(value)
    : rule.type === 'integer' ? Number.isInteger(value) : typeof value === rule.type;
  if (rule.type && !matches) fail(`${location} must be ${rule.type}`);
  if (rule.enum && !rule.enum.includes(value)) fail(`${location} is unsupported`);
  if (rule.type === 'string' && (/[\x00-\x1f\x7f]/.test(value) || value.length < (rule.minLength ?? 0) || (rule.pattern && !new RegExp(rule.pattern).test(value)))) fail(`${location} is invalid`);
  if (rule.type === 'array') {
    if (value.length < (rule.minItems ?? 0)) fail(`${location} is empty`);
    value.forEach((entry, index) => validateShape(entry, rule.items, `${location}[${index}]`));
  }
  if (rule.type === 'object') {
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) fail(`${location}.${key} is required`);
    for (const [key, entry] of Object.entries(value)) {
      const child = rule.properties?.[key];
      if (child === undefined) { if (rule.additionalProperties === false) fail(`${location}.${key} is unsupported`); continue; }
      validateShape(entry, child, `${location}.${key}`);
    }
  }
  for (const constraint of rule.allOf ?? []) validateShape(value, constraint, location);
  if (rule.if) {
    let applies = true;
    try { validateShape(value, rule.if, location); } catch { applies = false; }
    if (applies && rule.then) validateShape(value, rule.then, location);
  }
}

export function validateProvenance({ data, packagePath, manifest, read }) {
  validateShape(data, schema, 'provenance');
  if (manifest.author?.name && manifest.author.name !== data.wrapper.maintainer) fail('wrapper maintainer differs from manifest author');
  if (manifest.license && manifest.license !== data.wrapper.license) fail('wrapper license differs from manifest license');
  const assets = new Set();
  for (const asset of data.assets) {
    if (assets.has(asset.path)) fail('duplicate asset path');
    assets.add(asset.path);
    if (createHash('sha256').update(read(`${packagePath}/${asset.path}`)).digest('hex') !== asset.sha256) fail(`asset sha256 digest mismatch: ${asset.path}`);
  }
  for (const reference of [manifest.interface?.logo, manifest.interface?.composerIcon].filter(Boolean)) {
    if (!reference.startsWith('./assets/') || !assets.has(reference.slice(2))) fail(`manifest icon lacks local asset provenance: ${reference}`);
  }
  const dependencies = new Set();
  for (const dependency of data.dependencies) {
    if (dependencies.has(dependency.name)) fail('duplicate dependency name');
    dependencies.add(dependency.name);
    const lock = JSON.parse(read(`${packagePath}/${dependency.lock}`));
    if (lock.version !== dependency.version || lock.source?.repository !== dependency.repository || lock.source?.commit !== dependency.commit) fail(`dependency lock source or version mismatch: ${dependency.name}`);
  }
  return data;
}
