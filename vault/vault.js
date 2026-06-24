const CATS = ['all','work','social','tools','learn','other'];
const STORAGE_KEY = 'urlvault_v1';
let filter = 'all';
let editId = null;

// ── Storage ──
function loadVault() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], result => {
      try {
        const raw = result[STORAGE_KEY];
        resolve(Array.isArray(raw) ? raw : []);
      } catch { resolve([]); }
    });
  });
}

function saveVault(data) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
  });
}

function uid()   { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function today() { return new Date().toISOString().slice(0,10); }
function esc(s)  {
  return String(s)
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/'/g,'&#39;');
}

// ── Add ──
async function addBookmark() {
  const name = document.getElementById('f-name').value.trim();
  let   url  = document.getElementById('f-url').value.trim();
  const cat  = document.getElementById('f-cat').value;
  const note = document.getElementById('f-note').value.trim();
  if (!name) { flash('f-name'); return; }
  if (!url)  { flash('f-url');  return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const data = await loadVault();
  data.unshift({ id: uid(), name, url, cat, note, date: today() });
  await saveVault(data);
  clearForm();
  render();
  toast('Entry saved to vault');
}

function clearForm() {
  ['f-name','f-url','f-note'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-cat').value = 'work';
}

function flash(id) {
  const el = document.getElementById(id);
  el.style.borderColor = 'var(--red)';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 800);
}

// ── Delete ──
async function deleteEntry(id) {
  const data = (await loadVault()).filter(x => x.id !== id);
  await saveVault(data);
  render();
  toast('Entry removed');
}

// ── Edit ──
async function openEdit(id) {
  const data  = await loadVault();
  const entry = data.find(x => x.id === id);
  if (!entry) return;
  editId = id;
  document.getElementById('e-name').value = entry.name;
  document.getElementById('e-url').value  = entry.url;
  document.getElementById('e-cat').value  = entry.cat;
  document.getElementById('e-note').value = entry.note || '';
  document.getElementById('edit-overlay').classList.add('open');
}

function closeEdit() {
  document.getElementById('edit-overlay').classList.remove('open');
  editId = null;
}

async function commitEdit() {
  const name = document.getElementById('e-name').value.trim();
  let   url  = document.getElementById('e-url').value.trim();
  const cat  = document.getElementById('e-cat').value;
  const note = document.getElementById('e-note').value.trim();
  if (!name || !url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const data = (await loadVault()).map(x => x.id === editId ? { ...x, name, url, cat, note } : x);
  await saveVault(data);
  closeEdit();
  render();
  toast('Entry updated');
}

// ── Copy ──
function copyUrl(url) {
  navigator.clipboard.writeText(url)
    .then(() => toast('URL copied to clipboard'))
    .catch(()  => toast('Copy failed'));
}

// ── Filter chips (event delegation) ──
function setFilter(cat) {
  filter = cat;
  render();
}

// ── Render ──
async function render() {
  const q    = (document.getElementById('search-input').value || '').toLowerCase();
  const data = await loadVault();

  const filtered = data.filter(b => {
    const matchCat = filter === 'all' || b.cat === filter;
    const matchQ   = !q || b.name.toLowerCase().includes(q)
                       || b.url.toLowerCase().includes(q)
                       || (b.note || '').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  // Chips — store filter value in data-cat attribute, no onclick
  const chips = document.getElementById('filter-chips');
  chips.innerHTML = CATS.map(c =>
    `<button class="chip${filter === c ? ' active' : ''}" data-cat="${c}">${c.toUpperCase()}</button>`
  ).join('');

  // Stats
  const cnt = { work:0, social:0, tools:0, learn:0, other:0 };
  data.forEach(b => { if (cnt[b.cat] !== undefined) cnt[b.cat]++; });
  document.getElementById('s-total').textContent = data.length;
  document.getElementById('s-work').textContent  = cnt.work;
  document.getElementById('s-tools').textContent = cnt.tools;
  document.getElementById('s-learn').textContent = cnt.learn;

  // Cards — store action + id in data attributes, no onclick
  const list = document.getElementById('vault-list');
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><span class="big">[ EMPTY ]</span><p>NO ENTRIES MATCH — ADD ONE ABOVE</p></div>`;
    return;
  }

  list.innerHTML = filtered.map((b, i) => `
    <div class="vault-card cat-${b.cat}" data-id="${b.id}">
      <div class="card-index">${String(i+1).padStart(2,'0')}</div>
      <div class="card-body">
        <div class="card-name">${esc(b.name)}</div>
        <div class="card-url"><a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(b.url)}</a></div>
        <div class="card-meta">
          <span class="cat-badge ${b.cat}">${b.cat.toUpperCase()}</span>
          ${b.note ? `<span class="card-note">// ${esc(b.note)}</span>` : ''}
          <span class="card-date">${b.date || ''}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="icon-btn open" data-action="open" data-url="${esc(b.url)}" title="Open link">&#8599;</button>
        <button class="icon-btn copy" data-action="copy" data-url="${esc(b.url)}" title="Copy URL">&#9000;</button>
        <button class="icon-btn edit" data-action="edit" title="Edit">&#9998;</button>
        <button class="icon-btn del"  data-action="del"  title="Delete">&#10005;</button>
      </div>
    </div>
  `).join('');
}

// ── Toast ──
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = '> ' + msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── Live sync from popup ──
chrome.storage.onChanged.addListener(changes => {
  if (changes[STORAGE_KEY]) render();
});

// ── All event listeners (no inline handlers) ──
document.addEventListener('DOMContentLoaded', () => {

  // Form buttons
  document.getElementById('add-btn').addEventListener('click', addBookmark);
  document.getElementById('clear-btn').addEventListener('click', clearForm);
  document.getElementById('update-btn').addEventListener('click', commitEdit);
  document.getElementById('cancel-edit-btn').addEventListener('click', closeEdit);

  // Search
  document.getElementById('search-input').addEventListener('input', render);

  // Edit overlay backdrop
  document.getElementById('edit-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeEdit();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEdit();
    if (e.key === 'Enter' && document.activeElement.id === 'f-url') addBookmark();
  });

  // ── Delegated: filter chips ──
  document.getElementById('filter-chips').addEventListener('click', e => {
    const chip = e.target.closest('[data-cat]');
    if (chip) setFilter(chip.dataset.cat);
  });

  // ── Delegated: card action buttons ──
  document.getElementById('vault-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('[data-id]');
    const id   = card ? card.dataset.id : null;
    const action = btn.dataset.action;
    const url    = btn.dataset.url || '';

    if (action === 'open')   window.open(url, '_blank');
    else if (action === 'copy')   copyUrl(url);
    else if (action === 'edit' && id) openEdit(id);
    else if (action === 'del'  && id) deleteEntry(id);
  });

  render();
});