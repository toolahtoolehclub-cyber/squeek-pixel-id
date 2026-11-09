// v43.1 UPDATE (9 Nov 2026): the restore LOGIC is unchanged, but the
// wallet-card contract changed in v43/v43.1 — the address appears ONCE
// (dot + short address in the card); when connected, CONNECT is HIDDEN
// (not relabelled "[ CONNECTED: … ]") and the disconnect button shows.
// The old walletStatus line is deleted. This file now asserts the v43.1
// contract (it was 24/28 in v43 — the v43 agent never fixed the 4
// button-text assertions). Filename kept for continuity.
// v42.5.4 restore UI — run: node TEST-v42.5.4-restore-ui.js  (cwd = the v42.5.4 folder)
// Masalah user (08:32 WIB 9 Nov 2026): membuka squeekpixel.web.id dan
// langsung melihat [ CONNECT WALLET ] + alamatnya sudah terisi, padahal OKX
// (DApp Terhubung) menunjukkan "Squeek Pixel ID" MASIH connect. Alamat di
// kolom itu dari localStorage sqk38:wallet (diingat, bukan koneksi — by
// design, ada label MANUAL); OKX menyimpan sesi di pihaknya, tapi situs di
// Chrome harus menghidupkan lagi sesi itu tiap buka halaman (unduh bundle
// WC 2,1 MB dulu — di koneksi user bisa 1–3 menit — baru enable()). Selama
// restore berjalan, tombol masih menunjukkan CONNECT WALLET, jadi user
// mengira restore gagal padahal mungkin masih jalan. Alasan gagal restore
// (bundle-timeout / no-accounts / enable-rejected) sudah ditampilkan v42.5.2
// sebagai teks kecil — user tidak menyadarinya.
// Perbaikan v42.5.4 (hanya UI di sekitar restore; logika restore v42.5.2
// TIDAK berubah — enable() bila p.session ada, tunggu bundle 60 dtk,
// preload bila kunci wc@2: ada, showQrModal:false):
// (1) Status restore TERLIHAT: begitu restore mulai (kunci wc@2: ada),
// tampilkan "MENGHUBUNGKAN KEMBALI…" / "RECONNECTING…" di area kartu
// wallet (gaya berbeda dari tombol biasa) dan NONAKTIFKAN tombol CONNECT
// WALLET selama restore berjalan (supaya user tidak mengetuk connect di
// tengah restore dan membuat sesi ganda). Berhasil -> TERHUBUNG (sudah ada).
// Gagal -> alasan tampil jelas (2).
// (2) Alasan gagal DITAMPILKAN JELAS (bukan teks kecil tersembunyi): satu
// baris mudah dibaca di area kartu wallet ("RESTORE GAGAL: {reason} —
// ketuk CONNECT WALLET untuk menghubungkan ulang", EN+ID). Kode alasan
// tetap (bundle-timeout / no-accounts / enable-rejected; no-session-key
// dicatat tapi tidak ditampilkan — itu keadaan normal belum-pernah-connect).
// (3) Status "MENGHUBUNGKAN KEMBALI…" hilang begitu restore selesai
// (berhasil/gagal) dan tidak menempel saat pindah tab — dijamin finally di
// restoreWalletConnectSession; setTab() tidak menyentuh elemen note
// (say('') hanya membersihkan #message).
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
const jsLines = js.split('\n');

let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }
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
    add(cls) { set.add(cls); },
    remove(cls) { set.delete(cls); },
    contains(cls) { return set.has(cls); },
  };
}
function mockEl() { return { textContent: '', classList: mockClassList() }; }
function mockBtn() { return { textContent: '[ CONNECT WALLET ]', disabled: false, classList: mockClassList() }; }

