// v42.5 functional tests — run: node TEST-v42.5.js  (cwd = the v42.5 folder)
// Covers: GHOST pace + engine ghost branch, poll cross-check, ghost
// validation (worker), rate-limit v10, dreamReward, shop previews,
// wallet UX harness (status card + disconnect + txWallet), Dream Seeds,
// Lullaby seedKey, v42.5.1 two-source skins (BUG 1), Lullaby submit button
// (BUG 2), Lullaby mode color (BUG 3), v42.5.2 UNEQUIP (FIX 1) + submit
// tahan koneksi lambat: timeout 30/20 detik + 1 retry otomatis (FIX 2),
// WalletConnect restore: enable() + preload bundle 60 detik + alasan
// gagal terlihat (FIX 3). Static v42.5 checks live in TEST-v34-neo.js.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
const worker = fs.readFileSync('worker.js', 'utf8');
const jsLines = js.split('\n');
const workerLines = worker.split('\n');
const SqueekEngine = require('./engine.js');
let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }
function fnSrc(lines, name) {
  const start = lines.findIndex(l => l.startsWith('function ' + name + '(') || l.startsWith('async function ' + name + '('));
  if (start < 0) throw new Error('function not found: ' + name);
  let depth = 0, end = start;
  for (let i = start; i < lines.length; i++) { for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return lines.slice(start, end + 1).join('\n');
}
function fnSrcW(name) { return fnSrc(workerLines, name); }
function fnSrcJ(name) { return fnSrc(jsLines, name); }
function mockClassList() {
  const set = new Set();
  return {
    toggle(cls, force) { if (force === undefined) { if (set.has(cls)) set.delete(cls); else set.add(cls); } else if (force) set.add(cls); else set.delete(cls); },
    add(cls) { set.add(cls); },
    remove(cls) { set.delete(cls); },
    contains(cls) { return set.has(cls); },
  };
}
function mockEl() { return { textContent: '', classList: mockClassList() }; }

// --- 1. GHOST pace from real 7-day stats ---
(function () {
  const constStart = js.indexOf('const GHOST_WHEEL_M_PER_PASSAGE');
  const constEnd = js.indexOf('\n', js.indexOf('const GHOST_PACE_CACHE_KEY'));
  const consts = js.slice(constStart, constEnd); // only the 4 GHOST const lines
  const ghostPaceFromStats = new Function(consts + '\n' + fnSrcJ('ghostPaceFromStats') + '\nreturn ghostPaceFromStats;')();
  const stats = { days: [
    { date: '2026-11-05', buckets: [
      { startMinuteUtc: 180, coverage: 'complete', workUnits: '1075' },
      { startMinuteUtc: 210, coverage: 'complete', workUnits: '1075' },
      { startMinuteUtc: 240, coverage: 'complete', workUnits: '1075' },
      { startMinuteUtc: 0, coverage: 'complete', workUnits: '9999' }, // night bucket — must be IGNORED
      { startMinuteUtc: 420, coverage: 'complete', workUnits: '9999' }, // 07:00 UTC = 14:00 WIB — outside the window
      { startMinuteUtc: 270, coverage: 'partial', workUnits: '9999' }, // partial — must be IGNORED
    ] },
  ] };
  t('ghostPaceFromStats: 1075 work/30min -> 0.524 m/s (daytime only)', ghostPaceFromStats(stats) === 0.524);
  t('ghostPaceFromStats: all-zero daytime buckets -> null (no pace)', ghostPaceFromStats({ days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 180, coverage: 'complete', workUnits: '0' }] }] }) === null);
  t('ghostPaceFromStats: no days -> null', ghostPaceFromStats({ days: [] }) === null);
  t('ghostPaceFromStats: only partial buckets -> null', ghostPaceFromStats({ days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 180, coverage: 'partial', workUnits: '1075' }] }] }) === null);
  t('ghostPaceFromStats: null stats -> null', ghostPaceFromStats(null) === null);
})();

// --- 2. Engine ghost branch (deriveOppDistM) ---
(function () {
  const header = { mode: 'race', genre: 'synth', diff: 'easy', seedKey: 'RACE-2026-11-09-128', seed: 12345, lanes: 3, mirror: false, practice: false, offsetMs: 0, wallStartMs: Date.now() - 120000, duration: 60, initialZoomies: false, initialDistKm: 0, ghost: true, ghostPaceMs: 0.5 };
  const chart = SqueekEngine.buildChart(header);
  const replay = { header, events: { inputs: [], polls: [], golden: [], finish: { t: 61, oppDistM: 30.5 } }, claim: { score: 0, acc: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 } } };
  const sim = SqueekEngine.simulate(chart, replay);
  t('engine ghost: oppDistMDerived = pace x finish.t (0.5 x 61 = 30.5)', sim.oppDistMDerived === 30.5);
  t('engine ghost: oppDistMMatch true', sim.oppDistMMatch === true);
  // Non-ghost path unchanged: derived from the poll log.
  const header2 = { ...header, ghost: false, ghostPaceMs: 0 };
  const replay2 = { header: header2, events: { inputs: [], polls: [{ t: 0, ok: true, rpm: 0, dist: 0 }, { t: 60, ok: true, rpm: 0, dist: 0.03 }], golden: [], finish: { t: 61, oppDistM: 30 } }, claim: replay.claim };
  const sim2 = SqueekEngine.simulate(SqueekEngine.buildChart(header2), replay2);
  t('engine live: oppDistMDerived from polls (0.03 km = 30 m)', sim2.oppDistMDerived === 30);
  t('engine live: oppDistMMatch true', sim2.oppDistMMatch === true);
})();

// --- 3. Worker poll cross-check ---
(function () {
  const pollsContradictWheel = new Function(fnSrcW('pollsContradictWheel') + '\nreturn pollsContradictWheel;')();
  const wallStart = Date.UTC(2026, 10, 5, 5, 0, 0); // 2026-11-05 05:00 UTC = 12:00 WIB
  const zoomiesPolls = [{ t: 0, ok: true, rpm: 80, dist: 0.001 }];
  const stillStats = { days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 300, coverage: 'complete', workUnits: '0' }] }] };
  const movingStats = { days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 300, coverage: 'complete', workUnits: '500' }] }] };
  const partialStats = { days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 300, coverage: 'partial', workUnits: '0' }] }] };
  const nullStats = { days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 300, coverage: 'complete', workUnits: null }] }] };
  t('poll cross-check: fake ZOOMIES during a provably-still window -> CONTRADICTION', pollsContradictWheel(stillStats, wallStart, 120000, zoomiesPolls) === true);
  t('poll cross-check: genuine movement (workUnits 500) -> no contradiction', pollsContradictWheel(movingStats, wallStart, 120000, zoomiesPolls) === false);
  t('poll cross-check: partial coverage -> fail open (no contradiction)', pollsContradictWheel(partialStats, wallStart, 120000, zoomiesPolls) === false);
  t('poll cross-check: null workUnits -> fail open (no contradiction)', pollsContradictWheel(nullStats, wallStart, 120000, zoomiesPolls) === false);
  t('poll cross-check: no rpm>0 polls -> no contradiction', pollsContradictWheel(stillStats, wallStart, 120000, [{ t: 0, ok: true, rpm: 0, dist: 0 }]) === false);
  t('poll cross-check: null stats -> no contradiction', pollsContradictWheel(null, wallStart, 120000, zoomiesPolls) === false);
  t('poll cross-check: window spanning a missing bucket -> fail open', pollsContradictWheel(stillStats, wallStart, 2400000, zoomiesPolls) === false);
})();

