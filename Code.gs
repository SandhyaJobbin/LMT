/**
 * =====================================================================
 *  LMT PLACES SIMULATOR — Google Sheets connector (Google Apps Script)
 * ---------------------------------------------------------------------
 *  This script does NOT host the simulator. The simulator is the plain
 *  index.html / style.css / data.js / script.js files. This script only
 *  receives results from those files and writes them into this Google
 *  Sheet, and lets the Admin Portal read them back.
 *
 *  SETUP (once):
 *   1. Create a Google Sheet → Extensions → Apps Script → paste this file.
 *   2. Run  setup()  once (Run ▶, accept permissions). It creates the tabs.
 *   3. Deploy → New deployment → type "Web app"
 *        Execute as: Me      Who has access: Anyone
 *      Copy the URL ending in /exec → paste into script.js (WEB_APP_URL)
 *      or Admin Portal → Settings.
 *   4. Admin password: Trainor123Password (change it in Admin → Settings,
 *      or run resetAdminPassword() here to go back to it).
 *   After editing this script: Deploy → Manage deployments → Edit → Version: New.
 * =====================================================================
 */

const TAB = {
  RESULTS: 'Results', QLOG: 'Question_Log', TRAINERS: 'Trainers',
  COUNTRIES: 'Countries', WAVES: 'Waves', SESSIONS: 'Sessions', QUESTIONS: 'Questions', BUILTIN: 'Builtin_Status', AUDIT: 'Admin_Audit'
};

/* key (used by the browser)  →  column header (shown in the Sheet) */
const COLS = {
  Results: [
    ['timestamp', 'Timestamp'], ['attemptId', 'Attempt ID'], ['trainingId', 'Training ID'], ['name', 'Display Name'],
    ['country', 'Country'], ['trainer', 'Trainer'], ['wave', 'Wave Code'], ['session', 'Session ID'], ['day', 'Day'],
    ['attemptNo', 'Attempt #'], ['startedAt', 'Started At'], ['finishedAt', 'Finished At'], ['durationSec', 'Duration (sec)'],
    ['questions', 'Questions'], ['correctDecisions', 'Correct Actions'], ['accuracy', 'Accuracy %'], ['totalScore', 'Total Score'],
    ['maxScore', 'Max Score'], ['xp', 'XP'], ['level', 'Level'], ['passed', 'Passed'], ['badges', 'Badges'],
    ['criticalErrors', 'Critical Errors']
  ],
  Question_Log: [
    ['timestamp', 'Timestamp'], ['attemptId', 'Attempt ID'], ['trainingId', 'Training ID'], ['name', 'Display Name'],
    ['trainer', 'Trainer'], ['wave', 'Wave Code'], ['day', 'Day'], ['qNo', 'Q#'], ['caseId', 'Case ID'], ['hotel', 'Property'],
    ['expectedDecision', 'Expected Action'], ['decision', 'Agent Action'], ['decisionOk', 'Action Correct'],
    ['expectedReason', 'Expected Reason'], ['reason', 'Agent Reason'], ['reasonOk', 'Reason Correct'], ['match', 'Matched Listing'],
    ['fieldsPct', 'Field Accuracy %'], ['score', 'Score'], ['xp', 'XP'], ['timeSec', 'Time (sec)'],
    ['critical', 'Critical Error'], ['notes', 'Agent Notes'], ['fieldDetail', 'Field Detail']
  ],
  Trainers: [['name', 'Trainer Name'], ['active', 'Active']],
  Countries: [['name', 'Country'], ['active', 'Active']],
  Waves: [['code', 'Wave Code'], ['name', 'Wave Name'], ['trainer', 'Trainer'], ['days', 'Unlocked Days'], ['active', 'Active'], ['createdAt', 'Created At']],
  Questions: [['id', 'Case ID'], ['day', 'Day'], ['q', 'Q#'], ['active', 'Active'], ['feedName', 'Feed Name'], ['decision', 'Correct Action'], ['json', 'Question Data (JSON – edit in the simulator, not here)'], ['updatedAt', 'Updated At']],
  Builtin_Status: [['id', 'Built-in Case ID'], ['active', 'Active']],
  Sessions: [['id', 'Session ID'], ['name', 'Session Name'], ['trainer', 'Trainer'], ['day', 'Day'], ['wave', 'Wave Code'], ['active', 'Active'], ['createdAt', 'Created At']],
  Admin_Audit: [['timestamp', 'Timestamp'], ['action', 'Action'], ['detail', 'Detail']]
};
const KIND_TAB = { trainer: [TAB.TRAINERS, 'name'], country: [TAB.COUNTRIES, 'name'], wave: [TAB.WAVES, 'code'], session: [TAB.SESSIONS, 'id'] };
const DEFAULT_PASSWORD = 'Trainor123Password';
const TOKEN_TTL = 6 * 60 * 60; // 6 hours
const COUNTRIES = ['India', 'Philippines', 'Malaysia', 'Sri Lanka', 'Bangladesh', 'Nepal', 'Pakistan', 'Indonesia', 'Vietnam', 'Thailand',
  'Singapore', 'China', 'Japan', 'South Korea', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Egypt', 'Morocco', 'South Africa',
  'Kenya', 'Nigeria', 'Ghana', 'Bulgaria', 'Romania', 'Poland', 'Hungary', 'Czech Republic', 'Greece', 'Portugal', 'Spain', 'Italy', 'France',
  'Germany', 'Netherlands', 'Ireland', 'United Kingdom', 'United States', 'Canada', 'Mexico', 'Jamaica', 'Dominican Republic', 'Colombia',
  'Brazil', 'Argentina', 'Peru', 'Chile', 'Australia', 'New Zealand', 'Other'];

