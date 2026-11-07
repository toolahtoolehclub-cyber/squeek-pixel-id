# AUDIT-v34.2 — SQK token fix (ID Card balance read the wrong contract)

## What was wrong

The ID Card's "TOKEN (SEPOLIA)" balance read `CONFIG.TOKEN =
0x810239d271e80a86023f4f315943acbd65b59281`. That contract is from an earlier Sepolia
deployment, not the current one. The balance shown was therefore not the player's real
$SQK balance on the live deployment.

Found during the whitepaper study (2026-11-07): the developers doc deployment table
(release `core-sepolia-20261103`, revision 7, 2026-11-03) lists SqueekToken as
`0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e`. The game's address did not match it.

## Evidence (Blockscout, Sepolia, checked 2026-11-07 ~19:46 WIB)

| Contract | Name / symbol | Total supply | Holders |
|---|---|---|---|
| Old (game, before) `0x810239...` | Squeek / SQK, 18 dec | 362,250,000 | 2 |
| Current (docs) `0xd78a...` | Squeek / SQK, 18 dec | 217,345,304.44 | 772 |

The current contract's supply matches the live economy state's `liveSupply`
(217,345,304.4467...) exactly. The old contract's 2 holders and stale supply mark it as a
leftover from an earlier deployment.

## The fix (one line)

`script.js:561` — `CONFIG.TOKEN`: `0x810239d271e80a86023f4f315943acbd65b59281` →
`0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e`.

Nothing else changed: same RPC, same `eth_call` balance/name/symbol/decimals reads, same
ID Card row, same storage keys, same Genesis proofs, same gameplay. Version labels bumped
v34.1 → v34.2 (title, header, footer, README).

## Regression test

New assertion in `TEST-v34-neo.js`: `CONFIG.TOKEN` must equal the current deployment
address and the old address must not appear anywhere in `script.js`. If the deployment
is ever replaced again, this test fails loudly instead of silently showing a dead balance.

## Known limitation (not fixed here)

The Sepolia public RPC used for the balance read (`ethereum-sepolia-rpc.publicnode.com`)
returned 403 / closed connections during the whitepaper study. The address is now correct,
but if that RPC is down the ID Card still shows the balance as unavailable. A future step
could read the balance from the HTTP API (`/v1/accounts/{address}`), which stayed reachable.
That change is out of scope for this token-only fix.
