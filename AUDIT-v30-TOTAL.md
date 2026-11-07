# AUDIT — Squeekchain v30 TOTAL (v29 → v30)

Date: 2026-11-07. Author: Orion (Muse). Status: built, logic-tested 121/121,
syntax OK; browser smoke test + live deploy verification follow the push.

## Why v30 exists

After v29 the user demanded a full accounting and a total upgrade in one
pass — no more staged choices. Everything still missing from the 72-screenshot
competitor analysis and from the known v29 limits is listed in this file,
built or honestly not built, with the reason.

## What v30 adds (all client-side, Rp0, no server, no transaction)

1. **Round History** — the last 12 settled 10-minute rounds (key, NAP/JOG/
   ZOOMIES, average RPM, sample count). A round is finalized once, from
   recorded samples only: when it ends while the page is open (refreshLive),
   when its prediction settles, or at boot for rounds recorded before the
   page was closed. A round with no samples is never invented.
2. **Daily Champions** — the best score of each day for this wallet (last 7
   days), recorded at finish. Shown in the menu.
3. **Send the result back** — after answering a duel, the result panel tells
   the player to send their own Duel Link back. The mechanism already
   worked (the link carries from+score; the challenger opening it records
   the result in their league); v30 surfaces it.
4. **Share result to X** — one tap opens `x.com/intent/tweet` with the
   score, grade, mode and the site URL.
5. **Full EN/ID** — the game's spoken messages (`MSG`, ~40 keys), the
   result-panel row labels (`RLBL`) and the XP/streak line are now in
   Bahasa Indonesia too. Menu labels were already translated in v29.
   Switching language re-renders the dynamic menu lines. Known limit: the
   mission texts, the calibration detail line and the away summary stay
   English (they are generated per-day / per-load text, not static labels).
6. **Tutorial** — a HOW TO PLAY panel at the top of the menu on first visit
   (6 steps, EN+ID), dismissible, re-openable with [ HOW TO PLAY ].
7. **Volume slider** — 0–100%, persisted in `sqk30:vol`; master gain is
   vol% of 0.4. Mute now goes through the slider value.
8. **Haptic feedback** — `navigator.vibrate` on hits (12 ms PERFECT, 6 ms
   other hits, 30 ms on MISS), guarded by try/catch. Phones only.
9. **Achievement XP** — unlocking an achievement now pays +25 XP each
   (awarded inside `checkAchievements`, so predictions that unlock ORACLE
   pay it too). The XP line on the result panel is updated with the amount.
10. **While You Were Away, upgraded** — the summary now also lists the
    wheel rounds that settled since the last visit (max 3), or says no
    rounds were recorded. Only recorded rounds are listed.
11. **Past bosses** — the last 3 weekly bosses, from the same deterministic
    spec (`weeklySpecFor(weekKey)` — the old `weeklySpec()` is now a
    wrapper, same output for the current week).
12. **Richer OBS overlay** — `?overlay=1` now also shows the ZOOMIES state
    and Squeektoshi's current state (running/napping/offline).

## What was NOT built, honestly

- **Global leaderboard and cloud save.** Impossible without a server: all
  scores/XP/streaks live in `localStorage`. A leaderboard that pretends to
  be global while being local would be a lie. This needs a backend decision
  (hosting, cost, moderation) — it is not a file edit.
- **Garden/idle clone, on-chain features, betting/token rewards.** Out of
  scope for a rhythm game; betting and token rewards carry real risk.
- **Full ID for mission texts and the calibration detail line.** Noted as a
  known limit in item 5 above.

## v29.2 live verification (closed in this pass)

- Sync record `squeekchain-v29.muse-github-snapshot-sync.json` now has 14
  entries; the v29.2 entry (commit `ef95edbc`, `script.js` only) was
  appended 2026-11-07 ~13:47 WIB.
- Live check 2026-11-07 ~13:47 WIB: raw GitHub `script.js` contains
  `validRivalName(qf)` (1×) and `escHtml(r.rival)` (1×); the site serves
  HTTP 200, 17,137 bytes, v29 MEGA, meta tag present; README last line is
  the Genesis proof; TXT record verified via Google DoH. All 3 Genesis
  proofs intact.

## Tests

- `node --check script.js` — OK.
- `/tmp/v30-total-test.js` — **121/121 passed**. Extracts the real
  functions from `script.js` (localStorage/document stubs) and covers:
  v29 regressions (rounds, ISO week, live BPM, race distance, duel link,
  i18n keys, achievements, XP formula, fever, practice, v28 regressions,
  wiring, v29.2 security), plus v30: MSG/RLBL completeness in both
  languages, msgf substitution, round-history finalization + cap 12,
  daily champions (best-of-day), weeklySpecFor determinism, share-to-X
  URL, volume gain (80% → 0.32, 0% → 0, muted → 0), tutorial show/hide +
  persistence, all 15 new element ids in HTML and referenced in JS, no
  stale "v29 MEGA" in `index.html`, Genesis meta tag present, README last
  line is the Genesis proof.
- One test failure found during the run (a wiring assertion that demanded a
  JS reference for the always-visible `roundHistBox`/`champBox`
  containers) was a test bug, not a code bug — fixed in the test, 121/121
  after.

## Known limits carried over from v29 (unchanged)

- Predictions settle only from samples this browser recorded; a round with
  no samples settles as NO DATA (no XP lost).
- The Duel League trusts the score carried in the duel link itself (a
  friendly local table); the rival name is validated (`validRivalName`) and
  escaped (`escHtml`) — the v29.2 XSS fix.
- The away summary renders once per page load; switching language does not
  re-render it (it would reset the last-visit marker).
- The browser smoke-test agent occasionally misreads on-screen text (e.g.
  it read the CALM 100 BPM button as "0 BPM" in v27/v28/v29); file-level
  checks are the ground truth for those labels.

## Files changed

- `index.html` — version v30 TOTAL, tutorial box, round-history box,
  champions box, boss history line, volume slider, HOW TO PLAY button,
  Share-to-X button, rival-back message, overlay ZOOMIES + pet lines.
- `style.css` — range-input styling, tutorial box border.
- `script.js` — round history, daily champions, MSG/RLBL (full EN/ID),
  tutorial, volume, haptics, achievement XP, away-rounds, past bosses,
  richer overlay, share-to-X, rival-back message.
- `README.md` — v30 features; Genesis proof line untouched, still last.