/* ---------------- one-time setup ---------------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  Object.keys(COLS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      const hdr = COLS[name].map(function (c) { return c[1]; });
      sh.getRange(1, 1, 1, hdr.length).setValues([hdr]).setFontWeight('bold').setBackground('#00aa6c').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  });
  if (rows_(TAB.TRAINERS).length === 0) append_(TAB.TRAINERS, [{ name: 'Jack Sparrow', active: true }]);
  if (rows_(TAB.COUNTRIES).length === 0) append_(TAB.COUNTRIES, COUNTRIES.map(function (c) { return { name: c, active: true }; }));
  if (rows_(TAB.WAVES).length === 0) append_(TAB.WAVES, [{ code: 'PLACES-W1', name: 'Places New Hire Wave 1', trainer: 'Jack Sparrow', days: '1,2,3,4,5', active: true, createdAt: new Date().toISOString() }]);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PASSWORD')) props.setProperty('ADMIN_PASSWORD', DEFAULT_PASSWORD);
  const def = ss.getSheetByName('Sheet1'); if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  Logger.log('Setup complete. Now Deploy → New deployment → Web app (Execute as Me, Access: Anyone).');
}

/* ---------------- HTTP entry points ---------------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.action) p.action = 'ping';
  return out_(route_(p));
}
function doPost(e) {
  let p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return out_({ ok: false, error: 'Invalid JSON' }); }
  return out_(route_(p));
}
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function route_(p) {
  try {
    switch (p.action) {
      case 'ping': return { ok: true, time: new Date().toISOString(), sheet: ss_().getName() };
      case 'getConfig': return { ok: true, config: getConfig_() };
      case 'submitAttempt': return submitAttempt_(p.attempt, p.questions);
      case 'adminLogin': return adminLogin_(p.password);
      case 'getResults': auth_(p.token); return { ok: true, results: rows_(TAB.RESULTS), questions: rows_(TAB.QLOG) };
      case 'upsertConfig': auth_(p.token); return upsertConfig_(p.kind, p.item);
      case 'deleteConfig': auth_(p.token); return deleteConfig_(p.kind, p.key);
      case 'deleteAttempt': auth_(p.token); return deleteAttempt_(p.attemptId);
      case 'changePassword': auth_(p.token); return changePassword_(p.newPassword);
      case 'saveQuestions': auth_(p.token); return saveQuestions_(p.items);
      case 'deleteQuestion': auth_(p.token); return deleteQuestion_(p.id);
      case 'setBuiltin': auth_(p.token); return setBuiltin_(p.id, p.active);
      default: return { ok: false, error: 'Unknown action: ' + p.action };
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/* ---------------- sheet helpers ---------------- */
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" not found — run setup() in the script editor.');
  return sh;
}
function rows_(name) {
  const sh = ss_().getSheetByName(name); if (!sh || sh.getLastRow() < 2) return [];
  const cols = COLS[name], data = sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues();
  return data.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    const o = {}; cols.forEach(function (c, i) { o[c[0]] = r[i] instanceof Date ? r[i].toISOString() : r[i]; }); return o;
  });
}
function toRow_(name, obj) {
  return COLS[name].map(function (c) {
    const v = obj[c[0]];
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string' && /^[=+\-@]/.test(v) && c[0] !== 'level') return "'" + v; // block formula injection
    return v;
  });
}
function append_(name, objs) {
  if (!objs.length) return;
  const sh = sheet_(name), vals = objs.map(function (o) { return toRow_(name, o); });
  sh.getRange(sh.getLastRow() + 1, 1, vals.length, vals[0].length).setValues(vals);
}
function findRow_(name, key, val) {
  const sh = sheet_(name); if (sh.getLastRow() < 2) return -1;
  const idx = COLS[name].map(function (c) { return c[0]; }).indexOf(key) + 1;
  const vals = sh.getRange(2, idx, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(val)) return i + 2;
  return -1;
}
function audit_(action, detail) {
  try { append_(TAB.AUDIT, [{ timestamp: new Date().toISOString(), action: action, detail: detail }]); } catch (e) { }
}
function truthy_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === 'Yes'; }
function clean_(v, max) { return String(v == null ? '' : v).slice(0, max || 500); }

