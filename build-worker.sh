#!/bin/bash
# Build + deploy Worker v10 (v42.5: rate-limit check-sebelum-insert + resolve_log terpisah, session->wallet, poll cross-check, GHOST, Dream Seeds, analytics) (squeekchain-leaderboard).
# The repo keeps `import { buildChart, simulate } from "./engine.js"`;
# esbuild inlines engine.js (and @noble) into ONE bundle because
# upload_worker.py only uploads a single file.
# Usage: ./build-worker.sh [deploy|bundle-only]
#   bundle-only : just produce /tmp/v42.4-build/dist/worker.js
#   deploy      : bundle + upload (default)
set -euo pipefail
V421="$HOME/workspace/goals/domain-squeekpixel-is-a-dev-submit-genesis-buildooooor/files/squeekchain-v42.5"
BUILD=/tmp/v42.5-build
DB_ID=cd6920f3-3efb-491d-ae0c-b287069c8052
mkdir -p "$BUILD/dist"
cp "$V421/worker.js" "$V421/engine.js" "$BUILD/"
# node_modules (@noble/* + esbuild): install once in the build dir if missing.
# (/tmp is ephemeral — each version installs its own node_modules.)
if [ ! -d "$BUILD/node_modules/@noble" ]; then
  (cd "$BUILD" && npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund @noble/curves @noble/hashes esbuild)
fi
cd "$BUILD"
npx esbuild worker.js --bundle --format=esm --outfile=dist/worker.js
echo "bundle: $(wc -c < dist/worker.js) bytes"
if [ "${1:-deploy}" = "bundle-only" ]; then exit 0; fi
python3 "$HOME/workspace/custom-connectors/custom.cloudflare/bin/upload_worker.py" \
  squeekchain-leaderboard dist/worker.js "$DB_ID"
