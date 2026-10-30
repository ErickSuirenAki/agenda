import { createStore } from './store.js';
const [command, id] = process.argv.slice(2);
try {
  const store = createStore();
  if (command === 'list') console.table(await store.list(true));
  else if (['approve', 'delete'].includes(command) && id) {
    const result = command === 'approve' ? await store.update(id, { status: 'approved' }) : await store.remove(id);
    if (!result.changes) { console.error('Cadastro não encontrado.'); process.exitCode = 1; }
    else console.log(command === 'approve' ? 'Cadastro publicado.' : 'Cadastro removido.');
  } else { console.error('Use npm run cadastros, npm run aprovar -- ID ou npm run remover -- ID'); process.exitCode = 1; }
} catch (error) { console.error(error.message); process.exitCode = 1; }
