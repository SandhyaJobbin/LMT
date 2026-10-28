/* =====================================================================
   LMT PLACES SIMULATOR — SETTINGS  (edit this block only)
   ===================================================================== */
const APP_CONFIG = {
  VERSION: '2.7',

  // Paste your Google Apps Script URL (ends in /exec) between the quotes so every
  // agent PC saves to the Google Sheet. Leave '' to run offline (browser storage).
  // (v2.6: the URL is set only here; it is no longer shown in Admin Portal → Settings.)
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
  DEFAULT_SESSIONS: [{ id: 'S-DEMO-D1', name: 'Demo Session', trainer: 'Jack Sparrow', day: 1, wave: '' }],

  // Parent search (🔍 next to Parent). Built-in geos show instantly; Enter searches every city, town and village worldwide
  // with its full chain (village, sub-district, district, state, country). Free OpenStreetMap services, no key needed.
  // Optional: put a free GeoNames username here (geonames.org → create account → enable "free web services") to search GeoNames first.
  GEO_SEARCH: { providers: ['nominatim', 'photon'], geonamesUser: '', language: 'en', maxResults: 10 },

  // Map under Geo Coding. The first tile server that loads is used; if a network blocks it, the next one is
  // tried automatically. (tile.openstreetmap.org is NOT used: its volunteer servers block shared office traffic
  // and show "Access blocked" tiles.) Satellite = the Map / Satellite switch in the map's top right corner.
  MAP_TILES: [
    { name: 'Esri Street Map', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' },
    { name: 'CARTO Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', subdomains: 'abcd', attribution: '© OpenStreetMap contributors © CARTO' }
  ],
  MAP_SATELLITE: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri'
  },

  // Left menu → "Helpful Links". Same five options as the live LMT, in the same order.
  // {name} = feed name · {city} = city from the feed's parent text · {cc} = its country code (e.g. IN)
  // {street} = feed street · {q} = name + city. Change a URL here if your live tool points elsewhere.
  HELPFUL_LINKS: [
    { label: 'Google', url: 'https://www.google.com/search?q={q}' },
    { label: 'Google Maps', url: 'https://www.google.com/maps/search/{q}' },
    { label: 'Geonames', url: 'https://www.geonames.org/search.html?q={city}&country={cc}' },
    { label: 'Tripadvisor', url: 'https://www.tripadvisor.com/Search?q={name}' },
    { label: 'StreetFinder', url: 'https://www.openstreetmap.org/search?query={street}' }
  ]
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
  1: { title: 'Accommodations 1', icon: '🧭', desc: 'Real small properties: clean names, addresses and pins.' },
  2: { title: 'Accommodations 2', icon: '🧹', desc: 'Messy feeds: wrong case, wrong postal codes, wrong pins.' },
  3: { title: 'Accommodations 3', icon: '🗺️', desc: 'Pick the right parent geo and fix pins that land in the wrong town.' },
  4: { title: 'Accommodations 4', icon: '🕵️', desc: 'Duplicates, businesses that are not hotels, and suspicious requests.' },
  5: { title: 'Accommodations 5', icon: '🏆', desc: 'Everything you have learned, with no warm up.' }
};
const dayMeta = d => DAY_META_BUILTIN[d] || { title: 'Accommodations ' + d, icon: '📝', desc: 'Trainer built cases.' };
const LEVELS = [[0, 'Trainee Mapper'], [600, 'Geo Scout'], [1500, 'Data Ranger'], [2700, 'Listing Pro'], [4000, 'Places Specialist'], [5200, 'LMT Master']];
const REQ_SECTIONS = { basic: 'Basic Info', contact: 'Contact Details', accom: 'Accommodation Info', geo: 'Geo Coding' };
/* Sections that stay hidden on every new request until the agent clicks "Show All Fields" (same as the live LMT) */
const HIDDEN_SECTIONS = { desc: 'Description', internal: 'Internal' }; // Geo Coding (lat/long + map) is always visible
/* Contact Details stays visible but shows only URL until "Show All Fields" (Phone, Fax, Email are hidden rows) */
const HIDDEN_ROWS = ['phone', 'fax', 'email'];
/* The feed NEVER pre-fills these — agents research them online (phone, email, URL) or from the
   provider page amenities / OTAs (type). Stripped from every question, built-in or trainer-made. */
const RESEARCH_FIELDS = ['phone', 'fax', 'email', 'url', 'type'];
const cleanFeed = f => { const o = Object.assign({}, f || {}); RESEARCH_FIELDS.forEach(k => delete o[k]); return o; };
const ATTRIBUTIONS = ['', 'Provider feed', 'Official website', 'Maps listing', 'Social media', 'Owner verified', 'Agent research'];
let GEO_BY_ID = Object.fromEntries(GEOS.map(g => [g.id, g]));
/* Parent geos are shown like Tripadvisor nav strings: "India, Kerala, Idukki District, Munnar" */
const geoLabel = id => { const g = GEO_BY_ID[id]; return g ? (g.nav || (g.name + (g.path ? ', ' + g.path : ''))) : ''; };
/* "303881 - India, Kerala, Idukki District, Munnar" (template / answer key format) */
const geoTplLabel = id => { const g = GEO_BY_ID[id]; return g ? (g.ta ? g.ta + ' - ' : '') + geoLabel(id) : String(id || ''); };
const geoCity = id => { const g = GEO_BY_ID[id]; return g ? g.name.replace(/\s*\(.*\)$/, '') : ''; };
function levelFor(xp) {
  let i = 0; for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k][0]) i = k;
  const cur = LEVELS[i], nxt = LEVELS[i + 1];
  return { n: i + 1, name: cur[1], floor: cur[0], next: nxt ? nxt[0] : null, pct: nxt ? (xp - cur[0]) / (nxt[0] - cur[0]) : 1 };
}

