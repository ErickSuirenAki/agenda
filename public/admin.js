const $ = selector => document.querySelector(selector);
let password = '';
let records = [];
let generation = 0;
let editingId = null;
function node(tag, text, className = '') {
  const el = document.createElement(tag); el.textContent = text; el.className = className; return el;
}
function logout() {
  generation++; $('#editor').close(); $('#edit-form').reset(); editingId = null; $('#database-rows').replaceChildren(); password = ''; records = []; $('#records').replaceChildren(); $('#panel').hidden = true; $('#login').hidden = false; $('#password').value = ''; $('#password').focus();
}
async function api(path = '', method = 'GET', data) {
  const res = await fetch(`/api/admin/professionals${path}`, { method, headers: { Authorization: `Bearer ${password}`, ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined, cache: 'no-store' });
  const body = await res.json();
  if (!res.ok) { if (res.status === 401) logout(); throw Error(body.error || 'Não foi possível concluir.'); }
  return body;
}
function render() {
  const query = $('#admin-search').value.trim().toLocaleLowerCase('pt-BR');
  const visible = records.filter(p => ($('#filter').value === 'all' || p.status === $('#filter').value) && (!query || `${p.name} ${p.category} ${p.neighborhood} ${p.phone}`.toLocaleLowerCase('pt-BR').includes(query)));
  const tableView = $('#view').value === 'table';
  $('#records').hidden = tableView; $('#database').hidden = !tableView;
  $('#database-rows').replaceChildren();
  $('#total').textContent = `${visible.length} cadastro(s)`;
  $('#records').replaceChildren();
  if (!visible.length) $('#records').append(node('p', 'Nenhum cadastro nesta lista.', 'empty'));
  for (const p of visible) {
    const card = node('article', '', 'card');
    card.append(node('span', p.status === 'approved' ? 'Publicado' : 'Pendente', 'status'), node('h2', p.name), node('p', `${p.category} · ${p.neighborhood}`), node('p', `${formatPhone(p.phone)}${p.whatsapp ? ' · WhatsApp' : ''}`), node('p', p.description, 'description'), node('p', `Recebido em ${new Date(p.created_at).toLocaleString('pt-BR')}`));
    const actions = node('div', '', 'actions');
    function action(label, suffix, method, confirmation, className) {
      const button = node('button', label, `button outline ${className || ''}`); button.type = 'button';
      button.addEventListener('click', async () => {
        if (!confirm(confirmation)) return;
        const current = generation;
        actions.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try { const result = await api(`/${p.id}${suffix}`, method); if (current !== generation) return; await load(); if (current === generation) $('#message').textContent = result.message; }
        catch (error) { if (current === generation) $('#message').textContent = error.message; }
        finally { actions.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
      }); actions.append(button);
    }
    const edit = node('button', 'Editar', 'button outline'); edit.type = 'button'; edit.addEventListener('click', () => openEditor(p)); actions.append(edit);
    if (p.status !== 'approved') action('Aprovar', '/approve', 'POST', `Publicar o cadastro de ${p.name}? Confirme que verificou o contato e a autorização.`);
    action('Remover', '', 'DELETE', `Remover definitivamente o cadastro de ${p.name}?`, 'remove');
    if (tableView) {
      const row = document.createElement('tr');
      for (const value of [p.name, p.category, p.neighborhood, formatPhone(p.phone), p.status === 'approved' ? 'Publicado' : 'Pendente']) row.append(node('td', value));
      const cell = document.createElement('td'); cell.append(actions); row.append(cell); $('#database-rows').append(row);
    } else { card.append(actions); $('#records').append(card); }
  }
}
async function load() {
  const current = generation;
  const body = await api();
  if (current !== generation) return;
  records = body.professionals; $('#login').hidden = true; $('#panel').hidden = false; render();
}
$('#login').addEventListener('submit', async event => {
  event.preventDefault(); generation++; password = $('#password').value; $('#password').value = '';
  const button = event.currentTarget.querySelector('button'); button.disabled = true; $('#message').textContent = 'Entrando…';
  try { await load(); $('#message').textContent = ''; } catch (error) { password = ''; $('#message').textContent = error.message; } finally { button.disabled = false; }
});
$('#filter').addEventListener('change', render);
$('#refresh').addEventListener('click', async () => { const button = $('#refresh'); button.disabled = true; try { await load(); $('#message').textContent = 'Lista atualizada.'; } catch (error) { $('#message').textContent = error.message; } finally { button.disabled = false; } });
$('#logout').addEventListener('click', () => { logout(); $('#message').textContent = 'Você saiu da administração.'; });

function openEditor(record) {
  editingId = record.id;
  const form = $('#edit-form');
  for (const key of ['name', 'category', 'neighborhood', 'phone', 'description', 'status']) form.elements[key].value = record[key];
  form.elements.phone.value = formatPhone(record.phone);
  form.elements.whatsapp.checked = Boolean(record.whatsapp);
  $('#edit-message').textContent = ''; $('#editor').showModal();
}
$('#cancel-edit').addEventListener('click', () => $('#editor').close());
$('#edit-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form)); data.whatsapp = form.elements.whatsapp.checked;
  const current = generation;
  const button = form.querySelector('button[type=submit]'); button.disabled = true;
  $('#edit-message').textContent = 'Salvando…';
  try {
    const result = await api(`/${editingId}`, 'PUT', data);
    if (current !== generation) return;
    $('#editor').close(); await load();
    if (current === generation) $('#message').textContent = result.message;
  } catch (error) { if (current === generation) $('#edit-message').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#view').addEventListener('change', render);
$('#admin-search').addEventListener('input', render);

bindPhoneInput($('#edit-form').elements.phone);

function formatPhone(value) {
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (!digits) return '';
  if (digits.length < 3) return `(${digits}`;
  const local = digits.slice(2);
  const split = local.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? '-' + local.slice(split) : ''}`;
}

function bindPhoneInput(input) {
  input.addEventListener('beforeinput', event => {
    if (input.selectionStart !== input.selectionEnd) return;
    let caret = input.selectionStart;
    if (event.inputType === 'deleteContentBackward') {
      while (caret > 0 && /\D/.test(input.value[caret - 1])) caret--;
    } else if (event.inputType === 'deleteContentForward') {
      while (caret < input.value.length && /\D/.test(input.value[caret])) caret++;
    } else return;
    input.setSelectionRange(caret, caret);
  });
  input.addEventListener('input', () => {
    const value = input.value;
    const caret = input.selectionStart;
    let digitCount = value.slice(0, caret).replace(/\D/g, '').length;
    if (value.replace(/\D/g, '').startsWith('55') && value.replace(/\D/g, '').length > 11) digitCount = Math.max(0, digitCount - 2);
    const formatted = formatPhone(value);
    input.value = formatted;
    let position = 0, seen = 0;
    while (position < formatted.length && seen < digitCount) {
      if (/\d/.test(formatted[position])) seen++;
      position++;
    }
    input.setSelectionRange(position, position);
  });
  input.value = formatPhone(input.value);
}
