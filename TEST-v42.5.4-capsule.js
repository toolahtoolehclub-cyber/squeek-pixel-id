// v42.5.4 capsule fix — run: node TEST-v42.5.4-capsule.js  (cwd = the v42.5.4 folder)
// BUG KRITIS (user, 9 Nov 2026 ~08:38 WIB): tap RESOLVE KAPSUL -> OKX
// "Eksekusi kontrak pihak ketiga error", gas "--", Konfirmasi nonaktif.
// Parent membuktikan via simulasi eth_call: resolveCapsule(1, ...) ->
// 0x (SUKSES); resolveCapsule(712, ...) -> revert PullNotFound(712).
// Transaksi user memakai pullId=712, bukan 1. 2 SQK AMAN (tidak ada tx
// yang masuk; OKX memblokir).
// ROOT CAUSE 1 (commit): CapsuleCommitted(address indexed player,
// uint256 indexed pullId, uint256 targetRound) — player DAN pullId
// KEDUANYA indexed, jadi DATA log hanya berisi [targetRound]. Kode lama
// membaca words[0] sebagai pullId -> mendapat targetRound (712), menimpa
// nilai benar dari nextPullId (1), lalu menyimpan {pullId: 712} ke
// localStorage sqk42:capsule. Perbaikan: pullId dari topics[2]; bila
// topics < 3, fallback ke nextPull.
// ROOT CAUSE 2 (hasil resolve — belum sempat menggigit): CapsuleResolved
// (address indexed player, uint256 indexed pullId, uint256 targetRound,
// bytes32 dataHash, uint8 rarity, uint256 itemId, bool duplicate,
// uint256 kejuCompensation) — DATA hanya 6 kata [targetRound, dataHash,
// rarity, itemId, duplicate, kejuCompensation]. Kode lama mensyaratkan
// words.length >= 7 (SELALU salah -> result null -> tampil sqkResolveFail
// walau transaksi SUKSES + kompensasi Keju tidak terkirim) dan indeksnya
// off-by-one. Perbaikan: syarat >= 6; rarity=words[2], itemId=words[3],
// duplicate=words[4], kejuCompensation=words[5].
// ROOT CAUSE 3 (self-healing — WAJIB, supaya pullId user yang sudah rusak
// (712) sembuh otomatis tanpa bedah localStorage): di resolveSqkCapsule(),
// SEBELUM mengirim transaksi, verifikasi pull tersimpan on-chain via
// getter publik pulls(uint256) -> (player, targetRound, resolved)
// (selector 0x7a9dfa7e = keccak256("pulls(uint256)")[:4], diverifikasi
// live vs shop: pulls(1) -> player 0x8853...cf9a, targetRound 712,
// resolved false). Bila player==0 / player!=wallet / sudah resolved,
// pindai pull 1..nextPullId-1 cari pull milik wallet yang belum resolved
// dan targetRound-nya cocok (fallback: yang belum resolved paling baru);
// simpan perbaikan ke localStorage lalu lanjutkan resolve. Bila tidak ada
// pull yang cocok, tampilkan sqkNoPending — jangan kirim tx yang pasti
// revert.
const fs = require('fs');
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

const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
const OTHER = '0x1111111111111111111111111111111111111111';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const COMMIT_TOPIC0 = '0xfcdae1bdc0120a94c455ae8babdec61a16a600fcf9f786fd9d0a4b46c835bc25';
const RESOLVE_TOPIC0 = '0xb1190a79761e5e0820f774b1613ed3b5022912a9aa445806273a260a8527a502';
const word = (n) => BigInt(n).toString(16).padStart(64, '0');
const wordAddr = (a) => '0'.repeat(24) + a.slice(2).toLowerCase();
const wordBytes32 = (hex) => String(hex).replace(/^0x/, '').padStart(64, '0').slice(0, 64);
// pulls(uint256) return: (address player, uint256 targetRound, bool resolved) = 3 kata.
const encodePull = (player, targetRound, resolved) => '0x' + wordAddr(player) + word(targetRound) + word(resolved ? 1 : 0);

