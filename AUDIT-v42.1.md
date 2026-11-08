# AUDIT-v42.1 — SQK shop wired LIVE (Batch 5 wiring, Worker v8)

Squeek Pixel ID v42.1: the deployed shop contract is now wired into the
Worker AND the client. No gameplay, verification, enforcement, replay,
Keju, or league logic changed. All checks below were run by the
coordinator itself (not claimed from a build log).

## What changed (and only this)

- **Worker v8** (`worker.js`): `SHOP_CONTRACT` zero placeholder →
  `0x43f568AcfaDcee4333785c9F26596719ED0B02fb` (deployed by the user
  2026-11-08, Sourcify full match, matchId 58821398). `GET /` now
  returns `{ service: "squeekchain-leaderboard", version: 8 }`. The 503
  "shop not deployed" gate stays in the code as a guard but is inactive
  (`sqkShopDeployed()` is now true). No other Worker line changed.
- **Client v42.1** (`script.js` + `index.html`): `CONFIG.SHOP_ADDRESS`
  zero placeholder → the same deployed address; submit sends
  `gameVersion: 'v42.1'`; title/meta/h2/footer say v42.1. The SQK
  section renders live: the coming-soon banner hides when deployed
  (`renderSqkShop` toggles it), buy buttons are enabled, prize pool /
  season end / sweep are read live from the contract, capsule
  COMMIT/RESOLVE are enabled.
- **Tests** (`TEST-v34-neo.js` — the file name is kept across versions;
  there is no TEST-v42-neo.js): the v42 assertions that pinned the
  UNDEPLOYED state were flipped to the deployed state, and 2 new
  assertions were added (banner hides when deployed; `sqkShopDeployed()`
  is true with the real address, client + Worker). The zero-address
  unit test is kept (a zero address must still report not-deployed).
- **README.md**: new v42.1 bullet added; the v42 bullet is kept as history.
- **build-worker.sh**: paths moved to the v42.1 folder / build dir,
  header now says Worker v8.

## Tests (run by the coordinator, 2026-11-08 ~23:3x WIB)

- `node TEST-v34-neo.js` (cwd = the v42.1 folder): **1574 passed,
  0 failed** (baseline v42 1572/1572 + 2 new assertions).
- `node TEST-motif.js`: **11 passed, 0 failed**.
- `node --check` OK: `script.js`, `engine.js`, `worker.js`,
  `TEST-v34-neo.js`, `TEST-motif.js`.
- `node --check` OK for both inline scripts in the built artifact
  (checked by the artifact builder).

## Live verification (coordinator, 2026-11-08 ~23:3x WIB)

- **Worker v8**: `GET https://squeekchain-leaderboard.pancigoreng.workers.dev/`
  → `{"service":"squeekchain-leaderboard","version":8}`.
- **Gate gone, /capsule-resolve**: `POST /capsule-resolve` with a valid
  wallet (dead test wallet), pullId 1, targetRound 999999 →
  409 `{"error":"round not settled yet","targetRound":999999,
  "settledThroughRound":646}` — the expected post-gate error, NOT 503.
- **Gate gone, /capsule**: `POST /capsule` with a valid wallet + a
  well-formed but nonexistent txHash →
  `{"error":"receipt not found","detail":"no receipt for this txHash (yet?)"}`.
- **On-chain reads, exact client selectors** (Sepolia RPC, 2026-11-08
  ~23:3x WIB): `prizePool()` = 0, `seasonEnd()` = 1801915200,
  `sweepAvailableAt()` = 1802520000, `isSwept()` = false,
  `itemPrice(1..6)` = 5 / 10 / 15 / 20 / 50 / 100 SQK — everything the
  SHOP tab renders is readable live from the contract.
- **GitHub push**: commit `5a854277` ("Squeekchain v42.1: wire shop
  contract 0x43f568AcfaDcee4333785c9F26596719ED0B02fb (Worker v8, SQK
  shop live); tests 1574/1574 + motif 11/11"), head was `b3882fd6`.
  Root `worker.js` / `script.js` / `index.html` / `engine.js` /
  `style.css` verified byte-identical to the v42.1 folder after the push.
- **GitHub Pages**: https://squeekpixel.web.id/ serves v42.1 (title
  `SQUEEKCHAIN // v42.1`; live `script.js` contains
  `CONFIG.SHOP_ADDRESS = '0x43f568AcfaDcee4333785c9F26596719ED0B02fb'`
  and `gameVersion: 'v42.1'`). First fetch still showed v42 (Pages
  cache), the next one v42.1.
- **3 Genesis proofs intact**: meta tag in live `index.html`
  (`05432539-b4e4-4f90-97b3-c258583905b7`), README last line
  (`squeekchain-project: 05432539-...`), DNS TXT via Google DoH
  (`squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9`).
- **Artifact preview** (`squeekchain-v26-fix`, in-place edit):
  builder verification **SUCCEEDED** — assembled from the v42.1
  folder, only duelLink + overlayUrl patched to the canonical base
  https://squeekpixel.web.id/, 0 `location.href`, 0 BNB/Binance,
  Genesis meta byte-identical (exactly once), `CONFIG.SHOP_ADDRESS`
  = deployed shop (zero placeholder gone), `gameVersion: 'v42.1'`,
  banner hides when deployed, buy buttons enabled, pool/season/sweep
  read live, capsule COMMIT/RESOLVE enabled. Advisory egress flag on
  the build (requests to the leaderboard Worker) is expected — it is
  the game's own backend. Not shared publicly.
- **D1 board clean**: `scores` 0, `league_scores` 0,
  `cheese_balances` 0. The single `submit_log` row created by the
  coordinator's own gate test (dead wallet) was deleted (0 remaining).
  No score/cheese/league rows were created by this wiring work.

## NOT done here (needs the user's wallet / a live browser)

- **Interactive browser smoke test** (could not run from this
  subagent — no live browser): SHOP tab visually live on the site
  (banner gone, buy buttons enabled, pool/season/sweep rows shown),
  capsule COMMIT/RESOLVE clickable, Cheese Shop + weekly league still
  working, one full song + submit → "TERVERIFIKASI ✓". All of it is
  verified at the code + API + on-chain level above; the visual pass
  still needs a browser agent.
- **End-to-end buy / capsule pull with the user's real wallet**
  (0x88538a82143065664232422e2dec4309038fcf9a, 25 SQK) — DELIBERATELY
  NOT done: it needs the user's own wallet signature in the game.
  Wiring is ready for the user to do it themselves: buy item 1
  (5 SQK) and one capsule pull (2 SQK) fit the 25 SQK balance.

## Small notes

- The Worker still sends `User-Agent: squeekchain-leaderboard/7` to the
  public settlements API (cosmetic label, not functional) — left alone
  on purpose; bump it with the next Worker change if it matters.
- Split, catalog prices, and seasonEnd are UNCHANGED: 0% burn, 70%
  owner / 30% prize pool, catalog 5/10/15/20/50/100 SQK, capsule 2 SQK,
  seasonEnd 1801915200 (= 2027-02-06 19:00 WIB).
