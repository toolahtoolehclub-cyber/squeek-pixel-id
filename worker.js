// Squeekchain global leaderboard — Cloudflare Worker + D1.
// Public scoreboard: anyone can read the top scores; anyone can submit their
// own best score. No login, no token, no personal data beyond the wallet
// address the player already uses as their song seed. The game shows wallet
// addresses truncated (0x1234...abcd).
//
// Fase 0 (v2, Batch 1): server-issued play sessions + plausibility checks.
// The game asks POST /session for a server seed before a run and sends the
// sessionId back with the score. A score is stored as verified=1 ONLY when
// the session was valid (exists, unexpired, unused) AND the run's numbers
// pass the plausibility checks. Anything else is still stored (if it beats
// the wallet's best, as before) but marked verified=0. Nothing here proves
// a human played; it only makes blind score spam measurably harder.
//
// Fase 1 (v3, Batch 2): EIP-712 attestations over deterministic replays.
// When the client sends a valid v1 replay together with a valid session,
// the server signs an EIP-712 Attestation for that run and stores the
// signature + replay hash on the score row, and the replay itself in D1.
// NO ENFORCEMENT yet: scores without a replay (or with an invalid one)
// behave exactly as in v2 (verified 0/1 by session+plausibility, no
// signature). Enforcement (rejecting scores without a replay) is Batch 3.
//
// Signer (server-only key, held as Worker secret SIGNING_KEY, never in any
// file or repo): 0x69f24c0598c8e6b6b938527d84141dd04ec2b3e3
// EIP-712 domain: { name: "Squeek Pixel ID", version: "1",
//   chainId: 11155111 (Sepolia), verifyingContract: <signer address> }
// Attestation: player (address), score (uint256), accuracy (uint256 =
//   Math.round(acc*100)), songId (string), gameVersion (string, e.g. "v39"),
//   seed (uint256), replayHash (bytes32), nonce (uint256), deadline
//   (uint256, epoch seconds, now+600).
// songId is FROZEN: mode + "|" + genre + "|" + diff + "|" + seedKey,
// computed from the replay header. The client uses the same formula.
// replayHash is SHA-256 (hex) of the canonical JSON of the replay
// (canonical = JSON.stringify with keys sorted recursively). The hash is
// NOT keccak — the EIP-712 struct just carries the 32 SHA-256 bytes.
// Nonce is per-wallet monotonic in D1 table `nonces`, +1 per attestation
// the server signs. A replay_hash already in D1 table `replays` is never
// stored twice: the stored signature is returned with duplicate:true.
// A replay already attested to a DIFFERENT wallet is rejected (400) so a
// run cannot be replayed under someone else's address.
//
// BUILD: this file imports @noble/curves + @noble/hashes, which Workers
// cannot resolve at deploy time. Bundle first, then deploy the bundle:
//   cd /tmp/v39-build && npx esbuild <path>/worker.js --bundle \
//     --format=esm --outfile=dist/worker.js
//   python3 ~/workspace/custom-connectors/custom.cloudflare/bin/upload_worker.py \
//     squeekchain-leaderboard dist/worker.js cd6920f3-3efb-491d-ae0c-b287069c8052
// The secret must exist first (PUT .../workers/scripts/squeekchain-leaderboard/secrets
// {"name":"SIGNING_KEY","text":"<64-hex>","type":"secret_text"}).
//
// Endpoints (all JSON, CORS open):
//   GET  /                  -> { service, version }
//   GET  /scores?mode=free&limit=20
//                          -> { mode, count, scores: [{rank, wallet, name,
//                             score, acc, verified, updated_at}] }
//   POST /session          -> { sessionId, seed, nonce, expiresAt }
//                             (seed is server-issued, valid 30 minutes,
//                             single use)
//   POST /scores {wallet, name, score, acc, mode,
//                 sessionId?, notes?, taps?, durationMs?,
//                 replay?, replayHash?, gameVersion?}
//                          -> upserts ONLY when the new score beats the
//                             wallet's stored best for that mode;
//                             rate limit 10/wallet/hour, 30/IP/hour (429);
//                             plausibility failure -> 400, not stored.
//                             With a valid replay + valid session:
//                             { ok, improved, verified:1, signature,
//                               replayHash, nonce, deadline, wallet, mode,
//                               score }. Duplicate replay:
//                             { ok, duplicate:true, improved:false,
//                               verified:1, signature, replayHash, ... }.
//   GET  /rank?wallet=0x...&mode=free
//                          -> { wallet, mode, rank, score, total }

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const MODES = ["free", "daily", "live", "race", "boss", "challenge"];
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

