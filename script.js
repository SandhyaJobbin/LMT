/* =====================================================================
   LMT PLACES SIMULATOR — SETTINGS  (edit this block only)
   ===================================================================== */
const APP_CONFIG = {
  VERSION: '2.0',

  // Paste your Google Apps Script URL (ends in /exec) between the quotes so every
  // agent PC saves to the Google Sheet. Leave '' to run offline (browser storage).
  // Trainers can also paste it in Admin Portal → Settings (saved per browser).
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycby4Wr2UNaJdaqBS852Fq5TQpi7ULn44LGOtWXKrk0GwS_Z11asCM0u4rCo5pMiVEysq/exec',

  PASS_MARK: 80,            // % average score needed to pass a day
  QUESTIONS_PER_DAY: 10,
  MAX_DAYS: 10,             // days 1–5 ship built-in; 6–10 are free for your own questions
  TARGET_SECONDS: 420,      // shown on the guide page (manual research takes longer)

  // Offline admin password = SHA-256 of the password. Current password: Trainor123Password
  // To change: open the simulator, press F12 → Console, run  sha256('YourNewPassword')
  // and paste the result here.
  OFFLINE_ADMIN_SHA256: '994f02db05720c772b10b105750366234fc1f3bd8e643bb15a924a0a16c52e96',

  // Defaults used until the Google Sheet is connected (then the Sheet tabs take over)
  DEFAULT_TRAINERS: ['Jack Sparrow'],
  DEFAULT_COUNTRIES: ['India', 'Philippines', 'Malaysia', 'Sri Lanka', 'Bangladesh', 'Nepal', 'Pakistan', 'Indonesia', 'Vietnam', 'Thailand',
    'Singapore', 'China', 'Japan', 'South Korea', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Egypt', 'Morocco', 'South Africa',
    'Kenya', 'Nigeria', 'Ghana', 'Bulgaria', 'Romania', 'Poland', 'Hungary', 'Czech Republic', 'Greece', 'Portugal', 'Spain', 'Italy', 'France',
    'Germany', 'Netherlands', 'Ireland', 'United Kingdom', 'United States', 'Canada', 'Mexico', 'Jamaica', 'Dominican Republic', 'Colombia',
    'Brazil', 'Argentina', 'Peru', 'Chile', 'Australia', 'New Zealand', 'Other'],
  DEFAULT_WAVES: [{ code: 'PLACES-W1', name: 'Places New Hire Wave 1', trainer: 'Jack Sparrow', days: '1,2,3,4,5' }],
  DEFAULT_SESSIONS: [{ id: 'S-DEMO-D1', name: 'Demo Session', trainer: 'Jack Sparrow', day: 1, wave: '' }]
};

/* =====================================================================
   LMT PLACES SIMULATOR — CORE (utils, storage, API, config, question
   bank, login, guide, scoring)
   ===================================================================== */

/* ---------------- utilities ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const first = v => Array.isArray(v) ? v[0] : v;
const pad2 = n => String(n).padStart(2, '0');
const fmtTime = s => { s = Math.max(0, Math.round(s)); return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60); };
const nowIso = () => new Date().toISOString();
const uid = p => (p || '') + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 24);
const clone = o => JSON.parse(JSON.stringify(o));

function toast(msg, ms) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms || 2600);
}

/* localStorage with in-memory fallback (sandboxed iframes / private mode) */
const LS = (() => {
  const mem = {};
  let ok = true;
  try { localStorage.setItem('__lmt_t', '1'); localStorage.removeItem('__lmt_t'); } catch (e) { ok = false; }
  return {
    get(k, d) { try { const v = ok ? localStorage.getItem(k) : mem[k]; return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { const s = JSON.stringify(v); try { if (ok) localStorage.setItem(k, s); else mem[k] = s; } catch (e) { mem[k] = s; } },
    del(k) { try { if (ok) localStorage.removeItem(k); delete mem[k]; } catch (e) { } }
  };
})();

/* Compact SHA-256 (used only for the offline admin password check) */
function sha256(ascii) {
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  const maxWord = Math.pow(2, 32); let result = '', words = [], asciiBitLength;
  let hash = [], k = [], primeCounter = 0; const isComposite = {};
  for (let c = 2; primeCounter < 64; c++) {
    if (!isComposite[c]) {
      for (let i = 0; i < 313; i += c) isComposite[i] = c;
      hash[primeCounter] = (Math.pow(c, .5) * maxWord) | 0; k[primeCounter++] = (Math.pow(c, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);
  ascii = unescape(encodeURIComponent(ascii)); asciiBitLength = ascii.length * 8;
  ascii += '\x80'; while (ascii.length % 64 - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) { const j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
  words[words.length] = ((asciiBitLength / maxWord) | 0); words[words.length] = (asciiBitLength);
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16), oldHash = hash; hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
      const temp1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i]
        + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash); hash[4] = (hash[4] + temp1) | 0; hash.length = 8;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) { const b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16); }
  return result;
}

/* ---------------- constants ---------------- */
const DAY_META_BUILTIN = {
  1: { title: 'Fundamentals', icon: '🧭', desc: 'Real small properties: clean names, addresses, phones and pins.' },
  2: { title: 'Feed Clean-up', icon: '🧹', desc: 'Messy feeds — wrong case, wrong postal codes, wrong pins.' },
  3: { title: 'Parents & Geo Traps', icon: '🗺️', desc: 'Pick the right parent geo and fix pins that land in the wrong town.' },
  4: { title: 'Investigation', icon: '🕵️', desc: 'Duplicates, businesses that aren\'t hotels, and suspicious requests.' },
  5: { title: 'Final Mixed Mission', icon: '🏆', desc: 'Everything you\'ve learned — no warm-up.' }
};
const dayMeta = d => DAY_META_BUILTIN[d] || { title: 'Custom Day ' + d, icon: '📝', desc: 'Trainer-built cases.' };
const LEVELS = [[0, 'Trainee Mapper'], [600, 'Geo Scout'], [1500, 'Data Ranger'], [2700, 'Listing Pro'], [4000, 'Places Specialist'], [5200, 'LMT Master']];
const REQ_SECTIONS = { basic: 'Basic Info', contact: 'Contact Details', accom: 'Accommodation Info', geo: 'Geo Coding' };
const ATTRIBUTIONS = ['', 'Provider feed', 'Official website', 'Maps listing', 'Social media', 'Owner verified', 'Agent research'];
let GEO_BY_ID = Object.fromEntries(GEOS.map(g => [g.id, g]));
const geoLabel = id => { const g = GEO_BY_ID[id]; return g ? g.name + (g.path ? ', ' + g.path : '') : ''; };
const geoCity = id => { const g = GEO_BY_ID[id]; return g ? g.name.replace(/\s*\(.*\)$/, '') : ''; };
function levelFor(xp) {
  let i = 0; for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k][0]) i = k;
  const cur = LEVELS[i], nxt = LEVELS[i + 1];
  return { n: i + 1, name: cur[1], floor: cur[0], next: nxt ? nxt[0] : null, pct: nxt ? (xp - cur[0]) / (nxt[0] - cur[0]) : 1 };
}

/* ---------------- API layer ---------------- */
const API = {
  url() { return (LS.get('lmt_api_url', '') || APP_CONFIG.WEB_APP_URL || '').trim(); },
  configured() { return !!this.url(); },
  call(payload) {
    const u = this.url(); if (!u) return Promise.reject(new Error('offline'));
    const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), 30000);
    return fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), redirect: 'follow', signal: ctl ? ctl.signal : undefined })
      .then(r => r.json()).then(j => { if (!j || j.ok === false) throw new Error((j && j.error) || 'Server error'); return j; })
      .finally(() => clearTimeout(tm));
  }
};

/* ---------------- config ---------------- */
let CFG = null;
let ONLINE = false;
function defaultConfig() {
  return {
    trainers: APP_CONFIG.DEFAULT_TRAINERS.map(n => ({ name: n, active: true })),
    countries: APP_CONFIG.DEFAULT_COUNTRIES.map(n => ({ name: n, active: true })),
    waves: APP_CONFIG.DEFAULT_WAVES.map(w => Object.assign({ active: true }, w)),
    sessions: APP_CONFIG.DEFAULT_SESSIONS.map(s => Object.assign({ active: true }, s)),
    questions: [], builtinOff: []
  };
}
const isActive = v => !(v === false || v === 'FALSE' || v === 'false' || v === 0 || v === 'No' || v === 'NO' || v === 'N');
function normCfg(c) {
  const d = defaultConfig(); c = c || {};
  return {
    trainers: (c.trainers && c.trainers.length ? c.trainers : d.trainers).map(t => ({ name: String(t.name || '').trim(), active: isActive(t.active) })).filter(t => t.name),
    countries: (c.countries && c.countries.length ? c.countries : d.countries).map(t => ({ name: String(t.name || '').trim(), active: isActive(t.active) })).filter(t => t.name),
    waves: (c.waves || d.waves).map(w => ({ code: String(w.code || '').trim(), name: w.name || '', trainer: w.trainer || '', days: String(w.days || '1'), active: isActive(w.active), createdAt: w.createdAt || '' })).filter(w => w.code),
    sessions: (c.sessions || d.sessions).map(s => ({ id: String(s.id || '').trim(), name: s.name || s.id, trainer: s.trainer || '', day: Number(s.day) || 1, wave: s.wave || '', active: isActive(s.active), createdAt: s.createdAt || '' })).filter(s => s.id),
    questions: (c.questions || []).filter(q => q && q.id && q.feed && q.ans),
    builtinOff: (c.builtinOff || []).map(String)
  };
}
async function loadConfig() {
  const local = LS.get('lmt_cfg_local', null);
  CFG = normCfg(local || LS.get('lmt_cfg_cache', null));
  if (!local) { CFG.questions = LS.get('lmt_questions_local', CFG.questions); CFG.builtinOff = LS.get('lmt_builtin_off_local', CFG.builtinOff); }
  ONLINE = false;
  if (API.configured()) {
    try { const r = await API.call({ action: 'getConfig' }); CFG = normCfg(r.config); LS.set('lmt_cfg_cache', CFG); ONLINE = true; }
    catch (e) { console.warn('Config load failed – offline mode', e); }
  }
  registerQuestionGeos();
  renderConn(); fillLogin(); flushPending();
}
function renderConn() {
  const el = $('#connState'); if (!el) return;
  if (ONLINE) el.innerHTML = '<span class="dot on"></span>Connected · results save to Google Sheets';
  else if (API.configured()) el.innerHTML = '<span class="dot off"></span>Sheet unreachable · saving in this browser (auto-sync later)';
  else el.innerHTML = '<span class="dot off"></span>Offline mode · results saved in this browser';
  const p = LS.get('lmt_pending', []).length;
  $('#pendingState').textContent = p ? `⏳ ${p} result(s) waiting to sync` : '';
}

/* =====================================================================
   QUESTION BANK  (built-in CASES + trainer questions from template/form)
   A trainer question with the same Case ID as a built-in replaces it.
   ===================================================================== */
function registerQuestionGeos() {
  (CFG.questions || []).forEach(q => { [].concat(q.geos || [], q.geo ? [q.geo] : []).forEach(g => { if (g && g.id && !GEOS.some(x => x.id === g.id)) GEOS.push(g); }); });
  GEO_BY_ID = Object.fromEntries(GEOS.map(g => [g.id, g]));
}
function allQuestions() {
  const custom = CFG.questions || [];
  const ids = new Set(custom.map(q => q.id));
  const off = new Set(CFG.builtinOff || []);
  const builtins = CASES.filter(c => !ids.has(c.id)).map(c => Object.assign({}, c, { custom: false, active: !off.has(c.id) }));
  return builtins.concat(custom.map(q => Object.assign({}, q, { custom: true, active: isActive(q.active) })))
    .sort((a, b) => a.day - b.day || a.q - b.q);
}
function casesForDay(d) { return allQuestions().filter(c => c.active && Number(c.day) === Number(d)).slice(0, APP_CONFIG.QUESTIONS_PER_DAY); }
function availableDays() { const s = new Set(allQuestions().filter(c => c.active).map(c => Number(c.day))); return [...s].sort((a, b) => a - b); }

/* ---------- template columns (shared by template, upload, manual form, export) ---------- */
const TPL = [
  ['id', 'Case ID', 'Required. Unique code, e.g. C-001. Re-using a built-in ID (e.g. D1-03) REPLACES that built-in question.'],
  ['day', 'Day', 'Required. Training day 1–' + APP_CONFIG.MAX_DAYS + '. Each day plays its first ' + APP_CONFIG.QUESTIONS_PER_DAY + ' active questions by Q#.'],
  ['q', 'Q#', 'Required. Order inside the day (1, 2, 3 …).'],
  ['active', 'Active', 'Y or N. Default Y.'],
  ['feed.name', 'Feed Name', 'Required. Name exactly as the provider feed sends it (can be wrong on purpose).'],
  ['feed.brand', 'Feed Brand', 'Optional feed value.'],
  ['feed.street', 'Feed Street One', 'Optional feed value.'],
  ['feed.street2', 'Feed Street Two', 'Optional feed value.'],
  ['feed.postal', 'Feed Postal Code', 'Optional feed value.'],
  ['feed.parentText', 'Feed Parent Text', 'What appears in the red Parent box, e.g. "PH, Maramag".'],
  ['feed.phone', 'Feed Phone', 'Optional feed value.'],
  ['feed.email', 'Feed Email', 'Optional feed value.'],
  ['feed.url', 'Feed URL', 'Optional feed value.'],
  ['feed.type', 'Feed Accommodation Type', 'Optional. One of the types in the Lists sheet.'],
  ['feed.rooms', 'Feed Rooms', 'Optional number.'],
  ['feed.lat', 'Feed Latitude', 'Required. Where the feed pin starts (can be wrong on purpose).'],
  ['feed.lng', 'Feed Longitude', 'Required.'],
  ['feed.desc', 'Feed Description', 'Optional text the feed sent (can contain red flags).'],
  ['providerUrl', 'Provider Page URL', 'Optional real link opened by "Open Provider Page". Blank = a generated provider snapshot opens.'],
  ['ans.decision', 'Correct Action', 'Required. Approve, Alias, Reject, Tier 1, Tier 2 or Defer.'],
  ['ans.reason', 'Correct Reason', 'Required for Reject / Tier 1 / Tier 2 / Defer. Use a reason from the Lists sheet. Several accepted: separate with " | ".'],
  ['ans.match', 'Existing Tripadvisor Listing (Alias)', 'For Alias: the Tripadvisor URL or location ID (d123456). Blank = any Tripadvisor listing link is accepted.'],
  ['ans.name', 'Correct Name', 'Expected value. Blank = not scored. BLANK = agent must leave it empty. Several accepted: " | ".'],
  ['ans.brand', 'Correct Brand', 'Same rules. Must match a brand in the Lists sheet, or BLANK.'],
  ['ans.street', 'Correct Street One', 'Same rules.'],
  ['ans.street2', 'Correct Street Two', 'Same rules.'],
  ['ans.postal', 'Correct Postal Code', 'Same rules.'],
  ['parentLabel', 'Correct Parent (City, Region, Country)', 'Required. e.g. "Munnar, Idukki District, Kerala, India". Several accepted parents: separate with " | ". New places are added to the parent search automatically.'],
  ['ans.phone', 'Correct Phone', 'International format, e.g. +91 487 233 9104. Several accepted: " | ".'],
  ['ans.email', 'Correct Email', 'Same rules.'],
  ['ans.url', 'Correct URL', 'Official website with https://. BLANK if the property has none.'],
  ['ans.type', 'Correct Accommodation Type', 'From the Lists sheet. Use N/A for businesses with no rooms.'],
  ['ans.rooms', 'Correct Rooms', 'Number, or blank to skip.'],
  ['ans.floors', 'Correct Floors', 'Number, or blank to skip.'],
  ['ans.opening', 'Correct Opening Date', 'YYYY-MM-DD (for Defer / pre-opening cases), or blank.'],
  ['ans.allIncl', 'All Inclusive', 'Y or N, or blank to skip.'],
  ['ans.lat', 'Correct Latitude', 'Required. Decimal degrees, e.g. 10.0889 (south = negative).'],
  ['ans.lng', 'Correct Longitude', 'Required. Decimal degrees (west = negative).'],
  ['geoTol', 'Geo Tolerance (m)', 'Optional. Distance for full geo marks (default 150). Half marks up to 3× this.'],
  ['votes', 'Location Votes', 'Optional evidence shown in LMT. Format: "Closed: gate locked, sign says closed ;; Duplicate: same as xyz".'],
  ['owners', 'Owners Panel Notes', 'Optional evidence shown under Owners.'],
  ['audit', 'Audit Trail Notes', 'Optional evidence shown in AuditTrail.'],
  ['tip', 'Coaching Note', 'Required. Shown to the agent after they answer.'],
  ['source', 'Reference Link (trainers only)', 'Optional. Where you verified the answers (never shown to agents).']
];
const DEC_ALIASES = { approve: 'approve', 'approve - create new': 'approve', create: 'approve', alias: 'alias', 'add alias': 'alias', duplicate: 'alias', reject: 'reject', close: 'reject', 'tier 1': 't1', t1: 't1', tier1: 't1', 'tier 2': 't2', t2: 't2', tier2: 't2', defer: 'defer', 'in progress': 'defer' };
const reasonFromText = t => {
  const s = String(t || '').trim().toLowerCase(); if (!s) return '';
  if (REASONS[s]) return s;
  const hit = Object.entries(REASONS).find(([, r]) => r.label.toLowerCase() === s || r.label.toLowerCase().startsWith(s)); return hit ? hit[0] : null;
};
const multi = v => { const s = String(v == null ? '' : v).trim(); if (s === '') return undefined; if (s.toUpperCase() === 'BLANK') return ''; const p = s.split(/\s+\|\s+/).map(x => x.trim()).filter(Boolean); return p.length > 1 ? p : p[0]; };
const numOrU = v => { const s = String(v == null ? '' : v).trim(); if (s === '' ) return undefined; if (s.toUpperCase() === 'BLANK') return ''; const n = Number(s); return isNaN(n) ? NaN : n; };
const yn = v => { const s = String(v == null ? '' : v).trim().toUpperCase(); if (!s) return undefined; return ['Y', 'YES', 'TRUE', '1'].includes(s); };

