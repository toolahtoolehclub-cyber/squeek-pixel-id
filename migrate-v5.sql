-- D1 migration for Worker v5 (Batch 5-off-chain: Toko Keju + Liga Mingguan)
-- database squeekchain-leaderboard (cd6920f3-3efb-491d-ae0c-b287069c8052).
-- Run each statement once via cf_api.py BEFORE deploying worker v5.
-- All CREATEs are IF NOT EXISTS / IF NOT EXISTS indexes, so re-running is
-- safe. No existing table is altered; no old rows are deleted.
--
-- 1. Cheese balance per wallet (one row per wallet, created on first
--    verified song).
CREATE TABLE IF NOT EXISTS cheese_balances (
  wallet TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- 2. Cheese ledger: every credit/debit, for audit + idempotency.
--    kind: 'song' (+100, +500 S bonus folded in), 'daily' (+50 first
--    verified song of the Squeek day), 'buy' (-price), 'pull' (-100),
--    'duplicate' (+compensation). replay_hash is set ONLY for 'song'
--    rows; the partial UNIQUE index makes the song credit idempotent per
--    replay, and the daily index makes the mission bonus once per day.
CREATE TABLE IF NOT EXISTS cheese_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet TEXT NOT NULL,
  replay_hash TEXT,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  day_key TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cheese_ledger_replay ON cheese_ledger(replay_hash) WHERE replay_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cheese_ledger_daily ON cheese_ledger(wallet, kind, day_key) WHERE kind = 'daily';

-- 3. Cheese inventory: owned cosmetics + which one is equipped per slot.
--    item_id must be one of the 8 CHEESE_CATALOG ids in worker.js.
CREATE TABLE IF NOT EXISTS cheese_inventory (
  wallet TEXT NOT NULL,
  item_id TEXT NOT NULL,
  equipped INTEGER NOT NULL DEFAULT 0,
  acquired_at INTEGER NOT NULL,
  PRIMARY KEY (wallet, item_id)
);

-- 4. Weekly league: best FREE score per wallet per week. week_start is
--    the Monday's date in WIB ('YYYY-MM-DD'); the week starts Monday
--    19:00 WIB (= Monday 12:00 UTC) and resets the next Monday 19:00 WIB.
CREATE TABLE IF NOT EXISTS league_scores (
  wallet TEXT NOT NULL,
  week_start TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'GUEST',
  best_score INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (wallet, week_start)
);
CREATE INDEX IF NOT EXISTS idx_league_week ON league_scores(week_start, best_score DESC);