function signAttestation(privHex, a) {
  const digest = attestationDigest(a);
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

// Validate a v1 replay against the submitted score/acc/mode/notes.
// Returns { ok: true } or { ok: false, error }.
function validateReplay(replay, body, mode, score, acc) {
  if (!replay || typeof replay !== "object" || Array.isArray(replay)) {
    return { ok: false, error: "replay is not valid" };
  }
  if (replay.v !== 1) return { ok: false, error: "replay version is not 1" };
  const h = replay.header;
  if (!h || typeof h !== "object") return { ok: false, error: "replay header is missing" };
  if (h.mode !== mode) return { ok: false, error: "replay header mode mismatch" };
  if (!isNonEmptyString(h.genre)) return { ok: false, error: "replay header genre is missing" };
  if (!isNonEmptyString(h.diff)) return { ok: false, error: "replay header diff is missing" };
  if (!isNonEmptyString(h.seedKey)) return { ok: false, error: "replay header seedKey is missing" };
  if (!isInt(h.seed) || h.seed < 0 || h.seed > 4294967295) {
    return { ok: false, error: "replay header seed is not valid" };
  }
  const ev = replay.events;
  if (!ev || typeof ev !== "object") return { ok: false, error: "replay events are missing" };
  for (const f of ["inputs", "polls", "golden"]) {
    if (!Array.isArray(ev[f])) return { ok: false, error: `replay events.${f} is not an array` };
    for (const e of ev[f]) {
      if (!e || typeof e !== "object") return { ok: false, error: `replay events.${f} entry is not valid` };
    }
  }
  if (ev.polls.length > MAX_POLLS) return { ok: false, error: "replay polls exceed 600" };
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
  // Note count for the inputs cap: body.notes when sent, else the sum of
  // the claim counts.
  const notes = body.notes !== undefined && body.notes !== null ? Number(body.notes) : totalNotes;
  if (Number.isFinite(notes) && ev.inputs.length > notes + MAX_EXTRA_TAPS) {
    return { ok: false, error: "replay inputs exceed notes + 50" };
  }
  return { ok: true };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (url.pathname === "/" && request.method === "GET") {
        return json({ service: "squeekchain-leaderboard", version: 3 });
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
        const plausible = true;

        // --- Replay v1 (Fase 1): shape + hash check, BEFORE the session
        // is consumed, so a bad replay never burns a session.
        const hasReplay = body.replay !== undefined && body.replay !== null;
        let replay = null;
        let serverHash = null;
        let gameVersion = "v39";
        if (hasReplay) {
          if (typeof body.replay === "string") {
            if (body.replay.length > MAX_REPLAY_BYTES) {
              return json({ error: "replay too large" }, 400);
            }
            try {
              replay = JSON.parse(body.replay);
            } catch {
              return json({ error: "replay is not valid JSON" }, 400);
            }
          } else {
            replay = body.replay;
            if (JSON.stringify(replay).length > MAX_REPLAY_BYTES) {
              return json({ error: "replay too large" }, 400);
            }
          }
          const v = validateReplay(replay, body, mode, score, acc);
          if (!v.ok) return json({ error: v.error }, 400);
          serverHash = replayHashOf(replay);
          if (body.replayHash !== undefined && body.replayHash !== null) {
            const claimed = String(body.replayHash).toLowerCase();
            if (!/^0x[0-9a-f]{64}$/.test(claimed) && !/^[0-9a-f]{64}$/.test(claimed)) {
              return json({ error: "replayHash is not valid" }, 400);
            }
            if (claimed.replace(/^0x/, "") !== serverHash.slice(2)) {
              return json({ error: "replayHash mismatch" }, 400);
            }
          }
          if (typeof body.gameVersion === "string" && body.gameVersion) {
            gameVersion = body.gameVersion.slice(0, MAX_GAME_VERSION);
          } else if (isNonEmptyString(replay.header.gameVersion)) {
            gameVersion = String(replay.header.gameVersion).slice(0, MAX_GAME_VERSION);
          }
        }

        // --- Dedupe: a replay_hash already in D1 is never stored twice.
        // Same wallet -> return the stored signature. Different wallet ->
        // reject: a run cannot be replayed under someone else's address.
        if (hasReplay) {
          const prev = await env.DB.prepare(
            "SELECT wallet, signature FROM replays WHERE replay_hash = ?"
          )
            .bind(serverHash)
            .first();
          if (prev) {
            if (prev.wallet !== wallet) {
              return json({ error: "replay already submitted by another wallet" }, 400);
            }
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
        }

        // --- Session validation (only when the client sent one). An
        // invalid/expired/used session does NOT reject the score; it only
        // keeps verified=0. A valid session is consumed (used=1) exactly once.
        // With a replay, the header seed must match the session seed;
        // a mismatch is rejected BEFORE consuming the session.
        let sessionValid = false;
        let sessionSeed = null;
        if (typeof body.sessionId === "string" && body.sessionId) {
          const s = await env.DB.prepare(
            "SELECT session_id, seed, expires_at, used FROM sessions WHERE session_id = ?"
          )
            .bind(body.sessionId)
            .first();
          if (s && s.used === 0 && s.expires_at > now) {
            if (hasReplay && s.seed !== replay.header.seed) {
              return json({ error: "replay seed mismatch" }, 400);
            }
            const claimed = await env.DB.prepare(
              "UPDATE sessions SET used = 1 WHERE session_id = ? AND used = 0"
            )
              .bind(body.sessionId)
              .run();
            sessionValid = (claimed.meta.changes || 0) > 0;
            if (sessionValid) sessionSeed = s.seed;
          }
        }

        const verified = sessionValid && plausible ? 1 : 0;

        // --- Attestation (Fase 1): only when session valid + plausibility
        // + replay valid. No enforcement: without a replay the v2 path
        // below runs unchanged.
        let signature = null;
        let replayHash = null;
        let nonce = null;
        let deadline = null;
        if (hasReplay && verified === 1) {
          const privHex = env.SIGNING_KEY;
          if (typeof privHex !== "string" || !/^[0-9a-fA-F]{64}$/.test(privHex)) {
            return json({ error: "signing unavailable" }, 500);
          }
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
          nonce = (prevNonce ? prevNonce.nonce : 0) + 1;
          await env.DB.prepare(
            "INSERT INTO nonces (wallet, nonce) VALUES (?, ?) ON CONFLICT(wallet) DO UPDATE SET nonce = excluded.nonce"
          )
            .bind(wallet, nonce)
            .run();
          deadline = Math.floor(now / 1000) + ATTESTATION_TTL_S;
          replayHash = serverHash;
          signature = signAttestation(privHex, {
            player: wallet,
            score,
            accuracy: Math.round(acc * 100),
            songId,
            gameVersion,
            seed: sessionSeed !== null ? sessionSeed : replay.header.seed,
            replayHash,
            nonce,
            deadline,
          });
          await env.DB.prepare(
            "INSERT INTO replays (replay_hash, wallet, mode, replay, signature, created_at) VALUES (?, ?, ?, ?, ?, ?)"
          )
            .bind(replayHash, wallet, mode, JSON.stringify(replay), signature, now)
            .run();
        }

        const res = await env.DB.prepare(
          "INSERT INTO scores (wallet, mode, name, score, acc, verified, updated_at, signature, replay_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
            "ON CONFLICT(wallet, mode) DO UPDATE SET name = excluded.name, score = excluded.score, acc = excluded.acc, verified = excluded.verified, updated_at = excluded.updated_at, signature = excluded.signature, replay_hash = excluded.replay_hash " +
            "WHERE excluded.score > scores.score"
        )
          .bind(wallet, mode, name, score, acc, verified, now, signature, replayHash)
          .run();
        const improved = (res.meta.changes || 0) > 0;
        // A signed attestation is only stored on the score row when the
        // run improved the wallet's best; otherwise the signature still
        // lives in the replays table (and in this response) but the row
        // keeps the attestation of its stored best score.
        const out = { ok: true, improved, verified, wallet, mode, score };
        if (signature) {
          out.signature = signature;
          out.replayHash = replayHash;
          out.nonce = nonce;
          out.deadline = deadline;
        }
        return json(out);
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
};
