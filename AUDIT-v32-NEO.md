# AUDIT — v31 ARCADE → v32 NEO

Date: 2026-11-07. Built after the user played v31 on their own phone and
reported three real problems: (1) the language switch is incomplete — big
parts of the UI stay English in ID mode; (2) the game lags on their phone —
taps land as MISS because the delay is inconsistent; (3) too many buttons,
layout looks old/newbie, not minimal or futuristic. All three are valid.

## 1. The language switch was genuinely incomplete (v30's "full EN/ID" was not full)

The v30 work translated the MSG dict (spoken messages), the result-panel
labels (RLBL) and 24 menu labels (I18N). What it did NOT cover:

- Static HTML: the wallet warning, the LIVE and RACE explainer paragraphs,
  the Wheel Call rules, the duel placeholder, the diary placeholder, the
  hint line, the precision labels, the calibration texts, the volume label,
  the splash texts, the footer, the empty states, the result buttons
  (DUEL LINK / SHARE TO X / EXIT TO MENU), the practice button.
- Dynamic builders: the anthem line, the music-mode button, the daily
  title/info/streak/freeze lines, the mastery stats, the unlock list, the
  options row (MIRROR ON/OFF), the offset line, the calibration prompts,
  the round line, the pet line, the last-race line, the away line, the
  league rows, the round-history rows, the live HUD, the OBS overlay lines,
  the game-audio status, the pause/resume buttons, the WebGL status lines,
  the quality message, ~20 `say()` strings (wallet connect, locks, audio),
  the mission texts, the achievement descriptions, the diary dates.

Fix: ~90 new MSG keys + ~35 new I18N keys, all EN + ID. `applyLang()`
now re-renders every dynamic line (preview, daily box, mastery, unlocks,
practice button, music button, offset line, live box, away line — the away
line reuses the first-load `lastVisit` via a per-wallet cache, so
re-rendering it on a language switch no longer resets it). Diary and away
dates now use `id-ID` locale in ID mode. The ID Card canvas keeps its
English labels by design (it is a shareable card for the Genesis board).

Verified by test: every `data-i18n` key in the HTML, every `msg()` /
`msgf()` key, every `rl()` key and every `I18N[lang].x` use exists in both
language dicts (static analysis in `/tmp/v32-neo-test.js`).

## 2. The lag: not a bug in the tap button — a real mobile latency problem

What the code already did right (checked, not guessed):

- Taps use `pointerdown` on the canvas (`{ passive: false }`) — immediate,
  no 300 ms click delay. The AudioContext is created with
  `latencyHint: 'interactive'`.
- Judgement uses the audio clock (`songTime() = ac.currentTime - G.start`)
  with windows PERFECT ±45 ms / GREAT ±90 ms / GOOD ±135 ms, and the drawn
  note positions use the same clock — so the visual and the judgement agree.

Why it still misses on a phone:

- The audio the player hears lags the audio clock (Android output latency,
  typically 50–200 ms, varies with device state) — so taps timed to the
  heard beat land systematically late, and the delay varies ("jeda tidak
  sama"). That is exactly what the PRECISION offset calibration measures
  and compensates — but it was buried in the ME tab and the game never
  pointed the player at it. (The result panel already appends
  "• TRY CALIBRATION" when the average tap offset is ≥ 30 ms, but it is a
  small line most players never notice.)
- The game loop competed for frames with a continuously-running fullscreen
  WebGL shader, several CSS animations (grid pan, orbs, sweep, bulb chase,
  flicker), and per-frame work: `getAudioLevel()` (full analyser array)
  plus `updateViz()` (16 DOM style writes) on EVERY frame. On a low-end
  phone that drops frames, notes jump between frames and the tap lands
  outside the window.

Fixes (v32):

- **Performance mode while playing**: `startGame` adds `body.playing` and
  calls `pauseGL()`; `stop()`/`finish()` remove it and call `resumeGL()`.
  CSS hides `#bg-gl`, `#bg-anim`, `#crt` and pauses every decorative
  animation during play (hit-pop and shake feedback are explicitly kept).
- **Viz/analyser throttled** to once per 100 ms instead of every frame.
- **Calibration surfaced**: a LATENCY row in the PLAY tab shows the current
  offset and a one-tap [ CALIBRATE ] button that starts auto-calibration
  right there. The ME tab keeps the full calibration box.
- Judgement windows are unchanged (no balance change); the fix is frames
  + calibration, not easier judging.

## 3. The design: arcade was the wrong language

v31's chunky retro cabinet (marquee, bulbs, bezel, hard shadows) reads as
"old" on a phone. v32 NEO is a different language: near-black background
with a faint static grid and a soft top glow, glass panels (1 px hairline
borders, 18 px radius), segmented pill controls, one accent (cyan) + one
signal (green), small-caps micro-labels, generous spacing. The header is a
slim row — wordmark + one ⚙️ gear — so the v31.1 header-overflow bug (mute
button cut off) cannot recur: there is no cramped row anymore. The tab bar
is text-only (the ⚔️ icon that rendered like a small × is gone). Secondary
controls (language, graphics, sound, volume, music mode, practice, OBS,
how-to) live in a bottom settings sheet, so the main view shows far fewer
buttons: wallet, genre, difficulty, options, mode, latency, PLAY, ID CARD.

## What did NOT change

- Every v31 id is present exactly once (test-enforced); all game logic,
  modes, tabs, boxes and storage keys (`sqk24/28/29/30`, `sqk31:tab`) are
  unchanged — no user data is lost.
- The Genesis meta tag is byte-identical; the README proof line is still
  the last line.

## Tests

`/tmp/v32-neo-test.js` — **655/655 passed**: all ids once, all 6 new v32
ids, no arcade leftovers in HTML, Genesis meta + README proof, NEO CSS
present (header, sheet, latency row, playing rules), I18N/MSG/RLBL
completeness in both languages (every `data-i18n`, `msg()`, `msgf()`,
`rl()`, `I18N[lang].x` key resolved), TUT 6+6 steps, performance wiring
(`playing` class, `pauseGL`/`resumeGL`, 100 ms viz throttle, sheet wiring,
latency button), `applyLang` re-renders, `setTab` intact, storage keys
unchanged. `node --check script.js` OK. One initial failure was a test
bug (it flagged the legitimate `🐹 SQUEEKTOSHI IS WAITING…` placeholder
as an arcade leftover) — fixed in the test.
