// Squeekchain global leaderboard — Cloudflare Worker + D1.
// Public scoreboard: anyone can read the top scores; anyone can submit their
// own best score. No login, no token, no personal data beyond the wallet
// address the player already uses as their song seed. The game shows wallet
// addresses truncated (0x1234...abcd).
//
// Fase 0 (v2, Batch 1): server-issued play sessions + plausibility checks.
// Fase 1 (v3, Batch 2): EIP-712 attestations over deterministic replays.
//   No enforcement: scores without a replay behaved exactly as in v2.
//
// Fase 2 (v4, Batch 3) — ASYNC REPLAY VERIFICATION + ENFORCEMENT.
//   POST /scores now REQUIRES a valid v1 replay, or it is rejected 422.
//   A replay that passes the cheap synchronous checks (shape, bounds,
//   hash, session, wall-clock) is stored as pending and verified by a
//   Cron Trigger (every minute) that replays it through the SAME chart +
//   judge logic the game uses (engine.js, single source of truth — this
//   file NEVER re-implements chart generation or judging):
//     buildChart(header) -> chart, simulate(chart, replay) -> result.
//   Only a replay whose simulated score/counts/maxCombo match the claim
//   EXACTLY (acc within 0.01) gets verified=1 + an EIP-712 attestation and
//   appears on the board. Anything else is marked rejected (GET /verify
//   reports it as 422 with the reason). verified=1 exists ONLY for a
//   replay that passed simulation + attestation. Legacy rows (TEST 3000,
//   race 66805) stay verified=0, untouched.
//
//   Why async: Worker Free = 10 ms CPU/request. buildChart + simulate for
//   a full song is small but the queue + scheduled trigger keeps the
//   submit path cheap and lets verification run outside the request.
//   Cron Triggers ARE available on the free tier (verified live 2026-11-08:
//   GET .../workers/scripts/squeekchain-leaderboard/schedules works).
//   This is genuinely async: POST returns 202 pending, the cron verifies,
//   GET /verify reports pending -> verified (200) or rejected (422).
//
// Signer (server-only key, held as Worker secret SIGNING_KEY, never in any
// file or repo): 0x69f24c0598c8e6b6b938527d84141dd04ec2b3e3
//
// Fase 3 (v5, Batch 5-off-chain) — TOKO KEJU + LIGA MINGGUAN (no contract).
//   Cheese (soft currency, Keju): credited ONLY when a replay is VERIFIED
//   (verifyOne, inside the same atomic D1 batch as the score upsert),
//   idempotent per replay_hash via cheese_ledger (UNIQUE replay_hash).
//   100 per verified song + 500 for grade S/SS + 50 for the daily mission
//   (first verified song of the Squeek day, day flips 19:00 WIB).
//   Capsule pull (POST /cheese/pull): 100 Keju, server-side RNG
//   (crypto.getRandomValues), weighted rarity 70/22/7/1, duplicate ->
//   compensation Keju. Buy/equip via POST /cheese/buy + /cheese/equip.
//   League (GET /league): league_scores (wallet, week_start, best_score)
//   written on every verified FREE score; week starts Monday 19:00 WIB
//   (= Monday 12:00 UTC), top 30 per week. Nothing here touches the
//   verification path: validateReplay / verifySimulated / enforcement
//   are byte-identical to v4; the judge windows, tempo and score formula
//   live in engine.js and are untouched. No SQK, no contract, no Sepolia
//   transaction anywhere in v5.
//
// Fase 3b (v6, v41.1 patch) — LEAGUE ✓ BADGE. GET /league now returns
//   `verified` per row (LEFT JOIN scores on wallet + mode='free') and
//   in `you`, so the client can show the same green ✓ as the global
//   board. Display-only: no verification, enforcement, replay, cheese
//   or league-reset logic changed. League rows only ever come from
//   verifyOne, so verified is 1 for every real league row; the join
//   only guards the display if the scores row ever disagrees.
//
// Fase 4 (v7, Batch 5 — TOKO SQK + KAPSUL EMAS, v42; wired v42.1 / Worker v8) — Worker only signs
//   and credits; it NEVER holds SQK and NEVER sends a transaction.
//   On-chain anchors (frozen interface, same spec as the shop contract):
//     SCORES_CONTRACT 0x06be1517d7187ec1663c4f26d11a8f6cc217304f (Batch 4,
//       deployed by the user 2026-11-08; signer + DOMAIN_SEPARATOR match
//       this Worker exactly — see batch4-prep/DEPLOYED.md).
//     SHOP_CONTRACT 0x43f568AcfaDcee4333785c9F26596719ED0B02fb (deployed
//       by the user 2026-11-08 via Remix; Sourcify full match — see
//       batch4-prep/DEPLOYED-SHOP.md). The 503 "shop not deployed"
//       gate stays in the code as a guard but is now inactive:
//       sqkShopDeployed() is true, so /capsule-resolve signs for the
//       real shop domain and /capsule verifies receipts against it.
//     SQK_TOKEN 0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e (Sepolia,
//       name "Squeek", symbol "SQK", 18 decimals, EIP-2612 permit;
//       domain name "Squeek" + version "1" verified live 2026-11-08:
//       computed DOMAIN_SEPARATOR 0x2cc99df9c423e838a7b45ff60b5ee38ad122e
//       a209dca8da37a8d2f3befdf0017 == on-chain DOMAIN_SEPARATOR()).
//   POST /capsule-resolve {wallet, pullId, targetRound}:
//     (a) validates input; (b) asks the public Squeekchain API
//     (GET /v1/settlements, no query params — any query is rejected
//     "invalid_query") for the settlement record covering targetRound;
//     (c) 409 while the round is not settled yet (or too old to be in
//     the API's 10-entry recent window); (d) signs the CapsuleResolve
//     struct with SIGNING_KEY (same key as the score attestation — it
//     is also the shop contract's dataSigner) and returns
//     {pullId, targetRound, dataHash, deadline, signature}.
//     dataHash DEFINITION (no per-round hash field exists in the API):
//     the transactionHash of the settlement that settled through
//     targetRound (first recentSettlements entry with
//     previousSettledThroughRound < targetRound <= settledThroughRound).
//     It is bytes32, on-chain, and canonical: anyone can re-fetch the
//     same /v1/settlements record and check the hash. FALLBACK, only if
//     the record has no usable transactionHash: dataHash =
//     keccak256(canonical JSON of the whole settlement record).
//     Deadline = now + 600 s. Rate limit 10/wallet/hour (submit_log,
//     same table/pattern as POST /scores).
//   POST /capsule {wallet, txHash}:
//     credits the duplicate-capsule Keju compensation. Verifies the
//     Sepolia receipt (public RPC): status 1, from == wallet,
//     to == SHOP_CONTRACT, and a CapsuleResolved log with duplicate=true;
//     kejuCompensation is read from that log (never trusted from the
//     client). Credit goes to cheese_balances + cheese_ledger kind
//     'capsule-duplicate' with replay_hash = txHash — the partial
//     UNIQUE index on replay_hash (migrate-v5.sql) makes the credit
//     idempotent: the same tx can never pay twice. No D1 schema change.
//   NOTHING else changed in v7: replay verification, enforcement 422,
//   EIP-712 score attestation, Keju economy, weekly league, and the
//   existing rate limits are byte-identical to v6.
//   v42.1 / Worker v8: ONLY SHOP_CONTRACT wired to the deployed shop
//   address (above) + GET / version 7 -> 8. No other line changed.
//   v42.4 / Worker v9: replay input/poll/golden t BOLEH NEGATIF sampai
//   -2,5 (LEAD_IN 2 detik + 0,5 margin) — client v42.4 merekam songTime
//   mentah (dulu dijepit >= 0 di replaySongT, replay user 0xcafb…
//   ditolak karena itu). Tanpa ini, replay v42.4 dengan tap lead-in
//   ditolak checkReplay dengan "t out of range". Tidak ada perubahan
//   lain: verifikasi, enforcement, EIP-712, Keju, liga byte-identical.
// EIP-712 domain: { name: "Squeek Pixel ID", version: "1",
//   chainId: 11155111 (Sepolia), verifyingContract: <signer address> }
// Attestation: player (address), score (uint256), accuracy (uint256 =
//   Math.round(acc*100)), songId (string), gameVersion (string, e.g. "v40"),
//   seed (uint256), replayHash (bytes32), nonce (uint256), deadline
//   (uint256, epoch seconds, now+600).
// songId is FROZEN: mode + "|" + genre + "|" + diff + "|" + seedKey,
// computed from the replay header. The client uses the same formula.
// replayHash is SHA-256 (hex) of the canonical JSON of the replay
// (canonical = JSON.stringify with keys sorted recursively). The hash is
// NOT keccak — the EIP-712 struct just carries the 32 SHA-256 bytes.
// Nonce is per-wallet monotonic in D1 table `nonces`, +1 per attestation
// the server signs. A replay_hash already in D1 table `replays` is never
// stored twice: the stored status is returned (verified -> signature,
// pending -> 202, rejected -> 422). A replay already attested to a
// DIFFERENT wallet is rejected (422) so a run cannot be replayed under
// someone else's address.
//
// What verification proves (honest scope): the claimed score is achievable
// by the recorded inputs on the deterministic chart for that seedKey, the
// run started inside a fresh server-issued session window, and the run
// took at least the song's duration in wall time. It does NOT prove a
// human played in real time: a bot that fetches a session, derives the
// public chart and waits out the song could still fabricate a run. The
// session + wall-clock checks bound that to one fresh session per run;
// blind score spam (invented numbers) is dead.
//
// BUILD: this file imports @noble/curves + @noble/hashes and ./engine.js,
// which Workers cannot resolve at deploy time. Bundle first (esbuild
// resolves ./engine.js into the bundle; the repo keeps the import), then
// deploy the bundle:
//   cd /tmp/v40-build && cp <repo-v40>/worker.js <repo-v40>/engine.js . \
//     && npx esbuild worker.js --bundle --format=esm --outfile=dist/worker.js
//   python3 ~/workspace/custom-connectors/custom.cloudflare/bin/upload_worker.py \
//     squeekchain-leaderboard dist/worker.js cd6920f3-3efb-491d-ae0c-b287069c8052
// D1 migration (once, before deploy — see migrate-v4.sql):
//   CREATE TABLE verify_queue (...); ALTER TABLE replays ADD COLUMN
//   verification_status TEXT NOT NULL DEFAULT 'unverified';
//   UPDATE replays SET verification_status='verified' WHERE signature IS NOT NULL;
// Cron schedule (after deploy):
//   PUT /client/v4/accounts/256be9628bc7256755a2f9d0a7780621/workers/scripts/squeekchain-leaderboard/schedules
//   [{"cron": "* * * * *"}]   (array body — a bare {"cron": ...} object is
//   rejected 400 "Could not parse request body"; then GET the same path
//   to confirm)
// The secret must exist first (PUT .../workers/scripts/squeekchain-leaderboard/secrets
// {"name":"SIGNING_KEY","text":"<64-hex>","type":"secret_text"}).
// It already exists since v3 — do NOT rotate or re-enter it.
//
// Endpoints (all JSON, CORS open):
//   GET  /                  -> { service, version: 9 }
//   GET  /cheese?wallet=0x...   -> { wallet, balance, items: [{id, slot,
//                             rarity, name, price, equipped}], catalog }
//                             (no wallet -> catalog only, balance 0)
//   POST /cheese/buy {wallet, item_id}
//                          -> { ok, item, balance } or 400/402
//   POST /cheese/pull {wallet}
//                          -> { ok, item, duplicate, compensation, balance }
//                             (100 Keju, server RNG, weighted 70/22/7/1)
//   POST /cheese/equip {wallet, item_id}
//                          -> { ok, equipped, slot }
//   POST /capsule-resolve {wallet, pullId, targetRound}
//                          -> { pullId, targetRound, dataHash, deadline,
//                             signature } or 409 (round not settled yet)
//                             or 503 (shop not deployed) or 429.
//   POST /capsule {wallet, txHash}
//                          -> { ok, compensation, balance,
//                             alreadyCredited } or 400/503.
//                             Credits duplicate-capsule Keju from a
//                             verified CapsuleResolved receipt, idempotent
//                             per txHash.
//   GET  /league?week=YYYY-MM-DD&wallet=0x...
//                          -> { week_start, reset_at, count,
//                             scores: [{rank, wallet, name, best_score,
//                                       verified}]
//                             (top 30), you: {rank, best_score, verified} | null }
//   GET  /scores?mode=free&limit=20
//                          -> { mode, count, scores: [{rank, wallet, name,
//                             score, acc, verified, updated_at}] }
//   POST /session          -> { sessionId, seed, nonce, expiresAt }
//                             (seed is server-issued, valid 30 minutes,
//                             single use)
//   POST /scores {wallet, name, score, acc, mode,
//                 sessionId (REQUIRED in v4), notes?, taps?, durationMs?,
//                 replay (REQUIRED in v4), replayHash?, gameVersion?}
//                          -> 202 { ok, pending:true,
//                             verification_status:"pending", replayHash,
//                             wallet, mode, score } when the replay passes
//                             the synchronous checks and is queued;
//                             200 { ok, duplicate:true, verified:1,
//                             signature, ... } when the same replay was
//                             already verified for this wallet;
//                             202 { ok, pending:true, ... } when the same
//                             replay is still pending for this wallet;
//                             422 for every replay/session failure:
//                             missing replay, practice mode, shape/bounds,
//                             hash mismatch, replay of another wallet,
//                             missing/invalid/expired/used session, seed
//                             mismatch, wall-clock violation.
//                             Rate limit 10/wallet/hour, 30/IP/hour (429);
//                             plausibility failure -> 400, not stored.
//                             Scores appear on the board ONLY after the
//                             cron verifies them (verified=1 + attestation).
//   GET  /verify?replayHash=0x...
//                          -> 202 { verification_status:"pending"|
//                             "processing", replayHash } while queued;
//                             200 { verification_status:"verified",
//                             signature, nonce, deadline, replayHash,
//                             wallet, mode, score } once verified;
//                             422 { verification_status:"rejected",
//                             reason, replayHash } when verification failed.
//   GET  /rank?wallet=0x...&mode=free
//                          -> { wallet, mode, rank, score, total }

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
// Single source of truth for chart + judge logic (extracted from
// script.js). buildChart(header) rebuilds the exact chart the game played;
// simulate(chart, replay) replays the recorded inputs through the exact
// judge rules and returns { score, acc, maxCombo, counts, grade,
// playerDistM, oppDistM, win, goldenHits, goldenChecks, oppDistMDerived,
// oppDistMMatch } — see the contract in AUDIT-v40.md §2. This file never
// duplicates that logic.
// engine.js is UMD (no ESM `export`, so it still loads as a classic
// <script> in the browser): the bundle inlines it for its side effect
// (it sets globalThis.SqueekEngine) and this file reads the API off there.
import "./engine.js";
const { buildChart, simulate } = globalThis.SqueekEngine;

