-- D1 migration for Worker v10 (v42.5: rate-limit fix, session binding,
-- poll cross-check, GHOST, Dream Seeds, analytics)
-- database squeekchain-leaderboard (cd6920f3-3efb-491d-ae0c-b287069c8052).
-- Run each statement once via cf_api.py BEFORE deploying worker v10.
-- All CREATEs are IF NOT EXISTS / IF NOT EXISTS indexes, so re-running is
-- safe. No existing table is altered; no old rows are deleted.
-- NOTE: worker v10 ALSO creates these tables lazily at runtime
-- (CREATE TABLE IF NOT EXISTS inside the handlers), so the migration is
-- the documented record and the safety net — the worker works even if it
-- is applied late.
--
-- 1. resolve_log: capsule-resolve rate-limit counter, SEPARATE from
--    submit_log (v9 shared the table, so score submits blocked resolves).
--    Same shape as submit_log: wallet, ip, ts.
CREATE TABLE IF NOT EXISTS resolve_log (
  wallet TEXT NOT NULL,
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);

-- 2. session_wallets: session -> wallet binding (v10 P1-2). A session
--    issued for one wallet cannot submit a score for another wallet.
--    Sessions without a row here (legacy / GUEST) are not checked.
CREATE TABLE IF NOT EXISTS session_wallets (
  session_id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL
);

-- 3. dream_harvests: one Dream Seed harvest per (wallet, Squeek night).
--    The guard for POST /dream/harvest (INSERT OR IGNORE, PRIMARY KEY).
CREATE TABLE IF NOT EXISTS dream_harvests (
  wallet TEXT NOT NULL,
  night_key TEXT NOT NULL,
  planted_at INTEGER NOT NULL,
  stage INTEGER NOT NULL,
  reward INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (wallet, night_key)
);

-- 4. Ledger index for dream harvests (mirrors the 'daily' index):
--    one 'dream' credit per (wallet, night).
CREATE UNIQUE INDEX IF NOT EXISTS idx_cheese_ledger_dream
  ON cheese_ledger(wallet, kind, day_key) WHERE kind = 'dream';

-- 5. analytics_daily: anonymous counts only (visit, play, mode_*,
--    shop_open, submit). No wallet, no IP stored.
CREATE TABLE IF NOT EXISTS analytics_daily (
  day_key TEXT NOT NULL,
  event TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day_key, event)
);
