import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'native-http-')); t.after(() => rm(root, { recursive: true, force: true }));
  const upstream = path.join(root, 'upstream'); await mkdir(path.join(upstream, '.codex-plugin'), { recursive: true });
  const contents = new Map([['.codex-plugin/plugin.json', Buffer.from('{"name":"native-example","version":"0.1.0"}\n')], ['bin/tool', Buffer.from('#!/bin/sh\necho native\n')]]);
  const files = [];
  for (const [name, bytes] of contents) { const file = path.join(upstream, name); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes); const mode = name === 'bin/tool' ? '100755' : '100644'; await chmod(file, parseInt(mode.slice(-3), 8)); files.push({ path: name, mode, sha256: createHash('sha256').update(bytes).digest('hex') }); }
  execFileSync('git', ['init', '-q', upstream]); execFileSync('git', ['-C', upstream, 'add', '.']);
  // 预期完整树由 Git 本身独立生成，不能复用被测实现的树算法。
  const treeSHA = execFileSync('git', ['-C', upstream, 'write-tree'], { encoding: 'utf8' }).trim();
  const source = { repository: 'https://github.com/example/native', commit: 'a'.repeat(40), path: 'plugins/example', treeSHA, files };
  const fetched = [];
  const fetcher = async url => { const relative = decodeURIComponent(String(url).split('/plugins/example/')[1]); fetched.push(relative); const bytes = contents.get(relative); return bytes ? new Response(bytes) : new Response('', { status: 404 }); };
  return { root, source, contents, fetched, fetcher };
}

test('HTTP 还原完整锁定原生树及执行位，离线复用缓存并识别损坏缓存', async t => {
  const f = await fixture(t); const { materializeNativeSource } = await import('../native-source.mjs');
  const options = { source: f.source, cacheDirectory: path.join(f.root, 'cache'), fetcher: f.fetcher };
  const result = await materializeNativeSource(options);
  assert.deepEqual(result.map(file => file.path).sort(), ['.codex-plugin/plugin.json', 'bin/tool']);
  assert.equal(result.find(file => file.path === 'bin/tool').mode, '100755');
  assert.deepEqual(result.find(file => file.path === 'bin/tool').content, f.contents.get('bin/tool'));
  const offline = await materializeNativeSource({ ...options, fetcher: async () => { throw new Error('offline'); } });
  assert.deepEqual(offline, result);
  const cached = path.join(options.cacheDirectory, f.source.files[0].sha256); await writeFile(cached, 'corrupt');
  const repaired = await materializeNativeSource(options); assert.deepEqual(repaired, result); assert.equal(f.fetched.length, 3);
});

for (const change of ['traversal', 'symlink', 'duplicate', 'missing', 'mode', 'digest', 'interrupted']) {
  test(`拒绝不完整、越界或损坏的 HTTP 原生来源：${change}`, async t => {
    const f = await fixture(t); const { materializeNativeSource } = await import('../native-source.mjs');
    const source = structuredClone(f.source); let fetcher = f.fetcher;
    if (change === 'traversal') source.files[0].path = '../outside';
    if (change === 'symlink') source.files[0].mode = '120000';
    if (change === 'duplicate') source.files.push(source.files[0]);
    if (change === 'missing') source.files.pop();
    if (change === 'mode') source.files[1].mode = '100644';
    if (change === 'digest') fetcher = async () => new Response('wrong');
    if (change === 'interrupted') fetcher = async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.error(new Error('interrupted')); } }));
    await assert.rejects(materializeNativeSource({ source, cacheDirectory: path.join(f.root, 'cache'), fetcher }), /path|mode|duplicate|tree|digest|interrupted/i);
    const cached = await readdir(path.join(f.root, 'cache')).catch(() => []); assert.ok(cached.every(name => /^[a-f0-9]{64}$/.test(name)));
  });
}
