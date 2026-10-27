import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, openDatabase } from '../server.js';
const valid = { name: 'Profissional de teste', category: 'Pedreiro', neighborhood: 'Aponiã', phone: '69999990000', description: 'Obras e reformas residenciais.', whatsapp: true, consent: true };
async function setup(t) {
  const db = openDatabase(':memory:'); const server = createApp(db); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (path = '/api/professionals') => (await fetch(base + path)).json();
  const post = body => fetch(base + '/api/professionals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { db, base, get, post };
}
test('site, assets, health and protective headers are served', async t => {
  const { base, get } = await setup(t);
  for (const path of ['/', '/app.js', '/style.css']) { const res = await fetch(base + path); assert.equal(res.status, 200); assert.ok(res.headers.get('content-security-policy')); assert.ok((await res.text()).length > 100); }
  assert.deepEqual(await get('/api/health'), { ok: true });
  assert.equal((await fetch(base + '/missing')).status, 404);
});
test('registration stays private until approved; normalized search and filters work', async t => {
  const { db, get, post } = await setup(t);
  const res = await post(valid); assert.equal(res.status, 201); const { id } = await res.json();
  assert.equal((await get()).professionals.length, 0);
  db.prepare("UPDATE professionals SET status='approved' WHERE id=?").run(id);
  for (const path of ['?q=CONSTRUÇÃO', '?q=pedreiro&neighborhood=aponia', '?category=Pedreiro']) {
    const result = await get('/api/professionals' + path); assert.equal(result.professionals.length, 1); assert.equal(result.professionals[0].phone, valid.phone);
  }
  assert.equal((await get('/api/professionals?neighborhood=Centro')).professionals.length, 0);
  assert.equal((await get('/api/professionals?category=Pintor')).professionals.length, 0);
});
test('validation rejects missing consent, invalid phone, unknown category and bot field', async t => {
  const { post } = await setup(t);
  for (const patch of [{ consent: false }, { phone: '123' }, { category: 'invalid' }, { website: 'spam' }, { name: '' }, { description: 'a' }]) assert.equal((await post({ ...valid, ...patch })).status, 400);
});
test('phone normalization, duplicate detection and SQL injection resistance', async t => {
  const { db, get, post } = await setup(t);
  assert.equal((await post({ ...valid, phone: '+55 (69) 99999-0000' })).status, 201);
  assert.equal((await post(valid)).status, 409);
  assert.equal((await get('/api/professionals?q=%27%20OR%201%3D1--')).professionals.length, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM professionals').get().n, 1);
});
test('rejects cross-origin submissions and unsupported content types', async t => {
  const { base } = await setup(t);
  assert.equal((await fetch(base + '/api/professionals', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' }, body: JSON.stringify(valid) })).status, 403);
  assert.equal((await fetch(base + '/api/professionals', { method: 'POST', body: 'invalid' })).status, 415);
});
test('malformed and oversized payloads return clear errors', async t => {
  const { base } = await setup(t);
  for (const [body, expected] of [['{bad', 400], [JSON.stringify({ x: 'a'.repeat(11000) }), 413]]) assert.equal((await fetch(base + '/api/professionals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })).status, expected);
});
test('rate limits repeated submissions', async t => {
  const { post } = await setup(t);
  for (let i = 0; i < 20; i++) await post({});
  assert.equal((await post(valid)).status, 429);
});
