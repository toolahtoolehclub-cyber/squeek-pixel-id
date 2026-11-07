# AUDIT-v35 — CHAIN panel + MY SQUEEK + frontier-aware Round History

Whitepaper-driven upgrade (see `../hidden_files/WHITEPAPER-ANALYSIS.md`). All new data is
read-only from the public Squeekchain HTTP API (no key, CORS `*`), no server, no
transactions, no gameplay changes. Storage keys unchanged.

## P1 — CHAIN panel (tab LIVE)

New `#chainBox` under Wheel Call, fed by `/v1/core` + `/v1/economy/state` (throttled to
60 s, rides on `refreshLive`). Shows:

- Squeek block height + progress % to the next block (`core.blockHeight`,
  `core.blockProgress` / 1e9)
- Difficulty (`core.workPerThousandBlocks`) + settled frontier
  (`core.settledThroughRound`)
- SQK issued (`supply.miningMintedBaseUnits`), SQK staked
  (`staking.totalStakedBaseUnits`), Squeeks burned (`nft.burned` / 9,999)

Live values at build time (2026-11-07 ~20:00 WIB): height 1,999, difficulty 8,238,
issued ~7.35M SQK, staked ~3.64M SQK, burned 1,979. A failed/unavailable fetch shows
`CHAIN STATE UNKNOWN [status]` — never 0 (whitepaper invariant: unavailable means
unknown, not zero).

## P2 — MY SQUEEK on the ID Card

`generateCard` now also fetches `/v1/accounts/{address}` (in parallel with wheel +
balance). The account response carries everything needed — no second fetch:

- `power.nftPower` / `power.sqkPower` — scaled by 1e18 (like `sqkPerPower` 40e18 and
  `referencePower` 1000e18); displayed via `fmtSqk` (fmt with 18 decimals)
- `stake.principalBaseUnits`, `rewards.claimableBaseUnits` — 18-decimal base units
- `tokens[]` entries already carry `tokenId`, `custody` (staking/wallet), `level`,
  `basePower` (plain units, NOT scaled), `nextMergeHeight`, `mergeState`
- `tokenCounts` `{staking, wallet}` (strings)

Verified shape against the protocol reserve Safe (browser read 2026-11-07 ~20:00 WIB):
power nftPower 1e21 (= 1,000 units — exactly one level-1 Squeek), stake 0, claimable
25,260.72 SQK, tokens[0] = #8889 custody staking level 1 basePower 1000
nextMergeHeight 0 mergeState ready; tokens[1] = #8990 custody wallet. The ID card
picks the best Squeek (deposited in Staking first, then highest basePower) and shows
`#id • LV n • POWER p`, `NEXT MERGE` (READY NOW when `mergeState` is ready, else the
block height), `STAKED SQK`, `CLAIMABLE`. An account with no Squeek shows
`NONE YET — NO SQUEEK FOUND` honestly; a failed fetch shows `[ STATUS ]`, never 0.
The card grew 400×560 → 400×648 for the new section (result card stays 400×560).

Limits (honest, not fixed here): tokens come 25 per page — a wallet with more than 25
Squeeks shows the best of the first page only. The Squeek's DotGrid image exists at
`/v1/squeeks/{id}` (`metadata.imageDataUri`, inline base64 SVG) but is NOT drawn on
the card in v35 — text only, to keep the card layout and its failure modes simple.

## P3 — Round History respects the certified frontier

Rounds are 600 s buckets from SqueekCore genesis (`GENESIS_TS = 1793735400`), which
sits exactly on a 10-minute boundary, so a local round key (`YYYY-MM-DD-HH:MM`)
converts cleanly to a chain round id (`roundIdForKey`, tested: key for round 533
maps to 533). Each history row now shows its settlement state:

- `SETTLED ✓` — round id ≤ `settledThroughRound`
- `SETTLING… (UNKNOWN, NOT ZERO)` — round id > frontier
- `FRONTIER UNKNOWN` — chain state not loaded yet

Rows also show estimated work (`~avg RPM × 10 min`, 1 rev ≈ 1 work unit) and
estimated blocks (`~work × 1000 / difficulty`, only for settled rounds with a known
difficulty, else `?`). Estimates are labeled with `~` — the page only samples while
open, so they are lower bounds, never presented as settled fact.

## Not used

`/v1/settlements` returns HTTP 400 for `?limit=3` (it takes no query string; the
bare endpoint works) — v35 does not use it. Settlement items confirm the frontier
semantics (settledThroughRound advancing 502 → 503, workAdded and completedBlockCount
per settlement).

## Tests

`TEST-v34-neo.js` 814/814 (new: chain ids/URLs/functions, genesis ts, unknown-never-zero,
round-template placeholders, `roundIdForKey` round-trip for round 533, `estWork` /
`estBlocks` values incl. the 35-work @ 8238 → 4.2 case, fetchAccount + card rows +
honest empty states, `fmtSqk` on the real reserve-Safe numbers — power 1e21 → 1,000,
claimable → 25,260.72). `TEST-motif.js` 10/10. `node --check` OK.
