// v43.4 — run: node TEST-v43.4.js  (cwd = the v43.4 folder)
// GATE wallet-linked displays on the ACTUAL connection (connectedAddr):
// the profile card ("YOUR PIXEL SELF"), the Cheese + SQK shops
// (balances, OWNED markers, EQUIP/BUY/capsule buttons), and the
// leaderboard / weekly-league "your rank" highlight + rank text now show
// ONLY when a wallet is connected. A remembered/manual address
// (localStorage 'sqk38:wallet') is NOT a connection — v43.3 showed all of
// it while GUEST, which the user reported as inconsistent/embarrassing
// (9 Nov 2026, 21:08 WIB). The item catalog (names, colours, prices,
// capsule odds) stays public. Buying still needs a connected wallet
// (permit + tx) and keeps working when connected.
// Carried over from v43.3 (unchanged behaviour, still tested): persistent
// IndexedDB bundle cache; injected provider first; address NEVER shown
// when not connected; patient restore (5 min) + anti-duplicate.
// BATAS KERAS: engine.js + worker.js byte-identik v43.3, 14 chart golden
// identik, judgement windows + formula skor tidak berubah, Worker tetap
// v13, 3 bukti Genesis utuh, tanpa CDN/dependensi baru.
const fs = require('fs');
const SqueekEngine = require('./engine.js');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
const jsLines = js.split('\n');
// v43.1: code without comments — the "deleted" assertions must not trip on
// the comments that DOCUMENT the deletion (e.g. the unpkg history note).
const jsCode = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const golden = JSON.parse(fs.readFileSync('TEST-v40-golden-charts.json', 'utf8'));

