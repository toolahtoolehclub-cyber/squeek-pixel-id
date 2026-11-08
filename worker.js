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
// Endpoints (all JSON, CORS open):
//   GET  /                  -> { service, version }
//   GET  /scores?mode=free&limit=20
//                          -> { mode, count, scores: [{rank, wallet, name,
//                             score, acc, verified, updated_at}] }
//   POST /session          -> { sessionId, seed, nonce, expiresAt }
//                             (seed is server-issued, valid 30 minutes,
//                             single use)
//   POST /scores {wallet, name, score, acc, mode,
//                 sessionId?, notes?, taps?, durationMs?}
//                          -> upserts ONLY when the new score beats the
//                             wallet's stored best for that mode;
//                             rate limit 10/wallet/hour, 30/IP/hour (429);
//                             plausibility failure -> 400, not stored
//   GET  /rank?wallet=0x...&mode=free
//                          -> { wallet, mode, rank, score, total }

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (url.pathname === "/" && request.method === "GET") {
        return json({ service: "squeekchain-leaderboard", version: 2 });
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

        // --- Session validation (only when the client sent one). An
        // invalid/expired/used session does NOT reject the score; it only
        // keeps verified=0. A valid session is consumed (used=1) exactly once.
        let sessionValid = false;
        if (typeof body.sessionId === "string" && body.sessionId) {
          const s = await env.DB.prepare(
            "SELECT session_id, expires_at, used FROM sessions WHERE session_id = ?"
          )
            .bind(body.sessionId)
            .first();
          if (s && s.used === 0 && s.expires_at > now) {
            const claimed = await env.DB.prepare(
              "UPDATE sessions SET used = 1 WHERE session_id = ? AND used = 0"
            )
              .bind(body.sessionId)
              .run();
            sessionValid = (claimed.meta.changes || 0) > 0;
          }
        }

        const verified = sessionValid && plausible ? 1 : 0;
        const res = await env.DB.prepare(
          "INSERT INTO scores (wallet, mode, name, score, acc, verified, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) " +
            "ON CONFLICT(wallet, mode) DO UPDATE SET name = excluded.name, score = excluded.score, acc = excluded.acc, verified = excluded.verified, updated_at = excluded.updated_at " +
            "WHERE excluded.score > scores.score"
        )
          .bind(wallet, mode, name, score, acc, verified, now)
          .run();
        const improved = (res.meta.changes || 0) > 0;
        return json({ ok: true, improved, verified, wallet, mode, score });
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
