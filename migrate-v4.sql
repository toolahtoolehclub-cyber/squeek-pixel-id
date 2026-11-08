-- D1 migration for Worker v4 (Batch 3) — database squeekchain-leaderboard
-- (cd6920f3-3efb-491d-ae0c-b287069c8052). Run each statement once via
-- cf_api.py BEFORE deploying worker v4. Idempotent where marked; the
-- ALTER TABLE and UPDATE are safe to re-run (ALTER fails harmlessly if
-- the column already exists — ignore that one error).
--
-- 1. The async verification queue: one row per submitted replay, claimed
--    by the cron (pending -> processing -> verified|rejected).
CREATE TABLE IF NOT EXISTS verify_queue (
  replay_hash TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  mode TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'GUEST',
  score INTEGER NOT NULL,
  acc REAL NOT NULL,
  replay TEXT NOT NULL,
  game_version TEXT NOT NULL DEFAULT 'v40',
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  signature TEXT,
  nonce INTEGER,
  deadline INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verify_queue_status ON verify_queue(status, created_at);

-- 2. Verification status on the stored replay itself. Existing v3 rows
--    all carry a signature, so they are verified; anything without a
--    signature stays 'unverified' (legacy rows are never re-verified).
ALTER TABLE replays ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
UPDATE replays SET verification_status = 'verified' WHERE signature IS NOT NULL;

-- No changes to scores / sessions / submit_log / nonces.
-- Old rows are NEVER deleted by this migration.
