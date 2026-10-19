import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { materializeNativeSource, safeSourcePath } from './native-source.mjs';

// 登记只读取固定上游 HTTP 对象，许可与作者由维护者审阅后保留，不生成原生源码副本。
const [directory, repository, commit, packagePath] = process.argv.slice(2);
const match = /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)$/.exec(repository ?? '');
if (!directory || !match || !/^[a-f0-9]{40}$/.test(commit ?? '') || !safeSourcePath(packagePath)) throw new Error('usage: lock-native-source.mjs DIRECTORY HTTPS_GITHUB_REPOSITORY FULL_COMMIT PACKAGE_PATH');
const response = await fetch(`https://api.github.com/repos/${match[1]}/git/trees/${commit}?recursive=1`, { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/vnd.github+json' } });
if (!response.ok) throw new Error('upstream tree HTTP failed');
const tree = await response.json(); if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('incomplete upstream tree');
const packageTree = tree.tree.find(entry => entry.path === packagePath && entry.type === 'tree');
if (!packageTree) throw new Error('upstream package tree missing');
const files = [], contents = new Map();
for (const entry of tree.tree.filter(entry => entry.path.startsWith(`${packagePath}/`) && entry.type !== 'tree').sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)))) {
  const relative = entry.path.slice(packagePath.length + 1);
  if (entry.type !== 'blob' || !safeSourcePath(relative) || !['100644', '100755'].includes(entry.mode) || entry.size > 64 * 1024 * 1024) throw new Error('unsafe upstream path or file mode');
  const url = `https://raw.githubusercontent.com/${match[1]}/${commit}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
  const downloaded = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (!downloaded.ok) throw new Error('upstream file HTTP failed');
  const content = Buffer.from(await downloaded.arrayBuffer()); if (content.length > 64 * 1024 * 1024) throw new Error('upstream content limit');
  files.push({ path: relative, mode: entry.mode, sha256: createHash('sha256').update(content).digest('hex') }); contents.set(url, content);
}
let previous = {}; try { previous = JSON.parse(await readFile(path.join(directory, 'source.json'), 'utf8')); } catch { /* 首次登记的作者和许可需维护者另行审阅填写。 */ }
const source = { repository, commit, path: packagePath, treeSHA: packageTree.sha, ...(previous.author ? { author: previous.author } : {}), ...(previous.license ? { license: previous.license } : {}), files };
await materializeNativeSource({ source, cacheDirectory: '.cache/native', fetcher: async url => new Response(contents.get(String(url))) });
await mkdir(directory, { recursive: true }); const temporary = path.join(directory, `.source-${randomUUID()}`);
try { await writeFile(temporary, `${JSON.stringify(source, null, 2)}\n`, { flag: 'wx' }); await rename(temporary, path.join(directory, 'source.json')); } finally { await rm(temporary, { force: true }); }
console.log(`Locked ${files.length} complete files at ${commit}:${packagePath}`);
