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
//   GET  /                  -> { service, version: 12 }
//   GET  /icon.png           -> 512x512 app icon PNG (WalletConnect/OKX, favicon)
//   GET  /og.png             -> 1600x900 banner PNG (og:image / twitter:image)
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
//   POST /cheese/unequip {wallet, slot}
//                          -> { ok, slot } — clears the equipped flag for
//                             every item in that slot (v12). No D1 schema
//                             change: the equipped column already exists.
//                             Without this, unequip lokal saja tidak cukup:
//                             fetchShop() menyinkronkan flag equipped dari
//                             server dan akan mengembalikan skin yang dicopot.
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
//   POST /dream/harvest {wallet, plantedAt, stage}
//                          -> { ok, keju, night_key } or 400/409.
//                             One Dream Seed harvest per (wallet, Squeek
//                             night); reward 25 + 25*stage, max 75 Keju.
//   POST /analytics {event} -> { ok } or 400.
//                             Anonymous counts only (visit, play, mode_*,
//                             shop_open, submit). No wallet, no IP stored.
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
// --- v10 (P0-1): rate limit — COUNT FIRST, insert ONLY if allowed.
// v9 inserted a log row BEFORE the check, so every rejected attempt added
// a row and extended its own block. The 429 body now carries retryAfterSec
// (seconds until the oldest row in the window ages out) so the client can
// show an exact retry clock time. `table` is always a literal from this
// file, never user input.
async function rateLimitAllowed(env, table, wallet, ip, walletMax, ipMax) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  await env.DB.prepare(`DELETE FROM ${table} WHERE ts < ?`).bind(windowStart).run();
  const walletRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n, MIN(ts) AS oldest FROM ${table} WHERE wallet = ? AND ts >= ?`
  ).bind(wallet, windowStart).first();
  const ipRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n, MIN(ts) AS oldest FROM ${table} WHERE ip = ? AND ts >= ?`
  ).bind(ip, windowStart).first();
  const walletCount = (walletRow && walletRow.n) || 0;
  const ipCount = (ipRow && ipRow.n) || 0;
  if (walletCount >= walletMax || ipCount >= ipMax) {
    const oldestWallet = walletCount >= walletMax && walletRow.oldest ? walletRow.oldest : Infinity;
    const oldestIp = ipCount >= ipMax && ipRow.oldest ? ipRow.oldest : Infinity;
    const oldest = Math.min(oldestWallet, oldestIp);
    const retryAfterSec = Number.isFinite(oldest)
      ? Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - now) / 1000))
      : Math.ceil(RATE_WINDOW_MS / 1000);
    return { allowed: false, retryAfterSec };
  }
  await env.DB.prepare(
    `INSERT INTO ${table} (wallet, ip, ts) VALUES (?, ?, ?)`
  ).bind(wallet, ip, now).run();
  return { allowed: true, retryAfterSec: 0 };
}
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
const SQUEEK_API_STATS = "https://api.squeekchain.com/v1/measurement/stats?range=7d";
// --- v10: GHOST pace bound — a claimed ghost pace above 1.0 m/s is not a
// real daytime average (fastest sustained daytime pace observed ~0.6 m/s).
const GHOST_PACE_MAX_MS = 1.0;
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