/* template row (object keyed by TPL keys) → case object. Returns {q, errors[]} */
function rowToQuestion(r) {
  const err = [], g = k => String(r[k] == null ? '' : r[k]).trim();
  const id = g('id'); if (!id) err.push('Case ID missing');
  const day = Number(g('day')); if (!(day >= 1 && day <= APP_CONFIG.MAX_DAYS)) err.push('Day must be 1–' + APP_CONFIG.MAX_DAYS);
  const qn = Number(g('q')); if (!(qn >= 1)) err.push('Q# must be a number ≥ 1');
  if (!g('feed.name')) err.push('Feed Name missing');
  const flat = Number(g('feed.lat')), flng = Number(g('feed.lng'));
  if (g('feed.lat') === '' || isNaN(flat) || Math.abs(flat) > 90 || g('feed.lng') === '' || isNaN(flng) || Math.abs(flng) > 180) err.push('Feed Latitude/Longitude invalid');
  const dec = DEC_ALIASES[g('ans.decision').toLowerCase()]; if (!dec) err.push('Correct Action must be Approve, Alias, Reject, Tier 1, Tier 2 or Defer');
  let reason = g('ans.reason').split(/\s*\|\s*/).filter(Boolean).map(reasonFromText);
  if (reason.some(x => x === null)) { err.push('Unknown Correct Reason'); reason = []; }
  if (dec && reason.length && reason.some(x => REASONS[x].d !== dec)) err.push('Reason does not belong to action ' + dec);
  if (dec && !['approve', 'alias'].includes(dec) && !reason.length) err.push('Correct Reason required for this action');
  if (!reason.length && dec === 'approve') reason = ['new_verified'];
  if (!reason.length && dec === 'alias') reason = ['duplicate'];
  const plabel = g('parentLabel'); if (!plabel) err.push('Correct Parent missing');
  const alat = Number(g('ans.lat')), alng = Number(g('ans.lng'));
  if (g('ans.lat') === '' || isNaN(alat) || Math.abs(alat) > 90 || g('ans.lng') === '' || isNaN(alng) || Math.abs(alng) > 180) err.push('Correct Latitude/Longitude invalid');
  if (!g('tip')) err.push('Coaching Note missing');
  const types = [].concat(multi(g('ans.type')) || []); types.forEach(t => { if (t && t !== 'N/A' && !ACCOM_TYPES.includes(t)) err.push('Unknown accommodation type "' + t + '"'); });
  const brands = [].concat(multi(g('ans.brand')) || []); brands.forEach(b => { if (b && !BRANDS.includes(b)) err.push('Unknown brand "' + b + '" (add it to BRANDS in data.js or use BLANK)'); });
  ['ans.rooms', 'ans.floors'].forEach(k => { const v = numOrU(g(k)); if (typeof v === 'number' && isNaN(v)) err.push(k.split('.')[1] + ' must be a number'); });
  if (g('ans.opening') && !/^\d{4}-\d{2}-\d{2}$/.test(g('ans.opening'))) err.push('Opening date must be YYYY-MM-DD');
  // parent(s): reuse an existing geo when the label matches, else create one. Alternatives separated by " | ".
  const geos = [], parents = [];
  plabel.split(/\s+\|\s+/).map(s => s.trim()).filter(Boolean).forEach(lbl => {
    const ex = GEOS.find(x => norm(x.name + ', ' + x.path) === norm(lbl)) || GEOS.find(x => norm(x.name) === norm(lbl));
    if (ex && !ex.noParent) parents.push(ex.id);
    else { const parts = lbl.split(',').map(s => s.trim()).filter(Boolean); const geo = { id: 'cg_' + slug(lbl) + '_' + (sha256(lbl).slice(0, 4)), name: parts[0], path: parts.slice(1).join(', '), cc: '' }; geos.push(geo); parents.push(geo.id); }
  });
  const parent = parents.length > 1 ? parents : (parents[0] || '');
  const ans = { decision: dec, reason: reason.length > 1 ? reason : reason[0], parent, lat: alat, lng: alng };
  ['name', 'brand', 'street', 'street2', 'postal', 'phone', 'email', 'url', 'type'].forEach(k => { const v = multi(g('ans.' + k)); if (v !== undefined) ans[k] = v; });
  if (ans.type === 'N/A') ans.type = '';
  ['rooms', 'floors'].forEach(k => { const v = numOrU(g('ans.' + k)); if (v === '' || (typeof v === 'number' && !isNaN(v))) ans[k] = v; });
  if (g('ans.opening')) ans.opening = g('ans.opening');
  const ai = yn(g('ans.allIncl')); if (ai !== undefined) ans.allIncl = ai;
  if (g('ans.match')) ans.match = g('ans.match');
  const feed = { name: g('feed.name'), lat: flat, lng: flng };
  ['brand', 'street', 'street2', 'postal', 'parentText', 'phone', 'email', 'url', 'type', 'rooms', 'desc'].forEach(k => { if (g('feed.' + k)) feed[k] = g('feed.' + k); });
  const votes = g('votes') ? g('votes').split(/\s*;;\s*/).filter(Boolean).map(v => { const m = v.match(/^([^:]{2,20}):\s*(.*)$/); return { type: m ? m[1] : 'Comment', comment: m ? m[2] : v, user: 'community_member', email: '—', owner: 'No', date: '' }; }) : [];
  const q = {
    id, day, q: qn, active: yn(g('active')) !== false, feed, ans, geos, parentLabel: plabel, providerUrl: g('providerUrl'),
    geoTol: Number(g('geoTol')) > 0 ? Number(g('geoTol')) : undefined, req: 130000000 + (parseInt(sha256(id).slice(0, 6), 16) % 9000000),
    src: { votes, owners: g('owners') ? [{ name: 'Owner record', status: '', date: '', note: g('owners') }] : [], audit: g('audit') ? [{ date: '', who: 'Note', what: g('audit') }] : undefined },
    tip: g('tip'), source: g('source'), updatedAt: nowIso()
  };
  return { q, errors: err };
}
/* case object → template row (for export / edit form) */
function questionToRow(c) {
  const A = c.ans, F = c.feed, join = v => v === '' ? 'BLANK' : v === undefined || v === null ? '' : Array.isArray(v) ? v.map(x => x === '' ? 'BLANK' : x).join(' | ') : String(v);
  const D = { approve: 'Approve', alias: 'Alias', reject: 'Reject', t1: 'Tier 1', t2: 'Tier 2', defer: 'Defer' };
  const r = {
    id: c.id, day: c.day, q: c.q, active: c.active === false ? 'N' : 'Y', providerUrl: c.providerUrl || '',
    'ans.decision': D[A.decision], 'ans.reason': [].concat(A.reason || []).map(x => REASONS[x] ? REASONS[x].label : x).join(' | '), 'ans.match': A.match || '',
    parentLabel: c.parentLabel || [].concat(A.parent).map(geoLabel).join(' | '), 'ans.lat': A.lat, 'ans.lng': A.lng, geoTol: c.geoTol || '', tip: c.tip || '', source: c.source || '',
    'ans.opening': A.opening || '', 'ans.allIncl': A.allIncl === undefined ? '' : A.allIncl ? 'Y' : 'N',
    votes: ((c.src && c.src.votes) || []).map(v => v.type + ': ' + v.comment).join(' ;; '),
    owners: ((c.src && c.src.owners) || []).map(o => [o.name, o.status, o.note].filter(Boolean).join(' – ')).join(' ;; '),
    audit: ((c.src && c.src.audit) || []).map(a => a.what).join(' ;; ')
  };
  ['name', 'brand', 'street', 'street2', 'postal', 'phone', 'email', 'url', 'rooms', 'floors'].forEach(k => r['ans.' + k] = join(A[k]));
  r['ans.type'] = A.type === '' ? 'N/A' : join(A.type);
  ['name', 'brand', 'street', 'street2', 'postal', 'parentText', 'phone', 'email', 'url', 'type', 'rooms', 'lat', 'lng', 'desc'].forEach(k => r['feed.' + k] = F[k] == null ? '' : F[k]);
  return r;
}

/* ---------------- login ---------------- */
function fillLogin() {
  const opt = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;
  const c0 = $('#inCountry').value, t0 = $('#inTrainer').value, w0 = $('#inWave').value;
  $('#inCountry').innerHTML = opt('', '— Select country —') + CFG.countries.filter(x => x.active).map(x => opt(x.name, x.name, x.name === c0)).join('');
  $('#inTrainer').innerHTML = opt('', '— Select trainer —') + CFG.trainers.filter(x => x.active).map(x => opt(x.name, x.name, x.name === t0)).join('');
  $('#inWave').innerHTML = opt('', '— No wave —') + CFG.waves.filter(x => x.active).map(x => opt(x.code, x.code + (x.name ? ' · ' + x.name : ''), x.code === w0)).join('');
  const last = LS.get('lmt_last_login', null);
  if (last && !$('#inTid').value) {
    $('#inTid').value = last.trainingId || ''; $('#inName').value = last.name || '';
    if (last.country) $('#inCountry').value = last.country;
    if (last.trainer) $('#inTrainer').value = last.trainer;
  }
  refreshDaySession();
}
function refreshDaySession() {
  const wave = CFG.waves.find(w => w.code === $('#inWave').value);
  const trainer = $('#inTrainer').value;
  const daySel = $('#inDay'), dayFld = $('#dayFld');
  const curDay = daySel.value, avail = new Set(availableDays());
  if (wave) {
    const days = wave.days.split(/[,\s]+/).map(Number).filter(d => d >= 1 && d <= APP_CONFIG.MAX_DAYS && avail.has(d));
    daySel.innerHTML = '<option value="">— Select day —</option>' + days.map(d => `<option value="${d}"${String(d) === curDay ? ' selected' : ''}>Day ${d} · ${esc(dayMeta(d).title)}</option>`).join('');
    daySel.disabled = !!$('#inSession').value; dayFld.classList.toggle('locked', daySel.disabled);
    $('#dayLockTxt').textContent = daySel.disabled ? '(locked – session chosen)' : `(${days.length} unlocked)`;
  } else {
    daySel.innerHTML = '<option value="">— Select day —</option>'; daySel.disabled = true; dayFld.classList.add('locked');
    $('#dayLockTxt').textContent = '(locked – choose a wave)';
  }
  const curS = $('#inSession').value;
  const sess = CFG.sessions.filter(s => s.active && (!trainer || !s.trainer || s.trainer === trainer) && (!wave || !s.wave || s.wave === wave.code));
  $('#inSession').innerHTML = '<option value="">— Select session —</option>' + sess.map(s => `<option value="${esc(s.id)}"${s.id === curS ? ' selected' : ''}>${esc(s.name)} · Day ${s.day}</option>`).join('');
  validateLogin();
}
function validateLogin() {
  const tid = $('#inTid').value.trim(), name = $('#inName').value.trim();
  $('#errTid').textContent = tid && !/^[A-Za-z0-9-]{4,12}$/.test(tid) ? 'Use 4–12 letters/digits' : '';
  $('#errName').textContent = name && name.length < 3 ? 'Enter your full name' : '';
  const ok = /^[A-Za-z0-9-]{4,12}$/.test(tid) && name.length >= 3 && $('#inCountry').value && $('#inTrainer').value && ($('#inDay').value || $('#inSession').value);
  $('#btnLaunch').disabled = !ok;
  return !!ok;
}
function bindLogin() {
  ['#inTid', '#inName'].forEach(s => $(s).addEventListener('input', validateLogin));
  $('#inCountry').addEventListener('change', validateLogin);
  $('#inTrainer').addEventListener('change', refreshDaySession);
  $('#inWave').addEventListener('change', () => { $('#inSession').value = ''; refreshDaySession(); });
  $('#inDay').addEventListener('change', () => { if ($('#inDay').value) $('#inSession').value = ''; validateLogin(); });
  $('#inSession').addEventListener('change', () => { if ($('#inSession').value) $('#inDay').value = ''; refreshDaySession(); });
  $('#btnLaunch').addEventListener('click', () => {
    if (!validateLogin()) return;
    const sess = CFG.sessions.find(s => s.id === $('#inSession').value);
    const day = sess ? sess.day : Number($('#inDay').value);
    if (!casesForDay(day).length) return toast('⚠ Day ' + day + ' has no active questions yet — ask your trainer');
    S.user = {
      trainingId: $('#inTid').value.trim(), name: $('#inName').value.trim(), country: $('#inCountry').value,
      trainer: $('#inTrainer').value, wave: $('#inWave').value, session: sess ? sess.id : '', sessionName: sess ? sess.name : '', day
    };
    LS.set('lmt_last_login', S.user);
    showGuide();
  });
  $('#btnAdmin').addEventListener('click', openAdminLogin);
}
function show(id) { $$('.view').forEach(v => v.classList.toggle('active', v.id === id)); window.scrollTo(0, 0); }

/* ---------------- guide ---------------- */
function showGuide() {
  const d = S.user.day, m = dayMeta(d), n = casesForDay(d).length;
  const prof = profile();
  const dchip = k => `<span class="dchip" style="background:${DECISIONS[k].color}">${DECISIONS[k].icon} ${DECISIONS[k].short}</span>`;
  $('#guideWrap').innerHTML = `
  <div class="guide-hero">
    <h2>${m.icon} Day ${d} Mission · ${esc(m.title)}</h2>
    <p>Welcome, <b>${esc(S.user.name)}</b>. You are a Places agent working the <b>Location Tool (LMT)</b>. ${n} new-listing requests from the provider feed are waiting. For each one, research the property yourself in <b>Google Chrome</b>, fix the data in LMT, then take the right action. ${esc(m.desc)}</p>
    <div class="mission-meta"><span>📋 ${n} cases</span><span>🎯 Pass mark ${APP_CONFIG.PASS_MARK}%</span><span>⏱ Target ≤ ${Math.round(APP_CONFIG.TARGET_SECONDS / 60)} min per case</span><span>⭐ ${prof.xp} XP · ${levelFor(prof.xp).name}</span>${S.user.sessionName ? `<span>🧑‍🏫 ${esc(S.user.sessionName)}</span>` : ''}</div>
  </div>

  <div class="gsec"><h3><span class="n">1</span>The LMT request page — scroll from top to bottom</h3>
    <div class="steps5">
      <div class="s5"><i>🪪</i><b>Basic Info</b><p>Name, Brand, Street One/Two, Postal Code and <b>Parent</b> (search 🔍 and pick the most specific geo). Click <b>Apply</b>.</p></div>
      <div class="s5"><i>🔗</i><b>Provider Link</b><p>The embedded frame never loads — click <b>Open Provider Page in New Tab</b> to see what the feed partner sent.</p></div>
      <div class="s5"><i>📖</i><b>Contact</b><p>Phone (+country code), Fax, Email, official URL, a short Description and a thumbnail. <b>Apply</b>.</p></div>
      <div class="s5"><i>🏨</i><b>Accommodation</b><p>Opening date, floors, rooms, <b>Accommodation Type</b>, All-Inclusive. Read the Location Votes — they can hold clues.</p></div>
      <div class="s5"><i>📍</i><b>Geo Coding</b><p>Fix the pin: click the map, drag the marker or paste coordinates from Google Maps. Close to the real spot = full marks.</p></div>
    </div>
    <p style="font-size:12.5px;color:#6b7785;margin:10px 0 0">The left menu jumps to a section. When everything is applied, use the action buttons (bottom-right) or <b>Take Action</b> at the end of the page.</p>
  </div>

  <div class="gsec"><h3><span class="n">2</span>How to research (in your own Chrome)</h3>
    <ul class="rules">
      <li>Open a new Chrome tab and search the property: Google, Google Maps, the official website, Facebook and Instagram. <b>Helpful Links</b> (left menu) opens these searches for you.</li>
      <li>Always check <b>Tripadvisor</b> first. If the property is already listed (same address + phone), it's a duplicate — copy its Tripadvisor link and use <b>Add name as alias</b>.</li>
      <li>Get coordinates from Google Maps: right-click the property pin → click the numbers at the top to copy them.</li>
      <li>The <b>Requested Change</b> column is what the feed sent. Use <b>➜</b> to copy it across or <b>✖</b> to reject a wrong value. Feeds are often wrong!</li>
      <li>Check <b>AuditTrail</b>, <b>Owners</b> (beige bar) and <b>Location Votes</b> — internal evidence lives there.</li>
      <li>Trust order: official website › Google Maps › the property's own social pages › provider feed. Newest evidence wins.</li>
    </ul>
  </div>

  <div class="gsec"><h3><span class="n">3</span>Data-entry style rules</h3>
    <ul class="rules">
      <li><b>Name:</b> exactly as the property writes it, in Latin script. No city added unless it is part of the official name. Proper case, not ALL CAPS.</li>
      <li><b>Address:</b> expand abbreviations (St → Street, Rd → Road, HTL → Hotel). Building/floor in Street One, area or landmark in Street Two.</li>
      <li><b>Postal code:</b> only when a source confirms it. If no source shows one, leave it <b>blank</b>.</li>
      <li><b>Phone:</b> international format: <code>+91 487 233 9104</code>. Drop the local trunk "0" after the country code.</li>
      <li><b>URL:</b> official website only, starting with https://. Never a Facebook/Instagram/OTA link. No website → leave blank.</li>
      <li><b>Email:</b> the property's own contact address. Leave blank if no source shows one.</li>
      <li><b>Parent:</b> the most specific geo (village over district). Watch out for same-name places in other states or countries.</li>
      <li><b>Brand:</b> select only if the brand's own website lists the property. Otherwise leave blank.</li>
    </ul>
    <table class="gtable" style="margin-top:12px"><tr><th>Accommodation type</th><th>Use when…</th></tr>
      <tr><td>Hotel</td><td>Front desk, rooms, daily service — the default for most properties.</td></tr>
      <tr><td>Resort</td><td>Leisure property with extensive grounds/facilities (pools, spa, villas, activities).</td></tr>
      <tr><td>B&amp;B / Inn</td><td>Small owner-run property, usually with breakfast.</td></tr>
      <tr><td>Guest House / Hostel / Motel</td><td>Homestays &amp; small guest houses · dorm-style budget beds · roadside drive-up rooms.</td></tr>
      <tr><td>Specialty Lodging</td><td>Treehouses, cave hotels, eco-lodges, cabins, ryokans, houseboats.</td></tr>
      <tr><td>Apartment Hotel / Campground</td><td>Serviced apartments &amp; studios with housekeeping · glamping, camps.</td></tr>
      <tr><td>Not applicable</td><td>The business has no bookable rooms (café, coworking, venue, monument, travel agency).</td></tr>
    </table>
  </div>

  <div class="gsec"><h3><span class="n">4</span>Decision matrix — pick ONE action per case</h3>
    <table class="gtable">
      <tr><th style="width:170px">Action</th><th>When to use it</th><th style="width:260px">Reasons</th></tr>
      <tr><td>${dchip('approve')}</td><td>Property exists, is open, is an accommodation, not on Tripadvisor yet, and sources agree.</td><td>New property – verified</td></tr>
      <tr><td>${dchip('alias')}</td><td>Tripadvisor already has it (same address + phone), even under another or older name. Paste the existing listing link.</td><td>Existing listing – add alias</td></tr>
      <tr><td>${dchip('reject')}</td><td>Permanently closed · not an accommodation · zero evidence it exists anywhere online.</td><td>Closed · Not an accommodation · Unverifiable</td></tr>
      <tr><td>${dchip('t1')}</td><td>Real property, but sources conflict (address, phone, location) and you can't decide which is right.</td><td>Conflicting data · Location unconfirmed</td></tr>
      <tr><td>${dchip('t2')}</td><td>Fraud/scam signals, brand or ownership disputes, safety or legal issues. Never just reject these.</td><td>Fraud · Brand dispute · Safety/legal</td></tr>
      <tr><td>${dchip('defer')}</td><td>Real but not open yet — capture data incl. Opening Date and keep it In Progress.</td><td>Pre-opening</td></tr>
    </table>
  </div>

  <div class="gsec"><h3><span class="n">5</span>Scoring &amp; XP</h3>
    <table class="gtable">
      <tr><th>Component</th><th>Points</th><th>Notes</th></tr>
      <tr><td>Correct action</td><td>30</td><td>Wrong action = only 30% of your data-capture score. Approving a duplicate, closed, fake or escalation case = <b>critical error, 0 points</b>.</td></tr>
      <tr><td>Correct reason</td><td>10</td><td>Automatic for Approve / Alias.</td></tr>
      <tr><td>Data capture</td><td>60</td><td>Weighted field accuracy: Name 10 · Parent 8 · Type 8 · Street 6 · Phone 6 · Geo 6 · Postal/Email/URL/Rooms/Brand/Opening 4 · Street Two/Floors/All-incl. 2. For Alias it's the Tripadvisor link; for Reject/Escalate it's earned by the correct action.</td></tr>
      <tr><td>XP bonuses</td><td>+5 … +40</td><td>Speed (≤6 min +15, ≤10 min +5) and a streak of ≥80% cases (+5 per case in a row, max +25).</td></tr>
    </table>
    <p style="font-size:12.5px;color:#6b7785;margin:10px 0 0">Badges: 💎 Flawless · 🎯 Geo Sniper · 🕵️ Fraud Hound · 🧬 Duplicate Detective · ⚡ Speed Runner · 🔥 Hot Streak · 🛡️ Zero Critical.</p>
  </div>

  <div class="guide-cta">
    <button class="btn btn-ghost" id="gBack">← Back to login</button>
    <span style="font-size:13px;color:#6b7785">Day ${d} · ${esc(m.title)} · ${n} cases</span>
    <button class="btn btn-pri" id="gStart">Start Mission ▶</button>
  </div>`;
  $('#gBack').onclick = () => show('v-login');
  $('#gStart').onclick = startGame;
  show('v-guide');
}

/* ---------------- agent profile (local XP across days) ---------------- */
function profile() { return LS.get('lmt_profile_' + (S.user ? S.user.trainingId : 'x'), { xp: 0, days: {} }); }
function saveProfile(p) { LS.set('lmt_profile_' + S.user.trainingId, p); }

/* =====================================================================
   SCORING ENGINE
   ===================================================================== */
const ABBR = { st: 'street', str: 'street', rd: 'road', ave: 'avenue', av: 'avenue', blvd: 'boulevard', ln: 'lane', dr: 'drive', hwy: 'highway', nr: 'near', opp: 'opposite',
  gen: 'general', p: 'purok', jl: 'jalan', jr: 'jiron', mah: 'mahallesi', sok: 'sokak', htl: 'hotel', rte: 'route', pl: 'place', sq: 'square', apt: 'apartment', fl: 'floor', bldg: 'building', po: 'post', 'p o': 'post' };
