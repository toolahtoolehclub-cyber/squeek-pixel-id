# AUDIT — v31 ARCADE → v31.1 FIX

Date: 2026-11-07. CSS-only fix, found by the artifact builder's audit while porting
v31 into the in-app copy.

## The bug

On phones (narrow widths) the marquee header row overflowed: the title
"SQUEEKCHAIN" plus the three header buttons (EN / QLTY / mute) did not fit on one
row, and the mute button was cut off by about 40px. The site's existing
`max-width: 360px` rule shrank the title but did not wrap the row, so widths
between 361px and ~480px still overflowed.

## The fix (style.css only, no JS/HTML change)

New `@media (max-width: 480px)` block: marquee title 20px, `.header-row`
`flex-wrap: wrap` + `justify-content: center`, title container `flex: 1 1 100%`
(full row), icon buttons 44px tall, quality button min-width 84px. The title now
takes its own row and the three buttons wrap below it, centered.

The in-app artifact already carries this fix (the builder added it there first);
this commit ports the same fix back to the live site so both stay in sync.

## Tests

`/tmp/v31-arcade-test.js` — 209 checks (was 208; one new assertion for the 480px
wrap rule). All pass. `node --check` on `script.js` unchanged and still passing.
No version-label change: the UI still says "v31 ARCADE" (same as the v30.1
precedent — a fix commit, not a new version).
