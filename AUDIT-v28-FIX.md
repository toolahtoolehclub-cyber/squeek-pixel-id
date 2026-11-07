# AUDIT v28 FIX — P0 fixes (PRECISION calibration, Daily consistency, LV5–LV8 unlocks)

Basis: v27 LIVE. Date: 7 Nov 2026. Source: the three known v26 gaps + the
72-screenshot competitor analysis (`ANALISIS-KOMPETITOR-72-SCREENSHOT.md`, P0).

## 1. PRECISION offset calibration — NEW

Problem: the game showed LAST HIT / AVG timing error (`#precisionBox`) but the
player could do nothing about a consistent early/late bias. Worse, the sign
was inverted: `judge()` passed `(target.t - st)` to `updatePrecision`, so a
tap *before* the note arrived displayed as `+X ms / LATE`.

Fix:
- `offsetMs` setting, stored per device in `sqk28:offsetMs` (not per wallet —
  it is a property of the device), range ±150 ms, rounded to 5 ms.
- `judge()` now uses `st = songTime() - offsetMs / 1000`: a positive offset
  (player taps late on average) makes the game judge the tap as if it came
  earlier. The miss window in `loop()` still uses the raw song time — a note
  that has visibly passed the line is a miss, even with a big offset.
- Sign fixed: `updatePrecision((st - target.t) * 1000)` — positive now really
  means the player tapped LATE, matching the LATE/EARLY label. Note: history
  rows written by v27 hold the inverted sign; they roll out of the last-10
  list within 10 games.
- Menu panel `#calibBox`: manual −5/+5 ms buttons, and AUTO-CALIBRATE: 8
  metronome beats at 100 BPM scheduled on the audio clock (same clock the
  game judges on), player taps the big button (or Space) on each beat. Taps
  further than 250 ms from a beat are ignored, one tap per beat, needs ≥4
  good taps. Offset = median tap error, clamped ±150, rounded to 5 ms.
  Aborts with a message if muted or the audio is not running.
- Result panel gains a SETUP row: lanes, mirror, offset used, average timing
  error of the song — and a `TRY CALIBRATION` hint when |avg error| ≥ 30 ms.

## 2. Daily fully consistent — FIXED

Problem (v27): `seedKeyFor('daily')` was date-only, but `makeAnthem` used the
player's chosen genre/diff — so the "same song for everyone" was only true
when genre+diff matched. The daily box even said so.

Fix:
- `dailySpec(date)` derives genre+diff from the date hash
  (`DAILY-GENRE-<date>` / `DAILY-DIFF-<date>`). Only the 3 base genres are
  used — VOID is a LV5 unlock and must never be the daily song for a player
  who has not unlocked it.
- `applyDailySpec()` is called on entering Daily mode, on play, on preview,
  and on `?daily=1` load. Genre/diff buttons are disabled (locked row) while
  in Daily mode. The daily box and the mode message now name today's spec
  (e.g. `TODAY: SYNTH / NORMAL`).
- Duel links of a daily song still replay identically (genre/diff travel in
  the URL, and they equal the daily spec).

## 3. LV5–LV8 unlocks — NEW (real, not labels)

LV1–LV4 already evolved the avatar (glasses LV2, hat LV3, crown LV4).
LV5–LV8 had nothing. Now:

- **LV5 — VOID genre.** New genre (`bpm 150`, Phrygian / Harmonic Minor),
  dark and fast. Button in the genre row, locked (`VOID 🔒 LV5`) until LV5;
  clicking it locked explains the requirement.
- **LV6 — 4 lanes.** Menu toggle `LANES: 3/4` (locked until LV6). The chart
  generator, draw loop, flash array, pointer and keyboard input are all
  lane-count aware (`G.lanes`, `LW = GW / lanes`). 4th lane = ↑ / F (arrows
  and A S D keep their 3-lane meaning). 4th lane colour orange. Daily stays
  3 lanes (canonical). Duel links carry `&lanes=4`; a duel unlocks 4 lanes
  for that song even if the receiver is below LV6.
- **LV7 — Mirror mode.** Menu toggle `MIRROR: OFF/ON` (locked until LV7).
  The chart is flipped after generation (`lane = lanes-1-lane`). Duel links
  carry `&mirror=1`; same duel-unlock rule as lanes. Daily never mirrors.
- **LV8 — Gold avatar.** Gold fur/accent + gold frame on the avatar preview
  + `GOLD` tag in the level label. Shows on the ID Card automatically.
- Menu `#unlockBox` shows the roadmap (LV5–LV8, ✓/🔒). The level-up message
  names the unlocks gained (`LEVEL UP! UNLOCKED: NEW GENRE: VOID`).

## Tests

- `node --check script.js` — OK.
- `/tmp/v28-fix-test.js` — **40/40 passed**, extracting the REAL functions
  from script.js (no copies): offset clamp (0/±150/rounding), level
  thresholds, UNLOCKS table, dailySpec determinism + never VOID, daily
  anthem identical across re-applies, genre/diff selection provably changes
  the anthem (the v27 bug), VOID genre (bpm 140–160), 4-lane chart (lanes
  0..3, uses lane 3, same times/count as 3-lane for the same seed), mirror
  (exact lane flip, 3- and 4-lane), LIVE seed/BPM mapping unchanged.

## Not changed

- LIVE mode (tempo from the wheel, ZOOMIES, day/night, HUD) — untouched.
- XP thresholds, missions, streak, mastery, ID Card, duel link format
  (only `&lanes`/`&mirror` appended when active), wallet connect.
- Genesis proofs: meta tag in `index.html` head, README line, DNS TXT —
  all preserved (see deploy verification).

## Known notes

- Old mastery history rows (v27) carry the inverted avg-offset sign; they
  age out within 10 games.
- A tap more than the good window late is a miss even with a large offset
  (the miss check uses raw song time) — by design, the note has visibly
  passed the line.