// --- Harness: fungsi kapsul asli + mock eth_call + mock localStorage ---
const mkHarness = (pullsMap, nextPullId, rpcFails) => {
  const store = {};
  const saves = [];
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const saveJSON = (k, v) => { saves.push([k, v]); try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
  const loadJSON = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v === null ? fb : v; } catch (_) { return fb; } };
  const sqkUint = (r) => { try { return BigInt(r); } catch (_) { return null; } };
  const sqkWordUint = (n) => BigInt(n).toString(16).padStart(64, '0');
  const sqkEthCall = async (to, data) => {
    if (rpcFails) throw new Error('RPC_DOWN');
    const d = String(data).toLowerCase();
    if (d.startsWith('0x7a9dfa7e')) { // pulls(uint256)
      const id = Number(BigInt('0x' + d.slice(10)));
      if (!(id in pullsMap)) throw new Error('NO_PULL_' + id);
      return pullsMap[id];
    }
    if (d === '0x6cb9e7ee') return '0x' + word(nextPullId); // nextPullId()
    throw new Error('UNKNOWN_CALL_' + d.slice(0, 10));
  };
  const src = ['sqkParseLogWords', 'sqkPullIdFromCommitLog', 'sqkResultFromResolveLog', 'sqkPendingCapsule', 'sqkSavePendingCapsule', 'sqkHealPendingCapsule'].map(fnSrcJ).join('\n');
  const fn = new Function('SQK_CAPSULE_COMMITTED_TOPIC0', 'SQK_CAPSULE_RESOLVED_TOPIC0', 'SQK_RARITY_NAMES', 'SQK_SEL', 'CONFIG', 'sqkEthCall', 'sqkUint', 'sqkWordUint', 'saveJSON', 'loadJSON', 'localStorage',
    src + '\nreturn { sqkParseLogWords, sqkPullIdFromCommitLog, sqkResultFromResolveLog, sqkPendingCapsule, sqkSavePendingCapsule, sqkHealPendingCapsule };');
  const api = fn(COMMIT_TOPIC0, RESOLVE_TOPIC0, ['common', 'rare', 'epic', 'legendary'],
    { pulls: '0x7a9dfa7e', nextPullId: '0x6cb9e7ee' },
    { SHOP_ADDRESS: '0x43f568AcfaDcee4333785c9F26596719ED0B02fb' },
    sqkEthCall, sqkUint, sqkWordUint, saveJSON, loadJSON, localStorage);
  return { api, store, saves, localStorage };
};

