# AUDIT — v33 → v33.1 FIX

Date: 2026-11-07. Fixes from the v33 browser smoke test (ran 16:24–16:33
WIB, 3 guest games) + the reference-research gaps that were cheap and
safe to add in the same pass. UI label stays "v33 NEO+".

## What the smoke test found (verified against the code)

1. **BUG (P0) — BUAT ID CARD in the result panel failed silently without
   a wallet.** `generateCard()` called `say(msg('cardWallet'))`, but
   `say()` writes to `#message` in the menu panel — invisible while the
   result panel is showing. The button did nothing, three times, with no
   feedback. FIX: the result panel now has `#cardErrMsg`; when the wallet
   is invalid, the same message shows there, next to the button. The
   error is hidden again on the next game start and on a successful card.
2. **Stale browser tab title** — `<title>` still said "v32 NEO". FIX:
   title is "SQUEEKCHAIN // v33 NEO+".
3. **The gear scrolled away during play.** After auto-scroll, the header
   (with the gear) sat above the viewport, so the user had to scroll up
   to reach it. FIX: `.neo-head` is now `position: sticky; top: 0` with
   a solid background.
4. **"AUDIO: BERJALAN" stayed while paused.** `gameAudioStatus` was set
   once in `play()` and never updated by `pauseGame()`/`resumeGame()`.
   FIX: both now rewrite the line (state 'paused' / 'running').
5. **The minimize bar floated over the footer text** ("Dibuat di
   Indonesia"). FIX: `body.cardbar` adds 72px bottom padding while the
   bar is visible.
6. **The result panel was nearly transparent glass**
   (`rgba(255,255,255,.03)`) — the animated background bled through and
   washed out the mission rows (the "pink/green swoosh"). FIX: only the
   result panel gets a solid background (`rgba(5,6,7,.94)`); the menu
   stays glassy.

## What the smoke test got WRONG (checked by grep — do not repeat)

- The reported settings-sheet contents ("VISUAL FX [ON]", "MENU TEMA
  [CYBER]", "VOLUME MUSIK", "TEST / STOP / RESET / FULLSCREEN") do not
  exist anywhere in the code (0 matches). The step itself passed — the
  sheet opened during play, the game paused, closing resumed — but the
  details were invented. Same pattern as the v31 hallucination.
- "DEEP 115 BPM" does not exist either — the intro modes are only CALM
  100 and HYPE 128.
- The duel-link box staying on its placeholder after a game is BY DESIGN
  (the link is built only when [ TAUTAN DUEL ] is tapped).
- "TERBAIK: 600 (D)" in the menu vs "BEST SCORE: 0" on the card is NOT a
  mismatch: 600 is the GUEST best (leftover localStorage from the v32.1
  smoke test in the same profile — `stop()` never saves a best, so the
  terminated game did not create it), while 0 is this wallet's first
  best after a 0-score game. Different keys, correct behavior.
- "73 HIT" vs 0/106 in the result: the menu preview showed NOTES: 73
  for the preview anthem; FREE re-rolls a fresh seed per game, so the
  played song had 106 notes. By design since v26.
- The ~4–5s of still canvas after closing the settings sheet is a sparse
  part of the song (bars are quiet by design), not a freeze.
- Particles are 6px and live 0.5s — invisible in a still screenshot, but
  present in motion (lane flash + judgement text WERE confirmed visible).

## What v33.1 adds (from the reference research)

- **Song names:** every song is named from its scale + mood
  ("Neon Dorian", "Void Phrygian", "Sky Lydian"). Shown in the menu
  anthem line, the result panel, the result card, the ID card and the
  diary. Deterministic from the seed.
- **Count-up score:** the result panel's score runs up over ~700ms
  (ease-out, skipped for reduced motion). The result card reads the score
  from G, never from the animated panel text, so a fast tap can't capture
  a half-counted score.
- **NEW BEST ribbon:** the result card draws a gold "★ NEW BEST! ★"
  ribbon under the grade when the game set a new best (same condition as
  the panel's NEW HIGH SCORE line, and only when the score is > 0).
- **Motif-based songs:** the chart is now built from a 2-bar motif that
  repeats every 2 bars with small variations (15% drop, 15% degree
  shift), instead of independent random notes per step. The intro (first
  2 bars) stays sparse. Determinism is TESTED, not assumed:
  `/tmp/v33-motif-test.js` extracts the song engine and runs it in Node
  — same seed → identical chart/name/BPM, LIVE seed → BPM 128, motif
  bars 2→4 share 67% of notes, bars 3→5 share 100% (10/10 passed).
  Chart length for easy stayed sane (77 notes for the test seed).

## Tests

`/tmp/v33.1-neo-test.js` — **720/720 passed** (all v33 checks + v33.1
wiring: cardErrMsg, sticky header, solid result panel, cardbar
clearance, paused/running audio states, song names, motif markers,
count-up, NEW BEST ribbon). `/tmp/v33-motif-test.js` — **10/10 passed**.
`node --check script.js` OK.
