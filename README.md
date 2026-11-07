# Squeekchain v27 LIVE

A pixel cyberpunk rhythm game — build an anthem from your wallet (read-only; optional wallet connect reads your address only, no signature, no transactions), play 3 lanes, earn XP, play the Daily Anthem, complete daily missions, generate your ID Card, and race the real hamster in LIVE mode.

Built by [pancigoreng](https://x.com/pancigoreng) — Made in Indonesia.

## Play

Open `index.html` in a browser (or serve this folder), tap **▶ HYPE 128 BPM** or **▶ CALM 100 BPM**, enter a wallet address `0x...`, then **INITIALIZE RHYTHM**.

- **Daily Anthem** — the same song for everyone on the same day (same genre + difficulty), with a daily streak
- **XP & levels** — LV1–LV8, your avatar evolves (glasses, hat, golden crown)
- **Daily missions** — 3 random missions per day, +25 XP each
- **Mastery** — your last 10 games per wallet
- **Duel Link** — share `?challenge=...` so a friend plays the exact same song
- **Opening music, 2 modes** — HYPE 128 BPM / CALM 100 BPM, switch with 1 tap in the menu
- **Moving background** — grid + orbs + sweep (still moves even if WebGL fails), QLTY ULTRA/ECO
- **LIVE — Race the Hamster** — the song's tempo follows the real hamster wheel, live from `api.squeekchain.com/v1/status`: resting hamster = CALM 100 BPM, running hamster = 100 + RPM (max 180). At 70+ RPM ZOOMIES starts and all scores double. Day follows the wheel running, night follows it resting. If the wheel is offline the song uses a 128 BPM fallback and says so — never fake live data. Deep link: `?live=1`
- **Live Squeekchain API** — the ID Card shows the live hamster-wheel status and distance from `api.squeekchain.com/v1/status`, plus your Sepolia token balance (read-only)

## Files

- `index.html` — main page
- `style.css` — pixel / CRT styling
- `script.js` — game, music, Daily, XP, missions, ID Card, LIVE mode
- `AUDIT-v26-FIX.md` — notes on the v25 → v26 fixes
- `AUDIT-v27-LIVE.md` — notes on the v26 → v27 LIVE mode

## Notes

- UNOFFICIAL. On-chain data is read read-only (Sepolia token, not BNB mainnet).
- No transactions, no seed/private key — never enter a seed. Optional read-only wallet connect (address only, no signature).
- All scores, XP, streaks, and missions are stored 100% in the browser's `localStorage`.
- Sound only starts after your first tap (browser autoplay rule).

<!-- Genesis verification (Squeekchain Buildooooor, do not remove) -->
squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7