const MODES = ["free", "daily", "live", "race", "boss", "challenge"];
const GENRES = ["cyber", "synth", "chip", "void"];
const DIFFS = ["easy", "normal", "hard"];
const MAX_SCORE = 5000000;
const MAX_NAME = 16;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX_WALLET = 10;
const RATE_MAX_IP = 30;
// A perfect run scores at most ~1800 points per note; the +1000 slack
// covers menu/idle ticks counted in the score.
const MAX_SCORE_PER_NOTE = 1800;
const SCORE_SLACK = 1000;
const MAX_EXTRA_TAPS = 50;
const MIN_DURATION_MS = 30000;
const MAX_DURATION_MS = 300000;
// Replay limits (v1).
const MAX_POLLS = 600;
const MAX_REPLAY_BYTES = 256 * 1024;
const MAX_GAME_VERSION = 16;
// Verification (v4).
const VERIFY_BATCH = 3; // rows per cron run — keeps one scheduled
// invocation comfortably inside the 10 ms free-tier CPU budget.
const VERIFY_MAX_ATTEMPTS = 3; // transient failures, then rejected.
const VERIFY_STALE_MS = 5 * 60 * 1000; // 'processing' older than this is
// presumed dead (invocation died mid-run) and reset to pending.
const ACC_TOL = 0.01; // simulated acc must match the claim within this.
const CHART_DURATION_TOL = 0.011; // header.duration is toFixed(3).
const W_GOOD = 0.135; // judge window, seconds (CONFIG.W.good).
const GOLDEN_MAX = 2; // a <=300 s song crosses at most one 10-minute
// round boundary; +1 slack for a long pause mid-song.
const REALTIME_SKEW_MS = 5000; // wall-clock vs audio-clock tolerance.

// --- Cheese (Keju) + weekly league (v5) — pure functions, unit-tested ---
// Economy (Rancangan-v38-OnChain Fase 4, cheese half only — NO SQK here):
// 100 Keju per verified song, +500 grade S/SS, +50 daily mission (first
// verified song of the Squeek day). Capsule: 100 Keju/pull, odds
// 70/22/7/1, duplicate -> compensation. All prices are Keju only.
const CHEESE_PER_SONG = 100;
const CHEESE_GRADE_S_BONUS = 500;
const CHEESE_DAILY_BONUS = 50;
const CHEESE_PULL_PRICE = 100;
const CHEESE_DUP_COMP = { common: 25, rare: 50, epic: 100, legendary: 250 };
const CHEESE_CATALOG = [
  { id: "note-mint", slot: "note", rarity: "common", price: 300, name: "Mint Notes" },
  { id: "note-gold", slot: "note", rarity: "rare", price: 800, name: "Golden Notes" },
  { id: "note-void", slot: "note", rarity: "epic", price: 1500, name: "Void Notes" },
  { id: "note-rainbow", slot: "note", rarity: "legendary", price: 0, name: "Rainbow Notes", capsuleOnly: true },
  { id: "frame-neon", slot: "frame", rarity: "common", price: 300, name: "Neon Frame" },
  { id: "frame-gold", slot: "frame", rarity: "rare", price: 800, name: "Golden Frame" },
  { id: "frame-royal", slot: "frame", rarity: "epic", price: 1500, name: "Royal Frame" },
  { id: "frame-rainbow", slot: "frame", rarity: "legendary", price: 0, name: "Rainbow Frame", capsuleOnly: true },
];

function cheeseEarned(grade) {
  return CHEESE_PER_SONG + (typeof grade === "string" && grade.startsWith("S") ? CHEESE_GRADE_S_BONUS : 0);
}

