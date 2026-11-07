# AUDIT — v32.2 → v33 NEO+

Date: 2026-11-07. A comprehensive upgrade answering the user's phone
screenshots + questions (15:46–15:56 WIB). Every complaint was verified
against the v32 code before fixing — none of them was imaginary.

## What was wrong (verified in code)

1. **GENERATE ID CARD "kembali".** `resultCardBtn`/`toCardBtn` jumped to
   `mainPanel` + PLAY tab to show the card (`setTab('play');
   show('mainPanel')`). By design, but bad UX: the result vanished.
2. **Result card plain + empty.** `drawResultCard` drew a 400×600 canvas
   whose content ended around y=350 — the bottom half was black void —
   plus a `CREATOR: pancigoreng` line at the bottom. The ID card had the
   same disease (content to y~510 of 600, creator line at the bottom).
3. **Creator on the result card.** The user: it does not belong there,
   it is over the top. (The old "creator everywhere" rule is superseded
   for the cards; the page footer still says BUILT BY pancigoreng.)
4. **ULTRA "tidak jalan" saat main.** Intentional in v32: `pauseGL()`
   freezes the WebGL background while playing. But the WebGL uniforms
   `glShockwave`/`glGlitch` are exactly what made taps feel alive — so
   during play the game went visually dead. The tap itself was fine.
5. **Settings gear dead during play.** `#settingsSheet` +
   `#settingsBackdrop` lived INSIDE `#mainPanel`, which is hidden while
   playing. The gear is in the header (visible during play) but the
   sheet could never appear.
6. **Manual scroll to play.** `play()` never scrolled — the page stayed
   where the PLAY button was, so the score row and the lanes were below
   the fold until the user scrolled once.
7. **Stats truncated.** `accVal` was `accuracy().toFixed(1) + '%'` in a
   16px Press Start 2P stat box with `text-overflow: ellipsis` — "58.1%"
   became "58...".
8. **ID card cannot be closed/minimized.** `#cardArea` had no close
   control and, once unhidden, stayed visible forever.
9. **Songs feel the same.** Only 5 scales in the whole game
   (2–3 per genre). BPM already jittered ±10; the scale pool was the
   bottleneck.
10. **Gameplay flat.** The effects existed but were too weak to see:
    8 particles of 4×4 px, lane flash max alpha .25, judgement text
    always dead-center at 16px, `glShockwave`/`glGlitch` dead with
    WebGL paused, flat `#050505` canvas background.

## What v33 does

- **Card overlay** (`#cardOverlay` + `#cardBackdrop` + `#cardBar`):
  the ID card and the result card open ON TOP of whatever panel is
  showing, with ✕ close and — minimize (a slim bar at the bottom
  re-opens it). Closing returns to the panel underneath, untouched.
  The sheet and the overlay both live outside `#mainPanel` now.
- **Redesigned cards** (both 400×560, shared `cardFrame()`): gradient
  hairline border + corner ticks + gradient header band, compact
  layout with hairline dividers, no void, footer is only
  `squeekpixel.web.id` + timestamp. ID card: avatar in a framed badge
  with LV + XP line, 2-column stat grid. Result card: big glowing
  grade, score, ACC + MAX COMBO, 4-column judgement breakdown
  (PERFECT/GREAT/GOOD/MISS), detail rows label-left/value-right.
  No CREATOR line on either card.
- **Settings during play:** opening the sheet mid-song pauses the
  game (`pausedBySettings`); closing resumes only if we paused it.
  The HOW TO PLAY button no longer abandons a running song.
- **Auto-scroll:** `play()` scrolls the game panel into view;
  `finish()` scrolls the result panel into view. The PAUSE /
  TERMINATE row moved above the canvas so it is reachable mid-song.
- **Stats:** ACC is an integer now; stat values shrink to 13px at
  ≤480px.
- **In-canvas effects (cheap — same rAF, no WebGL, no new DOM):**
  14 particles of 6px per hit, shockwave rings, lane flash
  .10 + f×.45, judgement text at the hit lane (PERFECT/GREAT/GOOD),
  miss glitch bars, beat-pulse background wash, hue-tinted canvas
  background (from the anthem's hue), gold hit line in FEVER,
  float text 18px. WebGL stays paused during play (the lag fix).
- **Songs:** 10 scales (added Lydian, Mixolydian, Aeolian, Blues,
  Major), 4–5 per genre. BPM jitter already existed (±10).

## Tests

`/tmp/v33-neo-test.js` — **699/699 passed** (ids, i18n completeness in
both languages, overlay + settings placement outside mainPanel, ACC
integer, 10 scales, FX markers, scroll wiring, card frame, no creator
on the cards, no panel jump for cards). `node --check script.js` OK.