(async () => {
  // 0. Selector pulls() di script.js cocok dengan yang terverifikasi live.
  t('v42.5.4 kapsul: SQK_SEL.pulls = 0x7a9dfa7e (keccak256 pulls(uint256)[:4], terverifikasi live)',
    /pulls:\s*'0x7a9dfa7e'/.test(js));
  // Statis: resolveSqkCapsule memanggil healer SEBELUM Worker fetch.
  {
    const rSrc = fnSrcJ('resolveSqkCapsule');
    const healAt = rSrc.indexOf('sqkHealPendingCapsule(w, pending0)');
    const fetchAt = rSrc.indexOf('/capsule-resolve');
    t('v42.5.4 kapsul: resolveSqkCapsule memanggil sqkHealPendingCapsule SEBELUM /capsule-resolve',
      healAt > 0 && fetchAt > 0 && healAt < fetchAt);
    t('v42.5.4 kapsul: resolveSqkCapsule memakai pullId hasil heal (pending = hasil heal)',
      rSrc.includes('let pending = await sqkHealPendingCapsule(w, pending0)') && rSrc.includes("if (!pending) return sqkShopMsg(msg('sqkNoPending'))"));
    const cSrc = fnSrcJ('commitSqkCapsule');
    const cSrcNoComments = cSrc.split('\n').map(l => l.split('//')[0]).join('\n');
    t('v42.5.4 kapsul: commitSqkCapsule memakai sqkPullIdFromCommitLog (bukan words[0] di kode)',
      cSrc.includes('sqkPullIdFromCommitLog(log, pullId)') && !cSrcNoComments.includes('words[0]'));
  }

  // 1. Parsing log commit SUNGGUHAN: topics[2]=1, data=[712] -> pullId=1 (bukan 712).
  {
    const h = mkHarness({}, 2, false);
    const playerWord = '0x' + wordAddr(ADDR);
    const pullWord = '0x' + word(1);
    const log = { topics: [COMMIT_TOPIC0, playerWord, pullWord], data: '0x' + word(712) };
    const got = h.api.sqkPullIdFromCommitLog(log, 1);
    t('v42.5.4 kapsul: log commit sungguhan (topics[2]=1, data=[712]) -> pullId=1', got === 1);
    // Regresi: logika LAMA (words[0] sebagai pullId) akan mengembalikan 712.
    const parsed = h.api.sqkParseLogWords(log, COMMIT_TOPIC0);
    const oldWords = parsed.topics.length >= 2 ? parsed.words : parsed.words.slice(1);
    const oldPullId = Number(BigInt('0x' + oldWords[0]));
    t('v42.5.4 kapsul REGRESI: logika lama (words[0]) pada log yang sama -> 712 (bug terbukti)', oldPullId === 712);
    // Log bukan CapsuleCommitted -> null (lanjut ke log berikutnya).
    const otherLog = { topics: ['0x' + 'ab'.repeat(32), playerWord, pullWord], data: '0x' + word(712) };
    t('v42.5.4 kapsul: log topik lain -> null', h.api.sqkPullIdFromCommitLog(otherLog, 1) === null);
    // topics < 3 (hanya topic0 + player) -> fallback (nextPull).
    const shortLog = { topics: [COMMIT_TOPIC0, playerWord], data: '0x' + word(712) };
    t('v42.5.4 kapsul: log commit topics<3 -> fallback nextPull', h.api.sqkPullIdFromCommitLog(shortLog, 1) === 1);
  }

  // 2. Parsing log CapsuleResolved SUNGGUHAN (6 kata data) -> hasil benar;
  //    dan buktikan syarat lama >=7 akan gagal (regresi).
  {
    const h = mkHarness({}, 2, false);
    const playerWord = '0x' + wordAddr(ADDR);
    const pullWord = '0x' + word(1);
    const dataHash = '0xe5e50fa1c93d4d248816f8127d04dac9e84fe6ad505adf051c4b08ffcebf5880';
    const log = { topics: [RESOLVE_TOPIC0, playerWord, pullWord],
      data: '0x' + word(712) + wordBytes32(dataHash) + word(1) + word(102) + word(1) + word(50) };
    const r = h.api.sqkResultFromResolveLog(log);
    t('v42.5.4 kapsul: log resolve 6 kata -> rarity rare', r && r.rarity === 'rare');
    t('v42.5.4 kapsul: log resolve 6 kata -> itemId 102', r && r.itemId === 102);
    t('v42.5.4 kapsul: log resolve 6 kata -> duplicate true', r && r.duplicate === true);
    t('v42.5.4 kapsul: log resolve 6 kata -> kejuCompensation 50', r && r.kejuCompensation === 50);
    // Regresi: syarat LAMA words.length >= 7 pada log 6 kata ini SELALU salah.
    const parsed = h.api.sqkParseLogWords(log, RESOLVE_TOPIC0);
    t('v42.5.4 kapsul REGRESI: syarat lama >=7 pada log 6 kata -> false (result lama selalu null)', parsed.words.length === 6 && !(parsed.words.length >= 7));
    // Regresi indeks lama: words[3] dipakai sebagai rarity -> 102 -> 'common'
    // (salah; benar 'rare'), words[4] dipakai sebagai itemId -> 1 (salah; benar 102).
    const oldRarity = ['common', 'rare', 'epic', 'legendary'][Number(BigInt('0x' + parsed.words[3]))] || 'common';
    const oldItem = Number(BigInt('0x' + parsed.words[4]));
    t('v42.5.4 kapsul REGRESI: indeks lama words[3] sebagai rarity -> common (salah; benar rare)', oldRarity === 'common');
    t('v42.5.4 kapsul REGRESI: indeks lama words[4] sebagai itemId -> 1 (salah; benar 102)', oldItem === 1);
    // Varian common, bukan duplikat, tanpa kompensasi.
    const log2 = { topics: [RESOLVE_TOPIC0, playerWord, pullWord],
      data: '0x' + word(712) + wordBytes32(dataHash) + word(0) + word(101) + word(0) + word(0) };
    const r2 = h.api.sqkResultFromResolveLog(log2);
    t('v42.5.4 kapsul: log resolve common -> rarity common, itemId 101, duplicate false, keju 0',
      r2 && r2.rarity === 'common' && r2.itemId === 101 && r2.duplicate === false && r2.kejuCompensation === 0);
    // Log bukan CapsuleResolved -> null. Data < 6 kata -> null.
    const otherLog = { topics: [COMMIT_TOPIC0, playerWord, pullWord], data: '0x' + word(712) };
    t('v42.5.4 kapsul: log topik lain -> result null', h.api.sqkResultFromResolveLog(otherLog) === null);
    const shortLog = { topics: [RESOLVE_TOPIC0, playerWord, pullWord], data: '0x' + word(712) + wordBytes32(dataHash) };
    t('v42.5.4 kapsul: log resolve data < 6 kata -> result null', h.api.sqkResultFromResolveLog(shortLog) === null);
  }

  // 3. Self-healing — KASUS USER: stored pullId 712 + nextPullId 2 +
  //    pulls(1)=(wallet,712,false) -> resolve memakai pullId 1 dan
  //    localStorage diperbaiki.
  {
    const h = mkHarness({ 712: encodePull(ZERO_ADDR, 0, false), 1: encodePull(ADDR, 712, false) }, 2, false);
    h.api.sqkSavePendingCapsule({ pullId: 712, targetRound: 712, txHash: '0xabc' });
    const before = h.saves.length;
    const healed = await h.api.sqkHealPendingCapsule(ADDR, { pullId: 712, targetRound: 712, txHash: '0xabc' });
    t('v42.5.4 kapsul HEAL (kasus user): stored 712 -> pullId 1', healed && healed.pullId === 1);
    t('v42.5.4 kapsul HEAL (kasus user): targetRound tetap 712', healed && healed.targetRound === 712);
    t('v42.5.4 kapsul HEAL (kasus user): txHash dipertahankan', healed && healed.txHash === '0xabc');
    t('v42.5.4 kapsul HEAL (kasus user): localStorage sqk42:capsule diperbaiki ke pullId 1',
      JSON.parse(h.store['sqk42:capsule']).pullId === 1 && h.saves.length > before);
  }
  // 3b. Stored pull sudah benar -> dikembalikan apa adanya, tanpa tulis ulang.
  {
    const h = mkHarness({ 1: encodePull(ADDR, 712, false) }, 2, false);
    h.api.sqkSavePendingCapsule({ pullId: 1, targetRound: 712, txHash: '0xabc' });
    const before = h.saves.length;
    const healed = await h.api.sqkHealPendingCapsule(ADDR, { pullId: 1, targetRound: 712, txHash: '0xabc' });
    t('v42.5.4 kapsul HEAL: stored pull benar -> dikembalikan apa adanya (pullId 1)',
      healed && healed.pullId === 1 && healed.targetRound === 712);
    t('v42.5.4 kapsul HEAL: stored pull benar -> localStorage TIDAK ditulis ulang', h.saves.length === before);
  }
  // 3c. Tidak ada pull yang cocok (pull 1 milik wallet lain) -> null (sqkNoPending, jangan kirim tx).
  {
    const h = mkHarness({ 712: encodePull(ZERO_ADDR, 0, false), 1: encodePull(OTHER, 712, false) }, 2, false);
    const healed = await h.api.sqkHealPendingCapsule(ADDR, { pullId: 712, targetRound: 712, txHash: '0xabc' });
    t('v42.5.4 kapsul HEAL: tidak ada pull cocok (milik wallet lain) -> null', healed === null);
  }
  // 3d. Stored pull sudah resolved + tidak ada pull lain -> null.
  {
    const h = mkHarness({ 1: encodePull(ADDR, 712, true) }, 2, false);
    const healed = await h.api.sqkHealPendingCapsule(ADDR, { pullId: 1, targetRound: 712, txHash: '0xabc' });
    t('v42.5.4 kapsul HEAL: stored pull sudah resolved + tidak ada lain -> null', healed === null);
  }
  // 3e. Fallback: targetRound tersimpan tidak cocok dengan pull mana pun ->
  //      pakai pull milik wallet yang belum resolved dan paling baru.
  {
    const h = mkHarness({ 712: encodePull(ZERO_ADDR, 0, false), 2: encodePull(ADDR, 800, false), 1: encodePull(ADDR, 712, false) }, 3, false);
    const healed = await h.api.sqkHealPendingCapsule(ADDR, { pullId: 712, targetRound: 999, txHash: '0xabc' });
    t('v42.5.4 kapsul HEAL fallback: targetRound tidak cocok -> pull terbaru belum resolved (pullId 2, ronde 800)',
      healed && healed.pullId === 2 && healed.targetRound === 800);
    t('v42.5.4 kapsul HEAL fallback: localStorage diperbaiki ke pullId 2',
      JSON.parse(h.store['sqk42:capsule']).pullId === 2);
  }
  // 3f. RPC mati -> kembalikan pending apa adanya (jalur tx gagal aman sendiri).
  {
    const h = mkHarness({}, 2, true);
    const healed = await h.api.sqkHealPendingCapsule(ADDR, { pullId: 712, targetRound: 712, txHash: '0xabc' });
    t('v42.5.4 kapsul HEAL: RPC mati -> pending dikembalikan apa adanya (tidak diblokir)', healed && healed.pullId === 712);
  }
  // 3g. Alamat wallet case-insensitive: provider bisa mengembalikan alamat
  // checksum (huruf besar) sementara RPC mengembalikan player lowercase.
  {
    const h = mkHarness({ 1: encodePull(ADDR, 712, false) }, 2, false);
    const healed = await h.api.sqkHealPendingCapsule(ADDR.toUpperCase(), { pullId: 1, targetRound: 712, txHash: '0xabc' });
    t('v42.5.4 kapsul HEAL: perbandingan alamat case-insensitive (wallet checksum vs player lowercase)', healed && healed.pullId === 1);
  }

  console.log(`\nTEST-v42.5.4-capsule: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
