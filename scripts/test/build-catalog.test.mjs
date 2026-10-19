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
  const put = async (name, value) => { await mkdir(path.dirname(path.join(root, name)), { recursive: true }); await writeFile(path.join(root, name), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)); };
  await put('neuxally-plugin/example/.codex-plugin/plugin.json', { name: 'example', version: '0.1.0', description: '示例' });
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
  const catalog = await buildCatalog({ root: f.root, out, sourceCommit, tag: 'v0.1.0' });
  assert.equal(await readFile(path.join(out, 'providers/lark-cli'), 'utf8'), 'fixed dependency');
  const archive = await readFile(path.join(out, 'example.zip'));
  assert.equal(catalog.schemaVersion, 2);
  assert.equal(catalog.entries.length, 1);
  assert.equal(catalog.entries[0].sourceCommit, sourceCommit);
  assert.equal(catalog.entries[0].archiveURL, 'https://github.com/JieWaZi/NeuAally-Plugins/releases/download/v0.1.0/example.zip');
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
  await buildCatalog({ root: f.root, out, sourceCommit, tag: 'v0.1.0' });
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
    await assert.rejects(buildCatalog({ root: f.root, out, sourceCommit, tag: 'v0.1.0' }), /reference|path|manifest/i);
    assert.deepEqual(await readdir(out).catch(() => []), []);
  });
}

test('拒绝引用树中的符号链接，即使其看似指向包内', async t => {
  const f = await fixture(t); await symlink('reference.txt', path.join(f.root, 'codex-plugins/example/assets/link'));
  const sourceCommit = f.commit();
  const { buildCatalog } = await import('../build-catalog.mjs');
  await assert.rejects(buildCatalog({ root: f.root, out: path.join(f.root, 'out'), sourceCommit, tag: 'v0.1.0' }), /symbolic|mode/i);
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
  assert.match(catalog.entries[0].archiveURL, /\/v0\.1\.1\/example\.zip$/);
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

const presentationPNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');

// 删除目录展示派生、错误使用工作区图标或遗漏归档资源，会使安装前可用资料与实际包不一致。
test('固定快照生成安装前双语展示和PNG图标，并保留两种README及包内资产', async t => {
  const f = await fixture(t);
  await f.put('neuxally-plugin/example/.codex-plugin/plugin.json', { name: 'example', version: '0.1.0', description: 'Review repository changes.', interface: { displayName: 'Example', shortDescription: 'Review repository changes.', logo: './assets/icon.png', composerIcon: './assets/icon.png' } });
  await f.put('neuxally-plugin/example/.neuxally/presentation.json', { displayNames: { en: 'Example', 'zh-CN': '示例' }, localizedDescriptions: { en: 'Review repository changes.', 'zh-CN': '检查仓库变更。' } });
  await f.put('neuxally-plugin/example/assets/icon.png', presentationPNG);
  await f.put('neuxally-plugin/example/README.md', '# Example\nReview repository changes.\n');
  await f.put('neuxally-plugin/example/README.zh-CN.md', '# 示例\n检查仓库变更。\n');
  const sourceCommit = f.commit();
  await f.put('neuxally-plugin/example/assets/icon.png', Buffer.from('dirty unsafe asset'));
  const out = path.join(f.root, 'out'); const { buildCatalog } = await import('../build-catalog.mjs');
  const catalog = await buildCatalog({ root: f.root, out, sourceCommit }); const entry = catalog.entries[0];
  assert.equal(entry.name, 'example');
  assert.deepEqual(entry.displayNames, { en: 'Example', 'zh-CN': '示例' });
  assert.deepEqual(entry.localizedDescriptions, { en: 'Review repository changes.', 'zh-CN': '检查仓库变更。' });
  assert.equal(entry.icon, 'data:image/png;base64,' + presentationPNG.toString('base64'));
  const unpack = path.join(f.root, 'unpack-display'); await mkdir(unpack); execFileSync('unzip', ['-q', path.join(out, 'example.zip'), '-d', unpack]);
  assert.deepEqual(await readFile(path.join(unpack, 'neuxally-plugin/example/assets/icon.png')), presentationPNG);
  assert.equal(await readFile(path.join(unpack, 'neuxally-plugin/example/README.md'), 'utf8'), '# Example\nReview repository changes.\n');
  assert.equal(await readFile(path.join(unpack, 'neuxally-plugin/example/README.zh-CN.md'), 'utf8'), '# 示例\n检查仓库变更。\n');
});

for (const [label, file, content, reference] of [
  ['远程图标', 'assets/icon.png', presentationPNG, 'https://example.com/icon.png'],
  ['越界图标', 'assets/icon.png', presentationPNG, './../icon.png'],
  ['伪造PNG', 'assets/icon.png', Buffer.from('<svg onload="alert(1)"/>'), './assets/icon.png'],
  ['截断PNG', 'assets/icon.png', presentationPNG.subarray(0, 30), './assets/icon.png'],
  ['超限PNG', 'assets/icon.png', Buffer.alloc(128 * 1024 + 1), './assets/icon.png'],
  ['超限尺寸', 'assets/icon.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAACAEAAAABCAYAAACl1iXMAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64'), './assets/icon.png'],
  ['非法过滤器', 'assets/icon.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP9z8DwHwAFGQIEfQUW8QAAAABJRU5ErkJggg==', 'base64'), './assets/icon.png'],
  ['不完整像素', 'assets/icon.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGP4DwABAQEAsTj2FAAAAABJRU5ErkJggg==', 'base64'), './assets/icon.png'],
  ['错误块摘要', 'assets/icon.png', Buffer.from(presentationPNG.map((value, index) => index === 29 ? value ^ 1 : value)), './assets/icon.png'],
  ['动态SVG', 'assets/icon.svg', Buffer.from('<svg onload="alert(1)"/>'), './assets/icon.svg'],
]) {
  test(`拒绝发布${label}，不产生可被误用的catalog图标`, async t => {
    const f = await fixture(t);
    await f.put('neuxally-plugin/example/.codex-plugin/plugin.json', { name: 'example', version: '0.1.0', description: 'Example', interface: { logo: reference } });
    await f.put(`neuxally-plugin/example/${file}`, content); const sourceCommit = f.commit();
    const { buildCatalog } = await import('../build-catalog.mjs');
    await assert.rejects(buildCatalog({ root: f.root, out: path.join(f.root, 'out'), sourceCommit }), /icon|PNG|asset/i);
    assert.deepEqual(await readdir(path.join(f.root, 'out')).catch(() => []), []);
  });
}