// --- 4. Worker ghost validation (checkOppDist + validateReplay) ---
(function () {
  const checkOppDist = new Function('const GHOST_PACE_MAX_MS = 1.0;\n' + fnSrcW('isFiniteNumber') + '\n' + fnSrcW('checkOppDist') + '\nreturn checkOppDist;')();
  const ghostOk = { header: { mode: 'race', ghost: true, ghostPaceMs: 0.5, initialDistKm: 0 }, events: { finish: { t: 61, oppDistM: 30.5 }, polls: [] } };
  t('checkOppDist ghost: pace x finish.t matches -> null', checkOppDist(ghostOk) === null);
  t('checkOppDist ghost: oppDistM 100 vs pace 0.5 x 61 -> error', checkOppDist({ header: ghostOk.header, events: { finish: { t: 61, oppDistM: 100 }, polls: [] } }) === 'finish.oppDistM inconsistent with ghost pace');
  t('checkOppDist ghost: pace 2.0 (above cap) -> error', checkOppDist({ header: { mode: 'race', ghost: true, ghostPaceMs: 2.0, initialDistKm: 0 }, events: { finish: { t: 61, oppDistM: 122 }, polls: [] } }) === 'ghost pace is not valid');
  t('checkOppDist live: consistent polls -> null', checkOppDist({ header: { mode: 'race', initialDistKm: 0 }, events: { finish: { t: 61, oppDistM: 30 }, polls: [{ t: 0, ok: true, rpm: 0, dist: 0 }, { t: 60, ok: true, rpm: 0, dist: 0.03 }] } }) === null);

  const validateReplay = new Function(
    "const GENRES = ['cyber','synth','chip','void'];\nconst DIFFS = ['easy','normal','hard'];\nconst MAX_POLLS = 600;\nconst MAX_EXTRA_TAPS = 50;\nconst GOLDEN_MAX = 2;\nconst GHOST_PACE_MAX_MS = 1.0;\n" +
    fnSrcW('isNonEmptyString') + '\n' + fnSrcW('isInt') + '\n' + fnSrcW('isFiniteNumber') + '\n' + fnSrcW('checkOppDist') + '\n' + fnSrcW('validateReplay') +
    '\nreturn validateReplay;')();
  const ghostReplay = {
    v: 1,
    header: { mode: 'race', genre: 'synth', diff: 'easy', seedKey: 'RACE-2026-11-09-128', seed: 12345, lanes: 3, mirror: false, practice: false, offsetMs: 0, wallStartMs: Date.now() - 120000, duration: 60, initialZoomies: false, initialDistKm: 0, ghost: true, ghostPaceMs: 0.5 },
    events: { inputs: [], polls: [{ t: 0, ok: false, rpm: null, dist: null }], golden: [], finish: { t: 61, oppDistM: 30.5 } },
    claim: { score: 100, acc: 50, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 } },
  };
  t('validateReplay: minimal ghost race replay VALID', validateReplay(ghostReplay, {}, 'race', 100, 50).ok === true);
  const freeGhost = JSON.parse(JSON.stringify(ghostReplay));
  freeGhost.header.mode = 'free';
  t('validateReplay: ghost outside race mode REJECTED', validateReplay(freeGhost, {}, 'free', 100, 50).error === 'replay ghost is only valid in race mode');
  const fastGhost = JSON.parse(JSON.stringify(ghostReplay));
  fastGhost.header.ghostPaceMs = 2.0;
  t('validateReplay: ghost pace 2.0 REJECTED', validateReplay(fastGhost, {}, 'race', 100, 50).error === 'replay header ghostPaceMs out of range');
  const noPaceGhost = JSON.parse(JSON.stringify(ghostReplay));
  delete noPaceGhost.header.ghostPaceMs;
  t('validateReplay: ghost without pace REJECTED', validateReplay(noPaceGhost, {}, 'race', 100, 50).error === 'replay header ghostPaceMs is missing');
  const noGhost = JSON.parse(JSON.stringify(ghostReplay));
  delete noGhost.header.ghost; delete noGhost.header.ghostPaceMs;
  noGhost.events.finish.oppDistM = 0; // live race, wheel still, last poll failed -> opp must be 0
  t('validateReplay: v42.4-style replay without ghost fields still VALID', validateReplay(noGhost, {}, 'race', 100, 50).ok === true);
})();

// --- 5. Worker rate-limit v10 (mock D1) ---
function mockEnv() {
  const tables = { submit_log: [], resolve_log: [] };
  return {
    tables,
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async run() {
                let m = sql.match(/^DELETE FROM (\w+) WHERE ts < \?/);
                if (m) {
                  const before = tables[m[1]].length;
                  tables[m[1]] = tables[m[1]].filter(r => r.ts >= params[0]);
                  return { meta: { changes: before - tables[m[1]].length } };
                }
                m = sql.match(/^INSERT INTO (\w+) \(wallet, ip, ts\) VALUES/);
                if (m) {
                  tables[m[1]].push({ wallet: params[0], ip: params[1], ts: params[2] });
                  return { meta: { changes: 1 } };
                }
                throw new Error('mock DB: unhandled run sql: ' + sql);
              },
              async first() {
                let m = sql.match(/SELECT COUNT\(\*\) AS n, MIN\(ts\) AS oldest FROM (\w+) WHERE wallet = \?/);
                if (m) {
                  const rows = tables[m[1]].filter(r => r.wallet === params[0] && r.ts >= params[1]);
                  return { n: rows.length, oldest: rows.length ? Math.min(...rows.map(r => r.ts)) : null };
                }
                m = sql.match(/SELECT COUNT\(\*\) AS n, MIN\(ts\) AS oldest FROM (\w+) WHERE ip = \?/);
                if (m) {
                  const rows = tables[m[1]].filter(r => r.ip === params[0] && r.ts >= params[1]);
                  return { n: rows.length, oldest: rows.length ? Math.min(...rows.map(r => r.ts)) : null };
                }
                throw new Error('mock DB: unhandled first sql: ' + sql);
              },
            };
          },
        };
      },
    },
  };
}
async function runRateLimitTests() {
  const rateLimitAllowed = new Function(
    'const RATE_WINDOW_MS = 3600000;\nconst RATE_MAX_WALLET = 10;\nconst RATE_MAX_IP = 30;\n' +
    fnSrcW('rateLimitAllowed') + '\nreturn rateLimitAllowed;')();
  const WALLET = '0x88538a82143065664232422e2dec4309038fcf9a';
  const IP = '114.10.27.233';
  // 10 score submits allowed, 11th rejected, rejected adds NO row.
  {
    const env = mockEnv();
    let allowed = 0;
    for (let i = 0; i < 10; i++) if ((await rateLimitAllowed(env, 'submit_log', WALLET, IP, 10, 30)).allowed) allowed++;
    t('rate-limit v10: 10 submits allowed', allowed === 10);
    const r11 = await rateLimitAllowed(env, 'submit_log', WALLET, IP, 10, 30);
    t('rate-limit v10: 11th submit REJECTED with retryAfterSec', r11.allowed === false && r11.retryAfterSec > 0 && r11.retryAfterSec <= 3600);
    t('rate-limit v10: rejected attempt adds NO row (count stays 10)', env.tables.submit_log.length === 10);
    const r12 = await rateLimitAllowed(env, 'submit_log', WALLET, IP, 10, 30);
    t('rate-limit v10: still rejected after the 11th (no self-extension)', r12.allowed === false && env.tables.submit_log.length === 10);
  }
  // Resolve has its OWN counter: 10 submits do NOT block a resolve.
  {
    const env = mockEnv();
    for (let i = 0; i < 10; i++) await rateLimitAllowed(env, 'submit_log', WALLET, IP, 10, 30);
    const r = await rateLimitAllowed(env, 'resolve_log', WALLET, IP, 10, 30);
    t('rate-limit v10: 10 score submits do NOT block capsule resolve (separate table)', r.allowed === true);
  }
  // IP limit: 30 different wallets from one IP, 31st rejected.
  {
    const env = mockEnv();
    let allowed = 0;
    for (let i = 0; i < 30; i++) if ((await rateLimitAllowed(env, 'submit_log', '0x' + String(i).padStart(40, '0'), IP, 10, 30)).allowed) allowed++;
    const r31 = await rateLimitAllowed(env, 'submit_log', '0x' + 'f'.repeat(40), IP, 10, 30);
    t('rate-limit v10: IP limit 30 (31st wallet from same IP rejected)', allowed === 30 && r31.allowed === false);
  }
}

// --- 6. dreamReward ---
(function () {
  const dreamReward = new Function(fnSrcW('dreamReward') + '\nreturn dreamReward;')();
  t('dreamReward 0 -> 25', dreamReward(0) === 25);
  t('dreamReward 1 -> 50', dreamReward(1) === 50);
  t('dreamReward 2 -> 75', dreamReward(2) === 75);
  t('dreamReward 3 (capped) -> 75', dreamReward(3) === 75);
  t('dreamReward -1 (clamped) -> 25', dreamReward(-1) === 25);
})();

// --- 7. Shop previews ---
(function () {
  const skinsSrc = js.slice(js.indexOf('const NOTE_SKINS'), js.indexOf('function shopSkin'));
  const previewSrc = fnSrcJ('skinPreviewHtml') + '\n' + fnSrcJ('capsulePreviewHtml');
  const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const api = new Function('escHtml', skinsSrc + '\n' + previewSrc + '\nreturn { skinPreviewHtml, capsulePreviewHtml };')(escHtml);
  const rare = api.skinPreviewHtml('note-sqk-rare', 'note');
  t('shop preview: SQK rare skin shows 4 dots in its palette (#3b82f6)', rare.includes('#3b82f6') && (rare.match(/pv-dot/g) || []).length === 4);
  const mint = api.skinPreviewHtml('note-mint', 'note');
  t('shop preview: Keju mint skin shows its palette (#7dffc8)', mint.includes('#7dffc8') && (mint.match(/pv-dot/g) || []).length === 4);
  const frame = api.skinPreviewHtml('frame-sqk', 'frame');
  t('shop preview: frame shows a mini framed panel with its class', frame.includes('pv-frame frame-sqk') && frame.includes('◆'));
  t('shop preview: unknown skin -> empty', api.skinPreviewHtml('nope', 'note') === '');
  const cap = api.capsulePreviewHtml();
  t('shop preview: capsule shows all 4 rarity chips', ['common', 'rare', 'epic', 'legendary'].every(r => cap.includes('pv-cap ' + r)));
})();

