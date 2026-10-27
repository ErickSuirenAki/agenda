import { openDatabase } from './server.js';
const db = openDatabase();
const [command, id] = process.argv.slice(2);
if (command === 'list') console.table(db.prepare('SELECT id,name,category,neighborhood,phone,status FROM professionals ORDER BY created_at DESC').all());
else if (['approve', 'delete'].includes(command) && id) {
  const result = command === 'approve' ? db.prepare("UPDATE professionals SET status='approved' WHERE id=?").run(id) : db.prepare('DELETE FROM professionals WHERE id=?').run(id);
  if (!result.changes) { console.error('Cadastro não encontrado.'); process.exitCode = 1; }
  else console.log(command === 'approve' ? 'Cadastro publicado.' : 'Cadastro removido.');
} else { console.error('Use npm run cadastros, npm run aprovar -- ID ou npm run remover -- ID'); process.exitCode = 1; }
db.close();
