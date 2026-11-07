# AUDIT v37.1 — LEAGUE layout fixes (phone width)

Date: 2026-11-07 ~22:50 WIB. Trigger: user's phone screenshot 22:05 WIB of the live v37 LEAGUE tab ("cek tampilannya ngasal begini"). Three visible defects, all in `style.css`, all confirmed against the v37 code before fixing. No gameplay, API, or storage changes.

## Defect 1 — name input crushed to a sliver
- Symptom: the leaderboard name field rendered as a tiny empty box left of a full-width `[ REFRESH ]` button.
- Root cause: `#lbRefreshBtn` carries class `btn-secondary`, and `style.css:59` sets `.btn-secondary { width: 100%; }`. Inside the flex row `.lb-row`, the button's flex base became 100% of the row, and `.lb-row .btn-secondary { flex: none; }` made it non-shrinking, so the input (`flex: 1; min-width: 0`) was crushed to ~0 width. The desktop smoke test had already flagged the narrow field; the phone screenshot proved it.
- Fix: `.lb-row .btn-secondary { flex: none; width: auto; }` — the button now sizes to its label and the input takes the rest of the row.

## Defect 2 — CHALLENGE mode button clipped at the panel edge
- Symptom: all six mode buttons sat on one line; CHALLENGE was cut off at the right edge of the panel.
- Root cause: mode buttons use class `btn-diff lb-mode`, and `style.css:65` sets `.btn-diff { flex: 1; min-width: 0; }`. With `flex: 1`, the six buttons shrink to share one line instead of wrapping (flex items shrink before they wrap), and "CHALLENGE" (11px font, ~90px needed) overflowed its ~60px share. `#lbModes` already had `flex-wrap: wrap`, but it never got a chance to wrap.
- Fix: `.lb-mode { flex: none; }` — each button sizes to its label; CHALLENGE wraps to a second row on phone width.

## Defect 3 — empty rank box
- Symptom: an empty bordered rectangle sat below the #1 score row.
- Root cause: `<p class="msg" id="lbRank"></p>` — `.msg` draws a dashed border + padding even when empty. `fetchLbRank()` sets `textContent = ''` when no wallet is entered (the user's phone had none), but the element stayed visible.
- Fix: `#lbRank:empty { display: none; }` — the line appears only when a rank is actually shown.

## Verification
- Tests: `node TEST-v34-neo.js` → **924/924** (919 carried + 5 new v37.1 layout assertions: refresh `width: auto`, mode `flex: none`, `#lbRank:empty` hidden, input still `flex: 1`, `#lbModes` still wraps). `node TEST-motif.js` → 10/10. `node --check script.js` OK (script.js unchanged from v37).
- Genesis proofs re-verified after deploy (TXT via Google DoH, meta tag in live HTML, README line as last line).
- Live check: LEAGUE tab on phone width — name field usable, all six mode buttons visible (CHALLENGE on row 2), no empty box without a wallet.

## Files changed vs v37
- `style.css` (3 rules), `index.html` (version strings v37 → v37.1), `README.md` (H1, version bullet, AUDIT list), `TEST-v34-neo.js` (version strings + 5 tests). `script.js`, `worker.js`, `TEST-motif.js` unchanged.
