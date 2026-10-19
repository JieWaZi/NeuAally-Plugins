import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, chmod, symlink, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'plugin-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (name, value) => { await mkdir(path.dirname(path.join(root, name)), { recursive: true }); await writeFile(path.join(root, name), typeof value === 'string' ? value : JSON.stringify(value)); };
  await put('neuxally-plugin/example/.codex-plugin/plugin.json', { name: 'example', version: '2.0.0', description: '示例' });
  await put('neuxally-plugin/example/.neuxally/integration.json', { nativePlugins: { codex: { path: 'codex-plugins/example' } } });
  await put('codex-plugins/example/.codex-plugin/plugin.json', { name: 'native-example', version: '0.1.0' });
  await put('codex-plugins/example/assets/reference.txt', 'keep complete upstream files\n');
  await put('neuxally-plugin/example/.neuxally/auth/authorize', '#!/bin/sh\nexit 0\n');
  await chmod(path.join(root, 'neuxally-plugin/example/.neuxally/auth/authorize'), 0o755);
  await put('LICENSE', 'fixture license');
  await put('THIRD_PARTY_NOTICES.md', 'fixture notices');
  execFileSync('git', ['init', '-q', root]);
  const commit = () => { execFileSync('git', ['-C', root, 'add', '.']); execFileSync('git', ['-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture']); return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); };
  return { root, put, commit };
}

