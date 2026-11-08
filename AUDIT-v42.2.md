# AUDIT-v42.2 — WalletConnect (Reown) for CONNECT WALLET

Squeek Pixel ID v42.2: the CONNECT WALLET button now works from a plain
mobile browser (Chrome) via WalletConnect, not only from inside a wallet
app's browser. No gameplay, verification, enforcement, replay, Keju,
league, catalog, split, or seasonEnd changed. All checks below were run
by the builder itself (not claimed from a build log).

## Problem

`connectWallet()` only used `window.ethereum`. From plain Chrome on a
phone there is no injected provider, so the button always failed with
"TIDAK ADA WALLET DI BROWSER INI". The user has OKX Wallet and wants to
connect from Chrome without opening the site from inside the wallet app.

## What changed (and only this)

- **Client v42.2** (`index.html` + `script.js` + `README.md`):
  - `index.html`: one new `<script>` tag (defer) for the WalletConnect
    UMD bundle, placed BEFORE `engine.js`/`script.js` — deferred
    scripts execute in document order, so the library is loaded before
    `script.js` runs.
  - `script.js` `CONFIG`: `WC_PROJECT_ID =
    '1f186dd3221f938c4e0b8c72c233a3be'` (Reown project created by the
    user at cloud.reown.com — public by design, it identifies the dApp
    to the relay and grants no wallet access) and `WC_CHAINS =
    [11155111]` (Sepolia only).
  - `script.js` new helpers (module-level `let wcProvider = null` —
    NOT on `G`, because `G` is replaced every game):
    - `getEth()` — the active EIP-1193 provider: the WC provider when
      connected through the modal, else `window.ethereum`, else null.
    - `sqkChainIdHex(v)` — normalises a chain id from number, hex
      string, or decimal string to lowercase hex.
    - `ensureSepoliaChain(eth)` — reads `eth_chainId`; if not Sepolia,
      tries `wallet_switchEthereumChain` to `0xaa36a7`; on error 4902
      (chain not in the wallet) tries `wallet_addEthereumChain`
      (Sepolia, nativeCurrency Sepolia ETH, publicnode RPC,
      Blockscout explorer); returns true/false, never throws.
    - `wcGetProvider()` — lazy `EthereumProvider.init()` with the
      verified options (projectId, chains, optionalChains,
      showQrModal: true, rpcMap Sepolia → publicnode, metadata
      name/description/url/icons); attaches `accountsChanged` (same
      handling as the injected path) and `disconnect` (clears
      `wcProvider`) listeners once per provider instance.
    - `connectWalletConnect()` — `p.connect()` opens the AppKit modal
      (QR + wallet list incl. OKX), then `eth_requestAccounts`; fills
      the wallet field + `saveWallet38` + `preview` + the same green
      success message as path A. Modal closed / rejected → the
      `wcRejected` message, never an error, never a crash.
    - `restoreWalletConnectSession()` — on load, restores a live WC
      session without opening the modal, but ONLY when a `wc@2:` key
      exists in localStorage; otherwise it returns immediately, so a
      plain page load never opens a relay connection.
  - `connectWallet()` — two paths: (A) `window.ethereum` exists →
    byte-identical to v42.1; (B) otherwise → WalletConnect. If the WC
    library failed to load (`typeof window.EthereumProvider ===
    'undefined'`) → the `wcLoadFail` message (fail-soft, no crash).
  - All three SQK transaction paths now use `getEth()`:
    `sqkPermitAndSend` (permit + buy/commit tx), `sqkWaitReceipt`
    (receipt polling, + null guard), `resolveSqkCapsule` (resolve tx).
    `sqkPermitAndSend` and `resolveSqkCapsule` call
    `ensureSepoliaChain` instead of refusing on a wrong chain.
  - New i18n keys (EN + ID): `wcLoadFail`, `wcRejected`,
    `wcChainFail`. Existing messages unchanged.
  - Submit sends `gameVersion: 'v42.2'`; title/meta/h2/footer say
    v42.2.
- **Worker**: UNCHANGED (still v8). No Worker change was needed.
- **Tests** (`TEST-v34-neo.js` — file name kept across versions):
  the 7 version assertions were moved v42.1 → v42.2, the
  `eth_requestAccounts` assertion now allows exactly 2 call sites
  (path A + WC path B, both inside connect handlers, never on load),
  and a new section 15g (21 assertions) pins the WC wiring.
- **README.md**: title v42.2 + new v42.2 bullet; the v42.1 bullet is
  kept as history.

## WalletConnect API — verified from the library itself (not guessed)

- UMD bundle: `https://unpkg.com/@walletconnect/ethereum-provider@2.26.0/dist/index.umd.js`
  — fetched 2026-11-08: HTTP 200, 1,423,362 bytes, sets
  `window.EthereumProvider` (`gt.EthereumProvider=YB` at the tail of
  the bundle) and includes the AppKit QR modal. The old path
  `dist/umd/index.min.js` is 404 — never use it. (`package.json`
  `unpkg` field confirms `dist/index.umd.js`.)
