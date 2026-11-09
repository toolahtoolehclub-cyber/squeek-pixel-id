// Worker v13 tests — /capsule-resolve fallback to /v1/events.
// Run: ./build-worker.sh bundle-only && node TEST-v13-capsule-fallback.js
// (cwd = the v42.5.3 folder). The test imports the REAL bundled worker
// (dist/worker.js) and calls its fetch handler with a mocked global fetch
// (Squeek API) + mocked D1 env + a generated test SIGNING_KEY — no live
// network, no real secret, no on-chain call.
const fs = require('fs');
const crypto = require('crypto');
let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }

const WALLET = '0x88538a82143065664232422e2dec4309038fcf9a';
const TX712 = '0xe5e50fa1c93d4d248816f8127d04dac9e84fe6ad505adf051c4b08ffcebf5880';

function mockSettlements(throughs) {
  return {
    recentSettlements: throughs.map((th) => ({
      transactionHash: '0x' + String(th).padStart(64, '0'),
      previousSettledThroughRound: String(th - 1),
      settledThroughRound: String(th),
    })),
  };
}
function settleEvent(prev, through, tx) {
  return {
    id: 'chain:11155111:0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4:' + tx + ':1:system.settlement_completed',
    type: 'system.settlement_completed',
    occurredAt: '2026-11-08T18:30:36.000Z',
    source: { transactionHash: tx },
    payload: { previousSettledThroughRound: String(prev), settledThroughRound: String(through) },
  };
}
function mockDB() {
  return {
    prepare() {
      const stmt = {
        bind() { return stmt; },
        run: async () => ({}),
        first: async () => ({ n: 0, oldest: null }),
      };
      return stmt;
    },
  };
}

