const STORAGE_KEY = 'urlvault_v1';

let currentUrl  = '';
let currentName = '';

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

// ── Helpers ──
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;');
}

function setFeedback(msg, type = '') {
  const el = document.getElementById('feedback');
  el.textContent = '> ' + msg;
  el.className = 'feedback ' + type;
}

function flashField(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#c0503a';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 800);
}

// ── Auto-detect category ──
function guessCategory(url, title) {
  const u = (url + (title || '')).toLowerCase();
  if (/github|gitlab|bitbucket|vercel|netlify|aws|jira|notion|linear|asana|slack|figma|canva/.test(u)) return 'tools';
  if (/twitter|x\.com|instagram|facebook|linkedin|reddit|discord|tiktok|youtube/.test(u)) return 'social';
  if (/docs|learn|tutorial|course|udemy|coursera|medium|blog|dev\.to|stackoverflow|mdn|w3|wiki|edu/.test(u)) return 'learn';
  if (/mail|drive|meet|office|zoom|calendar|sheets|docs\.google/.test(u)) return 'work';
  return 'other';
}

// ── Save entry ──
async function saveEntry() {
  const name = document.getElementById('f-name').value.trim();
  const cat  = document.getElementById('f-cat').value;
  const note = document.getElementById('f-note').value.trim();

  if (!name) { flashField('f-name'); setFeedback('Name is required.', 'error'); return; }
  if (!currentUrl) { setFeedback('No URL captured.', 'error'); return; }

  const data = await loadVault();

  if (data.some(x => x.url === currentUrl)) {
    setFeedback('URL already in vault!', 'error');
    return;
  }

  data.unshift({ id: uid(), name, url: currentUrl, cat, note, date: today() });
  await saveVault(data);

  setFeedback('Saved to vault!', 'success');

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = '[ SAVED ✓ ]';

  await renderRecent();
}

// ── Reset form ──
function resetForm() {
  document.getElementById('f-name').value = currentName;
  document.getElementById('f-cat').value  = guessCategory(currentUrl, currentName);
  document.getElementById('f-note').value = '';
  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled    = false;
  saveBtn.textContent = '[ SAVE TO VAULT ]';
  setFeedback('Ready to capture.');
}

// ── Render recent list ──
async function renderRecent() {
  const data   = await loadVault();
  const list   = document.getElementById('recent-list');
  const recent = data.slice(0, 6);

  if (!recent.length) {
    list.innerHTML = '<div class="empty-recent">[ VAULT IS EMPTY ]</div>';
    return;
  }

  list.innerHTML = recent.map(b => `
    <div class="recent-item">
      <div class="recent-item-text">
        <div class="recent-item-name">${esc(b.name)}</div>
        <div class="recent-item-url">${esc(b.url)}</div>
      </div>
      <span class="recent-item-cat">${esc(b.cat)}</span>
    </div>
  `).join('');
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {

  // Wire buttons via addEventListener (no inline handlers — CSP compliant)
  document.getElementById('save-btn').addEventListener('click', saveEntry);
  document.getElementById('reset-btn').addEventListener('click', resetForm);
  document.getElementById('open-vault-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('vault/index.html') });
  });

  // Enter key in note field triggers save
  document.getElementById('f-note').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEntry();
  });

  // Get current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      setFeedback('Could not read current tab.', 'error');
      return;
    }

    currentUrl  = tab.url   || '';
    currentName = tab.title || '';

    const isInternal = /^(chrome|chrome-extension|about|edge|brave):\/\//i.test(currentUrl);

    document.getElementById('disp-name').textContent = currentName || 'Untitled';
    document.getElementById('disp-url').textContent  = currentUrl  || '—';
    document.getElementById('f-name').value          = currentName || '';

    if (isInternal) {
      document.getElementById('save-btn').disabled = true;
      setFeedback('Cannot save browser internal pages.', 'error');
    } else {
      document.getElementById('f-cat').value = guessCategory(currentUrl, currentName);
      setFeedback('Page captured. Ready to save.');
    }
  } catch (err) {
    setFeedback('Tab access error: ' + err.message, 'error');
  }

  await renderRecent();
});