/* ---------------- API layer ---------------- */
const API = {
  url() { return (APP_CONFIG.WEB_APP_URL || LS.get('lmt_api_url', '') || '').trim(); }, // v2.6: script.js URL always wins
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
function normQuestion(q) {
  const LG = typeof LEGACY_GEOS !== 'undefined' ? LEGACY_GEOS : {}, LT = typeof LEGACY_TYPES !== 'undefined' ? LEGACY_TYPES : {}, LR = typeof LEGACY_REASONS !== 'undefined' ? LEGACY_REASONS : {};
  const mapG = v => Array.isArray(v) ? v.map(x => LG[x] || x) : (LG[v] || v);
  const mapT = v => Array.isArray(v) ? v.map(x => LT[x] || x) : (LT[v] || v);
  const A = Object.assign({}, q.ans || {});
  if (A.parent) A.parent = mapG(A.parent);
  if (A.decision === 't2') A.decision = 't1';                       // Tier 1 and Tier 2 are one "Escalate" action now
  if (A.reason !== undefined) { const r = [].concat(A.reason).map(x => REASONS[x] ? x : (LR[x] || x)); A.reason = r.length > 1 ? r : r[0]; }
  if (A.type !== undefined) A.type = mapT(A.type);
  const out = { ans: A };
  if (q.listing) out.listing = Object.assign({}, q.listing, { parent: mapG(q.listing.parent), type: mapT(q.listing.type) });
  if (q.listingNow && q.listingNow.type) out.listingNow = Object.assign({}, q.listingNow, { type: mapT(q.listingNow.type) });
  return out;
}
function allQuestions() {
  const custom = CFG.questions || [];
  const ids = new Set(custom.map(q => q.id));
  const off = new Set(CFG.builtinOff || []);
  const builtins = CASES.filter(c => !ids.has(c.id)).map(c => Object.assign({}, c, normQuestion(c), { feed: cleanFeed(c.feed), custom: false, active: !off.has(c.id) }));
  return builtins.concat(custom.map(q => Object.assign({}, q, normQuestion(q), { feed: cleanFeed(q.feed), custom: true, active: isActive(q.active) })))
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
  ['feed.rooms', 'Feed Rooms', 'Optional number.'],
  ['feed.lat', 'Feed Latitude', 'Required. Where the feed pin starts (can be wrong on purpose).'],
  ['feed.lng', 'Feed Longitude', 'Required.'],
  ['feed.desc', 'Feed Description', 'Optional text the feed sent (can contain red flags).'],
  ['providerUrl', 'Provider Page URL', 'Optional real link opened by "Open Provider Page". Blank = a generated provider snapshot opens.'],
  ['amen', 'Provider Amenities', 'Optional. Amenities shown on the provider snapshot — the clues agents use to pick the type. Separate with " ;; ". Blank = a standard list for the Correct Accommodation Type.'],
  ['ans.decision', 'Correct Action', 'Required. Approve, Alias, Reject, Escalate or Defer. (Old values Tier 1 / Tier 2 are read as Escalate.)'],
  ['ans.reason', 'Correct Reason', 'Required for Reject / Tier 1 / Tier 2 / Defer. Use a reason from the Lists sheet. Several accepted: separate with " | ".'],
  ['ans.match', 'Existing Tripadvisor Listing (Alias)', 'For Alias (possible match / dupe) cases: the existing listing\'s Tripadvisor URL or location ID (d123456). LMT shows it as the possible match, pre-filled with the Correct … values (plus any Current Values below). The agent clicks "Add name as alias" and edits what is wrong.'],
  ['listingNow', 'Existing Listing – Current Values', 'Optional, Alias cases only. What the existing listing shows NOW, as field=value pairs separated by " ;; " — e.g.  type=Hotel ;; brand=BLANK. Values that differ from the Correct … columns are what the agent must edit. Fields: name, brand, street, street2, postal, phone, email, url, type, rooms.'],
  ['decoy', 'Look-alike Listing (not a match)', 'Optional, non-Alias cases only. A similar existing listing that LMT shows as a possible match but is a DIFFERENT property:  Name ;; Address ;; Parent (City, Region, Country) ;; lat, lng ;; Type (optional). The agent must click "Not match, create new".'],
  ['ans.name', 'Correct Name', 'SCORED. Expected value. Blank = not scored. BLANK = agent must leave it empty. Several accepted: " | ".'],
  ['ans.brand', 'Correct Brand', 'Same rules. Must match a brand in the Lists sheet, or BLANK.'],
  ['ans.street', 'Correct Street One', 'SCORED. Same rules.'],
  ['ans.street2', 'Correct Street Two', 'Same rules.'],
  ['ans.postal', 'Correct Postal Code', 'Same rules.'],
  ['parentLabel', 'Correct Parent (City, Region, Country)', 'Required. Tripadvisor geo code and nav string, e.g. "303881 - India, Kerala, Idukki District, Munnar" (just "303881" works for geos already in the Lists sheet). Several accepted parents: separate with " | ". New geos are added to the Parent search automatically, searchable by name and code. Not scored.'],
  ['ans.phone', 'Correct Phone', 'International format, e.g. +91 487 233 9104. Several accepted: " | ".'],
  ['ans.email', 'Correct Email', 'Same rules.'],
  ['ans.url', 'Correct URL', 'SCORED. The official URL. BLANK if the property has none (an official Facebook / Instagram / Twitter page is then also accepted).'],
  ['ans.type', 'Correct Accommodation Type', 'From the Lists sheet (the live LMT types). Use N/A for businesses with no rooms. Not scored, but agents cannot save a listing without one.'],
  ['ans.rooms', 'Correct Rooms', 'Number, or blank to skip.'],
  ['ans.floors', 'Correct Floors', 'Number, or blank to skip.'],
  ['ans.opening', 'Correct Opening Date', 'YYYY-MM-DD (for Defer / pre-opening cases), or blank.'],
  ['ans.allIncl', 'All Inclusive', 'Y or N, or blank to skip.'],
  ['ans.lat', 'Correct Latitude', 'Required. SCORED (Geo). Decimal degrees, e.g. 10.0889 (south = negative).'],
  ['ans.lng', 'Correct Longitude', 'Required. Decimal degrees (west = negative).'],
  ['geoTol', 'Geo Tolerance (m)', 'Optional. Distance for full geo marks (default 150). Half marks up to 3× this.'],
  ['votes', 'Location Votes', 'Optional evidence shown in LMT. Format: "Closed: gate locked, sign says closed ;; Duplicate: same as xyz".'],
  ['owners', 'Owners Panel Notes', 'Optional evidence shown under Owners.'],
  ['audit', 'Audit Trail Notes', 'Optional evidence shown in AuditTrail.'],
  ['tip', 'Coaching Note', 'Required. Shown to the agent after they answer.'],
  ['source', 'Reference Link (trainers only)', 'Optional. Where you verified the answers (never shown to agents).']
];
const DEC_ALIASES = { escalate: 't1', 'escalate to tier 1': 't1', 'escalate to tier 2': 't1', approve: 'approve', 'approve - create new': 'approve', create: 'approve', alias: 'alias', 'add alias': 'alias', duplicate: 'alias', reject: 'reject', close: 'reject', 'tier 1': 't1', t1: 't1', tier1: 't1', 'tier 2': 't1', t2: 't1', tier2: 't1', defer: 'defer', 'in progress': 'defer' };
const isCountryName = t => { const n = norm(t); return !!n && (APP_CONFIG.DEFAULT_COUNTRIES.some(c => norm(c) === n) || ['usa', 'uk', 'uae', 'japan', 'singapore', 'india'].includes(n)); };
const reasonFromText = t => {
  const s = String(t || '').trim().toLowerCase(); if (!s) return '';
  if (REASONS[s]) return s;
  if (typeof LEGACY_REASONS !== 'undefined' && LEGACY_REASONS[s]) return LEGACY_REASONS[s];
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
  const dec = DEC_ALIASES[g('ans.decision').toLowerCase()]; if (!dec) err.push('Correct Action must be Approve, Alias, Reject, Escalate or Defer');
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
  const types = [].concat(multi(g('ans.type')) || []); types.forEach(t => { if (t && t !== 'N/A' && !ACCOM_TYPES.includes(LEGACY_TYPES[t] || t)) err.push('Unknown accommodation type "' + t + '" (see the Lists sheet)'); });
  const brands = [].concat(multi(g('ans.brand')) || []); brands.forEach(b => { if (b && !BRANDS.includes(b)) err.push('Unknown brand "' + b + '" (add it to BRANDS in data.js or use BLANK)'); });
  ['ans.rooms', 'ans.floors'].forEach(k => { const v = numOrU(g(k)); if (typeof v === 'number' && isNaN(v)) err.push(k.split('.')[1] + ' must be a number'); });
  if (g('ans.opening') && !/^\d{4}-\d{2}-\d{2}$/.test(g('ans.opening'))) err.push('Opening date must be YYYY-MM-DD');
  // parent(s): reuse an existing geo when the label matches, else create one. Alternatives separated by " | ".
  const geos = [], parents = [];
  // Parent formats: "303881 - India, Kerala, Idukki District, Munnar" · "303881" (already in the simulator) ·
  // "India, Kerala, Idukki District, Munnar" · old style "Munnar, Idukki District, Kerala, India"
  const geoFor = lbl => {
    lbl = String(lbl).trim();
    const m = lbl.match(/^g?(\d{3,})\s*(?:[-–—:·]\s*)?(.*)$/);
    if (m) {
      const ex = GEOS.find(x => String(x.ta) === m[1]); if (ex) return ex.id;
      if (!m[2].trim()) { err.push('Geo code ' + m[1] + ' is not in the simulator — add its nav string, e.g. "' + m[1] + ' - India, Kerala, Idukki District, Munnar"'); return ''; }
      const geo = navGeo(m[1], m[2]); if (!geos.some(x => x.id === geo.id)) geos.push(geo); return geo.id;
    }
    const parts = lbl.split(',').map(x => x.trim()).filter(Boolean);
    const countryFirst = parts.length === 1 || isCountryName(parts[0]);
    const nav = (countryFirst ? parts : parts.slice().reverse()).join(', ');
    const ex = GEOS.find(x => norm(x.nav || '') === norm(nav)) || GEOS.find(x => norm(x.name + ', ' + x.path) === norm(lbl)) || (parts.length === 1 && GEOS.find(x => norm(x.name) === norm(lbl)));
    if (ex) return ex.id;
    const geo = navGeo(null, nav, 'cg_' + slug(nav) + '_' + sha256(nav).slice(0, 4)); if (!geos.some(x => x.id === geo.id)) geos.push(geo); return geo.id;
  };
  plabel.split(/\s+\|\s+/).map(s => s.trim()).filter(Boolean).forEach(lbl => { const id = geoFor(lbl); if (id) parents.push(id); });
  const parent = parents.length > 1 ? parents : (parents[0] || '');
  const ans = { decision: dec, reason: reason.length > 1 ? reason : reason[0], parent, lat: alat, lng: alng };
  ['name', 'brand', 'street', 'street2', 'postal', 'phone', 'email', 'url', 'type'].forEach(k => { const v = multi(g('ans.' + k)); if (v !== undefined) ans[k] = v; });
  if (ans.type !== undefined) ans.type = Array.isArray(ans.type) ? ans.type.map(t => LEGACY_TYPES[t] || t) : (LEGACY_TYPES[ans.type] || ans.type);
  if (ans.type === 'N/A') ans.type = '';
  ['rooms', 'floors'].forEach(k => { const v = numOrU(g('ans.' + k)); if (v === '' || (typeof v === 'number' && !isNaN(v))) ans[k] = v; });
  if (g('ans.opening')) ans.opening = g('ans.opening');
  const ai = yn(g('ans.allIncl')); if (ai !== undefined) ans.allIncl = ai;
  if (g('ans.match')) ans.match = g('ans.match');
  // possible match: current values of the existing listing (Alias) / look-alike listing (not a match)
  const listingNow = {};
  if (g('listingNow')) g('listingNow').split(/\s*;;\s*/).filter(Boolean).forEach(pair => {
    const m = pair.match(/^\s*([a-z0-9]+)\s*=\s*(.*)$/i), k = m ? m[1].toLowerCase() : '';
    if (!m || !LISTING_FIELDS.includes(k)) return err.push('Current Values: write field=value using ' + LISTING_FIELDS.join(', '));
    let v = m[2].trim(); if (v.toUpperCase() === 'BLANK') v = '';
    if (k === 'type' && v && !ACCOM_TYPES.includes(v)) err.push('Current Values: unknown type "' + v + '"');
    listingNow[k] = v;
  });
  if (Object.keys(listingNow).length && dec && dec !== 'alias') err.push('Existing Listing – Current Values is only for Alias cases');
  let listing;
  if (g('decoy')) {
    if (dec === 'alias') err.push('Look-alike Listing is only for non-Alias cases (an Alias case shows its real listing)');
    else {
      const [nm, addr, plbl, ll, ty] = g('decoy').split(/\s*;;\s*/), mm = String(ll || '').match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
      if (!nm || !plbl || !mm) err.push('Look-alike Listing: use  Name ;; Address ;; Parent ;; lat, lng ;; Type');
      else listing = { id: 'd' + (7000000 + parseInt(sha256(id + nm).slice(0, 5), 16) % 2000000), name: nm, street: addr || '', parent: geoFor(plbl), type: ty && ACCOM_TYPES.includes(ty.trim()) ? ty.trim() : '', lat: +mm[1], lng: +mm[2] };
    }
  }
  const feed = { name: g('feed.name'), lat: flat, lng: flng };
  ['brand', 'street', 'street2', 'postal', 'parentText', 'rooms', 'desc'].forEach(k => { if (g('feed.' + k)) feed[k] = g('feed.' + k); });
  const amen = g('amen') ? g('amen').split(/\s*;;\s*/).map(s => s.trim()).filter(Boolean) : undefined;
  const votes = g('votes') ? g('votes').split(/\s*;;\s*/).filter(Boolean).map(v => { const m = v.match(/^([^:]{2,20}):\s*(.*)$/); return { type: m ? m[1] : 'Comment', comment: m ? m[2] : v, user: 'community_member', email: '—', owner: 'No', date: '' }; }) : [];
  const q = {
    id, day, q: qn, active: yn(g('active')) !== false, feed, ans, geos, parentLabel: plabel, providerUrl: g('providerUrl'), amen,
    geoTol: Number(g('geoTol')) > 0 ? Number(g('geoTol')) : undefined, req: 130000000 + (parseInt(sha256(id).slice(0, 6), 16) % 9000000),
    src: { votes, owners: g('owners') ? [{ name: 'Owner record', status: '', date: '', note: g('owners') }] : [], audit: g('audit') ? [{ date: '', who: 'Note', what: g('audit') }] : undefined },
    listingNow: Object.keys(listingNow).length ? listingNow : undefined, listing,
    tip: g('tip'), source: g('source'), updatedAt: nowIso()
  };
  return { q, errors: err };
}
/* case object → template row (for export / edit form) */
function questionToRow(c) {
  const A = c.ans, F = c.feed, join = v => v === '' ? 'BLANK' : v === undefined || v === null ? '' : Array.isArray(v) ? v.map(x => x === '' ? 'BLANK' : x).join(' | ') : String(v);
  const D = { approve: 'Approve', alias: 'Alias', reject: 'Reject', t1: 'Escalate', t2: 'Escalate', defer: 'Defer' };
  const r = {
    id: c.id, day: c.day, q: c.q, active: c.active === false ? 'N' : 'Y', providerUrl: c.providerUrl || '', amen: (c.amen || []).join(' ;; '),
    'ans.decision': D[A.decision], 'ans.reason': [].concat(A.reason || []).map(x => REASONS[x] ? REASONS[x].label : x).join(' | '), 'ans.match': A.match || '',
    parentLabel: [].concat(A.parent).every(id => GEO_BY_ID[id]) ? [].concat(A.parent).map(geoTplLabel).join(' | ') : (c.parentLabel || ''), 'ans.lat': A.lat, 'ans.lng': A.lng, geoTol: c.geoTol || '', tip: c.tip || '', source: c.source || '',
    'ans.opening': A.opening || '', 'ans.allIncl': A.allIncl === undefined ? '' : A.allIncl ? 'Y' : 'N',
    votes: ((c.src && c.src.votes) || []).map(v => v.type + ': ' + v.comment).join(' ;; '),
    owners: ((c.src && c.src.owners) || []).map(o => [o.name, o.status, o.note].filter(Boolean).join(' – ')).join(' ;; '),
    audit: ((c.src && c.src.audit) || []).map(a => a.what).join(' ;; '),
    listingNow: '', decoy: ''
  };
  ['name', 'brand', 'street', 'street2', 'postal', 'phone', 'email', 'url', 'rooms', 'floors'].forEach(k => r['ans.' + k] = join(A[k]));
  r['ans.type'] = A.type === '' ? 'N/A' : join(A.type);
  const L = listingFor(c);
  if (L && A.decision === 'alias') {
    if (!A.match) r['ans.match'] = L.id;
    r.listingNow = LISTING_FIELDS.filter(k => L[k] !== undefined && L[k] !== null && !(A[k] !== undefined && [].concat(A[k]).some(v => String(v) === String(L[k]))))
      .map(k => k + '=' + (L[k] === '' ? 'BLANK' : L[k])).join(' ;; ');
  } else if (L) r.decoy = [L.name, [L.street, L.postal].filter(Boolean).join(', '), geoTplLabel(L.parent), L.lat + ', ' + L.lng, L.type || ''].join(' ;; ');
  ['name', 'brand', 'street', 'street2', 'postal', 'parentText', 'rooms', 'lat', 'lng', 'desc'].forEach(k => r['feed.' + k] = F[k] == null ? '' : F[k]);
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
    daySel.innerHTML = '<option value="">— Select day —</option>' + days.map(d => `<option value="${d}"${String(d) === curDay ? ' selected' : ''}>Day ${d} - ${esc(dayMeta(d).title)}</option>`).join('');
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
  const rejectList = Object.values(REASONS).filter(r => r.d === 'reject').map(r => esc(r.label)).join(' · ');
  $('#guideWrap').innerHTML = `
  <div class="guide-hero">
    <h2>${m.icon} Day ${d} · ${esc(m.title)}</h2>
    <p>Welcome, <b>${esc(S.user.name)}</b>. You are a Places agent working in the <b>Location Tool (LMT)</b>. ${n} new listing requests from the provider feed are waiting. For each one, research the property yourself in <b>Google Chrome</b>, fix the data in LMT, then take the right action. ${esc(m.desc)}</p>
    <div class="mission-meta"><span>📋 ${n} cases</span><span>🎯 Pass mark ${APP_CONFIG.PASS_MARK}%</span><span>⏱ Target ${Math.round(APP_CONFIG.TARGET_SECONDS / 60)} min per case</span><span>⭐ ${prof.xp} XP · ${levelFor(prof.xp).name}</span>${S.user.sessionName ? `<span>🧑‍🏫 ${esc(S.user.sessionName)}</span>` : ''}</div>
  </div>

  <div class="gsec"><h3><span class="n">1</span>The LMT request page: scroll from top to bottom</h3>
    <div class="infobox" style="margin-top:0"><b>👁 First click on every request: Show All Fields</b> (left menu). Like the live LMT, each new request opens with <b>Phone, Fax and Email, Description, Internal and Geo Coding hidden</b>. Fraud clues often sit in the Description, so if you skip this step you will miss them.</div>
    <div class="steps5">
      <div class="s5"><i>👁</i><b>Show All Fields</b><p>Reveals Phone, Fax, Email, Description, Internal Comment and Geo Coding. Do it before anything else.</p></div>
      <div class="s5"><i>🔗</i><b>Possible match?</b><p>If LMT shows a <b>possible match</b>, compare it. Same property: click <b>＋ Add name as alias</b> and edit what the sources say is wrong. Different property: click <b>✔＋ Not match, create new</b>.</p></div>
      <div class="s5"><i>🪪</i><b>Basic Info</b><p>Name, Street One and Two, Postal Code and <b>Parent</b> (type the town, village or geo code in the Parent box, click 🔍 and pick the most specific geo).</p></div>
      <div class="s5"><i>📄</i><b>Provider Link</b><p>Click <b>Open Provider Page in New Tab</b>. Read the <b>amenities</b>. They tell you the accommodation type.</p></div>
      <div class="s5"><i>📖</i><b>Contact &amp; Accommodation</b><p>The feed sends <b>no phone, email, URL or type</b>. Find them online and type them in.</p></div>
      <div class="s5"><i>🏷️</i><b>Internal &amp; Geo</b><p>Write an <b>Internal Comment</b> when you come across any blocked URLs or any conflicting information. Fix the pin on the map or paste coordinates from Google Maps.</p></div>
    </div>
  </div>

  <div class="gsec"><h3><span class="n">2</span>How to research (in your own Chrome)</h3>
    <ul class="rules">
      <li><b>Helpful Links</b> (left menu) has the same five options as the live tool: <b>Google, Google Maps, Geonames, Tripadvisor and StreetFinder</b>.</li>
      <li>Use the <b>official URL</b> (official website, Facebook, Twitter or Instagram) that has the most comprehensive information about the listing.</li>
      <li><b>Accommodation Type</b> is never in the feed. Decide it from the amenities on the official website, provider page and OTAs. An accommodation listing must be assigned <b>ONE</b> Accommodation Type. It is impossible to save a listing if you do not select an Accommodation Type.</li>
      <li><b>Possible match or dupe:</b> when LMT shows an existing listing, the fields hold that listing's <b>current values</b>. If it is the same property (same address, phone and location), click <b>＋ Add name as alias</b> to apply the request to the current listing, then <b>edit any field your sources say is wrong</b>. If it is a different property, click <b>✔＋ Not match, create new</b>. No match shown? Still search Tripadvisor before creating.</li>
      <li>Get coordinates from Google Maps: right click the property pin, then click the numbers at the top to copy them.</li>
      <li>The <b>Requested Change</b> column is what the feed sent. Use <b>➜</b> to copy it across or <b>✖</b> to reject a wrong value. Feeds are often wrong!</li>
      <li><b>Hierarchy Order:</b> Official Website &gt; Provider Page (OTA) &gt; Social Media &gt; Google Listing.</li>
    </ul>
  </div>

  <div class="gsec"><h3><span class="n">3</span>Data entry style rules</h3>
    <ul class="rules">
      <li><b>Name:</b> Name should only be the property's official name as it appears on the official website. No geo added unless it is part of the official name or chain restaurant (restaurant business operates more than one location).</li>
      <li><b>Address:</b> expand abbreviations (St → Street, Rd → Road, HTL → Hotel). Building or floor in Street One, area or landmark in Street Two.</li>
      <li><b>Postal code:</b> only when a source confirms it. Leave blank if no source shows one.</li>
      <li><b>Phone:</b> this is the public or local phone number of the property. The phone number should not be a reservations line or a toll free 1800 number. Leave blank if no source shows one.</li>
      <li><b>URL:</b> the official URL (official website, Facebook, Twitter or Instagram) with the most comprehensive information about the listing. Never an OTA link. Leave blank if no source shows one.</li>
      <li><b>Email:</b> should be the official contact or owner email for the property. This is NOT the requester's email. Make sure it follows the standard email format: name@domain.com. Leave blank if no source shows one.</li>
      <li><b>Parent:</b> the most specific geo (village over district). Search by name or by geo code, for example 297586. Watch out for places with the same name in other states or countries.</li>
    </ul>
  </div>

  <div class="gsec"><h3><span class="n">4</span>Decision matrix: pick ONE action per case</h3>
    <table class="gtable">
      <tr><th style="width:170px">Action</th><th>When to use it</th><th style="width:300px">Reasons</th></tr>
      <tr><td>${dchip('approve')}</td><td>The property exists, is open, is an accommodation, is not on Tripadvisor yet, and the sources agree.</td><td>New property verified</td></tr>
      <tr><td>${dchip('reject')}</td><td>The red ⊗ button opens the reject menu. Pick the reason that fits.</td><td>${rejectList}</td></tr>
      <tr><td>${dchip('t1')}</td><td>You can escalate when:<ul class="esc-list"><li>You need help as you're unsure what action to take</li><li>You have a weird case or situation</li><li>Conflicting information (such as geo, address)</li></ul></td><td>Unsure what action to take · Weird case or situation · Conflicting information</td></tr>
    </table>
  </div>

  <div class="gsec"><h3><span class="n">5</span>Scoring</h3>
    <ul class="rules one-col">
      <li><b>${APP_CONFIG.PASS_MARK}%</b> is required to get the certificate.</li>
      <li>Every question you answer right gets <b>10 points</b>.</li>
    </ul>
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
  if (k === 'parent') {
    const g = GEO_BY_ID[f.parent], ok = !!g && exps.some(e => e === f.parent || geoMatch(g, GEO_BY_ID[e]));
    return ok ? res(1) : res(0, g ? 'Different place — check the town, district, state and country' : 'No parent selected');
  }
  if (k === 'allIncl') { const g = !!given; return exps.some(e => !!e === g) ? res(1) : res(0, g ? 'Not all-inclusive' : 'Property is all-inclusive'); }
  if (k === 'type' && given === 'N/A') given = '';
  given = given == null ? '' : String(given).trim();
  let best = res(0);
  for (const e0 of exps) {
    const e = e0 == null ? '' : String(e0).trim();
    let r;
    if (e === '') r = given === '' ? res(1) : (k === 'url' && SOCIAL_RX.test(normUrl(given) + '/') ? res(1, 'Official social page accepted') : res(0, 'Should be blank – no reliable source shows this'));
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
    else if (k === 'url') r = normUrl(given) === normUrl(e) ? res(1) : res(0);
    else if (k === 'postal') r = norm(given).replace(/ /g, '') === norm(e).replace(/ /g, '') ? res(1) : res(0);
    else if (k === 'rooms' || k === 'floors') r = parseInt(given, 10) === parseInt(e, 10) ? res(1) : res(0);
    else r = given === e ? res(1) : res(0);
    if (r.frac > best.frac) best = r; else if (best.frac === 0 && !best.note) best = r;
  }
  best.exp = expShow; return best;
}

/* v2.5 SCORING — every question is right (10 points) or wrong (0).
   Right = correct action AND every primary field correct: Property Name, Street One, Geo, URL
   (only the ones the answer key defines). Other fields are not evaluated.
   Reject / Escalate cases: the action decides. Alias: the request must be applied to the right listing. */
const PRIMARY_FIELDS = ['name', 'street', 'geo', 'url'];
const SOCIAL_RX = /(^|\.)(facebook|fb|instagram|twitter|x)\.com\//i;
function scoreCase(c, cs, dec) {
  const A = c.ans, f = cs.f;
  const expD = A.decision, decisionOk = dec.decision === expD;
  const reasons = [].concat(A.reason);
  const reasonOk = decisionOk && (['approve', 'alias'].includes(expD) || reasons.includes(dec.reason));
  const mode = expD === 'alias' ? 'match' : ['reject', 't1'].includes(expD) ? 'decision' : 'fields';
  const fields = [];
  for (const k of PRIMARY_FIELDS) {
    const d = FIELD_DEFS.find(x => x.k === k);
    const exp = k === 'geo' ? (A.lat === undefined || A.lat === null || A.lat === '' ? undefined : { lat: A.lat, lng: A.lng }) : A[k];
    if (exp === undefined || exp === null) continue;
    const r = scoreField(k, exp, f, c.geoTol), ok = r.frac >= 1;
    const given = k === 'geo' ? (f.lat !== '' ? `${f.lat}, ${f.lng}` : '') : f[k];
    fields.push({ k, label: k === 'name' ? 'Property Name' : d.label, w: d.w, status: ok ? 'ok' : 'wrong', frac: ok ? 1 : 0, note: r.note, exp: r.exp, given: given == null || given === '' ? '(blank)' : String(given), dist: r.dist });
  }
  const fieldsOk = fields.filter(x => x.status === 'ok').length, fieldsN = fields.length;
  const fieldsPct = fieldsN ? fieldsOk / fieldsN : 1;
  let matchOk = false;
  if (dec.decision === 'alias') {
    const got = taId(dec.match), want = taId(A.match);
    matchOk = expD === 'alias' && (want ? got === want : !!got || !!dec.match);
  }
  const correct = decisionOk && (mode === 'decision' || fieldsOk === fieldsN) && (expD !== 'alias' || matchOk);
  let critical = false;
  if (!decisionOk) {
    if (dec.decision === 'approve' && ['reject', 't1', 'alias'].includes(expD)) critical = true;
    if (dec.decision === 'alias' && expD === 'approve') critical = true; // merged a different property into an existing listing
  }
  return { score: correct ? 100 : 0, points: correct ? 10 : 0, correct, decisionOk, reasonOk, matchOk, mode, fields, fieldsPct, fieldsOk, fieldsN, critical };
}

/* =====================================================================
   LMT PLACES SIMULATOR — GAME (LMT request page, decisions, feedback,
   results, sync). Agents research in their own Chrome tabs.
   ===================================================================== */
const S = { user: null, cases: [], idx: 0, cs: null, results: [], xp: 0, streak: 0, bestStreak: 0, attemptId: '', startedAt: '', timer: null, map: null, marker: null };

/* ---------------- in-tool (LMT internal) evidence ---------------- */
function SRC(c) {
  if (c._src) return c._src;
  const F = c.feed, o = c.src || {};
  const seed = (c.req || 1234567) % 97;
  const s = {};
  s.provider = Object.assign({
    name: F.name, address: [F.street, F.street2, F.postal].filter(Boolean).join(', ') + (F.parentText ? ' · ' + F.parentText : ''),
    amen: amenitiesFor(c), rooms: F.rooms || '—', rating: (3.6 + (seed % 14) / 10).toFixed(1),
    id: 'HP-' + (500000 + (c.req || 0) % 400000), desc: F.desc || ''
  }, o.provider || {});
  s.votes = o.votes || [];
  s.owners = o.owners || [];
  s.audit = o.audit || [{ date: '2026-10-0' + (1 + seed % 7) + ' 0' + (seed % 9) + ':1' + (seed % 6), who: 'Hopper feed', what: 'Request created – new property submitted by provider' }];
  c._src = s; return s;
}

/* Amenities on the provider page = the clues for Accommodation Type (the type itself is never shown) */
function amenitiesFor(c) {
  if (Array.isArray(c.amen) && c.amen.length) return c.amen;
  const A = c.ans || {}, P = typeof AMENITY_PROFILES !== 'undefined' ? AMENITY_PROFILES : {};
  if (['reject', 't1', 't2'].includes(A.decision) && A.reason !== 'closed') return (A.reason === 'not_accommodation' ? P.none : P.claimed) || [];
  return P[first(A.type)] || P.claimed || [];
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
/* ---------------- possible match (existing Tripadvisor listing) ----------------
   Like the live LMT: when the request has a possible match / dupe, the page opens on that existing
   listing — the input column shows its CURRENT values, the Requested Change column shows the feed.
   Same property → "Add name as alias" applies the request to the listing; the agent then edits any
   field the sources prove wrong. Different property → "Not match, create new" clears the form. */
const LISTING_FIELDS = ['name', 'brand', 'street', 'street2', 'postal', 'phone', 'email', 'url', 'type', 'rooms'];
function listingFor(c) {
  if (c._listing !== undefined) return c._listing;
  const A = c.ans || {};
  let L = null;
  if (c.listing) L = Object.assign({}, c.listing);
  else if (A.decision === 'alias') {           // trainer question: build the listing from the Correct … columns
    L = { id: taId(A.match) ? 'd' + taId(A.match) : 'd' + (300000 + (c.req || 0) % 600000) };
    LISTING_FIELDS.forEach(k => { const v = first(A[k]); if (v !== undefined && v !== null) L[k] = v; });
    L.parent = first(A.parent); L.lat = A.lat; L.lng = A.lng;
  }
  if (L) {
    Object.assign(L, c.listingNow || {});      // current (possibly outdated) values shown in LMT
    L.isMatch = A.decision === 'alias';
    const tid = taId(L.id); L.id = tid ? 'd' + tid : String(L.id || '');
    L.taUrl = L.taUrl || (L.isMatch && tid ? (/^https?:/i.test(A.match || '') ? A.match : 'https://www.tripadvisor.com/Hotel_Review-d' + tid) : 'https://www.tripadvisor.com/Search?q=' + encodeURIComponent(L.name || ''));
  }
  c._listing = L; return L;
}
function blankFields(c) {
  return { name: '', brand: '', former: '', street: '', street2: '', postal: '', parent: '', phone: '', fax: '', email: '', url: '', desc: '', thumb: '', opening: '', floors: '', rooms: '', type: '', allIncl: false, lat: String(c.feed.lat), lng: String(c.feed.lng),
    provAttr: '', provExp: '', internal: '' };
}
function listingFields(c, L) {
  const f = blankFields(c);
  LISTING_FIELDS.forEach(k => { if (L[k] !== undefined && L[k] !== null) f[k] = String(L[k]); });
  if (L.parent) f.parent = L.parent;
  if (L.lat !== undefined && L.lng !== undefined) { f.lat = String(L.lat); f.lng = String(L.lng); }
  return f;
}
function newCaseState(c) {
  const L = listingFor(c);
  return {
    applied: {}, rej: {}, locks: {}, attr: {}, start: Date.now(), notes: '', pre: '', providerSeen: false, emails: 0,
    showAll: false, showAllUsed: false, showAllSec: null,
    link: L ? 'pending' : 'new',               // pending = possible match shown, not decided yet · alias · new
    f: L ? listingFields(c, L) : blankFields(c),
    // New listing: the provider's name is kept as a non-searchable alias. Existing listing: its own aliases.
    aliases: L ? (L.aliases || []).map(a => ({ name: a, searchable: true })) : (c.feed.name ? [{ name: c.feed.name, searchable: false }] : []),
    aliasDraft: '', aliasDraftS: false
  };
}
function linkAsAlias() {
  const c = curCase(), cs = S.cs, L = listingFor(c);
  cs.pre = 'alias';
  if (!L) { updateEndInfo(); return toast('No possible match on this request. If Tripadvisor already has it, use Take Action → Add Name as Alias and paste the listing link.', 4200); }
  const keepNotes = cs.f.internal;
  if (cs.link === 'new') { const f = listingFields(c, L); f.internal = keepNotes; cs.f = f; cs.aliases = (L.aliases || []).map(a => ({ name: a, searchable: true })); }
  cs.link = 'alias'; cs.parentQ = null;
  if (c.feed.name && !cs.aliases.some(a => norm(a.name) === norm(c.feed.name))) cs.aliases.push({ name: c.feed.name, searchable: false });
  cs.applied = {}; rerenderKeepScroll();
  toast('＋ Request applied to the existing listing ' + L.id + ' — feed name added as alias. Edit any field your sources say is wrong, then ✔ Take Action.', 4200);
}
function linkAsNew() {
  const c = curCase(), cs = S.cs, L = listingFor(c);
  cs.pre = 'approve';
  if (L && cs.link !== 'new') { const keep = cs.f.internal; cs.f = blankFields(c); cs.f.internal = keep; cs.aliases = c.feed.name ? [{ name: c.feed.name, searchable: false }] : []; cs.applied = {}; }
  cs.link = 'new'; cs.parentQ = null; rerenderKeepScroll();
  toast(L ? '✔＋ Not a match — the form is cleared for a NEW listing. Research every field from sources.' : 'Marked: no match exists on Tripadvisor → create new. Make sure you searched tripadvisor.com first!', 3800);
}
function matchBox() {
  const c = curCase(), cs = S.cs, L = listingFor(c); if (!L) return '';
  const d = haversine(+c.feed.lat, +c.feed.lng, +L.lat, +L.lng), ds = isNaN(d) ? '—' : d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(d < 10000 ? 1 : 0) + ' km';
  const st = { pending: ['pm-pending', 'The fields below show this listing\'s <b>current values</b>. <b>Same property?</b> → <b>＋ Add name as alias</b>, then edit anything your sources say is wrong. <b>Different property?</b> → <b>✔＋ Not match, create new</b>.'],
    alias: ['pm-alias', '✔ <b>Request applied to this listing.</b> The feed name was added as an alias. Edit any field your sources say is wrong, then ✔ Take Action.'],
    new: ['pm-new', '✖ <b>Marked as not a match</b> — you are creating a new listing. (Changed your mind? Click ＋ Add name as alias.)'] }[cs.link];
  return `<div class="pm-box ${st[0]}"><div class="pm-h">${ICO.link} Possible match on Tripadvisor</div>
    <table class="pm-tbl"><thead><tr><th>Location ID</th><th>Name</th><th>Address</th><th>Parent</th><th>Type</th><th>Lat / Long</th><th>Distance from request pin</th><th></th></tr></thead>
    <tbody><tr><td><code>${esc(L.id)}</code></td><td><b>${esc(L.name || '')}</b></td><td>${esc([L.street, L.street2, L.postal].filter(Boolean).join(', '))}</td><td>${esc(geoTplLabel(L.parent))}</td><td>${esc(L.type || '—')}</td><td style="white-space:nowrap">${esc(L.lat)}, ${esc(L.lng)}</td><td>${ds}</td>
    <td><a href="${esc(L.taUrl)}" target="_blank" rel="noopener">View on Tripadvisor ↗</a></td></tr></tbody></table>
    <div class="pm-note">${st[1]}</div></div>`;
}
function curCase() { return S.cases[S.idx]; }
function loadCase() {
  S.cs = newCaseState(curCase());
  renderHud(); renderLeft(); renderPage(); applyFieldVisibility(); window.scrollTo(0, 0);
}

/* ---------------- Show All Fields / Hide Fields ----------------
   Every new request opens with HIDDEN_SECTIONS collapsed (like the live LMT).
   The agent must click "Show All Fields" to see Contact, Description, Internal and Geo. */
function applyFieldVisibility() {
  const on = !!(S.cs && S.cs.showAll);
  $('#casePane').classList.toggle('fields-hidden', !on);
  const b = $('#btnHideFields');
  if (b) { b.innerHTML = on ? '<span class="eye">👁</span> Hide Fields' : '<span class="eye">👁</span> Show All Fields'; b.classList.toggle('on', on); b.title = on ? 'Hide fields again' : 'Show Phone, Fax, Email, Description and Internal'; }
  $$('#navList [data-jump]').forEach(d => { const k = (d.dataset.jump || '').replace('sec-', ''); d.classList.toggle('hid', !on && !!HIDDEN_SECTIONS[k]); });
  if (on) setTimeout(() => { if (S.map) { S.map.invalidateSize(); if (S.marker) S.map.setView(S.marker.getLatLng(), S.map.getZoom()); } else initMap(); }, 40);
  updateEndInfo();
}
function toggleFields() {
  const cs = S.cs; if (!cs) return;
  cs.showAll = !cs.showAll;
  if (cs.showAll && !cs.showAllUsed) { cs.showAllUsed = true; cs.showAllSec = Math.round((Date.now() - cs.start) / 1000); }
  applyFieldVisibility();
}
const isHiddenSec = k => !!HIDDEN_SECTIONS[k] && !(S.cs && S.cs.showAll);

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
const NAV_ITEMS = [['Basic Info', 'sec-basic'], ['Contact Details', 'sec-contact'], ['Description', 'sec-desc'], ['Photos', 'sec-photos'], ['Accommodation Info', 'sec-accom'], ['Pricing', ''], ['Commerce Links', 'sec-commerce'], ['Amenities', ''], ['Internal', 'sec-internal'], ['Location Votes', 'sec-votes'], ['DaoDao Info', ''], ['Geo Coding', 'sec-geo']];
function renderLeft() {
  const c = curCase();
  $('#lReq').textContent = c.req; $('#lFeed').textContent = 'Hopper';
  $('#navList').innerHTML = NAV_ITEMS.map(([t, id]) => `<div data-jump="${id}" class="${id ? '' : 'dim'}">${t}</div>`).join('');
}
function updateEndInfo() {
  const cs = S.cs, el = $('#endInfo'); if (!el) return;
  const done = Object.keys(REQ_SECTIONS).filter(k => cs.applied[k]);
  el.innerHTML = `Applied (optional): ${Object.entries(REQ_SECTIONS).map(([k, l]) => (cs.applied[k] ? '✔ ' : '○ ') + l).join(' · ')}${cs.pre ? ` · Pre-selected: <b>${DECISIONS[cs.pre].short}</b>` : ''}${cs.showAll ? '' : ' · <span style="color:#9a6a00">some fields are hidden</span>'}`;
}

/* ---------------- page rendering (all sections, one scrolling page) ---------------- */
/* Monochrome LMT-style icons (inline SVG, no external font needed) */
const ICO = {
  basic: '<svg viewBox="0 0 20 20"><rect x="1.5" y="4" width="17" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6.5" cy="9" r="1.9" fill="currentColor"/><path d="M3.8 13.4c.5-1.6 1.6-2.3 2.7-2.3s2.2.7 2.7 2.3z" fill="currentColor"/><path d="M11 8h5M11 11h5" stroke="currentColor" stroke-width="1.6"/></svg>',
  link: '<svg viewBox="0 0 20 20"><path d="M8.5 11.5l3-3M7 9.5l-2 2a2.5 2.5 0 003.5 3.5l2-2M13 10.5l2-2A2.5 2.5 0 0011.5 5l-2 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  book: '<svg viewBox="0 0 20 20"><path d="M10 5.2C8.2 3.8 5.2 3.6 2 4.4v11.2c3.2-.8 6.2-.6 8 .8 1.8-1.4 4.8-1.6 8-.8V4.4c-3.2-.8-6.2-.6-8 .8zM10 5.2v11.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  comment: '<svg viewBox="0 0 20 20"><path d="M10 3.5c4.4 0 8 2.6 8 5.8s-3.6 5.8-8 5.8c-.9 0-1.8-.1-2.6-.3L3 16.6l1.3-3.1C2.9 12.4 2 10.9 2 9.3 2 6.1 5.6 3.5 10 3.5z" fill="currentColor"/></svg>',
  photo: '<svg viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="8.2" r="1.5" fill="currentColor"/><path d="M3.5 14.5l4-4 2.5 2.5 3-3.5 3.5 5z" fill="currentColor"/></svg>',
  bed: '<svg viewBox="0 0 20 20"><path d="M2 5v11M2 12.5h16V16M18 12.5V10a2 2 0 00-2-2H9v4.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="5.5" cy="9.5" r="1.8" fill="currentColor"/></svg>',
  cart: '<svg viewBox="0 0 20 20"><path d="M1.5 3h2.6l2 9.5h9.6l1.8-6.5H5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="7.5" cy="15.8" r="1.4" fill="currentColor"/><circle cx="14.5" cy="15.8" r="1.4" fill="currentColor"/></svg>',
  award: '<svg viewBox="0 0 20 20"><path d="M10 1.8l1.6 1.2 2-.1.6 1.9 1.6 1.2-.6 1.9.6 1.9-1.6 1.2-.6 1.9-2-.1L10 13l-1.6-1.2-2 .1-.6-1.9-1.6-1.2.6-1.9-.6-1.9 1.6-1.2.6-1.9 2 .1z" fill="currentColor"/><path d="M6.6 12.4L5 18.2l2.6-1 1.7 2 .9-4.6M13.4 12.4l1.6 5.8-2.6-1-1.7 2-.9-4.6" fill="currentColor"/></svg>',
  thumb: '<svg viewBox="0 0 20 20"><path d="M2 9h3v8H2zM7 17h7.6a2 2 0 002-1.6l1.1-5.5A1.6 1.6 0 0016.1 8H12l.6-3.3A1.6 1.6 0 0011 3l-4 6z" fill="currentColor"/></svg>',
  pin: '<svg viewBox="0 0 20 20"><path d="M10 1.8a6 6 0 00-6 6c0 4.5 6 10.4 6 10.4s6-5.9 6-10.4a6 6 0 00-6-6zm0 8.4a2.4 2.4 0 110-4.8 2.4 2.4 0 010 4.8z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 20 20"><rect x="2.5" y="2.5" width="15" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 10.2l2.7 2.7L14.3 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 20 20"><path d="M6.5 9V6.6a3.5 3.5 0 017 0V9" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="9" width="12" height="9" rx="1.5" fill="currentColor"/></svg>',
  trash: '<svg viewBox="0 0 20 20"><path d="M7.5 3h5l.7 1.5H17v2H3v-2h3.8zM4.5 7.5h11l-.9 10a1.2 1.2 0 01-1.2 1H6.6a1.2 1.2 0 01-1.2-1z" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 20 20"><path d="M10 3.5v13M3.5 10h13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  cal: '<svg viewBox="0 0 20 20"><rect x="2.5" y="4" width="15" height="13.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 10.5h2v2h-2zM9 10.5h2v2H9zM12.5 10.5h2v2h-2zM5.5 13.8h2v2h-2zM9 13.8h2v2H9z" fill="currentColor"/></svg>'
};
function attrSel(key) {
  const v = S.cs.attr[key] || '';
  return `<select data-attr="${key}">${ATTRIBUTIONS.map(a => `<option${a === v ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select>`;
}
function lockBtn(key) { return `<button class="lockbtn ${S.cs.locks[key] ? 'on' : ''}" data-lock="${key}" title="Lock field">${ICO.lock}</button>`; }
function row(o) {
  const cs = S.cs, key = o.key;
  const fv = o.feed === undefined || o.feed === null ? '' : String(o.feed);
  const hasFeed = fv !== '';
  return `<div class="lrow${HIDDEN_ROWS.includes(key) ? ' hideable-row' : ''}" data-row="${key}">
    <div class="lbl ${o.reqd ? 'reqd' : ''}">${o.label}:</div>
    <div class="rq ${cs.rej[key] ? 'rej' : ''} ${o.redFeed ? 'red' : ''}">${esc(fv)}</div>
    <div class="act">${hasFeed && o.act !== false ? `<button class="ibtn" data-rej="${key}" title="Reject requested change">✖</button><button class="ibtn" data-copy="${key}" title="Accept requested change">➜</button>` : ''}</div>
    <div class="inp">${o.input}<div class="msg" data-msg="${key}">${o.msg || ''}</div></div>
    <div class="lock">${o.lock === false ? '' : lockBtn(key)}</div>
    <div class="attr">${o.attr === false ? '' : attrSel(key)}</div>
  </div>`;
}
const txt = (k, cls, ph) => `<input type="text" data-f="${k}" class="${cls || ''}" value="${esc(S.cs.f[k])}" placeholder="${ph || ''}">`;
function applyBtn(sec) { const a = S.cs.applied[sec]; return `<button class="btn-apply ${a ? 'applied' : ''}" data-apply="${sec}">${a ? '✔ Applied' : ICO.check + ' Apply'}</button>`; }
function secHead(ico, title, extra) { return `<div class="sec-h"><h4><span class="ico">${ico}</span>${title}</h4>${extra || ''}</div><button class="sec-min" title="Collapse">-</button>`; }
function aliasRows() {
  const cs = S.cs;
  return `<table class="alias-tbl"><thead><tr><th>Alias</th><th>Searchable</th><th></th></tr></thead><tbody>
    ${cs.aliases.map((a, i) => `<tr><td><input type="text" data-alias="${i}" value="${esc(a.name)}"></td><td><input type="checkbox" data-aliass="${i}" ${a.searchable ? 'checked' : ''}></td><td><button class="al-del" data-aldel="${i}" title="Remove alias">${ICO.trash}</button></td></tr>`).join('')}
    <tr class="al-new"><td><input type="text" id="alNew" placeholder="Add a new alias" value="${esc(cs.aliasDraft)}"></td><td><input type="checkbox" id="alNewS" ${cs.aliasDraftS ? 'checked' : ''}></td><td><button class="al-add" data-aladd="1" title="Add alias">${ICO.plus}</button></td></tr>
  </tbody></table>`;
}

function renderPage() {
  const c = curCase(), cs = S.cs, F = c.feed, src = SRC(c);
  if (S.map) { try { S.map.remove(); } catch (e) { } S.map = null; S.marker = null; }
  const pLabel = cs.f.parent ? geoTplLabel(cs.f.parent) : (cs.parentQ != null ? cs.parentQ : (F.parentText || ''));
  const thumbs = ['linear-gradient(135deg,#3a7bd5,#00d2ff)', 'linear-gradient(135deg,#f7971e,#ffd200)', 'linear-gradient(135deg,#11998e,#38ef7d)', 'linear-gradient(135deg,#8e2de2,#4a00e0)'];
  const tl = ['Exterior', 'Lobby', 'Room', 'Pool / view'];
  const provOpts = (typeof PROVIDER_ATTRIBUTIONS !== 'undefined' ? PROVIDER_ATTRIBUTIONS : ['Hopper']);
  $('#casePane').innerHTML = `
  <div class="sec" id="sec-basic">${secHead(ICO.basic, 'Basic Info', applyBtn('basic') + `<button class="btn-alias ${cs.link === 'alias' ? 'on' : ''}" data-pre="alias">＋ Add name as alias</button><button class="btn-createnew ${cs.link === 'new' && listingFor(c) ? 'on' : ''}" data-pre="approve">✔＋ Not match, create new</button>`)}
    ${matchBox()}
    ${row({ key: 'name', label: 'Name', feed: F.name, reqd: true, redFeed: true, input: txt('name', cs.f.name ? '' : 'invalid'), msg: cs.f.name ? '' : 'Please provide a name' })}
    ${row({ key: 'brand', label: 'Brand', feed: F.brand, lock: false, input: `<select data-f="brand"><option value="">Select Brand …</option>${BRANDS.map(b => `<option${b === cs.f.brand ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>` })}
    ${row({ key: 'former', label: 'Former Name', lock: false, input: txt('former') })}
    ${row({ key: 'street', label: 'Street One', feed: F.street, input: txt('street') })}
    ${row({ key: 'street2', label: 'Street Two', feed: F.street2, input: txt('street2') })}
    ${row({ key: 'postal', label: 'Postal Code', feed: F.postal, input: txt('postal', 'w-sm') })}
    ${row({ key: 'parent', label: 'Parent', reqd: true, act: false, input: `<div class="parent-box"><div class="pb-wrap"><input type="text" id="parentShow" class="${cs.f.parent ? 'ok' : ''}" value="${esc(pLabel)}" placeholder="Type a place or geo code" autocomplete="off" spellcheck="false"><div id="parentDrop" class="parent-drop hidden"></div></div><button class="ibtn pb-search" data-parent="1" title="Search">🔍</button></div>`, msg: cs.f.parent ? '' : 'Please search for and select a parent' })}
    ${row({ key: 'linked', label: 'Linked Locations', lock: false, act: false, input: `<div style="display:flex;gap:6px;flex-wrap:wrap"><select data-inert="1"><option>Select a relationship</option><option>Part of</option><option>Near</option></select><input type="text" data-inert="1" placeholder="Search for a location by name" style="max-width:200px"><button class="ibtn" style="background:#b39ddb;color:#fff;width:28px" data-inert="1">+</button></div>` })}
    ${row({ key: 'vgeo', label: 'Virtual Geos', lock: false, act: false, attr: false, input: `<div style="font-size:11.5px;color:#888">Virtual Geo · Link Information — none</div>` })}
  </div>

  <div class="sec" id="sec-provider">${secHead(ICO.link, 'Provider Link')}
    <div class="lrow"><div class="lbl">Provider Link:</div><div style="grid-column:2 / span 4">Provider: <b>Hopper</b> <button class="btn-prov" data-openprov="1">Open Provider Page in New Tab</button>
      <span class="prov-status" id="provStatus" style="color:#17663e">${cs.providerSeen ? '✔ Provider page opened' : ''}</span>
      <div class="prov-frame" style="margin-top:6px"><div class="sad">📄</div><div style="font-size:12px">hopper.com refused to connect.</div></div></div><div class="attr">${attrSel('provider')}</div></div>
  </div>

  <div class="sec" id="sec-contact">${secHead(ICO.book, 'Contact Details', applyBtn('contact'))}
    ${row({ key: 'phone', label: 'Phone', input: txt('phone', 'w-md') })}
    ${row({ key: 'fax', label: 'Fax', input: txt('fax', 'w-md') })}
    ${row({ key: 'email', label: 'Email', input: txt('email', 'w-md') })}
    ${row({ key: 'url', label: 'URL', input: txt('url') })}
  </div>
  <div class="sec hideable" id="sec-desc">${secHead(ICO.comment, 'Description', applyBtn('desc'))}
    ${row({ key: 'desc', label: 'Description', feed: F.desc, input: `<textarea data-f="desc">${esc(cs.f.desc)}</textarea>` })}
  </div>
  <div class="sec" id="sec-photos">${secHead(ICO.photo, 'Photos', applyBtn('photos'))}
    ${row({ key: 'thumb', label: 'Primary Thumbnail', lock: false, act: false, input: `<div style="font-style:italic;font-size:12px;margin-bottom:6px" id="thumbTxt">${cs.f.thumb ? 'Selected: ' + esc(cs.f.thumb) : 'Property Needs Thumbnail'}</div><div class="thumbs">${thumbs.map((g, i) => `<div class="thumb ${cs.f.thumb === tl[i] ? 'sel' : ''}" style="background:${g}" data-thumb="${tl[i]}">${tl[i]}</div>`).join('')}</div>` })}
  </div>

  <div class="sec" id="sec-accom">${secHead(ICO.bed, 'Accommodation Info', applyBtn('accom'))}
    ${row({ key: 'opening', label: 'Opening Date', lock: false, input: `<input type="date" data-f="opening" class="w-sm" value="${esc(cs.f.opening)}">` })}
    ${row({ key: 'floors', label: 'Floors', lock: false, input: `<input type="number" min="0" data-f="floors" class="w-xs" value="${esc(cs.f.floors)}">` })}
    ${row({ key: 'rooms', label: 'Rooms', feed: F.rooms, input: `<input type="number" min="0" data-f="rooms" class="w-xs" value="${esc(cs.f.rooms)}">` })}
    ${row({ key: 'type', label: 'Accommodation Type', reqd: true, input: `<select data-f="type" class="${cs.f.type ? '' : 'invalid'}"><option value="">Select Type …</option>${ACCOM_TYPES.map(t => `<option${t === cs.f.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`, msg: cs.f.type ? '' : 'Please select an accommodation type' })}
    ${row({ key: 'allIncl', label: 'AllInclusive', lock: false, input: `<input type="checkbox" data-f="allIncl" ${cs.f.allIncl ? 'checked' : ''}>` })}
    ${row({ key: 'star', label: 'Star Rating', lock: false, act: false, input: `<div class="star-tbl"><span>Priority</span><span>Source</span><span>Rating</span></div><div style="font-size:11.5px;color:#999;padding:4px 10px">No star ratings on record</div>` })}
  </div>
  <div class="sec" id="sec-commerce">${secHead(ICO.cart, 'Commerce Links')}
    <table class="votes-tbl"><thead><tr><th>Provider</th><th>Provider ID</th><th>Status</th></tr></thead><tbody><tr><td>Hopper</td><td>${esc(src.provider.id)}</td><td>Pending match</td></tr></tbody></table>
  </div>

  <div class="sec hideable" id="sec-internal">${secHead(ICO.award, 'Internal', applyBtn('internal'))}
    ${row({ key: 'provAttr', label: 'Provider Attribution', lock: false, act: false, input: `<div class="pa-box"><span class="sel-wrap"><select data-f="provAttr"><option value="">Select one</option>${provOpts.map(p => `<option${p === cs.f.provAttr ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select></span><span class="date-wrap"><input type="${cs.f.provExp ? 'date' : 'text'}" data-f="provExp" id="provExp" placeholder="Expiration Date" value="${esc(cs.f.provExp)}"><button class="cal-btn" data-cal="1" title="Pick a date">${ICO.cal}</button></span></div>` })}
    ${row({ key: 'internal', label: 'Internal Comment', lock: false, act: false, input: `<textarea data-f="internal">${esc(cs.f.internal)}</textarea>` })}
    ${row({ key: 'aliases', label: 'Aliases', lock: false, act: false, input: aliasRows() })}
  </div>

  <div class="sec" id="sec-votes">${secHead(ICO.thumb, 'Location Votes')}
    <input class="votes-search" id="votesSearch" placeholder="Search">
    <table class="votes-tbl" id="votesTbl"><thead><tr><th>Type</th><th>Comment</th><th>Username</th><th>Email</th><th>Owner?</th><th>Date/Time ↑</th></tr></thead>
    <tbody>${src.votes.length ? src.votes.map(v => `<tr><td>${esc(v.type)}</td><td>${esc(v.comment)}</td><td>${esc(v.user)}</td><td>${esc(v.email)}</td><td>${esc(v.owner)}</td><td>${esc(v.date)}</td></tr>`).join('') : '<tr><td colspan="6" style="color:#999">No location votes</td></tr>'}</tbody></table>
  </div>

  <div class="sec" id="sec-geo">${secHead(ICO.pin, 'Geo Coding', applyBtn('geo'))}
    <div style="padding:0 6px">
      <div class="geo-inputs">Latitude <input id="geoLat" data-f="lat" value="${esc(cs.f.lat)}"> Longitude <input id="geoLng" data-f="lng" value="${esc(cs.f.lng)}">
        <button class="btn-apply" id="geoGo">📍 Move pin</button><button class="btn-apply" id="geoPaste">⇩ Paste "lat, lng"</button><button class="btn-apply" id="geoReset">↺ Reset to feed</button>
        <span style="font-size:11.5px;color:#777">Tip: click the map, drag the marker, or paste coordinates copied from Google Maps.</span></div>
      <div id="map"></div>
    </div>
  </div>`;
  updateEndInfo();
  setTimeout(() => { if (!isHiddenSec('geo')) initMap(); }, 30);
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
    el.innerHTML = `<div class="map-fallback">🗺️<b>The map could not load on this network.</b>Paste the coordinates from Google Maps into the Latitude / Longitude boxes above. Scoring still works.</div>`;
    return;
  }
  S.map = L.map(el, { worldCopyJump: true, scrollWheelZoom: false, maxZoom: 20 }).setView(ok ? [lat, lng] : [20, 0], ok ? 15 : 2);
  addMapTiles(S.map, el);
  const icon = L.divIcon({ className: '', html: '<div class="pin-icon"></div>', iconSize: [26, 26], iconAnchor: [13, 30] });
  S.marker = L.marker(ok ? [lat, lng] : [20, 0], { draggable: true, icon }).addTo(S.map);
  const set = (la, ln) => { cs.f.lat = la.toFixed(6); cs.f.lng = ln.toFixed(6); $('#geoLat').value = cs.f.lat; $('#geoLng').value = cs.f.lng; cs.applied.geo = false; refreshApplyBtn('geo'); };
  S.marker.on('dragend', e => { const p = e.target.getLatLng(); set(p.lat, p.lng); });
  S.map.on('click', e => { S.marker.setLatLng(e.latlng); set(e.latlng.lat, e.latlng.lng); });
  setTimeout(() => S.map && S.map.invalidateSize(), 150);
}
/* Street map with automatic fallback + Map / Satellite switch.
   A tile server counts as blocked when 3 tiles fail before any loads; the next server in
   APP_CONFIG.MAP_TILES is then used, and remembered for the rest of the session. */
let TILE_IDX = 0;
function addMapTiles(map, el) {
  const list = (APP_CONFIG.MAP_TILES || []).filter(t => t && t.url);
  const sat = APP_CONFIG.MAP_SATELLITE;
  const ctl = L.control.layers(null, null, { position: 'topright', collapsed: false });
  let satGroup = null;
  const note = msg => { let n = el.querySelector('.map-note'); if (!n) { n = document.createElement('div'); n.className = 'map-note'; el.appendChild(n); } n.innerHTML = msg; };
  const street = idx => {
    const t = list[idx];
    const layer = L.tileLayer(t.url, { subdomains: t.subdomains || 'abc', maxZoom: 20, maxNativeZoom: t.maxNativeZoom || 18, attribution: t.attribution || '' });
    let loads = 0, errs = 0, tm = null;
    const dead = () => {
      if (loads || layer._lmtDead || S.map !== map) return;
      clearTimeout(tm); layer._lmtDead = true;
      const wasOn = map.hasLayer(layer);
      ctl.removeLayer(layer); if (wasOn) map.removeLayer(layer);
      if (idx + 1 < list.length) {
        const nx = street(idx + 1); ctl.addBaseLayer(nx, 'Map');
        if (satGroup) { ctl.removeLayer(satGroup); ctl.addBaseLayer(satGroup, 'Satellite'); } // keep "Map · Satellite" order
        if (wasOn) nx.addTo(map); TILE_IDX = idx + 1;
      }
      else note('🗺️ <b>Map tiles are blocked on this network.</b> The pin still works: paste the coordinates from Google Maps into the Latitude / Longitude boxes.');
    };
    layer.on('tileload', () => { loads++; clearTimeout(tm); TILE_IDX = idx; const n = el.querySelector('.map-note'); if (n) n.remove(); });
    layer.on('tileerror', () => { errs++; if (!loads && errs >= 3) dead(); });
    // A firewall that silently drops the connection never fires an error, so also give up on a
    // server when not a single tile has arrived 8 seconds after it started loading.
    layer.once('loading', () => { tm = setTimeout(() => { if (!loads && map.hasLayer(layer)) dead(); }, 8000); });
    map.on('unload', () => clearTimeout(tm));
    return layer;
  };
  if (list.length) { const s = street(Math.min(TILE_IDX, list.length - 1)); s.addTo(map); ctl.addBaseLayer(s, 'Map'); }
  if (sat && sat.url) {
    const parts = [L.tileLayer(sat.url, { maxZoom: 20, maxNativeZoom: sat.maxNativeZoom || 18, attribution: sat.attribution || '' })];
    if (sat.labels) parts.push(L.tileLayer(sat.labels, { maxZoom: 20, maxNativeZoom: sat.maxNativeZoom || 18 }));
    const g = satGroup = L.layerGroup(parts);
    ctl.addBaseLayer(g, 'Satellite');
    if (!list.length) g.addTo(map);
  }
  ctl.addTo(map);
}
function moveMarker() {
  const cs = S.cs, la = parseFloat(cs.f.lat), ln = parseFloat(cs.f.lng);
  if (isNaN(la) || isNaN(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return toast('⚠ Enter a valid latitude (−90…90) and longitude (−180…180)');
  if ($('#geoNow')) $('#geoNow').textContent = la + ', ' + ln;
  if (S.map) { S.marker.setLatLng([la, ln]); S.map.setView([la, ln], 16); }
}
function refreshApplyBtn(sec) {
  const b = document.querySelector(`[data-apply="${sec}"]`); if (b) { b.classList.toggle('applied', !!S.cs.applied[sec]); b.innerHTML = S.cs.applied[sec] ? '✔ Applied' : ICO.check + ' Apply'; }
  if (sec === 'geo' && $('#geoState')) $('#geoState').textContent = S.cs.applied.geo ? 'Applied ' + new Date().toLocaleTimeString() : 'Not applied';
  updateEndInfo();
}

/* ---------------- apply & validation ---------------- */
function applySection(sec, quiet) {
  // v2.2: Apply is optional and never blocks — it only records that the agent checked the section.
  // No format rules (country code, email, URL, ALL CAPS, …); mistakes are caught by scoring instead.
  const f = S.cs.f;
  S.cs.applied[sec] = true; refreshApplyBtn(sec);
  if (sec === 'basic') { const m = document.querySelector('#sec-basic [data-msg="name"]'); if (m && f.name.trim()) m.textContent = ''; }
  if (sec === 'accom') { const m = document.querySelector('#sec-accom [data-msg="type"]'); if (m && f.type) m.textContent = ''; }
  if (sec === 'geo') { const la = parseFloat(f.lat), ln = parseFloat(f.lng); if (!isNaN(la) && !isNaN(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) moveMarker(); }
  if (!quiet) toast('✔ ' + ({ basic: 'Basic Info', contact: 'Contact Details', desc: 'Description', photos: 'Photos', accom: 'Accommodation Info', internal: 'Internal', geo: 'Geo Coding' })[sec] + ' applied', 1400);
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
  .note{margin:0 24px 24px;padding:12px;background:#fff7e0;border:1px solid #f0d58a;border-radius:8px;font-size:13px}
  .amen{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.amen span{background:#eef6f2;border:1px solid #cfe6da;color:#24513c;border-radius:999px;padding:5px 11px;font-size:13px}</style></head><body>
  <div class="top">Hopper · Partner property page <span style="font-weight:400;opacity:.85">(training snapshot of the feed)</span></div>
  <div class="wrap"><div class="hero">${esc(p.name)}</div><div class="grid">
  <div><b>Property name</b>${esc(p.name)}</div><div><b>Provider ID</b>${esc(p.id)}</div>
  <div><b>Address (as listed)</b>${esc(p.address)}</div><div><b>Rooms (as sent by provider)</b>${esc(p.rooms)}</div>
  <div><b>Guest rating</b>${p.rating} / 5</div><div><b>Contact</b>Hidden by provider – guests book through Hopper</div>
  <div style="grid-column:1/-1"><b>Amenities &amp; facilities</b><div class="amen">${(p.amen || []).length ? p.amen.map(a => `<span>${esc(a)}</span>`).join('') : '<i style="color:#888">None listed</i>'}</div></div>
  ${p.desc ? `<div style="grid-column:1/-1"><b>Description</b>${esc(p.desc)}</div>` : ''}</div>
  <div class="note">This page only repeats what the provider sent. The provider does not state a property type — work it out from the amenities, then confirm on OTAs, Google Maps and the official website.</div></div></body></html>`;
  try { const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); if (!w) toast('⚠ Allow pop-ups for this page to open the provider tab'); }
  catch (e) { toast('⚠ Could not open a new tab'); }
}
function helpfulLinkUrl(i) {
  const c = curCase(), L = APP_CONFIG.HELPFUL_LINKS[i]; if (!c || !L) return '';
  const pt = String(c.feed.parentText || '').trim(), m = pt.match(/^([A-Z]{2}),\s*(.*)$/);
  const cc = m ? m[1] : '', city = (m ? m[2] : pt).trim();
  const vals = { name: c.feed.name || '', city, cc, street: [c.feed.street, city].filter(Boolean).join(', ') || c.feed.name || '', q: c.feed.name + (city ? ' ' + city : '') };
  return L.url.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vals[k] || '')).replace(/[?&]country=$/, '');
}
function renderHelpful() {
  $('#helpfulMenu').innerHTML = APP_CONFIG.HELPFUL_LINKS.map((l, i) => `<div data-link="${i}">${esc(l.label)}</div>`).join('');
}
function helpfulLink(i) { const u = helpfulLinkUrl(i); if (u) window.open(u, '_blank', 'noopener'); }

/* ---------------- parent search ----------------
   Built-in geos appear instantly while typing. Press Enter (or Search) to look the place up worldwide —
   any city, town or village, returned with its full chain, e.g.
   "Edupuram" → Edupuram, Ichchapuram, Srikakulam, Andhra Pradesh, India.
   Providers are set in APP_CONFIG.GEO_SEARCH (OpenStreetMap Nominatim → Photon; GeoNames if a username is set). */
const GEO_CACHE = {}, PARENT_RESULTS = {};
let geoLastCall = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchJson(u) {
  const wait = 1100 - (Date.now() - geoLastCall); if (wait > 0) await sleep(wait); // public servers allow ~1 request/second
  geoLastCall = Date.now();
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = setTimeout(() => ctl && ctl.abort(), 10000);
  try { const r = await fetch(u, { signal: ctl ? ctl.signal : undefined, headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(tm); }
}
const dedupeParts = arr => arr.filter((x, i) => x && arr.findIndex(y => norm(y) === norm(x)) === i);
const GEO_PROVIDERS = {
  nominatim: async (q, cc, cfg) => {
    const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=' + (cfg.maxResults || 10) + '&accept-language=' + (cfg.language || 'en') +
      '&q=' + encodeURIComponent(q) + (cc ? '&countrycodes=' + cc : '');
    const js = await fetchJson(u);
    return (Array.isArray(js) ? js : []).filter(r => r.category === 'place' || (r.category === 'boundary' && r.type === 'administrative')).map(r => {
      const a = r.address || {};
      let parts = String(r.display_name || '').split(',').map(s => s.trim()).filter(x => x && x !== a.postcode && !/^\d{3,}(?:[-\s]\d+)?$/.test(x));
      const name = r.name || parts[0] || q;
      if (parts.length && norm(parts[0]) === norm(name)) parts = parts.slice(1);
      return { id: 'osm_' + String(r.osm_type || 'x')[0] + r.osm_id, name, path: dedupeParts(parts.filter(x => norm(x) !== norm(name))).join(', '), cc: String(a.country_code || '').toUpperCase(), kind: r.addresstype || r.type || 'place', lat: +r.lat, lng: +r.lon, src: 'OpenStreetMap' };
    });
  },
  photon: async (q, cc, cfg) => {
    const u = 'https://photon.komoot.io/api/?limit=' + (cfg.maxResults || 10) + '&lang=' + (['en', 'de', 'fr', 'it'].includes(cfg.language) ? cfg.language : 'en') + '&osm_tag=place&q=' + encodeURIComponent(q);
    const js = await fetchJson(u);
    return ((js && js.features) || []).filter(f => !cc || String(f.properties.countrycode || '').toLowerCase() === cc).map(f => {
      const p = f.properties || {}, xy = (f.geometry && f.geometry.coordinates) || [];
      return { id: 'osm_' + String(p.osm_type || 'x')[0].toLowerCase() + p.osm_id, name: p.name, path: dedupeParts([p.city, p.district, p.county, p.state, p.country].filter(x => x && norm(x) !== norm(p.name))).join(', '), cc: String(p.countrycode || '').toUpperCase(), kind: p.osm_value || 'place', lat: +xy[1], lng: +xy[0], src: 'OpenStreetMap' };
    }).filter(g => g.name);
  },
  geonames: async (q, cc, cfg) => {
    const u = 'https://secure.geonames.org/searchJSON?maxRows=' + (cfg.maxResults || 10) + '&style=FULL&lang=' + (cfg.language || 'en') + '&isNameRequired=true&featureClass=P&featureClass=A&username=' +
      encodeURIComponent(cfg.geonamesUser) + '&q=' + encodeURIComponent(q) + (cc ? '&country=' + cc.toUpperCase() : '');
    const js = await fetchJson(u); if (js && js.status) throw new Error(js.status.message || 'GeoNames error');
    return ((js && js.geonames) || []).map(g => ({ id: 'gn_' + g.geonameId, name: g.name, path: dedupeParts([g.adminName3, g.adminName2, g.adminName1, g.countryName].filter(x => x && norm(x) !== norm(g.name))).join(', '), cc: String(g.countryCode || '').toUpperCase(), kind: g.fcodeName || 'place', lat: +g.lat, lng: +g.lng, src: 'GeoNames' }));
  }
};
async function geoSearchOnline(raw) {
  let text = String(raw || '').trim(), cc = '';
  const m = text.match(/^([A-Za-z]{2}),\s*(.+)$/); if (m) { cc = m[1].toLowerCase(); text = m[2].trim(); } // feed style "IN, Munnar"
  if (text.length < 2) return [];
  const key = cc + '|' + text.toLowerCase(); if (GEO_CACHE[key]) return GEO_CACHE[key];
  const cfg = APP_CONFIG.GEO_SEARCH || {};
  const provs = (cfg.geonamesUser ? ['geonames'] : []).concat(cfg.providers || ['nominatim', 'photon']).filter(p => GEO_PROVIDERS[p]);
  let lastErr = null, got = null;
  for (const p of provs) {
    try { const r = await GEO_PROVIDERS[p](text, cc, cfg); if (r.length) { got = r; break; } got = got || r; } catch (e) { lastErr = e; console.warn('geo search via ' + p + ' failed', e); }
  }
  if (!got && lastErr) throw lastErr;
  (got || []).forEach(g => { if (!g.nav) g.nav = String(g.path || '').split(',').map(x => x.trim()).filter(Boolean).reverse().concat(g.name).join(', '); });
  GEO_CACHE[key] = got || []; return GEO_CACHE[key];
}

/* Two geos are "the same parent" when the name matches (incl. alternative names in brackets),
   the country matches and the expected state/region appears in the candidate's chain.
   So Kochi, Kerala ≠ Kochi, Japan and Kovalam, Kerala ≠ Kovalam, Tamil Nadu. */
const gNorm = s => norm(s).replace(/\b(district|prefecture|province|region|county|division|taluk|tehsil|mandal|municipality|corporation)\b/g, ' ').replace(/\s+/g, ' ').trim();
const geoParts = g => String(g.path || '').replace(/\([^)]*\)/g, '').split(',').map(s => s.trim()).filter(Boolean);
function geoNameSet(g) {
  const n = String(g.name || ''), out = [n.replace(/\s*\([^)]*\)\s*/g, ' ')];
  const m = n.match(/\(([^)]+)\)/); if (m) out.push(m[1]);
  return out.map(gNorm).filter(Boolean);
}
function geoMatch(a, b) {
  if (!a || !b) return false;
  if (a.id && a.id === b.id) return true;
  const na = geoNameSet(a), nb = geoNameSet(b);
  const nameOk = na.some(x => nb.some(y => x === y || (Math.min(x.length, y.length) >= 5 && simRatio(x, y) >= .88)));
  if (!nameOk) return false;
  const pa = geoParts(a), pb = geoParts(b);
  const ctryA = pa.length ? pa[pa.length - 1] : a.name, ctryB = pb.length ? pb[pb.length - 1] : b.name;
  const ccOk = a.cc && b.cc ? String(a.cc).toUpperCase() === String(b.cc).toUpperCase() : gNorm(ctryA) === gNorm(ctryB);
  if (!ccOk) return false;
  const stateOf = p => p.length >= 2 ? gNorm(p[p.length - 2]) : '';
  const sa = stateOf(pa), sb = stateOf(pb);
  if (!sa || !sb) return true;
  return pb.map(gNorm).includes(sa) || pa.map(gNorm).includes(sb);
}

/* Parent field = an inline search bar (like the live LMT): type in the box → click 🔍 (or Enter) →
   pick from the dropdown under the box. Editing the text after picking clears the selection. */
const geoCodeQuery = q => { const m = String(q || '').trim().match(/^g?(\d{3,})$/i); return m ? m[1] : ''; };
function localGeoHits(q) {
  const code = geoCodeQuery(q);
  if (code) return GEOS.filter(g => String(g.ta) === code);              // search by Tripadvisor geo code, e.g. 297586
  const toks = norm(q).split(' ').filter(t => t.length > 2); // skip 2-letter country codes like "IN"
  return GEOS.filter(g => !String(g.id).startsWith('osm_') && !String(g.id).startsWith('gn_')).map(g => {
    const hay = norm((g.nav || '') + ' ' + g.name + ' ' + g.path + ' ' + (g.ta || '')); let sc = 0;
    toks.forEach(t => { if (hay.split(' ').includes(t)) sc += 2; else if (hay.includes(t)) sc += 1; });
    return { g, sc };
  }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 12).map(x => x.g);
}
const parentItem = g => { PARENT_RESULTS[g.id] = g; return `<div class="parent-res" data-pick="${esc(g.id)}"><code>${esc(g.ta ? g.ta : (g.kind || 'place'))}</code><b>${esc(g.nav || g.name)}</b>${g.ta ? '' : '<small>Not a Tripadvisor geo code (OpenStreetMap result)</small>'}</div>`; };
let parentSeq = 0;
function drawParentDrop(q, online, status) {
  const d = $('#parentDrop'); if (!d) return;
  const loc = localGeoHits(q), on = (online || []).filter(o => !loc.some(g => geoMatch(o, g)));
  const locOnly = loc;
  const items = locOnly.map(g => parentItem(g)).join('') + on.map(g => parentItem(g)).join('');
  d.innerHTML = `<div class="pd-status">${status || ''}</div>${items || (online ? '<div class="pq-empty">No places found. Check the spelling, or try the nearest town.</div>' : '')}<div class="pd-hint">Pick the <b>most specific</b> geo — check the district, state and country.</div>`;
  d.classList.remove('hidden'); d.dataset.active = '-1';
}
async function searchParent() {
  const inp = $('#parentShow'); if (!inp) return;
  const q = inp.value.trim();
  if (q.length < 2) { toast('Type a city, town, village or geo code in the Parent box, then click 🔍'); inp.focus(); return; }
  const my = ++parentSeq;
  if (geoCodeQuery(q)) {                    // geo codes are Tripadvisor ids — only the simulator's geo list knows them
    const hit = localGeoHits(q).length;
    return drawParentDrop(q, [], hit ? '' : `No geo with code ${esc(geoCodeQuery(q))} in the simulator. Try the place name.`);
  }
  drawParentDrop(q, null, '<span class="spin"></span> Searching all places…');
  let online = [], status = '';
  try { online = await geoSearchOnline(q); status = online.length ? `${online.length} place(s) found for “${esc(q)}”` : ''; }
  catch (e) { status = '<span style="color:#b26a00">⚠ Worldwide search is unavailable (offline or blocked network). Showing geos saved in the simulator only.</span>'; }
  if (my !== parentSeq || !$('#parentShow')) return;
  drawParentDrop(q, online, status);
}
function closeParentDrop() { parentSeq++; const d = $('#parentDrop'); if (d) d.classList.add('hidden'); }
function moveParentActive(step) {
  const d = $('#parentDrop'); if (!d || d.classList.contains('hidden')) return false;
  const items = $$('#parentDrop .parent-res'); if (!items.length) return false;
  let i = +d.dataset.active + step; i = Math.max(0, Math.min(items.length - 1, i)); d.dataset.active = i;
  items.forEach((x, j) => x.classList.toggle('act', j === i)); items[i].scrollIntoView({ block: 'nearest' }); return true;
}
function registerGeo(id) {
  if (GEO_BY_ID[id]) return GEO_BY_ID[id];
  const g = PARENT_RESULTS[id]; if (!g) return null;
  GEOS.push(g); GEO_BY_ID[id] = g; return g;
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
    const keys = [['name', 'Name'], ['brand', 'Brand'], ['street', 'Street One'], ['street2', 'Street Two'], ['postal', 'Postal'], ['parentText', 'Parent (raw)'], ['rooms', 'Rooms'], ['lat', 'Latitude'], ['lng', 'Longitude'], ['desc', 'Description']];
    body += `<h4 style="margin:16px 0 6px">Raw feed payload</h4><table class="fb-tbl">${keys.filter(([k]) => F[k] !== undefined && F[k] !== '').map(([k, l]) => `<tr><td style="width:160px"><b>${l}</b></td><td>${esc(F[k])}</td></tr>`).join('')}</table>`;
  }
  generic(kind === 'full' ? '🧾 AuditTrail – Full View' : '🧾 AuditTrail – Basic View', body);
}