/* ---------------- public actions ---------------- */
function getConfig_() {
  return {
    trainers: rows_(TAB.TRAINERS).map(function (r) { return { name: r.name, active: truthy_(r.active) }; }),
    countries: rows_(TAB.COUNTRIES).map(function (r) { return { name: r.name, active: truthy_(r.active) }; }),
    waves: rows_(TAB.WAVES).map(function (r) { return { code: r.code, name: r.name, trainer: r.trainer, days: String(r.days), active: truthy_(r.active), createdAt: r.createdAt }; }),
    sessions: rows_(TAB.SESSIONS).map(function (r) { return { id: r.id, name: r.name, trainer: r.trainer, day: Number(r.day), wave: r.wave, active: truthy_(r.active), createdAt: r.createdAt }; }),
    questions: rows_(TAB.QUESTIONS).map(function (r) { try { const q = JSON.parse(r.json); q.active = truthy_(r.active); return q; } catch (e) { return null; } }).filter(function (q) { return q; }),
    builtinOff: rows_(TAB.BUILTIN).filter(function (r) { return !truthy_(r.active); }).map(function (r) { return String(r.id); })
  };
}

function submitAttempt_(a, qs) {
  if (!a || !a.attemptId || !a.trainingId) throw new Error('Missing attempt data');
  qs = Array.isArray(qs) ? qs.slice(0, 50) : [];
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (findRow_(TAB.RESULTS, 'attemptId', a.attemptId) > -1) return { ok: true, duplicate: true }; // idempotent retries
    const prev = rows_(TAB.RESULTS).filter(function (r) { return String(r.trainingId) === String(a.trainingId) && String(r.day) === String(a.day); }).length;
    a.attemptNo = prev + 1;
    a.timestamp = new Date().toISOString();
    ['name', 'country', 'trainer', 'wave', 'session', 'badges', 'level'].forEach(function (k) { a[k] = clean_(a[k], 120); });
    append_(TAB.RESULTS, [a]);
    append_(TAB.QLOG, qs.map(function (q) { q.timestamp = a.timestamp; q.notes = clean_(q.notes, 1000); q.fieldDetail = clean_(q.fieldDetail, 1000); return q; }));
    return { ok: true, attemptNo: a.attemptNo };
  } finally { lock.releaseLock(); }
}