// --- v42.5.1: app icon + OG image served from the Worker ---
// The PNGs live ONLY as base64 here: the GitHub push tool rejects binary
// files, so the icon/OG files never exist in the repo (that 404 is why OKX
// showed a generic icon for "Squeek Pixel ID" and og:image was dead).
// Served as real PNG bytes; bundle stays one file (esbuild inlines it).
const ICON_PNG_B64 = "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";
const OG_PNG_B64 = "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rz9//efc9jlf97e+rpqWL/r8L3r9z9eFA//51/7zC5/7wsViAQCv+Fuv+M3f/00iwiN8zMc/5rmf+9zK/g/+5A/e+7/e2xf0YSewmJGDVwNr+JTTwujC0cBKbxlm02oNLJsHd3sCRtLAysKbYxPWbmhgHR4eNi/tV7/61T/6oz/68Ic//FnPetZXf/VXV7swXvziF//u7/7uu9/97t6L6MlPfnLV8Z577qnKrB75yEdef/31w306/+gf/aPqwdmzZ3/pl36pevyud72raW9juVw28Tz0oQ8FpzbEm9/85he96EXVfeaVr3zlu971rmoN/JjHPOb5z39+dZ/5/d///fe85z1Bc1JhSzVHKtx7773veMc7qiKvW2+99dnPfvZb3/pWAPjGb/zGj/qojwKA1Wr1Td/0TY39Ix/5yKqE8I//+I//9t/+20qpG2644RnPeMbXf/3XV3vcbr311p/8yZ/8sz/7s/TYeuiN92u+5muyU3B4jbjllluqa7uSbnjKU55SJbA+93M/9+abb270HK6//vqmi/dqX96yKdq4cOHCy1/+8uoCvnjx4r/5N//mt3/7t69evfpRH/VRT3va077kS77kIQ95SPN5L8iYGUwP//Af/sOP+ZiPqR6/7nWv+7Ef+7EbbrjhW7/1W//KX/krAHDrrbc+5znPectb3gIA1113Xbsw7UUvetHP/uzPVq++g4OD5tByuUTCuOATsS2v38PDw+Zj3mte85o3vOEND3/4w5/5zGd+1Vd9VXUH/oqv+Irf+73fa3LND3vYwxr7aj4b3gsXNh9fj47qL0pvvvnmqvGOO+740i/9Um88wzuwG9syz8IrvCzsmQbWRMPNArJXb8FayWv4F0ckCAV/trNf+fM/X8Yhp8/DMHFHdN/F+978a2/+gz//g6rloRceulSTFg7PAER034P3/fTbf/r3//T3q5YbHnJD83Hqgx/+4C/+2i9Wjz/+oz7+b3z636gev/QLX9p8SP0PP/0fAAYTPsk9PIJ0VpXReYOZ1dAE40Jrfeedd77xjW/8t//23zaNL3zhC4eWTf3gO97xjnvvvRcAlFKPf/zjx4mzwgc/+MEqLwMAj3nMYz7rsz6revyVX/mVzX3mNa95zZghzQc//uM/3uzUeOUrX3n27NnbbrvtSU96UtXysz/7s3/xF39h66u1/shHPvKmN72prSz2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";