/* ---------------- reject menu (red ⊗ button) ---------------- */
const rejectReasons = () => Object.entries(REASONS).filter(([, r]) => r.d === 'reject');
function toggleRejectMenu(btn) {
  const m = $('#rejMenu');
  if (!m.classList.contains('hidden')) return m.classList.add('hidden');
  m.innerHTML = rejectReasons().map(([k, r]) => `<div data-rej-reason="${k}">${esc(r.label)}</div>`).join('');
  const rc = btn.getBoundingClientRect();
  m.style.right = Math.max(8, window.innerWidth - rc.right - 60) + 'px';
  m.style.bottom = (window.innerHeight - rc.top + 6) + 'px';
  m.classList.remove('hidden'); $('#toast').classList.remove('show');
}
function submitReject(reason) {
  $('#rejMenu').classList.add('hidden');
  const cs = S.cs; if (!cs) return;
  submitCase({ decision: 'reject', reason, match: '', notes: String(cs.notes || cs.f.internal || '').trim() });
}

/* ---------------- decision ---------------- */
function openDecision(pre) {
  const c = curCase(), cs = S.cs, L = listingFor(c);
  let sel = pre || '', matchVal = '';
  const draw = () => {
    const reasons = Object.entries(REASONS).filter(([, r]) => r.d === sel);
    $('#mDecisionBox').innerHTML = `<div class="modal-h"><h3>⚖️ Take action on request ${c.req}</h3><button class="x" data-close="mDecision">✕</button></div>
      <div class="modal-b">
        <div class="dgrid">${Object.entries(DECISIONS).map(([k, d]) => `<button class="dopt ${sel === k ? 'sel' : ''}" data-dsel="${k}"><span class="ic" style="background:${d.color}">${d.icon}</span><span><b>${d.label}</b><small>${({ approve: 'New, real, open accommodation', alias: 'Possible match / dupe on Tripadvisor', reject: 'Closed / not lodging / VR / cannot verify', t1: 'Unsure · weird case · conflicting info', defer: 'Not open yet' })[k]}</small></span></button>`).join('')}</div>
        ${sel && !['approve', 'alias'].includes(sel) ? `<label class="mlabel">Reason *</label><select class="mselect" id="dReason"><option value="">— Select reason —</option>${reasons.map(([k, r]) => `<option value="${k}">${esc(r.label)}</option>`).join('')}</select>` : ''}
        ${sel === 'alias' ? (L ? `<label class="mlabel">Existing listing the request is applied to</label><div class="pm-sum"><code>${esc(L.id)}</code> <b>${esc(L.name || '')}</b> · ${esc(geoTplLabel(L.parent))} <a href="${esc(L.taUrl)}" target="_blank" rel="noopener">View ↗</a>${cs.link === 'new' ? '<div style="color:#b26a00;font-size:12px;margin-top:4px">You marked this listing “Not match”. Submitting Alias applies the request to it anyway.</div>' : ''}<div style="font-size:12px;color:#6b7785;margin-top:4px">The values you edited on the page are saved to this listing, and the feed name is kept as an alias.</div></div>`
          : `<label class="mlabel">Existing Tripadvisor listing (no possible match was shown)</label><input class="mselect" id="dMatch" value="${esc(matchVal)}" placeholder="Paste the Tripadvisor link or location ID of the listing you found"><div style="font-size:11.5px;color:#6b7785;margin-top:4px">Only needed when LMT showed no possible match and you found the dupe on tripadvisor.com yourself.</div>`) : ''}
        ${sel ? `<label class="mlabel">Agent notes (optional) <span style="font-weight:500;color:#8a96a3">— pre-filled from your Internal Comment</span></label><textarea class="mtext" id="dNotes" placeholder="What evidence did you rely on? (links, what you saw)">${esc(cs.notes || cs.f.internal)}</textarea>` : '<p style="color:#6b7785;font-size:13px;margin:14px 0 0">Select an action above.</p>'}
        <div class="err-msg" id="dErr" style="margin-top:8px"></div>
      </div>
      <div class="modal-f"><button class="btn btn-ghost" data-close="mDecision">Cancel</button><button class="btn btn-pri" id="dSubmit" ${sel ? '' : 'disabled'}>Submit decision</button></div>`;
    $$('[data-dsel]').forEach(b => b.onclick = () => { cs.notes = ($('#dNotes') || {}).value || cs.notes; matchVal = ($('#dMatch') || {}).value || matchVal; sel = b.dataset.dsel; draw(); });
    const sb = $('#dSubmit'); if (sb) sb.onclick = () => {
      const reason = ($('#dReason') || {}).value || (sel === 'approve' ? 'new_verified' : sel === 'alias' ? 'duplicate' : '');
      const match = sel === 'alias' && L ? L.id : (($('#dMatch') || {}).value || '').trim();
      const notes = ($('#dNotes') || {}).value || '';
      const err = msg => { $('#dErr').textContent = msg; };
      if (!['approve', 'alias'].includes(sel) && !reason) return err('Select a reason.');
      if (sel === 'alias' && !match) return err('Paste the Tripadvisor link of the listing you found.');
      if ((sel === 'approve' || sel === 'alias') && !cs.f.type) return err('Select an Accommodation Type first. A listing cannot be saved without one.');
      // v2.2: no other blocking checks — Apply is optional and empty/unapplied fields are simply scored.
      closeModal('mDecision');
      submitCase({ decision: sel, reason, match, notes: notes.trim() });
    };
  };
  draw(); openModal('mDecision');
}

