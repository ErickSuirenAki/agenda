import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, openDatabase } from '../server.js';
const valid = { name: 'Profissional de teste', category: 'Pedreiro', neighborhood: 'Aponiã', phone: '69999990000', description: 'Obras e reformas residenciais.', whatsapp: true, consent: true };
async function setup(t, options = {}) {
  const db = openDatabase(':memory:'); const server = createApp(db, options); server.listen(0, '127.0.0.1'); await once(server, 'listening');
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

test('admin requires configured password and protects private records', async t => {
  const { base, post } = await setup(t, { adminPassword: 'test-secret' });
  await post(valid);
  const path = base + '/api/admin/professionals';
  for (const method of ['GET', 'POST', 'DELETE']) {
    const res = await fetch(path, { method });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(!(await res.text()).includes(valid.phone));
  }
  assert.equal((await fetch(path, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  const res = await fetch(path, { headers: { Authorization: 'Bearer test-secret' } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).professionals[0].status, 'pending');
  for (const asset of ['/admin', '/admin.js', '/admin.css']) assert.equal((await fetch(base + asset)).status, 200);
});
test('admin can approve and remove; cross-origin changes are rejected', async t => {
  const { base, post, get } = await setup(t, { adminPassword: 'test-secret' });
  const { id } = await (await post(valid)).json();
  const path = base + '/api/admin/professionals/' + id;
  const headers = { Authorization: 'Bearer test-secret' };
  assert.equal((await fetch(path + '/approve', { method: 'POST' })).status, 401);
  assert.equal((await fetch(path, { method: 'DELETE' })).status, 401);
  assert.equal((await fetch(path + '/approve', { method: 'POST', headers: { ...headers, Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await get()).professionals.length, 0);
  assert.equal((await fetch(path + '/approve', { method: 'POST', headers })).status, 200);
  assert.equal((await get()).professionals[0].id, id);
  assert.equal((await fetch(path, { method: 'DELETE', headers })).status, 200);
  assert.equal((await get()).professionals.length, 0);
  assert.equal((await fetch(path, { method: 'DELETE', headers })).status, 404);
});
test('admin is disabled without password and limits failed authentication', async t => {
  const disabled = await setup(t, { adminPassword: '' });
  assert.equal((await fetch(disabled.base + '/api/admin/professionals')).status, 503);
  const { base } = await setup(t, { adminPassword: 'test-secret' });
  for (let i = 0; i < 10; i++) assert.equal((await fetch(base + '/api/admin/professionals')).status, 401);
  assert.equal((await fetch(base + '/api/admin/professionals')).status, 429);
});

test('custom professions require a name and remain private until approval', async t => {
  const { db, post, get } = await setup(t);
  for (const customCategory of ['', 'ab', 'a'.repeat(81)]) {
    assert.equal((await post({ ...valid, category: 'Outros', customCategory })).status, 400);
  }
  const response = await post({ ...valid, category: 'Outros', customCategory: '  Restaurador   de móveis  ' });
  assert.equal(response.status, 201);
  const { id } = await response.json();
  assert.equal((await get()).categories.includes('Restaurador de móveis'), false);
  db.prepare("UPDATE professionals SET status='approved' WHERE id=?").run(id);
  const result = await get('/api/professionals?q=restaurador');
  assert.equal(result.professionals[0].category, 'Restaurador de móveis');
  assert.ok(result.categories.includes('Restaurador de móveis'));
  assert.equal((await get('/api/professionals?category=' + encodeURIComponent('Restaurador de móveis'))).professionals.length, 1);
});
test('expanded professions and custom names matching existing professions are accepted', async t => {
  const { post } = await setup(t);
  assert.equal((await post({ ...valid, category: 'Serralheiro' })).status, 201);
  assert.equal((await post({ ...valid, category: 'Outros', customCategory: 'serralheiro' })).status, 409);
});

test('admin editing persists validated data and updates publication status', async t => {
  const { db, base, post, get } = await setup(t, { adminPassword: 'test-secret' });
  const { id } = await (await post(valid)).json();
  const path = base + '/api/admin/professionals/' + id;
  const headers = { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' };
  const edited = { ...valid, name: 'Nome atualizado', category: 'Restaurador de móveis', phone: '+55 (69) 99999-1111', status: 'approved', whatsapp: false };
  const put = (data, customHeaders = headers, url = path) => fetch(url, { method: 'PUT', headers: customHeaders, body: JSON.stringify(data) });
  assert.equal((await put(edited, { 'Content-Type': 'application/json' })).status, 401);
  assert.equal((await put(edited, { ...headers, Origin: 'https://untrusted.example' })).status, 403);
  for (const data of [null, [], { ...edited, name: '' }, { ...edited, phone: '123' }, { ...edited, status: 'invalid' }, { ...edited, category: '' }]) assert.equal((await put(data)).status, 400);
  assert.equal((await put(edited)).status, 200);
  const published = (await get()).professionals[0];
  assert.equal(published.name, edited.name);
  assert.equal(published.category, edited.category);
  assert.equal(published.phone, '69999991111');
  assert.equal(published.whatsapp, 0);
  assert.equal((await put({ ...edited, status: 'pending' })).status, 200);
  assert.equal((await get()).professionals.length, 0);
  assert.equal(db.prepare('SELECT status FROM professionals WHERE id=?').get(id).status, 'pending');
  assert.equal((await put(edited, headers, base + '/api/admin/professionals/0000')).status, 404);
});
test('admin editing rejects duplicates and oversized payloads', async t => {
  const { base, post } = await setup(t, { adminPassword: 'test-secret' });
  const { id } = await (await post(valid)).json();
  const { id: other } = await (await post({ ...valid, phone: '69999992222' })).json();
  const headers = { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' };
  const put = (recordId, body) => fetch(base + '/api/admin/professionals/' + recordId, { method: 'PUT', headers, body });
  assert.equal((await put(other, JSON.stringify({ ...valid, status: 'pending' }))).status, 409);
  assert.equal((await put(id, JSON.stringify({ ...valid, status: 'pending' }))).status, 200);
  assert.equal((await put(id, '{bad')).status, 400);
  assert.equal((await put(id, JSON.stringify({ description: 'a'.repeat(11000) }))).status, 413);
});
