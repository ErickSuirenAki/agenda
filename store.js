export function supabaseStore({ url, key, fetchImpl = fetch }) {
  const base = new URL('/rest/v1/professionals', url);
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('SUPABASE_URL deve usar HTTPS.');
  async function request(method, params = {}, body) {
    const endpoint = new URL(base);
    endpoint.search = new URLSearchParams(params).toString();
    const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    const response = await fetchImpl(endpoint, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const error = new Error(`Supabase: HTTP ${response.status}`);
      error.code = detail.code;
      throw error;
    }
    return response.status === 204 ? [] : response.json();
  }
  return {
    async list(admin) {
      const params = admin ? { select: '*', order: 'created_at.desc,id.asc' } : { select: 'id,name,category,neighborhood,phone,description,whatsapp', status: 'eq.approved', order: 'name.asc,id.asc' };
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const page = await request('GET', { ...params, limit: '500', offset: String(offset) });
        rows.push(...page);
        if (page.length < 500) return rows;
      }
    },
    find: async id => (await request('GET', { select: 'id', id: `eq.${id}`, limit: '1' }))[0],
    duplicate: async (phone, category, id) => (await request('GET', { select: 'id', phone: `eq.${phone}`, category: `eq.${category}`, ...(id ? { id: `neq.${id}` } : {}), limit: '1' }))[0],
    insert: row => request('POST', {}, row),
    update: async (id, row) => ({ changes: (await request('PATCH', { id: `eq.${id}` }, row)).length }),
    remove: async id => ({ changes: (await request('DELETE', { id: `eq.${id}` })).length }),
    health: async () => { await request('GET', { select: 'id', limit: '1' }); return true; },
  };
}

export function createStore(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (key?.startsWith('sb_publishable_')) throw Error('Use uma chave secreta sb_secret_, não a chave pública publishable.');
  if (url && key) return supabaseStore({ url, key });
  throw Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY.');
}
