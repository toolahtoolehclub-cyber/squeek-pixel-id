# AUDIT — v33.2 → v34 THEMES

Date: 2026-11-07. A visual upgrade answering the user's phone screenshots
(17:49–18:02 WIB) and the official Squeekchain pixel post on X (16:16 WIB):
the game looked monotonous — every mode the same flat dark screen — and
the user asked for per-mode themes, Guitar Hero-style note shapes (a
hamster, or anything), and effects that make playing feel exciting.

## The reference

The @squeekchain X post ("TONIGHT'S STREAM IS DELAYED BY 1H 30M"): blue
pixel-grid background, yellow pixel hamster logo, chunky pixel font, black
outlines, high contrast. That is the design language v34 carries into the
game: a faint pixel grid on the canvas, and the note itself is a pixel
hamster.

## What v34 does

- **One look per mode** (`THEMES`, 7 themes): FREE = CYBER (cyan/green
  on near-black, the v33 look), DAILY = SUNRISE (gold/amber), LIVE = WHEEL
  (green), RACE = VERSUS (magenta/red), BOSS = VOID (purple), duel =
  GOLD. Each theme sets the canvas gradient, the pixel grid tint, the lane
  flash, the hit line, the beat pulse, the four lane colors, and the panel
  glow. The mode buttons in the menu wear their theme accent, and the game
  panel glows in it while playing. The theme is set in `play()` from
  `themeKeyFor(mode, boss)` and cleared in `stop()`.
- **Pixel hamster notes** (`drawHamster`, 7x7 grid: ear bumps, eyes, pink
  nose): the note is no longer a rectangle. A white dot in the middle of
  the face is the aim point — tap when it sits inside the receptor ring.
  This also fixes a real feel problem: the old rectangle's leading edge
  arrived at the hit line ~30–60ms before the judged time at slow speeds,
  inviting early taps (see the calibration note below).
- **Guitar Hero receptors**: a colored ring per lane on the hit line; the
  hamster lands inside the ring, and the ring pops (grows +8px) on a hit,
  driven by the existing `G.flash` decay. Golden notes are gold hamsters
  with a white frame; missed notes stay magenta.
- **Pixel grid**: faint grid lines every 30px across the canvas, tinted
  per theme — the poster look, ~28 extra line draws per frame (cheap).
- **ZOOMIES banner**: when the live wheel crosses 70 RPM mid-song, a
  "ZOOMIES ×2!" banner pops (the transition is detected in
  `updateLiveHud()`).
- Everything else is untouched: judgement windows, the chart engine
  (motif, determinism), the card overlay, storage keys, the Genesis proofs.

## The user's timing (from their screenshots — not a complaint, a diagnosis)

All four gameplay screenshots show taps consistently EARLY: LAST HIT
-91 / -39 / -127 ms, AVG -91 ms — and ACC 9–45% with most notes MISS.
The code is in sync (the practice stretch scales chart, drums and speed
together; `CONFIG.SPEED` is reset every `play()`), so this is the player's
systematic anticipation, not a desync. The fix is the tool that already
exists: re-run AUTO-CALIBRATE in the ME tab (8 beats). It measures exactly
this error and sets the offset; with ~-90ms of early bias, the offset
should land near -90 and the PERFECT rate should jump. The hamster's aim
dot + the receptor ring also give a clearer visual target than the old
rectangle edge.

## Build accident (disclosed)

The first `node --check` after the v34 edits failed ("Unexpected end of
input"). Cause: the `stop()` edit inserted a `//` comment in the middle of
a long single-line function — everything after it on the line, including
the function's closing `}`, became a comment. Fixed by using a `/* */`
comment instead. Lesson: never put a `//` comment mid-line in a one-line
function.

## Tests

`TEST-v34-neo.js` (in this folder, run with `node TEST-v34-neo.js`) —
**751/751 passed**: the full v33.2 suite rebuilt from scratch (the /tmp
copies were lost in a VM replacement, so the suite now lives in the repo)
plus v34 wiring checks (THEMES map, themeKeyFor, drawHamster, receptors,
pixel grid, theme assignment/clear, ZOOMIES banner, no rectangle notes
left). `TEST-motif.js` — **10/10 passed** (unchanged engine, re-run).
`node --check script.js` OK.
