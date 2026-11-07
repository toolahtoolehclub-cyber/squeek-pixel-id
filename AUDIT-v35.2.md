# AUDIT-v35.2 — ANTHEM no longer collides with TEMPO on the ID Card

One-line layout bug, spotted on the user's phone screenshot (2026-11-07 20:41 WIB):
the card's ANTHEM value `"Blues Minor Pentatonic" • A` (27 chars) ran into the TEMPO
value `114 BPM` with no gap, because `row()` drew every value at bold 14px
monospace (~8.4px/char) and the ANTHEM column is only 200px wide (x=24 to x=224).

## Root cause

The v33.2 comment on the ANTHEM row claimed "name + key only (26 chars)" — wrong.
Anthem names are `mood + scale` (`makeAnthem`: `SONG_MOODS[scale] + ' ' + scale`),
longest is "Sunny Major Pentatonic" (22 chars), so the card value
`"<name>" • <key>` reaches 28 chars ≈ 235px at 14px — 35px past the TEMPO column.
The TEMPO value, drawn after, overwrote the tail.

## Fix

- `row()` takes an optional font size (`fs`, default 14).
- New pure helper `anthemSize(v)`: 14px for values ≤22 chars, 10px above that.
  Guarantee: row() slices values to 30 chars, and 30 × 10px-mono (6.0px/char) =
  180px < 200px column; 22 × 14px-mono (8.4px/char) = 185px < 200px. No anthem
  name can collide now.
- The ANTHEM row passes `anthemSize(anVal)`; the stale v33.2 comment is corrected.

## Audit of the other card rows (same collision risk, checked)

- WALLET (21 chars, full-width row), BEST SCORE / GRADE (short numbers),
  TOKEN (SEPOLIA) (full-width), WHEEL (status sliced to 18 chars in fetchWheel),
  DISTANCE (short), ACHIEVEMENTS (full-width, ≤30 chars = 252px < 352px),
  MY SQUEEK at x=116 (≤30 chars = 252px, ends at 368 < 376), NEXT MERGE,
  STAKED / CLAIMABLE (≤13 chars) — none can reach the next column. Only ANTHEM
  was affected. The result card has no anthem value row.

## Tests

`TEST-v34-neo.js` 835/835 (new: anthemSize defined, row() font-size param, ANTHEM
row passes anthemSize, anthemSize run on the exact screenshot value
`"Blues Minor Pentatonic" • A` → 10, longest name → 10, short name → 14,
boundary 22/23 chars, worst-case column fit arithmetic; the old v33.2 anthem-row
test updated to the new form). `TEST-motif.js` 10/10. `node --check` OK.