/* ---------------- everything the agent saved (v2.6) ----------------
   Only the 4 primary fields are scored, but every field on the listing is stored with the answer:
   shown after Take Action (next to the answer key, for coaching), in Review, in the Admin Portal and
   as "Entered …" columns in the Question_Log tab of the Google Sheet. */
const ENTRY_FIELDS = [
  // [form key, label, Question_Log key]
  ['name', 'Property Name', 'entName'], ['former', 'Former Name', 'entFormer'], ['brand', 'Brand', 'entBrand'],
  ['street', 'Street One', 'entStreet'], ['street2', 'Street Two', 'entStreet2'], ['postal', 'Postal Code', 'entPostal'],
  ['parent', 'Parent (geo code)', 'entParent'], ['phone', 'Phone', 'entPhone'], ['fax', 'Fax', 'entFax'], ['email', 'Email', 'entEmail'],
  ['url', 'URL', 'entUrl'], ['desc', 'Description', 'entDesc'], ['thumb', 'Primary Thumbnail', 'entThumb'],
  ['type', 'Accommodation Type', 'entType'], ['rooms', 'Rooms', 'entRooms'], ['floors', 'Floors', 'entFloors'],
  ['opening', 'Opening Date', 'entOpening'], ['allIncl', 'All Inclusive', 'entAllIncl'],
  ['provAttr', 'Provider Attribution', 'entProvAttr'], ['provExp', 'Attribution Expiration', 'entProvExp'],
  ['internal', 'Internal Comment', 'internalComment'], ['aliases', 'Aliases', 'aliases'],
  ['lat', 'Latitude', 'entLat'], ['lng', 'Longitude', 'entLng']
];
const ENTRY_SCORED = { name: 1, street: 1, url: 1, geo: 1 };
function aliasText(cs) { return cs.aliases.filter(a => a.name.trim()).map(a => a.name.trim() + (a.searchable ? ' (searchable)' : '')).join(' ; '); }
function entryValue(k, cs) {
  const f = cs.f;
  if (k === 'aliases') return aliasText(cs);
  if (k === 'parent') return f.parent ? geoTplLabel(f.parent) : '';
  if (k === 'allIncl') return f.allIncl ? 'Yes' : 'No';
  if (k === 'type') return f.type === 'N/A' ? '' : (f.type || '');
  const v = f[k]; return v == null ? '' : String(v).trim();
}
/* {entName: …, entStreet: …, internalComment: …, aliases: …, entLat: …} → sent to the Google Sheet */
function entryCols(cs) {
  const o = {};
  ENTRY_FIELDS.forEach(([k, , col]) => { o[col] = entryValue(k, cs); });
  return o;
}
/* Rows for the "Everything you saved" table: your value next to the answer key (reference only). */
function entryRows(c, cs) {
  const A = c.ans || {}, has = v => v !== undefined && v !== null;
  const ref = k => {
    if (k === 'parent') return has(A.parent) && [].concat(A.parent).length ? [].concat(A.parent).map(geoTplLabel).join('  or  ') : null;
    if (k === 'allIncl') return A.allIncl === undefined ? null : A.allIncl ? 'Yes' : 'No';
    if (k === 'lat' || k === 'lng') return null;
    if (['former', 'desc', 'thumb', 'provAttr', 'provExp', 'internal', 'aliases', 'fax'].includes(k)) return null;
    if (!has(A[k])) return null;
    const vals = [].concat(A[k]).map(v => (v === '' ? '(blank)' : String(v)));
    return vals.join('  or  ');
  };
  const rows = ENTRY_FIELDS.filter(([k]) => k !== 'lat' && k !== 'lng').map(([k, label]) => ({ k, label, given: entryValue(k, cs), exp: ref(k), scored: !!ENTRY_SCORED[k] }));
  const geoAt = rows.findIndex(r => r.k === 'type') + 1;
  const g = { k: 'geo', label: 'Geo Coding (lat, long)', given: cs.f.lat !== '' && cs.f.lng !== '' ? `${cs.f.lat}, ${cs.f.lng}` : '', exp: A.lat !== undefined && A.lat !== null && A.lat !== '' ? `${A.lat}, ${A.lng}` : null, scored: true };
  rows.splice(geoAt, 0, g);
  return rows;
}
/* Question_Log columns for one answer: every entered field + how far the pin was from the answer */
function sheetEntry(r) {
  const o = Object.assign({}, r.entryCols || {});
  ['entLat', 'entLng'].forEach(k => { const n = parseFloat(o[k]); o[k] = isNaN(n) ? '' : n; });
  const g = (r.fields || []).find(f => f.k === 'geo');
  o.pinDistM = g && typeof g.dist === 'number' ? Math.round(g.dist) : '';
  o.listing = r.decision === 'alias' ? 'Applied to existing listing' : r.decision === 'approve' ? 'New listing' : '';
  return o;
}
function entryTableHtml(r) {
  if (!r.entry || !r.entry.length) return '';
  const res = {}; (r.fields || []).forEach(f => { res[f.k] = f.status; });
  const scoredNow = r.mode !== 'decision';
  return `<h4 style="margin:16px 0 4px">📋 Everything you saved on this listing</h4>
    <p class="fb-sub">Saved with your answer and in the Google Sheet. ${scoredNow ? 'Only the ⭐ fields are scored' : 'On this case only the action is scored (⭐ fields are scored on Approve and Alias cases)'}. Every other field is not scored; the answer key column is there to help you learn.</p>
    <div class="entry-wrap"><table class="fb-tbl entry-tbl"><tr><th style="width:170px">Field</th><th>You saved</th><th>Answer key</th></tr>
    ${r.entry.map(e => {
      const mark = e.scored && scoredNow && res[e.k] ? (res[e.k] === 'ok' ? ' <span class="ok-c">✔</span>' : ' <span class="bad-c">✖</span>') : '';
      return `<tr class="${e.given ? '' : 'empty'}"><td>${e.scored ? '⭐ ' : ''}${esc(e.label)}</td><td class="${e.k === 'desc' || e.k === 'internal' ? 'long' : ''}">${e.given ? esc(e.given) : '<span class="muted">—</span>'}${mark}</td><td>${e.exp == null ? '<span class="muted">—</span>' : esc(e.exp)}</td></tr>`;
    }).join('')}</table></div>`;
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
    expectedMatch: (() => { const L = listingFor(c); return c.ans.decision === 'alias' ? (L && L.isMatch ? L.id + ' · ' + (L.name || '') : (c.ans.match || '')) : ''; })(),
    match: (() => { const L = listingFor(c); return dec.decision === 'alias' && L && dec.match === L.id ? L.id + ' · ' + (L.name || '') : dec.match; })(), matchOk: sc.matchOk, fieldsPct: Math.round(sc.fieldsPct * 100), score: sc.score, points: sc.points, correct: sc.correct, fieldsOk: sc.fieldsOk, fieldsN: sc.fieldsN,
    xp, speed, streakB, timeSec, critical: sc.critical, notes: dec.notes, mode: sc.mode,
    showAll: cs.showAllUsed, showAllSec: cs.showAllSec, internal: (cs.f.internal || '').trim(),
    aliases: aliasText(cs),
    fields: sc.fields.map(f => ({ k: f.k, label: f.label, status: f.status, given: f.given, exp: f.exp, note: f.note, dist: f.dist })), tip: c.tip,
    link: cs.link, entry: entryRows(c, cs), entryCols: entryCols(cs)
  };
  S.results[S.idx] = r;
  renderHud();
  showFeedback(r, true);
  if (sc.correct) confetti(120);
}
function feedbackHtml(r) {
  const D = DECISIONS, ok = r.correct !== undefined ? r.correct : r.score >= 80, pts = r.points !== undefined ? r.points : (ok ? 10 : 0);
  const verdict = ok ? '✅ Correct · 10 points' : r.critical ? '🚨 Critical error · 0 points' : '❌ Not correct · 0 points';
  const reasonLbl = k => (REASONS[k] ? REASONS[k].label : (k || '—'));
  const dl = k => D[k] || { icon: '', label: k || '—' };
  return `<div class="fb-head"><div class="fb-score" style="color:${ok ? 'var(--ok)' : 'var(--bad)'}">${pts}<small>/10</small></div><div class="fb-verdict">${verdict}</div>
      <div class="fb-xp">+${r.xp} XP${r.speed ? ` · ⚡ +${r.speed}` : ''}${r.streakB ? ` · 🔥 +${r.streakB}` : ''}</div></div>
    <div class="modal-b">
      <div class="fb-rule">A question earns 10 points only when the action <b>and</b> every scored field (Property Name, Street One, Geo, URL) are correct. One mistake = 0.</div>
      <table class="fb-tbl"><tr><th style="width:150px"></th><th>Your answer</th><th>Correct answer</th><th style="width:60px"></th></tr>
        <tr><td><b>Action</b></td><td>${dl(r.decision).icon} ${esc(dl(r.decision).label)}</td><td>${dl(r.expectedDecision).icon} ${esc(dl(r.expectedDecision).label)}</td><td class="${r.decisionOk ? 'ok-c' : 'bad-c'}">${r.decisionOk ? '✔' : '✖'}</td></tr>
        ${r.expectedDecision === 'alias' || r.decision === 'alias' ? `<tr><td><b>Existing listing</b></td><td style="word-break:break-all">${esc(r.decision === 'alias' ? (r.match || '—') : 'Not applied (you created a new listing)')}</td><td style="word-break:break-all">${esc(r.expectedDecision === 'alias' ? (r.expectedMatch || 'The existing Tripadvisor listing') : 'None (this is a new property)')}</td><td class="${r.matchOk ? 'ok-c' : 'bad-c'}">${r.matchOk ? '✔' : '✖'}</td></tr>` : ''}
        <tr class="ns"><td><b>Reason</b> <small>(not scored)</small></td><td>${esc(reasonLbl(r.reason))}</td><td>${esc(String(r.expectedReason || '').split('|').map(reasonLbl).join(' / '))}</td><td></td></tr>
      </table>
      ${r.critical ? `<div class="crit">🚨 ${r.decision === 'approve' ? 'You approved a listing that should not be created.' : 'You applied this request to a different property\'s listing. That overwrites a real listing with the wrong data.'}</div>` : ''}
      ${r.mode !== 'decision' && r.fields.length ? `<h4 style="margin:16px 0 4px">Scored fields</h4><table class="fb-tbl"><tr><th>Field</th><th>You entered</th><th>Expected</th><th>Result</th></tr>
        ${r.fields.map(f => `<tr><td>${esc(f.label)}</td><td>${esc(f.given)}</td><td>${esc(f.exp)}</td><td class="${f.status === 'ok' ? 'ok-c' : 'bad-c'}">${f.status === 'ok' ? '✔' : '✖'} <span style="font-weight:500;color:#555">${esc(f.note || '')}</span></td></tr>`).join('')}</table>`
        : r.mode === 'decision' ? '<p style="font-size:12.5px;color:#6b7785;margin:12px 0 0">For Reject and Escalate cases only the action is scored.</p>' : ''}
      ${entryTableHtml(r)}
      <div class="${r.showAll ? 'habit ok' : 'habit bad'}">👁 <b>Show All Fields:</b> ${r.showAll ? `used${r.showAllSec != null ? ' after ' + fmtTime(r.showAllSec) : ''} ✔` : 'not used ✖ — Phone, Fax, Email, Description and the Internal Comment stayed hidden. On the live LMT, click it first on every request.'}${r.internal ? '' : ' · <span style="color:#9a6a00">No Internal Comment written.</span>'}</div>
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
  ['perfect', '💎', 'Flawless', 'Every case correct'],
  ['geo', '🎯', 'Geo Sniper', 'Every pin within tolerance'],
  ['fraud', '🕵️', 'Escalation Pro', 'Escalated every case that needed it'],
  ['dupe', '🧬', 'Duplicate Detective', 'Matched every duplicate'],
  ['speed', '⚡', 'Speed Runner', 'Avg < 6 min with 80% correct'],
  ['streak', '🔥', 'Hot Streak', '5 correct cases in a row'],
  ['safe', '🛡️', 'Zero Critical', 'No critical errors']
];
function computeBadges(rs) {
  const got = new Set(), avg = rs.reduce((a, r) => a + r.score, 0) / rs.length, avgT = rs.reduce((a, r) => a + r.timeSec, 0) / rs.length;
  if (rs.every(r => r.score >= 100)) got.add('perfect');
  const geos = rs.flatMap(r => r.fields.filter(f => f.k === 'geo' && r.mode === 'fields'));
  if (geos.length && geos.every(g => g.status === 'ok')) got.add('geo');
  const esc1 = rs.filter(r => r.expectedDecision === 't1'); if (esc1.length && esc1.every(r => r.decisionOk)) got.add('fraud');
  const al = rs.filter(r => r.expectedDecision === 'alias'); if (al.length && al.every(r => r.decisionOk && r.matchOk)) got.add('dupe');
  if (avgT < 360 && avg >= 80) got.add('speed');
  if (S.bestStreak >= 5) got.add('streak');
  if (!rs.some(r => r.critical)) got.add('safe');
  return got;
}
function finishDay() {
  clearInterval(S.timer);
  const rs = S.results, n = rs.length;
  const total = rs.reduce((a, r) => a + (r.points || 0), 0), acc = Math.round(total / (n * 10) * 100); // 10 points per correct question
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
    accuracy: acc, totalScore: total, maxScore: n * 10, xp: S.xp, level: `Lv ${L.n} · ${L.name}`, passed, badges: BADGES.filter(b => badges.has(b[0])).map(b => b[2]).join(', '),
    criticalErrors: rs.filter(r => r.critical).length
  };
  const questions = rs.map(r => ({
    timestamp: finishedAt, attemptId: S.attemptId, trainingId: S.user.trainingId, name: S.user.name, trainer: S.user.trainer, wave: S.user.wave, day: S.user.day,
    qNo: r.qNo, caseId: r.caseId, hotel: r.hotel, expectedDecision: r.expectedDecision, decision: r.decision, decisionOk: r.decisionOk,
    expectedReason: r.expectedReason, reason: r.reason, reasonOk: r.reasonOk, match: r.match, fieldsPct: r.fieldsPct, score: r.points || 0, xp: r.xp,
    timeSec: r.timeSec, critical: r.critical, notes: r.notes,
    fieldDetail: r.fields.map(f => `${f.label}:${f.status === 'ok' ? '✔' : f.status === 'partial' ? '◐' : '✖'}`).join(' | '),
    showAll: r.showAll ? 'Yes' : 'No', internalComment: r.internal || '', aliases: r.aliases || '',
    ...sheetEntry(r)
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
      <h2>${a.passed ? '🏆 Passed · certificate level reached' : '📘 Not passed yet · keep practising'}</h2>
      <div>${esc(S.user.name)} · ID ${esc(S.user.trainingId)} · Day ${S.user.day} · ${esc(dayMeta(S.user.day).title)}${S.user.wave ? ' · ' + esc(S.user.wave) : ''}</div>
      <div style="margin-top:8px;opacity:.9">${APP_CONFIG.PASS_MARK}% needed for the certificate · 10 points per correct question · Attempt #${a.attemptNo} · ${a.level}${levelUp ? ' · 🎉 LEVEL UP!' : ''}</div></div>
      <div class="ring"><b>${a.accuracy}%</b><span>${a.totalScore}/${a.maxScore} points</span></div></div>
    <div class="kpis">
      <div class="kpi"><span>Total score</span><b>${a.totalScore}/${a.maxScore}</b></div>
      <div class="kpi"><span>Correct answers</span><b>${rs.filter(r => r.correct).length}/${a.questions}</b></div>
      <div class="kpi"><span>XP earned</span><b>⭐ ${a.xp}</b></div>
      <div class="kpi"><span>Avg time / case</span><b>${fmtTime(avgT)}</b></div>
      <div class="kpi"><span>Critical errors</span><b style="color:${a.criticalErrors ? 'var(--bad)' : 'inherit'}">${a.criticalErrors}</b></div>
    </div>
    <div class="badges">${BADGES.map(b => `<div class="badge ${badges.has(b[0]) ? '' : 'lockd'}" title="${esc(b[3])}"><i>${b[1]}</i><div><b>${b[2]}</b><div style="color:#6b7785;font-size:11.5px">${b[3]}</div></div></div>`).join('')}</div>
    <div class="tbl-card"><h3 style="margin:0 0 10px">Case-by-case scorecard</h3>
      <table class="rtbl"><thead><tr><th>#</th><th>Property</th><th>Your action</th><th>Correct action</th><th>Scored fields</th><th>Points</th><th>Time</th><th>XP</th><th></th></tr></thead><tbody>
      ${rs.map((r, i) => `<tr class="clk" data-review="${i}"><td>${r.qNo}</td><td><b>${esc(r.hotel)}</b><div style="font-size:11px;color:#888">${esc(r.caseId)}</div></td>
        <td>${D[r.decision].icon} ${D[r.decision].short}</td><td>${D[r.expectedDecision].icon} ${D[r.expectedDecision].short} ${r.decisionOk ? '<span class="ok-c">✔</span>' : '<span class="bad-c">✖</span>'}</td>
        <td>${r.mode !== 'decision' && r.fieldsN ? `${r.fieldsOk}/${r.fieldsN} ${r.fieldsOk === r.fieldsN ? '<span class="ok-c">✔</span>' : '<span class="bad-c">✖</span>'}` : '—'}</td>
        <td><b style="color:${r.correct ? 'var(--ok)' : 'var(--bad)'}">${r.points}/10</b>${r.critical ? ' 🚨' : ''}</td><td>${fmtTime(r.timeSec)}</td><td>${r.xp}</td><td><button class="btn btn-ghost btn-sm">Review</button></td></tr>`).join('')}
      </tbody></table>
      <div class="sync-line" id="syncLine">Saving results…</div></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-ghost" id="rCsv">⬇ Download my scorecard (CSV)</button>
      <button class="btn btn-ghost" id="rRetry">↺ Retry Day ${S.user.day}</button>
      <button class="btn btn-pri" id="rHome">Back to login</button></div>`;
  $$('[data-review]').forEach(tr => tr.onclick = () => showFeedback(S.results[+tr.dataset.review], false));
  $('#rRetry').onclick = () => showGuide();
  $('#rHome').onclick = () => { show('v-login'); loadConfig(); };
  $('#rCsv').onclick = () => downloadCsv(`LMT_Day${S.user.day}_${S.user.trainingId}.csv`, S.results.map(r => Object.assign({ Case: r.qNo, CaseId: r.caseId, Property: r.hotel, YourAction: D[r.decision].label, CorrectAction: D[r.expectedDecision].label, ActionCorrect: r.decisionOk, ScoredFieldsCorrect: r.mode === 'decision' ? '' : r.fieldsOk + '/' + r.fieldsN, Points: r.points, TimeSec: r.timeSec, XP: r.xp }, Object.fromEntries(ENTRY_FIELDS.map(([, label, col]) => [label, (r.entryCols || {})[col] || ''])))));
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
    const t = e.target, cs = S.cs;
    if (t.dataset.alias !== undefined) { const a = cs.aliases[+t.dataset.alias]; if (a) a.name = t.value; cs.applied.internal = false; refreshApplyBtn('internal'); return; }
    if (t.id === 'alNew') { cs.aliasDraft = t.value; return; }
    if (t.id === 'parentShow') {
      cs.parentQ = t.value;
      if (cs.f.parent && t.value !== geoTplLabel(cs.f.parent)) {
        cs.f.parent = ''; t.classList.remove('ok');
        const m = pane.querySelector('[data-msg="parent"]'); if (m) m.textContent = 'Please search for and select a parent';
      }
      closeParentDrop(); return;
    }
    const k = t.dataset.f; if (!k) return;
    if (['provAttr', 'provExp', 'internal'].includes(k)) { cs.applied.internal = false; refreshApplyBtn('internal'); }
    S.cs.f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (['name', 'type'].includes(k)) {
      e.target.classList.toggle('invalid', !e.target.value);
      const m = pane.querySelector(`[data-msg="${k}"]`); if (m) m.textContent = e.target.value ? '' : (k === 'name' ? 'Please provide a name' : 'Please select an accommodation type');
    }
    if (k === 'lat' || k === 'lng') { S.cs.applied.geo = false; refreshApplyBtn('geo'); }
  });
  pane.addEventListener('change', e => {
    if (e.target.dataset.aliass !== undefined) { const a = S.cs.aliases[+e.target.dataset.aliass]; if (a) a.searchable = e.target.checked; S.cs.applied.internal = false; refreshApplyBtn('internal'); return; }
    if (e.target.id === 'alNewS') { S.cs.aliasDraftS = e.target.checked; return; }
    if (e.target.id === 'provExp' && !e.target.value) e.target.type = 'text';
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
    else if (d.parent) searchParent();
    else if (d.pre) { if (d.pre === 'alias') linkAsAlias(); else linkAsNew(); }
    else if (d.openprov) openProvider();
    else if (d.thumb) { cs.f.thumb = d.thumb; $$('.thumb').forEach(x => x.classList.toggle('sel', x === t)); $('#thumbTxt').textContent = 'Selected: ' + d.thumb; }
    else if (d.inert) toast('Linked locations are not used in this training');
    else if (d.aldel !== undefined) { cs.aliases.splice(+d.aldel, 1); cs.applied.internal = false; rerenderKeepScroll(); }
    else if (d.aladd) {
      const v = (cs.aliasDraft || '').trim(); if (!v) return toast('Type the alias first');
      if (cs.aliases.some(a => norm(a.name) === norm(v))) return toast('That alias is already listed');
      cs.aliases.push({ name: v, searchable: !!cs.aliasDraftS }); cs.aliasDraft = ''; cs.aliasDraftS = false; cs.applied.internal = false; rerenderKeepScroll();
    }
    else if (d.cal) { const inp = $('#provExp'); if (!inp) return; inp.type = 'date'; inp.focus(); try { inp.showPicker && inp.showPicker(); } catch (er) { } }
    else if (t.classList.contains('sec-min')) { const sec = t.closest('.sec'); sec.querySelectorAll('.lrow,table,.votes-search,#map,.geo-inputs').forEach(x => x.classList.toggle('hidden')); t.textContent = t.textContent === '-' ? '+' : '-'; if (sec.id === 'sec-geo' && S.map) setTimeout(() => S.map && S.map.invalidateSize(), 50); }
    else if (t.id === 'geoGo') moveMarker();
    else if (t.id === 'geoReset') { cs.f.lat = String(c.feed.lat); cs.f.lng = String(c.feed.lng); $('#geoLat').value = cs.f.lat; $('#geoLng').value = cs.f.lng; cs.applied.geo = false; refreshApplyBtn('geo'); moveMarker(); }
    else if (t.id === 'geoPaste') {
      const v = prompt('Paste coordinates as "lat, lng" (e.g. copied from Google Maps):', ''); if (!v) return;
      const m = v.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/); if (!m) return toast('⚠ Could not read coordinates');
      cs.f.lat = m[1]; cs.f.lng = m[2]; $('#geoLat').value = m[1]; $('#geoLng').value = m[2]; cs.applied.geo = false; refreshApplyBtn('geo'); moveMarker();
    }
  });
  $('#navList').addEventListener('click', e => {
    const s = e.target.closest('[data-jump]'); if (!s) return;
    if (!s.dataset.jump) return toast('This section is not part of Places new-listing training');
    if (isHiddenSec(s.dataset.jump.replace('sec-', ''))) return toast('👁 ' + s.textContent + ' is hidden — click Show All Fields first', 2600);
    jumpTo(s.dataset.jump);
  });
  pane.addEventListener('focusin', e => { if (e.target.id === 'provExp') e.target.type = 'date'; });
  pane.addEventListener('focusout', e => { if (e.target.id === 'provExp' && !e.target.value) e.target.type = 'text'; });
  pane.addEventListener('keydown', e => {
    if (e.target.id === 'alNew' && e.key === 'Enter') { e.preventDefault(); const b = pane.querySelector('[data-aladd]'); if (b) b.click(); }
    if (e.target.id === 'parentShow') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (moveParentActive(e.key === 'ArrowDown' ? 1 : -1)) e.preventDefault(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const d = $('#parentDrop'), act = d && !d.classList.contains('hidden') ? $$('#parentDrop .parent-res')[+d.dataset.active] : null;
        if (act) act.click(); else searchParent();
      } else if (e.key === 'Escape') closeParentDrop();
    }
  });
  $('#btnTakeAction').onclick = () => openDecision(S.cs.pre || '');
  $('#hudExit').onclick = () => { generic('Exit mission?', '<p>Your progress on this day will be lost. Results are only saved after the last case.</p>', '<button class="btn btn-ghost" data-close="mGeneric">Stay</button><button class="btn btn-danger" id="exitYes">Exit to login</button>'); $('#exitYes').onclick = () => { closeModal('mGeneric'); clearInterval(S.timer); show('v-login'); }; };
  $('#btnNoMatch').onclick = linkAsNew;
  $('#btnHelpful').onclick = () => $('#helpfulMenu').classList.toggle('hidden');
  renderHelpful();
  $('#helpfulMenu').addEventListener('click', e => { const t = e.target.closest('[data-link]'); if (t) { $('#helpfulMenu').classList.add('hidden'); helpfulLink(+t.dataset.link); } });
  $('#btnHideFields').onclick = toggleFields;
  $('#btnApplyAll').onclick = () => {
    const secs = ['basic', 'contact', 'desc', 'photos', 'accom', 'internal', 'geo'].filter(s => !isHiddenSec(s));
    const res = secs.map(s => applySection(s, true)), hidden = Object.keys(HIDDEN_SECTIONS).filter(isHiddenSec).length;
    toast(!res.every(Boolean) ? '⚠ Some sections need fixing — check the red messages' : hidden ? `✔ Visible sections applied · ${hidden} hidden sections skipped — click Show All Fields` : '✔ All sections applied', 3200);
  };
  $$('[data-audit]').forEach(b => b.onclick = () => openAudit(b.dataset.audit));
  $$('[data-nav]').forEach(n => n.onclick = () => {
    const k = n.dataset.nav;
    if (k === 'search') { const i = APP_CONFIG.HELPFUL_LINKS.findIndex(l => /tripadvisor/i.test(l.label)); helpfulLink(i < 0 ? 0 : i); }
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
    if (a === 'reject') return toggleRejectMenu(b);
    if (a === 'approve') return openDecision(S.cs.pre === 'alias' ? 'alias' : 'approve');
    openDecision(a === 'escalate' ? 't1' : a);
  });
  // Reject menu (same reasons and order as the live LMT)
  $('#rejMenu').addEventListener('click', e => { const t = e.target.closest('[data-rej-reason]'); if (t) submitReject(t.dataset.rejReason); });
  document.addEventListener('mousedown', e => { if (!e.target.closest('.pb-wrap') && !e.target.closest('[data-parent]')) closeParentDrop(); });
  document.addEventListener('mousedown', e => { const m = $('#rejMenu'); if (m && !m.classList.contains('hidden') && !e.target.closest('#rejMenu') && !e.target.closest('.abtn[data-act="reject"]')) m.classList.add('hidden'); });
  $$('.lbtn').forEach(b => b.onclick = () => {
    const k = b.dataset.lb;
    if (k === 'B') jumpTo('sec-basic');
    else if (k === 'C') jumpTo('sec-contact');
    else if (k === 'L') { const f = S.cs.f; generic('📄 Location summary (your current values)', `<table class="fb-tbl">${[['Name', f.name], ['Brand', f.brand], ['Street One', f.street], ['Street Two', f.street2], ['Postal', f.postal], ['Parent', geoTplLabel(f.parent)], ['Phone', f.phone], ['Email', f.email], ['URL', f.url], ['Type', f.type], ['Rooms', f.rooms], ['Floors', f.floors], ['Opening', f.opening], ['All-inclusive', f.allIncl ? 'Yes' : 'No'], ['Lat/Lng', f.lat + ', ' + f.lng]].map(([l, v]) => `<tr><td style="width:150px"><b>${l}</b></td><td>${esc(v || '—')}</td></tr>`).join('')}</table>`); }
    else if (k === 'LN') { generic('📝 Location notes', `<textarea class="mtext" id="lnText" style="min-height:140px" placeholder="Your research notes and links — these pre-fill the notes in the action dialog.">${esc(S.cs.notes)}</textarea>`, '<button class="btn btn-pri" id="lnSave">Save notes</button>'); $('#lnSave').onclick = () => { S.cs.notes = $('#lnText').value; closeModal('mGeneric'); toast('📝 Notes saved'); }; }
  });
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]'); if (c) closeModal(c.dataset.close);
    const p = e.target.closest('[data-pick]'); if (p && S.cs) {
      registerGeo(p.dataset.pick);
      S.cs.f.parent = p.dataset.pick; S.cs.parentQ = null; closeParentDrop();
      const ps = $('#parentShow'); if (ps) { ps.value = geoTplLabel(p.dataset.pick); ps.classList.add('ok'); const m = document.querySelector('#sec-basic [data-msg="parent"]'); if (m) m.textContent = ''; }
      toast('Parent selected: ' + geoTplLabel(p.dataset.pick), 2000);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { ['mParent', 'mGeneric', 'mDecision'].forEach(closeModal); $('#rejMenu').classList.add('hidden'); } });
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
      <p style="color:#6b7785;font-size:13px">Trainer tools: results, question bank, sessions, waves, trainers and settings.</p>
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
/* v2.6: everything the agent saved on that question (Question_Log "Entered …" columns) */
function admEntryHtml(q) {
  const rows = ENTRY_FIELDS.filter(([, , col]) => col.startsWith('ent') && q[col] !== undefined && q[col] !== '' && !(col === 'entAllIncl' && q[col] === 'No'))
    .map(([, label, col]) => [label, q[col]]);
  if (q.pinDistM !== undefined && q.pinDistM !== '') rows.push(['Pin distance', q.pinDistM + ' m']);
  if (q.listing) rows.unshift(['Saved as', q.listing]);
  if (!rows.length) return '';
  return `<details class="adm-entry"><summary>📋 Entered fields (${rows.length})</summary><table>${rows.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join('')}</table></details>`;
}
function admAttempt(id) {
  const a = ADM.results.find(r => r.attemptId === id); const qs = ADM.questions.filter(q => q.attemptId === id).sort((x, y) => x.qNo - y.qNo);
  const D = DECISIONS, rl = k => (REASONS[k] ? REASONS[k].label : k || '—');
  generic(`Attempt ${esc(id)}`, `<p><b>${esc(a.name)}</b> (ID ${esc(a.trainingId)}) · ${esc(a.country)} · Trainer ${esc(a.trainer)} · Day ${esc(a.day)} · ${esc(a.accuracy)}% · ${esc(a.xp)} XP<br><span style="color:#6b7785;font-size:12px">Badges: ${esc(a.badges || '—')} · ${esc(a.startedAt)} → ${esc(a.finishedAt)}</span></p>
    <table class="fb-tbl"><tr><th>#</th><th>Property</th><th>Agent action</th><th>Expected</th><th>Reason</th><th>Data</th><th>Score</th><th>Time</th><th>Notes / TA link</th></tr>
    ${qs.map(q => `<tr><td>${q.qNo}</td><td>${esc(q.hotel)}<div style="font-size:11px;color:#888">${esc(q.caseId)}</div></td><td>${D[q.decision] ? D[q.decision].short : esc(q.decision)}</td><td>${D[q.expectedDecision] ? D[q.expectedDecision].short : ''} ${truthy(q.decisionOk) ? '<span class="ok-c">✔</span>' : '<span class="bad-c">✖</span>'}</td>
      <td>${truthy(q.reasonOk) ? '<span class="ok-c">✔</span>' : '<span class="bad-c">✖</span>'} ${esc(rl(q.reason))}</td><td>${esc(q.fieldsPct)}%</td><td><b>${esc(q.score)}</b>${truthy(q.critical) ? ' 🚨' : ''}</td><td>${fmtTime(+q.timeSec || 0)}</td><td style="max-width:240px;word-break:break-word">${esc(q.notes)}${q.match ? `<div style="font-size:11px">🔗 ${esc(q.match)}</div>` : ''}${q.internalComment ? `<div style="font-size:11px">🏷️ Internal: ${esc(q.internalComment)}</div>` : ''}${q.showAll === 'No' ? '<div class="bad-c" style="font-size:11px">👁 Show All Fields not used</div>' : ''}<div style="font-size:10.5px;color:#999">${esc(q.fieldDetail)}</div>${admEntryHtml(q)}</td></tr>`).join('') || '<tr><td colspan="9">No question detail available.</td></tr>'}</table>`,
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
      rows.map(q => `<tr><td><b>${esc(q.id)}</b></td><td>${q.day}</td><td>${q.q}</td><td>${esc(q.feed.name)}</td><td>${esc(first(q.ans.name) || '—')}</td><td style="font-size:11.5px">${esc([].concat(q.ans.parent || []).map(geoTplLabel).join(' / '))}</td>
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
  const groups = [['Question', ['id', 'day', 'q', 'active']], ['What the provider feed sends (Requested Change column)', TPL.filter(t => t[0].startsWith('feed.') || t[0] === 'providerUrl' || t[0] === 'amen').map(t => t[0])],
    ['Correct answer', ['ans.decision', 'ans.reason', 'ans.match', 'listingNow', 'decoy', 'ans.name', 'ans.brand', 'ans.street', 'ans.street2', 'ans.postal', 'parentLabel', 'ans.phone', 'ans.email', 'ans.url', 'ans.type', 'ans.rooms', 'ans.floors', 'ans.opening', 'ans.allIncl', 'ans.lat', 'ans.lng', 'geoTol']],
    ['Internal LMT evidence & coaching', ['votes', 'owners', 'audit', 'tip']]];
  const T = Object.fromEntries(TPL.map(t => [t[0], t]));
  const input = k => {
    const v = r[k] == null ? '' : r[k];
    if (k === 'ans.decision') return `<select data-qf="${k}">${['Approve', 'Alias', 'Reject', 'Escalate', 'Defer'].map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
    if (k === 'active' || k === 'ans.allIncl') return `<select data-qf="${k}">${(k === 'active' ? ['Y', 'N'] : ['', 'Y', 'N']).map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
    if (k === 'ans.reason') return `<input data-qf="${k}" list="dlReasons" value="${esc(v)}">`;
    if (k === 'ans.type' || k === 'feed.type') return `<input data-qf="${k}" list="dlTypes" value="${esc(v)}">`;
    if (k === 'parentLabel') return `<input data-qf="${k}" list="dlGeos" value="${esc(v)}">`;
    if (['tip', 'votes', 'owners', 'audit', 'feed.desc', 'amen'].includes(k)) return `<textarea data-qf="${k}">${esc(v)}</textarea>`;
    return `<input data-qf="${k}" value="${esc(v)}">`;
  };
  generic(q ? (q.custom ? '✏️ Edit question ' + esc(q.id) : '✏️ Edit built-in ' + esc(q.id) + ' (saved as a trainer copy that replaces it)') : '＋ Add question',
    `<datalist id="dlReasons">${Object.values(REASONS).map(x => `<option value="${esc(x.label)}">`).join('')}</datalist>
     <datalist id="dlTypes">${ACCOM_TYPES.concat(['N/A']).map(t => `<option value="${esc(t)}">`).join('')}</datalist>
     <datalist id="dlGeos">${GEOS.filter(g => g.ta).map(g => `<option value="${esc(geoTplLabel(g.id))}">`).join('')}</datalist>
     <p style="font-size:12px;color:#6b7785;margin-top:0">Blank = not scored · <b>BLANK</b> = agent must leave it empty · several accepted answers: separate with <b> | </b>. Hover a label for help.</p>
     <div class="qb-form">${groups.map(([g, keys]) => `<h5>${g}</h5>` + keys.map(k => `<div class="${['tip', 'votes', 'owners', 'audit', 'feed.desc', 'amen'].includes(k) ? 'span3' : ''}"><label title="${esc(T[k][2])}">${esc(T[k][1])}${/Required/.test(T[k][2]) ? ' *' : ''}</label>${input(k)}</div>`).join('')).join('')}</div>
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
  '• For an Alias (possible match / dupe) case, use a property that IS on Tripadvisor and paste its Tripadvisor URL in "Existing Tripadvisor Listing". LMT shows that listing as the possible match with its current values; to make the agent edit something, put the outdated value in "Existing Listing – Current Values" (e.g. type=Hotel).',
  '• To practise "Not match, create new", give a new-property case a "Look-alike Listing" — a similar name in another place.',
  '• For fraud / unverifiable practice, use an invented name and put the evidence in Feed Description, Location Votes, Owners or Audit notes. Never accuse a real business of fraud.',
  '• Re-check your answers a few days before each wave — real phone numbers and websites change.',
  '',
  'FEED COLUMNS (what the provider sent)',
  '• These appear in LMT\'s "Requested Change" column. They can be deliberately wrong (ALL CAPS, wrong postal code, pin in the wrong town) — that is the lesson.',
  '• Feed Latitude / Longitude are required: they are where the map pin starts.',
  '• There are NO feed columns for Phone, Email, URL or Accommodation Type. Agents must research these themselves — still fill the "Correct …" columns so they are scored.',
  '• Provider Amenities (optional) = the clues on the provider page that tell agents the type. Blank = a standard list for the Correct Accommodation Type.',
  '',
  'CORRECT ANSWER COLUMNS (how the agent is scored)',
  '• Leave a cell EMPTY → that field is not scored.',
  '• Type BLANK → the agent must leave that field empty (e.g. no postal code exists, no website).',
  '• Several acceptable answers → separate with space-pipe-space, e.g.  Purok 2, South Poblacion | P-2 South Poblacion',
  '• Phone numbers in international format: +91 487 233 9104.  URLs with https://.',
  '• Correct Parent: the Tripadvisor geo code and nav string, e.g. "297586 - India, Telangana, Hyderabad District, Hyderabad". Just the code works for geos already in the Lists sheet. New geos are added to the Parent search automatically (agents can search them by name or code).',
  '• Correct Latitude / Longitude: copy from Google Maps (right-click the pin → click the numbers). Geo Tolerance (m) = distance for full marks (default 150; use 300–500 for rural places).',
  '',
  'ACTIONS AND REASONS (see the Lists sheet)',
  '• Approve (reason optional) · Alias (reason optional) · Reject · Escalate · Defer — Reject / Escalate / Defer need a reason from the Lists sheet.',
  '• Escalate reasons: Unsure what action to take · Weird case or situation · Conflicting information (such as geo, address).',
  '• Reject reasons are the live LMT list: Page down · Vacation Rental · Single unit property · Cannot verify · Property closed · Property removed from TA · Former name · More than 7 night stay required · Not open to public (restricted access) · Open less than 12 consecutive weeks · Not stationary (cruise) · Incorrect property type (not an accommodation).',
  '• Several accepted reasons: separate with " | ".',
  '',
  'SCORING (10 points per question · 80% needed for the certificate)',
  '• A question earns 10 points only when the action is correct AND every primary field is correct: Property Name, Street One, Geo and URL. Any one of them wrong = 0.',
  '• Only the primary fields you fill in the Correct … columns are checked. Other fields (phone, email, postal code, type, parent…) are not scored.',
  '• Reject / Escalate cases: the action decides. Alias cases: the request must be applied to the right listing, then its Name / Street One / Geo / URL are checked.',
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
  { id: 'EXAMPLE-1', day: 6, q: 1, active: 'Y', 'feed.name': 'SUNRISE HOMESTAY', 'feed.street': 'NEAR BUS STAND', 'feed.postal': '685612', 'feed.parentText': 'IN, Munnar', 'feed.lat': 10.0889, 'feed.lng': 77.0595,
    'ans.decision': 'Approve', 'ans.name': 'Sunrise Homestay', 'ans.street': 'Near KSRTC Bus Stand | Near Bus Stand', 'ans.postal': '685612', parentLabel: '303881 - India, Kerala, Idukki District, Munnar', 'ans.phone': '+91 94460 00000', 'ans.email': 'BLANK', 'ans.url': 'BLANK', 'ans.type': 'Guest House', 'ans.rooms': 5, 'ans.lat': 10.0889, 'ans.lng': 77.0595, geoTol: 300,
    tip: 'Feed was ALL CAPS. The phone is not in the feed, so the agent finds it online. No website or email exists, so both stay blank.' },
  { id: 'EXAMPLE-2', day: 6, q: 2, active: 'Y', 'feed.name': 'Paradise Beach Villas', 'feed.parentText': 'IN, Goa', 'feed.lat': 15.55, 'feed.lng': 73.75, 'feed.desc': 'Pay 100% advance by UPI to confirm. No cash at check-in.',
    'ans.decision': 'Escalate', 'ans.reason': 'Weird case or situation', parentLabel: 'India, Goa, North Goa District, Candolim', 'ans.lat': 15.518, 'ans.lng': 73.762,
    votes: 'Scam: paid advance, property does not exist ;; Scam: number switched off after payment', tip: 'Advance payment to a personal account plus scam reports = Escalate, never a simple reject.' },
  { id: 'EXAMPLE-3', day: 6, q: 3, active: 'Y', 'feed.name': 'Kumarakom Lake Resort & Ayurveda Spa', 'feed.parentText': 'IN, Kumarakom', 'feed.lat': 9.6176, 'feed.lng': 76.4278,
    'ans.decision': 'Alias', 'ans.match': 'https://www.tripadvisor.com/Hotel_Review-d302893', listingNow: 'type=Hotel', 'ans.name': 'Kumarakom Lake Resort', parentLabel: '678552',
    'ans.type': 'Resort', 'ans.lat': 9.6176, 'ans.lng': 76.4278, tip: 'The possible match is the existing listing → Add name as alias. The listing says Hotel but it is a resort → edit the type as per sources.' }
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
    const reasons = Object.values(REASONS).map(r => DECISIONS[r.d].short + ' → ' + r.label), geos = GEOS.filter(x => x.ta).map(x => geoTplLabel(x.id));
    const types = ACCOM_TYPES.concat(['N/A']), acts = ['Approve', 'Alias', 'Reject', 'Escalate', 'Defer'];
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
  const ignoredCols = ['Feed Phone', 'Feed Fax', 'Feed Email', 'Feed URL', 'Feed Accommodation Type'].filter(h => hdr.includes(h.toLowerCase()));
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
     ${ignoredCols.length ? `<div class="infobox">Old template detected — these columns are ignored because agents now research them online: <b>${esc(ignoredCols.join(', '))}</b>. Keep the answers in the "Correct …" columns.</div>` : ''}
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
  ADM.questions.forEach(q => { const o = by[q.caseId] = by[q.caseId] || { n: 0, ok: 0, score: 0, time: 0, crit: 0, wrong: {}, sa: 0, saN: 0 }; o.n++; if (q.showAll === 'Yes' || q.showAll === 'No') { o.saN++; if (q.showAll === 'Yes') o.sa++; } o.ok += truthy(q.decisionOk) ? 1 : 0; o.score += +q.score || 0; o.time += +q.timeSec || 0; o.crit += truthy(q.critical) ? 1 : 0; if (!truthy(q.decisionOk)) o.wrong[q.decision] = (o.wrong[q.decision] || 0) + 1; });
  b.innerHTML = `<p style="font-size:13px;color:#6b7785;margin-top:0">How each case performs across all agents — use it to find the concepts that need re-training.</p><div class="tbl-card" style="margin-top:0"><table class="rtbl"><thead><tr><th>Case</th><th>Day</th><th>Property</th><th>Correct action</th><th>Attempts</th><th>Action accuracy</th><th>Avg score</th><th>Avg time</th><th>Most common wrong action</th><th title="Agents who clicked Show All Fields">👁 Show All</th><th>🚨</th></tr></thead><tbody>
    ${allQuestions().map(c => { const o = by[c.id]; const pct = o ? Math.round(o.ok / o.n * 100) : null; const w = o ? Object.entries(o.wrong).sort((x, y) => y[1] - x[1])[0] : null;
      return `<tr><td>${esc(c.id)}</td><td>${c.day}</td><td>${esc(first(c.ans.name) || c.feed.name)}</td><td>${DECISIONS[c.ans.decision].icon} ${DECISIONS[c.ans.decision].short}</td><td>${o ? o.n : 0}</td>
      <td>${pct == null ? '—' : `<div style="display:flex;align-items:center;gap:6px"><div style="width:80px;height:8px;background:#eee;border-radius:9px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)'}"></div></div>${pct}%</div>`}</td>
      <td>${o ? Math.round(o.score / o.n) : '—'}</td><td>${o ? fmtTime(o.time / o.n) : '—'}</td><td>${w && DECISIONS[w[0]] ? DECISIONS[w[0]].short + ' (' + w[1] + ')' : '—'}</td><td>${o && o.saN ? Math.round(o.sa / o.saN * 100) + '%' : '—'}</td><td>${o ? o.crit : 0}</td></tr>`; }).join('')}</tbody></table></div>`;
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
  const days = availableDays(), dayOpts = days.map(d => `<option value="${d}">Day ${d} - ${esc(dayMeta(d).title)}</option>`).join('');
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
    <div class="cfg-card"><h4>⏳ Sync</h4><p style="font-size:13px">Google Sheet: ${API.configured() ? (ADM.online ? '<b style="color:var(--ok)">✅ connected</b>' : '<b style="color:var(--bad)">⚠ not reachable right now</b>') : '<b>offline mode</b> (no Sheet set in script.js)'}</p><p style="font-size:13px">${pend} attempt(s) waiting to upload from this browser.</p><button class="btn btn-ghost btn-sm" id="setSync" ${pend ? '' : 'disabled'}>Sync now</button>
      ${!ADM.online && CFG.questions.length && API.configured() ? `<h4 style="margin-top:18px">📤 Local questions</h4><p style="font-size:12.5px">${CFG.questions.length} question(s) were added offline in this browser. Log in again while connected and re-upload them via Export → Upload.</p>` : ''}
      <h4 style="margin-top:18px">🧹 Local data</h4><p style="font-size:12.5px;color:#6b7785">Removes attempts, XP profiles, offline questions and settings stored in <b>this browser only</b>. Google Sheet data is not touched.</p><button class="btn btn-danger btn-sm" id="setWipe">Clear this browser's data</button></div>
    <div class="cfg-card"><h4>🔑 Admin password</h4>${ADM.online ? `<div class="cfg-form"><input type="password" id="np1" placeholder="New password (min 8)"><input type="password" id="np2" placeholder="Repeat"><button class="btn btn-pri btn-sm" id="npSave">Change</button></div><p style="font-size:12px;color:#6b7785">Stored in the Apps Script project's Script Properties.</p>`
      : `<p style="font-size:12.5px;color:#6b7785">The offline password is the SHA-256 value in <code>APP_CONFIG.OFFLINE_ADMIN_SHA256</code> in script.js (see the setup guide). Once a Sheet is connected, the Sheet password is used instead.</p>`}</div>
    <div class="cfg-card"><h4>ℹ️ About</h4><p style="font-size:12.5px;line-height:1.6">LMT Places Simulator v${APP_CONFIG.VERSION} · ${allQuestions().length} questions (${CASES.length} built-in) · pass mark ${APP_CONFIG.PASS_MARK}%.</p></div></div>`;
  $('#setSync').onclick = async () => { await flushPending(); renderAdmin(); toast('Sync finished'); };
  $('#setWipe').onclick = () => { if (!confirm('Clear all simulator data stored in this browser?')) return; ['lmt_attempts', 'lmt_pending', 'lmt_cfg_local', 'lmt_cfg_cache', 'lmt_last_login', 'lmt_questions_local', 'lmt_builtin_off_local'].forEach(LS.del); try { Object.keys(localStorage).filter(k => k.startsWith('lmt_profile_')).forEach(k => localStorage.removeItem(k)); } catch (e) { } toast('Browser data cleared'); loadConfig().then(() => fetchAdminData()).then(renderAdmin); };
  if ($('#npSave')) $('#npSave').onclick = async () => { const a = $('#np1').value, b2 = $('#np2').value; if (a.length < 8) return toast('Min 8 characters'); if (a !== b2) return toast('Passwords do not match'); try { await API.call({ action: 'changePassword', token: ADM.token, newPassword: a }); toast('Password changed'); $('#np1').value = $('#np2').value = ''; } catch (e) { toast('⚠ ' + e.message); } };
}

/* =====================================================================
   BOOT
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => { bindLogin(); bindGame(); loadConfig(); });