function pngResponse(b64) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Response(bin, {
    headers: {
      ...CORS,
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

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
  // v10 (P1-3): GHOST race — the opponent is a simulation at a real
  // daytime pace, not the live wheel. Validate oppDistM against the
  // claimed pace x finish time (tolerance 2 m for tick rounding).
  if (h.ghost === true) {
    const pace = h.ghostPaceMs;
    if (typeof pace !== "number" || !Number.isFinite(pace) || pace < 0 || pace > GHOST_PACE_MAX_MS) {
      return "ghost pace is not valid";
    }
    const expected = pace * fin.t;
    if (Math.abs(opp - expected) > 2) return "finish.oppDistM inconsistent with ghost pace";
    return null;
  }
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
  // v10 (P1-3): GHOST race — the header declares whether the opponent was
  // a simulation and at what pace. Ghost only exists in race mode; the
  // pace is capped at 1.0 m/s (fastest sustained daytime pace observed
  // ~0.6 m/s). checkOppDist validates oppDistM against the pace.
  if (h.ghost !== undefined && typeof h.ghost !== "boolean") {
    return { ok: false, error: "replay header ghost is not valid" };
  }
  if (h.ghost === true && h.mode !== "race") {
    return { ok: false, error: "replay ghost is only valid in race mode" };
  }
  if (h.ghostPaceMs !== undefined && (!isFiniteNumber(h.ghostPaceMs) || h.ghostPaceMs < 0 || h.ghostPaceMs > GHOST_PACE_MAX_MS)) {
    return { ok: false, error: "replay header ghostPaceMs out of range" };
  }
  if (h.ghost === true && (h.ghostPaceMs === undefined || h.ghostPaceMs <= 0)) {
    return { ok: false, error: "replay header ghostPaceMs is missing" };
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
// --- v10 (P1-2): poll cross-check against public wheel data ---
// A fake poll log claiming ZOOMIES all song doubles the score. The public
// /v1/measurement/stats?range=7d gives 30-minute buckets with workUnits;
// a bucket with coverage "complete" and workUnits "0" PROVES the wheel did
// not move in that half hour. If EVERY bucket covering the song window is
// provably still, any poll claiming rpm > 0 is fabrication -> reject.
// Missing/partial/null buckets are inconclusive -> SKIP (fail open, never
// reject on missing data). Fetch failure -> skip the check.
function pollsContradictWheel(stats, wallStartMs, durationMs, polls) {
  if (!stats || !Array.isArray(stats.days)) return false;
  const okPolls = (Array.isArray(polls) ? polls : []).filter(
    (p) => p && p.ok && typeof p.rpm === "number" && p.rpm > 0
  );
  if (!okPolls.length) return false; // no live claim to contradict
  const endMs = wallStartMs + durationMs;
  const bucketStarts = new Set();
  for (let t = Math.floor(wallStartMs / (30 * 60000)) * 30 * 60000; t < endMs; t += 30 * 60000) {
    bucketStarts.add(t);
  }
  if (!bucketStarts.size) return false;
  let checked = 0, still = 0;
  for (const bucketStart of bucketStarts) {
    const d = new Date(bucketStart);
    const dateKey = d.toISOString().slice(0, 10);
    const minuteUtc = d.getUTCHours() * 60 + d.getUTCMinutes();
    const day = stats.days.find((x) => x && x.date === dateKey);
    if (!day || !Array.isArray(day.buckets)) continue;
    const bucket = day.buckets.find((b) => b && b.startMinuteUtc === minuteUtc);
    if (!bucket) continue;
    if (bucket.coverage !== "complete") continue;
    if (bucket.workUnits === null || bucket.workUnits === undefined) continue;
    const w = Number(bucket.workUnits);
    if (!Number.isFinite(w)) continue;
    checked++;
    if (w === 0) still++;
  }
  // Only reject when the window is FULLY covered by provably-still buckets.
  return checked > 0 && checked === bucketStarts.size && still === checked;
}

// --- v10 (P2-2): Dream Seed harvest reward — 25 + 25 per stage, max 75
// Keju per night (comparable to one verified song). The planted timestamp
// is client-claimed, so the reward is deliberately small and capped, and
// the one-per-night rule is enforced server-side by the ledger's UNIQUE
// (wallet, kind, day_key) index.
function dreamReward(stage) {
  const st = Math.max(0, Math.min(2, Math.floor(Number(stage) || 0)));
  return Math.min(75, 25 + 25 * st);
}

async function verifyOne(env, row, now, wheelStats) {
  const replay = JSON.parse(row.replay);
  const chart = buildChart(replay.header);
  const sim = simulate(chart, replay);
  const v = verifySimulated(replay, chart, sim);
  if (!v.ok) {
    await markRejected(env, row.replay_hash, v.reason, now);
    return { ok: false, reason: v.reason };
  }
  // v10 (P1-2): poll cross-check — a replay whose polls claim the wheel
  // moved while the public stats prove it was still is fabricated.
  if (wheelStats && pollsContradictWheel(wheelStats, replay.header.wallStartMs, replay.header.duration * 1000, replay.events.polls)) {
    await markRejected(env, row.replay_hash, "polls contradict public wheel data", now);
    return { ok: false, reason: "polls contradict public wheel data" };
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
  // v10 (P1-2): fetch the public wheel stats ONCE per cron run for the
  // poll cross-check (not per row). Fetch failure -> skip the check.
  let wheelStats = null;
  try {
    const statsRes = await fetch(SQUEEK_API_STATS, { headers: { "User-Agent": "squeekchain-leaderboard/10" } });
    if (statsRes.ok) wheelStats = await statsRes.json().catch(() => null);
  } catch (_) {}
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
      const out = await verifyOne(env, row, Date.now(), wheelStats);
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
        return json({ service: "squeekchain-leaderboard", version: 12 });
      }

      // --- v42.5.1: app icon (WalletConnect/OKX) + OG image ---
      if (url.pathname === "/icon.png" && request.method === "GET") {
        return pngResponse(ICON_PNG_B64);
      }
      if (url.pathname === "/og.png" && request.method === "GET") {
        return pngResponse(OG_PNG_B64);
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

      // v12: UNEQUIP Keju — POST /cheese/unequip {wallet, slot}: clears the
      // equipped flag for every item in that slot. The client alone cannot
      // unequip Keju: GET /cheese reports the server flag and fetchShop()
      // re-syncs it, so a local-only unequip would be restored on the next
      // shop refresh (the v42.5.1 equip-revert bug in reverse). Ownership
      // is untouched: the row stays in cheese_inventory, only equipped=0.
      if (url.pathname === "/cheese/unequip" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !isWallet(body.wallet)) {
          return json({ error: "wallet address is not valid" }, 400);
        }
        const wallet = body.wallet.toLowerCase();
        const slot = String(body.slot || "");
        if (slot !== "note" && slot !== "frame") {
          return json({ error: "slot is not valid" }, 400);
        }
        const slotIds = CHEESE_CATALOG.filter((c) => c.slot === slot).map((c) => c.id);
        await env.DB.prepare(
          "UPDATE cheese_inventory SET equipped = 0 WHERE wallet = ? AND item_id IN (" +
            slotIds.map(() => "?").join(",") +
            ")"
        ).bind(wallet, ...slotIds).run();
        return json({ ok: true, slot });
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
        // v10 (P0-1): resolve has its OWN counter (resolve_log) — score
        // submits must not block capsule resolve. Check BEFORE insert.
        const now = Date.now();
        await env.DB.prepare(
          "CREATE TABLE IF NOT EXISTS resolve_log (wallet TEXT NOT NULL, ip TEXT NOT NULL, ts INTEGER NOT NULL)"
        ).run();
        const rlResolve = await rateLimitAllowed(env, "resolve_log", wallet, request.headers.get("CF-Connecting-IP") || "unknown", RATE_MAX_WALLET, RATE_MAX_IP);
        if (!rlResolve.allowed) {
          return json({ error: "rate_limited", retryAfterSec: rlResolve.retryAfterSec }, 429);
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

      if (url.pathname === "/dream/harvest" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !isWallet(body.wallet)) {
          return json({ error: "wallet address is not valid" }, 400);
        }
        const wallet = body.wallet.toLowerCase();
        const plantedAt = Number(body.plantedAt);
        const stage = Math.floor(Number(body.stage));
        if (!Number.isFinite(plantedAt) || plantedAt <= 0 || plantedAt > Date.now()) {
          return json({ error: "plantedAt is not valid" }, 400);
        }
        if (!Number.isInteger(stage) || stage < 0 || stage > 2) {
          return json({ error: "stage is not valid" }, 400);
        }
        // v10 (P2-2): one harvest per (wallet, Squeek night). The night key
        // is derived server-side from plantedAt. The dream_harvests row is
        // the guard (INSERT OR IGNORE); the balance + ledger credit runs
        // after it. Tiny failure window: if the batch after the guard
        // fails, the guard row exists and a retry returns 409 — the credit
        // can then only be fixed manually. Accepted: D1 errors there are
        // rare and the amount is at most 75 Keju.
        const nightKey = squeekDayKey(plantedAt);
        const keju = dreamReward(stage);
        const now = Date.now();
        await env.DB.prepare(
          "CREATE TABLE IF NOT EXISTS dream_harvests (wallet TEXT NOT NULL, night_key TEXT NOT NULL, planted_at INTEGER NOT NULL, stage INTEGER NOT NULL, reward INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (wallet, night_key))"
        ).run();
        await env.DB.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_cheese_ledger_dream ON cheese_ledger(wallet, kind, day_key) WHERE kind = 'dream'"
        ).run();
        const guard = await env.DB.prepare(
          "INSERT OR IGNORE INTO dream_harvests (wallet, night_key, planted_at, stage, reward, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(wallet, nightKey, plantedAt, stage, keju, now).run();
        if ((guard.meta.changes || 0) === 0) {
          return json({ error: "already harvested" }, 409);
        }
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO cheese_balances (wallet, balance, updated_at) VALUES (?, ?, ?) ON CONFLICT(wallet) DO UPDATE SET balance = cheese_balances.balance + excluded.balance, updated_at = excluded.updated_at"
          ).bind(wallet, keju, now),
          env.DB.prepare(
            "INSERT OR IGNORE INTO cheese_ledger (wallet, replay_hash, kind, amount, day_key, created_at) VALUES (?, NULL, 'dream', ?, ?, ?)"
          ).bind(wallet, keju, nightKey, now),
        ]);
        return json({ ok: true, keju, night_key: nightKey });
      }

      if (url.pathname === "/analytics" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        const event = body && typeof body.event === "string" ? body.event : "";
        const allowed = ["visit", "play", "mode_free", "mode_daily", "mode_live", "mode_race", "mode_boss", "mode_lullaby", "shop_open", "submit"];
        if (allowed.indexOf(event) < 0) {
          return json({ error: "event is not valid" }, 400);
        }
        // v10 (P2-5): anonymous counts only — no wallet, no IP stored.
        await env.DB.prepare(
          "CREATE TABLE IF NOT EXISTS analytics_daily (day_key TEXT NOT NULL, event TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day_key, event))"
        ).run();
        const dayKey = squeekDayKey(Date.now());
        await env.DB.prepare(
          "INSERT INTO analytics_daily (day_key, event, n) VALUES (?, ?, 1) ON CONFLICT(day_key, event) DO UPDATE SET n = analytics_daily.n + 1"
        ).bind(dayKey, event).run();
        return json({ ok: true });
      }

      if (url.pathname === "/session" && request.method === "POST") {
        const sessBody = await request.json().catch(() => null);
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
        // v10 (P1-2): bind the session to the wallet that requested it.
        // The client already sends `wallet` (or 'GUEST'); /scores checks
        // the binding so a session issued for one wallet cannot submit a
        // score for another. Legacy/unbound sessions are not checked.
        const sessWallet = sessBody && typeof sessBody.wallet === "string" ? sessBody.wallet.toLowerCase() : null;
        if (sessWallet && sessWallet !== "guest" && isWallet(sessWallet)) {
          await env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS session_wallets (session_id TEXT PRIMARY KEY, wallet TEXT NOT NULL)"
          ).run();
          await env.DB.prepare(
            "INSERT INTO session_wallets (session_id, wallet) VALUES (?, ?)"
          ).bind(sessionId, sessWallet).run();
        }
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

        // --- Rate limit, BEFORE plausibility. v10 (P0-1): check BEFORE
        // insert — a rejected attempt adds NO row and cannot extend its
        // own block. The 429 body carries retryAfterSec for the client.
        const rlScores = await rateLimitAllowed(env, "submit_log", wallet, ip, RATE_MAX_WALLET, RATE_MAX_IP);
        if (!rlScores.allowed) {
          return json({ error: "rate_limited", retryAfterSec: rlScores.retryAfterSec }, 429);
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
        // v10 (P1-2): session->wallet binding — a bound session only
        // submits for its own wallet. Unbound (legacy/GUEST) sessions skip.
        const binding = await env.DB.prepare(
          "SELECT wallet FROM session_wallets WHERE session_id = ?"
        ).bind(body.sessionId).first();
        if (binding && binding.wallet && binding.wallet !== wallet) {
          return json({ error: "session wallet mismatch" }, 422);
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
export { canonical, replayHashOf, validateReplay, checkOppDist, verifySimulated, cheeseEarned, squeekDayKey, weekStartMs, weekStartKey, capsuleRarity, capsulePool, capsulePick, dupCompensation, catalogItem, rateLimitAllowed, pollsContradictWheel, dreamReward, CHEESE_CATALOG, CHEESE_PER_SONG, CHEESE_GRADE_S_BONUS, CHEESE_DAILY_BONUS, CHEESE_PULL_PRICE, GHOST_PACE_MAX_MS };