// --- 8. Wallet UX harness (v42.5): status card + disconnect + readonly field ---
function mkWalletHarness42(opts) {
  const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
  const btn = { textContent: 'CONNECT', disabled: false, classList: mockClassList() }; // v43: tombol CONNECT singkat + bisa disembunyikan (classList wajib — updateConnectBtn toggle 'hidden')
  const walletInput = { value: '', readOnly: false, addEventListener() {} };
  const walletStatus = mockEl();
  const disconnectBtn = mockEl();
  const walletManualNote = mockEl();
  const walletDot = mockEl(); // v43: kartu wallet baru — dot status + alamat singkat + salin
  const walletAddr = mockEl();
  const walletCopyBtn = mockEl();
  const wcRestoreNote = mockEl();
  const walletManualRow = mockEl(); walletManualRow.classList.add('hidden'); // v43: baris manual tersembunyi by default (opt-in via [ ALAMAT ])
  const handlers = {};
  const said = [];
  const store = {};
  const fakeLocalStorage = {
    length: 0,
    key(i) { return Object.keys(store)[i] || null; },
    getItem(k) { return store[k] === undefined ? null : store[k]; },
    setItem(k, v) { store[k] = String(v); this.length = Object.keys(store).length; },
    removeItem(k) { delete store[k]; this.length = Object.keys(store).length; },
  };
  if (opts && opts.wcKeys) { store['wc@2:client:0.3:xyz'] = '{}'; fakeLocalStorage.length = 1; }
  const mockEth = opts && opts.injected ? {
    request: async ({ method }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [ADDR];
      return null;
    },
    on: (ev, fn) => { handlers[ev] = fn; },
  } : undefined;
  const mockWcProvider = {
    accounts: [ADDR],
    connected: true,
    request: async ({ method }) => (method === 'eth_requestAccounts' || method === 'eth_accounts' ? [ADDR] : []),
    connect: async () => {},
    disconnect: async () => {},
    on: (ev, fn) => { handlers[ev] = fn; },
  };
  const fakeWindow = {
    ethereum: mockEth,
    EthereumProvider: (opts && opts.wc) ? { init: async () => mockWcProvider } : undefined,
  };
  const I18Nstub = { en: { connect: 'CONNECT', connectedTpl: '[ CONNECTED: {addr} ]' }, id: { connect: 'HUBUNGKAN', connectedTpl: '[ TERHUBUNG: {addr} ]' } }; // v43: label CONNECT singkat (bukan CONNECT WALLET)
  const MSGstub = {
    walletConnected: 'WALLET CONNECTED: {addr} — ADDRESS ONLY, NO SIGNATURE REQUESTED.',
    walletConnectedTpl: 'WALLET CONNECTED: {addr} • Transactions use THIS address.',
    walletSwitched: 'WALLET SWITCHED TO {addr}.', walletDisconnected: 'WALLET DISCONNECTED.', walletInvalid: 'WALLET RETURNED NO VALID ADDRESS.',
  };
  const msgStub = k => MSGstub[k] || I18Nstub.en[k] || k;
  const msgfStub = (k, vars) => { let s = msgStub(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; };
  const isAddrStub = s => /^0x[a-fA-F0-9]{40}$/.test(s || '');
  const els = { connectBtn: btn, walletInput, walletStatus, disconnectBtn, walletManualNote, walletDot, walletAddr, walletCopyBtn, wcRestoreNote, walletManualRow };
  const $stub = id => els[id] || null;
  const api = new Function('window', 'localStorage', 'document', '$', 'msg', 'msgf', 'isAddr', 'walletEl', 'saveWallet38', 'preview', 'say', 'CONFIG', 'I18N', 'lang',
    js.slice(js.indexOf('let wcProvider = null; // active WalletConnect provider'), js.indexOf("bindClick('connectBtn'")) +
    '\nreturn { connectWallet, disconnectWallet, setConnected, updateConnectBtn, restoreWalletConnectSession, restoreInjectedSession };')(
    fakeWindow, fakeLocalStorage, { createElement: () => { throw new Error('no DOM in harness'); }, head: { appendChild() {} } },
    $stub, msgStub, msgfStub, isAddrStub, walletInput, () => {}, () => {}, (m) => said.push(m),
    { WC_PROJECT_ID: 'x', WC_CHAINS: [11155111], SEPOLIA_RPC: 'https://rpc.test', SHOP_ADDRESS: '0x0000000000000000000000000000000000000000' },
    I18Nstub, 'en');
  return { api, btn, walletInput, walletStatus, disconnectBtn, walletManualNote, walletDot, walletAddr, walletCopyBtn, wcRestoreNote, walletManualRow, handlers, said, ADDR, store };
}
async function runWalletTests42() {
  // v43 KARTU WALLET: satu bar elegan — dot + alamat singkat + CONNECT/PUTUSKAN.
  // Not connected: dot mati, alamat GUEST, salin tersembunyi, CONNECT tampil + aktif,
  // PUTUSKAN + status tersembunyi, field bisa diedit, baris manual tersembunyi (opt-in via [ ALAMAT ]).
  {
    const h = mkWalletHarness42({});
    t('v43 wallet UX: not connected -> dot off, GUEST, CONNECT tampil, status/PUTUSKAN tersembunyi, field editable, baris manual tersembunyi',
      h.walletDot.classList.contains('on') === false && h.walletAddr.textContent === 'GUEST' &&
      h.walletCopyBtn.classList.contains('hidden') === true &&
      h.walletStatus.classList.contains('hidden') === true && h.disconnectBtn.classList.contains('hidden') === true &&
      h.walletInput.readOnly === false && h.walletManualRow.classList.contains('hidden') === true &&
      h.btn.textContent === 'CONNECT' && h.btn.disabled === false && h.btn.classList.contains('hidden') === false);
  }
  // Connected (injected): CONNECT hilang, dot hijau, alamat singkat, status terlihat, PUTUSKAN muncul, field readonly.
  {
    const h = mkWalletHarness42({ injected: true });
    await h.api.connectWallet();
    t('v43 wallet UX: connected -> CONNECT hilang, dot hijau, alamat singkat, status terlihat',
      h.btn.classList.contains('hidden') === true && h.walletDot.classList.contains('on') === true &&
      h.walletAddr.textContent === '0x8853...cf9a' &&
      h.walletStatus.classList.contains('hidden') === false && h.walletStatus.textContent.includes('0x8853...cf9a'));
    t('v43 wallet UX: connected -> disconnect visible, field readonly, baris manual tetap tersembunyi',
      h.disconnectBtn.classList.contains('hidden') === false && h.walletInput.readOnly === true &&
      h.walletManualRow.classList.contains('hidden') === true);
    await h.api.disconnectWallet();
    t('v43 wallet UX: disconnect -> kembali CONNECT tampil, dot mati, alamat tetap di field sebagai manual (bukan GUEST), card hidden, field editable lagi',
      h.btn.textContent === 'CONNECT' && h.btn.disabled === false && h.btn.classList.contains('hidden') === false &&
      h.walletDot.classList.contains('on') === false && h.walletAddr.textContent === '0x8853...cf9a' &&
      h.walletCopyBtn.classList.contains('hidden') === false &&
      h.walletStatus.classList.contains('hidden') === true && h.disconnectBtn.classList.contains('hidden') === true &&
      h.walletInput.readOnly === false && h.walletManualRow.classList.contains('hidden') === true);
  }
  // Failed restore (no wc keys, no injected provider): stays NOT connected, never shows the old address.
  {
    const h = mkWalletHarness42({});
    await h.api.restoreWalletConnectSession();
    await h.api.restoreInjectedSession();
    t('v43 wallet UX: failed restore -> still NOT CONNECTED (no phantom address)',
      h.btn.textContent === 'CONNECT' && h.walletStatus.classList.contains('hidden') === true);
  }
  // WC connect + disconnect via the page button.
  {
    const h = mkWalletHarness42({ wc: true });
    await h.api.connectWallet();
    t('v43 wallet UX: WC connect -> CONNECT hilang, dot hijau, status terlihat',
      h.btn.classList.contains('hidden') === true && h.walletDot.classList.contains('on') === true &&
      h.walletStatus.classList.contains('hidden') === false);
    await h.api.disconnectWallet();
    t('v43 wallet UX: WC disconnect -> CONNECT lagi',
      h.btn.textContent === 'CONNECT' && h.btn.classList.contains('hidden') === false &&
      h.walletStatus.classList.contains('hidden') === true);
  }
}

// --- 9. Dream Seeds + Lullaby ---
async function runDreamTests42() {
  const store = {};
  const loadJSON = (k, d) => { try { const v = store[k]; return v === undefined ? d : JSON.parse(v); } catch { return d; } };
  const saveJSON = (k, v) => { store[k] = JSON.stringify(v); };
  const squeekTodayStr = new Function(fnSrcJ('squeekTodayStr') + '\nreturn squeekTodayStr;')();
  const said = [];
  const dreamBox = mockEl(), dreamLine = mockEl(), dreamPlantBtn = mockEl(), dreamHarvestBtn = mockEl(), lullabyBox = mockEl(), lullabyInfo = mockEl();
  const els = { dreamBox, dreamLine, dreamPlantBtn, dreamHarvestBtn, lullabyBox, lullabyInfo };
  const $stub = id => els[id] || null;
  const MSGstub = {
    dreamNotNight: 'NOT NIGHT', dreamAlready: 'ALREADY', dreamPlanted: 'PLANTED', dreamWatered: 'WATERED {stage}/2',
    dreamNoSeed: 'NO SEED', dreamNotReady: 'NOT READY', dreamNeedWallet: 'NEED WALLET', dreamHarvestFail: 'HARVEST FAIL',
    dreamHarvested: 'HARVESTED +{n}', dreamLineNone: 'NONE', dreamLineDay: 'DAY', dreamLineStage: 'STAGE {stage} {night}',
    lullabyInfo: 'LULLABY NIGHT', lullabyInfoAwake: 'LULLABY AWAKE',
  };
  const msgStub = k => MSGstub[k] || k;
  const msgfStub = (k, vars) => { let s = msgStub(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; };
  const fetchCalls = [];
  let fetchResponse = { ok: true, json: async () => ({ ok: true, keju: 75 }) };
  const tfetchStub = async (url, opt) => { fetchCalls.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null }); return fetchResponse; };
  let walletValue = '0x88538a82143065664232422e2dec4309038fcf9a';
  const isAddrStub = s => /^0x[a-fA-F0-9]{40}$/.test(s || '');
  const dreamSlice = js.slice(js.indexOf('const DREAM_KEY'), js.indexOf('// --- Weekly Boss'));
  const api = new Function('loadJSON', 'saveJSON', 'squeekTodayStr', '$', 'msg', 'msgf', 'tfetch', 'CONFIG', 'fetchShop', 'currentWallet', 'isAddr', 'say',
    "let liveSnapshot = null;\nlet playMode = 'daily';\n" + dreamSlice +
    "\nreturn { plantDream, waterDream, harvestDream, renderDreamBox, dreamIsNight, dreamCanPlant, dreamState, dreamNightKeyFor, renderLullabyBox, setLiveSnapshot: v => { liveSnapshot = v; }, setPlayMode: v => { playMode = v; } };")(
    loadJSON, saveJSON, squeekTodayStr, $stub, msgStub, msgfStub, tfetchStub,
    { LB_URL: 'https://test.invalid' }, () => {}, () => walletValue, isAddrStub, (m) => said.push(m));
  // Hamster asleep (rpm 0) -> planting is allowed even in daytime.
  api.setLiveSnapshot({ ok: true, rpm: 0 });
  api.plantDream();
  const d1 = api.dreamState();
  t('dream: plant while hamster sleeps -> seed planted, stage 0', d1 && typeof d1.plantedAt === 'number' && d1.stage === 0 && d1.harvested === false);
  api.plantDream();
  t('dream: plant twice the same night -> ALREADY (no second seed)', said.includes('ALREADY') && api.dreamState().plantedAt === d1.plantedAt);
  t('dream: water 1 -> stage 1', api.waterDream() === 1);
  t('dream: water 2 -> stage 2 (ready)', api.waterDream() === 2);
  t('dream: water 3 -> 0 (max stage)', api.waterDream() === 0);
  await api.harvestDream();
  t('dream: harvest at stage 2 -> POST /dream/harvest with plantedAt + stage 2', fetchCalls.length === 1 && fetchCalls[0].url.endsWith('/dream/harvest') && fetchCalls[0].body.stage === 2 && typeof fetchCalls[0].body.plantedAt === 'number');
  t('dream: harvest success -> harvested=true + message +75', api.dreamState().harvested === true && said.some(m => m.includes('+75')));
  await api.harvestDream();
  t('dream: harvest twice -> NO SEED (already harvested, no second fetch)', fetchCalls.length === 1 && said.includes('NO SEED'));
  // Fresh seed, stage < 2 -> harvest refused client-side.
  delete store['sqk42:dream'];
  api.setLiveSnapshot({ ok: true, rpm: 0 });
  api.plantDream();
  await api.harvestDream();
  t('dream: harvest at stage 0 -> NOT READY, no fetch', fetchCalls.length === 1 && said.includes('NOT READY'));
  // Lullaby box: hamster awake -> awake info; asleep -> night info.
  api.setPlayMode('lullaby');
  api.setLiveSnapshot({ ok: true, rpm: 80 });
  api.renderLullabyBox();
  t('lullaby: box visible in lullaby mode + awake info when hamster is up', lullabyBox.classList.contains('hidden') === false && lullabyInfo.textContent === 'LULLABY AWAKE');
  api.setLiveSnapshot({ ok: true, rpm: 0 });
  api.renderLullabyBox();
  t('lullaby: asleep info when hamster sleeps', lullabyInfo.textContent === 'LULLABY NIGHT');
  api.setPlayMode('free');
  api.renderLullabyBox();
  t('lullaby: box hidden outside lullaby mode', lullabyBox.classList.contains('hidden') === true);
  // Lullaby seedKey.
  const seedKeyFor = new Function('squeekTodayStr', 'liveSnapshot', 'liveBpm', 'weeklyKey', 'challengeCode',
    fnSrcJ('seedKeyFor') + '\nreturn seedKeyFor;')(squeekTodayStr, null, () => 128, () => '2026-11-02', null);
  t('lullaby: seedKey is LULLABY-<squeek day>', seedKeyFor('lullaby') === 'LULLABY-' + squeekTodayStr());
}

