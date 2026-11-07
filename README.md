# Squeekchain v33 NEO+

A pixel cyberpunk rhythm game — build an anthem from your wallet (read-only; optional wallet connect reads your address only, no signature, no transactions), play 3 or 4 lanes, earn XP, play the Daily Anthem, complete daily missions, generate your ID Card, race the real hamster in LIVE mode, and race Squeektoshi himself in RACE mode.

Built by [pancigoreng](https://x.com/pancigoreng) — Made in Indonesia.

## Play

Open `index.html` in a browser (or serve this folder), tap **▶ HYPE 128 BPM** or **▶ CALM 100 BPM**, enter a wallet address `0x...`, then **INITIALIZE RHYTHM**.

- **Daily Anthem** — the same song for everyone on the same day: genre and difficulty come from the date itself, with a daily streak (a Streak Freeze, earned by clearing all 3 missions, saves your streak after one missed day)
- **XP & levels** — LV1–LV8, your avatar evolves (glasses, hat, golden crown) — and LV5–LV8 unlock real things: VOID genre (LV5), 4 lanes (LV6), Mirror mode (LV7), Gold avatar (LV8)
- **PRECISION calibration** — manual offset ±5 ms, or AUTO-CALIBRATE by tapping 8 metronome beats; the game compensates your timing bias
- **Daily missions** — 3 random missions per day, +25 XP each
- **Mastery** — your last 10 games per wallet
- **Duel Link** — share `?challenge=...` so a friend plays the exact same song (4 lanes / Mirror / challenger score travel in the link; a duel unlocks them for that song)
- **Duel League** — local rivals table: when a friend plays your Duel Link, their result lands here
- **Opening music, 2 modes** — HYPE 128 BPM / CALM 100 BPM, switch with 1 tap in the menu
- **Moving background** — grid + orbs + sweep (still moves even if WebGL fails), QLTY ULTRA/ECO
- **LIVE — Race the Hamster** — the song's tempo follows the real hamster wheel, live from `api.squeekchain.com/v1/status`: resting hamster = CALM 100 BPM, running hamster = 100 + RPM (max 180). At 70+ RPM ZOOMIES starts and all scores double. Day follows the wheel running, night follows it resting. If the wheel is offline the song uses a 128 BPM fallback and says so — never fake live data. Deep link: `?live=1`
- **RACE — vs Squeektoshi** — a real race: your hits move you forward (PERFECT 1.0 m / GREAT 0.7 m / GOOD 0.4 m), the live wheel moves Squeektoshi. Win for +50 XP. When a new 10-minute round starts mid-song, the next note turns GOLDEN (+1000 pts, +5 m). Deep link: `?race=1`
- **Wheel Call** — predict the next 10-minute round (😴 NAP < 5 RPM / 🏃 JOG 5–69 / ⚡ ZOOMIES 70+), settled from recorded RPM samples; correct call = +40 XP
- **Achievements** — 10 named achievements, shown in the menu and on the ID Card
- **Weekly Boss** — a deterministic weekly song (always HARD); finish it to defeat the boss (+100 XP)
- **Fever** — combo 30+ = score ×1.5 until the combo breaks
- **Practice** — 60% tempo, no XP, no streak, no record
- **OBS overlay** — `?overlay=1` is a transparent live widget for OBS Browser Source
- **EN/ID toggle** — menu labels in English or Bahasa Indonesia
- **While You Were Away + diary** — last visit summary and a per-song diary with personal notes
- **Shareable result card** — draw your result as a PNG card and download/share it
- **Share result to X** — one tap opens an X post with your score, grade and mode
- **Round History** — the last 12 settled 10-minute rounds (classification + average RPM), finalized live, at settle time, or at boot for rounds recorded while the page was closed
- **Daily Champions** — your best score of each day (last 7 days)
- **Send the result back** — after answering a duel, the result panel tells you to send your own Duel Link back so the challenger sees your score in their league
- **Full EN/ID** — the game's spoken messages, the result-panel rows and the XP line are now in Bahasa Indonesia too (not just the menu labels)
- **Tutorial** — a first-visit HOW TO PLAY panel (re-openable any time)
- **Volume slider** — 0–100%, persisted; mute goes through it
- **Haptic feedback** — short vibration on hits (stronger on PERFECT, longer on MISS) on phones
- **Achievement XP** — unlocking an achievement now pays +25 XP each
- **While You Were Away, upgraded** — the summary now also lists the wheel rounds that settled since your last visit
- **Past bosses** — the last 3 weekly bosses, from the same deterministic spec
- **Richer OBS overlay** — now also shows the ZOOMIES state and Squeektoshi's current state
- **NEO redesign (v32)** — the arcade cabinet is gone: one slim header (wordmark + a single settings gear), a settings sheet (language, graphics, sound, volume, music, practice, OBS, how-to), five text-only tabs, hairline borders, glass panels, generous spacing. The menu is calmer and the header can no longer overflow on phones. Same tabs as v31: PLAY (wallet, genre, difficulty, mode, latency row, PLAY), DAILY (tutorial, Weekly Boss, Daily Champions, Mastery, While You Were Away), LIVE (Wheel Call, Round History), LEAGUE (Duel League, Achievements), ME (PRECISION calibration, unlocks). Last tab is remembered per browser; all game data (XP, streaks, missions, rounds, champions) still lives in the same `localStorage` keys as before, so nothing is lost
- **NEO+ upgrade (v33)** — card overlay (ID card and result card open on top of any panel, with close + minimize, no more jumping back to the menu), redesigned cards (gradient frame, compact layout, no empty void, no creator line on the cards), settings work during play (the sheet lives outside the menu now; opening it pauses the game), auto-scroll to the game and the result on start/finish, pause buttons above the canvas, ACC as an integer (no more "58..."), in-canvas effects (shockwave rings, bigger hit particles, lane judgement text, miss glitch, beat-pulse background, gold hit line in FEVER), 10 song scales (was 5) with 4–5 per genre
- **NEO+ fixes + songs (v33.1)** — the result panel's ID-card button now shows a visible error when no wallet is entered (it used to fail silently), the browser tab title is correct, the header sticks so the gear stays reachable during play, the audio line says PAUSED while paused, the minimize bar no longer floats over the footer, the result panel is solid so the animated background can't wash out its text; every song now has a name from its scale + mood ("Neon Dorian"), the score counts up on the result panel, a NEW BEST ribbon appears on the result card, and songs are built around a repeating 2-bar motif instead of random notes (same seed = same song, verified)
- **Live Squeekchain API** — the ID Card shows the live hamster-wheel status and distance from `api.squeekchain.com/v1/status`, plus your Sepolia token balance (read-only)

## Files

- `index.html` — main page
- `style.css` — pixel / CRT styling
- `script.js` — game, music, Daily, XP, missions, ID Card, LIVE mode, RACE, Wheel Call, Achievements, Duel League, Weekly Boss, OBS overlay
- `AUDIT-v26-FIX.md` — notes on the v25 → v26 fixes
- `AUDIT-v27-LIVE.md` — notes on the v26 → v27 LIVE mode
- `AUDIT-v28-FIX.md` — notes on the v27 → v28 P0 fixes (PRECISION, Daily, LV5–LV8 unlocks)
- `AUDIT-v29-MEGA.md` — notes on the v28 → v29 MEGA upgrades (P1–P4 + Weekly Boss, Fever, Streak Freeze, Practice) and the restored XP bonuses
- `AUDIT-v30-TOTAL.md` — notes on the v29 → v30 TOTAL upgrade (round history, daily champions, share-to-X, full EN/ID, tutorial, volume, haptics, achievement XP, away-rounds, past bosses, richer OBS) and the v29.2 live verification
- `AUDIT-v32-NEO.md` — notes on the v31 → v32 NEO redesign (minimal futuristic theme, settings sheet, full EN/ID, low-lag performance mode)
- `AUDIT-v32.1-FIX.md` — P0 fix: MSG/RLBL/I18N moved to the top of script.js (initGL ran before MSG existed, killed the whole script, splash never closed)
- `AUDIT-v32.2-FIX.md` — small fixes from the v32.1 smoke test: stale LIVE banner when switching back to FREE, latency value wrapping onto two lines
- `AUDIT-v33-NEO+.md` — notes on the v32.2 → v33 NEO+ upgrade (card overlay + redesigned cards, settings during play, auto-scroll, in-canvas effects, 10 song scales)
- `AUDIT-v33.1-FIX.md` — fixes from the v33 smoke test (silent ID-card failure, stale tab title, header scrolling away, audio line on pause, minimize bar over the footer, translucent result panel) + song names, count-up score, NEW BEST ribbon, motif-based songs
- `REFERENSI-RHYTHM-GAMES.md` — reference research (Guitar Hero, Beat Saber, osu!, Phigros, Cytus II, DDR) for the v33 upgrade

## Notes

- UNOFFICIAL. On-chain data is read read-only (Sepolia token, not BNB mainnet).
- No transactions, no seed/private key — never enter a seed. Optional read-only wallet connect (address only, no signature).
- All scores, XP, streaks, and missions are stored 100% in the browser's `localStorage`.
- Sound only starts after your first tap (browser autoplay rule).

<!-- Genesis verification (Squeekchain Buildooooor, do not remove) -->
squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7