- Options type (`EthereumProviderOptions`, from the published
  `dist/types/EthereumProvider.d.ts` for 2.26.0): `projectId`,
  `chains` (ArrayOneOrMore<number>), `optionalChains`, `methods`,
  `optionalMethods`, `events`, `optionalEvents`, `rpcMap`
  (chainId-string → URL), `metadata`, `showQrModal: boolean`,
  `qrModalOptions`, `disableProviderPing`, `relayUrl`,
  `storageOptions` + `UniversalProviderOpts`.
- Instance (`EthereumProvider` class, same .d.ts): static
  `init(opts)`, `connect(opts?)`, `request(args)`, `enable()`,
  `accounts: string[]`, `chainId: number`, `connected` getter,
  events `connect` / `disconnect` / `chainChanged` /
  `accountsChanged` / `display_uri`.
- `RpcMethod` (same .d.ts) includes `eth_signTypedData_v4`,
  `eth_sendTransaction`, `wallet_switchEthereumChain`,
  `wallet_addEthereumChain`, `eth_requestAccounts`, `eth_accounts`.
- UMD source quirk found by reading the bundle: the WC provider
  answers `eth_chainId` with a NUMBER (`parseInt(this.getDefaultChain())`),
  not a hex string — that is why `sqkChainIdHex` exists. Read-only
  methods (`eth_getTransactionReceipt`, `eth_call`, …) are routed to
  `rpcMap` (they appear in the bundle's safe-RPC list).

## Tests (run by the builder, 2026-11-08 ~23:5x WIB)

- `node TEST-v34-neo.js` (cwd = the v42.2 folder): **1597 passed,
  0 failed** (baseline 1576 total in the v42.1 suite as copied +
  21 new v42.2 assertions; the earlier "1574" count in the v42.1
  report was 2 short of the file's real total — the file itself was
  never edited between the two counts).
- `node TEST-motif.js`: **11 passed, 0 failed**.
- `node --check` OK: `script.js`, `engine.js`, `worker.js`,
  `TEST-v34-neo.js`, `TEST-motif.js`.
- Functional test of the extracted helpers (Node, mock providers):
  `sqkChainIdHex(11155111)` → `0xaa36a7`; hex `0xAA36A7` →
  `0xaa36a7`; decimal string → `0xaa36a7`; `0x1` → `0x1`;
  null → `""`. `ensureSepoliaChain`: WC provider already on Sepolia
  (number chainId) → true; injected on mainnet + switch OK → true;
  4902 → add OK → true; 4902 → add rejected → false; switch
  rejected (4001) → false; null provider → false.
- **Limits of the static tests**: they assert the code contains the
  verified API calls and the right constants; they do NOT run the
  WalletConnect modal (that needs a real browser + a wallet app) —
  see the smoke test below.

## Smoke test (browser, 2026-11-08 ~23:xx WIB)

**NOT RUN by this builder — browser delegation is unavailable in this
subagent** (`browser.browse` is not in this agent's tool list; the call
was refused as non-retryable). The parent agent must run it. What the
parent's browser task must check, in a plain Chrome with NO injected
wallet:

1. Open https://squeekpixel.web.id/ (title must say v42.2).
2. Press CONNECT WALLET → the WalletConnect modal MUST appear (QR +
   wallet list incl. OKX). Do NOT complete pairing (no approval).
3. SHOP tab: SQK shop still live (banner gone, 6 buy buttons active,
   prize pool 0, season end 6 Feb 2027); capsule COMMIT/RESOLVE
   active. Do not buy/commit/resolve.
4. One full FREE song + submit with the dead test wallet
   0x000000000000000000000000000000000000dEaD (never the user's real
   wallets) → "TERVERIFIKASI ✓" after ~60 s, score on the board with ✓.
5. Clean ALL test rows from D1 afterwards (9 tables by wallet, use
   LOWER(wallet); league column is best_score; board back to 0).

Verified WITHOUT a browser by this builder instead (fetch, not a
visit): GitHub Pages serves v42.2 live (title `SQUEEKCHAIN // v42.2`,
WC script tag present, `script.js` contains `WC_PROJECT_ID` +
`gameVersion: 'v42.2'`), and all 3 Genesis proofs are intact (meta
tag in live HTML, README last line via raw GitHub, DNS TXT via
Google DoH — all matching).

## Known limits

- The real WalletConnect pairing (scan/approve in the OKX app) was
  NOT done by the builder — it needs the user's own phone + approval.
  The wiring is ready for the user to test: open
  https://squeekpixel.web.id/ in Chrome → CONNECT WALLET → modal →
  OKX → approve → buy the 5 SQK item + 1 capsule pull with the 25 SQK.
- The WC UMD bundle is ~1.4 MB from unpkg; if unpkg is unreachable
  the game still works (injected path + manual address), because the
  script is loaded with `defer` and every WC call is guarded by
  `typeof window.EthereumProvider === 'undefined'`.
- `sqkNoProvider` still says "OPEN THIS PAGE IN METAMASK" — it is
  only reached now when there is no provider AND the WC library
  failed to load; the wording was left unchanged to avoid touching
  unrelated strings.
- Session restore only runs when a `wc@2:` key exists; a session
  that expired server-side simply yields no accounts and is ignored.