function norm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase()
    .replace(/&/g, ' and ').replace(/[–—]/g, '-').replace(/[^a-z0-9぀-ヿ一-鿿฀-๿]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function normStreet(s) { return norm(s).split(' ').map(w => (ABBR[w] !== undefined ? ABBR[w] : w)).filter(Boolean).join(' '); }
function lev(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const simRatio = (a, b) => { if (!a && !b) return 1; return 1 - lev(a, b) / Math.max(a.length, b.length); };
const digits = s => String(s || '').replace(/\D/g, '');
const normUrl = s => String(s || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const taId = s => { const m = String(s || '').match(/(?:^|[^a-z0-9])d(\d{4,})(?:[^0-9]|$)/i) || String(s || '').match(/^(\d{4,})$/); return m ? m[1] : ''; };
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const FIELD_DEFS = [
  { k: 'name', label: 'Name', w: 10 }, { k: 'parent', label: 'Parent', w: 8 }, { k: 'type', label: 'Accommodation Type', w: 8 },
  { k: 'street', label: 'Street One', w: 6 }, { k: 'phone', label: 'Phone', w: 6 }, { k: 'geo', label: 'Geo Coding', w: 6 },
  { k: 'postal', label: 'Postal Code', w: 4 }, { k: 'email', label: 'Email', w: 4 }, { k: 'url', label: 'URL', w: 4 },
  { k: 'rooms', label: 'Rooms', w: 4 }, { k: 'brand', label: 'Brand', w: 4 }, { k: 'opening', label: 'Opening Date', w: 4 },
  { k: 'street2', label: 'Street Two', w: 2 }, { k: 'floors', label: 'Floors', w: 2 }, { k: 'allIncl', label: 'All Inclusive', w: 2 }
];

function scoreField(k, expRaw, f, tol) {
  const exps = Array.isArray(expRaw) ? expRaw : [expRaw];
  const show = v => (v === '' ? '(blank)' : String(v));
  const expShow = show(exps[0]);
  const res = (frac, note) => ({ status: frac >= 1 ? 'ok' : frac > 0 ? 'partial' : 'wrong', frac, note: note || '', exp: expShow });
  if (k === 'geo') {
    const full = tol || 150;
    const lat = parseFloat(f.lat), lng = parseFloat(f.lng);
    if (isNaN(lat) || isNaN(lng)) return Object.assign(res(0, 'No coordinates'), { exp: `${expRaw.lat}, ${expRaw.lng}` });
    const d = haversine(lat, lng, expRaw.lat, expRaw.lng);
    const ds = d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(d < 10000 ? 1 : 0) + ' km';
    const r = d <= full ? res(1, ds + ' off') : d <= full * 3 ? res(.5, ds + ' off – close, but re-check Google Maps') : res(0, ds + ' off');
    r.exp = `${expRaw.lat}, ${expRaw.lng}`; r.dist = d; return r;
  }
  let given = f[k];
  if (k === 'allIncl') { const g = !!given; return exps.some(e => !!e === g) ? res(1) : res(0, g ? 'Not all-inclusive' : 'Property is all-inclusive'); }
  if (k === 'type' && given === 'N/A') given = '';
  given = given == null ? '' : String(given).trim();
  let best = res(0);
  for (const e0 of exps) {
    const e = e0 == null ? '' : String(e0).trim();
    let r;
    if (e === '') r = given === '' ? res(1) : res(0, 'Should be blank – no reliable source shows this');
    else if (given === '') r = res(0, 'Missing');
    else if (k === 'name' || k === 'street' || k === 'street2') {
      const a = k === 'name' ? norm(given) : normStreet(given), b = k === 'name' ? norm(e) : normStreet(e);
      const sr = simRatio(a, b);
      r = sr >= .92 ? res(1) : sr >= .75 ? res(.5, 'Close – check spelling/format') : res(0);
      const caps = given.replace(/[^A-Za-z]/g, '');
      if (r.frac === 1 && caps.length >= 4 && given === given.toUpperCase() && e !== e.toUpperCase()) r = res(.5, 'Use proper case, not ALL CAPS');
    } else if (k === 'phone') {
      const a = digits(given), b = digits(e), a0 = a.replace(/^0+/, '');
      if (a === b && given.trim().startsWith('+')) r = res(1);
      else if (a === b) r = res(.5, 'Add “+” and country code');
      else if (a0.length >= 7 && b.endsWith(a0)) r = res(.5, 'Missing country code – use international format');
      else r = res(0);
    } else if (k === 'email') r = given.toLowerCase() === e.toLowerCase() ? res(1) : res(0);
    else if (k === 'url') r = normUrl(given) === normUrl(e) ? (/^https?:\/\//i.test(given) ? res(1) : res(.5, 'Start with https://')) : res(0);
    else if (k === 'postal') r = norm(given).replace(/ /g, '') === norm(e).replace(/ /g, '') ? res(1) : res(0);
    else if (k === 'rooms' || k === 'floors') r = parseInt(given, 10) === parseInt(e, 10) ? res(1) : res(0);
    else r = given === e ? res(1) : res(0);
    if (r.frac > best.frac) best = r; else if (best.frac === 0 && !best.note) best = r;
  }
  best.exp = expShow; return best;
}

function scoreCase(c, cs, dec) {
  const A = c.ans, f = cs.f;
  const expD = A.decision, decisionOk = dec.decision === expD;
  const reasons = [].concat(A.reason);
  const reasonOk = decisionOk && (['approve', 'alias'].includes(expD) || reasons.includes(dec.reason));
  const mode = expD === 'alias' ? 'match' : ['reject', 't1', 't2'].includes(expD) ? 'decision' : 'fields';
  const fields = [];
  let earned = 0, possible = 0;
  for (const d of FIELD_DEFS) {
    const exp = d.k === 'geo' ? { lat: A.lat, lng: A.lng } : A[d.k];
    if (exp === undefined || exp === null) continue;
    const r = scoreField(d.k, exp, f, c.geoTol);
    const given = d.k === 'geo' ? (f.lat !== '' ? `${f.lat}, ${f.lng}` : '') : d.k === 'parent' ? geoLabel(f.parent) : d.k === 'allIncl' ? (f.allIncl ? 'Yes' : 'No') : f[d.k];
    const expShow = d.k === 'parent' ? geoLabel(first(exp)) : d.k === 'allIncl' ? (exp ? 'Yes' : 'No') : r.exp;
    fields.push({ k: d.k, label: d.label, w: d.w, status: r.status, frac: r.frac, note: r.note, exp: expShow, given: given == null || given === '' ? '(blank)' : String(given), dist: r.dist });
    earned += d.w * r.frac; possible += d.w;
  }
  const fieldsPct = possible ? earned / possible : 1;
  // Alias: agent pastes the existing Tripadvisor listing link / ID
  let matchOk = false;
  if (dec.decision === 'alias') {
    const got = taId(dec.match), want = taId(A.match);
    matchOk = want ? got === want : (!!got && /tripadvisor\./i.test(dec.match || '')) || !!got;
  }
  let score, critical = false;
  if (decisionOk) {
    const capture = mode === 'fields' ? fieldsPct : mode === 'match' ? (matchOk ? 1 : 0) : 1;
    score = 30 + (reasonOk ? 10 : 0) + 60 * capture;
  } else {
    score = 30 * fieldsPct;
    if (dec.decision === 'approve' && ['reject', 't2', 't1', 'alias'].includes(expD)) { critical = true; score = 0; }
    if (dec.decision === 'reject' && expD === 't2') { critical = true; score = 0; }
  }
  return { score: Math.round(score), decisionOk, reasonOk, matchOk, mode, fields, fieldsPct, critical };
}

/* =====================================================================
   LMT PLACES SIMULATOR — GAME (LMT request page, decisions, feedback,
   results, sync). Agents research in their own Chrome tabs.
   ===================================================================== */
const S = { user: null, cases: [], idx: 0, cs: null, results: [], xp: 0, streak: 0, bestStreak: 0, attemptId: '', startedAt: '', timer: null, map: null, marker: null, hideEmpty: false };

/* ---------------- in-tool (LMT internal) evidence ---------------- */
function SRC(c) {
  if (c._src) return c._src;
  const F = c.feed, o = c.src || {};
  const seed = (c.req || 1234567) % 97;
  const s = {};
  s.provider = Object.assign({
    name: F.name, address: [F.street, F.street2, F.postal].filter(Boolean).join(', ') + (F.parentText ? ' · ' + F.parentText : ''),
    type: F.type || 'Hotel', rooms: F.rooms || '—', rating: (3.6 + (seed % 14) / 10).toFixed(1),
    id: 'HP-' + (500000 + (c.req || 0) % 400000), desc: F.desc || ''
  }, o.provider || {});
  s.votes = o.votes || [];
  s.owners = o.owners || [];
  s.audit = o.audit || [{ date: '2026-10-0' + (1 + seed % 7) + ' 0' + (seed % 9) + ':1' + (seed % 6), who: 'Hopper feed', what: 'Request created – new property submitted by provider' }];
  c._src = s; return s;
}

/* ---------------- game start ---------------- */
function startGame() {
  S.cases = casesForDay(S.user.day).map(c => Object.assign({}, c, { _src: null }));
  if (!S.cases.length) return toast('No active questions for this day');
  S.idx = 0; S.results = []; S.xp = 0; S.streak = 0; S.bestStreak = 0;
  S.attemptId = uid('A-'); S.startedAt = nowIso();
  $('#lmtUser').textContent = S.user.trainingId;
  $('#hudDay').textContent = 'DAY ' + S.user.day;
  $('#hudTotal').textContent = S.cases.length;
  show('v-game');
  loadCase();
  clearInterval(S.timer);
  S.timer = setInterval(() => { if (S.cs) $('#hudTimer').textContent = fmtTime((Date.now() - S.cs.start) / 1000); }, 1000);
}
function newCaseState(c) {
  return {
    applied: {}, rej: {}, locks: {}, attr: {}, start: Date.now(), notes: '', pre: '', providerSeen: false, emails: 0,
    f: { name: '', brand: '', former: '', street: '', street2: '', postal: '', parent: '', phone: '', fax: '', email: '', url: '', desc: '', thumb: '', opening: '', floors: '', rooms: '', type: '', allIncl: false, lat: String(c.feed.lat), lng: String(c.feed.lng) }
  };
}
function curCase() { return S.cases[S.idx]; }
function loadCase() {
  S.cs = newCaseState(curCase());
  renderHud(); renderLeft(); renderPage(); window.scrollTo(0, 0);
}

/* ---------------- HUD ---------------- */
function renderHud() {
  $('#hudCase').textContent = S.idx + 1;
  $('#hudDots').innerHTML = S.cases.map((c, i) => {
    const r = S.results[i]; let cls = '';
    if (r) cls = r.score >= 80 ? 'good' : r.score >= 50 ? 'mid' : 'bad'; else if (i === S.idx) cls = 'cur';
    return `<i class="${cls}" title="Case ${i + 1}${r ? ' · ' + r.score + '%' : ''}"></i>`;
  }).join('');
  const total = profile().xp + S.xp, L = levelFor(total);
  $('#hudXp').textContent = S.xp;
  $('#hudXpBar').style.width = Math.round(L.pct * 100) + '%';
  $('#hudLevel').textContent = `Lv ${L.n} · ${L.name}`;
  $('#hudStreak').textContent = '🔥 ' + S.streak;
  $('#hudStreak').classList.toggle('hot', S.streak >= 3);
}

/* ---------------- left panel ---------------- */
const NAV_ITEMS = [['Basic Info', 'sec-basic'], ['Contact Details', 'sec-contact'], ['Description', 'sec-desc'], ['Photos', 'sec-photos'], ['Accommodation Info', 'sec-accom'], ['Pricing', ''], ['Commerce Links', 'sec-commerce'], ['Amenities', ''], ['Internal', ''], ['Location Votes', 'sec-votes'], ['DaoDao Info', ''], ['Geo Coding', 'sec-geo']];
function renderLeft() {
  const c = curCase();
  $('#lReq').textContent = c.req; $('#lFeed').textContent = 'Hopper';
  $('#navList').innerHTML = NAV_ITEMS.map(([t, id]) => `<div data-jump="${id}" class="${id ? '' : 'dim'}">${t}</div>`).join('');
}
function updateEndInfo() {
  const cs = S.cs, el = $('#endInfo'); if (!el) return;
  const done = Object.keys(REQ_SECTIONS).filter(k => cs.applied[k]);
  el.innerHTML = `Applied <b>${done.length}/4</b> required sections · ${Object.entries(REQ_SECTIONS).map(([k, l]) => (cs.applied[k] ? '✔ ' : '○ ') + l).join(' · ')}${cs.pre ? ` · Pre-selected: <b>${DECISIONS[cs.pre].short}</b>` : ''}`;
}

/* ---------------- page rendering (all sections, one scrolling page) ---------------- */
function attrSel(key) {
  const v = S.cs.attr[key] || '';
  return `<select data-attr="${key}">${ATTRIBUTIONS.map(a => `<option${a === v ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select>`;
}
function lockBtn(key) { return `<button class="lockbtn ${S.cs.locks[key] ? 'on' : ''}" data-lock="${key}" title="Lock field">🔒</button>`; }
function row(o) {
  const cs = S.cs, key = o.key;
  const fv = o.feed === undefined || o.feed === null ? '' : String(o.feed);
  const hasFeed = fv !== '';
  const empty = !hasFeed && !(cs.f[key]) && !o.always;
  return `<div class="lrow ${empty ? 'empty' : ''}" data-row="${key}" ${empty && S.hideEmpty ? 'style="display:none"' : ''}>
    <div class="lbl ${o.reqd ? 'reqd' : ''}">${o.label}:</div>
    <div class="rq ${cs.rej[key] ? 'rej' : ''} ${o.redFeed ? 'red' : ''}">${esc(fv)}</div>
    <div class="act">${hasFeed && o.act !== false ? `<button class="ibtn" data-rej="${key}" title="Reject requested change">✖</button><button class="ibtn" data-copy="${key}" title="Accept requested change">➜</button>` : ''}</div>
    <div class="inp">${o.input}<div class="msg" data-msg="${key}">${o.msg || ''}</div></div>
    <div class="lock">${o.lock === false ? '' : lockBtn(key)}</div>
    <div class="attr">${o.attr === false ? '' : attrSel(key)}</div>
  </div>`;
}
const txt = (k, cls, ph) => `<input type="text" data-f="${k}" class="${cls || ''}" value="${esc(S.cs.f[k])}" placeholder="${ph || ''}">`;
function applyBtn(sec) { const a = S.cs.applied[sec]; return `<button class="btn-apply ${a ? 'applied' : ''}" data-apply="${sec}">${a ? '✔ Applied' : '☑ Apply'}</button>`; }
function secHead(ico, title, extra) { return `<div class="sec-h"><h4><span class="ico">${ico}</span>${title}</h4>${extra || ''}</div><button class="sec-min" title="Collapse">-</button>`; }

function renderPage() {
  const c = curCase(), cs = S.cs, F = c.feed, src = SRC(c);
  if (S.map) { try { S.map.remove(); } catch (e) { } S.map = null; S.marker = null; }
  const pLabel = cs.f.parent ? geoLabel(cs.f.parent) : (F.parentText || '');
  const thumbs = ['linear-gradient(135deg,#3a7bd5,#00d2ff)', 'linear-gradient(135deg,#f7971e,#ffd200)', 'linear-gradient(135deg,#11998e,#38ef7d)', 'linear-gradient(135deg,#8e2de2,#4a00e0)'];
  const tl = ['Exterior', 'Lobby', 'Room', 'Pool / view'];
  $('#casePane').innerHTML = `
  <div class="sec" id="sec-basic">${secHead('🪪', 'Basic Info', applyBtn('basic') + `<button class="btn-alias" data-pre="alias">＋ Add name as alias</button><button class="btn-createnew" data-pre="approve">✔＋ Not match, create new</button>`)}
    ${row({ key: 'name', label: 'Name', feed: F.name, reqd: true, redFeed: true, always: true, input: txt('name', cs.f.name ? '' : 'invalid'), msg: cs.f.name ? '' : 'Please provide a name' })}
    ${row({ key: 'brand', label: 'Brand', feed: F.brand, always: true, lock: false, input: `<select data-f="brand"><option value="">Select Brand …</option>${BRANDS.map(b => `<option${b === cs.f.brand ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>` })}
    ${row({ key: 'former', label: 'Former Name', always: true, lock: false, input: txt('former') })}
    ${row({ key: 'street', label: 'Street One', feed: F.street, always: true, input: txt('street') })}
    ${row({ key: 'street2', label: 'Street Two', feed: F.street2, always: true, input: txt('street2') })}
    ${row({ key: 'postal', label: 'Postal Code', feed: F.postal, always: true, input: txt('postal', 'w-sm') })}
    ${row({ key: 'parent', label: 'Parent', reqd: true, always: true, act: false, input: `<div class="parent-box"><input type="text" readonly id="parentShow" class="${cs.f.parent ? 'ok' : ''}" value="${esc(pLabel)}"><button class="ibtn" style="width:32px;height:28px" data-parent="1" title="Search parent">🔍</button></div>`, msg: cs.f.parent ? '' : 'Please search for and select a parent' })}
    ${row({ key: 'linked', label: 'Linked Locations', always: true, lock: false, act: false, input: `<div style="display:flex;gap:6px;flex-wrap:wrap"><select data-inert="1"><option>Select a relationship</option><option>Part of</option><option>Near</option></select><input type="text" data-inert="1" placeholder="Search for a location by name" style="max-width:200px"><button class="ibtn" style="background:#b39ddb;color:#fff;width:28px" data-inert="1">+</button></div>` })}
    ${row({ key: 'vgeo', label: 'Virtual Geos', always: true, lock: false, act: false, attr: false, input: `<div style="font-size:11.5px;color:#888">Virtual Geo · Link Information — none</div>` })}
  </div>

  <div class="sec" id="sec-provider">${secHead('🔗', 'Provider Link')}
    <div class="lrow"><div class="lbl">Provider Link:</div><div style="grid-column:2 / span 4">Provider: <b>Hopper</b> <button class="btn-prov" data-openprov="1">Open Provider Page in New Tab</button>
      <span class="prov-status" id="provStatus" style="color:#17663e">${cs.providerSeen ? '✔ Provider page opened' : ''}</span>
      <div class="prov-frame" style="margin-top:6px"><div class="sad">📄</div><div style="font-size:12px">hopper.com refused to connect.</div></div></div><div class="attr">${attrSel('provider')}</div></div>
  </div>

  <div class="sec" id="sec-contact">${secHead('📖', 'Contact Details', applyBtn('contact'))}
    ${row({ key: 'phone', label: 'Phone', feed: F.phone, always: true, input: txt('phone', '', '+CC …') })}
    ${row({ key: 'fax', label: 'Fax', feed: F.fax, always: true, input: txt('fax') })}
    ${row({ key: 'email', label: 'Email', feed: F.email, always: true, input: txt('email') })}
    ${row({ key: 'url', label: 'URL', feed: F.url, always: true, input: txt('url', '', 'https://') })}
  </div>
  <div class="sec" id="sec-desc">${secHead('💬', 'Description', applyBtn('desc'))}
    ${row({ key: 'desc', label: 'Description', feed: F.desc, always: true, input: `<textarea data-f="desc" placeholder="1–3 factual sentences: type, setting, key facilities. No prices, no superlatives.">${esc(cs.f.desc)}</textarea>` })}
  </div>
  <div class="sec" id="sec-photos">${secHead('🖼️', 'Photos', applyBtn('photos'))}
    ${row({ key: 'thumb', label: 'Primary Thumbnail', always: true, lock: false, act: false, input: `<div style="font-style:italic;font-size:12px;margin-bottom:6px" id="thumbTxt">${cs.f.thumb ? 'Selected: ' + esc(cs.f.thumb) : 'Property Needs Thumbnail'}</div><div class="thumbs">${thumbs.map((g, i) => `<div class="thumb ${cs.f.thumb === tl[i] ? 'sel' : ''}" style="background:${g}" data-thumb="${tl[i]}">${tl[i]}</div>`).join('')}</div>` })}
  </div>

  <div class="sec" id="sec-accom">${secHead('🏨', 'Accommodation Info', applyBtn('accom'))}
    ${row({ key: 'opening', label: 'Opening Date', always: true, lock: false, input: `<input type="date" data-f="opening" class="w-sm" value="${esc(cs.f.opening)}">` })}
    ${row({ key: 'floors', label: 'Floors', always: true, lock: false, input: `<input type="number" min="0" data-f="floors" class="w-xs" value="${esc(cs.f.floors)}">` })}
    ${row({ key: 'rooms', label: 'Rooms', feed: F.rooms, always: true, input: `<input type="number" min="0" data-f="rooms" class="w-xs" value="${esc(cs.f.rooms)}">` })}
    ${row({ key: 'type', label: 'Accommodation Type', feed: F.type, reqd: true, always: true, input: `<select data-f="type" class="${cs.f.type ? '' : 'invalid'}"><option value="">Select Type …</option>${ACCOM_TYPES.map(t => `<option${t === cs.f.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}<option value="N/A"${cs.f.type === 'N/A' ? ' selected' : ''}>Not applicable (no rooms)</option></select>`, msg: cs.f.type ? '' : 'Please select an accommodation type' })}
    ${row({ key: 'allIncl', label: 'AllInclusive', always: true, lock: false, input: `<input type="checkbox" data-f="allIncl" ${cs.f.allIncl ? 'checked' : ''}>` })}
    ${row({ key: 'star', label: 'Star Rating', always: true, lock: false, act: false, input: `<div class="star-tbl"><span>Priority</span><span>Source</span><span>Rating</span></div><div style="font-size:11.5px;color:#999;padding:4px 10px">No star ratings on record</div>` })}
  </div>
  <div class="sec" id="sec-votes">${secHead('👍', 'Location Votes')}
    <input class="votes-search" id="votesSearch" placeholder="Search">
    <table class="votes-tbl" id="votesTbl"><thead><tr><th>Type</th><th>Comment</th><th>Username</th><th>Email</th><th>Owner?</th><th>Date/Time ↑</th></tr></thead>
    <tbody>${src.votes.length ? src.votes.map(v => `<tr><td>${esc(v.type)}</td><td>${esc(v.comment)}</td><td>${esc(v.user)}</td><td>${esc(v.email)}</td><td>${esc(v.owner)}</td><td>${esc(v.date)}</td></tr>`).join('') : '<tr><td colspan="6" style="color:#999">No location votes</td></tr>'}</tbody></table>
  </div>
  <div class="sec" id="sec-commerce">${secHead('🛒', 'Commerce Links')}
    <table class="votes-tbl"><thead><tr><th>Provider</th><th>Provider ID</th><th>Status</th></tr></thead><tbody><tr><td>Hopper</td><td>${esc(src.provider.id)}</td><td>Pending match</td></tr></tbody></table>
  </div>

  <div class="sec" id="sec-geo">${secHead('📍', 'Geo Coding', applyBtn('geo'))}
    <div style="padding:0 6px">
      <div class="geo-inputs">Latitude <input id="geoLat" data-f="lat" value="${esc(cs.f.lat)}"> Longitude <input id="geoLng" data-f="lng" value="${esc(cs.f.lng)}">
        <button class="btn-apply" id="geoGo">📍 Move pin</button><button class="btn-apply" id="geoPaste">⇩ Paste "lat, lng"</button><button class="btn-apply" id="geoReset">↺ Reset to feed</button>
        <span style="font-size:11.5px;color:#777">Tip: click the map, drag the marker, or paste coordinates copied from Google Maps.</span></div>
      <div id="map"></div>
      <table class="geo-tbl"><thead><tr><th>Source</th><th>Last Updated</th><th>Latitude/Longitude</th></tr></thead><tbody>
        <tr><td>Hopper feed</td><td>${esc(src.audit[0].date || '—')}</td><td>${F.lat}, ${F.lng}</td></tr>
        <tr><td>Agent (you)</td><td id="geoState">${cs.applied.geo ? 'Applied' : 'Not applied'}</td><td id="geoNow">${esc(cs.f.lat)}, ${esc(cs.f.lng)}</td></tr></tbody></table>
    </div>
  </div>`;
  updateEndInfo();
  setTimeout(initMap, 30);
  const vs = $('#votesSearch'); if (vs) vs.oninput = () => { const q = vs.value.toLowerCase(); $$('#votesTbl tbody tr').forEach(tr => tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'); };
}
function rerenderKeepScroll() { const y = window.scrollY; renderPage(); window.scrollTo(0, y); }
function jumpTo(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

/* ---------------- map ---------------- */
function initMap() {
  const cs = S.cs, el = $('#map'); if (!el) return;
  const lat = parseFloat(cs.f.lat), lng = parseFloat(cs.f.lng);
  const ok = !isNaN(lat) && !isNaN(lng);
  if (!window.L) {
    el.innerHTML = `<div class="map-fallback">🗺️<b>Map tiles unavailable (offline or blocked network).</b>Copy the coordinates from Google Maps into the boxes above, then click Apply.</div>`;
    return;
  }
  S.map = L.map(el, { worldCopyJump: true, scrollWheelZoom: false }).setView(ok ? [lat, lng] : [20, 0], ok ? 15 : 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(S.map);
  const icon = L.divIcon({ className: '', html: '<div class="pin-icon"></div>', iconSize: [26, 26], iconAnchor: [13, 30] });
  S.marker = L.marker(ok ? [lat, lng] : [20, 0], { draggable: true, icon }).addTo(S.map);
  const set = (la, ln) => { cs.f.lat = la.toFixed(6); cs.f.lng = ln.toFixed(6); $('#geoLat').value = cs.f.lat; $('#geoLng').value = cs.f.lng; $('#geoNow').textContent = cs.f.lat + ', ' + cs.f.lng; cs.applied.geo = false; refreshApplyBtn('geo'); };
  S.marker.on('dragend', e => { const p = e.target.getLatLng(); set(p.lat, p.lng); });
  S.map.on('click', e => { S.marker.setLatLng(e.latlng); set(e.latlng.lat, e.latlng.lng); });
  setTimeout(() => S.map && S.map.invalidateSize(), 150);
}
function moveMarker() {
  const cs = S.cs, la = parseFloat(cs.f.lat), ln = parseFloat(cs.f.lng);
  if (isNaN(la) || isNaN(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return toast('⚠ Enter a valid latitude (−90…90) and longitude (−180…180)');
  $('#geoNow').textContent = la + ', ' + ln;
  if (S.map) { S.marker.setLatLng([la, ln]); S.map.setView([la, ln], 16); }
}
function refreshApplyBtn(sec) {
  const b = document.querySelector(`[data-apply="${sec}"]`); if (b) { b.classList.toggle('applied', !!S.cs.applied[sec]); b.textContent = S.cs.applied[sec] ? '✔ Applied' : '☑ Apply'; }
  if (sec === 'geo' && $('#geoState')) $('#geoState').textContent = S.cs.applied.geo ? 'Applied ' + new Date().toLocaleTimeString() : 'Not applied';
  updateEndInfo();
}

/* ---------------- apply & validation ---------------- */
function applySection(sec, quiet) {
  const f = S.cs.f, errs = {};
  const setMsg = (k, m) => { errs[k] = m; };
  if (sec === 'basic') {
    if (!f.name.trim()) setMsg('name', 'Please provide a name');
    else if (f.name.replace(/[^A-Za-z]/g, '').length >= 4 && f.name === f.name.toUpperCase()) setMsg('name', 'Names must not be in ALL CAPS');
    if (!f.parent) setMsg('parent', 'Please search for and select a parent');
  }
  if (sec === 'contact') {
    if (f.phone && !/^\+\d[\d\s().-]{5,}$/.test(f.phone.trim())) setMsg('phone', 'Use international format starting with +country code, e.g. +91 487 233 9104');
    if (f.fax && !/^\+\d[\d\s().-]{5,}$/.test(f.fax.trim())) setMsg('fax', 'Use international format');
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) setMsg('email', 'Enter a valid email address');
    if (f.url && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(f.url.trim())) setMsg('url', 'URL must start with http:// or https://');
    if (f.url && /(facebook\.|instagram\.|fb\.com|hopper\.|booking\.com|agoda\.|expedia\.|tripadvisor\.|google\.)/i.test(f.url)) setMsg('url', 'Use the official website only — not social media, maps or OTA links');
  }
  if (sec === 'accom') {
    if (!f.type) setMsg('type', 'Please select an accommodation type');
    if (f.rooms !== '' && (isNaN(+f.rooms) || +f.rooms < 0)) setMsg('rooms', 'Rooms must be a number');
    if (f.floors !== '' && (isNaN(+f.floors) || +f.floors < 0)) setMsg('floors', 'Floors must be a number');
  }
  if (sec === 'geo') {
    const la = parseFloat(f.lat), ln = parseFloat(f.lng);
    if (isNaN(la) || isNaN(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) setMsg('lat', 'bad');
  }
  if (sec === 'desc' && f.desc.trim() && f.desc.trim().length < 20) setMsg('desc', 'Write at least one full sentence');
  const secEl = '#sec-' + sec;
  $$(secEl + ' [data-msg]').forEach(m => { m.textContent = errs[m.dataset.msg] || ''; });
  if (Object.keys(errs).length) {
    S.cs.applied[sec] = false; refreshApplyBtn(sec);
    if (!quiet) toast(sec === 'geo' ? '⚠ Enter valid coordinates first' : '⚠ Fix the highlighted fields, then Apply again');
    return false;
  }
  S.cs.applied[sec] = true; refreshApplyBtn(sec);
  if (sec === 'geo') moveMarker();
  if (!quiet) toast('✔ ' + ({ basic: 'Basic Info', contact: 'Contact Details', desc: 'Description', photos: 'Photos', accom: 'Accommodation Info', geo: 'Geo Coding' })[sec] + ' applied', 1400);
  return true;
}

/* ---------------- provider page & helpful links (real Chrome tabs) ---------------- */
function openProvider() {
  const c = curCase(), p = SRC(c).provider;
  S.cs.providerSeen = true;
  const st = $('#provStatus'); if (st) st.textContent = '✔ Provider page opened';
  if (c.providerUrl) { window.open(c.providerUrl, '_blank', 'noopener'); return; }
  const hue = ((c.req || 1) * 37) % 360;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.name)} – Hopper (provider feed snapshot)</title>
  <style>body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f4f6f8;color:#222}.top{background:#fa6866;color:#fff;padding:12px 24px;font-weight:700}
  .hero{height:180px;background:linear-gradient(135deg,hsl(${hue},55%,45%),hsl(${(hue + 50) % 360},60%,30%));color:#fff;display:flex;align-items:flex-end;padding:20px 24px;font-size:28px;font-weight:800}
  .wrap{max-width:860px;margin:0 auto;background:#fff}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;padding:20px 24px}.grid b{display:block;font-size:11px;color:#888;text-transform:uppercase}
  .note{margin:0 24px 24px;padding:12px;background:#fff7e0;border:1px solid #f0d58a;border-radius:8px;font-size:13px}</style></head><body>
  <div class="top">Hopper · Partner property page <span style="font-weight:400;opacity:.85">(training snapshot of the feed)</span></div>
  <div class="wrap"><div class="hero">${esc(p.name)}</div><div class="grid">
  <div><b>Property name</b>${esc(p.name)}</div><div><b>Property type</b>${esc(p.type)}</div>
  <div><b>Address (as listed)</b>${esc(p.address)}</div><div><b>Rooms</b>${esc(p.rooms)}</div>
  <div><b>Guest rating</b>${p.rating} / 5</div><div><b>Provider ID</b>${esc(p.id)}</div>
  ${p.desc ? `<div style="grid-column:1/-1"><b>Description</b>${esc(p.desc)}</div>` : ''}
  <div style="grid-column:1/-1"><b>Contact</b>Hidden by provider – guests book through Hopper</div></div>
  <div class="note">This page only repeats what the provider feed sent. Verify every value on Google, Google Maps, the official website and the property's own social pages.</div></div></body></html>`;
  try { const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); if (!w) toast('⚠ Allow pop-ups for this page to open the provider tab'); }
  catch (e) { toast('⚠ Could not open a new tab'); }
}
function helpfulLink(kind) {
  const c = curCase(), e = encodeURIComponent;
  const where = (c.feed.parentText || '').replace(/^[A-Z]{2},\s*/, '');
  const q = c.feed.name + (where ? ' ' + where : '');
  if (kind === 'provider') return openProvider();
  const url = { google: 'https://www.google.com/search?q=' + e(q), maps: 'https://www.google.com/maps/search/' + e(q), ta: 'https://www.tripadvisor.com/Search?q=' + e(c.feed.name),
    fb: 'https://www.facebook.com/search/top?q=' + e(c.feed.name), ig: 'https://www.google.com/search?q=' + e('site:instagram.com ' + c.feed.name) }[kind];
  window.open(url, '_blank', 'noopener');
}

/* ---------------- parent search ---------------- */
function openParent() {
  const c = curCase();
  $('#mParentBox').innerHTML = `<div class="modal-h"><h3>🔍 Search for a parent geo</h3><button class="x" data-close="mParent">✕</button></div>
    <div class="modal-b"><input class="mselect" id="parentQ" value="${esc(c.feed.parentText || '')}" placeholder="Type a city, region or country code (e.g. Munnar, IN)">
    <div style="font-size:12px;color:#6b7785;margin:8px 0">Pick the <b>most specific</b> geo where the property is located. Check the state and country!</div><div id="parentRes"></div></div>`;
  const run = () => {
    const toks = norm($('#parentQ').value).split(' ').filter(t => t.length >= 2);
    const res = GEOS.map(g => {
      const hay = norm(g.name + ' ' + g.path + ' ' + (g.cc || '')); let s = 0;
      toks.forEach(t => { if (hay.split(' ').includes(t)) s += 2; else if (hay.includes(t)) s += 1; });
      return { g, s };
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 12);
    $('#parentRes').innerHTML = res.length ? res.map(x => `<div class="parent-res" data-pick="${x.g.id}"><code>${x.g.id}</code><b>${esc(x.g.name)}</b><small>${esc(x.g.path)}</small></div>`).join('') : '<div style="color:#999;font-size:13px">No geos found. Try the city name only.</div>';
  };
  $('#parentQ').oninput = run; run();
  openModal('mParent'); setTimeout(() => $('#parentQ').focus(), 50);
}

/* ---------------- modals ---------------- */
function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) { $('#' + id).classList.remove('open'); }
function generic(title, body, foot) {
  $('#mGenericBox').innerHTML = `<div class="modal-h"><h3>${title}</h3><button class="x" data-close="mGeneric">✕</button></div><div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}`;
  openModal('mGeneric');
}
function openAudit(kind) {
  const c = curCase(), s = SRC(c), F = c.feed;
  if (kind === 'owners') {
    return generic('👤 Owners', s.owners.length ? `<table class="fb-tbl"><tr><th>Name</th><th>Status</th><th>Date</th><th>Note</th></tr>${s.owners.map(o => `<tr><td>${esc(o.name)}</td><td>${esc(o.status)}</td><td>${esc(o.date)}</td><td>${esc(o.note)}</td></tr>`).join('')}</table>` : '<p style="color:#777">No owners on record for this location.</p>');
  }
  let body = `<table class="fb-tbl"><tr><th>Date</th><th>By</th><th>Change</th></tr>${s.audit.map(a => `<tr><td>${esc(a.date)}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td></tr>`).join('')}</table>`;
  if (kind === 'full') {
    const keys = [['name', 'Name'], ['brand', 'Brand'], ['street', 'Street One'], ['street2', 'Street Two'], ['postal', 'Postal'], ['parentText', 'Parent (raw)'], ['phone', 'Phone'], ['email', 'Email'], ['url', 'URL'], ['type', 'Type'], ['rooms', 'Rooms'], ['lat', 'Latitude'], ['lng', 'Longitude'], ['desc', 'Description']];
    body += `<h4 style="margin:16px 0 6px">Raw feed payload</h4><table class="fb-tbl">${keys.filter(([k]) => F[k] !== undefined && F[k] !== '').map(([k, l]) => `<tr><td style="width:160px"><b>${l}</b></td><td>${esc(F[k])}</td></tr>`).join('')}</table>`;
  }
  generic(kind === 'full' ? '🧾 AuditTrail – Full View' : '🧾 AuditTrail – Basic View', body);
}

/* ---------------- decision ---------------- */
function openDecision(pre) {
  const c = curCase(), cs = S.cs;
  let sel = pre || '', matchVal = '';
  const draw = () => {
    const reasons = Object.entries(REASONS).filter(([, r]) => r.d === sel);
    $('#mDecisionBox').innerHTML = `<div class="modal-h"><h3>⚖️ Take action on request ${c.req}</h3><button class="x" data-close="mDecision">✕</button></div>
      <div class="modal-b">
        <div class="dgrid">${Object.entries(DECISIONS).map(([k, d]) => `<button class="dopt ${sel === k ? 'sel' : ''}" data-dsel="${k}"><span class="ic" style="background:${d.color}">${d.icon}</span><span><b>${d.label}</b><small>${({ approve: 'New, real, open accommodation', alias: 'Already on Tripadvisor', reject: 'Closed / not lodging / no evidence', t1: 'Conflicting data', t2: 'Fraud / brand / legal / safety', defer: 'Not open yet' })[k]}</small></span></button>`).join('')}</div>
        ${sel && !['approve', 'alias'].includes(sel) ? `<label class="mlabel">Reason *</label><select class="mselect" id="dReason"><option value="">— Select reason —</option>${reasons.map(([k, r]) => `<option value="${k}">${esc(r.label)}</option>`).join('')}</select>` : ''}
        ${sel === 'alias' ? `<label class="mlabel">Existing Tripadvisor listing *</label><input class="mselect" id="dMatch" value="${esc(matchVal)}" placeholder="Paste the Tripadvisor URL (…-d1234567-…) or the location ID"><div style="font-size:11.5px;color:#6b7785;margin-top:4px">Find it on tripadvisor.com in Chrome, open the listing and copy the address bar.</div>` : ''}
        ${sel ? `<label class="mlabel">Agent notes ${sel === 'approve' ? '(optional)' : '* (min 10 characters)'}</label><textarea class="mtext" id="dNotes" placeholder="What evidence did you rely on? (links, what you saw)">${esc(cs.notes)}</textarea>` : '<p style="color:#6b7785;font-size:13px;margin:14px 0 0">Select an action above.</p>'}
        <div class="err-msg" id="dErr" style="margin-top:8px"></div>
      </div>
      <div class="modal-f"><button class="btn btn-ghost" data-close="mDecision">Cancel</button><button class="btn btn-pri" id="dSubmit" ${sel ? '' : 'disabled'}>Submit decision</button></div>`;
    $$('[data-dsel]').forEach(b => b.onclick = () => { cs.notes = ($('#dNotes') || {}).value || cs.notes; matchVal = ($('#dMatch') || {}).value || matchVal; sel = b.dataset.dsel; draw(); });
    const sb = $('#dSubmit'); if (sb) sb.onclick = () => {
      const reason = ($('#dReason') || {}).value || (sel === 'approve' ? 'new_verified' : sel === 'alias' ? 'duplicate' : '');
      const match = (($('#dMatch') || {}).value || '').trim();
      const notes = ($('#dNotes') || {}).value || '';
      const err = msg => { $('#dErr').textContent = msg; };
      if (!['approve', 'alias'].includes(sel) && !reason) return err('Select a reason.');
      if (sel === 'alias' && !taId(match)) return err('Paste the Tripadvisor listing URL (it contains -d1234567-) or the location ID.');
      if (sel !== 'approve' && notes.trim().length < 10) return err('Add a short note (min 10 characters) explaining your evidence.');
      if (sel === 'approve' || sel === 'defer') {
        const missing = [];
        if (!cs.f.name.trim()) missing.push('Name'); if (!cs.f.parent) missing.push('Parent'); if (!cs.f.type) missing.push('Accommodation Type');
        Object.entries(REQ_SECTIONS).forEach(([k, l]) => { if (!cs.applied[k]) missing.push(l + ' (not applied)'); });
        if (missing.length) return err('Cannot ' + (sel === 'approve' ? 'create' : 'defer') + ' – missing: ' + missing.join(', '));
      }
      closeModal('mDecision');
      submitCase({ decision: sel, reason, match, notes: notes.trim() });
    };
  };
  draw(); openModal('mDecision');
}

/* ---------------- submit / feedback ---------------- */
function submitCase(dec) {
  const c = curCase(), cs = S.cs;
  const sc = scoreCase(c, cs, dec);
  const timeSec = Math.round((Date.now() - cs.start) / 1000);
  if (sc.score >= 80) { S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); } else S.streak = 0;
  const speed = sc.score >= 60 ? (timeSec <= 360 ? 15 : timeSec <= 600 ? 5 : 0) : 0;
  const streakB = sc.score >= 80 && S.streak >= 2 ? Math.min(S.streak, 5) * 5 : 0;
  const xp = Math.max(0, sc.score + speed + streakB);
  S.xp += xp;
  const r = {
    qNo: S.idx + 1, caseId: c.id, hotel: c.ans.name ? String(first(c.ans.name)) : c.feed.name, feedName: c.feed.name,
    expectedDecision: c.ans.decision, decision: dec.decision, decisionOk: sc.decisionOk,
    expectedReason: [].concat(c.ans.reason).join('|'), reason: dec.reason, reasonOk: sc.reasonOk,
    expectedMatch: c.ans.match || '', match: dec.match, matchOk: sc.matchOk, fieldsPct: Math.round(sc.fieldsPct * 100), score: sc.score,
    xp, speed, streakB, timeSec, critical: sc.critical, notes: dec.notes, mode: sc.mode,
    fields: sc.fields.map(f => ({ k: f.k, label: f.label, status: f.status, given: f.given, exp: f.exp, note: f.note, dist: f.dist })), tip: c.tip
  };
  S.results[S.idx] = r;
  renderHud();
  showFeedback(r, true);
  if (sc.score >= 80) confetti(sc.score >= 95 ? 160 : 80);
}
function feedbackHtml(r) {
  const D = DECISIONS, color = r.score >= 80 ? 'var(--ok)' : r.score >= 50 ? '#b97a00' : 'var(--bad)';
  const verdict = r.critical ? '🚨 Critical error' : r.score >= 95 ? '🏆 Perfect work!' : r.score >= 80 ? '✅ Great job' : r.score >= 50 ? '⚠️ Partly correct' : '❌ Needs review';
  const reasonLbl = k => (REASONS[k] ? REASONS[k].label : (k || '—'));
  const showFields = r.mode === 'fields' || !r.decisionOk;
  return `<div class="fb-head"><div class="fb-score" style="color:${color}">${r.score}<small>/100</small></div><div class="fb-verdict">${verdict}</div>
      <div class="fb-xp">+${r.xp} XP${r.speed ? ` · ⚡ +${r.speed}` : ''}${r.streakB ? ` · 🔥 +${r.streakB}` : ''}</div></div>
    <div class="modal-b">
      <table class="fb-tbl"><tr><th style="width:150px"></th><th>Your answer</th><th>Correct answer</th><th style="width:60px"></th></tr>
        <tr><td><b>Action</b></td><td>${D[r.decision].icon} ${esc(D[r.decision].label)}</td><td>${D[r.expectedDecision].icon} ${esc(D[r.expectedDecision].label)}</td><td class="${r.decisionOk ? 'ok-c' : 'bad-c'}">${r.decisionOk ? '✔ 30' : '✖ 0'}</td></tr>
        <tr><td><b>Reason</b></td><td>${esc(reasonLbl(r.reason))}</td><td>${esc(r.expectedReason.split('|').map(reasonLbl).join(' / '))}</td><td class="${r.reasonOk ? 'ok-c' : 'bad-c'}">${r.reasonOk ? '✔ 10' : '✖ 0'}</td></tr>
        ${r.expectedDecision === 'alias' ? `<tr><td><b>Tripadvisor listing</b></td><td style="word-break:break-all">${esc(r.match || '—')}</td><td style="word-break:break-all">${esc(r.expectedMatch || 'The existing Tripadvisor listing link for this property')}</td><td class="${r.matchOk ? 'ok-c' : 'bad-c'}">${r.matchOk ? '✔' : '✖'}</td></tr>` : ''}
        <tr><td><b>Data capture</b></td><td colspan="2">${r.mode === 'match' ? 'Scored on the existing Tripadvisor listing you matched' : r.mode === 'decision' && r.decisionOk ? 'Earned by the correct action' : r.fieldsPct + '% field accuracy'}</td><td></td></tr>
      </table>
      ${r.critical ? `<div class="crit">🚨 ${r.decision === 'approve' ? 'You approved a listing that should not be created.' : 'A fraud/legal case was rejected instead of escalated — the risk is never investigated.'} This scores 0.</div>` : ''}
      ${showFields ? `<h4 style="margin:16px 0 4px">Field-by-field review</h4><table class="fb-tbl"><tr><th>Field</th><th>You entered</th><th>Expected</th><th>Result</th></tr>
        ${r.fields.map(f => `<tr><td>${esc(f.label)}</td><td>${esc(f.given)}</td><td>${esc(f.exp)}</td><td class="${f.status === 'ok' ? 'ok-c' : f.status === 'partial' ? 'mid-c' : 'bad-c'}">${f.status === 'ok' ? '✔' : f.status === 'partial' ? '◐' : '✖'} <span style="font-weight:500;color:#555">${esc(f.note || '')}</span></td></tr>`).join('')}</table>` : ''}
      <div class="tipbox">🎓 <b>Coach's note:</b> ${esc(r.tip)}</div>
    </div>`;
}
function showFeedback(r, live) {
  const last = S.idx >= S.cases.length - 1;
  $('#mFeedbackBox').innerHTML = `<div class="modal-h"><h3>Case ${r.qNo} · ${esc(r.hotel)}</h3>${live ? '' : '<button class="x" data-close="mFeedback">✕</button>'}</div>${feedbackHtml(r)}
    <div class="modal-f">${live ? `<button class="btn btn-pri" id="fbNext">${last ? 'See my results 🏁' : 'Next case →'}</button>` : '<button class="btn btn-ghost" data-close="mFeedback">Close</button>'}</div>`;
  openModal('mFeedback');
  if (live) $('#fbNext').onclick = () => { closeModal('mFeedback'); if (last) finishDay(); else { S.idx++; loadCase(); } };
}

/* ---------------- finish day ---------------- */
const BADGES = [
  ['perfect', '💎', 'Flawless', 'Every case scored 90+'],
  ['geo', '🎯', 'Geo Sniper', 'Every pin within tolerance'],
  ['fraud', '🕵️', 'Fraud Hound', 'Escalated every Tier 2 case'],
  ['dupe', '🧬', 'Duplicate Detective', 'Matched every duplicate'],
  ['speed', '⚡', 'Speed Runner', 'Avg < 6 min with 80%+'],
  ['streak', '🔥', 'Hot Streak', '5 cases in a row ≥ 80%'],
  ['safe', '🛡️', 'Zero Critical', 'No critical errors']
];
function computeBadges(rs) {
  const got = new Set(), avg = rs.reduce((a, r) => a + r.score, 0) / rs.length, avgT = rs.reduce((a, r) => a + r.timeSec, 0) / rs.length;
  if (rs.every(r => r.score >= 90)) got.add('perfect');
  const geos = rs.flatMap(r => r.fields.filter(f => f.k === 'geo' && r.mode === 'fields'));
  if (geos.length && geos.every(g => g.status === 'ok')) got.add('geo');
  const t2 = rs.filter(r => r.expectedDecision === 't2'); if (t2.length && t2.every(r => r.decisionOk)) got.add('fraud');
  const al = rs.filter(r => r.expectedDecision === 'alias'); if (al.length && al.every(r => r.decisionOk && r.matchOk)) got.add('dupe');
  if (avgT < 360 && avg >= 80) got.add('speed');
  if (S.bestStreak >= 5) got.add('streak');
  if (!rs.some(r => r.critical)) got.add('safe');
  return got;
}
function finishDay() {
  clearInterval(S.timer);
  const rs = S.results, n = rs.length;
  const total = rs.reduce((a, r) => a + r.score, 0), acc = Math.round(total / n);
  const passed = acc >= APP_CONFIG.PASS_MARK;
  const badges = computeBadges(rs);
  const prof = profile(); const prevXp = prof.xp;
  prof.xp += S.xp; const dk = String(S.user.day);
  prof.days[dk] = { best: Math.max((prof.days[dk] || {}).best || 0, acc), passed: passed || !!(prof.days[dk] || {}).passed, attempts: ((prof.days[dk] || {}).attempts || 0) + 1 };
  saveProfile(prof);
  const L = levelFor(prof.xp), levelUp = levelFor(prevXp).n < L.n;
  const finishedAt = nowIso();
  const attempt = {
    timestamp: finishedAt, attemptId: S.attemptId, trainingId: S.user.trainingId, name: S.user.name, country: S.user.country, trainer: S.user.trainer,
    wave: S.user.wave, session: S.user.session, day: S.user.day, attemptNo: prof.days[dk].attempts, startedAt: S.startedAt, finishedAt,
    durationSec: Math.round((Date.parse(finishedAt) - Date.parse(S.startedAt)) / 1000), questions: n, correctDecisions: rs.filter(r => r.decisionOk).length,
    accuracy: acc, totalScore: total, maxScore: n * 100, xp: S.xp, level: `Lv ${L.n} · ${L.name}`, passed, badges: BADGES.filter(b => badges.has(b[0])).map(b => b[2]).join(', '),
    criticalErrors: rs.filter(r => r.critical).length
  };
  const questions = rs.map(r => ({
    timestamp: finishedAt, attemptId: S.attemptId, trainingId: S.user.trainingId, name: S.user.name, trainer: S.user.trainer, wave: S.user.wave, day: S.user.day,
    qNo: r.qNo, caseId: r.caseId, hotel: r.hotel, expectedDecision: r.expectedDecision, decision: r.decision, decisionOk: r.decisionOk,
    expectedReason: r.expectedReason, reason: r.reason, reasonOk: r.reasonOk, match: r.match, fieldsPct: r.fieldsPct, score: r.score, xp: r.xp,
    timeSec: r.timeSec, critical: r.critical, notes: r.notes,
    fieldDetail: r.fields.map(f => `${f.label}:${f.status === 'ok' ? '✔' : f.status === 'partial' ? '◐' : '✖'}`).join(' | ')
  }));
  saveAttempt(attempt, questions);
  renderResults(attempt, badges, levelUp);
  if (passed) confetti(240);
}
function renderResults(a, badges, levelUp) {
  const rs = S.results, D = DECISIONS;
  const avgT = Math.round(rs.reduce((s, r) => s + r.timeSec, 0) / rs.length);
  $('#resWrap').innerHTML = `
    <div class="res-hero ${a.passed ? 'pass' : 'fail'}"><div>
      <h2>${a.passed ? '🏆 Mission complete — PASSED' : '📘 Mission complete — keep practising'}</h2>
      <div>${esc(S.user.name)} · ID ${esc(S.user.trainingId)} · Day ${S.user.day} · ${esc(dayMeta(S.user.day).title)}${S.user.wave ? ' · ' + esc(S.user.wave) : ''}</div>
      <div style="margin-top:8px;opacity:.9">Pass mark ${APP_CONFIG.PASS_MARK}% · Attempt #${a.attemptNo} · ${a.level}${levelUp ? ' · 🎉 LEVEL UP!' : ''}</div></div>
      <div class="ring"><b>${a.accuracy}%</b><span>accuracy</span></div></div>
    <div class="kpis">
      <div class="kpi"><span>Total score</span><b>${a.totalScore}/${a.maxScore}</b></div>
      <div class="kpi"><span>Correct actions</span><b>${a.correctDecisions}/${a.questions}</b></div>
      <div class="kpi"><span>XP earned</span><b>⭐ ${a.xp}</b></div>
      <div class="kpi"><span>Avg time / case</span><b>${fmtTime(avgT)}</b></div>
      <div class="kpi"><span>Critical errors</span><b style="color:${a.criticalErrors ? 'var(--bad)' : 'inherit'}">${a.criticalErrors}</b></div>
    </div>
    <div class="badges">${BADGES.map(b => `<div class="badge ${badges.has(b[0]) ? '' : 'lockd'}" title="${esc(b[3])}"><i>${b[1]}</i><div><b>${b[2]}</b><div style="color:#6b7785;font-size:11.5px">${b[3]}</div></div></div>`).join('')}</div>
    <div class="tbl-card"><h3 style="margin:0 0 10px">Case-by-case scorecard</h3>
      <table class="rtbl"><thead><tr><th>#</th><th>Property</th><th>Your action</th><th>Correct action</th><th>Reason</th><th>Data</th><th>Score</th><th>Time</th><th>XP</th><th></th></tr></thead><tbody>
      ${rs.map((r, i) => `<tr class="clk" data-review="${i}"><td>${r.qNo}</td><td><b>${esc(r.hotel)}</b><div style="font-size:11px;color:#888">${esc(r.caseId)}</div></td>
        <td>${D[r.decision].icon} ${D[r.decision].short}</td><td>${D[r.expectedDecision].icon} ${D[r.expectedDecision].short} ${r.decisionOk ? '<span class="ok-c">✔</span>' : '<span class="bad-c">✖</span>'}</td>
        <td>${r.reasonOk ? '<span class="ok-c">✔</span>' : '<span class="bad-c">✖</span>'}</td><td>${r.mode === 'fields' || !r.decisionOk ? r.fieldsPct + '%' : '—'}</td>
        <td><b style="color:${r.score >= 80 ? 'var(--ok)' : r.score >= 50 ? '#b97a00' : 'var(--bad)'}">${r.score}</b>${r.critical ? ' 🚨' : ''}</td><td>${fmtTime(r.timeSec)}</td><td>${r.xp}</td><td><button class="btn btn-ghost btn-sm">Review</button></td></tr>`).join('')}
      </tbody></table>
      <div class="sync-line" id="syncLine">Saving results…</div></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-ghost" id="rCsv">⬇ Download my scorecard (CSV)</button>
      <button class="btn btn-ghost" id="rRetry">↺ Retry Day ${S.user.day}</button>
      <button class="btn btn-pri" id="rHome">Back to login</button></div>`;
  $$('[data-review]').forEach(tr => tr.onclick = () => showFeedback(S.results[+tr.dataset.review], false));
  $('#rRetry').onclick = () => showGuide();
  $('#rHome').onclick = () => { show('v-login'); loadConfig(); };
  $('#rCsv').onclick = () => downloadCsv(`LMT_Day${S.user.day}_${S.user.trainingId}.csv`, S.results.map(r => ({ Case: r.qNo, CaseId: r.caseId, Property: r.hotel, YourAction: D[r.decision].label, CorrectAction: D[r.expectedDecision].label, ActionCorrect: r.decisionOk, ReasonCorrect: r.reasonOk, DataPct: r.fieldsPct, Score: r.score, TimeSec: r.timeSec, XP: r.xp })));
  show('v-results');
}

/* ---------------- persistence & sync ---------------- */
function saveAttempt(attempt, questions) {
  const all = LS.get('lmt_attempts', []);
  all.push(Object.assign({}, attempt, { synced: false, questionsDetail: questions }));
  LS.set('lmt_attempts', all.slice(-500));
  const pend = LS.get('lmt_pending', []); pend.push({ attempt, questions }); LS.set('lmt_pending', pend);
  flushPending().then(() => {
    const el = $('#syncLine'); if (!el) return;
    const still = LS.get('lmt_pending', []).some(p => p.attempt.attemptId === attempt.attemptId);
    el.innerHTML = still ? (API.configured() ? '⏳ Could not reach Google Sheets — saved in this browser, will retry automatically.' : '💾 Saved in this browser (offline mode). Your trainer can see it in the Admin Portal on this computer.')
      : '✅ Results saved to Google Sheets.';
  });
}
let flushing = false;
async function flushPending() {
  if (flushing || !API.configured()) return; flushing = true;
  try {
    let pend = LS.get('lmt_pending', []);
    for (const p of pend.slice()) {
      try {
        await API.call({ action: 'submitAttempt', attempt: p.attempt, questions: p.questions });
        pend = LS.get('lmt_pending', []).filter(x => x.attempt.attemptId !== p.attempt.attemptId); LS.set('lmt_pending', pend);
        const all = LS.get('lmt_attempts', []); all.forEach(a => { if (a.attemptId === p.attempt.attemptId) a.synced = true; }); LS.set('lmt_attempts', all);
        ONLINE = true;
      } catch (e) { console.warn('sync failed', e); break; }
    }
  } finally { flushing = false; renderConn(); }
}
function downloadBlob(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csvCell(v) { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function downloadCsv(name, rows) {
  if (!rows.length) return toast('Nothing to export');
  const cols = Object.keys(rows[0]);
  const csv = '﻿' + [cols.map(csvCell).join(',')].concat(rows.map(r => cols.map(c => csvCell(r[c])).join(','))).join('\n');
  downloadBlob(name, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

/* ---------------- confetti ---------------- */
function confetti(n) {
  const cv = $('#confetti'), ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#00aa6c', '#ffd34d', '#2a9fd6', '#ff6b6b', '#7b4fd6', '#fff'];
  const ps = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight / 3, vx: (Math.random() - .5) * 14, vy: -Math.random() * 12 - 4, s: 4 + Math.random() * 5, c: cols[Math.floor(Math.random() * cols.length)], r: Math.random() * 6 }));
  let t = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.vx *= .99; p.r += .2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore(); });
    if (++t < 140) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ---------------- event wiring (game) ---------------- */
function bindGame() {
  const pane = $('#casePane');
  pane.addEventListener('input', e => {
    const k = e.target.dataset.f; if (!k) return;
    S.cs.f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (['name', 'type'].includes(k)) e.target.classList.toggle('invalid', !e.target.value);
    if (k === 'lat' || k === 'lng') { S.cs.applied.geo = false; refreshApplyBtn('geo'); }
  });
  pane.addEventListener('change', e => {
    const k = e.target.dataset.f; if (k) { S.cs.f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; if (k === 'type') e.target.classList.toggle('invalid', !e.target.value); }
    const a = e.target.dataset.attr; if (a) S.cs.attr[a] = e.target.value;
  });
  pane.addEventListener('click', e => {
    const t = e.target.closest('button,[data-thumb]'); if (!t) return;
    const c = curCase(), cs = S.cs, d = t.dataset;
    if (d.copy) { let v = c.feed[d.copy]; if (d.copy === 'type' && !ACCOM_TYPES.includes(v)) v = ''; cs.f[d.copy] = v == null ? '' : String(v); cs.rej[d.copy] = false; rerenderKeepScroll(); }
    else if (d.rej) { cs.rej[d.rej] = !cs.rej[d.rej]; rerenderKeepScroll(); }
    else if (d.apply) applySection(d.apply);
    else if (d.lock) { cs.locks[d.lock] = !cs.locks[d.lock]; t.classList.toggle('on'); }
    else if (d.parent) openParent();
    else if (d.pre) { cs.pre = d.pre; updateEndInfo(); toast('Pre-selected: ' + DECISIONS[d.pre].label + (d.pre === 'alias' ? ' — find the listing on tripadvisor.com and paste its link when you take action' : ' — finish the page, then Take Action'), 3600); }
    else if (d.openprov) openProvider();
    else if (d.thumb) { cs.f.thumb = d.thumb; $$('.thumb').forEach(x => x.classList.toggle('sel', x === t)); $('#thumbTxt').textContent = 'Selected: ' + d.thumb; }
    else if (d.inert) toast('Linked locations are not used in this training');
    else if (t.classList.contains('sec-min')) { const sec = t.closest('.sec'); sec.querySelectorAll('.lrow,table,.votes-search,#map,.geo-inputs').forEach(x => x.classList.toggle('hidden')); t.textContent = t.textContent === '-' ? '+' : '-'; }
    else if (t.id === 'geoGo') moveMarker();
    else if (t.id === 'geoReset') { cs.f.lat = String(c.feed.lat); cs.f.lng = String(c.feed.lng); $('#geoLat').value = cs.f.lat; $('#geoLng').value = cs.f.lng; cs.applied.geo = false; refreshApplyBtn('geo'); moveMarker(); }
    else if (t.id === 'geoPaste') {
      const v = prompt('Paste coordinates as "lat, lng" (e.g. copied from Google Maps):', ''); if (!v) return;
      const m = v.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/); if (!m) return toast('⚠ Could not read coordinates');
      cs.f.lat = m[1]; cs.f.lng = m[2]; $('#geoLat').value = m[1]; $('#geoLng').value = m[2]; cs.applied.geo = false; refreshApplyBtn('geo'); moveMarker();
    }
  });
  $('#navList').addEventListener('click', e => { const s = e.target.closest('[data-jump]'); if (!s) return; if (!s.dataset.jump) return toast('This section is not part of Places new-listing training'); jumpTo(s.dataset.jump); });
  $('#btnTakeAction').onclick = () => openDecision(S.cs.pre || '');
  $('#hudExit').onclick = () => { generic('Exit mission?', '<p>Your progress on this day will be lost. Results are only saved after the last case.</p>', '<button class="btn btn-ghost" data-close="mGeneric">Stay</button><button class="btn btn-danger" id="exitYes">Exit to login</button>'); $('#exitYes').onclick = () => { closeModal('mGeneric'); clearInterval(S.timer); show('v-login'); }; };
  $('#btnNoMatch').onclick = () => { S.cs.pre = 'approve'; updateEndInfo(); toast('Marked: No match exists on Tripadvisor → create new. Make sure you searched tripadvisor.com first!', 3600); };
  $('#btnHelpful').onclick = () => $('#helpfulMenu').classList.toggle('hidden');
  $('#helpfulMenu').addEventListener('click', e => { const t = e.target.closest('[data-link]'); if (t) { $('#helpfulMenu').classList.add('hidden'); helpfulLink(t.dataset.link); } });
  $('#btnHideFields').onclick = () => { S.hideEmpty = !S.hideEmpty; $('#btnHideFields').textContent = S.hideEmpty ? '👁 Show Fields' : '👁 Hide Fields'; rerenderKeepScroll(); };
  $('#btnApplyAll').onclick = () => { const res = ['basic', 'contact', 'desc', 'photos', 'accom', 'geo'].map(s => applySection(s, true)); toast(res.every(Boolean) ? '✔ All sections applied' : '⚠ Some sections need fixing — check the red messages'); };
  $$('[data-audit]').forEach(b => b.onclick = () => openAudit(b.dataset.audit));
  $$('[data-nav]').forEach(n => n.onclick = () => {
    const k = n.dataset.nav;
    if (k === 'search') helpfulLink('ta');
    else if (k === 'report') generic('📊 Progress report', `<p>Cases completed: <b>${S.results.filter(Boolean).length}/${S.cases.length}</b> · XP this mission: <b>${S.xp}</b> · Streak: <b>${S.streak}</b></p>` + (S.results.filter(Boolean).length ? `<table class="fb-tbl"><tr><th>#</th><th>Property</th><th>Score</th></tr>${S.results.filter(Boolean).map(r => `<tr><td>${r.qNo}</td><td>${esc(r.hotel)}</td><td>${r.score}</td></tr>`).join('')}</table>` : ''));
    else toast(n.textContent + ' is disabled in training mode');
  });
  $('#topSearch').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim()) window.open('https://www.tripadvisor.com/Search?q=' + encodeURIComponent(e.target.value.trim()), '_blank', 'noopener'); });
  $$('.abtn[data-act]').forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'email') {
      if ($('#noEmail').checked) return toast('“No Email” is ticked — no owner email will be sent');
      const c = curCase();
      generic('✉ Email property owner', `<label class="mlabel">To</label><input class="mselect" value="${esc(S.cs.f.email || '')}" placeholder="owner email"><label class="mlabel">Message</label><textarea class="mtext">Hello,\n\nWe received a request to list ${esc(c.feed.name)} on Tripadvisor. Could you please confirm the property's official name, address and phone number?\n\nThank you,\nTripadvisor Places Team</textarea><p style="font-size:12px;color:#6b7785">Training mode: emails are not actually sent.</p>`, '<button class="btn btn-ghost" data-close="mGeneric">Cancel</button><button class="btn btn-pri" id="emSend">Send</button>');
      $('#emSend').onclick = () => { S.cs.emails++; closeModal('mGeneric'); toast('✉ Email queued (simulation)'); };
      return;
    }
    openDecision(a === 'escalate' ? 't1' : a);
  });
  $$('.lbtn').forEach(b => b.onclick = () => {
    const k = b.dataset.lb;
    if (k === 'B') jumpTo('sec-basic');
    else if (k === 'C') jumpTo('sec-contact');
    else if (k === 'L') { const f = S.cs.f; generic('📄 Location summary (your current values)', `<table class="fb-tbl">${[['Name', f.name], ['Brand', f.brand], ['Street One', f.street], ['Street Two', f.street2], ['Postal', f.postal], ['Parent', geoLabel(f.parent)], ['Phone', f.phone], ['Email', f.email], ['URL', f.url], ['Type', f.type], ['Rooms', f.rooms], ['Floors', f.floors], ['Opening', f.opening], ['All-inclusive', f.allIncl ? 'Yes' : 'No'], ['Lat/Lng', f.lat + ', ' + f.lng]].map(([l, v]) => `<tr><td style="width:150px"><b>${l}</b></td><td>${esc(v || '—')}</td></tr>`).join('')}</table>`); }
    else if (k === 'LN') { generic('📝 Location notes', `<textarea class="mtext" id="lnText" style="min-height:140px" placeholder="Your research notes and links — these pre-fill the notes in the action dialog.">${esc(S.cs.notes)}</textarea>`, '<button class="btn btn-pri" id="lnSave">Save notes</button>'); $('#lnSave').onclick = () => { S.cs.notes = $('#lnText').value; closeModal('mGeneric'); toast('📝 Notes saved'); }; }
  });
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]'); if (c) closeModal(c.dataset.close);
    const p = e.target.closest('[data-pick]'); if (p && S.cs) {
      S.cs.f.parent = p.dataset.pick; closeModal('mParent');
      const ps = $('#parentShow'); if (ps) { ps.value = geoLabel(p.dataset.pick); ps.classList.add('ok'); const m = document.querySelector('#sec-basic [data-msg="parent"]'); if (m) m.textContent = ''; }
      toast('Parent selected: ' + geoLabel(p.dataset.pick), 2000);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ['mParent', 'mGeneric', 'mDecision'].forEach(closeModal); });
  window.addEventListener('beforeunload', e => { if ($('#v-game').classList.contains('active')) { e.preventDefault(); e.returnValue = ''; } });
}

