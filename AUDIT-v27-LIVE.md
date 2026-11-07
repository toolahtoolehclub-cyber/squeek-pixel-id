# AUDIT — v26 FIX → v27 LIVE

Date: 2026-11-07. Basis: `squeekchain-v26/` copied to `squeekchain-v27/`. FREE / DAILY /
challenge modes untouched; LIVE is purely additive.

## What LIVE mode does

- New mode button **LIVE** in `#modeRow`, deep link `?live=1`.
- Before the song is built, the game fetches `https://api.squeekchain.com/v1/status`
  (same endpoint the ID Card already used, 6 s timeout via `tfetch`).
  - `measurement.rpmMilli / 1000` = live RPM. `measurement.coreStatus` + RPM decide
    day (running) vs night (resting). `measurement.distanceMm / 1e6` = live km.
  - Tempo: resting hamster (RPM 0) = **100 BPM**; running = **100 + RPM, capped at 180**.
    Same 70+ RPM ZOOMIES threshold Squeek City uses.
  - At **70+ RPM ZOOMIES** starts: all hit scores ×2 while it lasts (multiplier
    applied in `judge()` on top of the combo multiplier, max ×4 total).
  - The live BPM is encoded in the seed (`LIVE-YYYY-MM-DD-<bpm>`) and `makeAnthem`
    parses it back, so a duel link replays the exact same song in challenge mode.
  - During the song the wheel is polled every 5 s (menu: every 10 s). The HUD line
    `#liveHud` shows live RPM, distance, day/night, and ZOOMIES state; the page
    theme tints day/night via `body.live-day` / `body.live-night`.
  - The result panel adds a `LIVE WHEEL` row: peak RPM, latest distance, ZOOMIES
    or OFFLINE. XP / missions / mastery flow is unchanged (LIVE runs count like
    any other run; no daily streak — that stays DAILY-only).

## Honesty rules (checked in code)

- **No fake live data.** If the wheel fetch fails at song start, the song still
  starts on a 128 BPM fallback — but the menu box, the HUD, and the result row
  all say `OFFLINE (128 BPM FALLBACK)` / `NOT LIVE DATA`. The BPM shown in the
  menu preview is the fallback BPM, not a live one.
- **Tempo is sampled, not re-timed mid-song.** The chart is built once from the
  BPM at song start; later polls only update the HUD, ZOOMIES, and day/night.
  Retiming a running chart would desync notes — deliberately not done.
- **Read-only.** LIVE mode only GETs the public status API. No wallet connection,
  no signature, no transaction, no chain switch. Same as the rest of the game.

## Genesis proofs — untouched

- `<meta name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7">`
  still in `index.html` `<head>` (line 8).
- `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7` still the last line of
  `README.md` under the Genesis verification comment.
- DNS TXT `_squeekchain` untouched (not part of this repo).
- `CNAME` still `squeekpixel.web.id`. GitHub Pages deploys are atomic: visitors
  keep seeing v26 until the v27 build is ready, so no broken mid-deploy state.

## Known limits (carried over from v26, not fixed here)

- Daily Anthem is only the same song if genre + difficulty match.
- LV5–LV8 have no unlocks yet.
- No PRECISION offset calibration.

## Test notes

- `node --check script.js` passes (syntax).
- Logic test (`/tmp/v27-live-test.js`, extracts the real functions from `script.js`,
  no copies): **14/14 passed** — BPM mapping (0→100, 30→130, 70→170, 200→180 cap,
  NaN→100), LIVE seed round-trip (BPM encoded in the seed survives `makeAnthem`,
  same seed = identical chart, so duel links replay the exact song), DAILY genre
  BPM range unchanged, `seedKeyFor('live')` encodes the live BPM and falls back
  to 128 when the wheel is offline or no snapshot exists yet.
- Live API shape verified 2026-11-07 ~11:50 WIB: `measurement.rpmMilli`,
  `coreStatus`, `distanceMm`, `freshness` all present; hamster IDLE, RPM 0 at check
  time (so a live song built then would be CALM 100 BPM, night theme).
- End-to-end play test on the live site after deploy: open `?live=1`, confirm the
  LIVE box shows real RPM/distance, start a song, confirm the HUD line updates
  and the result row shows the LIVE WHEEL summary.
  Result 2026-11-07 ~11:55 WIB: PASSED — hamster was RUNNING at 71 RPM, menu box
  showed "RPM 71 • 2.522 KM • DAY • SONG 171 BPM • ZOOMIES ×2", song started at
  169 BPM (fresh sample, RPM 69), live distance rose 2.530 → 2.540 KM during
  play, no errors, menu works after TERMINATE. One real bug found: the menu
  anthem line stayed on "WHEEL OFFLINE • 128 BPM FALLBACK" because `preview()`
  ran before the first wheel fetch resolved and was never re-run — fixed in
  v27.1 (`refreshLive()` now calls `preview()` when no game is running).
  (The report's "CALM 60 BPM" was a misread; the button is CALM 100 BPM.)