// --- 10. v42.5.1 app icon + OG image (Worker-served, no binary in repo) ---
(function () {
  const W = 'https://squeekchain-leaderboard.pancigoreng.workers.dev';
  t('v42.5.1 WC metadata icons -> Worker /icon.png', js.includes("icons: ['" + W + "/icon.png']"));
  t('v42.5.1 og:image -> Worker /og.png', html.includes('<meta property="og:image" content="' + W + '/og.png">'));
  t('v42.5.1 twitter:image -> Worker /og.png', html.includes('<meta name="twitter:image" content="' + W + '/og.png">'));
  t('v42.5.1 favicon + apple-touch-icon -> Worker /icon.png', html.includes('<link rel="icon" type="image/png" href="' + W + '/icon.png">') && html.includes('<link rel="apple-touch-icon" href="' + W + '/icon.png">'));
  t('v43 gameVersion v43', js.includes("gameVersion: 'v43'"));
  t('v42.5.1 worker routes /icon.png + /og.png exist', worker.includes('"/icon.png"') && worker.includes('"/og.png"') && worker.includes('function pngResponse('));
  t('v13 worker version 13', worker.includes('version: 13'));
  t('v42.5.1 no stale headline-simple.png URL in client', !html.includes('squeekchain-headline-simple.png') && !js.includes('squeekchain-headline-simple.png'));
})();