/* =====================================================================
   LMT PLACES SIMULATOR — ADMIN PORTAL
   ===================================================================== */
const ADM = { token: '', online: false, results: [], questions: [], tab: 'dash', sort: { k: 'timestamp', dir: -1 }, qbDay: '', qbSearch: '' };
const DAY_LIST = () => Array.from({ length: APP_CONFIG.MAX_DAYS }, (_, i) => i + 1);

function openAdminLogin() {
  $('#mAdminBox').innerHTML = `<div class="modal-h"><h3>🔐 Admin Portal Access</h3><button class="x" data-close="mAdmin">✕</button></div>
    <div class="modal-b" style="max-width:420px;margin:30px auto;width:100%">
      <p style="color:#6b7785;font-size:13px">Trainer tools: results, question bank, sessions, waves, trainers and Google Sheet settings.</p>
      <label class="mlabel">Admin password</label><input type="password" class="mselect" id="admPass" placeholder="Enter password" autocomplete="off">
      <div class="err-msg" id="admErr"></div>
      <button class="btn btn-pri" style="width:100%;margin-top:10px" id="admGo">Unlock</button>
      <p style="font-size:11.5px;color:#8a96a3;margin-top:14px">${API.configured() ? 'Password is checked by your Google Sheet script.' : 'Offline mode: password is checked in this browser. Data shown = attempts taken on this computer.'}</p>
    </div>`;
  openModal('mAdmin');
  const go = async () => {
    const pw = $('#admPass').value; if (!pw) return;
    $('#admErr').textContent = 'Checking…';
    if (API.configured()) {
      try { const r = await API.call({ action: 'adminLogin', password: pw }); ADM.token = r.token; ADM.online = true; return adminLoad(); }
      catch (e) { if (/password/i.test(String(e.message || e))) return ($('#admErr').textContent = 'Incorrect password'); $('#admErr').textContent = 'Sheet unreachable — trying offline password…'; }
    }
    if (sha256(pw) === APP_CONFIG.OFFLINE_ADMIN_SHA256) { ADM.token = ''; ADM.online = false; return adminLoad(); }
    $('#admErr').textContent = 'Incorrect password';
  };
  $('#admGo').onclick = go; $('#admPass').onkeydown = e => { if (e.key === 'Enter') go(); };
  setTimeout(() => $('#admPass').focus(), 60);
}