// 破坏固定快照、完整引用、ZIP 元信息或摘要均应使此真实构建测试失败。
test('构建固定提交的完整可重现 ZIP，记录摘要并保留执行位', async t => {
  const f = await fixture(t); const sourceCommit = f.commit();
  const { buildCatalog } = await import('../build-catalog.mjs');
  const out = path.join(f.root, 'out');
  await mkdir(path.join(out, 'providers'), { recursive: true });
  await writeFile(path.join(out, 'providers/lark-cli'), 'fixed dependency');
  const catalog = await buildCatalog({ root: f.root, out, sourceCommit, tag: 'v2.0.0' });
  assert.equal(await readFile(path.join(out, 'providers/lark-cli'), 'utf8'), 'fixed dependency');
  const archive = await readFile(path.join(out, 'example.zip'));
  assert.equal(catalog.schemaVersion, 2);
  assert.equal(catalog.entries.length, 1);
  assert.equal(catalog.entries[0].sourceCommit, sourceCommit);
  assert.equal(catalog.entries[0].archiveURL, 'https://github.com/JieWaZi/NeuAally-Plugins/releases/download/v2.0.0/example.zip');
  assert.equal(catalog.entries[0].packagePath, 'neuxally-plugin/example');
  assert.equal(catalog.entries[0].archiveSHA256, createHash('sha256').update(archive).digest('hex'));
  const server = createServer(async (request, response) => { try { response.end(await readFile(path.join(out, path.basename(request.url)))); } catch { response.writeHead(404).end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const downloadedCatalog = await (await fetch(`${origin}/catalog.json`)).json();
  const downloadedZIP = Buffer.from(await (await fetch(`${origin}${new URL(downloadedCatalog.entries[0].archiveURL).pathname}`)).arrayBuffer());
  assert.equal(createHash('sha256').update(downloadedZIP).digest('hex'), downloadedCatalog.entries[0].archiveSHA256);
  assert.deepEqual(downloadedZIP, archive);
  await f.put('codex-plugins/example/assets/reference.txt', 'dirty tree must never enter snapshot');
  await buildCatalog({ root: f.root, out, sourceCommit, tag: 'v2.0.0' });
  assert.deepEqual(await readFile(path.join(out, 'example.zip')), archive);
  const unpack = path.join(f.root, 'unpack'); await mkdir(unpack);
  execFileSync('unzip', ['-q', path.join(out, 'example.zip'), '-d', unpack]);
  assert.equal(await readFile(path.join(unpack, 'codex-plugins/example/assets/reference.txt'), 'utf8'), 'keep complete upstream files\n');
  const { stat } = await import('node:fs/promises');
  assert.equal((await stat(path.join(unpack, 'neuxally-plugin/example/.neuxally/auth/authorize'))).mode & 0o777, 0o755);
});

for (const reference of ['../outside', '/etc/passwd', 'codex-plugins/../outside', 'codex-plugins/missing', 'codex-plugins\\example']) {
  test(`拒绝越界或缺失原生引用 ${reference}，不发布半成品`, async t => {
    const f = await fixture(t);
    await f.put('neuxally-plugin/example/.neuxally/integration.json', { nativePlugins: { codex: { path: reference } } });
    const sourceCommit = f.commit(); const out = path.join(f.root, 'out');
    const { buildCatalog } = await import('../build-catalog.mjs');
    await assert.rejects(buildCatalog({ root: f.root, out, sourceCommit, tag: 'v2.0.0' }), /reference|path|manifest/i);
    assert.deepEqual(await readdir(out).catch(() => []), []);
  });
}

test('拒绝引用树中的符号链接，即使其看似指向包内', async t => {
  const f = await fixture(t); await symlink('reference.txt', path.join(f.root, 'codex-plugins/example/assets/link'));
  const sourceCommit = f.commit();
  const { buildCatalog } = await import('../build-catalog.mjs');
  await assert.rejects(buildCatalog({ root: f.root, out: path.join(f.root, 'out'), sourceCommit, tag: 'v2.0.0' }), /symbolic|mode/i);
});

test('仅来源描述经 HTTP 构建完整原生 ZIP 和索引；离线重建一致，失败保留旧产物', async t => {
  const f = await fixture(t); const initial = f.commit();
  const nativeTree = execFileSync('git', ['-C', f.root, 'rev-parse', `${initial}:codex-plugins/example`], { encoding: 'utf8' }).trim();
  const content = new Map([['.codex-plugin/plugin.json', await readFile(path.join(f.root, 'codex-plugins/example/.codex-plugin/plugin.json'))], ['assets/reference.txt', Buffer.from('keep complete upstream files\n')]]);
  const source = { repository: 'https://github.com/example/native', commit: 'b'.repeat(40), path: 'plugins/example', treeSHA: nativeTree, files: [...content].map(([name, bytes]) => ({ path: name, mode: '100644', sha256: createHash('sha256').update(bytes).digest('hex') })) };
  await rm(path.join(f.root, 'codex-plugins/example'), { recursive: true }); await f.put('codex-plugins/example/source.json', source);
  const sourceCommit = f.commit(); const out = path.join(f.root, 'out'); const { buildCatalog } = await import('../build-catalog.mjs');
  const fetcher = async url => new Response(content.get(String(url).split('/plugins/example/')[1]));
  const catalog = await buildCatalog({ root: f.root, out, sourceCommit, fetcher });
  assert.match(catalog.entries[0].archiveURL, /\/v2\.0\.1\/example\.zip$/);
  const archive = await readFile(path.join(out, 'example.zip'));
  const unpack = path.join(f.root, 'unpack-http'); await mkdir(unpack); execFileSync('unzip', ['-q', path.join(out, 'example.zip'), '-d', unpack]);
  assert.deepEqual(await readFile(path.join(unpack, 'codex-plugins/example/.codex-plugin/plugin.json')), content.get('.codex-plugin/plugin.json'));
  const index = JSON.parse(await readFile(path.join(unpack, '.agents/plugins/marketplace.json'), 'utf8'));
  assert.equal(index.plugins[0].source.path, './codex-plugins/example');
  assert.equal(index.plugins[0].name, 'native-example');
  await buildCatalog({ root: f.root, out, sourceCommit, fetcher: async () => { throw new Error('offline'); } });
  assert.deepEqual(await readFile(path.join(out, 'example.zip')), archive);
  source.files[0].sha256 = '0'.repeat(64); await f.put('codex-plugins/example/source.json', source); const brokenCommit = f.commit();
  await assert.rejects(buildCatalog({ root: f.root, out, sourceCommit: brokenCommit, fetcher }), /digest/);
  assert.deepEqual(await readFile(path.join(out, 'example.zip')), archive);
  assert.equal(JSON.parse(await readFile(path.join(out, 'catalog.json'), 'utf8')).entries[0].sourceCommit, sourceCommit);
});