async function main() {
  const bundlePath = '/tmp/v42.5.3-build/dist/worker.js';
  if (!fs.existsSync(bundlePath)) {
    console.log('FAIL: bundle missing — run ./build-worker.sh bundle-only first');
    process.exit(1);
  }
  const bundle = await import(bundlePath);
  const { secp256k1 } = await import('/tmp/v42.5.3-build/node_modules/@noble/curves/secp256k1.js');
  const { keccak_256 } = await import('/tmp/v42.5.3-build/node_modules/@noble/hashes/sha3.js');
  const { bytesToHex, hexToBytes, concatBytes } = await import('/tmp/v42.5.3-build/node_modules/@noble/hashes/utils.js');

  // Test signing key (generated fresh each run — never the real secret).
  const priv = crypto.randomBytes(32);
  const privHex = Buffer.from(priv).toString('hex');
  const pubComp = secp256k1.getPublicKey(priv, true);
  const pubUncomp = secp256k1.getPublicKey(priv, false);
  const testAddr = '0x' + bytesToHex(keccak_256(pubUncomp.slice(1)).slice(-20));
  const env = { DB: mockDB(), SIGNING_KEY: privHex };

  async function callResolve(body, fetchStub) {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return fetchStub(String(url));
    };
    const req = new Request('https://worker/capsule-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await bundle.default.fetch(req, env, {});
    const data = await res.json();
    return { status: res.status, data, calls };
  }
  function verifySig(sig, args) {
    const digest = bundle.capsuleResolveDigest(args);
    const sigBytes = hexToBytes(sig.slice(2));
    const rec65 = concatBytes(new Uint8Array([sigBytes[64] - 27]), sigBytes.slice(0, 64));
    const recPub = secp256k1.recoverPublicKey(rec65, digest, { prehash: false });
    return bytesToHex(recPub) === bytesToHex(pubComp);
  }

  // --- (a) Round 712: outside the 741-752 window, found in events ---
  {
    const settlements = mockSettlements([741, 742, 743, 744, 745, 746, 747, 748, 749, 750, 751, 752]);
    const eventsPage = {
      events: [
        settleEvent(751, 752, '0x' + 'a'.repeat(64)),
        settleEvent(750, 751, '0x' + 'b'.repeat(64)),
        { type: 'system.round_started', payload: {} },
        settleEvent(711, 712, TX712),
      ],
      nextCursor: null,
    };
    const { status, data, calls } = await callResolve(
      { wallet: WALLET, pullId: 1, targetRound: 712 },
      async (url) => {
        if (url.includes('/v1/settlements')) return { ok: true, json: async () => settlements };
        if (url.includes('/v1/events')) return { ok: true, json: async () => eventsPage };
        throw new Error('unexpected fetch: ' + url);
      }
    );
    t('(a) 712 fallback returns 200', status === 200);
    t('(a) 712 dataHash is exactly the event tx hash', data.dataHash === TX712);
    t('(a) 712 pullId/targetRound echo', data.pullId === 1 && data.targetRound === 712);
    t('(a) 712 deadline is now+600 (within 60s)', typeof data.deadline === 'number' && data.deadline > Math.floor(Date.now() / 1000) + 500 && data.deadline <= Math.floor(Date.now() / 1000) + 650);
    t('(a) 712 signature recovers to the test signer', typeof data.signature === 'string' && verifySig(data.signature, { player: WALLET.toLowerCase(), pullId: 1, targetRound: 712, dataHash: TX712, deadline: data.deadline }));
    t('(a) 712 signature equals direct signCapsuleResolve (deterministic)', data.signature === bundle.signCapsuleResolve(privHex, { player: WALLET.toLowerCase(), pullId: 1, targetRound: 712, dataHash: TX712, deadline: data.deadline }));
    t('(a) 712 fallback actually consulted /v1/events', calls.some((u) => u.includes('/v1/events')));
  }

  // --- (b) In-window round still uses /v1/settlements, never events ---
  {
    const tx750 = '0x' + 'c'.repeat(64);
    const settlements = mockSettlements([748, 749, 750, 751, 752]);
    settlements.recentSettlements[2].transactionHash = tx750;
    const { status, data, calls } = await callResolve(
      { wallet: WALLET, pullId: 1, targetRound: 750 },
      async (url) => {
        if (url.includes('/v1/settlements')) return { ok: true, json: async () => settlements };
        throw new Error('events must not be called for an in-window round: ' + url);
      }
    );
    t('(b) in-window 750 returns 200', status === 200);
    t('(b) in-window 750 dataHash is the settlements tx hash', data.dataHash === tx750);
    t('(b) in-window 750 never fetched /v1/events', !calls.some((u) => u.includes('/v1/events')));
    t('(b) in-window 750 signature recovers to the test signer', verifySig(data.signature, { player: WALLET.toLowerCase(), pullId: 1, targetRound: 750, dataHash: tx750, deadline: data.deadline }));
  }

  // --- (c) Round settled per frontier but found nowhere -> existing 409 ---
  {
    const settlements = mockSettlements([741, 742, 743, 744, 745, 746, 747, 748, 749, 750, 751, 752]);
    const eventsPage = {
      events: [752, 751, 750, 749, 748, 747, 746, 745].map((th) => settleEvent(th - 1, th, '0x' + 'd'.repeat(64))),
      nextCursor: null,
    };
    const { status, data } = await callResolve(
      { wallet: WALLET, pullId: 1, targetRound: 700 },
      async (url) => {
        if (url.includes('/v1/settlements')) return { ok: true, json: async () => settlements };
        if (url.includes('/v1/events')) return { ok: true, json: async () => eventsPage };
        throw new Error('unexpected fetch: ' + url);
      }
    );
    t('(c) unfound 700 returns 409', status === 409);
    t('(c) unfound 700 keeps the existing error', data.error === 'round not settled yet' && String(data.detail).includes('older than the API'));
  }

  // --- (d) Pure-function: settlementEventForRound pagination + early stop + cap ---
  {
    const page1 = { events: [settleEvent(751, 752, '0x' + 'a'.repeat(64)), settleEvent(750, 751, '0x' + 'b'.repeat(64))], nextCursor: 'page-2' };
    const page2 = { events: [settleEvent(711, 712, TX712)], nextCursor: null };
    let n = 0;
    const fetchFn = async (url) => {
      n++;
      return { ok: true, json: async () => (url.includes('cursor=page-2') ? page2 : page1) };
    };
    const rec = await bundle.settlementEventForRound(712, fetchFn);
    t('(d) pagination finds 712 on page 2', rec !== null && rec.transactionHash === TX712 && rec.settledThroughRound === '712');
    t('(d) pagination fetched exactly 2 pages', n === 2);
    // Early stop: first settlement event already below the target.
    n = 0;
    const fetchFn2 = async () => {
      n++;
      return { ok: true, json: async () => ({ events: [settleEvent(751, 752, '0x' + 'a'.repeat(64)), settleEvent(699, 700, '0x' + 'e'.repeat(64))], nextCursor: 'never' }) };
    };
    const rec2 = await bundle.settlementEventForRound(712, fetchFn2);
    t('(d) early stop returns null once through < target', rec2 === null);
    t('(d) early stop fetched only 1 page', n === 1);
    // 10-page cap: 10 pages, no match, no early stop (through always > target).
    n = 0;
    const fetchFn3 = async () => {
      n++;
      return { ok: true, json: async () => ({ events: [settleEvent(751, 752, '0x' + 'a'.repeat(64))], nextCursor: 'more' }) };
    };
    const rec3 = await bundle.settlementEventForRound(712, fetchFn3);
    t('(d) 10-page cap returns null', rec3 === null);
    t('(d) 10-page cap fetched exactly 10 pages', n === 10);
    // Events API down -> null (caller keeps the 409).
    const rec4 = await bundle.settlementEventForRound(712, async () => ({ ok: false, json: async () => ({}) }));
    t('(d) events API failure returns null', rec4 === null);
  }

  // --- (e) Pure-function: settlementForRound + dataHashForSettlement ---
  {
    const recent = mockSettlements([741, 742, 743, 744, 745, 746, 747, 748, 749, 750, 751, 752]).recentSettlements;
    t('(e) settlementForRound finds in-window 750', bundle.settlementForRound(recent, 750) !== null && bundle.settlementForRound(recent, 750).settledThroughRound === '750');
    t('(e) settlementForRound returns null for 712 (out of window)', bundle.settlementForRound(recent, 712) === null);
    t('(e) dataHashForSettlement uses the event tx hash', bundle.dataHashForSettlement({ transactionHash: TX712 }) === TX712);
    t('(e) dataHashForSettlement falls back to keccak256 without a tx hash', /^0x[0-9a-f]{64}$/.test(bundle.dataHashForSettlement({ previousSettledThroughRound: '711', settledThroughRound: '712' })));
  }

  // --- (f) Static: fallback wired into the worker source ---
  {
    const src = fs.readFileSync('worker.js', 'utf8');
    t('(f) worker version is 13', src.includes('version: 13'));
    t('(f) worker fetches /v1/events with nextCursor pagination', src.includes('SQUEEK_API_EVENTS') && src.includes('system.settlement_completed') && src.includes('nextCursor') && src.includes('page < 10'));
    t('(f) fallback only when target <= settled frontier', src.includes('settled !== null && targetRound <= settled'));
    t('(f) /capsule-resolve still uses settlements first', src.includes('settlementForRound(recent, targetRound)'));
  }

  console.log(`\nTEST-v13-capsule-fallback: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.log('ERROR:', e && e.stack ? e.stack : e); process.exit(1); });