function squeekDayKey(nowMs) {
  // Squeek day flips at 12:00 UTC (= 19:00 WIB), same rule as the
  // client's squeekTodayStr().
  const d = new Date(nowMs - 12 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function weekStartMs(nowMs) {
  // Week starts Monday 19:00 WIB = Monday 12:00 UTC. Most recent such
  // instant at or before nowMs.
  const wib = new Date(nowMs + 7 * 3600 * 1000);
  const daysSinceMonday = (wib.getUTCDay() + 6) % 7;
  const monday = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() - daysSinceMonday, 12, 0, 0);
  return monday <= nowMs ? monday : monday - 7 * 24 * 3600 * 1000;
}

function weekStartKey(nowMs) {
  // The Monday's date in WIB (the date players see on the board).
  return new Date(weekStartMs(nowMs) + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function capsuleRarity(r) {
  if (!(r >= 0 && r < 1)) return null;
  if (r < 0.7) return "common";
  if (r < 0.92) return "rare";
  if (r < 0.99) return "epic";
  return "legendary";
}

function capsulePool(rarity) {
  return CHEESE_CATALOG.filter((c) => c.rarity === rarity);
}

function capsulePick(rarity, idx) {
  const pool = capsulePool(rarity);
  if (!pool.length || !Number.isInteger(idx)) return null;
  return pool[((idx % pool.length) + pool.length) % pool.length];
}

function dupCompensation(rarity) {
  return CHEESE_DUP_COMP[rarity] || 0;
}

function catalogItem(id) {
  return CHEESE_CATALOG.find((c) => c.id === id) || null;
}

// --- SQK shop + golden capsule (v7, Batch 5) — pure data + helpers ---
// Frozen shop interface (same spec as SqueekPixelShop.sol). Prices are
// whole SQK; the contract works in wei (18 decimals), the client converts.
const SCORES_CONTRACT = "0x06be1517d7187ec1663c4f26d11a8f6cc217304f"; // Batch 4, live
const SHOP_CONTRACT = "0x43f568AcfaDcee4333785c9F26596719ED0B02fb"; // DEPLOYED 2026-11-08 —
//   shop deployed by the user 2026-11-08 (Sepolia, Sourcify full match,
//   matchId 58821398). /capsule-resolve + /capsule are live; the 503
//   gate below only fires if this ever becomes zero again.
const SQK_TOKEN = "0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e"; // Sepolia SQK
const SHOP_OWNER = "0x88538a82143065664232422e2dec4309038fcf9a";
const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const SQUEEK_API_SETTLEMENTS = "https://api.squeekchain.com/v1/settlements";
const SQK_SHOP_CATALOG = [
  { id: 1, name: "Skin Rare", priceSqk: 5 },
  { id: 2, name: "Efek Epic", priceSqk: 10 },
  { id: 3, name: "Bingkai Animasi", priceSqk: 15 },
  { id: 4, name: "Skin Epic", priceSqk: 20 },
  { id: 5, name: "Golden Wheel", priceSqk: 50 },
  { id: 6, name: "Skin Legendary", priceSqk: 100 },
];
const SQK_CAPSULE_PRICE = 2; // SQK per pull
const SQK_CAPSULE_ODDS = { common: 70, rare: 22, epic: 7, legendary: 1 };
const SQK_CAPSULE_DUP_COMP = { common: 25, rare: 50, epic: 100, legendary: 250 };
const SQK_CAPSULE_PITY = 20; // pityCounter >= 19 -> result at least rare
const SQK_SPLIT_OWNER = 70; // 70% owner / 30% prize pool, 0% burn
const SQK_SPLIT_POOL = 30;

function sqkShopItem(id) {
  return SQK_SHOP_CATALOG.find((c) => c.id === id) || null;
}

function sqkShopDeployed() {
  return /^0x[0-9a-fA-F]{40}$/.test(SHOP_CONTRACT) && SHOP_CONTRACT !== "0x0000000000000000000000000000000000000000";
}

// Split in milli-SQK (integers, no floats): 5 SQK -> 3500/1500,
// 2 SQK -> 1400/600. Matches the contract's 70/30 split exactly.
function sqkSplitMilli(priceSqk) {
  const milli = Math.round(priceSqk * 1000);
  return { ownerMilli: (milli * SQK_SPLIT_OWNER) / 100, poolMilli: (milli * SQK_SPLIT_POOL) / 100 };
}

// Capsule rarity from a uniform r in [0,1) + pity counter. Hard pity:
// pityCounter >= 19 forces at least rare (the contract's rule).
function sqkCapsuleRarity(r, pityCounter) {
  if (!(r >= 0 && r < 1)) return null;
  if (pityCounter >= SQK_CAPSULE_PITY - 1 && r < 0.7) return "rare";
  if (r < 0.7) return "common";
  if (r < 0.92) return "rare";
  if (r < 0.99) return "epic";
  return "legendary";
}

// --- EIP-712 (Fase 1) ---
const SIGNER_ADDRESS = "0x69f24c0598c8e6b6b938527d84141dd04ec2b3e3";
const EIP712_NAME = "Squeek Pixel ID";
const EIP712_VERSION = "1";
const EIP712_CHAIN_ID = 11155111; // Sepolia
const ATTESTATION_TTL_S = 600; // deadline = now + 10 minutes

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function cleanName(raw) {
  const s = String(raw || "").replace(/[\u0000-\u001f<>&"']/g, "").trim();
  return s.slice(0, MAX_NAME) || "GUEST";
}

function isWallet(w) {
  return typeof w === "string" && /^0x[0-9a-fA-F]{40}$/.test(w);
}

// Optional numeric field: undefined/null means "not sent" (skip the check).
// Any other non-finite value is a client error.
function optionalNumber(body, field) {
  const v = body[field];
  if (v === undefined || v === null) return { present: false, value: null };
  const n = Number(v);
  if (!Number.isFinite(n)) return { present: true, value: null, invalid: true };
  return { present: true, value: n };
}

function randomSeed() {
  // Server-issued seed: one random 32-bit unsigned integer.
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- EIP-712 helpers (minimal ABI encoding, no ethers) ---

function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function encUint256(n) {
  const b = new Uint8Array(32);
  let v = BigInt(n);
  for (let i = 31; i >= 0; i--) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return b;
}

function encAddress(addr) {
  const b = new Uint8Array(32);
  b.set(hexToBytes(addr.slice(2).toLowerCase()), 12);
  return b;
}

function encString(s) {
  return keccak_256(new TextEncoder().encode(s));
}

function encBytes32(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return hexToBytes(h);
}

const DOMAIN_TYPEHASH = keccak_256(
  new TextEncoder().encode(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
  )
);
const ATTESTATION_TYPEHASH = keccak_256(
  new TextEncoder().encode(
    "Attestation(address player,uint256 score,uint256 accuracy,string songId,string gameVersion,uint256 seed,bytes32 replayHash,uint256 nonce,uint256 deadline)"
  )
);

const DOMAIN_SEPARATOR = keccak_256(
  concatBytes(
    DOMAIN_TYPEHASH,
    encString(EIP712_NAME),
    encString(EIP712_VERSION),
    encUint256(EIP712_CHAIN_ID),
    encAddress(SIGNER_ADDRESS)
  )
);

function attestationDigest(a) {
  const structHash = keccak_256(
    concatBytes(
      ATTESTATION_TYPEHASH,
      encAddress(a.player),
      encUint256(a.score),
      encUint256(a.accuracy),
      encString(a.songId),
      encString(a.gameVersion),
      encUint256(a.seed),
      encBytes32(a.replayHash),
      encUint256(a.nonce),
      encUint256(a.deadline)
    )
  );
  return keccak_256(concatBytes(new Uint8Array([0x19, 0x01]), DOMAIN_SEPARATOR, structHash));
}

function signDigest(privHex, digest) {
  const priv = hexToBytes(privHex);
  // noble v2 sign() prehashes by default; EIP-712 needs the raw digest.
  const compact = secp256k1.sign(digest, priv, { prehash: false });
  // sign() returns only r||s, so find the recovery bit by trial against
  // the public key derived from the same private key.
  const pub = secp256k1.getPublicKey(priv, true); // compressed
  let recovery = -1;
  for (const bit of [0, 1]) {
    const rec65 = concatBytes(new Uint8Array([bit]), compact);
    const recPub = secp256k1.recoverPublicKey(rec65, digest, { prehash: false });
    if (bytesToHex(recPub) === bytesToHex(pub)) {
      recovery = bit;
      break;
    }
  }
  if (recovery < 0) throw new Error("recovery failed");
  return "0x" + bytesToHex(concatBytes(compact, new Uint8Array([27 + recovery])));
}

function signAttestation(privHex, a) {
  return signDigest(privHex, attestationDigest(a));
}

// --- Shop capsule EIP-712 (v7) — domain of SqueekPixelShop, NOT the
// score attestation domain. Same signer key (SIGNING_KEY) = the shop
// contract's dataSigner. NEVER called while SHOP_CONTRACT is the zero
// placeholder (the endpoints refuse 503 before reaching here).
const SHOP_EIP712_NAME = "Squeek Pixel Shop";
const SHOP_EIP712_VERSION = "1";
const CAPSULE_RESOLVE_TYPEHASH = keccak_256(
  new TextEncoder().encode(
    "CapsuleResolve(address player,uint256 pullId,uint256 targetRound,bytes32 dataHash,uint256 deadline)"
  )
);

function shopDomainSeparator() {
  return keccak_256(
    concatBytes(
      DOMAIN_TYPEHASH,
      encString(SHOP_EIP712_NAME),
      encString(SHOP_EIP712_VERSION),
      encUint256(EIP712_CHAIN_ID),
      encAddress(SHOP_CONTRACT)
    )
  );
}

function capsuleResolveDigest(a) {
  const structHash = keccak_256(
    concatBytes(
      CAPSULE_RESOLVE_TYPEHASH,
      encAddress(a.player),
      encUint256(a.pullId),
      encUint256(a.targetRound),
      encBytes32(a.dataHash),
      encUint256(a.deadline)
    )
  );
  return keccak_256(concatBytes(new Uint8Array([0x19, 0x01]), shopDomainSeparator(), structHash));
}

function signCapsuleResolve(privHex, a) {
  return signDigest(privHex, capsuleResolveDigest(a));
}

// Settlement lookup (v7): which /v1/settlements record settled a round?
// A round R is settled by the first recentSettlements entry with
// previousSettledThroughRound < R <= settledThroughRound. Returns the
// entry or null (not settled yet / too old for the 10-entry window).
function settlementForRound(recent, targetRound) {
  if (!Array.isArray(recent)) return null;
  for (const s of recent) {
    const prev = Number(s.previousSettledThroughRound);
    const through = Number(s.settledThroughRound);
    if (Number.isFinite(prev) && Number.isFinite(through) && prev < targetRound && targetRound <= through) {
      return s;
    }
  }
  return null;
}

function maxSettledRound(recent) {
  if (!Array.isArray(recent)) return null;
  let m = null;
  for (const s of recent) {
    const through = Number(s.settledThroughRound);
    if (Number.isFinite(through) && (m === null || through > m)) m = through;
  }
  return m;
}

// dataHash for a settled round (v7 definition — see header Fase 4):
// the settlement's transactionHash when usable, else keccak256 of the
// canonical JSON of the whole settlement record.
function dataHashForSettlement(record) {
  const tx = typeof record.transactionHash === "string" ? record.transactionHash : "";
  if (/^0x[0-9a-fA-F]{64}$/.test(tx)) return tx.toLowerCase();
  return "0x" + bytesToHex(keccak_256(new TextEncoder().encode(canonical(record))));
}

// CapsuleResolved log parsing (v7). Event (frozen interface, no indexed
// params): CapsuleResolved(address player, uint256 pullId, uint256
// targetRound, bytes32 dataHash, uint8 rarity, uint256 itemId,
// bool duplicate, uint256 kejuCompensation). topic0 =
// keccak("CapsuleResolved(address,uint256,uint256,bytes32,uint8,uint256,bool,uint256)")
// = 0xb1190a79761e5e0820f774b1613ed3b5022912a9aa445806273a260a8527a502.
// Defensive: if a future build marks `player` indexed, topics[1] holds
// it and the data words shift by one — both layouts are accepted.
const CAPSULE_RESOLVED_TOPIC0 = "0xb1190a79761e5e0820f774b1613ed3b5022912a9aa445806273a260a8527a502";

function parseCapsuleResolvedLog(log) {
  if (!log || typeof log !== "object") return null;
  const topics = Array.isArray(log.topics) ? log.topics : [];
  if (!topics.length || topics[0].toLowerCase() !== CAPSULE_RESOLVED_TOPIC0) return null;
  const data = typeof log.data === "string" ? log.data : "";
  if (!/^0x[0-9a-fA-F]*$/.test(data)) return null;
  const nWords = (data.length - 2) / 64;
  if (!Number.isInteger(nWords) || nWords < 7) return null;
  const words = [];
  for (let i = 0; i < nWords; i++) {
    words.push(data.slice(2 + i * 64, 2 + (i + 1) * 64));
  }
  const indexedPlayer = topics.length >= 2 && /^0x[0-9a-fA-F]{64}$/.test(topics[1]);
  // Indexed layout: data is [pullId, targetRound, dataHash, rarity,
  // itemId, duplicate, kejuCompensation] (7 words). Plain layout: data
  // is [player, pullId, ...] (8 words) — drop the player word.
  const w = indexedPlayer ? words : words.slice(1);
  if (w.length < 7) return null;
  const player = indexedPlayer
    ? "0x" + topics[1].slice(-40).toLowerCase()
    : "0x" + words[0].slice(-40).toLowerCase();
  return {
    player,
    pullId: Number(BigInt("0x" + w[0])),
    targetRound: Number(BigInt("0x" + w[1])),
    dataHash: "0x" + w[2].toLowerCase(),
    rarity: Number(BigInt("0x" + w[3])),
    itemId: Number(BigInt("0x" + w[4])),
    duplicate: BigInt("0x" + w[5]) !== 0n,
    kejuCompensation: Number(BigInt("0x" + w[6])),
  };
}

// --- Replay v1 helpers ---

// Canonical JSON: JSON.stringify with object keys sorted recursively.
// The client MUST hash this exact string; any key order or whitespace
// difference changes the hash.
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const keys = Object.keys(value).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") +
    "}"
  );
}

function replayHashOf(replay) {
  return "0x" + bytesToHex(sha256(new TextEncoder().encode(canonical(replay))));
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function isInt(v) {
  return typeof v === "number" && Number.isInteger(v);
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

// --- Determinism check 4a: finish.oppDistM (race) vs the poll log ---
// raceOppDist() in the game is max(0, (lastLiveSnapshot.dist -
// startDistKm) * 1000), where the snapshot is the LAST refreshLive result
// and every refreshLive is recorded as a poll. So:
//   - outside race mode, oppDistM must be null (the game writes null);
//   - race + last recorded poll failed (or no polls): the snapshot at
//     finish was not ok -> oppDistM must be 0;
//   - race + last recorded poll ok: oppDistM must lie in
//     [base - 2, base + rateMax * gap * 1000 * 1.5 + 2], where base is the
//     last ok poll's distance minus the start distance (metres) and gap is
//     finish.t minus the last poll's t (the wheel keeps moving after the
//     last poll; rateMax is the fastest rate observed in the log, floored
//     at 2 m/s so a hamster sprint in the gap still passes).
//   - startDistKm == 0 is ambiguous: the wheel may have been offline at
//     song start (G.race.offline forces oppDistM = 0 even if polls later
//     succeed), so 0 is also accepted in that case.
// oppDistM carries no score, so this is a consistency check, not a score
// gate — but a gross fabrication still fails it.
function checkOppDist(replay) {
  const h = replay.header;
  const fin = replay.events.finish;
  if (h.mode !== "race") {
    if (fin.oppDistM !== null) return "finish.oppDistM must be null outside race mode";
    return null;
  }
  const opp = fin.oppDistM;
  if (!isFiniteNumber(opp) || opp < 0) return "finish.oppDistM is not valid";
  const polls = replay.events.polls;
  const lastPoll = polls.length ? polls[polls.length - 1] : null;
  if (!lastPoll || !lastPoll.ok) {
    if (Math.abs(opp) > 0.05) return "finish.oppDistM must be 0 when the last poll failed";
    return null;
  }
  // Offline-at-start ambiguity (see header comment): 0 is acceptable
  // when the start distance is 0.
  if (h.initialDistKm === 0 && Math.abs(opp) <= 0.05) return null;
  const okPolls = polls.filter((p) => p.ok);
  const lastOk = okPolls[okPolls.length - 1];
  const base = Math.max(0, (lastOk.dist - h.initialDistKm) * 1000);
  let rateMax = 0.002; // km/s floor (2 m/s)
  for (let i = 1; i < okPolls.length; i++) {
    const dt = okPolls[i].t - okPolls[i - 1].t;
    if (dt > 0.001) {
      rateMax = Math.max(rateMax, (okPolls[i].dist - okPolls[i - 1].dist) / dt);
    }
  }
  const gap = Math.max(0, fin.t - lastPoll.t);
  const maxOpp = base + rateMax * gap * 1000 * 1.5 + 2;
  if (opp < base - 2 || opp > maxOpp) {
    return "finish.oppDistM inconsistent with poll log";
  }
  return null;
}

// Validate a v1 replay: shape + bounds + the determinism checks that do
// NOT need the chart (4a, 4c, 4d-by-construction). The chart-dependent
// checks (duration, counts, golden 4b, simulated score) run in the cron
// via verifySimulated(). Returns { ok: true } or { ok: false, error }.
// Every failure here is a 422: the replay failed verification.
function validateReplay(replay, body, mode, score, acc) {
  if (!replay || typeof replay !== "object" || Array.isArray(replay)) {
    return { ok: false, error: "replay is not valid" };
  }
  if (replay.v !== 1) return { ok: false, error: "replay version is not 1" };
  const h = replay.header;
  if (!h || typeof h !== "object") return { ok: false, error: "replay header is missing" };
  if (h.mode !== mode) return { ok: false, error: "replay header mode mismatch" };
  if (!GENRES.includes(h.genre)) return { ok: false, error: "replay header genre is not valid" };
  if (!DIFFS.includes(h.diff)) return { ok: false, error: "replay header diff is not valid" };
  if (!isNonEmptyString(h.seedKey)) return { ok: false, error: "replay header seedKey is missing" };
  // seedNum is the legacy randomize path (makeAnthem randomize=true) that
  // gameplay never uses: the chart seed MUST come from seedKey, or a
  // forged replay could pick an arbitrary chart seed.
  if (h.seedNum !== undefined) {
    return { ok: false, error: "replay header seedNum is not allowed" };
  }
  if (!isInt(h.seed) || h.seed < 0 || h.seed > 4294967295) {
    return { ok: false, error: "replay header seed is not valid" };
  }
  if (!isInt(h.lanes) || (h.lanes !== 3 && h.lanes !== 4)) {
    return { ok: false, error: "replay header lanes is not valid" };
  }
  if (typeof h.mirror !== "boolean") {
    return { ok: false, error: "replay header mirror is not valid" };
  }
  if (typeof h.practice !== "boolean") {
    return { ok: false, error: "replay header practice is not valid" };
  }
  // Enforcement: practice runs can never be submitted.
  if (h.practice) return { ok: false, error: "practice mode cannot submit" };
  if (!isInt(h.offsetMs) || h.offsetMs < -150 || h.offsetMs > 150) {
    return { ok: false, error: "replay header offsetMs out of range" };
  }
  if (!isInt(h.wallStartMs) || h.wallStartMs <= 0) {
    return { ok: false, error: "replay header wallStartMs is not valid" };
  }
  if (!isFiniteNumber(h.duration) || h.duration < 1 || h.duration > 300) {
    return { ok: false, error: "replay header duration out of range" };
  }
  if (typeof h.initialZoomies !== "boolean") {
    return { ok: false, error: "replay header initialZoomies is not valid" };
  }
  if (!isFiniteNumber(h.initialDistKm) || h.initialDistKm < 0) {
    return { ok: false, error: "replay header initialDistKm is not valid" };
  }
  const ev = replay.events;
  if (!ev || typeof ev !== "object") return { ok: false, error: "replay events are missing" };
  for (const f of ["inputs", "polls", "golden"]) {
    if (!Array.isArray(ev[f])) return { ok: false, error: `replay events.${f} is not an array` };
  }
  // (4d) ZOOMIES comes only from the poll log (rpm >= 70) — and the
  // initial snapshot, which only exists for live/race. Outside live/race
  // the game never sets zoomies, so the header must say so; simulate()
  // enforces the same rule (zoomies is always false outside live/race).
  if (h.mode !== "live" && h.mode !== "race") {
    if (h.initialZoomies !== false) {
      return { ok: false, error: "initialZoomies must be false outside live/race" };
    }
    if (h.initialDistKm !== 0) {
      return { ok: false, error: "initialDistKm must be 0 outside live/race" };
    }
    if (ev.golden.length !== 0) {
      return { ok: false, error: "golden notes only exist in race mode" };
    }
  }
  // Inputs: recorded in time order, lane inside the chart, t inside the
  // song (+2 s slack for the finish frame) — v42.4: t BOLEH NEGATIF
  // sampai -2,5: LEAD_IN 2 detik memberi song-time negatif, dan client
  // v42.4 merekamnya mentah (dulu dijepit 0 — replay 0xcafb… ditolak).
  let prevT = -Infinity;
  for (const inp of ev.inputs) {
    if (!inp || typeof inp !== "object") return { ok: false, error: "replay events.inputs entry is not valid" };
    if (!isFiniteNumber(inp.t) || inp.t < -2.5 || inp.t > h.duration + 2) {
      return { ok: false, error: "replay input t out of range" };
    }
    if (inp.t < prevT) return { ok: false, error: "replay inputs not in time order" };
    prevT = inp.t;
    if (!isInt(inp.lane) || inp.lane < 0 || inp.lane >= h.lanes) {
      return { ok: false, error: "replay input lane out of range" };
    }
  }
  // (4c) Polls: non-decreasing in t, inside the song; a failed poll
  // (ok:false) must carry null rpm/dist — a failed poll kills zoomies.
  if (ev.polls.length > MAX_POLLS) return { ok: false, error: "replay polls exceed 600" };
  prevT = -Infinity;
  for (const p of ev.polls) {
    if (!p || typeof p !== "object") return { ok: false, error: "replay events.polls entry is not valid" };
    if (!isFiniteNumber(p.t) || p.t < -2.5 || p.t > h.duration + 2) {
      return { ok: false, error: "replay poll t out of range" };
    }
    if (p.t < prevT) return { ok: false, error: "replay polls not in time order" };
    prevT = p.t;
    if (typeof p.ok !== "boolean") return { ok: false, error: "replay poll ok is not valid" };
    if (p.ok) {
      if (!isFiniteNumber(p.rpm) || p.rpm < 0) return { ok: false, error: "replay poll rpm is not valid" };
      if (!isFiniteNumber(p.dist) || p.dist < 0) return { ok: false, error: "replay poll dist is not valid" };
    } else if (p.rpm !== null || p.dist !== null) {
      return { ok: false, error: "replay failed poll must have null rpm/dist" };
    }
  }
  // Golden: at most 2, strictly increasing t, distinct indices.
  // (Index bounds + check 4b need the chart — cron.)
  if (ev.golden.length > GOLDEN_MAX) return { ok: false, error: "replay golden exceeds 2" };
  prevT = -Infinity;
  const seenGolden = new Set();
  for (const g of ev.golden) {
    if (!g || typeof g !== "object") return { ok: false, error: "replay events.golden entry is not valid" };
    if (!isFiniteNumber(g.t) || g.t < -2.5 || g.t > h.duration + 1) {
      return { ok: false, error: "replay golden t out of range" };
    }
    if (g.t <= prevT) return { ok: false, error: "replay golden not strictly increasing" };
    prevT = g.t;
    if (!isInt(g.index) || g.index < 0) {
      return { ok: false, error: "replay golden index is not valid" };
    }
    if (seenGolden.has(g.index)) return { ok: false, error: "replay golden index repeats" };
    seenGolden.add(g.index);
  }
  // finish: present (the game only submits after finish()), t just past
  // the song end (finish triggers at st > duration + 0.8).
  const fin = ev.finish;
  if (!fin || typeof fin !== "object") return { ok: false, error: "replay finish is missing" };
  if (!isFiniteNumber(fin.t) || fin.t < h.duration + 0.5 || fin.t > h.duration + 2) {
    return { ok: false, error: "replay finish t out of range" };
  }
  if (!(fin.oppDistM === null || isFiniteNumber(fin.oppDistM))) {
    return { ok: false, error: "replay finish oppDistM is not valid" };
  }
  // (4a) finish.oppDistM vs the poll log.
  const oppErr = checkOppDist(replay);
  if (oppErr) return { ok: false, error: oppErr };
  const claim = replay.claim;
  if (!claim || typeof claim !== "object") return { ok: false, error: "replay claim is missing" };
  if (!isInt(claim.score) || claim.score !== score) {
    return { ok: false, error: "replay claim score mismatch" };
  }
  if (typeof claim.acc !== "number" || Math.abs(claim.acc - acc) > 0.5) {
    return { ok: false, error: "replay claim acc mismatch" };
  }
  if (!isInt(claim.maxCombo) || claim.maxCombo < 0) {
    return { ok: false, error: "replay claim maxCombo is not valid" };
  }
  const counts = claim.counts;
  if (!counts || typeof counts !== "object") {
    return { ok: false, error: "replay claim counts are missing" };
  }
  let totalNotes = 0;
  for (const v of Object.values(counts)) {
    if (!isInt(v) || v < 0) return { ok: false, error: "replay claim counts are not valid" };
    totalNotes += v;
  }
  if (claim.maxCombo > totalNotes) {
    return { ok: false, error: "replay claim maxCombo exceeds notes" };
  }
  // Note count for the inputs cap: body.notes when sent, else the sum of
  // the claim counts.
  const notes = body.notes !== undefined && body.notes !== null ? Number(body.notes) : totalNotes;
  if (Number.isFinite(notes) && ev.inputs.length > notes + MAX_EXTRA_TAPS) {
    return { ok: false, error: "replay inputs exceed notes + 50" };
  }
  return { ok: true };
}

// --- Chart-dependent verification (cron) ---
//
// verifySimulated(replay, chart, sim) compares the engine's re-simulation
// against the claim. Pure function (no I/O) so it is unit-testable.
//   chart: buildChart(header) — the full anthem object ({ duration,
//     chart: [{t, lane, midi}, ...] sorted by t, ... }); a raw notes array
//     is also accepted.
//   sim: simulate(chart, replay) — { score, acc, maxCombo,
//     counts: {perfect, great, good, miss}, grade, playerDistM, oppDistM,
//     win, goldenHits, goldenChecks: [{t, index, expected, ok}],
//     oppDistMDerived, oppDistMMatch }.
// Checks, in order: chart duration matches the header; claim counts sum
// to the chart length; every golden event passes check 4b — the engine
// itself recomputes, for each recorded golden pick, whether the note at
// `index` was the first unjudged note with n.t > t at that moment
// (goldenChecks[].ok); simulated score / maxCombo / counts match EXACTLY;
// simulated acc matches within ACC_TOL (the claim is rounded to 2
// decimals by the client, so 0.005 of the tolerance is rounding).
// NOTE: sim.oppDistMMatch is deliberately NOT a rejection gate here —
// the engine documents that it is false for races that started while the
// wheel was offline (recorded oppDistM 0 is correct there, the derived
// value differs). Check 4a (checkOppDist, synchronous) already covers
// oppDistM with the offline-start exception.
function verifySimulated(replay, chart, sim) {
  const notes = Array.isArray(chart) ? chart : chart && chart.chart;
  if (!chart || typeof chart.duration !== "number" || !Array.isArray(notes)) {
    return { ok: false, reason: "engine returned an incomplete chart" };
  }
  if (Math.abs(chart.duration - replay.header.duration) > CHART_DURATION_TOL) {
    return { ok: false, reason: "chart duration mismatch" };
  }
  if (
    !sim ||
    typeof sim.score !== "number" ||
    typeof sim.maxCombo !== "number" ||
    typeof sim.acc !== "number" ||
    !sim.counts ||
    !Array.isArray(sim.goldenChecks)
  ) {
    return { ok: false, reason: "simulate result incomplete" };
  }
  const counts = replay.claim.counts;
  const total = counts.perfect + counts.great + counts.good + counts.miss;
  if (total !== notes.length) {
    return { ok: false, reason: "claim counts do not match chart" };
  }
  // (4b) Golden-note consistency, recomputed by the engine from chart +
  // inputs (see engine.js rule 5): each recorded pick must be the first
  // unjudged note with n.t > t at the pick time.
  if (sim.goldenChecks.length !== replay.events.golden.length) {
    return { ok: false, reason: "golden checks do not match golden events" };
  }
  for (const c of sim.goldenChecks) {
    if (!c.ok) {
      return { ok: false, reason: "golden note inconsistent with chart and inputs" };
    }
  }
  if (sim.score !== replay.claim.score) {
    return { ok: false, reason: "simulated score mismatch" };
  }
  if (sim.maxCombo !== replay.claim.maxCombo) {
    return { ok: false, reason: "simulated maxCombo mismatch" };
  }
  for (const k of ["perfect", "great", "good", "miss"]) {
    if (sim.counts[k] !== counts[k]) {
      return { ok: false, reason: "simulated counts mismatch" };
    }
  }
  if (Math.abs(sim.acc - replay.claim.acc) > ACC_TOL + 1e-9) {
    return { ok: false, reason: "simulated accuracy mismatch" };
  }
  return { ok: true };
}

// Mark one queue row + its replays row rejected, with the reason.
async function markRejected(env, replayHash, reason, now) {
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE verify_queue SET status = 'rejected', reason = ?, updated_at = ? WHERE replay_hash = ?"
    ).bind(reason, now, replayHash),
    env.DB.prepare(
      "UPDATE replays SET verification_status = 'rejected' WHERE replay_hash = ?"
    ).bind(replayHash),
  ]);
}

// Verify ONE queued replay: build the chart, simulate, compare, and on a
// pass sign the attestation and upsert the score. Returns
// { ok: true } on pass, { ok: false, reason } on a deterministic failure
// (rejected), and THROWS on transient errors (engine/D1 failure) so the
// caller can leave the row pending for a retry.
async function verifyOne(env, row, now) {
  const replay = JSON.parse(row.replay);
  const chart = buildChart(replay.header);
  const sim = simulate(chart, replay);
  const v = verifySimulated(replay, chart, sim);
  if (!v.ok) {
    await markRejected(env, row.replay_hash, v.reason, now);
    return { ok: false, reason: v.reason };
  }
  const privHex = env.SIGNING_KEY;
  if (typeof privHex !== "string" || !/^[0-9a-fA-F]{64}$/.test(privHex)) {
    throw new Error("signing unavailable");
  }
  const wallet = row.wallet;
  const mode = row.mode;
  const score = row.score;
  const acc = row.acc;
  const songId =
    replay.header.mode +
    "|" +
    replay.header.genre +
    "|" +
    replay.header.diff +
    "|" +
    replay.header.seedKey;
  const prevNonce = await env.DB.prepare(
    "SELECT nonce FROM nonces WHERE wallet = ?"
  )
    .bind(wallet)
    .first();
  const nonce = (prevNonce ? prevNonce.nonce : 0) + 1;
  const deadline = Math.floor(now / 1000) + ATTESTATION_TTL_S;
  const signature = signAttestation(privHex, {
    player: wallet,
    score,
    accuracy: Math.round(acc * 100),
    songId,
    gameVersion: row.game_version,
    seed: replay.header.seed,
    replayHash: row.replay_hash,
    nonce,
    deadline,
  });
  // --- v5: Cheese credit + weekly league (same atomic batch). Cheese is
  // credited ONLY here (verified replay), never on raw submit: a song
  // earns 100 + 500 for grade S/SS + 50 for the daily mission (first
  // verified song of the Squeek day). The ledger's UNIQUE replay_hash
  // makes the song credit idempotent; the daily row is unique per
  // (wallet, day). The cron processes rows strictly sequentially and
  // claims each row first (pending -> processing), so the hadDaily check
  // below cannot race with another verification of the same wallet.
  // League: best FREE score of the current week (Monday 19:00 WIB).
  const earn = cheeseEarned(sim.grade);
  const dayKey = squeekDayKey(now);
  const hadDaily = await env.DB.prepare(
    "SELECT 1 AS x FROM cheese_ledger WHERE wallet = ? AND kind = 'daily' AND day_key = ?"
  ).bind(wallet, dayKey).first();
  const dailyBonus = hadDaily ? 0 : CHEESE_DAILY_BONUS;
  const totalEarn = earn + dailyBonus;
  const stmts = [
    env.DB.prepare(
      "UPDATE verify_queue SET status = 'verified', signature = ?, nonce = ?, deadline = ?, updated_at = ? WHERE replay_hash = ?"
    ).bind(signature, nonce, deadline, now, row.replay_hash),
    env.DB.prepare(
      "UPDATE replays SET verification_status = 'verified', signature = ? WHERE replay_hash = ?"
    ).bind(signature, row.replay_hash),
    env.DB.prepare(
      "INSERT INTO nonces (wallet, nonce) VALUES (?, ?) ON CONFLICT(wallet) DO UPDATE SET nonce = excluded.nonce"
    ).bind(wallet, nonce),
    env.DB.prepare(
      "INSERT INTO scores (wallet, mode, name, score, acc, verified, updated_at, signature, replay_hash) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?) " +
        "ON CONFLICT(wallet, mode) DO UPDATE SET name = excluded.name, score = excluded.score, acc = excluded.acc, verified = excluded.verified, updated_at = excluded.updated_at, signature = excluded.signature, replay_hash = excluded.replay_hash " +
        "WHERE excluded.score > scores.score"
    ).bind(wallet, mode, row.name, score, acc, now, signature, row.replay_hash),
    env.DB.prepare(
      "INSERT INTO cheese_balances (wallet, balance, updated_at) VALUES (?, ?, ?) ON CONFLICT(wallet) DO UPDATE SET balance = cheese_balances.balance + excluded.balance, updated_at = excluded.updated_at"
    ).bind(wallet, totalEarn, now),
    env.DB.prepare(
      "INSERT OR IGNORE INTO cheese_ledger (wallet, replay_hash, kind, amount, day_key, created_at) VALUES (?, ?, 'song', ?, ?, ?)"
    ).bind(wallet, row.replay_hash, earn, dayKey, now),
  ];
  if (dailyBonus > 0) {
    stmts.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO cheese_ledger (wallet, replay_hash, kind, amount, day_key, created_at) VALUES (?, NULL, 'daily', ?, ?, ?)"
      ).bind(wallet, dailyBonus, dayKey, now)
    );
  }
  if (mode === "free") {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO league_scores (wallet, week_start, name, best_score, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(wallet, week_start) DO UPDATE SET name = excluded.name, best_score = MAX(league_scores.best_score, excluded.best_score), updated_at = excluded.updated_at"
      ).bind(wallet, weekStartKey(now), row.name, score, now)
    );
  }
  await env.DB.batch(stmts);
  return { ok: true, signature, nonce, deadline };
}

