# AUDIT v37.2 — compact avatar + centered LEAGUE modes

Date: 2026-11-07 ~23:15 WIB. Trigger: user's phone screenshots 23:07 and 23:10 WIB of live v37.1. Two complaints, both layout, both confirmed against the v37.1 code before fixing. No gameplay, API, or storage changes.

## Defect 1 — YOUR PIXEL SELF box eats the PLAY tab
- Symptom: the avatar box is so tall that the PLAY button sits below the fold — the user must scroll to play.
- Root cause: `#avatarPreviewWrap` was a centered flex column: 128px canvas + three stacked label lines + gaps + padding ≈ 210px tall, sitting between the anthem line and the GENRE row.
- Fix: horizontal compact layout. The three label lines move into a `.avatar-meta` div beside the canvas; the canvas shrinks to 84px CSS (backing store stays 128x128, so the pixel art stays crisp). Box height is now ≈ 104px — about 105px saved, and the genre/difficulty/mode rows plus PLAY move up by that much. The dashed border, gold variant (`.gold`), and `hidden` toggle are untouched.

## Defect 2 — LEAGUE mode buttons hug the left edge
- Symptom: FREE / DAILY / LIVE / RACE / BOSS / CHALLENGE sit left-aligned with empty space on the right — "kurang persis tengah, terlalu mepet ke kiri".
- Root cause: the v37.1 fix (`flex: none` on `.lb-mode`) made each button size to its label, but `#lbModes` had no `justify-content`, so the row defaulted to left-aligned.
- Fix: `#lbModes { justify-content: center; }` — the six buttons center as a group; if CHALLENGE wraps on a narrower screen, the second row centers too.

## Verification
- Tests: `node TEST-v34-neo.js` → **933/933** (924 carried + 9 new v37.2 assertions: avatar row layout, 84px canvas, meta wrapper + all five avatar ids present once, modes centered). `node TEST-motif.js` → 10/10. `node --check script.js` OK (script.js unchanged from v37.1).
- Genesis proofs re-verified after deploy (TXT via Google DoH, meta tag in live HTML, README line as last line).
- Live check: PLAY tab avatar is a compact row; LEAGUE mode buttons centered.

## Files changed vs v37.1
- `style.css` (avatar row + 84px canvas + `.avatar-meta` + `#lbModes` centering), `index.html` (version strings v37.1 → v37.2, avatar-meta wrapper), `README.md` (H1, version bullet, AUDIT list), `TEST-v34-neo.js` (version strings + 9 tests). `script.js`, `worker.js`, `TEST-motif.js` unchanged.
