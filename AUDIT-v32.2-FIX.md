# AUDIT — v32.1 → v32.2 FIX

Date: 2026-11-07. Two small real findings from the v32.1 smoke test
(15:28–15:31 WIB, which otherwise PASSED: splash closes, slim header,
settings sheet complete, full ID translation verified with exact quotes,
all 5 text-only tabs work, guest game runs smooth with no lag, result
panel fully Indonesian, no page errors).

## Fixed

1. **Stale mode banner.** Switching LIVE → FREE left the yellow
   "MODE LIVE AKTIF — TEMPO LAGU MENGIKUTI RODA HAMSTER ASLI…" banner in
   `#message`, because `setMode()` only called `say()` for live/race/daily
   and said nothing for free. Now switching to FREE says the new
   `modeFree` message (EN/ID), so the banner always matches the current
   mode.
2. **Latency row wraps.** "LATENSI: 0 ms" wrapped onto two lines
   ("LATENSI: 0" / "ms") in the PLAY tab. `#latVal` now has
   `white-space: nowrap`. (The missing "+" the report noted is not a bug:
   offset 0 displays as "0 ms", consistent with the ME tab's
   "OFFSET: 0 ms" — the "+0 ms" in my interim message was my wording.)

## Investigated, NOT bugs

- **Menu preview vs result anthem name (G Phrygian 121 BPM, 73 notes vs
  A Minor Pentatonic, 79 judged).** By design since v26, documented in
  the v30 audit: FREE mode rolls a fresh random seed on every game
  (`seedKeyFor('free')` = `FREE-<random>`), so the song you play is never
  the wallet-seed anthem the menu preview shows. The preview is "your
  anthem from your wallet"; the game is a new roll each time. Changing it
  would change the game, so it stays.
- **Duel-link box still shows the placeholder after a game.** By design
  (verified in v31): the link appears only after tapping [ TAUTAN DUEL ]
  (`shareDuel` runs on tap). The agent did not tap it.
- **76 MISS in the agent's game (AVG +57 ms).** The agent tapped only 15
  times for a 79-note song and its taps averaged 57 ms late — the misses
  are the agent's timing, not the game: the song ran smooth with no lag
  and the audio status read "BERJALAN • 121 BPM". The +57 ms average also
  proves the precision tracker works; a human player calibrates it away
  with the new [ KALIBRASI ] button.
- **Menu opened on the ME tab / "2 games today".** Expected: the last tab
  is remembered (`sqk31:tab`) and the games are leftover localStorage from
  the earlier v30/v31 smoke tests in the same browser profile.
- **Result panel taller than the viewport.** The panel scrolls like the
  menu does; left as is.

## Tests

`/tmp/v32-neo-test.js` — **658/658 passed** (655 v32 checks + 3 new:
latVal nowrap, modeFree wiring, modeFree key in both languages).
`node --check script.js` OK.
