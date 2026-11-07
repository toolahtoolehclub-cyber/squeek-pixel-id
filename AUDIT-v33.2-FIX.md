# AUDIT — v33.1 → v33.2 FIX

Date: 2026-11-07. Fixes from the v33.1 browser smoke test (ran 16:40–16:42
WIB, 1 guest game, score 2300, grade D). UI label stays "v33 NEO+".

## What the smoke test found (verified against the code)

1. **The audio line STILL said RUNNING while paused** — "AUDIO: BERJALAN
   • 111 BPM • AC: paused". My v33.1 fix only changed the `{state}`
   placeholder (the AC state). The template's leading word is a literal
   in the template itself: `'AUDIO: BERJALAN • {bpm} BPM • AC: {state}'`.
   FIX: the template now has a `{run}` placeholder
   (`'AUDIO: {run} • {bpm} BPM • AC: {state}'`) with new MSG keys
   `audioRunning` (RUNNING / BERJALAN) and `audioPaused` (PAUSED /
   DIJEDA). play() passes RUNNING, pauseGame() passes PAUSED, resumeGame()
   passes RUNNING. Both languages, test-enforced.
2. **The song name was cut off on the result card** — "F# Harmonic Minor
   • \"Ember Harmoni…" (the closing `c Minor"` missing). Cause: v33.1
   lengthened the anthem value to key + scale + name (44 chars) but the
   card's `detail()` still sliced values to 34. FIX: the anthem value is
   now name + key only (`"Ember Harmonic Minor" • F#`, 26 chars — the
   scale is inside the name, so nothing is lost), on the result panel
   row, the result card row AND the ID card row (which had the same
   43-char truncation, untested because no wallet was entered). The
   card's detail slice is also widened 34 → 40 as margin (40 chars at
   12px fits without touching the labels).
3. **The grade was cut off at the top when the result appeared.** The
   v33.1 sticky header now overlaps the top ~60px of a panel that is
   scrolled to `block: 'start'`. FIX: `#gamePanel` and `#resultPanel`
   have `scroll-margin-top: 76px`, so auto-scroll stops below the header.

## What the smoke test confirmed working in v33.1

- Song name in the menu ("Void Phrygian"), in the result panel and on
  the card. Tab title "SQUEEKCHAIN // v33 NEO+".
- Sticky header + gear visible during play; pause works ("SYSTEM
  PAUSED", button becomes [ LANJUT ]).
- Score counts up (observed 1938 → 2300, then stable).
- Mission rows readable on the solid result panel — no background bleed.
- GENERATE ID CARD without a wallet shows "BUTUH WALLET YANG VALID
  UNTUK ID CARD." in the result panel — no more silent failure.
- Gold "★ NEW BEST! ★" ribbon under the grade on the result card.

## What the smoke test got WRONG (checked — do not repeat)

- The "song mismatch" (menu "Void Phrygian" 121 BPM, NOTES: 98 vs
  result "Ember Harmonic Minor" F#, 111 BPM, 110 judged) is BY DESIGN:
  FREE re-rolls a fresh random seed per game, so the preview anthem and
  the played anthem are different songs. Same for the note counts. Known
  since v26; the agent keeps flagging it.
- ">> LAGU:" instead of ">> ANTHEM:" is just the Indonesian translation
  of the same prefix, not a missing label.

## Tests

`/tmp/v33.2-neo-test.js` — **731/731 passed** (all v33.1 checks + v33.2
wiring: `{run}` template, audio run words, name + key anthem rows,
detail slice 40, scroll-margin). `/tmp/v33-motif-test.js` — **10/10
passed** (unchanged engine). `node --check script.js` OK.