// --- 11. v42.5.1: dua sumber skin (BUG 1) + tombol submit Lullaby (BUG 2) + warna Lullaby (BUG 3) ---
async function runBugFixTests4251() {
  const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
  const store = {};
  const loadJSON = (k, d) => { try { const v = store[k]; return v === undefined ? d : JSON.parse(v); } catch { return d; } };
  const saveJSON = (k, v) => { store[k] = JSON.stringify(v); };
  const skinFns = new Function('loadJSON', 'saveJSON',
    fnSrcJ('shopSkin') + '\n' + fnSrcJ('saveKejuSkin') + '\n' + fnSrcJ('saveSqkSkin') + '\n' + fnSrcJ('saveSkinLast') +
    '\nreturn { shopSkin, saveKejuSkin, saveSqkSkin, saveSkinLast };')(loadJSON, saveJSON);
  const { shopSkin, saveKejuSkin, saveSqkSkin, saveSkinLast } = skinFns;
  // BUG 1 — skenario persis laporan user: equip SQK -> fetchShop -> tetap terpasang.
  saveSqkSkin({ note: 'note-sqk-rare', frame: null }); saveSkinLast('note', 'sqk');
  t('v42.5.1 BUG 1: equip SQK -> shopSkin.note = note-sqk-rare', shopSkin().note === 'note-sqk-rare');
  saveKejuSkin({ note: null, frame: null }); // simulasi fetchShop: server tanpa Keju terpasang
  t('v42.5.1 BUG 1: fetchShop tanpa Keju terpasang TIDAK menghapus skin SQK', shopSkin().note === 'note-sqk-rare');
  saveKejuSkin({ note: 'note-mint', frame: null }); saveSkinLast('note', 'keju'); // equip Keju
  t('v42.5.1 BUG 1: equip Keju lalu -> Keju menang di slot note', shopSkin().note === 'note-mint');
  saveKejuSkin({ note: 'note-mint', frame: null }); // fetchShop lagi (server: Keju terpasang)
  t('v42.5.1 BUG 1: equip Keju -> fetchShop -> Keju tetap terpasang', shopSkin().note === 'note-mint');
  saveSqkSkin({ note: 'note-sqk-lime', frame: null }); saveSkinLast('note', 'sqk'); // equip SQK lagi
  t('v42.5.1 BUG 1: equip SQK lalu -> SQK menang di slot note', shopSkin().note === 'note-sqk-lime');
  saveKejuSkin({ note: 'note-mint', frame: null }); // fetchShop lagi (server: Keju terpasang)
  t('v42.5.1 BUG 1: equip SQK -> fetchShop -> SQK tetap terpasang', shopSkin().note === 'note-sqk-lime');
  // Slot independen: note Keju + frame SQK hidup berdampingan.
  saveSqkSkin({ note: 'note-sqk-lime', frame: 'frame-sqk' }); saveSkinLast('frame', 'sqk');
  saveKejuSkin({ note: 'note-mint', frame: null }); saveSkinLast('note', 'keju');
  t('v42.5.1 BUG 1: slot independen (note Keju + frame SQK)', shopSkin().note === 'note-mint' && shopSkin().frame === 'frame-sqk');
  // Statis: fetchShop HANYA menulis kunci Keju; penulis tunggal lama sudah tidak ada.
  t('v42.5.1 BUG 1: fetchShop hanya menulis saveKejuSkin, bukan kunci gabungan', js.includes('saveKejuSkin({ note: note ? note.id : null, frame: frame ? frame.id : null })') && !js.includes('saveShopSkin('));
  t('v42.5.1 BUG 1: equipSqkItem punya fallback owned dari sqkState', js.includes('sqkState.owned[itemId] > 0'));
  // BUG 1 — fetchShop ASLI (bukan simulasi tulis kunci): mock tfetch + renderShop.
  let cheeseResp = { catalog: [{ id: 'note-mint', slot: 'note' }], items: [], balance: 0 };
  const tfetchMock = async () => ({ ok: true, json: async () => cheeseResp });
  let renderCalls = 0;
  const fetchShopH = new Function('currentWallet', 'isAddr', 'tfetch', 'CONFIG', 'renderShop', 'loadJSON', 'saveJSON',
    'let shopState = { balance: 0, items: [], catalog: [] };\n' +
    fnSrcJ('saveKejuSkin') + '\n' + fnSrcJ('fetchShop') +
    '\nreturn { fetchShop, getState: () => shopState };')(
    () => ADDR, s => /^0x[a-fA-F0-9]{40}$/.test(s || ''), tfetchMock, { LB_URL: 'https://lb.test' },
    () => { renderCalls++; }, loadJSON, saveJSON);
  saveSqkSkin({ note: 'note-sqk-rare', frame: null }); saveSkinLast('note', 'sqk');
  await fetchShopH.fetchShop();
  t('v42.5.1 BUG 1 (fetchShop asli): equip SQK bertahan melewati fetchShop()', shopSkin().note === 'note-sqk-rare' && renderCalls === 1);
  cheeseResp = { catalog: [{ id: 'note-mint', slot: 'note' }], items: [{ id: 'note-mint', slot: 'note', equipped: true }], balance: 50 };
  await fetchShopH.fetchShop();
  t('v42.5.1 BUG 1 (fetchShop asli): sync server tidak menimpa marker SQK terakhir', shopSkin().note === 'note-sqk-rare' && fetchShopH.getState().items.length === 1);
  saveKejuSkin({ note: 'note-mint', frame: null }); saveSkinLast('note', 'keju');
  await fetchShopH.fetchShop();
  t('v42.5.1 BUG 1 (fetchShop asli): equip Keju -> fetchShop -> Keju tetap terpasang', shopSkin().note === 'note-mint');
  // BUG 2 — resetLbSubmit menyembunyikan tombol untuk Lullaby/Practice saja.
  const btnEl = { disabled: false, classList: mockClassList() };
  const msgEl = { textContent: '', classList: mockClassList() };
  const $h = id => (id === 'lbSubmitBtn' ? btnEl : id === 'lbSubmitMsg' ? msgEl : null);
  const mkReset = lastResult => new Function('$', 'stopVerifyPoll', 'lastResult',
    fnSrcJ('resetLbSubmit') + '\nreturn resetLbSubmit;')($h, () => {}, lastResult);
  mkReset({ lullaby: true, practice: false })();
  t('v42.5.1 BUG 2: panel hasil Lullaby -> tombol SUBMIT disembunyikan', btnEl.classList.contains('hidden') === true);
  mkReset({ lullaby: false, practice: true })();
  t('v42.5.1 BUG 2: panel hasil Practice -> tombol SUBMIT disembunyikan', btnEl.classList.contains('hidden') === true);
  mkReset({ lullaby: false, practice: false })();
  t('v42.5.1 BUG 2: lagu biasa -> tombol SUBMIT tetap tampil', btnEl.classList.contains('hidden') === false);
  t('v42.5.1 BUG 2: submitLb tetap berjaga untuk Lullaby + Practice (lapis kedua)', js.includes("if (lastResult.lullaby) return show(msg('lbLullaby'));") && js.includes("if (lastResult.practice) return show(msg('lbPractice'));"));
  t('v42.5.1 BUG 2: catatan Lullaby tetap ada di panel hasil (lullabyTag)', js.includes("G.lullaby ? rl('lullabyTag')"));
  // BUG 3 — tombol mode LULLABY punya warna sendiri (lavender), seperti 4 mode lain.
  t('v42.5.1 BUG 3: tombol LULLABY punya --mode-accent lavender #b388ff', css.includes('#modeRow [data-mode="lullaby"] { --mode-accent: #b388ff; }'));
  t('v42.5.1 BUG 3: kelima mode punya --mode-accent', ['free', 'daily', 'live', 'race', 'lullaby'].every(m => css.includes('#modeRow [data-mode="' + m + '"]')));
  t('v42.5.1 BUG 3: tombol LULLABY ada di modeRow', html.includes('data-mode="lullaby"'));
  // BUG 4 — pesan 409 resolve kapsul: settlement hanya terjadi saat hamster lari (siang).
  t('v42.5.1 BUG 4: sqkNotSettled EN+ID menjelaskan settlement butuh hamster lari (siang)',
    js.includes('SETTLEMENTS ONLY HAPPEN WHEN THE HAMSTER RUNS (DAYTIME). TRY AGAIN AFTER THE MORNING RUN.') &&
    js.includes('SETTLEMENT HANYA TERJADI SAAT HAMSTER LARI (SIANG HARI). COBA LAGI SETELAH LARI PAGI.') &&
    !js.includes('HAS NOT SETTLED YET — TRY AGAIN IN A FEW MINUTES.') && !js.includes('BELUM SETTLED — COBA LAGI BEBERAPA MENIT LAGI.'));
}

