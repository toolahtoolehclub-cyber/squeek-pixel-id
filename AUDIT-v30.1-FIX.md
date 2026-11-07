# AUDIT — Squeekchain v30.1 FIX (v30 → v30.1)

Date: 2026-11-07. Author: Orion (Muse). Status: built, logic-tested 128/128,
syntax OK; live deploy verification follows the push.

## Found by the v30 browser smoke test (2026-11-07 14:08–14:11 WIB)

The smoke test passed overall (all 6 new v30 elements present, EN/ID toggle
works, guest game runs, result panel shows, no page errors). Two real small
bugs and four non-bugs came out of it.

## Fixed

1. **Boss box stayed English in ID mode.** `renderBossBox()` wrote the boss
   line and the "PAST BOSSES:" line as hardcoded English strings, so switching
   to Bahasa Indonesia left them untranslated. Fixed: both lines now come from
   `MSG` (`bossLine`, `pastBosses` — both languages), and `renderBossBox()` is
   already called by `applyLang()`, so the language switch re-renders them.
2. **"NEW HIGH SCORE!" for a score of 0.** On a first-ever game, `isNew` was
   true (no previous best), so a 0-point game was celebrated as a new high
   score. Fixed: the label now shows only when `isNew && G.score > 0`; with
   no previous best and a 0 score the line is empty (null-safe — the old code
   would have read `prev.score` on a null `prev` in that branch).

## Investigated, NOT bugs

- **"NOTES: 73" in the menu vs 65 MISS in the result.** The menu preview
  anthem (wallet seed) had 73 notes; the played FREE song uses a fresh random
  seed each game (`seedKeyFor('free')` = `FREE-<random>`), and that song's
  chart had 65 notes — all 65 were judged (65 misses, 0 hits). No notes were
  lost; the two numbers describe two different anthems by design. The result
  panel counts the played song only.
- **TERMINATE shows no result panel.** By design since v26: TERMINATE abandons
  the song (no XP, no record) and returns to the menu. The result panel only
  appears when a song finishes naturally.
- **Round History shows 5 entries, not 12.** By design: the box holds up to
  12 settled rounds, but only rounds this browser recorded are listed. The
  smoke-test browser had recorded 5.
- **"CALM 76 BPM" in the smoke-test report.** The agent misread the button;
  the live HTML says "CALM 100 BPM" (same misread pattern as v27/v28/v29).
  File-level checks are the ground truth for that label.
- **Footer query-param hints.** By design: the footer documents the deep
  links (`?daily=1`, `?live=1`, `?race=1`, `?challenge=...`, `?overlay=1`).
- **"ACC 100.0%" truncated at game start.** Unverified cosmetic note from the
  smoke-test agent; could not be confirmed from the report alone, so nothing
  was changed on its basis.

## Tests

- `node --check script.js` — OK.
- `/tmp/v30-total-test.js` — **128/128 passed** (121 v30 tests + 7 new:
  `bossLine` msgf in EN and ID, `pastBosses` in ID, `renderBossBox` uses
  `msgf('bossLine')` and `msg('pastBosses')`, the `isNew && G.score > 0`
  guard, and the null-safe `bestIs` fallback). MSG completeness still holds
  with the two new keys in both languages.

## Files changed

- `script.js` — boss-box translation, best-message guard.
- `AUDIT-v30.1-FIX.md` — this file.
