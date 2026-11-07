# AUDIT-v34.1 — footer note cleanup

Date: 2026-11-07 ~19:40 WIB. Small patch on top of v34 THEMES. No gameplay change, no storage-key change, no Genesis-proof change.

## Why

The footer note compared the Sepolia token against another chain's mainnet by name. That comparison was accurate as a disclaimer ("not that chain's mainnet"), but the other chain's name does not belong in this project at all: the game is a Squeekchain project, 100% off-chain, and the only chain it ever names should be the one whose token balance it actually shows (Sepolia). The repo topic for that other chain was already removed the same evening; this patch removes its name from the site itself.

## What changed (5 spots, all text-only)

1. `index.html` footer static text: `(Sepolia token, not <other chain> mainnet)` → `(Sepolia token)`. Footer version label `v34 THEMES` → `v34.1`.
2. `script.js` EN `footerNote` (MSG.en): same text change.
3. `script.js` ID `footerNote` (MSG.id): `(token Sepolia, bukan <other chain> mainnet)` → `(token Sepolia)`.
4. `script.js` connect-wallet code comment: no longer lists that chain's wallet as an example provider (comment only, invisible on the site).
5. `README.md`: H1 → v34.1, Notes line → `(Sepolia token)`, new v34.1 bullet, new file-list entry for this audit.

Version labels bumped to v34.1 in the same pass: `<title>`, the `PIXEL ID //` header, the footer label, README H1. The `// v34 ...` code comments were left untouched — they are version history, not user-facing text.

## Verification

- `node --check script.js` OK.
- `node TEST-v34-neo.js` — full suite passes, including the new test `no BNB/Binance anywhere (v34.1)`, which asserts the literal names appear nowhere in `index.html`, `style.css`, `script.js`, or `README.md`.
- `node TEST-motif.js` — 10/10 (unchanged).
- `grep -rni` for the other chain's name across the v34.1 folder: zero matches in user-facing files (the only match is the test's own regex, which is the assertion itself).
- Genesis proofs untouched: meta tag in `index.html`, TXT record, README last line `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7` — all re-verified at deploy.
- Storage keys unchanged (`sqk24/28/29/30/31` families), so XP, streaks, missions, and settings survive the update.
