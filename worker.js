// Squeekchain global leaderboard — Cloudflare Worker + D1.
// Public scoreboard: anyone can read the top scores; anyone can submit their
// own best score. No login, no token, no personal data beyond the wallet
// address the player already uses as their song seed. The game shows wallet
// addresses truncated (0x1234...abcd).
//
// Endpoints (all JSON, CORS open):
//   GET  /                  -> { service, version }
//   GET  /scores?mode=free&limit=20
//                          -> { mode, count, scores: [{rank, wallet, name,
//                             score, acc, updated_at}] }
//   POST /scores {wallet, name, score, acc, mode}
//                          -> upserts ONLY when the new score beats the
//                             wallet's stored best for that mode
//   GET  /rank?wallet=0x...&mode=free
//                          -> { wallet, mode, rank, score, total }

const MODES = ["free", "daily", "live", "race", "boss", "challenge"];
const MAX_SCORE = 5000000;
const MAX_NAME = 16;

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (url.pathname === "/" && request.method === "GET") {
        return json({ service: "squeekchain-leaderboard", version: 1 });
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
          "SELECT wallet, name, score, acc, updated_at FROM scores WHERE mode = ? ORDER BY score DESC, updated_at ASC LIMIT ?"
        )
          .bind(mode, limit)
          .all();
        return json({
          mode,
          count: results.length,
          scores: results.map((r, i) => ({ rank: i + 1, ...r })),
        });
      }

      if (url.pathname === "/scores" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !isWallet(body.wallet)) {
          return json({ error: "wallet address is not valid" }, 400);
        }
        const mode = MODES.includes(body.mode) ? body.mode : "free";
        const score = Math.floor(Number(body.score));
        const acc = Math.min(100, Math.max(0, Number(body.acc) || 0));
        if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) {
          return json({ error: "score is not valid" }, 400);
        }
        const name = cleanName(body.name);
        const now = Date.now();
        const res = await env.DB.prepare(
          "INSERT INTO scores (wallet, mode, name, score, acc, updated_at) VALUES (?, ?, ?, ?, ?, ?) " +
            "ON CONFLICT(wallet, mode) DO UPDATE SET name = excluded.name, score = excluded.score, acc = excluded.acc, updated_at = excluded.updated_at " +
            "WHERE excluded.score > scores.score"
        )
          .bind(body.wallet.toLowerCase(), mode, name, score, acc, now)
          .run();
        const improved = (res.meta.changes || 0) > 0;
        return json({ ok: true, improved, wallet: body.wallet.toLowerCase(), mode, score });
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
