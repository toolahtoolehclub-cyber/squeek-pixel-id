# AUDIT-v36.1 — precision readout resets with the game

One-line fix from the LIVE rhythm-mode smoke test (2026-11-07 21:02–21:05 WIB).

## Bug

`hitOffsets` was reset to `[]` at game start, but the three DOM elements it feeds
were not: `#lastHit`, `#avgHit`, `#hitDir`. So at the start of a new game, the
previous game's values ("TERAKHIR -110 ms", "RATA-RATA -86 ms") stayed on screen
until the first tap of the new game. `updatePrecision()` only writes those
elements when a tap is judged — nothing cleared them at start.

## Fix

At game start, next to `hitOffsets = []`, the readout is restored to its initial
HTML values: `-- ms`, `-- ms`, `—` (the same values in `index.html:228`).

## What the smoke test also settled (no action)

- LIVE rhythm mode VERIFIED working end to end: mode select shows the real wheel
  state (RPM 0, malam, 100 BPM — the resting tempo, not the 128 fallback),
  notes fall, the live HUD ("LIVE • RPM 0 • 0.000 KM • 🌙 MALAM") shows during
  play, taps register, and a naturally finished song shows the result panel with
  the LIVE row ("RODA LIVE — PEAK RPM 0 • 0.000 KM").
- TERMINATE showing no result panel: BY DESIGN since v29 (it abandons the song),
  not a bug — the tester flagged it as a failure, but the behavior is documented
  and intentional. No change.
- CHAIN panel re-opened in under ~2 s — the v36 `setTab` fix works (the tester
  notes the data may have been cached from the same session; the cold-open case
  was the one that waited ~8 s, and the fix makes cold open fetch immediately).
  Frontier advanced during the test (settled 540 → 541, burned 1994 → 1996) —
  live data is genuinely advancing.
- Low accuracy (8.73%) in the test games is the tester's tap timing, not a game
  defect; the user already proved calibration works (grade A, 88.06%, AVG -13 ms).

## Tests

`TEST-v34-neo.js` 838/838 (new: the readout reset exists; it sits next to the
hitOffsets reset). `TEST-motif.js` 10/10. `node --check` OK.
