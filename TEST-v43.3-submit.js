// v43.3 (submit) — run: node TEST-v43.3-submit.js  (cwd = the v43.3 folder)
// SUBMIT TAHAN-KONEKSI-LAMBAT (9 Nov 2026 ~11:3x WIB): user main FREE,
// skor 125515 (NEW HIGH SCORE lokal, +4284 XP), submit TIDAK PERNAH sampai
// ke server (verify_queue kosong, board FREE tetap 36115) — koneksi 5 K/s,
// POST /scores timeout 30 dtk + SATU retry tidak cukup, replay hilang dari
// layar. Skor lokal aman tapi user mengira hilang.
// v43.3: replay disimpan di localStorage (sqk43:pending) SEBELUM kirim;
// retry otomatis (timeout 60 dtk, hingga 4 percobaan, jeda 10/30/60 dtk);
// flush antrean di latar (berkala + saat halaman dibuka + tab LEAGUE +
// saat online); status jelas MENGIRIM… / GAGAL — TAP UNTUK COBA LAGI /
// TERKIRIM ✓; board gagal muat = pesan + tombol muat ulang.
// Format replay / engine / judgement / Worker TIDAK berubah.
const fs = require('fs');
const SqueekEngine = require('./engine.js');
const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
const jsLines = js.split('\n');
const golden = JSON.parse(fs.readFileSync('TEST-v40-golden-charts.json', 'utf8'));

let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function constObjSrc(lines, name) {
  const start = lines.findIndex(l => l.startsWith('const ' + name + ' = {'));
  if (start < 0) throw new Error('const not found: ' + name);
  let end = start;
  for (let i = start + 1; i < lines.length; i++) { if (lines[i] === '};') { end = i; break; } }
  return lines.slice(start, end + 1).join('\n');
}
function mockClassList() {
  const set = new Set();
  return {
    toggle(cls, force) { if (force === undefined) { if (set.has(cls)) set.delete(cls); else set.add(cls); } else if (force) set.add(cls); else set.delete(cls); },
    add(cls) { set.add(cls); }, remove(cls) { set.delete(cls); },
    contains(cls) { return set.has(cls); },
  };
}

const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
const HASH = '0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890';
const isAddrStub = s => /^0x[a-fA-F0-9]{40}$/.test(s || '');
const escHtmlStub = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// --- scripted mock tfetch (POST queue + verify queue + board) ---
let postScript = [];
let verifyScript = [];
let boardScript = 'ok'; // 'ok' | 'fail'
const tfetchCalls = [];
function resetTfetch() { postScript = []; verifyScript = []; boardScript = 'ok'; tfetchCalls.length = 0; }
async function mockTfetch(url, opt, ms) {
  tfetchCalls.push({ url, opt, ms });
  if (url.includes('/scores') && opt && opt.method === 'POST') {
    const next = postScript.shift();
    if (next === undefined) throw new Error('no scripted POST response left');
    if (next instanceof Error) throw next;
    return next;
  }
  if (url.includes('/verify?replayHash=')) {
    const next = verifyScript.shift();
    if (next === undefined) return { status: 202, ok: true, json: async () => ({}) };
    if (next instanceof Error) throw next;
    return next;
  }
  if (url.includes('/scores?mode=')) {
    if (boardScript === 'fail') throw new Error('offline');
    return { status: 200, ok: true, json: async () => ({ scores: [{ rank: 1, name: 'yui', wallet: ADDR, score: 125515, acc: 76.5, verified: 1 }] }) };
  }
  if (url.includes('/rank?wallet=')) {
    return { status: 200, ok: true, json: async () => ({ rank: 1, total: 2 }) };
  }
  throw new Error('unexpected tfetch url: ' + url);
}
const okSignature = (hash) => ({ status: 200, ok: true, json: async () => ({ ok: true, improved: true, signature: '0x' + 'ab'.repeat(32), replayHash: hash }) });
const okPending = (hash) => ({ status: 202, ok: true, json: async () => ({ ok: true, pending: true, replayHash: hash }) });
const err429 = (sec) => ({ status: 429, ok: false, json: async () => ({ retryAfterSec: sec || 120 }) });
const err422 = () => ({ status: 422, ok: false, json: async () => ({}) });
const netErr = () => new Error('timeout');

function mkResult(score) {
  return {
    score: score || 125515, acc: 76.5, mode: 'free', sessionId: 's1',
    notes: 200, taps: 180, durationMs: 60000,
    replay: { header: { seedKey: 'FREE-1', seed: 1, mode: 'free', genre: 'cyber', diff: 'normal' }, events: [{ t: 1.5, lane: 0 }] },
    replayHash: HASH,
  };
}
function mkBody(score) {
  const r = mkResult(score);
  return { wallet: ADDR, name: 'yui', score: r.score, acc: r.acc, mode: 'free', sessionId: 's1', notes: r.notes, taps: r.taps, durationMs: r.durationMs, replay: r.replay, replayHash: r.replayHash, gameVersion: 'v43.4' };
}

