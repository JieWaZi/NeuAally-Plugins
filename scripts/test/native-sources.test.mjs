import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// 摘要由固定上游下载时记录；修改、遗漏或额外改写原生组件会破坏此边界。
for (const directory of ['codex-plugins/github', 'claude-plugins/github']) {
  test(`${directory} 完整保留固定上游原文与资产`, async () => {
    const provenance = JSON.parse(await readFile(`${directory}/provenance.json`, 'utf8'));
    const files = [];
    async function walk(relative = '') {
      for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
        const name = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(name); else files.push(name);
      }
    }
    await walk();
    assert.deepEqual(files.filter(name => !['provenance.json', 'LICENSE.upstream'].includes(name)).sort(), provenance.files.map(file => file.path).sort());
    for (const file of provenance.files) assert.equal(createHash('sha256').update(await readFile(path.join(directory, file.path))).digest('hex'), file.sha256, file.path);
  });
}
