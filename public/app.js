const categories = ['Pedreiro', 'Eletricista', 'Encanador', 'Pintor', 'Diarista', 'Jardineiro', 'Marceneiro', 'Técnico de ar-condicionado', 'Outros'];
const symbols = ['⌂', 'ϟ', '◉', '◩', '✦', '❋', '▧', '❄', '＋'];
let selected = '';
let requestNumber = 0;
const $ = selector => document.querySelector(selector);
function element(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; }
function renderCategories() {
  $('#categories').replaceChildren();
  ['Todos os serviços', ...categories].forEach((label, index) => {
    const value = index === 0 ? '' : label;
    const button = element('button', `category${selected === value ? ' active' : ''}`);
    button.type = 'button'; button.setAttribute('aria-pressed', String(selected === value));
    button.append(element('span', 'category-symbol', index === 0 ? '⊞' : symbols[index - 1]), document.createTextNode(label));
    button.addEventListener('click', () => { selected = value; renderCategories(); load(); });
    $('#categories').append(button);
  });
}
function card(p) {
  const article = element('article', 'card');
  const top = element('div', 'card-top');
  top.append(element('span', 'avatar', p.name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()), element('span', 'service-tag', p.category));
  article.append(top, element('h3', '', p.name), element('p', 'card-location', `⌖ ${p.neighborhood} · Porto Velho`), element('p', 'card-description', p.description));
  const contacts = element('div', 'contacts');
  const phone = element('a', 'phone', `(${p.phone.slice(0, 2)}) ${p.phone.slice(2, -4)}-${p.phone.slice(-4)}`);
  phone.href = `tel:+55${p.phone}`; contacts.append(phone);
  if (p.whatsapp) { const link = element('a', 'whatsapp', 'WhatsApp →'); link.href = `https://wa.me/55${p.phone}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `Conversar com ${p.name} no WhatsApp`); contacts.append(link); }
  article.append(contacts); return article;
}
async function load() {
  const number = ++requestNumber;
  const params = new URLSearchParams({ q: $('#query').value.trim(), neighborhood: $('#neighborhood').value.trim(), category: selected });
  const filtered = [...params.values()].some(Boolean);
  $('#count').textContent = 'Buscando…';
  $('#clear').hidden = !filtered;
  $('#results').setAttribute('aria-busy', 'true');
  try {
    const res = await fetch(`/api/professionals?${params}`); if (!res.ok) throw Error('Não foi possível carregar os profissionais.');
    const { professionals } = await res.json(); if (number !== requestNumber) return;
    $('#count').textContent = `${professionals.length} ${professionals.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}`;
    $('#results').replaceChildren();
    if (professionals.length) professionals.forEach(p => $('#results').append(card(p)));
    else {
      const empty = element('div', 'empty');
      empty.append(element('span', 'empty-icon', '⌕'), element('h3', '', filtered ? 'Ainda não encontramos esse serviço por aqui.' : 'Uma nova agenda está começando.'), element('p', '', filtered ? 'Tente outro serviço ou amplie a busca para todos os bairros.' : 'Estamos recebendo os primeiros profissionais de Porto Velho. Seja um dos primeiros a divulgar seu trabalho.'));
      const link = element('a', 'button outline', 'Cadastrar meu serviço →'); link.href = '#cadastro'; empty.append(link); $('#results').append(empty);
    }
  } catch (error) {
    if (number !== requestNumber) return;
    $('#count').textContent = 'Busca indisponível';
    const state = element('div', 'empty'); state.append(element('p', '', error.message));
    const retry = element('button', 'button outline', 'Tentar novamente'); retry.addEventListener('click', load); state.append(retry); $('#results').replaceChildren(state);
  } finally { if (number === requestNumber) $('#results').removeAttribute('aria-busy'); }
}
$('#search').addEventListener('submit', event => { event.preventDefault(); load(); $('#profissionais').scrollIntoView({ behavior: 'smooth' }); });
$('#clear').addEventListener('click', () => { $('#query').value = ''; $('#neighborhood').value = ''; selected = ''; renderCategories(); load(); });
categories.forEach(category => { const option = element('option', '', category); option.value = category; $('#signup-category').append(option); });
$('#signup').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); const message = $('#form-message');
  const data = Object.fromEntries(new FormData(form)); data.whatsapp = form.elements.whatsapp.checked; data.consent = form.elements.consent.checked;
  button.disabled = true; message.textContent = 'Enviando…'; message.className = '';
  try { const res = await fetch('/api/professionals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const body = await res.json(); if (!res.ok) throw Error(body.error || 'Não foi possível enviar.'); message.textContent = body.message; message.className = 'success'; form.reset(); }
  catch (error) { message.textContent = error.message || 'Falha de conexão. Tente novamente.'; message.className = 'error'; }
  finally { button.disabled = false; }
});
renderCategories(); load();
