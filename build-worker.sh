#!/bin/bash
# Build + deploy Worker v13 (v43: client-only — Worker v13 unchanged) (squeekchain-leaderboard).
# The repo keeps `import { buildChart, simulate } from "./engine.js"`;
# esbuild inlines engine.js (and @noble) into ONE bundle because
# upload_worker.py only uploads a single file.
# Usage: ./build-worker.sh [deploy|bundle-only]
#   bundle-only : just produce /tmp/v43-build/dist/worker.js
#   deploy      : bundle + upload (default)
set -euo pipefail
V43="$HOME/workspace/goals/domain-squeekpixel-is-a-dev-submit-genesis-buildooooor/files/squeekchain-v43"
BUILD=/tmp/v43-build
DB_ID=cd6920f3-3efb-491d-ae0c-b287069c8052
mkdir -p "$BUILD/dist"
cp "$V43/worker.js" "$V43/engine.js" "$BUILD/"
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