// --- Harness: fungsi WC asli diekstrak dengan local bersama (pola sama
// dengan runWcRestoreTests4252 di TEST-v42.5.js), ditambah updateConnectBtn
// + setConnected di preamble (cerminan aslinya) supaya status tombol bisa
// diuji end-to-end. setTimeout dibayangi fake supaya watchdog 60 detik
// tidak menahan proses tes.
const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
const isAddrH = s => /^0x[a-fA-F0-9]{40}$/.test(s || '');
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
const mkHarness = (deps) => {
  const timers = [];
  const fakeSetTimeout = (fn, ms) => { const rec = { fn, ms }; timers.push(rec); return rec; };
  const lang = (deps && deps.lang) || 'en';
  const MSGstub = {
    en: { wcRestoring: 'RECONNECTING TO YOUR WALLET…', wcRestoreNoteTpl: 'WC RESTORE FAILED: {reason} — TAP [ CONNECT WALLET ] TO RECONNECT.' },
    id: { wcRestoring: 'MENGHUBUNGKAN KEMBALI KE WALLET…', wcRestoreNoteTpl: 'WC RESTORE GAGAL: {reason} — KETUK [ CONNECT WALLET ] UNTUK MENGHUBUNGKAN LAGI.' },
  };
  const msgH = k => (MSGstub[lang] && MSGstub[lang][k]) || MSGstub.en[k] || k;
  const msgfH = (k, vars) => { let s = msgH(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; };
  const I18Nstub = { en: { connect: '[ CONNECT WALLET ]', connectedTpl: '[ CONNECTED: {addr} ]' }, id: { connect: '[ HUBUNGKAN WALLET ]', connectedTpl: '[ TERHUBUNG: {addr} ]' } };
  const noteEl = mockEl();
  const btn = mockBtn();
  const disconnectBtn = mockEl();
  const walletManualNote = mockEl();
  // v43.1: the card elements are mocked too (dot/addr/copy) so the
  // single-address contract is testable; walletStatus is GONE (deleted
  // from the page — the address appears once, in the card).
  const walletDot = mockEl();
  const walletAddr = mockEl();
  const walletCopyBtn = mockEl();
  const walletEl = { value: '', readOnly: false };
  const els = { wcRestoreNote: noteEl, connectBtn: btn, disconnectBtn, walletManualNote, walletDot, walletAddr, walletCopyBtn };
  const src = ['hasWcSessionKey', 'wcLoadBundle', 'wcGetProvider', 'restoreWalletConnectSession', 'setWcRestoreNote', 'updateConnectBtn', 'shortAddr'].map(fnSrcJ).join('\n');
  const fn = new Function('window', 'document', 'localStorage', 'CONFIG', '$', 'walletEl', 'saveWallet38', 'preview', 'isAddr', 'msg', 'msgf', 'fakeSetTimeout', 'I18N', 'lang',
    'const setTimeout = fakeSetTimeout;\nlet wcProvider = null;\nlet wcBundlePromise = null;\nlet wcRestoreReason = null;\nlet connectedAddr = null;\n' +
    'function setConnected(a) { connectedAddr = (a && isAddr(a)) ? a : null; if (connectedAddr) setWcRestoreNote(null); updateConnectBtn(); }\n' + src +
    '\nreturn { hasWcSessionKey, wcLoadBundle, wcGetProvider, restoreWalletConnectSession, setWcRestoreNote, updateConnectBtn, getWcProvider: () => wcProvider, getReason: () => wcRestoreReason, getConnectedAddr: () => connectedAddr };');
  const api = fn(deps.window, deps.document, deps.localStorage,
    { WC_PROJECT_ID: 'x', WC_CHAINS: [11155111], SEPOLIA_RPC: 'https://rpc.test' },
    id => els[id] || null, walletEl, () => {}, () => {}, isAddrH, msgH, msgfH, fakeSetTimeout, I18Nstub, lang);
  return { api, timers, noteEl, btn, disconnectBtn, walletDot, walletAddr, walletCopyBtn, walletEl };
};
const mkWindow = (ethProvider) => { const w = {}; if (ethProvider) w.EthereumProvider = ethProvider; return w; };

(async () => {
  // 1. Bundle lambat -> status reconnecting TERLIHAT + tombol nonaktif,
  // lalu berhasil -> TERHUBUNG dan status hilang.
  {
    let initOpts = null;
    const p = mkProvider({ accounts: [], session: { topic: 't1' }, ethAccounts: [], enableAccounts: [ADDR] });
    let scriptEl = null;
    const mockWindow = mkWindow(undefined); // bundle belum dimuat
    const h = mkHarness({ window: mockWindow, document: { createElement: () => { scriptEl = { src: '', onload: null, onerror: null }; return scriptEl; }, head: { appendChild: () => {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    const restoreP = h.api.restoreWalletConnectSession();
    await new Promise(r => setTimeout(r, 50)); // restore masih menunggu bundle
    t('v43.1 UI: restore berjalan -> status reconnecting tampil (bukan teks kecil tersembunyi)',
      !h.noteEl.classList.contains('hidden') && h.noteEl.classList.contains('restoring') && h.noteEl.textContent.includes('RECONNECTING'));
    t('v43.1 UI: restore berjalan -> tombol CONNECT WALLET nonaktif',
      h.btn.disabled === true);
    h.api.updateConnectBtn(); // dipanggil dari mana pun saat restore berjalan -> tombol tetap nonaktif
    t('v43.1 UI: updateConnectBtn saat restore berjalan -> tombol tetap nonaktif',
      h.btn.disabled === true && h.btn.textContent === '[ CONNECT WALLET ]');
    mockWindow.EthereumProvider = { init: async (opts) => { initOpts = opts; return p; } };
    scriptEl.onload();
    await restoreP;
    t('v43.1 UI: restore berhasil -> TERHUBUNG + status reconnecting hilang',
      h.api.getConnectedAddr() === ADDR && h.noteEl.classList.contains('hidden') && !h.noteEl.classList.contains('restoring') && h.api.getReason() === null);
    t('v43.1 UI: restore berhasil -> kartu TERHUBUNG (dot hijau + alamat singkat, CONNECT hilang, PUTUSKAN muncul)',
      h.btn.textContent === '[ CONNECT WALLET ]' && h.btn.disabled === false && h.btn.classList.contains('hidden') &&
      !h.disconnectBtn.classList.contains('hidden') && h.walletDot.classList.contains('on') && h.walletAddr.textContent === '0x8853...cf9a' &&
      !h.walletCopyBtn.classList.contains('hidden') && h.walletEl.readOnly === true);
    t('v43.1 UI: restore init tetap showQrModal:false (tanpa modal)', initOpts && initOpts.showQrModal === false);
  }
  // 2. Restore sukses via passive read (jalur cepat) -> TERHUBUNG, status bersih.
  {
    const p = mkProvider({ accounts: [ADDR], session: { topic: 't1' } });
    const h = mkHarness({ window: mkWindow({ init: async () => p }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    await h.api.restoreWalletConnectSession();
    t('v43.1 UI: akun pasif ada -> TERHUBUNG tanpa status menempel (CONNECT hilang, kartu hijau)',
      h.api.getConnectedAddr() === ADDR && h.noteEl.classList.contains('hidden') && !h.noteEl.classList.contains('restoring') && h.btn.classList.contains('hidden') && h.walletDot.classList.contains('on') && h.walletAddr.textContent === '0x8853...cf9a');
  }
  // 3. enable() reject -> alasan JELAS + tombol bisa dipakai lagi.
  {
    const p = mkProvider({ accounts: [], session: { topic: 't1' }, ethAccounts: [], enableReject: true });
    const h = mkHarness({ window: mkWindow({ init: async () => p }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    await h.api.restoreWalletConnectSession();
    t('v43.1 UI: enable-rejected -> alasan tampil JELAS (kelas failed, teks alasan)',
      h.api.getReason() === 'enable-rejected' && !h.noteEl.classList.contains('hidden') && h.noteEl.classList.contains('failed') && h.noteEl.textContent.includes('enable-rejected'));
    t('v43.1 UI: enable-rejected -> status reconnecting TIDAK menempel',
      !h.noteEl.classList.contains('restoring') && h.api.getReason() !== 'restoring');
    t('v43.1 UI: enable-rejected -> tombol CONNECT WALLET aktif lagi',
      h.btn.disabled === false && h.btn.textContent === '[ CONNECT WALLET ]');
    h.api.updateConnectBtn();
    t('v43.1 UI: updateConnectBtn setelah gagal -> tombol tetap aktif',
      h.btn.disabled === false);
  }
  // 4. Bundle gagal total (onerror) -> bundle-timeout JELAS.
  {
    let scriptEl = null;
    const mockWindow = mkWindow(undefined);
    const h = mkHarness({ window: mockWindow, document: { createElement: () => { scriptEl = { src: '', onload: null, onerror: null }; return scriptEl; }, head: { appendChild: () => {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    const restoreP = h.api.restoreWalletConnectSession();
    await new Promise(r => setTimeout(r, 10));
    t('v43.1 UI: bundle gagal -> saat menunggu, status reconnecting tampil',
      !h.noteEl.classList.contains('hidden') && h.noteEl.classList.contains('restoring'));
    scriptEl.onerror();
    await restoreP;
    t('v43.1 UI: bundle gagal -> alasan bundle-timeout tampil JELAS',
      h.api.getReason() === 'bundle-timeout' && !h.noteEl.classList.contains('hidden') && h.noteEl.classList.contains('failed') && h.noteEl.textContent.includes('bundle-timeout') && !h.noteEl.classList.contains('restoring'));
    t('v43.1 UI: bundle gagal -> tombol aktif lagi', h.btn.disabled === false);
  }
  // 5. Kunci ada tapi p.session kosong -> no-accounts JELAS.
  {
    const p = mkProvider({ accounts: [], session: null, ethAccounts: [] });
    const h = mkHarness({ window: mkWindow({ init: async () => p }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    await h.api.restoreWalletConnectSession();
    t('v43.1 UI: no-accounts -> alasan tampil JELAS + tombol aktif lagi',
      h.api.getReason() === 'no-accounts' && !h.noteEl.classList.contains('hidden') && h.noteEl.classList.contains('failed') && h.noteEl.textContent.includes('no-accounts') && h.btn.disabled === false && !h.noteEl.classList.contains('restoring'));
  }
  // 6. Tanpa kunci sesi -> bukan kegagalan: note tersembunyi, tombol biasa.
  {
    const p = mkProvider({ accounts: [], session: { topic: 't1' }, enableAccounts: [ADDR] });
    const h = mkHarness({ window: mkWindow({ init: async () => p }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore([]) });
    await h.api.restoreWalletConnectSession();
    t('v43.1 UI: tanpa kunci sesi -> note tersembunyi, tanpa status restoring, tombol biasa',
      h.api.getReason() === 'no-session-key' && h.noteEl.classList.contains('hidden') && !h.noteEl.classList.contains('restoring') && h.btn.disabled === false && h.btn.textContent === '[ CONNECT WALLET ]');
  }
  // 7. init() melempar (kegagalan tak terduga) -> finally membersihkan
  // status restoring, alasan bundle-timeout yang tampil.
  {
    const h = mkHarness({ window: mkWindow({ init: async () => { throw new Error('boom'); } }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore(['wc@2:client:0.3//session']) });
    await h.api.restoreWalletConnectSession();
    t('v43.1 UI: init melempar -> status restoring TIDAK menempel, bundle-timeout tampil',
      h.api.getReason() === 'bundle-timeout' && !h.noteEl.classList.contains('restoring') && !h.noteEl.classList.contains('hidden') && h.noteEl.textContent.includes('bundle-timeout') && h.btn.disabled === false);
  }
  // 8. i18n: teks restoring EN + ID.
  {
    const hEn = mkHarness({ window: mkWindow({ init: async () => mkProvider({}) }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore([]) });
    hEn.api.setWcRestoreNote('restoring');
    t('v43.1 UI: i18n EN restoring', hEn.noteEl.textContent === 'RECONNECTING TO YOUR WALLET…' && hEn.noteEl.classList.contains('restoring'));
    const hId = mkHarness({ window: mkWindow({ init: async () => mkProvider({}) }), document: { createElement: () => { throw new Error('no DOM'); }, head: { appendChild() {} } }, localStorage: mkStore([]), lang: 'id' });
    hId.api.setWcRestoreNote('restoring');
    t('v43.1 UI: i18n ID restoring', hId.noteEl.textContent === 'MENGHUBUNGKAN KEMBALI KE WALLET…' && hId.noteEl.classList.contains('restoring'));
    hId.api.setWcRestoreNote('bundle-timeout');
    t('v43.1 UI: i18n ID gagal', hId.noteEl.textContent.includes('WC RESTORE GAGAL: bundle-timeout') && hId.noteEl.classList.contains('failed'));
  }
  // 9. Statis: status + finally + CSS + HTML + setTab tidak menyentuh note.
  t('v43.1 statis: restore mengatur status restoring', js.includes("setWcRestoreNote('restoring')"));
  t('v43.1 statis: finally membersihkan restoring bila belum ada alasan akhir', js.includes("if (wcRestoreReason === 'restoring') setWcRestoreNote(null);"));
  t('v43.1 statis: i18n wcRestoring EN+ID', js.includes("wcRestoring: 'RECONNECTING TO YOUR WALLET…'") && js.includes("wcRestoring: 'MENGHUBUNGKAN KEMBALI KE WALLET…'"));
  t('v43.1 statis: template gagal tidak berubah (EN+ID)', js.includes("wcRestoreNoteTpl: 'WC RESTORE FAILED: {reason}") && js.includes("wcRestoreNoteTpl: 'WC RESTORE GAGAL: {reason}"));
  t('v43.1 statis: CSS note terlihat (13px bold) + kelas restoring/failed', css.includes('#wcRestoreNote { font-size: 13px;') && css.includes('#wcRestoreNote.restoring') && css.includes('#wcRestoreNote.failed'));
  t('v43.1 statis: elemen note ada di HTML', html.includes('id="wcRestoreNote"'));
  t('v43.1 statis: gameVersion v43.1', js.includes("gameVersion: 'v43.1'"));
  {
    const setTabSrc = fnSrcJ('setTab');
    t('v43.1 statis: setTab tidak menyentuh elemen/alasan restore (status tidak bisa menempel lewat pindah tab)', !setTabSrc.includes('wcRestoreNote') && !setTabSrc.includes('wcRestoreReason') && setTabSrc.includes("say('')"));
  }

  console.log(`TEST-v42.5.4-restore-ui (v43.1 contract): ${pass} lolos, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})();