async function adminLoad() {
  $('#mAdminBox').innerHTML = `<div class="modal-h"><h3>🛠️ Admin Portal · LMT Places Simulator</h3><span style="font-size:12px;color:#6b7785">${ADM.online ? '<span class="dot on"></span>Live · Google Sheets' : '<span class="dot off"></span>Local browser data'}</span><button class="btn btn-ghost btn-sm" id="admRefresh">↻ Refresh</button><button class="x" data-close="mAdmin">✕</button></div>
    <div class="adm-tabs">${[['dash', '📊 Results'], ['qb', '📝 Questions'], ['cases', '🧩 Case Analytics'], ['board', '🏅 Leaderboard'], ['sess', '🗓️ Sessions & Waves'], ['people', '👥 Trainers & Countries'], ['settings', '⚙️ Settings']].map(([k, l]) => `<button class="adm-tab ${ADM.tab === k ? 'on' : ''}" data-atab="${k}">${l}</button>`).join('')}</div>
    <div class="adm-body" id="admBody"><div style="padding:40px;text-align:center;color:#888">Loading…</div></div>`;
  $$('[data-atab]').forEach(b => b.onclick = () => { ADM.tab = b.dataset.atab; $$('[data-atab]').forEach(x => x.classList.toggle('on', x === b)); renderAdmin(); });
  $('#admRefresh').onclick = adminLoad;
  await fetchAdminData();
  renderAdmin();
}
async function fetchAdminData() {
  const local = LS.get('lmt_attempts', []);
  if (ADM.online) {
    try {
      const r = await API.call({ action: 'getResults', token: ADM.token });
      ADM.results = r.results || []; ADM.questions = r.questions || [];
      await loadConfig(); return;
    } catch (e) {
      if (/token|expired/i.test(String(e.message))) { toast('Session expired — log in again'); return openAdminLogin(); }
      toast('⚠ Could not load from Sheets — showing local data');
    }
  }
  ADM.results = local.map(a => Object.assign({}, a, { source: a.synced ? 'synced' : 'local' }));
  ADM.questions = local.flatMap(a => a.questionsDetail || []);
}
const truthy = v => v === true || v === 'TRUE' || v === 'true' || v === 'Yes' || v === 1;
function renderAdmin() {
  const b = $('#admBody'); if (!b) return;
  ({ dash: admDash, qb: admQB, cases: admCases, board: admBoard, sess: admSess, people: admPeople, settings: admSettings })[ADM.tab](b);
}