// --- Harness: the submit section sliced from script.js ---
function mkHarness(store) {
  const loadJSONh = (k, fb) => { try { const v = JSON.parse(store[k] === undefined ? 'null' : store[k]); return v === null ? fb : v; } catch { return fb; } };
  const saveJSONh = (k, v) => { try { store[k] = JSON.stringify(v); return true; } catch { return false; } };
  const els = {
    lbSubmitBtn: { textContent: '[ KIRIM SKOR ]', disabled: false, classList: mockClassList() },
    lbSubmitMsg: { textContent: '', classList: mockClassList() },
    lbName: { value: 'yui' },
    lbList: { innerHTML: '' },
    lbRank: { textContent: '' },
    lbModes: { innerHTML: '', querySelectorAll: () => [] },
    lbReloadBtn: { _handlers: {}, addEventListener(ev, fn) { this._handlers[ev] = fn; } },
  };
  const $stub = id => els[id] || null;
  let src = js.slice(js.indexOf('let lastResult = null;'), js.indexOf('// --- v41: TOKO KEJU'));
  // Test-only speed: retry delays 10/30/60 dtk -> 5/10/15 ms, flush 30 dtk -> 50 ms, poll 10 dtk -> 50 ms.
  src = src.replace('SUBMIT_RETRY_DELAYS_MS = [10000, 30000, 60000]', 'SUBMIT_RETRY_DELAYS_MS = [5, 10, 15]');
  src = src.replace('SUBMIT_QUEUE_FLUSH_MS = 30000', 'SUBMIT_QUEUE_FLUSH_MS = 50');
  src = src.replace('VERIFY_POLL_INTERVAL_MS = 10000', 'VERIFY_POLL_INTERVAL_MS = 50');
  const harnessSrc = [
    "let lang = 'id';",
    "const LB_MODES = ['free', 'daily', 'live', 'race', 'boss', 'challenge'];",
    "const lbState = { mode: 'free', rows: [], loading: false };",
    constObjSrc(jsLines, 'MSG'),
    constObjSrc(jsLines, 'I18N'),
    "function msg(k) { const d = MSG[lang] || MSG.en; return d[k] !== undefined ? d[k] : (MSG.en[k] !== undefined ? MSG.en[k] : k); }",
    "function msgf(k, vars) { let s = msg(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; }",
    src,
    "return { submitLb, resetLbSubmit, loadPendingSubmits, enqueuePendingSubmit, dequeuePendingSubmit, postOneSubmit, submitWithRetries, scheduleSubmitFlush, flushPendingSubmits, fetchLb, setLastResult: (r) => { lastResult = r; }, getLastResult: () => lastResult };",
  ].join('\n');
  const fn = new Function('window', 'document', '$', 'tfetch', 'CONFIG', 'isAddr', 'currentWallet', 'connectedWallet', 'loadJSON', 'saveJSON', 'escHtml', 'fetchShop', 'fetchLeagueWeekly', 'analyticsEvent', harnessSrc);
  const api = fn({}, {}, $stub, mockTfetch, { LB_URL: 'https://lb.test' }, isAddrStub, () => ADDR, () => ADDR, loadJSONh, saveJSONh, escHtmlStub, () => {}, () => {}, () => {});
  return { api, els };
}

