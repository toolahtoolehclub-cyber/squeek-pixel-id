# AUDIT-v36 — LIVE tab fetches immediately + first LIVE/390px smoke test

Verification pass. One real fix, the rest is verified behavior. No gameplay changes.
Storage keys unchanged.

## Fix: LIVE tab no longer waits for the 30s poll

`setTab('live')` now calls `refreshLive()` immediately. Before, opening the LIVE
tab showed "MENGAMBIL STATUS CHAIN…" until the 30s menu poll happened to fire —
the smoke test (2026-11-07 ~21:00 WIB) watched it sit there for ~8s. The CHAIN
panel, Wheel Call and Round History now fetch the moment the tab opens.
`refreshLive` is a hoisted function declaration, so calling it from `setTab` is
safe; `refreshChain` inside it is already throttled to 60s, so rapid tab
switching cannot spam the API.

## Smoke test (live site v35.2, 2026-11-07 20:56–21:01 WIB)

- FREE: PASS — notes fall, taps register, result panel appears.
- RACE: PASS — HUD distances render, TERMINATE works.
- ID Card ANTHEM/TEMPO gap (v35.2 fix): VERIFIED fixed on the live site — clear
  gap, no collision.
- CHAIN panel: loads real data (block #1,999, difficulty 8,238, settled through
  round 540, issued 7,345,466.82 SQK, staked 3,730,299.72, burned 1,994).
- Round History: 12 rounds render with frontier states.

## Findings checked against the code — NOT bugs, no action

- "LIVE is not a rhythm game": the tester opened the LIVE *tab* (Wheel Call
  predictions). The LIVE *rhythm mode* is selected in the PLAY tab's mode row
  (`playMode === 'live'`, seed `LIVE-YYYY-MM-DD-<bpm>`, tempo from the real
  wheel, live HUD + 5s poll). Re-test of the real mode was requested separately.
- "JOG 0 RPM" in Round History: impossible in code — `roundClass(avg)` returns
  nap for avg < 5 and the stored avg is the same value the row shows, so the
  tester misread a row.
- "Anthem truncated to • G": the card shows name + key only by design (v33.2);
  the tester quoted the full correct value and then called it truncated.
- "?race=1 first showed the LIVE tab": the last-remembered tab (`sqk31:tab`)
  was LIVE; the mode was correctly RACE when PLAY opened. Correct behavior.
- "MY SQUEEK [ HTTP_400 ]": the tester used the zero address 0x0000…0000,
  which the public API rejects with 400. The card shows the status honestly,
  per its design (failed fetch = [ STATUS ], never 0). Real wallets get 200.
- "Guest cannot open the ID Card": by design — a valid wallet is required
  (v33: visible error, no wallet).

## Still open (honest)

- True 390px width: the browser tooling cannot set a 390px window (zoom did not
  change the layout), so the test ran at 1919×998 with a ~460px centered content
  column and no overflow was seen — but a real 390px pass still needs the user's
  phone. The ID Card already proved itself at phone width in the user's own
  screenshot (2026-11-07 20:41 WIB).
- LIVE rhythm mode: re-test requested; result pending at v36 ship time.

## Tests

`TEST-v34-neo.js` 836/836 (new: setTab refreshes LIVE on open). `TEST-motif.js`
10/10. `node --check` OK.