/* ---------- Results dashboard ---------- */
function admFiltered() {
  const g = id => ($('#' + id) || {}).value || '';
  const q = g('fQ').toLowerCase(), tr = g('fTrainer'), wv = g('fWave'), dy = g('fDay'), ct = g('fCountry'), ps = g('fPass'), df = g('fFrom'), dt = g('fTo');
  return ADM.results.filter(r => (!q || `${r.trainingId} ${r.name} ${r.attemptId}`.toLowerCase().includes(q)) && (!tr || r.trainer === tr) && (!wv || r.wave === wv)
    && (!dy || String(r.day) === dy) && (!ct || r.country === ct) && (!ps || (ps === 'pass') === truthy(r.passed))
    && (!df || String(r.timestamp).slice(0, 10) >= df) && (!dt || String(r.timestamp).slice(0, 10) <= dt));
}
function admDash(b) {
  const uniq = k => [...new Set(ADM.results.map(r => r[k]).filter(Boolean))].sort();
  const opt = (id, label, vals) => `<select id="${id}"><option value="">${label}</option>${vals.map(v => `<option>${esc(v)}</option>`).join('')}</select>`;
  b.innerHTML = `<div class="adm-kpis" id="admKpis"></div>
    <div class="filters"><input id="fQ" placeholder="Search ID / name" style="min-width:180px">${opt('fTrainer', 'All trainers', uniq('trainer'))}${opt('fWave', 'All waves', uniq('wave'))}
      <select id="fDay"><option value="">All days</option>${DAY_LIST().map(d => `<option value="${d}">Day ${d}</option>`).join('')}</select>${opt('fCountry', 'All countries', uniq('country'))}
      <select id="fPass"><option value="">Pass & fail</option><option value="pass">Passed</option><option value="fail">Failed</option></select>
      <input type="date" id="fFrom" title="From"><input type="date" id="fTo" title="To">
      <button class="btn btn-ghost btn-sm" id="fCsv">⬇ Results CSV</button><button class="btn btn-ghost btn-sm" id="fQCsv">⬇ Question log CSV</button></div>
    <div class="tbl-card" style="margin-top:0"><table class="rtbl" id="admTbl"></table></div>`;
  $$('.filters input,.filters select').forEach(x => x.oninput = drawDash);
  $('#fCsv').onclick = () => downloadCsv('LMT_Results.csv', admFiltered().map(r => { const o = Object.assign({}, r); delete o.questionsDetail; return o; }));
  $('#fQCsv').onclick = () => { const ids = new Set(admFiltered().map(r => r.attemptId)); downloadCsv('LMT_Question_Log.csv', ADM.questions.filter(q => ids.has(q.attemptId))); };
  drawDash();
}
function drawDash() {
  const rs = admFiltered();
  const avg = k => rs.length ? Math.round(rs.reduce((a, r) => a + (+r[k] || 0), 0) / rs.length) : 0;
  const pass = rs.filter(r => truthy(r.passed)).length;
  $('#admKpis').innerHTML = [['Attempts', rs.length], ['Unique agents', new Set(rs.map(r => r.trainingId)).size], ['Avg accuracy', avg('accuracy') + '%'],
    ['Pass rate', rs.length ? Math.round(pass / rs.length * 100) + '%' : '—'], ['Avg duration', fmtTime(avg('durationSec'))], ['Critical errors', rs.reduce((a, r) => a + (+r.criticalErrors || 0), 0)]]
    .map(([l, v]) => `<div class="kpi"><span>${l}</span><b>${v}</b></div>`).join('');
  const cols = [['timestamp', 'Date'], ['trainingId', 'ID'], ['name', 'Name'], ['country', 'Country'], ['trainer', 'Trainer'], ['wave', 'Wave'], ['day', 'Day'], ['attemptNo', 'Try'], ['accuracy', 'Accuracy'], ['correctDecisions', 'Actions ✔'], ['xp', 'XP'], ['durationSec', 'Time'], ['criticalErrors', '🚨'], ['passed', 'Result']];
  const { k, dir } = ADM.sort;
  rs.sort((a, b) => { const x = a[k], y = b[k]; return (isNaN(+x) || isNaN(+y) ? String(x).localeCompare(String(y)) : (+x) - (+y)) * dir; });
  $('#admTbl').innerHTML = `<thead><tr>${cols.map(([c, l]) => `<th data-sort="${c}">${l}${k === c ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th></th></tr></thead><tbody>` +
    (rs.length ? rs.map(r => `<tr class="clk" data-att="${esc(r.attemptId)}"><td>${esc(String(r.timestamp).replace('T', ' ').slice(0, 16))}</td><td>${esc(r.trainingId)}</td><td>${esc(r.name)}</td><td>${esc(r.country)}</td><td>${esc(r.trainer)}</td><td>${esc(r.wave || '—')}</td><td>${esc(r.day)}</td><td>${esc(r.attemptNo)}</td>
      <td><b>${esc(r.accuracy)}%</b></td><td>${esc(r.correctDecisions)}/${esc(r.questions)}</td><td>${esc(r.xp)}</td><td>${fmtTime(+r.durationSec || 0)}</td><td>${esc(r.criticalErrors)}</td>
      <td><span class="tag ${truthy(r.passed) ? 'pass' : 'fail'}">${truthy(r.passed) ? 'PASS' : 'FAIL'}</span>${r.source === 'local' ? ' <span class="tag off">local</span>' : ''}</td><td><button class="btn btn-ghost btn-sm">View</button></td></tr>`).join('')
      : `<tr><td colspan="15" style="text-align:center;color:#888;padding:30px">No attempts yet.</td></tr>`) + '</tbody>';
  $$('#admTbl th[data-sort]').forEach(th => th.onclick = () => { ADM.sort = { k: th.dataset.sort, dir: ADM.sort.k === th.dataset.sort ? -ADM.sort.dir : -1 }; drawDash(); });
  $$('#admTbl [data-att]').forEach(tr => tr.onclick = () => admAttempt(tr.dataset.att));
}
function admAttempt(id) {
  const a = ADM.results.find(r => r.attemptId === id); const qs = ADM.questions.filter(q => q.attemptId === id).sort((x, y) => x.qNo - y.qNo);
  const D = DECISIONS, rl = k => (REASONS[k] ? REASONS[k].label : k || '—');
  generic(`Attempt ${esc(id)}`, `<p><b>${esc(a.name)}</b> (ID ${esc(a.trainingId)}) · ${esc(a.country)} · Trainer ${esc(a.trainer)} · Day ${esc(a.day)} · ${esc(a.accuracy)}% · ${esc(a.xp)} XP<br><span style="color:#6b7785;font-size:12px">Badges: ${esc(a.badges || '—')} · ${esc(a.startedAt)} → ${esc(a.finishedAt)}</span></p>
    <table class="fb-tbl"><tr><th>#</th><th>Property</th><th>Agent action</th><th>Expected</th><th>Reason</th><th>Data</th><th>Score</th><th>Time</th><th>Notes / TA link</th></tr>
    ${qs.map(q => `<tr><td>${q.qNo}</td><td>${esc(q.hotel)}<div style="font-size:11px;color:#888">${esc(q.caseId)}</div></td><td>${D[q.decision] ? D[q.decision].short : esc(q.decision)}</td><td>${D[q.expectedDecision] ? D[q.expectedDecision].short : ''} ${truthy(q.decisionOk) ? '<span class="ok-c">✔</span>' : '<span class="bad-c">✖</span>'}</td>
      <td>${truthy(q.reasonOk) ? '<span class="ok-c">✔</span>' : '<span class="bad-c">✖</span>'} ${esc(rl(q.reason))}</td><td>${esc(q.fieldsPct)}%</td><td><b>${esc(q.score)}</b>${truthy(q.critical) ? ' 🚨' : ''}</td><td>${fmtTime(+q.timeSec || 0)}</td><td style="max-width:240px;word-break:break-word">${esc(q.notes)}${q.match ? `<div style="font-size:11px">🔗 ${esc(q.match)}</div>` : ''}<div style="font-size:10.5px;color:#999">${esc(q.fieldDetail)}</div></td></tr>`).join('') || '<tr><td colspan="9">No question detail available.</td></tr>'}</table>`,
    `<button class="btn btn-danger btn-sm" id="delAtt">🗑 Delete attempt</button><span style="flex:1"></span><button class="btn btn-ghost" data-close="mGeneric">Close</button>`);
  $('#delAtt').onclick = async () => {
    if (!confirm('Delete this attempt permanently?')) return;
    if (ADM.online) { try { await API.call({ action: 'deleteAttempt', token: ADM.token, attemptId: id }); } catch (e) { return toast('⚠ ' + e.message); } }
    LS.set('lmt_attempts', LS.get('lmt_attempts', []).filter(x => x.attemptId !== id));
    closeModal('mGeneric'); await fetchAdminData(); renderAdmin(); toast('Attempt deleted');
  };
}

/* =====================================================================
   QUESTION BANK
   ===================================================================== */
function saveLocalCfg() { LS.set('lmt_cfg_local', CFG); }
async function qbSave(items) {
  if (ADM.online) { await API.call({ action: 'saveQuestions', token: ADM.token, items }); await loadConfig(); }
  else {
    items.forEach(q => { const i = CFG.questions.findIndex(x => x.id === q.id); if (i >= 0) CFG.questions[i] = q; else CFG.questions.push(q); });
    saveLocalCfg(); registerQuestionGeos(); fillLogin();
  }
}
async function qbDelete(id) {
  if (ADM.online) { await API.call({ action: 'deleteQuestion', token: ADM.token, id }); await loadConfig(); }
  else { CFG.questions = CFG.questions.filter(q => q.id !== id); saveLocalCfg(); fillLogin(); }
}
async function qbToggle(q) {
  if (q.custom) { const c = CFG.questions.find(x => x.id === q.id); const n = Object.assign({}, c, { active: !q.active }); return qbSave([n]); }
  if (ADM.online) { await API.call({ action: 'setBuiltin', token: ADM.token, id: q.id, active: !q.active }); await loadConfig(); }
  else { const s = new Set(CFG.builtinOff); if (q.active) s.add(q.id); else s.delete(q.id); CFG.builtinOff = [...s]; saveLocalCfg(); fillLogin(); }
}
function admQB(b) {
  const all = allQuestions();
  const counts = DAY_LIST().map(d => [d, all.filter(q => q.active && Number(q.day) === d).length]).filter(([, n]) => n);
  b.innerHTML = `<div class="cfg-card" style="margin-bottom:12px"><div class="qb-toolbar">
      <button class="btn btn-pri btn-sm" id="qbAdd">＋ Add question manually</button>
      <button class="btn btn-ghost btn-sm" id="qbTplX">⬇ Excel template</button>
      <button class="btn btn-ghost btn-sm" id="qbTplC">⬇ CSV template</button>
      <button class="btn btn-ghost btn-sm" id="qbUp">⬆ Upload filled template</button><input type="file" id="qbFile" accept=".xlsx,.xls,.csv" class="hidden">
      <button class="btn btn-ghost btn-sm" id="qbExport">⬇ Export question bank (to edit &amp; re-upload)</button></div>
      <div style="font-size:12.5px;color:#6b7785">How it works: download the template → fill one row per hotel (read the <b>Guidelines</b> sheet) → upload it here. Each day plays its first <b>${APP_CONFIG.QUESTIONS_PER_DAY}</b> active questions by Q#. Re-using a built-in Case ID replaces that built-in question. Days 6–${APP_CONFIG.MAX_DAYS} are free for your own sets — unlock them on a Wave.</div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${counts.map(([d, n]) => `<span class="tag ${n >= APP_CONFIG.QUESTIONS_PER_DAY ? 'on' : 'off'}">Day ${d}: ${n} active${n > APP_CONFIG.QUESTIONS_PER_DAY ? ' (first ' + APP_CONFIG.QUESTIONS_PER_DAY + ' used)' : ''}</span>`).join('')}</div></div>
    <div class="filters"><select id="qbDay"><option value="">All days</option>${DAY_LIST().map(d => `<option value="${d}"${String(d) === ADM.qbDay ? ' selected' : ''}>Day ${d}</option>`).join('')}</select><input id="qbQ" placeholder="Search case / hotel" value="${esc(ADM.qbSearch)}"></div>
    <div class="tbl-card" style="margin-top:0"><table class="rtbl" id="qbTbl"></table></div>`;
  const draw = () => {
    ADM.qbDay = $('#qbDay').value; ADM.qbSearch = $('#qbQ').value;
    const rows = allQuestions().filter(q => (!ADM.qbDay || String(q.day) === ADM.qbDay) && (!ADM.qbSearch || `${q.id} ${q.feed.name} ${first(q.ans.name) || ''}`.toLowerCase().includes(ADM.qbSearch.toLowerCase())));
    $('#qbTbl').innerHTML = `<thead><tr><th>Case ID</th><th>Day</th><th>Q#</th><th>Feed name</th><th>Correct name</th><th>Parent</th><th>Action</th><th>Source</th><th>Status</th><th></th></tr></thead><tbody>` +
      rows.map(q => `<tr><td><b>${esc(q.id)}</b></td><td>${q.day}</td><td>${q.q}</td><td>${esc(q.feed.name)}</td><td>${esc(first(q.ans.name) || '—')}</td><td style="font-size:11.5px">${esc(geoLabel(q.ans.parent))}</td>
        <td>${DECISIONS[q.ans.decision].icon} ${DECISIONS[q.ans.decision].short}</td><td><span class="tag ${q.custom ? 'custom' : 'builtin'}">${q.custom ? (CASES.some(c => c.id === q.id) ? 'Trainer (replaces built-in)' : 'Trainer') : 'Built-in'}</span></td>
        <td><button class="tag ${q.active ? 'on' : 'off'}" style="border:0" data-qtog="${esc(q.id)}">${q.active ? 'Active' : 'Off'}</button></td>
        <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-qedit="${esc(q.id)}">${q.custom ? 'Edit' : 'Edit copy'}</button> ${q.custom ? `<button class="btn btn-danger btn-sm" data-qdel="${esc(q.id)}">✕</button>` : ''}</td></tr>`).join('') + '</tbody>';
    $$('[data-qtog]').forEach(x => x.onclick = async () => { try { await qbToggle(allQuestions().find(q => q.id === x.dataset.qtog)); admQB(b); } catch (e) { toast('⚠ ' + e.message); } });
    $$('[data-qedit]').forEach(x => x.onclick = () => qbForm(allQuestions().find(q => q.id === x.dataset.qedit)));
    $$('[data-qdel]').forEach(x => x.onclick = async () => { if (!confirm('Delete question ' + x.dataset.qdel + '?' + (CASES.some(c => c.id === x.dataset.qdel) ? ' The built-in version will come back.' : ''))) return; try { await qbDelete(x.dataset.qdel); admQB(b); toast('Deleted'); } catch (e) { toast('⚠ ' + e.message); } });
  };
  $('#qbDay').onchange = draw; $('#qbQ').oninput = draw; draw();
  $('#qbAdd').onclick = () => qbForm(null);
  $('#qbTplX').onclick = () => downloadTemplate('xlsx');
  $('#qbTplC').onclick = () => downloadTemplate('csv');
  $('#qbExport').onclick = () => downloadTemplate('xlsx', allQuestions().map(q => questionToRow(q)), 'LMT_Question_Bank_Export.xlsx');
  $('#qbUp').onclick = () => $('#qbFile').click();
  $('#qbFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
}

/* ---------- manual add / edit form ---------- */
function qbForm(q) {
  const r = q ? questionToRow(q) : { id: 'C-' + String(CFG.questions.length + 1).padStart(3, '0'), day: 6, q: 1, active: 'Y', 'ans.decision': 'Approve' };
  if (q && !q.custom) r.id = q.id; // editing a built-in creates a trainer copy with the same ID (replaces it)
  const groups = [['Question', ['id', 'day', 'q', 'active']], ['What the provider feed sends (Requested Change column)', TPL.filter(t => t[0].startsWith('feed.') || t[0] === 'providerUrl').map(t => t[0])],
    ['Correct answer', ['ans.decision', 'ans.reason', 'ans.match', 'ans.name', 'ans.brand', 'ans.street', 'ans.street2', 'ans.postal', 'parentLabel', 'ans.phone', 'ans.email', 'ans.url', 'ans.type', 'ans.rooms', 'ans.floors', 'ans.opening', 'ans.allIncl', 'ans.lat', 'ans.lng', 'geoTol']],
    ['Internal LMT evidence & coaching', ['votes', 'owners', 'audit', 'tip']]];
  const T = Object.fromEntries(TPL.map(t => [t[0], t]));
  const input = k => {
    const v = r[k] == null ? '' : r[k];
    if (k === 'ans.decision') return `<select data-qf="${k}">${['Approve', 'Alias', 'Reject', 'Tier 1', 'Tier 2', 'Defer'].map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
    if (k === 'active' || k === 'ans.allIncl') return `<select data-qf="${k}">${(k === 'active' ? ['Y', 'N'] : ['', 'Y', 'N']).map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
    if (k === 'ans.reason') return `<input data-qf="${k}" list="dlReasons" value="${esc(v)}">`;
    if (k === 'ans.type' || k === 'feed.type') return `<input data-qf="${k}" list="dlTypes" value="${esc(v)}">`;
    if (k === 'parentLabel') return `<input data-qf="${k}" list="dlGeos" value="${esc(v)}">`;
    if (['tip', 'votes', 'owners', 'audit', 'feed.desc'].includes(k)) return `<textarea data-qf="${k}">${esc(v)}</textarea>`;
    return `<input data-qf="${k}" value="${esc(v)}">`;
  };
  generic(q ? (q.custom ? '✏️ Edit question ' + esc(q.id) : '✏️ Edit built-in ' + esc(q.id) + ' (saved as a trainer copy that replaces it)') : '＋ Add question',
    `<datalist id="dlReasons">${Object.values(REASONS).map(x => `<option value="${esc(x.label)}">`).join('')}</datalist>
     <datalist id="dlTypes">${ACCOM_TYPES.concat(['N/A']).map(t => `<option value="${esc(t)}">`).join('')}</datalist>
     <datalist id="dlGeos">${GEOS.filter(g => !g.noParent).map(g => `<option value="${esc(g.name + ', ' + g.path)}">`).join('')}</datalist>
     <p style="font-size:12px;color:#6b7785;margin-top:0">Blank = not scored · <b>BLANK</b> = agent must leave it empty · several accepted answers: separate with <b> | </b>. Hover a label for help.</p>
     <div class="qb-form">${groups.map(([g, keys]) => `<h5>${g}</h5>` + keys.map(k => `<div class="${['tip', 'votes', 'owners', 'audit', 'feed.desc'].includes(k) ? 'span3' : ''}"><label title="${esc(T[k][2])}">${esc(T[k][1])}${/Required/.test(T[k][2]) ? ' *' : ''}</label>${input(k)}</div>`).join('')).join('')}</div>
     <div class="err-msg" id="qfErr" style="margin-top:10px"></div>`,
    `<button class="btn btn-ghost" data-close="mGeneric">Cancel</button><button class="btn btn-pri" id="qfSave">Save question</button>`);
  $('#qfSave').onclick = async () => {
    const row = {}; $$('[data-qf]').forEach(el => row[el.dataset.qf] = el.value);
    const { q: nq, errors } = rowToQuestion(row);
    if (errors.length) return ($('#qfErr').innerHTML = errors.map(esc).join('<br>'));
    try { $('#qfSave').disabled = true; await qbSave([nq]); closeModal('mGeneric'); renderAdmin(); toast('Question ' + nq.id + ' saved'); }
    catch (e) { $('#qfErr').textContent = e.message; $('#qfSave').disabled = false; }
  };
}

/* ---------- template download ---------- */
const TEMPLATE_GUIDE = [
  'LMT PLACES SIMULATOR — QUESTION TEMPLATE GUIDELINES',
  '',
  'HOW TO USE',
  '1. Fill the "Questions" sheet: ONE ROW = ONE HOTEL CASE. Do not rename or reorder the header row.',
  '2. Delete the two EXAMPLE rows (rows whose Case ID starts with EXAMPLE are ignored anyway).',
  '3. Save the file (keep .xlsx, or save as .csv) and upload it in Admin Portal → Questions → Upload filled template.',
  '4. The upload shows every row with errors before anything is saved. Fix them and upload again — rows with the same Case ID are updated, not duplicated.',
  '',
  'CHOOSING HOTELS',
  '• Use REAL properties that agents can find on Google / Google Maps / the official site / social pages, and that are NOT yet on Tripadvisor (search tripadvisor.com first).',
  '• For an Alias (duplicate) case, use a property that IS on Tripadvisor and paste its Tripadvisor URL in "Existing Tripadvisor Listing".',
  '• For fraud / unverifiable practice, use an invented name and put the evidence in Feed Description, Location Votes, Owners or Audit notes. Never accuse a real business of fraud.',
  '• Re-check your answers a few days before each wave — real phone numbers and websites change.',
  '',
  'FEED COLUMNS (what the provider sent)',
  '• These appear in LMT\'s "Requested Change" column. They can be deliberately wrong (ALL CAPS, wrong postal code, pin in the wrong town) — that is the lesson.',
  '• Feed Latitude / Longitude are required: they are where the map pin starts.',
  '',
  'CORRECT ANSWER COLUMNS (how the agent is scored)',
  '• Leave a cell EMPTY → that field is not scored.',
  '• Type BLANK → the agent must leave that field empty (e.g. no postal code exists, no website).',
  '• Several acceptable answers → separate with space-pipe-space, e.g.  Purok 2, South Poblacion | P-2 South Poblacion',
  '• Phone numbers in international format: +91 487 233 9104.  URLs with https://.',
  '• Correct Parent: write "City, District/Region, State, Country" — e.g. "Munnar, Idukki District, Kerala, India". If the place is not in the simulator yet, it is added to the parent search automatically.',
  '• Correct Latitude / Longitude: copy from Google Maps (right-click the pin → click the numbers). Geo Tolerance (m) = distance for full marks (default 150; use 300–500 for rural places).',
  '',
  'ACTIONS AND REASONS (see the Lists sheet)',
  '• Approve (reason optional) · Alias (reason optional) · Reject · Tier 1 · Tier 2 · Defer — Reject/Tier 1/Tier 2/Defer need a reason from the Lists sheet.',
  '• Several accepted reasons: separate with " | ".',
  '',
  'SCORING (per case, 100 points)',
  '• Correct action 30 · correct reason 10 · data capture 60 (weighted by field).',
  '• Alias cases score the Tripadvisor link instead of the fields. Reject / Tier 1 / Tier 2 cases score the action only.',
  '• Approving a case whose answer is Alias / Reject / Tier 1 / Tier 2 = critical error (0).',
  '',
  'EVIDENCE COLUMNS (shown inside LMT, not on the internet)',
  '• Location Votes: separate votes with " ;; " — e.g.  Closed: gate locked, sign says closed ;; Closed: now a school',
  '• Owners Panel Notes / Audit Trail Notes: free text.',
  '• Coaching Note (required): what the agent should learn. It is shown after they answer.',
  '',
  'DAYS',
  '• Day 1–5 ship with built-in cases; Day 6–' + APP_CONFIG.MAX_DAYS + ' are empty and free for your own sets. Each day plays its first ' + APP_CONFIG.QUESTIONS_PER_DAY + ' active questions in Q# order.',
  '• To change a built-in question: Export question bank, edit the row (keep its Case ID), upload. To hide one: switch it Off in the Questions tab.',
  '• Agents only see a day after you tick it on a Wave or create a Session for it.'
];
const TEMPLATE_EXAMPLES = [
  { id: 'EXAMPLE-1', day: 6, q: 1, active: 'Y', 'feed.name': 'SUNRISE HOMESTAY', 'feed.street': 'NEAR BUS STAND', 'feed.postal': '685612', 'feed.parentText': 'IN, Munnar', 'feed.phone': '9446000000', 'feed.type': 'Hotel', 'feed.lat': 10.0889, 'feed.lng': 77.0595,
    'ans.decision': 'Approve', 'ans.name': 'Sunrise Homestay', 'ans.street': 'Near KSRTC Bus Stand | Near Bus Stand', 'ans.postal': '685612', parentLabel: 'Munnar, Idukki District, Kerala, India', 'ans.phone': '+91 94460 00000', 'ans.email': 'BLANK', 'ans.url': 'BLANK', 'ans.type': 'Guest House', 'ans.rooms': 5, 'ans.lat': 10.0889, 'ans.lng': 77.0595, geoTol: 300,
    tip: 'Feed was ALL CAPS and the phone had no country code. No website or email exists, so both stay blank.' },
  { id: 'EXAMPLE-2', day: 6, q: 2, active: 'Y', 'feed.name': 'Paradise Beach Villas', 'feed.parentText': 'IN, Goa', 'feed.lat': 15.55, 'feed.lng': 73.75, 'feed.desc': 'Pay 100% advance by UPI to confirm. No cash at check-in.',
    'ans.decision': 'Tier 2', 'ans.reason': 'Suspected fraud / scam indicators', parentLabel: 'Candolim, Bardez, North Goa District, Goa, India', 'ans.lat': 15.518, 'ans.lng': 73.762,
    votes: 'Scam: paid advance, property does not exist ;; Scam: number switched off after payment', tip: 'Advance payment to a personal account plus scam reports = Tier 2, never a simple reject.' }
];
async function loadSheetJS() {
  if (window.XLSX) return true;
  const urls = ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'];
  for (const u of urls) {
    const ok = await new Promise(res => { const s = document.createElement('script'); s.src = u; s.onload = () => res(!!window.XLSX); s.onerror = () => res(false); document.head.appendChild(s); });
    if (ok) return true;
  }
  return false;
}
async function downloadTemplate(fmt, rows, fname) {
  rows = rows || TEMPLATE_EXAMPLES;
  const headers = TPL.map(t => t[1]);
  const aoa = [headers].concat(rows.map(r => TPL.map(t => r[t[0]] == null ? '' : r[t[0]])));
  if (fmt === 'xlsx' && await loadSheetJS()) {
    const wb = XLSX.utils.book_new();
    const g = XLSX.utils.aoa_to_sheet(TEMPLATE_GUIDE.map(l => [l]).concat([[''], ['COLUMN REFERENCE'], ['Column', 'What to enter']], TPL.map(t => [t[1], t[2]])));
    g['!cols'] = [{ wch: 44 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, g, 'Guidelines');
    const q = XLSX.utils.aoa_to_sheet(aoa); q['!cols'] = headers.map(h => ({ wch: Math.max(14, Math.min(40, h.length + 4)) }));
    XLSX.utils.book_append_sheet(wb, q, 'Questions');
    const lists = [['Actions', 'Reasons (Action → Reason)', 'Accommodation types', 'Brands', 'Existing parent geos']];
    const reasons = Object.values(REASONS).map(r => DECISIONS[r.d].short + ' → ' + r.label), geos = GEOS.filter(x => !x.noParent).map(x => x.name + ', ' + x.path);
    const types = ACCOM_TYPES.concat(['N/A']), acts = ['Approve', 'Alias', 'Reject', 'Tier 1', 'Tier 2', 'Defer'];
    for (let i = 0; i < Math.max(reasons.length, geos.length, types.length); i++) lists.push([acts[i] || '', reasons[i] || '', types[i] || '', BRANDS[i] || '', geos[i] || '']);
    const l = XLSX.utils.aoa_to_sheet(lists); l['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 24 }, { wch: 26 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, l, 'Lists');
    XLSX.writeFile(wb, fname || 'LMT_Question_Template.xlsx');
    return;
  }
  if (fmt === 'xlsx') toast('Excel library could not load (offline?) — downloading CSV instead');
  const csv = '﻿' + TEMPLATE_GUIDE.concat(['', 'Valid reasons: ' + Object.values(REASONS).map(r => r.label).join(' / '), 'Valid types: ' + ACCOM_TYPES.join(' / ') + ' / N/A'])
    .map(l => '# ' + l).map(csvCell).join('\n') + '\n' + aoa.map(r => r.map(csvCell).join(',')).join('\n');
  downloadBlob((fname || 'LMT_Question_Template.xlsx').replace(/\.xlsx$/, '.csv'), new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

/* ---------- template upload ---------- */
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => !(r.length && String(r[0]).trim().startsWith('#')) && r.some(c => String(c).trim() !== ''));
}
async function importFile(file) {
  let aoa;
  try {
    if (/\.csv$/i.test(file.name)) aoa = parseCsv(await file.text());
    else {
      if (!await loadSheetJS()) return toast('⚠ Excel library could not load — save the file as CSV and upload that');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const name = wb.SheetNames.find(n => /question/i.test(n)) || wb.SheetNames.find(n => { const r = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })[0] || []; return r.includes('Case ID'); }) || wb.SheetNames[0];
      aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
    }
  } catch (e) { return toast('⚠ Could not read file: ' + e.message); }
  const hIdx = aoa.findIndex(r => r.map(c => String(c).trim()).includes('Case ID'));
  if (hIdx < 0) return toast('⚠ Header row with "Case ID" not found — use the template');
  const hdr = aoa[hIdx].map(c => String(c).trim().toLowerCase());
  const keyByHeader = Object.fromEntries(TPL.map(t => [t[1].toLowerCase(), t[0]]));
  const missingCols = TPL.filter(t => /Required/.test(t[2]) && !hdr.includes(t[1].toLowerCase())).map(t => t[1]);
  const parsed = [];
  aoa.slice(hIdx + 1).forEach((r, i) => {
    if (!r.some(c => String(c).trim())) return;
    const obj = {}; hdr.forEach((h, j) => { if (keyByHeader[h]) obj[keyByHeader[h]] = r[j]; });
    if (/^example/i.test(String(obj.id || '').trim())) return;
    const res = rowToQuestion(obj); res.line = hIdx + i + 2; parsed.push(res);
  });
  const ids = {}; parsed.forEach(p => { const id = p.q.id; if (id) { if (ids[id]) p.errors.push('Duplicate Case ID in file (also row ' + ids[id] + ')'); else ids[id] = p.line; } });
  const ok = parsed.filter(p => !p.errors.length), bad = parsed.filter(p => p.errors.length);
  generic('⬆ Upload preview — ' + esc(file.name),
    `${missingCols.length ? `<div class="crit">Missing required columns: ${esc(missingCols.join(', '))}</div>` : ''}
     <p><span class="imp-ok">✔ ${ok.length} row(s) ready</span> · <span class="imp-err">✖ ${bad.length} row(s) with errors</span></p>
     <table class="fb-tbl"><tr><th>Row</th><th>Case ID</th><th>Day/Q#</th><th>Feed name</th><th>Action</th><th>Status</th></tr>
     ${parsed.map(p => `<tr><td>${p.line}</td><td>${esc(p.q.id)}</td><td>${p.q.day}/${p.q.q}</td><td>${esc(p.q.feed.name)}</td><td>${p.q.ans.decision ? DECISIONS[p.q.ans.decision].short : '—'}</td><td>${p.errors.length ? `<span class="imp-err">${p.errors.map(esc).join('<br>')}</span>` : `<span class="imp-ok">✔ OK${allQuestions().some(x => x.id === p.q.id) ? ' (updates existing)' : ' (new)'}</span>`}</td></tr>`).join('') || '<tr><td colspan="6">No data rows found.</td></tr>'}</table>`,
    `<button class="btn btn-ghost" data-close="mGeneric">Cancel</button><button class="btn btn-pri" id="impGo" ${ok.length && !missingCols.length ? '' : 'disabled'}>Import ${ok.length} valid question(s)</button>`);
  if ($('#impGo')) $('#impGo').onclick = async () => {
    $('#impGo').disabled = true;
    try { await qbSave(ok.map(p => p.q)); closeModal('mGeneric'); ADM.tab = 'qb'; renderAdmin(); toast(`✔ Imported ${ok.length} question(s)`); }
    catch (e) { toast('⚠ ' + e.message); $('#impGo').disabled = false; }
  };
}

/* ---------- Case analytics ---------- */
function admCases(b) {
  const by = {};
  ADM.questions.forEach(q => { const o = by[q.caseId] = by[q.caseId] || { n: 0, ok: 0, score: 0, time: 0, crit: 0, wrong: {} }; o.n++; o.ok += truthy(q.decisionOk) ? 1 : 0; o.score += +q.score || 0; o.time += +q.timeSec || 0; o.crit += truthy(q.critical) ? 1 : 0; if (!truthy(q.decisionOk)) o.wrong[q.decision] = (o.wrong[q.decision] || 0) + 1; });
  b.innerHTML = `<p style="font-size:13px;color:#6b7785;margin-top:0">How each case performs across all agents — use it to find the concepts that need re-training.</p><div class="tbl-card" style="margin-top:0"><table class="rtbl"><thead><tr><th>Case</th><th>Day</th><th>Property</th><th>Correct action</th><th>Attempts</th><th>Action accuracy</th><th>Avg score</th><th>Avg time</th><th>Most common wrong action</th><th>🚨</th></tr></thead><tbody>
    ${allQuestions().map(c => { const o = by[c.id]; const pct = o ? Math.round(o.ok / o.n * 100) : null; const w = o ? Object.entries(o.wrong).sort((x, y) => y[1] - x[1])[0] : null;
      return `<tr><td>${esc(c.id)}</td><td>${c.day}</td><td>${esc(first(c.ans.name) || c.feed.name)}</td><td>${DECISIONS[c.ans.decision].icon} ${DECISIONS[c.ans.decision].short}</td><td>${o ? o.n : 0}</td>
      <td>${pct == null ? '—' : `<div style="display:flex;align-items:center;gap:6px"><div style="width:80px;height:8px;background:#eee;border-radius:9px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)'}"></div></div>${pct}%</div>`}</td>
      <td>${o ? Math.round(o.score / o.n) : '—'}</td><td>${o ? fmtTime(o.time / o.n) : '—'}</td><td>${w && DECISIONS[w[0]] ? DECISIONS[w[0]].short + ' (' + w[1] + ')' : '—'}</td><td>${o ? o.crit : 0}</td></tr>`; }).join('')}</tbody></table></div>`;
}

/* ---------- Leaderboard ---------- */
function admBoard(b) {
  const by = {};
  ADM.results.forEach(r => { const o = by[r.trainingId] = by[r.trainingId] || { id: r.trainingId, name: r.name, trainer: r.trainer, wave: r.wave, xp: 0, best: {}, n: 0 }; o.xp += +r.xp || 0; o.n++; o.best[r.day] = Math.max(o.best[r.day] || 0, +r.accuracy || 0); });
  const rows = Object.values(by).sort((a, b) => b.xp - a.xp);
  const days = availableDays();
  b.innerHTML = `<div class="tbl-card" style="margin-top:0"><table class="rtbl"><thead><tr><th>Rank</th><th>Agent</th><th>Trainer</th><th>Wave</th><th>Total XP</th><th>Level</th>${days.map(d => `<th>Day ${d} best</th>`).join('')}<th>Attempts</th></tr></thead><tbody>
    ${rows.map((o, i) => `<tr><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td><b>${esc(o.name)}</b><div style="font-size:11px;color:#888">${esc(o.id)}</div></td><td>${esc(o.trainer)}</td><td>${esc(o.wave || '—')}</td><td><b>${o.xp}</b></td><td>${esc(levelFor(o.xp).name)}</td>${days.map(d => `<td>${o.best[d] != null ? o.best[d] + '%' : '—'}</td>`).join('')}<td>${o.n}</td></tr>`).join('') || `<tr><td colspan="${8 + days.length}" style="text-align:center;color:#888;padding:30px">No data yet.</td></tr>`}</tbody></table></div>`;
}

/* ---------- config editing (trainers, countries, waves, sessions) ---------- */
const CFG_KEYS = { trainer: ['trainers', 'name'], country: ['countries', 'name'], wave: ['waves', 'code'], session: ['sessions', 'id'] };
async function cfgUpsert(kind, item) {
  if (ADM.online) { await API.call({ action: 'upsertConfig', token: ADM.token, kind, item }); return; }
  const L = CFG_KEYS[kind], arr = CFG[L[0]], i = arr.findIndex(x => x[L[1]] === item[L[1]]);
  if (i >= 0) arr[i] = Object.assign(arr[i], item); else arr.push(item);
  saveLocalCfg();
}
async function ensureTrainer(name) {
  name = String(name || '').trim(); if (!name) return;
  if (!CFG.trainers.some(t => t.name.toLowerCase() === name.toLowerCase())) await cfgUpsert('trainer', { name, active: true });
}
async function cfgSave(kind, item, trainerName) {
  try { if (trainerName) await ensureTrainer(trainerName); await cfgUpsert(kind, item); if (ADM.online) await loadConfig(); else fillLogin(); }
  catch (e) { return toast('⚠ ' + e.message); }
  renderAdmin(); toast('Saved');
}
async function cfgDelete(kind, key) {
  if (!confirm('Delete ' + key + '?')) return;
  try {
    if (ADM.online) { await API.call({ action: 'deleteConfig', token: ADM.token, kind, key }); await loadConfig(); }
    else { const L = CFG_KEYS[kind]; CFG[L[0]] = CFG[L[0]].filter(x => x[L[1]] !== key); saveLocalCfg(); fillLogin(); }
  } catch (e) { return toast('⚠ ' + e.message); }
  renderAdmin(); toast('Deleted');
}
function admSess(b) {
  const dl = `<datalist id="dlTrainers">${CFG.trainers.map(t => `<option value="${esc(t.name)}">`).join('')}</datalist>`;
  const days = availableDays(), dayOpts = days.map(d => `<option value="${d}">Day ${d} · ${esc(dayMeta(d).title)}</option>`).join('');
  b.innerHTML = dl + `<div class="cfg-grid">
    <div class="cfg-card"><h4>🗓️ Trainer sessions</h4><p style="font-size:12px;color:#6b7785;margin-top:0">A session locks agents to one day — they pick it on the login page instead of a day. Type the trainer's name; new names are saved to the trainer list automatically.</p>
      <div class="cfg-form"><input id="sName" placeholder="Session name (e.g. Batch 12 – Morning)" style="flex:1;min-width:180px"><input id="sTrainer" list="dlTrainers" placeholder="Trainer name" style="width:150px">
        <select id="sDay">${dayOpts}</select><select id="sWave"><option value="">Any wave</option>${CFG.waves.map(w => `<option>${esc(w.code)}</option>`).join('')}</select><button class="btn btn-pri btn-sm" id="sAdd">+ Create</button></div>
      <table class="rtbl" style="min-width:0"><thead><tr><th>Session</th><th>Trainer</th><th>Day</th><th>Wave</th><th>Status</th><th></th></tr></thead><tbody>
      ${CFG.sessions.map(s => `<tr><td><b>${esc(s.name)}</b><div style="font-size:10.5px;color:#999">${esc(s.id)}</div></td><td>${esc(s.trainer)}</td><td>
        <select data-sday="${esc(s.id)}">${DAY_LIST().map(d => `<option value="${d}"${d === s.day ? ' selected' : ''}>Day ${d}</option>`).join('')}</select></td><td>${esc(s.wave || '—')}</td>
        <td><button class="tag ${s.active ? 'on' : 'off'}" style="border:0" data-stog="${esc(s.id)}">${s.active ? 'Active' : 'Closed'}</button></td><td><button class="btn btn-danger btn-sm" data-sdel="${esc(s.id)}">✕</button></td></tr>`).join('') || '<tr><td colspan="6" style="color:#888">No sessions</td></tr>'}</tbody></table></div>
    <div class="cfg-card"><h4>🌊 Waves</h4><p style="font-size:12px;color:#6b7785;margin-top:0">Choosing a wave unlocks the Training Day dropdown for the days ticked here. Only days that have questions are shown to agents.</p>
      <div class="cfg-form"><input id="wCode" placeholder="Wave code (e.g. PLACES-W2)" style="width:150px"><input id="wName" placeholder="Wave name" style="width:150px"><input id="wTrainer" list="dlTrainers" placeholder="Trainer name" style="width:140px">
        <span class="daychk">${DAY_LIST().map(d => `<label title="${days.includes(d) ? '' : 'No questions yet'}"><input type="checkbox" class="wd" value="${d}"${d <= 5 ? ' checked' : ''}>D${d}</label>`).join('')}</span><button class="btn btn-pri btn-sm" id="wAdd">+ Save</button></div>
      <table class="rtbl" style="min-width:0"><thead><tr><th>Wave</th><th>Trainer</th><th>Unlocked days</th><th>Status</th><th></th></tr></thead><tbody>
      ${CFG.waves.map(w => `<tr><td><b>${esc(w.code)}</b><div style="font-size:11px;color:#888">${esc(w.name)}</div></td><td>${esc(w.trainer)}</td>
        <td><span class="daychk">${DAY_LIST().map(d => `<label><input type="checkbox" data-wday="${esc(w.code)}" value="${d}"${w.days.split(/[,\s]+/).includes(String(d)) ? ' checked' : ''}>${d}</label>`).join('')}</span></td>
        <td><button class="tag ${w.active ? 'on' : 'off'}" style="border:0" data-wtog="${esc(w.code)}">${w.active ? 'Active' : 'Closed'}</button></td><td><button class="btn btn-danger btn-sm" data-wdel="${esc(w.code)}">✕</button></td></tr>`).join('') || '<tr><td colspan="5" style="color:#888">No waves</td></tr>'}</tbody></table></div></div>`;
  $('#sAdd').onclick = () => {
    const n = $('#sName').value.trim(), t = $('#sTrainer').value.trim();
    if (!n) return toast('Enter a session name'); if (!t) return toast('Type the trainer name');
    cfgSave('session', { id: 'S-' + uid().slice(-7), name: n, trainer: t, day: +$('#sDay').value, wave: $('#sWave').value, active: true, createdAt: nowIso() }, t);
  };
  $$('[data-sday]').forEach(s => s.onchange = () => cfgSave('session', Object.assign({}, CFG.sessions.find(x => x.id === s.dataset.sday), { day: +s.value })));
  $$('[data-stog]').forEach(s => s.onclick = () => { const o = CFG.sessions.find(x => x.id === s.dataset.stog); cfgSave('session', Object.assign({}, o, { active: !o.active })); });
  $$('[data-sdel]').forEach(s => s.onclick = () => cfgDelete('session', s.dataset.sdel));
  $('#wAdd').onclick = () => {
    const c = $('#wCode').value.trim().toUpperCase(), t = $('#wTrainer').value.trim();
    if (!c) return toast('Enter a wave code'); if (!t) return toast('Type the trainer name');
    const d = $$('.wd:checked').map(x => x.value).join(','); if (!d) return toast('Tick at least one day');
    cfgSave('wave', { code: c, name: $('#wName').value.trim(), trainer: t, days: d, active: true, createdAt: nowIso() }, t);
  };
  $$('[data-wday]').forEach(cb => cb.onchange = () => { const code = cb.dataset.wday; const d = $$(`[data-wday="${code}"]:checked`).map(x => x.value).join(','); if (!d) { cb.checked = true; return toast('A wave needs at least one day'); } cfgSave('wave', Object.assign({}, CFG.waves.find(x => x.code === code), { days: d })); });
  $$('[data-wtog]').forEach(s => s.onclick = () => { const o = CFG.waves.find(x => x.code === s.dataset.wtog); cfgSave('wave', Object.assign({}, o, { active: !o.active })); });
  $$('[data-wdel]').forEach(s => s.onclick = () => cfgDelete('wave', s.dataset.wdel));
}
function admPeople(b) {
  const list = (kind, arr, ph) => `<div class="cfg-form"><input id="add-${kind}" placeholder="${ph}" style="flex:1"><button class="btn btn-pri btn-sm" data-padd="${kind}">+ Add</button></div>
    <table class="rtbl" style="min-width:0"><tbody>${arr.map(x => `<tr><td>${esc(x.name)}</td><td><button class="tag ${x.active ? 'on' : 'off'}" style="border:0" data-ptog="${kind}|${esc(x.name)}">${x.active ? 'Active' : 'Hidden'}</button></td><td style="width:40px"><button class="btn btn-danger btn-sm" data-pdel="${kind}|${esc(x.name)}">✕</button></td></tr>`).join('')}</tbody></table>`;
  b.innerHTML = `<div class="cfg-grid"><div class="cfg-card"><h4>👥 Trainers</h4>${list('trainer', CFG.trainers, 'Trainer full name')}</div><div class="cfg-card"><h4>🌍 Countries</h4>${list('country', CFG.countries, 'Country')}</div></div>`;
  $$('[data-padd]').forEach(x => x.onclick = () => { const k = x.dataset.padd, v = $('#add-' + k).value.trim(); if (v) cfgSave(k, { name: v, active: true }); });
  $$('[data-ptog]').forEach(x => x.onclick = () => { const [k, n] = x.dataset.ptog.split('|'); const o = CFG[k === 'trainer' ? 'trainers' : 'countries'].find(y => y.name === n); cfgSave(k, { name: n, active: !o.active }); });
  $$('[data-pdel]').forEach(x => x.onclick = () => { const [k, n] = x.dataset.pdel.split('|'); cfgDelete(k, n); });
}

/* ---------- Settings ---------- */
function admSettings(b) {
  const pend = LS.get('lmt_pending', []).length;
  b.innerHTML = `<div class="cfg-grid">
    <div class="cfg-card"><h4>🔗 Google Sheet connection</h4>
      <p style="font-size:12.5px;color:#6b7785;margin-top:0">Paste the Apps Script <b>/exec</b> URL from your Google Sheet (see the setup guide). Saved in this browser — or put it in <code>APP_CONFIG.WEB_APP_URL</code> in script.js so every agent PC uses it.</p>
      <input class="mselect" id="setUrl" value="${esc(API.url())}" placeholder="https://script.google.com/macros/s/…/exec">
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn btn-pri btn-sm" id="setSave">Save</button><button class="btn btn-ghost btn-sm" id="setTest">Test connection</button><button class="btn btn-ghost btn-sm" id="setClear">Use offline mode</button></div>
      <div id="setMsg" style="font-size:12.5px;margin-top:8px"></div></div>
    <div class="cfg-card"><h4>⏳ Sync</h4><p style="font-size:13px">${pend} attempt(s) waiting to upload from this browser.</p><button class="btn btn-ghost btn-sm" id="setSync" ${pend ? '' : 'disabled'}>Sync now</button>
      ${!ADM.online && CFG.questions.length && API.configured() ? `<h4 style="margin-top:18px">📤 Local questions</h4><p style="font-size:12.5px">${CFG.questions.length} question(s) were added offline in this browser. Log in again while connected and re-upload them via Export → Upload.</p>` : ''}
      <h4 style="margin-top:18px">🧹 Local data</h4><p style="font-size:12.5px;color:#6b7785">Removes attempts, XP profiles, offline questions and settings stored in <b>this browser only</b>. Google Sheet data is not touched.</p><button class="btn btn-danger btn-sm" id="setWipe">Clear this browser's data</button></div>
    <div class="cfg-card"><h4>🔑 Admin password</h4>${ADM.online ? `<div class="cfg-form"><input type="password" id="np1" placeholder="New password (min 8)"><input type="password" id="np2" placeholder="Repeat"><button class="btn btn-pri btn-sm" id="npSave">Change</button></div><p style="font-size:12px;color:#6b7785">Stored in the Apps Script project's Script Properties.</p>`
      : `<p style="font-size:12.5px;color:#6b7785">The offline password is the SHA-256 value in <code>APP_CONFIG.OFFLINE_ADMIN_SHA256</code> in script.js (see the setup guide). Once a Sheet is connected, the Sheet password is used instead.</p>`}</div>
    <div class="cfg-card"><h4>ℹ️ About</h4><p style="font-size:12.5px;line-height:1.6">LMT Places Simulator v${APP_CONFIG.VERSION} · ${allQuestions().length} questions (${CASES.length} built-in) · pass mark ${APP_CONFIG.PASS_MARK}%.</p></div></div>`;
  const msg = (t, ok) => { $('#setMsg').innerHTML = `<span style="color:${ok ? 'var(--ok)' : 'var(--bad)'}">${t}</span>`; };
  $('#setSave').onclick = () => { const u = $('#setUrl').value.trim(); if (u && !/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) return msg('That doesn’t look like an Apps Script URL', false); LS.set('lmt_api_url', u); msg('Saved. Reloading…', true); loadConfig(); };
  $('#setTest').onclick = async () => { const u = $('#setUrl').value.trim(); if (!u) return msg('Enter a URL first', false); const old = LS.get('lmt_api_url', ''); LS.set('lmt_api_url', u); msg('Testing…', true);
    try { const r = await API.call({ action: 'ping' }); msg('✅ Connected — sheet “' + esc(r.sheet || '') + '”, server time ' + esc(r.time || ''), true); } catch (e) { LS.set('lmt_api_url', old); msg('❌ ' + esc(e.message || e) + ' — check the deployment has “Anyone” access and the URL ends in /exec', false); } };
  $('#setClear').onclick = () => { LS.set('lmt_api_url', ''); msg('Offline mode on (unless WEB_APP_URL is set in script.js).', true); loadConfig(); };
  $('#setSync').onclick = async () => { await flushPending(); renderAdmin(); toast('Sync finished'); };
  $('#setWipe').onclick = () => { if (!confirm('Clear all simulator data stored in this browser?')) return; ['lmt_attempts', 'lmt_pending', 'lmt_cfg_local', 'lmt_cfg_cache', 'lmt_last_login', 'lmt_questions_local', 'lmt_builtin_off_local'].forEach(LS.del); try { Object.keys(localStorage).filter(k => k.startsWith('lmt_profile_')).forEach(k => localStorage.removeItem(k)); } catch (e) { } toast('Browser data cleared'); loadConfig().then(() => fetchAdminData()).then(renderAdmin); };
  if ($('#npSave')) $('#npSave').onclick = async () => { const a = $('#np1').value, b2 = $('#np2').value; if (a.length < 8) return toast('Min 8 characters'); if (a !== b2) return toast('Passwords do not match'); try { await API.call({ action: 'changePassword', token: ADM.token, newPassword: a }); toast('Password changed'); $('#np1').value = $('#np2').value = ''; } catch (e) { toast('⚠ ' + e.message); } };
}

/* =====================================================================
   BOOT
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => { bindLogin(); bindGame(); loadConfig(); });
