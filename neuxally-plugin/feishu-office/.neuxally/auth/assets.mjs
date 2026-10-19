import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 锁文件属于本插件的固定依赖，下载只接受 HTTPS 与完整摘要，不读取远端 latest。
export async function ensureAsset({ dataDirectory, signal, platform = process.platform, arch = process.arch, lock, fetcher = fetch }) {
  lock ??= JSON.parse(await readFile(new URL('./assets.lock.json', import.meta.url), 'utf8'));
  const asset = lock.schemaVersion === 1 ? lock.assets?.[`${platform}-${arch}`] : undefined;
  if (!asset || !/^[a-f0-9]{64}$/.test(asset.sha256 ?? '') || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 128 * 1024 * 1024) throw new Error('unsupported_asset');
  const url = new URL(asset.url);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid_asset_url');
  const directory = path.join(dataDirectory, 'cache'); await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = path.join(directory, `lark-cli-${asset.sha256}${platform === 'win32' ? '.exe' : ''}`);
  const valid = bytes => bytes.length === asset.size && createHash('sha256').update(bytes).digest('hex') === asset.sha256;
  try { if (valid(await readFile(destination))) { await chmod(destination, 0o755); return destination; } } catch { /* 缓存不存在或损坏时，从同一固定来源重新下载。 */ }
  const response = await fetcher(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000), redirect: 'follow' });
  if (!response.ok || !response.body || (response.url && new URL(response.url).protocol !== 'https:')) throw new Error('asset_download_failed');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > asset.size) { await response.body.cancel().catch(() => {}); throw new Error('asset_size_mismatch'); } chunks.push(chunk); }
  const bytes = Buffer.concat(chunks); if (!valid(bytes)) throw new Error('asset_digest_mismatch');
  const temporary = path.join(directory, `.download-${randomUUID()}`);
  try { await writeFile(temporary, bytes, { flag: 'wx', mode: 0o755 }); await rename(temporary, destination); } finally { await rm(temporary, { force: true }); }
  return destination;
}
