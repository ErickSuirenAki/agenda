import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, supabaseStore } from '../store.js';

function mockStore(responses, key = 'sb_secret_test') {
  const calls = [];
  const store = supabaseStore({ url: 'https://example.supabase.co', key, fetchImpl: async (url, options) => {
    calls.push({ url: new URL(url), ...options });
    const reply = responses.shift();
    assert.ok(reply, 'unexpected Supabase request');
    return Response.json(reply.body, { status: reply.status || 200 });
  } });
  return { store, calls };
}
test('Supabase credentials are required in every environment', () => {
  for (const env of [{}, { VERCEL: '1' }, { SUPABASE_URL: 'https://example.supabase.co' }, { SUPABASE_SECRET_KEY: 'secret' }]) {
    assert.throws(() => createStore(env), /Configure SUPABASE/);
  }
});
test('public Supabase requests filter approved records and exclude private columns', async () => {
  const { store, calls } = mockStore([{ body: [{ id: 'one', whatsapp: 1 }] }]);
  assert.equal((await store.list(false))[0].id, 'one');
  assert.equal(calls[0].url.searchParams.get('status'), 'eq.approved');
  assert.equal(calls[0].url.searchParams.get('select'), 'id,name,category,neighborhood,phone,description,whatsapp');
  assert.equal(calls[0].headers.apikey, 'sb_secret_test');
  assert.equal(calls[0].headers.Authorization, undefined);
});
test('Supabase pagination retrieves records beyond the first page', async () => {
  const { store, calls } = mockStore([{ body: Array.from({ length: 500 }, (_, id) => ({ id })) }, { body: [{ id: 500 }] }]);
  assert.equal((await store.list(true)).length, 501);
  assert.equal(calls[1].url.searchParams.get('offset'), '500');
  assert.equal(calls[0].url.searchParams.get('select'), '*');
});
test('Supabase mutations preserve IDs, values and missing-record behavior', async () => {
  const { store, calls } = mockStore([{ body: [] }, { body: [{ id: 'abc' }] }, { body: [] }, { body: [{ id: 'abc' }] }, { body: [{ id: 'abc' }] }, { body: [] }], 'legacy.jwt.key');
  const row = { id: 'abc', name: 'José', whatsapp: 1 };
  await store.insert(row);
  assert.deepEqual(JSON.parse(calls[0].body), row);
  assert.equal(calls[0].headers.Authorization, 'Bearer legacy.jwt.key');
  assert.deepEqual(await store.update('abc', { status: 'approved' }), { changes: 1 });
  assert.equal(calls[1].method, 'PATCH');
  assert.equal(calls[1].url.searchParams.get('id'), 'eq.abc');
  assert.deepEqual(await store.remove('missing'), { changes: 0 });
  assert.equal(calls[2].method, 'DELETE');
  assert.ok(await store.duplicate('69999990000', 'Restauração, móveis', 'other'));
  assert.equal(calls[3].url.searchParams.get('category'), 'eq.Restauração, móveis');
  assert.equal(calls[3].url.searchParams.get('id'), 'neq.other');
  assert.ok(await store.find('abc'));
  assert.equal(await store.health(), true);
});
test('Supabase propagates atomic uniqueness conflicts and hides upstream details', async () => {
  const { store } = mockStore([{ status: 409, body: { code: '23505', message: 'private record' } }, { status: 500, body: { message: 'secret' } }]);
  await assert.rejects(store.insert({}), error => error.code === '23505' && !error.message.includes('private'));
  await assert.rejects(store.health(), error => !error.message.includes('secret'));
});

test('public keys are rejected with a clear configuration error', () => {
  assert.throws(() => createStore({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_publishable_test' }), /chave secreta sb_secret_/);
});