// --- 12. v42.5.2: UNEQUIP (FIX 1) + submit tahan koneksi lambat (FIX 2) ---
async function runBugFixTests4252() {
  const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
  const store = {};
  const loadJSON = (k, d) => { try { const v = store[k]; return v === undefined ? d : JSON.parse(v); } catch { return d; } };
  const saveJSON = (k, v) => { store[k] = JSON.stringify(v); };
  const resetSkins = () => { delete store['sqk41:skin-keju']; delete store['sqk41:skin-sqk']; delete store['sqk41:skin-last']; };
  const skinFns = new Function('loadJSON', 'saveJSON',
    fnSrcJ('shopSkin') + '\n' + fnSrcJ('saveKejuSkin') + '\n' + fnSrcJ('saveSqkSkin') + '\n' + fnSrcJ('saveSkinLast') +
    '\nreturn { shopSkin, saveKejuSkin, saveSqkSkin, saveSkinLast };')(loadJSON, saveJSON);
  const { shopSkin, saveKejuSkin, saveSqkSkin, saveSkinLast } = skinFns;

  // --- FIX 1a: unequip SQK (lokal) — fungsi asli + skenario state ---
  const sqkCatalog = [
    { id: 1, name: 'Skin Rare', skin: 'note-sqk-rare', slot: 'note', priceSqk: 5 },
    { id: 3, name: 'Bingkai Animasi', skin: 'frame-sqk', slot: 'frame', priceSqk: 15 },
  ];
  let sqkMsgLog = [];
  const unequipSqkH = new Function('sqkShopItem', 'loadJSON', 'saveSqkSkin', 'saveSkinLast', 'applyResultFrame', 'sqkShopMsg', 'msg', 'msgf', 'renderSqkShop',
    fnSrcJ('unequipSqkItem') + '\nreturn unequipSqkItem;')(
    id => sqkCatalog.find(c => c.id === id) || null, loadJSON, saveSqkSkin, saveSkinLast,
    () => {}, t => { sqkMsgLog.push(t); }, k => k, (k, v) => k, () => {});
  resetSkins();
  saveSqkSkin({ note: 'note-sqk-rare', frame: null }); saveSkinLast('note', 'sqk');
  t('v42.5.2 FIX 1: equip SQK -> terpasang', shopSkin().note === 'note-sqk-rare');
  unequipSqkH(1);
  t('v42.5.2 FIX 1: unequip SQK -> not kembali default', shopSkin().note === null);
  t('v42.5.2 FIX 1: unequip SQK -> pesan dilepas', sqkMsgLog.includes('sqkUnequipped'));
  // Skenario: Keju -> SQK -> unequip SQK -> Keju tampil lagi.
  resetSkins();
  saveKejuSkin({ note: 'note-mint', frame: null }); saveSkinLast('note', 'keju');
  saveSqkSkin({ note: 'note-sqk-rare', frame: null }); saveSkinLast('note', 'sqk');
  t('v42.5.2 FIX 1: equip Keju lalu SQK -> SQK menang', shopSkin().note === 'note-sqk-rare');
  unequipSqkH(1);
  t('v42.5.2 FIX 1: unequip SQK -> Keju tampil lagi', shopSkin().note === 'note-mint');

  // --- FIX 1b: unequip Keju (server) — fungsi asli + mock server/D1 ---
  let serverEquipped = { note: 'note-mint', frame: null };
  const shopStateH = { balance: 50, items: [{ id: 'note-mint', slot: 'note', equipped: true }], catalog: [{ id: 'note-mint', name: 'Mint Notes', slot: 'note', rarity: 'common', price: 300 }] };
  let shopMsgLog = [];
  const tfetchUnequip = async url => {
    if (String(url).endsWith('/cheese/unequip')) { serverEquipped = { note: null, frame: null }; return { ok: true, json: async () => ({ ok: true, slot: 'note' }) }; }
    throw new Error('unexpected url ' + url);
  };
  const fetchShopMock = async () => { // tiruan fetchShop: sync flag equipped dari "server"
    shopStateH.items = [{ id: 'note-mint', slot: 'note', equipped: serverEquipped.note === 'note-mint' }];
    saveKejuSkin({ note: serverEquipped.note, frame: serverEquipped.frame });
  };
  const unequipH = new Function('currentWallet', 'isAddr', 'tfetch', 'CONFIG', 'shopMsg', 'msg', 'msgf', 'loadJSON', 'saveKejuSkin', 'saveSkinLast', 'applyResultFrame', 'fetchShop', 'shopState',
    fnSrcJ('unequipItem') + '\nreturn unequipItem;')(
    () => ADDR, s => /^0x[a-fA-F0-9]{40}$/.test(s || ''), tfetchUnequip, { LB_URL: 'https://lb.test' },
    tt => { shopMsgLog.push(tt); }, k => k, (k, v) => k,
    loadJSON, saveKejuSkin, saveSkinLast, () => {}, fetchShopMock, shopStateH);
  resetSkins();
  serverEquipped = { note: 'note-mint', frame: null };
  saveKejuSkin({ note: 'note-mint', frame: null }); saveSkinLast('note', 'keju');
  t('v42.5.2 FIX 1: equip Keju -> terpasang', shopSkin().note === 'note-mint');
  await unequipH('note');
  t('v42.5.2 FIX 1: unequip Keju -> not kembali default', shopSkin().note === null);
  t('v42.5.2 FIX 1: unequip Keju -> fetchShop TIDAK mengembalikannya', shopStateH.items[0].equipped === false && shopSkin().note === null);
  t('v42.5.2 FIX 1: unequip Keju -> item TETAP dimiliki (bukan dihapus)', shopStateH.items.length === 1 && shopStateH.items[0].id === 'note-mint');
  t('v42.5.2 FIX 1: unequip Keju -> pesan dilepas', shopMsgLog.includes('shopUnequipped'));
  // Skenario: SQK -> Keju -> unequip Keju -> SQK tampil lagi.
  resetSkins();
  saveSqkSkin({ note: 'note-sqk-rare', frame: null }); saveSkinLast('note', 'sqk');
  saveKejuSkin({ note: 'note-mint', frame: null }); saveSkinLast('note', 'keju');
  serverEquipped = { note: 'note-mint', frame: null };
  shopStateH.items = [{ id: 'note-mint', slot: 'note', equipped: true }];
  t('v42.5.2 FIX 1: equip SQK lalu Keju -> Keju menang', shopSkin().note === 'note-mint');
  await unequipH('note');
  t('v42.5.2 FIX 1: unequip Keju -> SQK tampil lagi', shopSkin().note === 'note-sqk-rare');

  // --- FIX 1c: render — tombol UNEQUIP muncul saat terpasang, EQUIP kembali setelah dilepas ---
  const fakeEl = () => ({ textContent: '', innerHTML: '', disabled: false, classList: mockClassList(), querySelectorAll: () => [] });
  // Toko SQK (fungsi render asli).
  const sqkEls = {};
  ['sqkShopSoon', 'sqkShopPool', 'sqkShopSeason', 'sqkShopBalance', 'sqkShopCatalog', 'sqkCapsulePreview', 'sqkCapsulePity', 'sqkCommitBtn', 'sqkResolveBtn'].forEach(id => { sqkEls[id] = fakeEl(); });
  const msgStub = { sqkEquippedTpl: 'EQUIPPED ✓', sqkEquipBtn: '[ EQUIP ]', sqkUnequipBtn: '[ UNEQUIP ]', sqkBuyTpl: '[ BUY — {price} SQK ]', sqkOwnedTpl: 'OWNED ×{n}', sqkPoolTpl: '🏆 PRIZE POOL: {pool} SQK', sqkSeasonTpl: 'SEASON ENDS: {date}', sqkSweepTpl: 'sweep {date}', sqkSwept: 'SWEPT', sqkBalanceTpl: 'SQK BALANCE: {n}', sqkPityTpl: 'PITY: {n} / 20', sqkResolveBtn: '[ RESOLVE CAPSULE ]' };
  const msgFn = k => (msgStub[k] !== undefined ? msgStub[k] : k);
  const msgfFn = (k, vars) => { let s = msgFn(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; };
  const escHtmlH = new Function(fnSrcJ('escHtml') + '\nreturn escHtml;')();
  const sqkStateH = { pool: null, seasonEnd: null, sweepAt: null, swept: false, sqkBalance: null, owned: { 1: 1, 3: 0 }, pity: null };
  const renderSqkH = new Function('$', 'sqkShopDeployed', 'sqkState', 'msg', 'msgf', 'fmt', 'escHtml', 'skinPreviewHtml', 'capsulePreviewHtml', 'sqkPendingCapsule', 'sqkIsEquipped', 'shopSkin', 'SQK_SHOP_CATALOG', 'buySqkItem', 'equipSqkItem', 'unequipSqkItem', 'currentWallet', 'isAddr',
    fnSrcJ('renderSqkShop') + '\nreturn renderSqkShop;')(
    id => sqkEls[id] || null, () => true, sqkStateH, msgFn, msgfFn, () => '2.1', escHtmlH,
    () => '', () => '', () => null,
    new Function('shopSkin', fnSrcJ('sqkIsEquipped') + '\nreturn sqkIsEquipped;')(shopSkin),
    shopSkin, sqkCatalog, () => {}, () => {}, () => {}, () => ADDR, s => /^0x[a-fA-F0-9]{40}$/.test(s || ''));
  resetSkins();
  saveSqkSkin({ note: 'note-sqk-rare', frame: null }); saveSkinLast('note', 'sqk');
  renderSqkH();
  t('v42.5.2 FIX 1 (render SQK): terpasang -> tombol UNEQUIP tampil', sqkEls.sqkShopCatalog.innerHTML.includes('data-sqk-unequip="1"') && !sqkEls.sqkShopCatalog.innerHTML.includes('data-sqk-equip="1"'));
  unequipSqkH(1);
  renderSqkH();
  t('v42.5.2 FIX 1 (render SQK): setelah dilepas -> tombol EQUIP kembali + OWNED tetap', sqkEls.sqkShopCatalog.innerHTML.includes('data-sqk-equip="1"') && !sqkEls.sqkShopCatalog.innerHTML.includes('data-sqk-unequip="1"') && sqkEls.sqkShopCatalog.innerHTML.includes('OWNED ×1'));
  // Toko Keju (fungsi render asli).
  const kejuEls = {};
  ['cheeseBalance', 'shopCatalog', 'capsulePreview'].forEach(id => { kejuEls[id] = fakeEl(); });
  const I18NStub = { en: { equippedLbl: 'EQUIPPED ✓', unequipBtn: '[ UNEQUIP ]', equipBtn: '[ EQUIP ]', ownedLbl: 'OWNED', capsuleOnlyLbl: 'CAPSULE ONLY' } };
  const msgKeju = k => ({ shopBalanceTpl: '🧀 BALANCE: {n}', shopOffline: 'SHOP OFFLINE — CHECK YOUR CONNECTION.', shopBuyTpl: '[ BUY — {price} 🧀 ]' }[k] || k);
  const msgfKeju = (k, vars) => { let s = msgKeju(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; };
  const shopStateR = { balance: 50, items: [{ id: 'note-mint', slot: 'note', equipped: true }], catalog: [{ id: 'note-mint', name: 'Mint Notes', slot: 'note', rarity: 'common', price: 300 }] };
  const shopOwnedH = new Function('shopState', fnSrcJ('shopOwned') + '\nreturn shopOwned;')(shopStateR);
  const shopEquippedH = new Function('shopState', fnSrcJ('shopEquipped') + '\nreturn shopEquipped;')(shopStateR);
  const renderShopH = new Function('$', 'shopState', 'currentWallet', 'isAddr', 'msg', 'msgf', 'I18N', 'lang', 'escHtml', 'skinPreviewHtml', 'capsulePreviewHtml', 'shopOwned', 'shopEquipped', 'buyItem', 'equipItem', 'unequipItem',
    fnSrcJ('renderShop') + '\nreturn renderShop;')(
    id => kejuEls[id] || null, shopStateR, () => ADDR, s => /^0x[a-fA-F0-9]{40}$/.test(s || ''),
    msgKeju, msgfKeju, I18NStub, 'en', escHtmlH,
    () => '', () => '', shopOwnedH, shopEquippedH, () => {}, () => {}, () => {});
  renderShopH();
  t('v42.5.2 FIX 1 (render Keju): terpasang -> tombol UNEQUIP tampil', kejuEls.shopCatalog.innerHTML.includes('data-unequip="note"') && !kejuEls.shopCatalog.innerHTML.includes('data-equip="note-mint"'));
  shopStateR.items[0].equipped = false;
  renderShopH();
  t('v42.5.2 FIX 1 (render Keju): setelah dilepas -> tombol EQUIP kembali + OWNED tetap', kejuEls.shopCatalog.innerHTML.includes('data-equip="note-mint"') && !kejuEls.shopCatalog.innerHTML.includes('data-unequip="note"') && kejuEls.shopCatalog.innerHTML.includes('OWNED'));

  // --- FIX 2: submit tahan koneksi lambat — fungsi submitLb asli ---
  const MSG = new Function(js.slice(js.indexOf('const MSG = {'), js.indexOf('function msg(k)')) + '\nreturn MSG;')();
  const msgReal = new Function('MSG', 'lang', fnSrcJ('msg') + '\n' + fnSrcJ('msgf') + '\nreturn { msg, msgf };')(MSG, 'id');
  const verifyBadgeTextH = new Function(fnSrcJ('verifyBadgeText') + '\nreturn verifyBadgeText;')();
  const verifyRejectedTextH = new Function('msgf', fnSrcJ('verifyRejectedText') + '\nreturn verifyRejectedText;')(msgReal.msgf);
  const isTimeoutH = new Function(fnSrcJ('isTimeoutError') + '\nreturn isTimeoutError;')();
  const mkSubmit = (tfetchMock, pollVerifyMock) => {
    const msgEl = { textContent: '', classList: mockClassList() };
    const btnEl = { disabled: false, classList: mockClassList() };
    const $s = id => (id === 'lbSubmitMsg' ? msgEl : id === 'lbSubmitBtn' ? btnEl : null);
    const lastResult = { score: 61495, acc: 73.05, mode: 'live', sessionId: 's1', notes: 235, taps: 200, durationMs: 60000, replay: { header: {}, events: {} }, replayHash: '0xabc123', lullaby: false, practice: false };
    const submit = new Function('lastResult', 'currentWallet', 'isAddr', 'lbName', 'lbMode', 'analyticsEvent', 'fetchLb', 'fetchShop', 'fetchLeagueWeekly', 'pollVerify', 'saveJSON', 'renderLbModes', '$', 'stopVerifyPoll', 'msg', 'msgf', 'CONFIG', 'tfetch', 'lbState', 'verifyBadgeText', 'verifyRejectedText', 'isTimeoutError',
      fnSrcJ('submitLb') + '\nreturn submitLb;')(
      lastResult, () => ADDR, s => /^0x[a-fA-F0-9]{40}$/.test(s || ''), () => 'TEST', m => m, () => {}, () => {}, () => {}, () => {},
      pollVerifyMock, () => {}, () => {}, $s, () => {}, msgReal.msg, msgReal.msgf, { LB_URL: 'https://lb.test' }, tfetchMock, { mode: 'live' },
      verifyBadgeTextH, verifyRejectedTextH, isTimeoutH);
    return { submit, msgEl, btnEl };
  };
  const pollOk = (hash, onStatus) => { onStatus('verified', { replayHash: hash, signature: '0x12345678' }); };
  // (a) gagal sekali (timeout) lalu berhasil -> retry otomatis, skor terverifikasi.
  let callsA = 0;
  const tfetchA = async () => {
    callsA++;
    if (callsA === 1) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
    return { status: 202, ok: true, json: async () => ({ ok: true, pending: true, replayHash: '0xabc123' }) };
  };
  const hA = mkSubmit(tfetchA, pollOk);
  await hA.submit();
  t('v42.5.2 FIX 2: submit gagal timeout sekali -> retry otomatis (2 percobaan)', callsA === 2);
  t('v42.5.2 FIX 2: retry berhasil -> skor TERVERIFIKASI', hA.msgEl.textContent.includes('TERVERIFIKASI ✓'));
  // (b) selalu timeout -> 2 percobaan lalu pesan KONEKSI LAMBAT, tombol aktif lagi.
  let callsB = 0;
  const tfetchB = async () => { callsB++; const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
  const hB = mkSubmit(tfetchB, pollOk);
  await hB.submit();
  t('v42.5.2 FIX 2: selalu timeout -> tepat 2 percobaan (1 retry)', callsB === 2);
  t('v42.5.2 FIX 2: selalu timeout -> pesan KONEKSI LAMBAT (bukan offline generik)', hB.msgEl.textContent.includes('KONEKSI LAMBAT'));
  t('v42.5.2 FIX 2: selalu timeout -> tombol SUBMIT aktif lagi', hB.btnEl.disabled === false);
  // (c) 429 -> TIDAK di-retry, pesan rate limit.
  let callsC = 0;
  const tfetchC = async () => { callsC++; return { status: 429, ok: false, json: async () => ({ error: 'rate_limited', retryAfterSec: 600 }) }; };
  const hC = mkSubmit(tfetchC, pollOk);
  await hC.submit();
  t('v42.5.2 FIX 2: 429 -> TIDAK di-retry (1 percobaan)', callsC === 1);
  t('v42.5.2 FIX 2: 429 -> pesan TERLALU SERING', hC.msgEl.textContent.includes('TERLALU SERING'));
  // (d) 422 -> TIDAK di-retry.
  let callsD = 0;
  const tfetchD = async () => { callsD++; return { status: 422, ok: false, json: async () => ({ error: 'bad replay' }) }; };
  const hD = mkSubmit(tfetchD, pollOk);
  await hD.submit();
  t('v42.5.2 FIX 2: 422 -> TIDAK di-retry (1 percobaan)', callsD === 1);
  // isTimeoutError unit.
  t('v42.5.2 FIX 2: isTimeoutError AbortError -> true', isTimeoutH({ name: 'AbortError' }) === true);
  t('v42.5.2 FIX 2: isTimeoutError TimeoutError -> true', isTimeoutH({ name: 'TimeoutError' }) === true);
  t('v42.5.2 FIX 2: isTimeoutError TypeError -> false', isTimeoutH({ name: 'TypeError' }) === false);
  t('v42.5.2 FIX 2: isTimeoutError null -> false', isTimeoutH(null) === false);
  // Statis: timeout baru + gameVersion + kunci i18n + Worker v12.
  t('v42.5.2 FIX 2: POST /scores timeout 30 detik', js.includes('body: JSON.stringify(body) }, 30000)'));
  t('v42.5.2 FIX 2: GET /scores, /rank, /verify timeout 20 detik', js.includes("'/scores?mode=' + lbState.mode + '&limit=10', null, 20000)") && js.includes("'/rank?wallet=' + w + '&mode=' + lbState.mode, null, 20000)") && js.includes('encodeURIComponent(replayHash), null, 20000)') && js.includes('encodeURIComponent(lastVerifyHash), null, 20000)'));
  t('v43: gameVersion v43', js.includes("gameVersion: 'v43'"));
  t('v42.5.2 FIX 1: kunci i18n UNEQUIP EN+ID ada', js.includes("sqkUnequipBtn: '[ UNEQUIP ]'") && js.includes("sqkUnequipped: 'UNEQUIPPED: {item} ✓ — BACK TO DEFAULT.'") && js.includes("sqkUnequipBtn: '[ LEPAS ]'") && js.includes("sqkUnequipped: 'DILEPAS: {item} ✓ — KEMBALI KE DEFAULT.'") && js.includes("shopUnequipped: 'UNEQUIPPED {item} ✓'") && js.includes("shopUnequipped: 'DILEPAS {item} ✓'") && js.includes("unequipBtn: '[ UNEQUIP ]'") && js.includes("unequipBtn: '[ LEPAS ]'"));
  t('v42.5.2 FIX 1: Worker v12 punya POST /cheese/unequip + UPDATE equipped=0', worker.includes('"/cheese/unequip"') && worker.includes('UPDATE cheese_inventory SET equipped = 0') && worker.includes('version: 13'));
  t('v42.5.2 FIX 1: render toko memakai data-unequip / data-sqk-unequip', js.includes('data-unequip=') && js.includes('data-sqk-unequip='));
  t('v43: index.html judul v43', html.includes('<title>SQUEEKCHAIN // v43</title>') && html.includes('PIXEL ID // v43'));
}

// --- 13. v42.5.2 FIX 3: WalletConnect session restore ---
async function runWcRestoreTests4252() {
  const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
  const isAddrH = s => /^0x[a-fA-F0-9]{40}$/.test(s || '');
  const msgfH = (k, vars) => k === 'wcRestoreNoteTpl' ? ('WC RESTORE FAILED: ' + (vars && vars.reason) + ' — TAP [ CONNECT WALLET ] TO RECONNECT.') : k;
  const mkStore = (keys) => ({ _k: keys.slice(), get length() { return this._k.length; }, key(i) { return this._k[i]; } });
  const mkProvider = (opts) => {
    const calls = [];
    return { calls,
      accounts: opts.accounts || [],
      session: ('session' in opts) ? opts.session : null,
      connected: true,
      on: () => {},
      request: async ({ method }) => { calls.push(['request', method]); if (method === 'eth_accounts') return opts.ethAccounts || []; return []; },
      enable: async () => { calls.push(['enable']); if (opts.enableReject) throw new Error('rejected'); return opts.enableAccounts || []; },
      connect: async () => { calls.push(['connect']); },
      disconnect: async () => { calls.push(['disconnect']); },
    };
  };
  // Harness: fungsi WC asli diekstrak dengan local bersama. setTimeout
  // dibayangi fake supaya watchdog 60 detik tidak menahan proses tes;
  // fake mencatat durasi watchdog sehingga tes bisa membuktikan 60 s.
  const mkHarness = (deps) => {
    const timers = [];
    const fakeSetTimeout = (fn, ms) => { const rec = { fn, ms }; timers.push(rec); return rec; };
    const mockWindow = deps.window;
    const mockDoc = deps.document;
    const noteEl = mockEl();
    let connectedAddr = null;
    const walletEl = { value: '' };
    const src = ['hasWcSessionKey', 'wcLoadBundle', 'wcGetProvider', 'restoreWalletConnectSession', 'setWcRestoreNote'].map(fnSrcJ).join('\n');
    const fn = new Function('window', 'document', 'localStorage', 'CONFIG', '$', 'walletEl', 'saveWallet38', 'preview', 'setConnected', 'isAddr', 'msg', 'msgf', 'say', 'fakeSetTimeout',
      'const setTimeout = fakeSetTimeout;\nlet wcProvider = null;\nlet wcBundlePromise = null;\nlet wcRestoreReason = null;\n' + src +
      '\nreturn { hasWcSessionKey, wcLoadBundle, wcGetProvider, restoreWalletConnectSession, setWcRestoreNote, getWcProvider: () => wcProvider, getReason: () => wcRestoreReason };');
    const api = fn(mockWindow, mockDoc, deps.localStorage,
      { WC_PROJECT_ID: 'x', WC_CHAINS: [11155111], SEPOLIA_RPC: 'https://rpc.test' },
      id => (id === 'wcRestoreNote' ? noteEl : null), walletEl, () => {}, () => {},
      (a) => { connectedAddr = a; }, isAddrH, k => k, msgfH, () => {}, fakeSetTimeout);
    return { api, timers, noteEl, mockWindow, getConnected: () => connectedAddr, walletEl };
  };
  const mkWindow = (ethProvider) => { const w = {}; if (ethProvider) w.EthereumProvider = ethProvider; return w; };

  // 1. Sesi tersimpan + passive kosong -> enable() mengembalikan akun -> TERHUBUNG, tanpa modal.
  {
    let initOpts = null;
    const p = mkProvider({ accounts: [], session: { topic: 't1' }, ethAccounts: [], enableAccounts: [ADDR] });
    const h = mkHarness({ window: mkWindow({ init: async (opts) => { initOpts = opts; return p; } }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    await h.api.restoreWalletConnectSession();
    t('v42.5.2 FIX 3: sesi + enable() -> TERHUBUNG', h.getConnected() === ADDR && h.walletEl.value === ADDR);
    t('v42.5.2 FIX 3: restore memanggil enable() (bukan hanya baca pasif)', p.calls.some(c => c[0] === 'enable'));
    t('v42.5.2 FIX 3: restore TIDAK memanggil connect() (tanpa modal)', !p.calls.some(c => c[0] === 'connect'));
    t('v42.5.2 FIX 3: restore init memakai showQrModal:false', initOpts && initOpts.showQrModal === false);
    t('v42.5.2 FIX 3: restore sukses -> provider di-cache + note bersih', h.api.getWcProvider() === p && h.api.getReason() === null && h.noteEl.classList.contains('hidden'));
  }
  // 2. Tanpa kunci sesi -> enable() TIDAK dipanggil, provider TIDAK dibuat.
  {
    let inits = 0;
    const p = mkProvider({ accounts: [], session: { topic: 't1' }, enableAccounts: [ADDR] });
    const h = mkHarness({ window: mkWindow({ init: async () => { inits++; return p; } }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore([]) });
    await h.api.restoreWalletConnectSession();
    t('v42.5.2 FIX 3: tanpa kunci sesi -> enable() TIDAK dipanggil + init TIDAK jalan', !p.calls.some(c => c[0] === 'enable') && inits === 0 && h.getConnected() === null);
    t('v42.5.2 FIX 3: tanpa kunci sesi -> alasan no-session-key, note tetap tersembunyi', h.api.getReason() === 'no-session-key' && h.noteEl.classList.contains('hidden'));
  }
  // 3. Bundle lambat -> restore menunggu (watchdog 60 s) dan berhasil.
  {
    let initOpts = null;
    const p = mkProvider({ accounts: [], session: { topic: 't1' }, ethAccounts: [], enableAccounts: [ADDR] });
    let scriptEl = null;
    const mockWindow = mkWindow(undefined); // bundle belum dimuat
    const h = mkHarness({ window: mockWindow, document: { createElement: () => { scriptEl = { src: '', onload: null, onerror: null }; return scriptEl; }, head: { appendChild: () => {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    const restoreP = h.api.restoreWalletConnectSession();
    await new Promise(r => setTimeout(r, 50)); // bundle "diunduh" 50 ms kemudian
    mockWindow.EthereumProvider = { init: async (opts) => { initOpts = opts; return p; } };
    scriptEl.onload();
    await restoreP;
    t('v42.5.2 FIX 3: bundle lambat -> restore menunggu dan TERHUBUNG', h.getConnected() === ADDR);
    t('v42.5.2 FIX 3: watchdog restore 60 detik (bukan 15)', h.timers.some(rec => rec.ms === 60000));
    t('v42.5.2 FIX 3: restore init showQrModal:false saat bundle lambat', initOpts && initOpts.showQrModal === false);
  }
  // 4. enable() reject -> tanpa modal, tetap disconnected, alasan terlihat.
  {
    const p = mkProvider({ accounts: [], session: { topic: 't1' }, ethAccounts: [], enableReject: true });
    const h = mkHarness({ window: mkWindow({ init: async () => p }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    await h.api.restoreWalletConnectSession();
    t('v42.5.2 FIX 3: enable() reject -> tetap disconnected, tanpa modal', h.getConnected() === null && !p.calls.some(c => c[0] === 'connect') && h.api.getWcProvider() === null);
    t('v42.5.2 FIX 3: enable() reject -> alasan enable-rejected tampil di note', h.api.getReason() === 'enable-rejected' && !h.noteEl.classList.contains('hidden') && h.noteEl.textContent.includes('enable-rejected'));
  }
  // 5. Passive read berhasil -> enable() TIDAK dipanggil.
  {
    const p = mkProvider({ accounts: [ADDR], session: { topic: 't1' } });
    const h = mkHarness({ window: mkWindow({ init: async () => p }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    await h.api.restoreWalletConnectSession();
    t('v42.5.2 FIX 3: akun pasif ada -> TERHUBUNG tanpa enable()', h.getConnected() === ADDR && !p.calls.some(c => c[0] === 'enable'));
  }
  // 6. Kunci ada tapi p.session kosong -> enable() TIDAK dipanggil (tidak ada yang diaktifkan).
  {
    const p = mkProvider({ accounts: [], session: null, ethAccounts: [] });
    const h = mkHarness({ window: mkWindow({ init: async () => p }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    await h.api.restoreWalletConnectSession();
    t('v42.5.2 FIX 3: tanpa p.session -> enable() TIDAK dipanggil, alasan no-accounts', !p.calls.some(c => c[0] === 'enable') && !p.calls.some(c => c[0] === 'connect') && h.api.getReason() === 'no-accounts' && h.getConnected() === null);
    t('v42.5.2 FIX 3: no-accounts tampil di note', !h.noteEl.classList.contains('hidden') && h.noteEl.textContent.includes('no-accounts'));
  }
  // 7. Connect manual tetap memakai modal (wcGetProvider() default).
  {
    let initOpts = null;
    const p = mkProvider({ accounts: [ADDR] });
    const h = mkHarness({ window: mkWindow({ init: async (opts) => { initOpts = opts; return p; } }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore([]) });
    await h.api.wcGetProvider();
    t('v42.5.2 FIX 3: connect manual -> showQrModal:true', initOpts && initOpts.showQrModal === true);
  }
  // 8. Bundle gagal total (onerror) -> alasan bundle-timeout, tetap disconnected.
  {
    let scriptEl = null;
    const mockWindow = mkWindow(undefined);
    const h = mkHarness({ window: mockWindow, document: { createElement: () => { scriptEl = { src: '', onload: null, onerror: null }; return scriptEl; }, head: { appendChild: () => {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    const restoreP = h.api.restoreWalletConnectSession();
    await new Promise(r => setTimeout(r, 10));
    scriptEl.onerror();
    await restoreP;
    t('v42.5.2 FIX 3: bundle gagal -> alasan bundle-timeout, note tampil', h.api.getReason() === 'bundle-timeout' && h.getConnected() === null && !h.noteEl.classList.contains('hidden') && h.noteEl.textContent.includes('bundle-timeout'));
  }
  // Statis.
  t('v42.5.2 FIX 3: preload bundle di page load hanya bila kunci sesi ada', js.includes("if (!window.ethereum && hasWcSessionKey()) wcLoadBundle(60000);"));
  t('v42.5.2 FIX 3: elemen note ada di HTML + i18n EN/ID', html.includes('id="wcRestoreNote"') && js.includes("wcRestoreNoteTpl: 'WC RESTORE FAILED: {reason}") && js.includes("wcRestoreNoteTpl: 'WC RESTORE GAGAL: {reason}"));
}

(async () => {
  await runRateLimitTests();
  await runWalletTests42();
  await runDreamTests42();
  await runBugFixTests4251();
  await runBugFixTests4252();
  await runWcRestoreTests4252();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
