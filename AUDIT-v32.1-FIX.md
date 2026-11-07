# AUDIT — v32 NEO → v32.1 FIX

Date: 2026-11-07. P0 — the site was completely unusable: the music splash
never closed, so nothing behind it could be tapped.

## The bug

`Uncaught ReferenceError: Cannot access 'MSG' before initialization` on
every page load. The v32 translation work changed `initGL()` to build its
status line with `msgf('glOk', …)` — but `initGL()` runs at load (top-level
call, ~line 240 in the old file) while `const MSG` was still declared
mid-file (~line 1421). A `const` in that state is in the temporal dead
zone: any read throws, the whole script dies at that line, and none of the
`bindClick` handlers at the end of the file ever get registered — so the
splash buttons did nothing, the dialog never closed, and the menu behind
it was unreachable. Found by the v32 browser smoke test (which could not
get past step 1); the same test confirmed the NEO header, text-only tabs
and the PLAY panel (LATENCY row, [ CALIBRATE ]) all rendered correctly
behind the dimmed dialog.

## The fix (script.js only, no HTML/CSS change)

The whole i18n block — `const MSG` + `msg`/`msgf`, `const RLBL` + `rl`,
`const I18N`, `let lang` — moved to the top of the file, right after the
`saveJSON` helper (MSG now at line 56; the `initGL()` call is at line 528).
No logic changed, no string changed. The stale comment above the I18N
block ("menu labels only; dynamic game messages stay English") was
corrected to say both are translated.

## Tests

`node --check script.js` OK. `/tmp/v32-neo-test.js` — **655/655 passed**
again after the move (ids, i18n completeness in both languages, NEO CSS,
performance wiring, storage keys). The test suite cannot catch this class
of bug (it reads the file as text, it does not execute it) — the real
verification is the browser smoke test, re-run after this fix.