let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- extractors (same pattern as TEST-v42.5.4-restore-ui.js) ---
function fnSrc(lines, name) {
  const start = lines.findIndex(l => l.startsWith('function ' + name + '(') || l.startsWith('async function ' + name + '('));
  if (start < 0) throw new Error('function not found: ' + name);
  let depth = 0, end = start;
  for (let i = start; i < lines.length; i++) { for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return lines.slice(start, end + 1).join('\n');
}
function fnSrcJ(name) { return fnSrc(jsLines, name); }
function mockClassList() {
  const set = new Set();
  return {
    toggle(cls, force) { if (force === undefined) { if (set.has(cls)) set.delete(cls); else set.add(cls); } else if (force) set.add(cls); else set.delete(cls); },
    add(cls) { set.add(cls); }, remove(cls) { set.delete(cls); },
    contains(cls) { return set.has(cls); },
  };
}
function mockEl() { return { textContent: '', disabled: false, readOnly: false, value: '', classList: mockClassList(), addEventListener() {} }; }

const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
const BUNDLE_CODE = '/* fake wc bundle */ window.EthereumProvider = { init: async () => null }; '.repeat(50); // >1000 chars, like the real 2.1 MB bundle

// --- Mock IndexedDB (in-memory, event-handler API like the real one) ---
function mkMockIdb() {
  const dbs = {};
  function mkDb(name) {
    return {
      close() {},
      createObjectStore(storeName) { if (!dbs[name].stores[storeName]) dbs[name].stores[storeName] = new Map(); },
      transaction(storeName, mode) {
        return {
          objectStore() {
            const getMap = () => {
              if (!dbs[name].stores[storeName]) dbs[name].stores[storeName] = new Map();
              return dbs[name].stores[storeName];
            };
            return {
              get(key) {
                const req = { result: undefined, onsuccess: null, onerror: null };
                setTimeout(() => { req.result = getMap().get(key); if (req.onsuccess) req.onsuccess(); }, 0);
                return req;
              },
              put(value, key) {
                const req = { result: undefined, onsuccess: null, onerror: null };
                setTimeout(() => { getMap().set(key, value); if (req.onsuccess) req.onsuccess(); }, 0);
                return req;
              },
            };
          },
        };
      },
    };
  }
  return {
    open(dbName, version) {
      const req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      setTimeout(() => {
        const isNew = !dbs[dbName];
        if (isNew) dbs[dbName] = { stores: {} };
        req.result = mkDb(dbName);
        if (isNew && req.onupgradeneeded) { try { req.onupgradeneeded(); } catch (_) {} }
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    },
    _dbs: dbs,
  };
}

// --- Mock document: <script> elements "load" on next tick ---
function mkMockDoc(win, opts) {
  let mode = (opts && opts.mode) || 'ok'; // ok | fail | noglobal
  const created = [];
  return {
    setMode(m) { mode = m; },
    created,
    createElement(tag) {
      if (tag !== 'script') throw new Error('only script in mock');
      const el = { src: '', onload: null, onerror: null };
      created.push(el);
      return el;
    },
    head: {
      appendChild(el) {
        setTimeout(() => {
          if (mode === 'ok') {
            win.EthereumProvider = (opts && opts.ethereumProvider) || { init: async () => null };
            if (el.onload) el.onload();
          } else if (mode === 'noglobal') {
            if (el.onload) el.onload(); // loads, but sets NO global
          } else {
            if (el.onerror) el.onerror();
          }
        }, 0);
      },
    },
  };
}

// --- Mock fetch for the bundle text ---
function mkMockFetch(bundleCode) {
  let calls = 0;
  const fn = async (url) => {
    calls++;
    if (bundleCode === null) throw new Error('offline');
    return { ok: true, text: async () => bundleCode };
  };
  fn.calls = () => calls;
  return fn;
}

// --- Part A harness: only the bundle-loading functions ---
function mkBundleHarness(deps) {
  const src = ['wcIdbOpen', 'wcIdbGet', 'wcIdbPut', 'wcIdbCacheBundle', 'wcInjectCode', 'wcFetchBundleText', 'wcLoadBundleNetwork', 'wcLoadBundle'].map(fnSrcJ).join('\n');
  const consts = ['WC_BUNDLE_VERSION', 'WC_IDB_DB', 'WC_IDB_STORE'].map(n => jsLines.find(l => l.startsWith('const ' + n + ' ='))).join('\n');
  const fn = new Function('window', 'document', 'indexedDB', 'fetch', 'Blob', 'URL', 'setTimeout',
    'let wcBundlePromise = null;\n' + consts + '\n' + src +
    '\nreturn { wcIdbOpen, wcIdbGet, wcIdbPut, wcIdbCacheBundle, wcInjectCode, wcFetchBundleText, wcLoadBundleNetwork, wcLoadBundle };');
  return fn(deps.window, deps.document, deps.indexedDB, deps.fetch, Blob, URL, setTimeout);
}

async function runBundleTests() {
  // A1: IndexedDB round-trip — cache, then read back the exact code.
  {
    const idb = mkMockIdb();
    const win = {};
    const api = mkBundleHarness({ window: win, document: mkMockDoc(win), indexedDB: idb, fetch: mkMockFetch(null) });
    api.wcIdbCacheBundle(BUNDLE_CODE);
    await sleep(30);
    const db = await api.wcIdbOpen();
    const back = await api.wcIdbGet(db, 'bundle-v1');
    t('v43.4 IDB: simpan -> muat kembali kode bundle yang sama persis', back === BUNDLE_CODE);
  }
  // A2: cold load — empty IDB + fetch OK -> injects, sets the global, caches.
  {
    const idb = mkMockIdb();
    const win = {};
    const fetchMock = mkMockFetch(BUNDLE_CODE);
    const api = mkBundleHarness({ window: win, document: mkMockDoc(win), indexedDB: idb, fetch: fetchMock });
    const ok = await api.wcLoadBundle(15000);
    await sleep(30); // fire-and-forget cache write
    const db = await api.wcIdbOpen();
    const cached = await api.wcIdbGet(db, 'bundle-v1');
    t('v43.4 IDB: load dingin (IDB kosong) -> fetch jaringan -> injeksi -> true + global ada', ok === true && typeof win.EthereumProvider !== 'undefined');
    t('v43.4 IDB: load dingin meng-cache kode bundle untuk kunjungan berikut', cached === BUNDLE_CODE);
    t('v43.4 IDB: load dingin memakai fetch tepat 1x', fetchMock.calls() === 1);
  }
  // A3: warm load — IDB has the code -> NO network fetch at all.
  {
    const idb = mkMockIdb();
    const win = {};
    const fetchMock = mkMockFetch(BUNDLE_CODE);
    const api1 = mkBundleHarness({ window: win, document: mkMockDoc(win), indexedDB: idb, fetch: fetchMock });
    await api1.wcLoadBundle(15000); // fills the cache
    await sleep(30);
    // Fresh harness instance (fresh wcBundlePromise) sharing the same IDB.
    const win2 = {};
    const fetchMock2 = mkMockFetch(BUNDLE_CODE);
    const api2 = mkBundleHarness({ window: win2, document: mkMockDoc(win2), indexedDB: idb, fetch: fetchMock2 });
    const ok = await api2.wcLoadBundle(15000);
    t('v43.4 IDB: load hangat (cache ada) -> true TANPA fetch jaringan', ok === true && fetchMock2.calls() === 0 && typeof win2.EthereumProvider !== 'undefined');
  }
  // A4: no IDB + fetch failing -> falls back to <script src> (v42.3 path).
  {
    const win = {};
    const doc = mkMockDoc(win);
    const api = mkBundleHarness({ window: win, document: doc, indexedDB: undefined, fetch: mkMockFetch(null) });
    const ok = await api.wcLoadBundle(15000);
    const scriptEl = doc.created[0];
    t('v43.4 IDB: tanpa IndexedDB + fetch gagal -> fallback <script src> -> true', ok === true && scriptEl && scriptEl.src === 'wc-provider.bundle.js');
  }
  // A5: everything failing -> false; then retry with a working script -> true (promise reset).
  {
    const win = {};
    const doc = mkMockDoc(win, { mode: 'fail' });
    const api = mkBundleHarness({ window: win, document: doc, indexedDB: undefined, fetch: mkMockFetch(null) });
    const ok1 = await api.wcLoadBundle(15000);
    t('v43.4 IDB: semua jalur gagal -> false', ok1 === false);
    doc.setMode('ok');
    const ok2 = await api.wcLoadBundle(15000);
    t('v43.4 IDB: gagal total TIDAK mengunci — percobaan berikut bisa sukses lagi', ok2 === true);
  }
  // A6: script loads but sets no global -> false (injection is verified, not assumed).
  {
    const win = {};
    const doc = mkMockDoc(win, { mode: 'noglobal' });
    const api = mkBundleHarness({ window: win, document: doc, indexedDB: mkMockIdb(), fetch: mkMockFetch(null) });
    const ok = await api.wcInjectCode('var x = 1; '.repeat(200));
    t('v43.4 IDB: injeksi tanpa global -> false', ok === false && typeof win.EthereumProvider === 'undefined');
  }
  // A7: wcIdbOpen with no IndexedDB -> null (graceful, never throws).
  {
    const win = {};
    const api = mkBundleHarness({ window: win, document: mkMockDoc(win), indexedDB: undefined, fetch: mkMockFetch(null) });
    const db = await api.wcIdbOpen();
    t('v43.4 IDB: tanpa IndexedDB -> null (fallback anggun)', db === null);
  }
}

// --- Part B harness: the whole WC section, sliced like TEST-v34-neo ---
function mkConnectHarness(opts) {
  const store = {};
  const fakeLocalStorage = {
    get length() { return Object.keys(store).length; },
    key(i) { return Object.keys(store)[i] || null; },
    getItem(k) { return store[k] === undefined ? null : store[k]; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
  };
  if (opts && opts.wcKeys) { store['wc@2:client:0.3:xyz'] = '{}'; }
  const ethCalls = [];
  const mockEth = (opts && opts.injected) ? {
    request: async ({ method }) => {
      ethCalls.push(method);
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [ADDR];
      if (method === 'eth_chainId') return '0xaa36a7';
      return null;
    },
    on: (ev, fn) => {},
  } : undefined;
  const mockWcProvider = {
    calls: [],
    accounts: [],
    session: (opts && opts.wcSession) ? { topic: 't1' } : null,
    connected: true,
    request: async ({ method }) => { mockWcProvider.calls.push(['request', method]); if (method === 'eth_requestAccounts' || method === 'eth_accounts') return (opts && opts.wcEthAccounts !== undefined) ? opts.wcEthAccounts : [ADDR]; return []; },
    enable: async () => { mockWcProvider.calls.push(['enable']); return [ADDR]; },
    connect: async () => { mockWcProvider.calls.push(['connect']); },
    disconnect: async () => { mockWcProvider.calls.push(['disconnect']); },
    on: (ev, fn) => {},
  };
  const win = { ethereum: mockEth };
  if (opts && opts.wc) win.EthereumProvider = { init: async () => mockWcProvider };
  const walletEl = { value: '', readOnly: false, addEventListener() {} };
  const els = {
    walletDot: mockEl(), walletAddr: mockEl(), walletCopyBtn: mockEl(),
    connectBtn: mockEl(), disconnectBtn: mockEl(), wcRestoreNote: mockEl(),
    walletManualNote: mockEl(), walletManualRow: mockEl(),
  };
  els.connectBtn.textContent = 'CONNECT';
  const said = [];
  const I18Nstub = { en: { connect: 'CONNECT', connectedTpl: '[ CONNECTED: {addr} ]' }, id: { connect: 'HUBUNGKAN', connectedTpl: '[ TERHUBUNG: {addr} ]' } };
  const MSGstub = {
    walletConnected: 'WALLET CONNECTED: {addr} — ADDRESS ONLY, NO SIGNATURE REQUESTED.',
    walletConnectedTpl: 'WALLET CONNECTED: {addr} • Transactions use THIS address.',
    walletSwitched: 'WALLET SWITCHED TO {addr}.', walletDisconnected: 'WALLET DISCONNECTED.', walletInvalid: 'WALLET RETURNED NO VALID ADDRESS.',
    wcRestoring: 'RECONNECTING…', wcRestoreNoteTpl: 'WC RESTORE FAILED: {reason}',
  };
  const msgStub = k => MSGstub[k] || I18Nstub.en[k] || k;
  const msgfStub = (k, vars) => { let s = msgStub(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; };
  const isAddrStub = s => /^0x[a-fA-F0-9]{40}$/.test(s || '');
  const doc = mkMockDoc(win, { ethereumProvider: win.EthereumProvider });
  const api = new Function('window', 'localStorage', 'document', '$', 'msg', 'msgf', 'isAddr', 'walletEl', 'saveWallet38', 'preview', 'say', 'CONFIG', 'I18N', 'lang', 'indexedDB', 'fetch', 'Blob', 'URL',
    js.slice(js.indexOf('let wcProvider = null; // active WalletConnect provider'), js.indexOf("bindClick('connectBtn'")) +
    '\nreturn { connectWallet, disconnectWallet, setConnected, updateConnectBtn, restoreWalletConnectSession, restoreInjectedSession, connectWalletConnect, getEth, getConnectedVia: () => connectedVia, getWcProvider: () => wcProvider, getConnectedAddr: () => connectedAddr };')(
    win, fakeLocalStorage, doc,
    id => els[id] || null, msgStub, msgfStub, isAddrStub, walletEl, () => {}, () => {}, (m) => said.push(m),
    { WC_PROJECT_ID: 'x', WC_CHAINS: [11155111], SEPOLIA_RPC: 'https://rpc.test', SHOP_ADDRESS: '0x0000000000000000000000000000000000000000' },
    I18Nstub, 'en', mkMockIdb(), mkMockFetch(BUNDLE_CODE), Blob, URL);
  return { api, win, walletEl, els, ethCalls, mockWcProvider, doc, said, store };
}

async function runConnectTests() {
  // B1: injected provider first — connectWallet uses window.ethereum, never touches WC.
  {
    const h = mkConnectHarness({ injected: true });
    await h.api.disconnectWallet(); // undo the auto-restore at construction
    h.ethCalls.length = 0;
    await h.api.connectWallet();
    t('v43.4 injected: connectWallet memakai window.ethereum (eth_requestAccounts)', h.ethCalls.includes('eth_requestAccounts'));
    t('v43.4 injected: connectedVia = injected', h.api.getConnectedVia() === 'injected');
    t('v43.4 injected: bundle WC TIDAK pernah dimuat (tanpa script, tanpa EthereumProvider)', h.doc.created.length === 0 && typeof h.win.EthereumProvider === 'undefined');
    t('v43.4 injected: getEth() mengembalikan provider injected', h.api.getEth() === h.win.ethereum);
  }
  // B2: getEth prefers the ACTUALLY connected provider.
  {
    const h = mkConnectHarness({ wc: true, wcKeys: true, wcSession: true });
    await sleep(50); // let the background preload settle
    await h.api.connectWalletConnect();
    t('v43.4 getEth: terhubung via WC -> getEth() mengembalikan wcProvider', h.api.getEth() === h.mockWcProvider && h.api.getConnectedVia() === 'wc');
  }
  // B3: address NEVER shown when not connected; shown when connected.
  {
    const h = mkConnectHarness({});
    h.walletEl.value = ADDR; // typed / remembered address
    h.api.updateConnectBtn();
    t('v43.4 alamat: belum connect -> kartu TAMU (alamat TIDAK tampil)', h.els.walletAddr.textContent === 'GUEST');
    t('v43.4 alamat: belum connect -> salin tersembunyi, CONNECT tampil', h.els.walletCopyBtn.classList.contains('hidden') === true && h.els.connectBtn.classList.contains('hidden') === false);
    // Now connect via WC (mock) and check the card shows the address once.
    const h2 = mkConnectHarness({ wc: true });
    await h2.api.connectWalletConnect();
    t('v43.4 alamat: sudah connect -> kartu tampil singkat 0x8853...cf9a + salin muncul + CONNECT hilang', h2.els.walletAddr.textContent === '0x8853...cf9a' && h2.els.walletCopyBtn.classList.contains('hidden') === false && h2.els.connectBtn.classList.contains('hidden') === true);
  }
  // B4: anti-duplicate — connect with a stored session reuses it via enable(), never connect().
  {
    const h = mkConnectHarness({ wc: true, wcKeys: true, wcSession: true });
    await sleep(50);
    h.mockWcProvider.calls.length = 0;
    await h.api.connectWalletConnect();
    t('v43.4 anti-duplikat: CONNECT memakai ulang sesi tersimpan via enable()', h.mockWcProvider.calls.some(c => c[0] === 'enable'));
    t('v43.4 anti-duplikat: TIDAK ada pairing baru (connect() tidak dipanggil)', !h.mockWcProvider.calls.some(c => c[0] === 'connect'));
    t('v43.4 anti-duplikat: terhubung + connectedVia = wc', h.api.getConnectedAddr() === ADDR && h.api.getConnectedVia() === 'wc');
  }
  // B5: restore reuses the stored session (enable, no connect, no modal).
  // NOTE: the mock's passive eth_accounts read is EMPTY here, so the
  // restore must go through enable() — exactly like the real case where
  // p.accounts / eth_accounts return [] on an un-activated provider.
  {
    const h = mkConnectHarness({ wc: true, wcKeys: true, wcSession: true, wcEthAccounts: [] });
    await sleep(50);
    h.mockWcProvider.calls.length = 0;
    await h.api.disconnectWallet();
    h.mockWcProvider.calls.length = 0;
    await h.api.restoreWalletConnectSession();
    t('v43.4 restore: memakai ulang sesi via enable() (tanpa connect/modal)', h.mockWcProvider.calls.some(c => c[0] === 'enable') && !h.mockWcProvider.calls.some(c => c[0] === 'connect'));
    t('v43.4 restore: TERHUBUNG kembali', h.api.getConnectedAddr() === ADDR);
  }
  // B6: restore with no session key -> nothing happens (no init, no connect).
  {
    const h = mkConnectHarness({ wc: true });
    await sleep(50);
    t('v43.4 restore: tanpa kunci sesi -> tetap tidak terhubung', h.api.getConnectedAddr() === null);
  }
}

// ============================================================
// PART C — v43.4: wallet-linked display gating (connectedAddr)
// Harness: real render functions extracted by name (fnSrcJ),
// run in a sandboxed new Function with a mock DOM + stubs.
// Rule: NOT connected (connectedAddr null) => profile card hidden,
// shop balances "—", no OWNED / EQUIP / BUY, no rank highlight.
// Connected => everything renders exactly as v43.3.
// ============================================================
const GATE_ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
const GATE_OTHER = '0x1111111111111111111111111111111111111111';
function mkGateEl() {
  const cls = new Set();
  return {
    textContent: '', innerHTML: '', value: '', disabled: false, readOnly: false,
    classList: {
      add(c) { cls.add(c); }, remove(c) { cls.delete(c); },
      toggle(c, f) { if (f === undefined) { if (cls.has(c)) cls.delete(c); else cls.add(c); } else if (f) cls.add(c); else cls.delete(c); },
      contains(c) { return cls.has(c); },
    },
    getContext() { return { imageSmoothingEnabled: false, save() {}, restore() {}, clearRect() {}, translate() {}, scale() {} }; },
    querySelectorAll() { return []; },
    addEventListener() {}, focus() {}, select() {},
  };
}
function mkGateHarness(opts) {
  const els = {};
  ['avatarPreviewWrap', 'avatar-preview', 'avatarLabel', 'levelLabel', 'anthemHash', 'cheeseBalance', 'shopCatalog', 'capsuleBtn', 'capsulePreview', 'sqkShopBalance', 'sqkShopCatalog', 'sqkCapsulePity', 'sqkCommitBtn', 'sqkResolveBtn', 'sqkShopPool', 'sqkShopSeason', 'sqkShopSoon', 'sqkCapsulePreview', 'sqkShopMsg', 'shopMsg', 'lbList', 'lbRank', 'leagueWeeklyList', 'leagueWeeklyRank', 'leagueWeekLabel', 'walletDot', 'walletAddr', 'walletCopyBtn', 'connectBtn', 'disconnectBtn', 'walletInput', 'message'].forEach(id => { els[id] = mkGateEl(); });
  els.walletInput.value = (opts && opts.remembered !== undefined) ? opts.remembered : GATE_ADDR;
  els.connectBtn.textContent = 'CONNECT';
  const I18Nstub = { en: { connect: 'CONNECT', shopNeedWallet: 'CONNECT A WALLET FIRST TO USE THE SHOP.', sqkNeedWallet: 'CONNECT A WALLET FIRST TO USE THE SQK SHOP.', shopBalanceTpl: '🧀 BALANCE: {n}', shopBuyTpl: '[ BUY — {price} 🧀 ]', sqkPoolTpl: '🏆 PRIZE POOL: {pool} SQK', sqkSeasonTpl: 'SEASON ENDS: {date}', sqkSweepTpl: 'After the season ends, the remaining pool is swept to the owner 7 days later ({date}).', sqkBalanceTpl: 'SQK BALANCE: {n}', sqkBuyTpl: '[ BUY — {price} SQK ]', sqkOwnedTpl: 'OWNED ×{n}', sqkEquippedTpl: 'EQUIPPED ✓', sqkEquipBtn: '[ EQUIP ]', sqkUnequipBtn: '[ UNEQUIP ]', sqkPityTpl: 'PITY: {n} / 20', sqkCommitBtn: '[ COMMIT CAPSULE — 2 SQK ]', sqkResolveBtn: '[ RESOLVE CAPSULE ]', equipBtn: '[ EQUIP ]', unequipBtn: '[ UNEQUIP ]', equippedLbl: 'EQUIPPED ✓', ownedLbl: 'OWNED', capsuleOnlyLbl: 'CAPSULE ONLY', shopOffline: 'SHOP OFFLINE — CHECK YOUR CONNECTION.', lbEmpty: 'NO SCORES YET — BE THE FIRST.', lbVerified: 'VERIFIED ✓', lbYourRank: 'YOUR RANK #{rank} OF {total}', leagueWeeklyYourRank: 'YOUR WEEK RANK #{rank}', leagueWeeklyEmpty: 'No weekly scores yet.', walletDisconnected: 'WALLET DISCONNECTED.' } };
  const msgStub = k => I18Nstub.en[k] || k;
  const msgfStub = (k, vars) => { let s = msgStub(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; };
  const isAddrStub = s => /^0x[a-fA-F0-9]{40}$/.test(s || '');
  const src = ['connectedWallet', 'renderAvatarPreview', 'renderShop', 'renderSqkShop', 'renderLb', 'renderLeagueWeekly', 'setConnected', 'updateConnectBtn', 'shopOwned', 'shopEquipped', 'sqkIsEquipped'].map(fnSrcJ).join('\n');
  const api = new Function('$', 'isAddr', 'msg', 'msgf', 'I18N', 'lang', 'walletEl',
    'let connectedAddr = null;\n' +
    'let wcRestoreReason = null;\n' +
    'let shopState = { balance: 0, items: [], catalog: [] };\n' +
    'let sqkState = { pool: null, seasonEnd: null, sweepAt: null, swept: false, sqkBalance: null, owned: {}, pity: null };\n' +
    'let lbState = { rows: [], mode: "free", loading: false };\n' +
    'let leagueWeeklyState = { week_start: "2026-11-09", scores: [], you: null };\n' +
    'const SQK_SHOP_CATALOG = [{ id: 1, name: "Skin Rare", priceSqk: 5, slot: "note", skin: "note-sqk-rare" }, { id: 2, name: "Efek Epic", priceSqk: 10, slot: "note", skin: "note-sqk-epic" }, { id: 3, name: "Bingkai Animasi", priceSqk: 15, slot: "frame", skin: "frame-sqk" }];\n' +
    'function totalXP(w) { return 49289; }\n' +
    'function levelFor(xp) { return 7; }\n' +
    'function avatar() {}\n' +
    'function loadJSON(k, fb) { return fb; }\n' +
    'function walletKey(w) { return (w || "GUEST").toLowerCase(); }\n' +
    'function startPreviewSpin(w) {}\n' +
    'function makeAnthem(w) { return { key: "A", scaleName: "Minor Pentatonic", bpm: 114, hue: 120 }; }\n' +
    'function seedOf(w) { return 69237; }\n' +
    'function applyHue(h) {}\n' +
    'function skinPreviewHtml() { return "[skin]"; }\n' +
    'function capsulePreviewHtml() { return "[capsule]"; }\n' +
    'function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }\n' +
    'function fmt(raw, dec) { return String(raw); }\n' +
    'function sqkShopDeployed() { return true; }\n' +
    'function sqkPendingCapsule() { return null; }\n' +
    'function sqkDateStr() { return "1 Jan 2027"; }\n' +
    'function truncAddr(w) { return (typeof w === "string" && w.length === 42) ? "0x" + w.slice(2, 6) + "..." + w.slice(-4) : "GUEST"; }\n' +
    'function shortAddr(w) { return (typeof w === "string" && w.length === 42) ? "0x" + w.slice(2, 6) + "..." + w.slice(-4) : "GUEST"; }\n' +
    'function shopSkin() { return { note: "note-sqk-rare", frame: null }; }\n' +
    'function setWcRestoreNote() {}\n' +
    'function say() {}\n' +
    'const fetchCalls = [];\n' +
    'function fetchShop() { fetchCalls.push("fetchShop"); }\n' +
    'function fetchSqkShop() { fetchCalls.push("fetchSqkShop"); }\n' +
    'function fetchLbRank() { fetchCalls.push("fetchLbRank"); }\n' +
    'function fetchLeagueWeekly() { fetchCalls.push("fetchLeagueWeekly"); }\n' +
    src + '\n' +
    'return { connectedWallet, renderAvatarPreview, renderShop, renderSqkShop, renderLb, renderLeagueWeekly, setConnected, updateConnectBtn, getConnectedAddr: () => connectedAddr, fetchCalls, setShopState: (s) => { shopState = s; }, setSqkState: (s) => { sqkState = s; }, setLbState: (s) => { lbState = s; }, setLeagueState: (s) => { leagueWeeklyState = s; } };'
  )(id => els[id] || null, isAddrStub, msgStub, msgfStub, I18Nstub, 'en', els.walletInput);
  return { api, els };
}

function runGateTests() {
  const CATALOG = [
    { id: 'note-mint', name: 'Mint Notes', slot: 'note', rarity: 'common', price: 300 },
    { id: 'note-gold', name: 'Golden Notes', slot: 'note', rarity: 'rare', price: 800 },
    { id: 'frame-neon', name: 'Neon Frame', slot: 'frame', rarity: 'common', price: 300 },
  ];
  const ITEMS = [
    { id: 'note-mint', slot: 'note', equipped: false },
    { id: 'note-gold', slot: 'note', equipped: true },
  ];
  // C1: profile card — disconnected + remembered address -> HIDDEN.
  {
    const h = mkGateHarness({ remembered: GATE_ADDR });
    h.api.renderAvatarPreview(GATE_ADDR);
    t('v43.4 profil: belum connect + alamat diingat -> kartu TERSEMBUNYI', h.els.avatarPreviewWrap.classList.contains('hidden') === true);
  }
  // C2: profile card — connected -> SHOWN.
  {
    const h = mkGateHarness({ remembered: GATE_ADDR });
    h.api.setConnected(GATE_ADDR);
    h.api.renderAvatarPreview(GATE_ADDR);
    t('v43.4 profil: sudah connect -> kartu TAMPIL', h.els.avatarPreviewWrap.classList.contains('hidden') === false);
  }
  // C3: setConnected toggles the card both ways; connect re-fetches shop/rank, disconnect does not.
  {
    const h = mkGateHarness({ remembered: GATE_ADDR });
    h.api.setConnected(GATE_ADDR);
    const shownAfterConnect = h.els.avatarPreviewWrap.classList.contains('hidden') === false;
    const callsAfterConnect = h.api.fetchCalls.length;
    h.api.setConnected(null);
    const hiddenAfterDisconnect = h.els.avatarPreviewWrap.classList.contains('hidden') === true;
    t('v43.4 profil: setConnected(addr) tampil -> setConnected(null) sembunyi', shownAfterConnect && hiddenAfterDisconnect);
    t('v43.4 profil: connect memanggil ulang fetch toko/peringkat (4x), disconnect tidak', callsAfterConnect === 4 && h.api.fetchCalls.length === 4 && h.api.fetchCalls.includes('fetchShop') && h.api.fetchCalls.includes('fetchSqkShop') && h.api.fetchCalls.includes('fetchLbRank') && h.api.fetchCalls.includes('fetchLeagueWeekly'));
  }
  // C4: Cheese shop — disconnected: balance "—", no OWNED, no buttons, prompt + capsule disabled, catalog visible.
  {
    const h = mkGateHarness({ remembered: GATE_ADDR });
    h.api.setShopState({ balance: 700, items: ITEMS, catalog: CATALOG });
    h.api.renderShop();
    const bal = h.els.cheeseBalance.textContent;
    const cat = h.els.shopCatalog.innerHTML;
    t('v43.4 toko Keju: belum connect -> saldo "—" (bukan 700)', bal.includes('—') && !bal.includes('700'));
    t('v43.4 toko Keju: belum connect -> TIDAK ada OWNED / tombol BELI / PAKAI', !cat.includes('OWNED') && !cat.includes('data-buy') && !cat.includes('data-equip') && !cat.includes('data-unequip'));
    t('v43.4 toko Keju: belum connect -> ada ajakan CONNECT + kapsul nonaktif', cat.includes('CONNECT A WALLET') && h.els.capsuleBtn.disabled === true);
    t('v43.4 toko Keju: belum connect -> katalog tetap tampil (nama + harga)', cat.includes('Mint Notes') && cat.includes('300'));
  }
  // C5: Cheese shop — connected: balance + OWNED + buttons + capsule enabled.
  {
    const h = mkGateHarness({ remembered: GATE_ADDR });
    h.api.setConnected(GATE_ADDR);
    h.api.setShopState({ balance: 700, items: ITEMS, catalog: CATALOG });
    h.api.renderShop();
    const bal = h.els.cheeseBalance.textContent;
    const cat = h.els.shopCatalog.innerHTML;
    t('v43.4 toko Keju: sudah connect -> saldo 700 tampil', bal.includes('700'));
    t('v43.4 toko Keju: sudah connect -> OWNED + PAKAI + BELI tampil', cat.includes('OWNED') && cat.includes('data-equip') && cat.includes('data-buy'));
    t('v43.4 toko Keju: sudah connect -> kapsul aktif', h.els.capsuleBtn.disabled === false);
  }
  // C6: SQK shop — disconnected: balance "—", no OWNED, no buttons, prompt, commit/resolve disabled, pity empty, pool/catalog visible.
  {
    const h = mkGateHarness({ remembered: GATE_ADDR });
    h.api.setSqkState({ pool: 1000n, seasonEnd: 1801915200, sweepAt: null, swept: false, sqkBalance: 972000000000000000000n, owned: { 1: 1, 2: 0, 3: 0 }, pity: 5 });
    h.api.renderSqkShop();
    const bal = h.els.sqkShopBalance.textContent;
    const cat = h.els.sqkShopCatalog.innerHTML;
    t('v43.4 toko SQK: belum connect -> saldo "—" (bukan angka)', bal.includes('—') && !bal.includes('972'));
    t('v43.4 toko SQK: belum connect -> TIDAK ada OWNED / tombol BELI / PAKAI', !cat.includes('OWNED') && !cat.includes('data-sqk-buy') && !cat.includes('data-sqk-equip') && !cat.includes('data-sqk-unequip'));
    t('v43.4 toko SQK: belum connect -> ada ajakan CONNECT + commit/resolve nonaktif + pity kosong', cat.includes('CONNECT A WALLET') && h.els.sqkCommitBtn.disabled === true && h.els.sqkResolveBtn.disabled === true && h.els.sqkCapsulePity.textContent === '');
    t('v43.4 toko SQK: belum connect -> katalog + pool tetap tampil (info publik)', cat.includes('Skin Rare') && cat.includes('5 SQK') && h.els.sqkShopPool.textContent.includes('1000'));
  }
  // C7: SQK shop — connected: balance + OWNED + buttons + commit/resolve enabled + pity.
  {
    const h = mkGateHarness({ remembered: GATE_ADDR });
    h.api.setConnected(GATE_ADDR);
    h.api.setSqkState({ pool: 1000n, seasonEnd: 1801915200, sweepAt: null, swept: false, sqkBalance: 972000000000000000000n, owned: { 1: 1, 2: 0, 3: 0 }, pity: 5 });
    h.api.renderSqkShop();
    const bal = h.els.sqkShopBalance.textContent;
    const cat = h.els.sqkShopCatalog.innerHTML;
    t('v43.4 toko SQK: sudah connect -> saldo tampil', bal.includes('972'));
    t('v43.4 toko SQK: sudah connect -> OWNED + PAKAI/LEPAS + BELI tampil', cat.includes('OWNED') && cat.includes('data-sqk-unequip') && cat.includes('data-sqk-buy'));
    t('v43.4 toko SQK: sudah connect -> commit/resolve aktif + pity tampil', h.els.sqkCommitBtn.disabled === false && h.els.sqkResolveBtn.disabled === false && h.els.sqkCapsulePity.textContent.includes('5'));
  }
  // C8: leaderboard + weekly league — disconnected: no "me" highlight, no rank text.
  {
    const h = mkGateHarness({ remembered: GATE_ADDR });
    h.api.setLbState({ rows: [{ rank: 1, wallet: GATE_ADDR, name: 'yui', score: 63570, acc: 77.95, verified: 1 }, { rank: 2, wallet: GATE_OTHER, name: 'bob', score: 50000, acc: 70, verified: 1 }], mode: 'free', loading: false });
    h.api.setLeagueState({ week_start: '2026-11-09', scores: [{ rank: 1, wallet: GATE_ADDR, name: 'yui', best_score: 63570, verified: 1 }], you: { rank: 1 } });
    h.api.renderLb();
    h.api.renderLeagueWeekly();
    t('v43.4 peringkat: belum connect -> board TIDAK menyorot baris sendiri (skor tetap tampil)', !h.els.lbList.innerHTML.includes('lb-me') && h.els.lbList.innerHTML.includes('63570'));
    t('v43.4 peringkat: belum connect -> liga mingguan TIDAK menyorot + TIDAK ada teks peringkat', !h.els.leagueWeeklyList.innerHTML.includes('lb-me') && h.els.leagueWeeklyRank.textContent === '');
  }
  // C9: leaderboard + weekly league — connected: "me" highlight + rank text.
  {
    const h = mkGateHarness({ remembered: GATE_ADDR });
    h.api.setConnected(GATE_ADDR);
    h.api.setLbState({ rows: [{ rank: 1, wallet: GATE_ADDR, name: 'yui', score: 63570, acc: 77.95, verified: 1 }, { rank: 2, wallet: GATE_OTHER, name: 'bob', score: 50000, acc: 70, verified: 1 }], mode: 'free', loading: false });
    h.api.setLeagueState({ week_start: '2026-11-09', scores: [{ rank: 1, wallet: GATE_ADDR, name: 'yui', best_score: 63570, verified: 1 }], you: { rank: 1 } });
    h.api.renderLb();
    h.api.renderLeagueWeekly();
    t('v43.4 peringkat: sudah connect -> board menyorot baris sendiri', h.els.lbList.innerHTML.includes('lb-me'));
    t('v43.4 peringkat: sudah connect -> liga mingguan menyorot + teks peringkat tampil', h.els.leagueWeeklyList.innerHTML.includes('lb-me') && h.els.leagueWeeklyRank.textContent.includes('#1'));
  }
}

(async () => {
  await runBundleTests();
  await runConnectTests();
  runGateTests();

  // --- Statis: akar masalah + batas keras ---
  t('v43.4 statis: restore SABAR 5 menit (wcGetProvider 300000 + preload 300000)', js.includes('wcGetProvider(300000, true)') && js.includes('if (!window.ethereum && hasWcSessionKey()) wcLoadBundle(300000);'));
  t('v43.4 statis: cache IndexedDB ada (wcIdbCacheBundle + wcInjectCode + WC_BUNDLE_VERSION)', js.includes('function wcIdbCacheBundle(') && js.includes('function wcInjectCode(') && js.includes('const WC_BUNDLE_VERSION = 1;'));
  t('v43.4 statis: injected didahulukan (getEth + connectedVia)', js.includes('let connectedVia = null;') && js.includes("if (connectedVia === 'injected' && inj) return inj;") && js.includes("if (connectedVia === 'wc' && wc) return wc;"));
  t('v43.4 statis: alamat TIDAK tampil bila belum connect (updateConnectBtn)', js.includes('const shown = connected ? connectedAddr : null;') && !js.includes("const shown = connected ? connectedAddr : (isAddr(typed) ? typed : null);"));
  t('v43.4 statis: anti-duplikat di connectWalletConnect (enable sebelum connect)', js.includes('if (hasWcSessionKey() || (p.session && typeof p.session === \'object\'))'));
  t('v43.4 statis: akar masalah didokumentasi jujur di kode (max-age=600)', js.includes('max-age=600') && js.includes('v42.5.2/v43/v43.1/v43.2 mengklaim memperbaiki restore tapi tidak pernah'));
  t('v43.4 statis: index.html judul v43.6 + gameVersion v43.6', html.includes('<title>SQUEEKCHAIN // v43.6</title>') && html.includes('PIXEL ID // v43.6') && js.includes("gameVersion: 'v43.6'"));
  // v43.4 gating — static: the gate helper + all renders keyed on it.
  t('v43.4 statis: gate helper connectedWallet() ada + profil pakai itu', js.includes('function connectedWallet()') && js.includes('if (!wrap || !c || !connectedWallet() || !isAddr(w))') && js.includes('const w = connectedWallet();'));
  t('v43.4 statis: setConnected mengevaluasi ulang tampilan wallet (avatar + toko + peringkat)', js.includes('renderAvatarPreview(connectedAddr)') && js.includes('renderShop();') && js.includes('renderSqkShop();') && js.includes('renderLb();') && js.includes('renderLeagueWeekly();'));
  t('v43.4 statis: toko Keju gated (saldo —, OWNED/tombol/kapsul via w)', js.includes('shopNeedWallet') && js.includes("bal.textContent = w ? msgf('shopBalanceTpl', { n: shopState.balance }) : msgf('shopBalanceTpl', { n: '—' })") && js.includes('cb.disabled = !w;'));
  t('v43.4 statis: toko SQK gated (saldo —, OWNED/tombol/commit/resolve via w)', js.includes('sqkNeedWallet') && js.includes("bal.textContent = !w ? msgf('sqkBalanceTpl', { n: '—' })") && js.includes('commit.disabled = !deployed || !w;') && js.includes('resolve.disabled = !deployed || !w;'));
  t('v43.4 statis: peringkat gated (lb-me + teks peringkat via connectedWallet)', js.includes("const me = (connectedWallet() || '').toLowerCase();") && js.includes('connectedWallet() && leagueWeeklyState.you && leagueWeeklyState.you.rank'));
  t('v43.4 statis: aksi beli/equip menolak saat belum connect (connectedWallet, bukan txWallet)', js.includes('async function buySqkItem(itemId) {') && js.includes('async function commitSqkCapsule() {') && js.includes('async function resolveSqkCapsule() {') && js.includes('beli pakai alamat TERHUBUNG; belum connect = tolak dengan jelas') && js.includes('commit kapsul pakai alamat TERHUBUNG') && js.includes('resolve kapsul pakai alamat TERHUBUNG'));
  t('v43.4 statis: tanpa CDN/dependensi baru (tidak ada <script src> eksternal; unpkg hanya disebut di komentar sejarah)', !/src="https?:\/\//.test(html) && !html.includes('https://unpkg') && !html.includes('https://cdn.jsdelivr') && !jsCode.includes('unpkg') && !jsCode.includes('cdn.jsdelivr'));
  t('v43.4 statis: engine.js byte-identik v43.3', fs.readFileSync('engine.js', 'utf8') === fs.readFileSync('../squeekchain-v43.3/engine.js', 'utf8'));
  t('v43.4 statis: worker.js byte-identik v43.3 (Worker tetap v13)', fs.readFileSync('worker.js', 'utf8') === fs.readFileSync('../squeekchain-v43.3/worker.js', 'utf8'));
  // Golden charts + judgement windows (same as TEST-v43).
  let goldenOk = true;
  for (const g of golden) {
    if (JSON.stringify(SqueekEngine.buildChart(g.header)) !== JSON.stringify(g.anthem)) { goldenOk = false; console.log('  golden mismatch:', g.header && g.header.seedKey); break; }
  }
  t('v43.4 statis: 14 chart golden identik (buildChart == fixture v40)', goldenOk);
  const engineSrc = fs.readFileSync('engine.js', 'utf8');
  t('v43.4 statis: judgement windows TIDAK berubah (0.045/0.09/0.135, BREAK 0.185)',
    /perfect: 0\.045, great: 0\.09, good: 0\.135/.test(engineSrc) && /BREAK = W\.good \+ 0\.05/.test(engineSrc));
  // 3 bukti Genesis utuh.
  t('v43.4 statis: bukti Genesis — meta tag di index.html', html.includes('<meta name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7">'));
  t('v43.4 statis: bukti Genesis — baris README', fs.readFileSync('README.md', 'utf8').includes('squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7'));

  console.log(`\nTEST-v43.4: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
