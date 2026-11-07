# AUDIT — v30 TOTAL → v31 ARCADE

Date: 2026-11-07. Direction chosen by the user from 4 generated mockups: **No. 1 — Arcade Cabinet**.

## The problem (user's words)

The design "tidak flexible dan cenderung panjang" — the menu was one long single column
that looked like a simple web page, not a game. Honest cause: every version since v24
appended new boxes to the same stack instead of reorganizing the layout. The pixel
styling existed (neon, Press Start 2P, CRT, WebGL background) but the layout had no
hierarchy, no hero, and never rearranged on wide screens.

## What changed

- **Marquee** — the header is now the cabinet's lit sign: SQUEEKCHAIN in big pixel
  letters with the neon flicker, a yellow subtitle, and two rows of 12 chasing light
  bulbs (green/yellow alternating, 1s steps animation).
- **Bezel** — `#mainPanel` has a double frame (green outline + pink hard shadow +
  green glow + inner shadow) so the menu reads as an arcade screen.
- **Tabs** — the long scroll is gone. 5 arcade buttons: PLAY / DAILY / LIVE / LEAGUE /
  ME. Grouping:
  - PLAY: wallet, avatar, genre, difficulty, options, mode, mode context boxes
    (race/live/daily), music, volume, practice/OBS/how, PLAY + ID CARD, messages, card.
  - DAILY: tutorial, Weekly Boss, Daily Champions, Mastery, While You Were Away.
  - LIVE: Wheel Call, Round History.
  - LEAGUE: Duel League, Achievements.
  - ME: PRECISION calibration, unlocks.
- **Chunky arcade buttons** — tab buttons are 3D (5px bottom shadow, press = translate
  down), each tab has its own accent color; the active tab is filled + glowing.
- **START button** — `#playBtn` is now a big pulsing attract-mode button.
- **Coin slot footer** — "🪙 INSERT COIN • 1 PLAYER • BUILT BY pancigoreng • v31 ARCADE",
  gold border, dark slot background. All footer deep-link hints kept.
- **Side art** — on screens ≥1000px, fixed side panels with a bobbing 🐹 / 🎵 and
  vertical SQUEEKCHAIN / PIXEL ID text. Pure CSS/emoji, no images. Hidden on mobile.
- **Splash** — added "🪙 INSERT COIN • PRESS START" line.
- **Responsive** — mobile: cabinet fills the screen, tabs one row of 5. Desktop
  ≥900px: cabinet widens to 520px + side art. ≤360px: smaller marquee + tab text.

## What did NOT change (deliberately)

- Every v30 feature, id, and localStorage key is untouched: `sqk24`/`sqk28`/`sqk29`/
  `sqk30` keys still hold the user's XP, streaks, missions, rounds, champions, and
  achievements. The only new key is `sqk31:tab` (last tab, per browser).
- All 3 Genesis proofs untouched: TXT record, page meta tag, README last line.
- No new images, no AI art in the game, no server, no transactions. All art is the
  game's own code + CSS + emoji.
- Tab buttons live inside `#mainPanel`, so they hide with the menu during play
  (`show()` still toggles the same 3 panels).

## JS changes (minimal, 4 edits)

- `setTab(name)` + wiring at boot: toggles `.hidden` on the 5 panels, `.active` +
  `aria-selected` on the buttons, persists `sqk31:tab`, falls back to `play` for
  unknown names. Restores the last tab at boot.
- `toCardBtn` and `resultCardBtn` now call `setTab('play')` first, because the ID
  card lives in the PLAY tab.
- `showTutorial()` now calls `setTab('daily')` first, because the tutorial lives in
  the DAILY tab.

## Tests

`/tmp/v31-arcade-test.js` — 208 checks (structure, ids, tab grouping, CSS, setTab
logic with stubbed DOM, Genesis proof). Two initial failures were test bugs, not
code bugs (the meta description mentioned "v30 TOTAL" once; the bulb counter also
counted the 16 vizBars bars). After fixing the test: all pass. `node --check`
on `script.js` passes.

## Risks / known limits

- The tab bar is 5 buttons in one row; on very narrow screens (≤360px) the labels
  shrink to 8px — still readable, but tight.
- Users who had the page open on v30 will land on the PLAY tab on first v31 load
  (no `sqk31:tab` saved yet) — correct default.
- The mockup images used to choose this direction were AI-generated concepts, not
  real screenshots; the build uses only real game art and real text.
