import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// 外部边界替代真实网络和账号，真实桥接进程负责协议、隔离、状态核验和取消。
async function bridge(t, scenario = 'success') {
  const directory = await mkdtemp(path.join(tmpdir(), 'plugin-auth-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const binary = path.join(directory, 'lark-cli');
  await writeFile(binary, `#!/usr/bin/env node
const fs = require('node:fs');const path=require('node:path');const args=process.argv.slice(2); const p=process.env.LARKSUITE_CLI_CONFIG_DIR;
if (process.env.LARKSUITE_CLI_ACCESS_TOKEN) process.exit(19);
fs.mkdirSync(p,{recursive:true});
const flag=path.join(p,'authorized');
if(args[0]==='config'){process.stderr.write('https://open.feishu.cn.evil.example/page/cli?user_code=bad\\n');process.stderr.write('https://open.feishu.cn/page/cli?user_code=APP-EXAMPLE\\n');fs.writeFileSync(path.join(p,'config.json'),'{}');}
else if(args[1]==='status'){console.log(JSON.stringify({appId:'cli_example',identities:{user:{available:fs.existsSync(flag),verified:${scenario !== 'unverified'},openId:'ou_example',userName:'示例账号',scope:${JSON.stringify(scenario === 'missing-scope' ? 'offline_access' : 'offline_access docx:document')}}}}));}
else if(args.includes('--no-wait'))console.log(JSON.stringify({verification_url:'https://open.feishu.cn/auth/device?code=USER-EXAMPLE',device_code:'PRIVATE-DEVICE-TOKEN',expires_in:${scenario === 'expired' ? 1 : 600}}));
else if(args.includes('--device-code')){${['cancel', 'expired'].includes(scenario) ? "setInterval(()=>{},1000);process.on('SIGTERM',()=>{fs.writeFileSync(path.join(p,'stopped'),'yes');process.exit(0)});" : "fs.writeFileSync(flag,'yes');console.log(JSON.stringify({event:'authorization_complete',missing:[]}));"}}
else if(args[1]==='logout'){fs.rmSync(flag,{force:true});}
else process.exit(20);
`);
  await chmod(binary, 0o755);
  const child = spawn(process.execPath, [path.resolve('neuxally-plugin/feishu-office/.neuxally/auth/authorize.mjs')], { env: { ...process.env, NEUXALLY_LARK_CLI: binary, LARKSUITE_CLI_ACCESS_TOKEN: 'INHERITED-SECRET', LARKSUITE_CLI_CONFIG_DIR: '/do-not-touch' }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const messages = [], pending = new Map(); let next = 1; let stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  createInterface({ input: child.stdout }).on('line', line => { const value = JSON.parse(line); messages.push(value); if (value.id != null) { pending.get(value.id)?.(value); pending.delete(value.id); } });
  const params = { sessionId: 'session-example', pluginId: 'plugin-example', dataDirectory: path.join(directory, 'private'), scopes: ['offline_access', 'docx:document'] };
  const request = (method, extra = {}) => new Promise((resolve, reject) => { const id = next++; const timer = setTimeout(() => reject(new Error(`request timeout: ${method}; ${stderr}`)), 3000); pending.set(id, value => { clearTimeout(timer); resolve(value); }); child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params: { ...params, ...extra } })}\n`); });
  const waitState = async state => { for(let i=0;i<150;i++){const found=messages.find(x=>x.method==='auth/state' && x.params.state===state);if(found)return found; await new Promise(resolve=>setTimeout(resolve,20));}throw new Error(`no ${state}: ${JSON.stringify(messages)} ${stderr}`); };
  return { directory, params, request, waitState, messages, stderr: () => stderr };
}

test('多阶段挑战动态更新；真实验证成功后按组件私密 resolve', async t => {
  const f = await bridge(t);
  assert.equal((await f.request('auth/start')).result.state, 'pending');
  const final = await f.waitState('authorized'); assert.equal(final.params.account.name, '示例账号');
  const challenges = f.messages.filter(x => x.method === 'auth/challenge');
  assert.equal(challenges.length, 2);
  assert.notEqual(challenges[0].params.challengeId, challenges[1].params.challengeId);
  assert.match(challenges[0].params.actions[0].url, /^https:\/\/open\.feishu\.cn\/page\/cli/);
  assert.ok(challenges[0].params.deadlineAt); assert.equal(challenges[0].params.expiresAt, undefined);
  assert.ok(challenges[1].params.expiresAt);
  assert.equal((await f.request('auth/status')).result.state, 'authorized');
  const resolved = await f.request('auth/resolve', { components: [{ componentId: 'stable-doc', key: 'skills/lark-doc', target: 'skill' }] });
  assert.equal(resolved.result.bindings.length, 1);
  assert.equal(resolved.result.bindings[0].componentId, 'stable-doc');
  assert.equal(resolved.result.bindings[0].environment.LARKSUITE_CLI_CONFIG_DIR, path.join(f.params.dataDirectory, 'profile'));
  assert.equal(resolved.result.bindings[0].environment.LARKSUITE_CLI_ACCESS_TOKEN, '');
  assert.ok((await f.request('auth/resolve', { components: [{ componentId: 'bad', key: 'github', target: 'mcp', url: 'https://evil.example' }] })).error);
  assert.ok((await f.request('auth/status', { sessionId: 'other' })).error);
  const publicMessages = f.messages.filter(x => x.method || x.id !== resolved.id);
  assert.doesNotMatch(JSON.stringify(publicMessages), /PRIVATE-DEVICE-TOKEN|INHERITED-SECRET/);
  assert.equal(f.stderr(), '');
  assert.equal((await f.request('auth/logout')).result.state, 'unauthorized');
  assert.equal((await f.request('auth/status')).result.account.available, false);
});

for (const scenario of ['unverified', 'missing-scope']) {
  test(`CLI 退出成功但 ${scenario} 时不能标记已授权`, async t => {
    const f = await bridge(t, scenario); await f.request('auth/start'); await f.waitState('failed');
    assert.equal((await f.request('auth/status')).result.account.available, false);
    assert.ok((await f.request('auth/resolve', { components: [{ componentId: 'doc', key: 'skills/lark-doc', target: 'skill' }] })).error);
  });
}

test('取消必须等待上游进程停止；旧会话不能继续交付凭据', async t => {
  const f = await bridge(t, 'cancel'); await f.request('auth/start');
  for(let i=0;i<100 && f.messages.filter(x=>x.method==='auth/challenge').length<2;i++)await new Promise(resolve=>setTimeout(resolve,20));
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal((await f.request('auth/cancel')).result.state, 'cancelled');
  assert.equal(await readFile(path.join(f.params.dataDirectory, 'profile/stopped'), 'utf8'), 'yes');
  await f.waitState('cancelled');
  assert.ok((await f.request('auth/resolve', { components: [{ componentId: 'doc', key: 'skills/lark-doc', target: 'skill' }] })).error);
});


test('官方期限到期会停止上游等待，并在刷新时生成新挑战', async t => {
  const f = await bridge(t, 'expired'); await f.request('auth/start'); await f.waitState('expired');
  const previous = f.messages.filter(x => x.method === 'auth/challenge').at(-1).params.challengeId;
  assert.ok((await f.request('auth/resolve', { components: [{ componentId: 'doc', key: 'skills/lark-doc', target: 'skill' }] })).error);
  await f.request('auth/start');
  for(let i=0;i<100 && f.messages.filter(x=>x.method==='auth/challenge').at(-1).params.challengeId===previous;i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.notEqual(f.messages.filter(x=>x.method==='auth/challenge').at(-1).params.challengeId, previous);
  await f.request('auth/cancel');
});
