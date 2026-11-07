# AUDIT-v35.1 — Squeek art on the ID Card

The ID Card's MY SQUEEK section now shows the Squeek's own DotGrid art, not just
text. No gameplay changes. Storage keys unchanged.

## What it does

`generateCard` loads the Squeek image after the account fetch:
`/v1/squeeks/{id}` → `metadata.imageDataUri` (a base64 inline SVG — the real
on-chain art). The image is drawn 72×72 inside a 76×76 cyan frame at the left of
the MY SQUEEK section; the MY SQUEEK / NEXT MERGE rows move to a right column
(x=116), STAKED SQK / CLAIMABLE move down to y=604. The card grows 400×648 →
400×680 (result card stays 400×560).

## Verified shape (live check 2026-11-07 ~20:30 WIB)

Squeek #8889's `imageDataUri`: 74,058 chars as a data URI, 55,523 chars decoded,
root `<svg … width="1568" height="1568" viewBox="0 0 25088 25088">` — explicit
intrinsic dimensions, so browsers render it at any drawn size.

## Fail-soft by design

- `fixSvgSize` injects `width="512" height="512"` into the SVG root when no width
  is present (SVG data URIs without dimensions render as 0×0 in some browsers);
  sized SVGs pass through untouched, bad input passes through untouched.
- Image load has a 4 s timeout; the card waits at most 5 s total for the image.
- A missing/failed/slow image draws a dashed pink 76×76 placeholder box with `?`
  — the card never breaks for an image, and the text rows are always shown.
- The image is cached per tokenId for the session (`squeekImgCache`), so reopening
  the card does not refetch the ~74 KB art.

## Cost note

One extra public-API fetch per card open (~74 KB for the art). No key, no
transaction, no server.

## Tests

`TEST-v34-neo.js` 827/827 (new: fetchSqueekImage / loadSqueekImage / fixSvgSize /
cache present, squeek URL, drawImage + frame + placeholder, both timeouts, CH 680,
fixSvgSize run on real-shape samples — adds 512×512 when missing, leaves sized
SVGs alone, passes bad input through). `TEST-motif.js` 10/10. `node --check` OK.