(async () => {
  // 1. Antrean: simpan -> muat -> dedupe per replayHash -> hapus.
  {
    const store = {};
    const h = mkHarness(store);
    t('v43.3 antrean: enqueue -> load mengembalikan 1 entri dengan body utuh', h.api.enqueuePendingSubmit(mkBody()) === true && h.api.loadPendingSubmits().length === 1 && h.api.loadPendingSubmits()[0].body.score === 125515);
    h.api.enqueuePendingSubmit(mkBody(99999)); // replayHash sama -> perbarui, bukan ganda
    const list = h.api.loadPendingSubmits();
    t('v43.3 antrean: enqueue replayHash sama -> tetap 1 entri (dedupe, body diperbarui)', list.length === 1 && list[0].body.score === 99999);
    h.api.dequeuePendingSubmit(HASH);
    t('v43.3 antrean: dequeue -> kosong', h.api.loadPendingSubmits().length === 0);
  }
  // 2. Antrean bertahan melewati "reload halaman" (localStorage bersama).
  {
    const store = {};
    const h1 = mkHarness(store);
    h1.api.enqueuePendingSubmit(mkBody());
    const h2 = mkHarness(store); // instance baru = halaman dimuat ulang
    t('v43.3 antrean: bertahan melewati reload halaman (localStorage)', h2.api.loadPendingSubmits().length === 1 && h2.api.loadPendingSubmits()[0].replayHash === HASH);
  }
  // 3. Submit sukses setelah 2x gagal jaringan (retry bekerja).
  {
    resetTfetch();
    const h = mkHarness({});
    h.api.setLastResult(mkResult());
    postScript = [netErr(), netErr(), okSignature(HASH)];
    await h.api.submitLb();
    const posts = tfetchCalls.filter(c => c.opt && c.opt.method === 'POST');
    t('v43.3 submit: gagal 2x lalu sukses -> TERKIRIM', h.els.lbSubmitMsg.textContent.includes('TERKIRIM'));
    t('v43.3 submit: retry memakai 3x POST (2 gagal + 1 sukses)', posts.length === 3);
    t('v43.3 submit: sukses -> antrean kosong', h.api.loadPendingSubmits().length === 0);
  }
  // 4. Submit gagal semua percobaan -> status jelas + tombol COBA LAGI + antrean tetap.
  {
    resetTfetch();
    const h = mkHarness({});
    h.api.setLastResult(mkResult());
    postScript = [netErr(), netErr(), netErr(), netErr()];
    await h.api.submitLb();
    const posts = tfetchCalls.filter(c => c.opt && c.opt.method === 'POST');
    t('v43.3 submit: gagal semua -> pesan GAGAL MENGIRIM (bukan diam)', h.els.lbSubmitMsg.textContent.includes('GAGAL MENGIRIM'));
    t('v43.3 submit: gagal semua -> tombol jadi [ COBA LAGI ] + aktif', h.els.lbSubmitBtn.textContent === '[ COBA LAGI ]' && h.els.lbSubmitBtn.disabled === false);
    t('v43.3 submit: gagal semua -> 4x POST (1 + 3 retry)', posts.length === 4);
    t('v43.3 submit: gagal semua -> skor TETAP di antrean (tidak hilang)', h.api.loadPendingSubmits().length === 1 && h.api.loadPendingSubmits()[0].body.score === 125515);
  }
  // 5. 429 -> pesan rate-limit, TIDAK di-retry, tetap antre.
  {
    resetTfetch();
    const h = mkHarness({});
    h.api.setLastResult(mkResult());
    postScript = [err429(120)];
    await h.api.submitLb();
    const posts = tfetchCalls.filter(c => c.opt && c.opt.method === 'POST');
    t('v43.3 submit: 429 -> pesan TERLALU SERING (bukan offline generik)', h.els.lbSubmitMsg.textContent.includes('TERLALU SERING'));
    t('v43.3 submit: 429 -> TIDAK di-retry (1x POST saja) + tetap antre', posts.length === 1 && h.api.loadPendingSubmits().length === 1);
    t('v43.3 submit: 429 -> tombol aktif lagi', h.els.lbSubmitBtn.disabled === false);
  }
  // 6. 422 terminal -> pesan ditolak, antrean dihapus (tidak retry selamanya).
  {
    resetTfetch();
    const h = mkHarness({});
    h.api.setLastResult(mkResult());
    postScript = [err422()];
    await h.api.submitLb();
    const posts = tfetchCalls.filter(c => c.opt && c.opt.method === 'POST');
    t('v43.3 submit: 422 -> pesan VERIFIKASI DITOLAK', h.els.lbSubmitMsg.textContent.includes('VERIFIKASI DITOLAK'));
    t('v43.3 submit: 422 -> TIDAK di-retry + antrean dihapus', posts.length === 1 && h.api.loadPendingSubmits().length === 0);
  }
  // 7. Flush latar: sukses -> antrean kosong; gagal jaringan -> tetap antre.
  {
    resetTfetch();
    const h = mkHarness({});
    h.api.enqueuePendingSubmit(mkBody());
    postScript = [okSignature(HASH)];
    await h.api.flushPendingSubmits();
    t('v43.3 flush: sukses -> antrean kosong', h.api.loadPendingSubmits().length === 0);
    h.api.enqueuePendingSubmit(mkBody());
    postScript = [netErr()];
    await h.api.flushPendingSubmits();
    t('v43.3 flush: gagal jaringan -> tetap antre untuk flush berikut', h.api.loadPendingSubmits().length === 1);
  }
  // 8. Board gagal muat -> pesan + tombol muat ulang; tombol bekerja.
  {
    resetTfetch();
    const h = mkHarness({});
    boardScript = 'fail';
    await h.api.fetchLb('free');
    t('v43.3 board: gagal muat -> pesan LEADERBOARD OFFLINE', h.els.lbList.innerHTML.includes('LEADERBOARD OFFLINE'));
    t('v43.3 board: gagal muat -> tombol muat ulang terpasang', typeof h.els.lbReloadBtn._handlers.click === 'function');
    boardScript = 'ok';
    await h.els.lbReloadBtn._handlers.click();
    t('v43.3 board: tombol muat ulang -> board tampil (skor 125515)', h.els.lbList.innerHTML.includes('125515'));
  }
  // 9. Jalur pending (202) -> poll /verify -> TER VERIFIKASI.
  {
    resetTfetch();
    const h = mkHarness({});
    h.api.setLastResult(mkResult());
    postScript = [okPending(HASH)];
    verifyScript = [{ status: 200, ok: true, json: async () => ({ verification_status: 'verified', replayHash: HASH, signature: '0x' + 'cd'.repeat(32) }) }];
    await h.api.submitLb();
    await sleep(150); // poll pertama jalan di tick berikutnya
    t('v43.3 submit: pending -> poll /verify -> TER VERIFIKASI', h.els.lbSubmitMsg.textContent.includes('TERVERIFIKASI'));
    t('v43.3 submit: pending -> antrean kosong', h.api.loadPendingSubmits().length === 0);
  }
  // 10. resetLbSubmit mengembalikan label tombol [ KIRIM SKOR ].
  {
    resetTfetch();
    const h = mkHarness({});
    h.api.setLastResult(mkResult());
    postScript = [netErr(), netErr(), netErr(), netErr()];
    await h.api.submitLb(); // tombol jadi [ COBA LAGI ]
    h.api.resetLbSubmit();
    t('v43.3 submit: reset mengembalikan label [ KIRIM SKOR ] + tombol aktif', h.els.lbSubmitBtn.textContent === '[ KIRIM SKOR ]' && h.els.lbSubmitBtn.disabled === false);
  }

  // --- Statis ---
  t('v43.3 statis: kunci antrean sqk43:pending + konstanta timeout/retry/flush', js.includes("PENDING_SUBMITS_KEY = 'sqk43:pending'") && js.includes('SUBMIT_TIMEOUT_MS = 60000') && js.includes('SUBMIT_RETRY_DELAYS_MS = [10000, 30000, 60000]') && js.includes('SUBMIT_QUEUE_FLUSH_MS = 30000') && js.includes('SUBMIT_QUEUE_MAX = 5'));
  t('v43.3 statis: pesan status baru ID (MENGIRIM / GAGAL / TERSIMPAN)', js.includes("lbSending: 'MENGIRIM SKOR…'") && js.includes("lbSubmitFailed: 'GAGAL MENGIRIM") && js.includes("lbQueued: 'SKOR TERSIMPAN DI HP"));
  t('v43.3 statis: pesan status baru EN (SENDING / SEND FAILED / SAVED)', js.includes("lbSending: 'SENDING SCORE…'") && js.includes("lbSubmitFailed: 'SEND FAILED") && js.includes("lbQueued: 'SCORE SAVED ON THIS PHONE"));
  t('v43.3 statis: label tombol retry ID+EN di I18N', js.includes("lbRetry: '[ COBA LAGI ]'") && js.includes("lbRetry: '[ RETRY ]'"));
  t('v43.3 statis: flush di-hook (load 5 dtk + online + tab LEAGUE)', js.includes('scheduleSubmitFlush(5000)') && js.includes("window.addEventListener('online'") && js.includes('scheduleSubmitFlush(1000)'));
  t('v43.3 statis: board gagal muat punya tombol muat ulang inline', js.includes('id="lbReloadBtn"') && js.includes("id=\"leagueWeeklyReloadBtn\""));
  t('v43.4 statis: format body submit TIDAK berubah (replay + replayHash + gameVersion)', js.includes('replay: lastResult.replay, replayHash: lastResult.replayHash') && js.includes("gameVersion: 'v43.4'"));
  t('v43.3 statis: engine.js byte-identik v43.2', fs.readFileSync('engine.js', 'utf8') === fs.readFileSync('../squeekchain-v43.2/engine.js', 'utf8'));
  t('v43.3 statis: worker.js byte-identik v43.2 (Worker tetap v13)', fs.readFileSync('worker.js', 'utf8') === fs.readFileSync('../squeekchain-v43.2/worker.js', 'utf8'));
  let goldenOk = true;
  for (const g of golden) {
    if (JSON.stringify(SqueekEngine.buildChart(g.header)) !== JSON.stringify(g.anthem)) { goldenOk = false; console.log('  golden mismatch:', g.header && g.header.seedKey); break; }
  }
  t('v43.3 statis: 14 chart golden identik (buildChart == fixture v40)', goldenOk);

  console.log(`\nTEST-v43.3-submit: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
