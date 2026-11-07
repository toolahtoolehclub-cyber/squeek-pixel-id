# AUDIT-v37 — Global leaderboard (Cloudflare Workers + D1)

## What was built

The last big gap from the v35 score (~9/10) is closed: the leaderboard is now
real server data, not a client-side fake. A Cloudflare Worker + D1 database
(free tier, no card) stores one best score per wallet per mode.

- **Worker**: `squeekchain-leaderboard.pancigoreng.workers.dev`
  (`worker.js` in `squeekchain-v37-worker/`). Endpoints: `GET /` (health),
  `GET /scores?mode=&limit=` (top scores), `POST /scores` (upsert — only a
  score that beats the wallet's stored best for that mode is kept),
  `GET /rank?wallet=&mode=` (the wallet's rank). CORS open, JSON only.
  Validation: wallet must match `0x` + 40 hex chars, score is an integer
  1–5,000,000, name is stripped of control chars and markup and capped at
  16 chars, mode must be one of free/daily/live/race/boss/challenge.
- **D1**: database `squeekchain-leaderboard`
  (`cd6920f3-3efb-491d-ae0c-b287069c8052`), table `scores`
  (wallet, mode, name, score, acc, updated_at; PRIMARY KEY wallet+mode)
  with an index on (mode, score DESC).
- **Account**: Cloudflare account `256be9628bc7256755a2f9d0a7780621`
  (toolahtoolehclub@gmail.com, signed in via GitHub). API token
  `squeekchain-leaderboard` (Workers Scripts Edit + D1 Edit, no expiration),
  stored in the Secure Vault as `custom.cloudflare` (bearer, api.cloudflare.com)
  — never in chat, never in a file. Workers.dev subdomain `pancigoreng`.
- **Game (LEAGUE tab)**: `#lbBox` with a name field (saved as `sqk37:lbname`),
  mode buttons for the six modes, the live top 10, and your rank. The result
  panel gains `[ SUBMIT SCORE ]` — practice runs cannot submit, no wallet
  cannot submit, a worse score never overwrites your best. The board fetches
  when the LEAGUE tab opens (same pattern as the v36 LIVE-tab fix).
- **Honesty**: when the backend is unreachable the box says OFFLINE — the
  board is never filled with invented scores. Scores are public; wallets
  display truncated (`0x372D...3a1Db`).

## Verification notes

- Token verified live: `GET /client/v4/accounts` returns the account;
  `GET /client/v4/user/tokens/verify` returns 401 for this scoped token
  (it lacks the user-details scope) — that is a scope limit, not a bad token.
- Worker + D1 verified live via the API: database created, table + index
  created, script uploaded with the D1 binding, workers.dev enabled.
- **Open item**: the public Worker URL answered with an empty reply over
  curl and a 403 over the text fetcher at first check (~14:43–14:47 UTC) —
  a live-browser read of the same URL was started to tell a routing /
  propagation quirk apart from a broken deploy. Do not call the backend
  fully verified until a real GET / returns the health JSON and a POST +
  GET round-trip lands in D1.

## Tests

`TEST-v34-neo.js` gains section 11 (leaderboard): ids present once, LB_URL,
mode list, MSG/I18N keys, setTab fetch, endGame capture, submit guards,
and the pure helpers run for real (`truncAddr`, `lbCleanName`, `lbMode`).
