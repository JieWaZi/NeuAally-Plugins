import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const safeSourcePath = value => typeof value === 'string' && value.length > 0 && !/[\\:\x00-\x1f\x7f]/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..' && part !== '.git');
const gitObject = (type, bytes) => createHash('sha1').update(Buffer.from(`${type} ${bytes.length}\0`)).update(bytes).digest();

// 按 Git 自身的树编码核对完整文件集合、层级和模式，缺失文件或执行位变化都会改变摘要。
function treeDigest(files) {
  const root = new Map();
  for (const file of files) {
    let directory = root; const parts = file.path.split('/'); const name = parts.pop();
    for (const part of parts) { if (!directory.has(part)) directory.set(part, new Map()); if (!(directory.get(part) instanceof Map)) throw new Error('native path conflict'); directory = directory.get(part); }
    if (directory.has(name)) throw new Error('native duplicate path'); directory.set(name, file);
  }
  const encode = directory => {
    const entries = [...directory].sort(([a, av], [b, bv]) => Buffer.compare(Buffer.from(a + (av instanceof Map ? '/' : '')), Buffer.from(b + (bv instanceof Map ? '/' : ''))));
    return gitObject('tree', Buffer.concat(entries.map(([name, value]) => Buffer.concat([Buffer.from(`${value instanceof Map ? '40000' : value.mode} ${name}\0`), value instanceof Map ? encode(value) : gitObject('blob', value.content)]))));
  };
  return encode(root).toString('hex');
}

export async function materializeNativeSource({ source, cacheDirectory, fetcher = fetch }) {
  const match = /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)$/.exec(source.repository ?? '');
  if (!match || !/^[a-f0-9]{40}$/.test(source.commit ?? '') || !/^[a-f0-9]{40}$/.test(source.treeSHA ?? '') || !safeSourcePath(source.path) || !Array.isArray(source.files) || !source.files.length) throw new Error('invalid native source path or identity');
  const seen = new Set();
  for (const file of source.files) {
    if (!safeSourcePath(file.path)) throw new Error('unsafe native file path');
    if (!['100644', '100755'].includes(file.mode)) throw new Error('unsafe native file mode');
    if (seen.has(file.path)) throw new Error('native duplicate path'); seen.add(file.path);
    if (!/^[a-f0-9]{64}$/.test(file.sha256 ?? '')) throw new Error('invalid native digest');
  }
  const result = [];
  for (const file of source.files) {
    const cached = path.join(cacheDirectory, file.sha256); let content;
    try { if ((await lstat(cached)).isFile()) { const bytes = await readFile(cached); if (hash(bytes) === file.sha256) content = bytes; } } catch { /* 已核验内容缓存不存在或损坏时重取固定来源。 */ }
    if (!content) {
      const relative = `${source.path}/${file.path}`.split('/').map(encodeURIComponent).join('/');
      const url = `https://raw.githubusercontent.com/${match[1]}/${source.commit}/${relative}`;
      const response = await fetcher(url, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
      if (!response.ok || !response.body || (response.url && new URL(response.url).protocol !== 'https:')) throw new Error('native HTTP download failed');
      const chunks = []; let length = 0;
      for await (const chunk of response.body) { length += chunk.length; if (length > 64 * 1024 * 1024) throw new Error('native content limit'); chunks.push(chunk); }
      content = Buffer.concat(chunks); if (hash(content) !== file.sha256) throw new Error('native digest mismatch');
      await mkdir(cacheDirectory, { recursive: true, mode: 0o700 }); const temporary = path.join(cacheDirectory, `.download-${randomUUID()}`);
      try { await writeFile(temporary, content, { flag: 'wx', mode: 0o600 }); await rename(temporary, cached); } finally { await rm(temporary, { force: true }); }
    }
    result.push({ path: file.path, mode: file.mode, content });
  }
  if (treeDigest(result) !== source.treeSHA) throw new Error('native complete tree digest mismatch');
  return result;
}