/* ---------------- admin ---------------- */
function adminLogin_(password) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || DEFAULT_PASSWORD;
  if (String(password) !== real) { Utilities.sleep(800); throw new Error('Incorrect password'); }
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('tok_' + token, '1', TOKEN_TTL);
  audit_('adminLogin', 'ok');
  return { ok: true, token: token };
}
function auth_(token) {
  if (!token || !CacheService.getScriptCache().get('tok_' + token)) throw new Error('Admin token expired – log in again');
}
function upsertConfig_(kind, item) {
  const m = KIND_TAB[kind]; if (!m || !item) throw new Error('Bad config request');
  const tab = m[0], key = m[1];
  if (!item[key]) throw new Error('Missing ' + key);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const r = findRow_(tab, key, item[key]);
    if (r > -1) {
      const cur = {}; const vals = sheet_(tab).getRange(r, 1, 1, COLS[tab].length).getValues()[0];
      COLS[tab].forEach(function (c, i) { cur[c[0]] = vals[i]; });
      Object.keys(item).forEach(function (k) { cur[k] = item[k]; });
      sheet_(tab).getRange(r, 1, 1, COLS[tab].length).setValues([toRow_(tab, cur)]);
    } else append_(tab, [item]);
    audit_('upsert ' + kind, item[key]);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
function deleteConfig_(kind, keyVal) {
  const m = KIND_TAB[kind]; if (!m) throw new Error('Bad config request');
  const r = findRow_(m[0], m[1], keyVal); if (r > -1) sheet_(m[0]).deleteRow(r);
  audit_('delete ' + kind, keyVal);
  return { ok: true };
}
function deleteAttempt_(id) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const r = findRow_(TAB.RESULTS, 'attemptId', id); if (r > -1) sheet_(TAB.RESULTS).deleteRow(r);
    const sh = sheet_(TAB.QLOG);
    if (sh.getLastRow() > 1) {
      const vals = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
      for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]) === String(id)) sh.deleteRow(i + 2);
    }
    audit_('deleteAttempt', id);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
/* ---------------- question bank ---------------- */
function saveQuestions_(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('No questions to save');
  if (items.length > 500) throw new Error('Upload at most 500 questions at a time');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = sheet_(TAB.QUESTIONS), add = [];
    items.forEach(function (q) {
      if (!q || !q.id || !q.feed || !q.ans) throw new Error('Invalid question data');
      const json = JSON.stringify(q);
      if (json.length > 45000) throw new Error('Question ' + q.id + ' is too large');
      const row = { id: String(q.id), day: q.day, q: q.q, active: q.active !== false, feedName: clean_(q.feed.name, 200), decision: q.ans.decision, json: json, updatedAt: new Date().toISOString() };
      const r = findRow_(TAB.QUESTIONS, 'id', q.id);
      if (r > -1) sh.getRange(r, 1, 1, COLS.Questions.length).setValues([toRow_(TAB.QUESTIONS, row)]); else add.push(row);
    });
    append_(TAB.QUESTIONS, add);
    audit_('saveQuestions', items.length + ' question(s)');
    return { ok: true, saved: items.length };
  } finally { lock.releaseLock(); }
}
function deleteQuestion_(id) {
  const r = findRow_(TAB.QUESTIONS, 'id', id); if (r > -1) sheet_(TAB.QUESTIONS).deleteRow(r);
  audit_('deleteQuestion', id);
  return { ok: true };
}
function setBuiltin_(id, active) {
  const r = findRow_(TAB.BUILTIN, 'id', id), row = { id: String(id), active: !!active };
  if (r > -1) sheet_(TAB.BUILTIN).getRange(r, 1, 1, 2).setValues([toRow_(TAB.BUILTIN, row)]); else append_(TAB.BUILTIN, [row]);
  audit_('setBuiltin', id + ' → ' + (active ? 'on' : 'off'));
  return { ok: true };
}
/* Run this from the editor if you ever forget the admin password */
function resetAdminPassword() {
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', DEFAULT_PASSWORD);
  Logger.log('Admin password reset to the default.');
}

function changePassword_(pw) {
  if (!pw || String(pw).length < 8) throw new Error('Password must be at least 8 characters');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', String(pw));
  audit_('changePassword', 'ok');
  return { ok: true };
}
