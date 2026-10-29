import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
export const categories = ['Pedreiro', 'Eletricista', 'Encanador', 'Pintor', 'Diarista', 'Jardineiro', 'Marceneiro', 'Técnico de ar-condicionado', 'Serralheiro', 'Carpinteiro', 'Gesseiro', 'Azulejista', 'Vidraceiro', 'Chaveiro', 'Montador de móveis', 'Técnico de eletrodomésticos', 'Técnico de informática', 'Instalador de câmeras', 'Dedetizador', 'Limpador de piscinas', 'Lavador de estofados', 'Mecânico', 'Borracheiro', 'Costureiro', 'Cabeleireiro', 'Barbeiro', 'Manicure e pedicure', 'Maquiador', 'Cozinheiro', 'Confeiteiro', 'Cuidador de idosos', 'Babá', 'Passeador de cães', 'Professor particular', 'Fotógrafo', 'Motorista', 'Fretes e mudanças', 'Outros'];
export const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function openDatabase(path = process.env.DB_PATH || join(root, 'data', 'agenda.sqlite')) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS professionals (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, neighborhood TEXT NOT NULL,
    phone TEXT NOT NULL, description TEXT NOT NULL, whatsapp INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
  )`);
  return db;
}
function validate(input) {
  const clean = key => typeof input[key] === 'string' ? input[key].trim() : '';
  const record = { name: clean('name'), category: clean('category'), neighborhood: clean('neighborhood'), phone: clean('phone').replace(/\D/g, ''), description: clean('description'), whatsapp: input.whatsapp === true ? 1 : 0 };
  if (record.phone.startsWith('55') && record.phone.length > 11) record.phone = record.phone.slice(2);
  if (record.name.length < 3 || record.name.length > 80) throw Error('Informe um nome entre 3 e 80 caracteres.');
  if (!categories.includes(record.category)) throw Error('Escolha um serviço da lista.');
  if (record.category === 'Outros') {
    const custom = clean('customCategory').replace(/\s+/g, ' ');
    if (custom.length < 3 || custom.length > 80) throw Error('Informe sua profissão em 3 a 80 caracteres.');
    record.category = categories.find(category => normalize(category) === normalize(custom)) || custom;
  }
  if (record.neighborhood.length < 2 || record.neighborhood.length > 80) throw Error('Informe o bairro em Porto Velho.');
  if (!/^69[2-9]\d{7,8}$/.test(record.phone)) throw Error('Informe um telefone válido com DDD 69.');
  if (record.description.length < 10 || record.description.length > 500) throw Error('Descreva seu serviço em 10 a 500 caracteres.');
  if (input.consent !== true) throw Error('É necessário autorizar a publicação dos seus dados de contato.');
  if (clean('website')) throw Error('Não foi possível enviar o cadastro.');
  return record;
}
export function createApp(db = openDatabase(), { adminPassword = process.env.ADMIN_PASSWORD || '' } = {}) {
  const attempts = new Map();
  const adminAttempts = new Map();
  const digest = value => createHash('sha256').update(value).digest();
  const assets = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']], ['/phone.js', ['phone.js', 'text/javascript; charset=utf-8']], ['/style.css', ['style.css', 'text/css; charset=utf-8']]]);
  return http.createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/admin/')) {
        res.setHeader('Cache-Control', 'no-store');
        if (!adminPassword) return send(503, { error: 'A administração ainda não foi configurada.' });
        const now = Date.now();
        for (const [ip, entry] of adminAttempts) if (now - entry.since >= 900000) adminAttempts.delete(ip);
        const ip = req.socket.remoteAddress;
        const entry = adminAttempts.get(ip) || { since: now, count: 0 };
        if (entry.count >= 10) return send(429, { error: 'Muitas tentativas de acesso. Aguarde 15 minutos.' });
        const authorization = req.headers.authorization || '';
        if (!authorization.startsWith('Bearer ') || !timingSafeEqual(digest(authorization.slice(7)), digest(adminPassword))) {
          entry.count++; adminAttempts.set(ip, entry);
          return send(401, { error: 'Senha de administração inválida.' });
        }
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return send(403, { error: 'Origem não permitida.' });
        if (req.method === 'GET' && url.pathname === '/api/admin/professionals') {
          return send(200, { professionals: db.prepare('SELECT * FROM professionals ORDER BY created_at DESC').all() });
        }
        const match = url.pathname.match(/^\/api\/admin\/professionals\/([a-f0-9-]+)(\/approve)?$/);
        if (match && !match[2] && req.method === 'PUT') {
          if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Envie os dados em JSON.' });
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 10000) return send(413, { error: 'Cadastro muito grande.' });
            chunks.push(chunk);
          }
          let record, status;
          try {
            const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Dados inválidos.');
            status = input.status;
            if (!['pending', 'approved'].includes(status)) throw Error('Escolha um status válido.');
            record = validate({ ...input, category: 'Outros', customCategory: input.category, consent: true, website: '' });
          } catch (error) { return send(400, { error: error instanceof SyntaxError ? 'Dados inválidos.' : error.message }); }
          if (!db.prepare('SELECT id FROM professionals WHERE id=?').get(match[1])) return send(404, { error: 'Cadastro não encontrado.' });
          if (db.prepare('SELECT id FROM professionals WHERE phone=? AND category=? AND id<>?').get(record.phone, record.category, match[1])) return send(409, { error: 'Já existe um cadastro deste telefone para esse serviço.' });
          db.prepare('UPDATE professionals SET name=?,category=?,neighborhood=?,phone=?,description=?,whatsapp=?,status=? WHERE id=?').run(record.name, record.category, record.neighborhood, record.phone, record.description, record.whatsapp, status, match[1]);
          return send(200, { message: 'Cadastro atualizado.' });
        }
        if (match && ((req.method === 'POST' && match[2]) || (req.method === 'DELETE' && !match[2]))) {
          const result = match[2]
            ? db.prepare("UPDATE professionals SET status='approved' WHERE id=?").run(match[1])
            : db.prepare('DELETE FROM professionals WHERE id=?').run(match[1]);
          if (!result.changes) return send(404, { error: 'Cadastro não encontrado.' });
          return send(200, { message: match[2] ? 'Cadastro aprovado e publicado.' : 'Cadastro removido.' });
        }
        return send(404, { error: 'Página não encontrada.' });
      }
      if (req.method === 'GET' && ['/admin', '/admin.js', '/admin.css'].includes(url.pathname)) {
        const name = url.pathname === '/admin' ? 'admin.html' : url.pathname.slice(1);
        const type = name.endsWith('.html') ? 'text/html' : name.endsWith('.js') ? 'text/javascript' : 'text/css';
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
        return res.end(readFileSync(join(root, 'public', name)));
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { ok: db.prepare('SELECT 1 AS ok').get().ok === 1 });
      if (req.method === 'GET' && url.pathname === '/api/professionals') {
        const q = normalize((url.searchParams.get('q') || '').slice(0, 100));
        const neighborhood = normalize((url.searchParams.get('neighborhood') || '').slice(0, 80));
        const category = url.searchParams.get('category') || '';
        const rows = db.prepare("SELECT id,name,category,neighborhood,phone,description,whatsapp FROM professionals WHERE status='approved' ORDER BY name").all();
        return send(200, { categories: [...new Set([...categories, ...rows.map(p => p.category)])], professionals: rows.filter(p => (!q || normalize(`${p.name} ${p.category} ${p.description} ${p.category === 'Pedreiro' ? 'construção obra reforma' : ''}`).includes(q)) && (!neighborhood || normalize(p.neighborhood).includes(neighborhood)) && (!category || p.category === category)) });
      }
      if (req.method === 'POST' && url.pathname === '/api/professionals') {
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Envie os dados em JSON.' });
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return send(403, { error: 'Origem não permitida.' });
        const now = Date.now();
        for (const [key, value] of attempts) if (now - value.since > 3600000) attempts.delete(key);
        const ip = req.socket.remoteAddress;
        const limit = attempts.get(ip) || { since: now, count: 0 };
        if (limit.count >= 20) return send(429, { error: 'Muitas tentativas. Tente novamente em uma hora.' });
        limit.count++; attempts.set(ip, limit);
        let body = '';
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 10000) return send(413, { error: 'Cadastro muito grande.' }); }
        let record;
        try { record = validate(JSON.parse(body)); } catch (error) { return send(400, { error: error instanceof SyntaxError ? 'Dados inválidos.' : error.message }); }
        const duplicate = db.prepare("SELECT id FROM professionals WHERE phone=? AND category=?").get(record.phone, record.category);
        if (duplicate) return send(409, { error: 'Já existe um cadastro deste telefone para esse serviço.' });
        const id = randomUUID();
        db.prepare('INSERT INTO professionals (id,name,category,neighborhood,phone,description,whatsapp,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id, record.name, record.category, record.neighborhood, record.phone, record.description, record.whatsapp, new Date().toISOString());
        return send(201, { id, message: 'Cadastro recebido! Seus dados serão publicados após revisão.' });
      }
      const asset = assets.get(url.pathname);
      if (req.method === 'GET' && asset) {
        res.writeHead(200, { 'Content-Type': asset[1] }); return res.end(readFileSync(join(root, 'public', asset[0])));
      }
      return send(404, { error: 'Página não encontrada.' });
    } catch (error) { console.error('Erro na requisição:', error.message); if (!res.headersSent) send(500, { error: 'Não foi possível concluir. Tente novamente.' }); else res.end(); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => console.log('Agenda Porto Velho iniciada na porta', app.address().port));
}