for (const [label, presentation] of [
  ['未知语言', { displayNames: { 'fr': 'Example' } }],
  ['超限翻译', { localizedDescriptions: { en: 'x'.repeat(4097) } }],
  ['非文字翻译', { displayNames: { en: { name: 'Example' } } }],
  ['第二份身份', { name: 'other', displayNames: { en: 'Example' } }],
]) {
  test(`拒绝${label}展示附加文件`, async t => {
    const f = await fixture(t); await f.put('neuxally-plugin/example/.neuxally/presentation.json', presentation); const sourceCommit = f.commit();
    const { buildCatalog } = await import('../build-catalog.mjs');
    await assert.rejects(buildCatalog({ root: f.root, out: path.join(f.root, 'out'), sourceCommit }), /presentation|locale|display/i);
  });
}


test('拒绝通过符号链接读取图标', async t => {
  const f = await fixture(t);
  await f.put('neuxally-plugin/example/.codex-plugin/plugin.json', { name: 'example', version: '0.1.0', description: 'Example', interface: { logo: './assets/icon.png' } });
  await f.put('neuxally-plugin/example/assets/real.png', presentationPNG);
  await symlink('real.png', path.join(f.root, 'neuxally-plugin/example/assets/icon.png'));
  const sourceCommit = f.commit(); const { buildCatalog } = await import('../build-catalog.mjs');
  await assert.rejects(buildCatalog({ root: f.root, out: path.join(f.root, 'out'), sourceCommit }), /mode|icon/i);
});