// Cron Trigger handler: verify pending replays, a few per run.
// Rows are claimed (pending -> processing) so two overlapping invocations
// never verify the same replay twice; a row stuck in 'processing' longer
// than VERIFY_STALE_MS is presumed orphaned and reset to pending.
async function processVerifyQueue(env) {
  const now = Date.now();
  await env.DB.prepare(
    "UPDATE verify_queue SET status = 'pending', updated_at = ? WHERE status = 'processing' AND updated_at < ?"
  )
    .bind(now, now - VERIFY_STALE_MS)
    .run();
  const { results } = await env.DB.prepare(
    "SELECT * FROM verify_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?"
  )
    .bind(VERIFY_BATCH)
    .all();
  let verified = 0;
  let rejected = 0;
  for (const row of results) {
    const claimed = await env.DB.prepare(
      "UPDATE verify_queue SET status = 'processing', updated_at = ? WHERE replay_hash = ? AND status = 'pending'"
    )
      .bind(now, row.replay_hash)
      .run();
    if ((claimed.meta.changes || 0) === 0) continue; // claimed by another run
    try {
      const out = await verifyOne(env, row, Date.now());
      if (out.ok) verified++;
      else rejected++;
    } catch (e) {
      // Transient (engine threw, D1 hiccup, CPU pressure): bump attempts
      // and leave the row to be retried; after VERIFY_MAX_ATTEMPTS it is
      // rejected as a verification error rather than stuck forever.
      const attempts = (row.attempts || 0) + 1;
      if (attempts >= VERIFY_MAX_ATTEMPTS) {
        await markRejected(env, row.replay_hash, "verification error", Date.now());
        rejected++;
      } else {
        await env.DB.prepare(
          "UPDATE verify_queue SET status = 'pending', attempts = ?, updated_at = ? WHERE replay_hash = ?"
        )
          .bind(attempts, Date.now(), row.replay_hash)
          .run();
      }
    }
  }
  return { verified, rejected, examined: results.length };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (url.pathname === "/" && request.method === "GET") {
        return json({ service: "squeekchain-leaderboard", version: 9 });
      }

      // --- v5: Cheese shop (GET /cheese, POST /cheese/buy|pull|equip) ---
      if (url.pathname === "/cheese" && request.method === "GET") {
        const wallet = (url.searchParams.get("wallet") || "").toLowerCase();
        const catalog = CHEESE_CATALOG.map((c) => ({ ...c }));
        if (!isWallet(wallet)) {
          return json({ wallet: null, balance: 0, items: [], catalog });
        }
        const bal = await env.DB.prepare(
          "SELECT balance FROM cheese_balances WHERE wallet = ?"
        ).bind(wallet).first();
        const { results } = await env.DB.prepare(
          "SELECT item_id, equipped FROM cheese_inventory WHERE wallet = ?"
        ).bind(wallet).all();
        const items = results.map((r) => ({
          ...(catalogItem(r.item_id) || { id: r.item_id, slot: "unknown", rarity: "common", price: 0, name: r.item_id }),
          equipped: r.equipped === 1,
        }));
        return json({ wallet, balance: bal ? bal.balance : 0, items, catalog });
      }

      if (url.pathname === "/cheese/buy" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !isWallet(body.wallet)) {
          return json({ error: "wallet address is not valid" }, 400);
        }
        const wallet = body.wallet.toLowerCase();
        const item = catalogItem(body.item_id);
        if (!item) return json({ error: "item not found" }, 400);
        if (item.capsuleOnly || !(item.price > 0)) {
          return json({ error: "capsule only" }, 400);
        }
        const now = Date.now();
        const owned = await env.DB.prepare(
          "SELECT 1 AS x FROM cheese_inventory WHERE wallet = ? AND item_id = ?"
        ).bind(wallet, item.id).first();
        if (owned) return json({ error: "already owned" }, 400);
        // Atomic deduct: the UPDATE only lands when the balance covers
        // the price, so two concurrent buys cannot both spend it.
        const paid = await env.DB.prepare(
          "UPDATE cheese_balances SET balance = balance - ?, updated_at = ? WHERE wallet = ? AND balance >= ?"
        ).bind(item.price, now, wallet, item.price).run();
        if ((paid.meta.changes || 0) === 0) {
          return json({ error: "not enough cheese" }, 402);
        }
        const ins = await env.DB.prepare(
          "INSERT OR IGNORE INTO cheese_inventory (wallet, item_id, equipped, acquired_at) VALUES (?, ?, 0, ?)"
        ).bind(wallet, item.id, now).run();
        if ((ins.meta.changes || 0) === 0) {
          // Lost a race with a concurrent buy: refund.
          await env.DB.prepare(
            "UPDATE cheese_balances SET balance = balance + ?, updated_at = ? WHERE wallet = ?"
          ).bind(item.price, now, wallet).run();
          return json({ error: "already owned" }, 400);
        }
        await env.DB.prepare(
          "INSERT INTO cheese_ledger (wallet, replay_hash, kind, amount, day_key, created_at) VALUES (?, NULL, 'buy', ?, ?, ?)"
        ).bind(wallet, -item.price, squeekDayKey(now), now).run();
        const bal = await env.DB.prepare(
          "SELECT balance FROM cheese_balances WHERE wallet = ?"
        ).bind(wallet).first();
        return json({ ok: true, item: item.id, balance: bal ? bal.balance : 0 });
      }

      if (url.pathname === "/cheese/pull" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !isWallet(body.wallet)) {
          return json({ error: "wallet address is not valid" }, 400);
        }
        const wallet = body.wallet.toLowerCase();
        const now = Date.now();
        const paid = await env.DB.prepare(
          "UPDATE cheese_balances SET balance = balance - ?, updated_at = ? WHERE wallet = ? AND balance >= ?"
        ).bind(CHEESE_PULL_PRICE, now, wallet, CHEESE_PULL_PRICE).run();
        if ((paid.meta.changes || 0) === 0) {
          return json({ error: "not enough cheese" }, 402);
        }
        // Server-side RNG: the client never picks the prize.
        const r = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
        const rarity = capsuleRarity(r);
        const pool = capsulePool(rarity);
        const idx = crypto.getRandomValues(new Uint32Array(1))[0] % pool.length;
        const item = pool[idx];
        const ins = await env.DB.prepare(
          "INSERT OR IGNORE INTO cheese_inventory (wallet, item_id, equipped, acquired_at) VALUES (?, ?, 0, ?)"
        ).bind(wallet, item.id, now).run();
        let duplicate = false;
        let compensation = 0;
        if ((ins.meta.changes || 0) === 0) {
          duplicate = true;
          compensation = dupCompensation(rarity);
          await env.DB.prepare(
            "UPDATE cheese_balances SET balance = balance + ?, updated_at = ? WHERE wallet = ?"
          ).bind(compensation, now, wallet).run();
        }
        await env.DB.prepare(
          "INSERT INTO cheese_ledger (wallet, replay_hash, kind, amount, day_key, created_at) VALUES (?, NULL, 'pull', ?, ?, ?)"
        ).bind(wallet, -CHEESE_PULL_PRICE, squeekDayKey(now), now).run();
        if (duplicate) {
          await env.DB.prepare(
            "INSERT INTO cheese_ledger (wallet, replay_hash, kind, amount, day_key, created_at) VALUES (?, NULL, 'duplicate', ?, ?, ?)"
          ).bind(wallet, compensation, squeekDayKey(now), now).run();
        }
        const bal = await env.DB.prepare(
          "SELECT balance FROM cheese_balances WHERE wallet = ?"
        ).bind(wallet).first();
        return json({
          ok: true,
          item: { ...item },
          duplicate,
          compensation,
          balance: bal ? bal.balance : 0,
        });
      }

      if (url.pathname === "/cheese/equip" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !isWallet(body.wallet)) {
          return json({ error: "wallet address is not valid" }, 400);
        }
        const wallet = body.wallet.toLowerCase();
        const item = catalogItem(body.item_id);
        if (!item) return json({ error: "item not found" }, 400);
        const owned = await env.DB.prepare(
          "SELECT 1 AS x FROM cheese_inventory WHERE wallet = ? AND item_id = ?"
        ).bind(wallet, item.id).first();
        if (!owned) return json({ error: "not owned" }, 400);
        const slotIds = CHEESE_CATALOG.filter((c) => c.slot === item.slot).map((c) => c.id);
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE cheese_inventory SET equipped = 0 WHERE wallet = ? AND item_id IN (" +
              slotIds.map(() => "?").join(",") +
              ")"
          ).bind(wallet, ...slotIds),
          env.DB.prepare(
            "UPDATE cheese_inventory SET equipped = 1 WHERE wallet = ? AND item_id = ?"
          ).bind(wallet, item.id),
        ]);
        return json({ ok: true, equipped: item.id, slot: item.slot });
      }

      // --- v7: SQK shop capsule — resolve signature + duplicate credit ---
      // POST /capsule-resolve {wallet, pullId, targetRound}: sign the
      // CapsuleResolve struct for a round that has ALREADY settled.
      // Refuses 503 while SHOP_CONTRACT is the zero placeholder.
      if (url.pathname === "/capsule-resolve" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !isWallet(body.wallet)) {
          return json({ error: "wallet address is not valid" }, 400);
        }
        if (!sqkShopDeployed()) {
          return json({ error: "shop not deployed" }, 503);
        }
        const wallet = body.wallet.toLowerCase();
        const pullId = Number(body.pullId);
        const targetRound = Number(body.targetRound);
        if (!Number.isInteger(pullId) || pullId < 1) {
          return json({ error: "pullId is not valid" }, 400);
        }
        if (!Number.isInteger(targetRound) || targetRound < 0) {
          return json({ error: "targetRound is not valid" }, 400);
        }
        // Rate limit 10/wallet/hour, same submit_log pattern as /scores.
        const now = Date.now();
        await env.DB.prepare("DELETE FROM submit_log WHERE ts < ?")
          .bind(now - RATE_WINDOW_MS)
          .run();
        const walletCount = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM submit_log WHERE wallet = ? AND ts >= ?"
        )
          .bind(wallet, now - RATE_WINDOW_MS)
          .first();
        await env.DB.prepare(
          "INSERT INTO submit_log (wallet, ip, ts) VALUES (?, ?, ?)"
        )
          .bind(wallet, request.headers.get("CF-Connecting-IP") || "unknown", now)
          .run();
        if ((walletCount.n || 0) >= RATE_MAX_WALLET) {
          return json({ error: "rate_limited" }, 429);
        }
        // Is targetRound settled? The public API takes NO query params.
        let recent = null;
        try {
          const res = await fetch(SQUEEK_API_SETTLEMENTS, {
            headers: { "User-Agent": "squeekchain-leaderboard/7" },
          });
          if (!res.ok) throw new Error("settlements HTTP_" + res.status);
          const data = await res.json();
          recent = data.recentSettlements || null;
        } catch (e) {
          return json({ error: "settlement api unavailable", detail: String(e && e.message ? e.message : e).slice(0, 80) }, 502);
        }
        const record = settlementForRound(recent, targetRound);
        if (!record) {
          const settled = maxSettledRound(recent);
          return json(
            {
              error: "round not settled yet",
              targetRound,
              settledThroughRound: settled,
              detail:
                settled === null
                  ? "could not read the settled frontier"
                  : targetRound > settled
                    ? "target round is still open — wait for it to settle, then resolve again"
                    : "target round is older than the API's recent-settlements window — it can no longer be resolved from this endpoint",
            },
            409
          );
        }
        const dataHash = dataHashForSettlement(record);
        const deadline = Math.floor(now / 1000) + 600;
        const signature = signCapsuleResolve(env.SIGNING_KEY, {
          player: wallet,
          pullId,
          targetRound,
          dataHash,
          deadline,
        });
        return json({ pullId, targetRound, dataHash, deadline, signature });
      }

      // POST /capsule {wallet, txHash}: credit the duplicate-capsule
      // Keju compensation from a verified CapsuleResolved receipt.
      // Idempotent per txHash (cheese_ledger UNIQUE replay_hash).
      // Refuses 503 while SHOP_CONTRACT is the zero placeholder.
      if (url.pathname === "/capsule" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !isWallet(body.wallet)) {
          return json({ error: "wallet address is not valid" }, 400);
        }
        if (!sqkShopDeployed()) {
          return json({ error: "shop not deployed" }, 503);
        }
        const wallet = body.wallet.toLowerCase();
        const txHash = typeof body.txHash === "string" ? body.txHash.toLowerCase() : "";
        if (!/^0x[0-9a-f]{64}$/.test(txHash)) {
          return json({ error: "txHash is not valid" }, 400);
        }
        // Already credited? The UNIQUE index makes the INSERT below
        // idempotent, but answer early with a clear flag.
        const prior = await env.DB.prepare(
          "SELECT amount FROM cheese_ledger WHERE replay_hash = ? AND kind = 'capsule-duplicate'"
        )
          .bind(txHash)
          .first();
        if (prior) {
          const bal = await env.DB.prepare(
            "SELECT balance FROM cheese_balances WHERE wallet = ?"
          )
            .bind(wallet)
            .first();
          return json({ ok: true, alreadyCredited: true, compensation: prior.amount, balance: bal ? bal.balance : 0 });
        }
        // Fetch the receipt from the public Sepolia RPC (retry 3x —
        // the endpoint drops connections occasionally).
        let receipt = null;
        let lastErr = "";
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(SEPOLIA_RPC, {
              method: "POST",
              headers: { "Content-Type": "application/json", "User-Agent": "squeekchain-leaderboard/7" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_getTransactionReceipt",
                params: [txHash],
              }),
            });
            if (!res.ok) throw new Error("rpc HTTP_" + res.status);
            const data = await res.json();
            receipt = data.result || null;
            break;
          } catch (e) {
            lastErr = String(e && e.message ? e.message : e).slice(0, 80);
            if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
          }
        }
        if (!receipt) {
          return json({ error: "receipt not found", detail: lastErr || "no receipt for this txHash (yet?)" }, 400);
        }
        if (String(receipt.status) !== "0x1") {
          return json({ error: "transaction failed on-chain" }, 400);
        }
        if (String(receipt.from || "").toLowerCase() !== wallet) {
          return json({ error: "transaction is not from this wallet" }, 400);
        }
        if (String(receipt.to || "").toLowerCase() !== SHOP_CONTRACT.toLowerCase()) {
          return json({ error: "transaction is not to the shop contract" }, 400);
        }
        const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
        let resolved = null;
        for (const log of logs) {
          const parsed = parseCapsuleResolvedLog(log);
          if (parsed && parsed.player === wallet) {
            resolved = parsed;
            break;
          }
        }
        if (!resolved) {
          return json({ error: "no CapsuleResolved event for this wallet in the receipt" }, 400);
        }
        if (!resolved.duplicate || !(resolved.kejuCompensation > 0)) {
          return json({ error: "capsule was not a duplicate — no Keju compensation", rarity: resolved.rarity, itemId: resolved.itemId }, 400);
        }
        const now = Date.now();
        const comp = resolved.kejuCompensation;
        // Idempotent credit: INSERT OR IGNORE on the UNIQUE replay_hash
        // index — a concurrent duplicate request credits only once.
        const ins = await env.DB.prepare(
          "INSERT OR IGNORE INTO cheese_ledger (wallet, replay_hash, kind, amount, day_key, created_at) VALUES (?, ?, 'capsule-duplicate', ?, ?, ?)"
        )
          .bind(wallet, txHash, comp, squeekDayKey(now), now)
          .run();
        if ((ins.meta.changes || 0) === 0) {
          const bal = await env.DB.prepare(
            "SELECT balance FROM cheese_balances WHERE wallet = ?"
          )
            .bind(wallet)
            .first();
          return json({ ok: true, alreadyCredited: true, compensation: comp, balance: bal ? bal.balance : 0 });
        }
        await env.DB.prepare(
          "INSERT INTO cheese_balances (wallet, balance, updated_at) VALUES (?, ?, ?) ON CONFLICT(wallet) DO UPDATE SET balance = cheese_balances.balance + excluded.balance, updated_at = excluded.updated_at"
        )
          .bind(wallet, comp, now)
          .run();
        const bal = await env.DB.prepare(
          "SELECT balance FROM cheese_balances WHERE wallet = ?"
        )
          .bind(wallet)
          .first();
        return json({ ok: true, alreadyCredited: false, compensation: comp, balance: bal ? bal.balance : 0, pullId: resolved.pullId, rarity: resolved.rarity, itemId: resolved.itemId });
      }

      // --- v5: Weekly league (GET /league) ---
      if (url.pathname === "/league" && request.method === "GET") {
        const weekParam = url.searchParams.get("week") || "";
        let weekMs = Date.now();
        if (/^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
          const parsed = Date.parse(weekParam + "T12:00:00Z");
          if (Number.isFinite(parsed)) weekMs = parsed;
        }
        const weekStart = weekStartKey(weekMs);
        // v41.1: verified comes from the scores table (league rows only
        // ever come from verifyOne, so this is 1 for every real row;
        // the LEFT JOIN only guards the display if the scores row
        // ever disagrees). No verification logic touched.
        const { results } = await env.DB.prepare(
          "SELECT l.wallet, l.name, l.best_score, COALESCE(s.verified, 0) AS verified FROM league_scores l LEFT JOIN scores s ON s.wallet = l.wallet AND s.mode = 'free' WHERE l.week_start = ? ORDER BY l.best_score DESC, l.updated_at ASC LIMIT 30"
        ).bind(weekStart).all();
        const wallet = (url.searchParams.get("wallet") || "").toLowerCase();
        let you = null;
        if (isWallet(wallet)) {
          const me = await env.DB.prepare(
            "SELECT l.best_score, COALESCE(s.verified, 0) AS verified FROM league_scores l LEFT JOIN scores s ON s.wallet = l.wallet AND s.mode = 'free' WHERE l.wallet = ? AND l.week_start = ?"
          ).bind(wallet, weekStart).first();
          if (me) {
            const better = await env.DB.prepare(
              "SELECT COUNT(*) AS n FROM league_scores WHERE week_start = ? AND best_score > ?"
            ).bind(weekStart, me.best_score).first();
            you = { rank: (better.n || 0) + 1, best_score: me.best_score, verified: me.verified ? 1 : 0 };
          }
        }
        return json({
          week_start: weekStart,
          reset_at: weekStartMs(weekMs) + 7 * 24 * 3600 * 1000,
          count: results.length,
          scores: results.map((r, i) => ({
            rank: i + 1,
            wallet: r.wallet,
            name: r.name,
            best_score: r.best_score,
            verified: r.verified ? 1 : 0,
          })),
          you,
        });
      }

      if (url.pathname === "/scores" && request.method === "GET") {
        const mode = MODES.includes(url.searchParams.get("mode"))
          ? url.searchParams.get("mode")
          : "free";
        const limit = Math.min(
          50,
          Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20)
        );
        const { results } = await env.DB.prepare(
          "SELECT wallet, name, score, acc, verified, updated_at FROM scores WHERE mode = ? ORDER BY score DESC, updated_at ASC LIMIT ?"
        )
          .bind(mode, limit)
          .all();
        return json({
          mode,
          count: results.length,
          scores: results.map((r, i) => ({ rank: i + 1, ...r })),
        });
      }

      if (url.pathname === "/session" && request.method === "POST") {
        const sessionId = crypto.randomUUID();
        const seed = randomSeed();
        const nonce = randomNonce();
        const expiresAt = Date.now() + SESSION_TTL_MS;
        // Lazy prune: drop expired sessions before inserting the new one,
        // so unused expired rows don't accumulate in D1.
        await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?")
          .bind(Date.now())
          .run();
        await env.DB.prepare(
          "INSERT INTO sessions (session_id, seed, nonce, expires_at, used) VALUES (?, ?, ?, ?, 0)"
        )
          .bind(sessionId, seed, nonce, expiresAt)
          .run();
        return json({ sessionId, seed, nonce, expiresAt });
      }

      if (url.pathname === "/verify" && request.method === "GET") {
        const hash = (url.searchParams.get("replayHash") || "").toLowerCase();
        if (!/^0x[0-9a-f]{64}$/.test(hash)) {
          return json({ error: "replayHash is not valid" }, 400);
        }
        const q = await env.DB.prepare(
          "SELECT wallet, mode, score, status, reason, signature, nonce, deadline FROM verify_queue WHERE replay_hash = ?"
        )
          .bind(hash)
          .first();
        if (q) {
          if (q.status === "verified") {
            return json({
              verification_status: "verified",
              signature: q.signature,
              nonce: q.nonce,
              deadline: q.deadline,
              replayHash: hash,
              wallet: q.wallet,
              mode: q.mode,
              score: q.score,
            });
          }
          if (q.status === "rejected") {
            return json(
              { verification_status: "rejected", reason: q.reason, replayHash: hash },
              422
            );
          }
          return json({ verification_status: q.status, replayHash: hash }, 202);
        }
        // Legacy v3 rows live in replays without a queue row.
        const r = await env.DB.prepare(
          "SELECT wallet, mode, signature, verification_status FROM replays WHERE replay_hash = ?"
        )
          .bind(hash)
          .first();
        if (r && r.verification_status === "verified") {
          return json({
            verification_status: "verified",
            signature: r.signature,
            replayHash: hash,
            wallet: r.wallet,
            mode: r.mode,
          });
        }
        if (r) {
          return json(
            { verification_status: r.verification_status || "unverified", replayHash: hash },
            202
          );
        }
        return json({ error: "replay not found" }, 404);
      }

      if (url.pathname === "/scores" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !isWallet(body.wallet)) {
          return json({ error: "wallet address is not valid" }, 400);
        }
        const wallet = body.wallet.toLowerCase();
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const now = Date.now();

        // --- Rate limit, BEFORE plausibility. Every attempt is logged,
        // including ones that fail later checks. Old rows (>1h) are pruned.
        await env.DB.prepare("DELETE FROM submit_log WHERE ts < ?")
          .bind(now - RATE_WINDOW_MS)
          .run();
        const walletCount = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM submit_log WHERE wallet = ? AND ts >= ?"
        )
          .bind(wallet, now - RATE_WINDOW_MS)
          .first();
        const ipCount = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM submit_log WHERE ip = ? AND ts >= ?"
        )
          .bind(ip, now - RATE_WINDOW_MS)
          .first();
        await env.DB.prepare(
          "INSERT INTO submit_log (wallet, ip, ts) VALUES (?, ?, ?)"
        )
          .bind(wallet, ip, now)
          .run();
        if ((walletCount.n || 0) >= RATE_MAX_WALLET || (ipCount.n || 0) >= RATE_MAX_IP) {
          return json({ error: "rate_limited" }, 429);
        }

        // --- Basic score validation (unchanged from v1).
        const mode = MODES.includes(body.mode) ? body.mode : "free";
        const score = Math.floor(Number(body.score));
        if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) {
          return json({ error: "score is not valid" }, 400);
        }
        const accRaw = body.acc === undefined || body.acc === null ? 0 : Number(body.acc);
        if (!Number.isFinite(accRaw) || accRaw < 0 || accRaw > 100) {
          return json({ error: "acc is not valid" }, 400);
        }
        const acc = accRaw;
        const name = cleanName(body.name);

        // --- Plausibility (only the fields the client sent are checked).
        const notes = optionalNumber(body, "notes");
        const taps = optionalNumber(body, "taps");
        const durationMs = optionalNumber(body, "durationMs");
        if (notes.invalid) return json({ error: "notes is not valid" }, 400);
        if (taps.invalid) return json({ error: "taps is not valid" }, 400);
        if (durationMs.invalid) return json({ error: "durationMs is not valid" }, 400);
        if (notes.present && taps.present && taps.value > notes.value + MAX_EXTRA_TAPS) {
          return json({ error: "taps exceed notes + 50" }, 400);
        }
        if (notes.present && score > notes.value * MAX_SCORE_PER_NOTE + SCORE_SLACK) {
          return json({ error: "score exceeds notes * 1800 + 1000" }, 400);
        }
        if (
          durationMs.present &&
          (durationMs.value < MIN_DURATION_MS || durationMs.value > MAX_DURATION_MS)
        ) {
          return json({ error: "durationMs out of range (30000-300000)" }, 400);
        }

        // --- ENFORCEMENT (v4): a score without a valid replay is rejected
        // 422. There is no longer an unverified submit path.
        const hasReplay = body.replay !== undefined && body.replay !== null;
        if (!hasReplay) {
          return json({ error: "replay required" }, 422);
        }
        let replay = null;
        if (typeof body.replay === "string") {
          if (body.replay.length > MAX_REPLAY_BYTES) {
            return json({ error: "replay too large" }, 422);
          }
          try {
            replay = JSON.parse(body.replay);
          } catch {
            return json({ error: "replay is not valid JSON" }, 422);
          }
        } else {
          replay = body.replay;
          if (JSON.stringify(replay).length > MAX_REPLAY_BYTES) {
            return json({ error: "replay too large" }, 422);
          }
        }
        // Synchronous replay checks (shape/bounds + determinism checks
        // 4a/4c/4d that need no chart). The chart-dependent checks run in
        // the cron. A bad replay never burns a session: the session is
        // only consumed after every check below passes.
        const v = validateReplay(replay, body, mode, score, acc);
        if (!v.ok) return json({ error: v.error }, 422);
        const serverHash = replayHashOf(replay);
        if (body.replayHash !== undefined && body.replayHash !== null) {
          const claimed = String(body.replayHash).toLowerCase();
          if (!/^0x[0-9a-f]{64}$/.test(claimed) && !/^[0-9a-f]{64}$/.test(claimed)) {
            return json({ error: "replayHash is not valid" }, 422);
          }
          if (claimed.replace(/^0x/, "") !== serverHash.slice(2)) {
            return json({ error: "replayHash mismatch" }, 422);
          }
        }
        let gameVersion = "v40";
        if (typeof body.gameVersion === "string" && body.gameVersion) {
          gameVersion = body.gameVersion.slice(0, MAX_GAME_VERSION);
        } else if (isNonEmptyString(replay.header.gameVersion)) {
          gameVersion = String(replay.header.gameVersion).slice(0, MAX_GAME_VERSION);
        }

        // --- Dedupe (BEFORE the session is touched, so a retry of the
        // same replay never burns a new session). A replay_hash already
        // in D1 returns its current status: verified -> stored signature,
        // pending/processing -> 202, rejected -> 422 with the reason.
        // A replay already submitted by a DIFFERENT wallet is rejected.
        const prev = await env.DB.prepare(
          "SELECT wallet, signature, verification_status FROM replays WHERE replay_hash = ?"
        )
          .bind(serverHash)
          .first();
        if (prev) {
          if (prev.wallet !== wallet) {
            return json({ error: "replay already submitted by another wallet" }, 422);
          }
          if (prev.verification_status === "verified") {
            return json({
              ok: true,
              duplicate: true,
              improved: false,
              verified: 1,
              signature: prev.signature,
              replayHash: serverHash,
              wallet,
              mode,
              score,
            });
          }
          if (prev.verification_status === "rejected") {
            const q = await env.DB.prepare(
              "SELECT reason FROM verify_queue WHERE replay_hash = ?"
            )
              .bind(serverHash)
              .first();
            return json(
              {
                error: "replay rejected",
                reason: q ? q.reason : "verification failed",
                replayHash: serverHash,
              },
              422
            );
          }
          return json({
            ok: true,
            pending: true,
            verification_status: prev.verification_status || "pending",
            replayHash: serverHash,
            wallet,
            mode,
            score,
          }, 202);
        }

        // --- Session (v4): REQUIRED. The v3 rules are unchanged (exists,
        // unexpired, unused, consumed exactly once; header.seed must equal
        // the session seed) but an invalid session now REJECTS the score
        // instead of merely keeping verified=0 — there is no unverified
        // submit path anymore. The wall-clock checks bind the run to the
        // session window and to real time: the run must have started after
        // the session was issued, and the submit must arrive at least the
        // song's duration after the run started (a replay "played" in
        // zero wall time is fabricated).
        if (typeof body.sessionId !== "string" || !body.sessionId) {
          return json({ error: "session required" }, 422);
        }
        const s = await env.DB.prepare(
          "SELECT session_id, seed, expires_at, used FROM sessions WHERE session_id = ?"
        )
          .bind(body.sessionId)
          .first();
        if (!s) return json({ error: "session not found" }, 422);
        if (s.used !== 0) return json({ error: "session already used" }, 422);
        if (s.expires_at <= now) return json({ error: "session expired" }, 422);
        if (s.seed !== replay.header.seed) {
          return json({ error: "replay seed mismatch" }, 422);
        }
        const sessionCreated = s.expires_at - SESSION_TTL_MS;
        const wallStart = replay.header.wallStartMs;
        if (wallStart < sessionCreated - REALTIME_SKEW_MS || wallStart > s.expires_at) {
          return json({ error: "replay wallStartMs outside session window" }, 422);
        }
        if (wallStart > now + REALTIME_SKEW_MS) {
          return json({ error: "replay wallStartMs is in the future" }, 422);
        }
        if (now < wallStart + replay.header.duration * 1000 - REALTIME_SKEW_MS) {
          return json({ error: "replay finished faster than the song duration" }, 422);
        }
        const claimed = await env.DB.prepare(
          "UPDATE sessions SET used = 1 WHERE session_id = ? AND used = 0"
        )
          .bind(body.sessionId)
          .run();
        if ((claimed.meta.changes || 0) === 0) {
          return json({ error: "session already used" }, 422);
        }

        // --- Queue for async verification. The score does NOT touch the
        // board yet: verified=1 + attestation + upsert happen in the cron
        // (verifyOne) only for replays that pass simulation.
        const replayJson = JSON.stringify(replay);
        const inserted = await env.DB.prepare(
          "INSERT INTO replays (replay_hash, wallet, mode, replay, signature, created_at, verification_status) VALUES (?, ?, ?, ?, NULL, ?, 'pending')"
        )
          .bind(serverHash, wallet, mode, replayJson, now)
          .run()
          .catch(() => null);
        if (!inserted || (inserted.meta.changes || 0) === 0) {
          // Lost a race with a concurrent identical submit: return the
          // stored status instead of failing.
          const again = await env.DB.prepare(
            "SELECT wallet, signature, verification_status FROM replays WHERE replay_hash = ?"
          )
            .bind(serverHash)
            .first();
          if (again && again.wallet === wallet) {
            return json(
              {
                ok: true,
                pending: true,
                verification_status: again.verification_status || "pending",
                replayHash: serverHash,
                wallet,
                mode,
                score,
              },
              202
            );
          }
          return json({ error: "replay already submitted by another wallet" }, 422);
        }
        await env.DB.prepare(
          "INSERT INTO verify_queue (replay_hash, wallet, mode, name, score, acc, replay, game_version, session_id, status, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)"
        )
          .bind(
            serverHash,
            wallet,
            mode,
            name,
            score,
            acc,
            replayJson,
            gameVersion,
            body.sessionId,
            now,
            now
          )
          .run();
        return json({
          ok: true,
          pending: true,
          verification_status: "pending",
          replayHash: serverHash,
          wallet,
          mode,
          score,
        }, 202);
      }

      if (url.pathname === "/rank" && request.method === "GET") {
        const wallet = (url.searchParams.get("wallet") || "").toLowerCase();
        if (!isWallet(wallet)) {
          return json({ error: "wallet address is not valid" }, 400);
        }
        const mode = MODES.includes(url.searchParams.get("mode"))
          ? url.searchParams.get("mode")
          : "free";
        const me = await env.DB.prepare(
          "SELECT score FROM scores WHERE wallet = ? AND mode = ?"
        )
          .bind(wallet, mode)
          .first();
        if (!me) return json({ wallet, mode, rank: null, score: null, total: 0 });
        const better = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM scores WHERE mode = ? AND score > ?"
        )
          .bind(mode, me.score)
          .first();
        const total = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM scores WHERE mode = ?"
        )
          .bind(mode)
          .first();
        return json({
          wallet,
          mode,
          rank: (better.n || 0) + 1,
          score: me.score,
          total: total.n || 0,
        });
      }

      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "server error" }, 500);
    }
  },

  // Cron Trigger (every minute): verify queued replays. Runs outside any
  // user request; failures are swallowed here so one bad row never kills
  // the whole run — the row is retried (see processVerifyQueue).
  async scheduled(event, env, ctx) {
    try {
      await processVerifyQueue(env);
    } catch (_) {
      // Never throw from scheduled: a failed run must not poison the
      // trigger. Pending rows are picked up by the next minute's run.
    }
  },
};

// Named exports for local unit tests (the Worker runtime only uses
// `default`; esbuild keeps these in the bundle).
export { canonical, replayHashOf, validateReplay, checkOppDist, verifySimulated, cheeseEarned, squeekDayKey, weekStartMs, weekStartKey, capsuleRarity, capsulePool, capsulePick, dupCompensation, catalogItem, CHEESE_CATALOG, CHEESE_PER_SONG, CHEESE_GRADE_S_BONUS, CHEESE_DAILY_BONUS, CHEESE_PULL_PRICE };
