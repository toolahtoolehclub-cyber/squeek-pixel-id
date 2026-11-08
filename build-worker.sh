#!/bin/bash
# Build + deploy Worker v4 (squeekchain-leaderboard).
# The repo keeps `import { buildChart, simulate } from "./engine.js"`;
# esbuild inlines engine.js (and @noble) into ONE bundle because
# upload_worker.py only uploads a single file.
# Usage: ./build-worker.sh [deploy|bundle-only]
#   bundle-only : just produce /tmp/v40-build/dist/worker.js
#   deploy      : bundle + upload (default)
set -euo pipefail
V40="$HOME/workspace/goals/domain-squeekpixel-is-a-dev-submit-genesis-buildooooor/files/squeekchain-v40"
BUILD=/tmp/v40-build
DB_ID=cd6920f3-3efb-491d-ae0c-b287069c8052
mkdir -p "$BUILD/dist"
cp "$V40/worker.js" "$V40/engine.js" "$BUILD/"
# node_modules (esbuild + @noble) live in the v39 build dir; link, don't copy.
[ -e "$BUILD/node_modules" ] || ln -s /tmp/v39-build/node_modules "$BUILD/node_modules"
cd "$BUILD"
npx esbuild worker.js --bundle --format=esm --outfile=dist/worker.js
echo "bundle: $(wc -c < dist/worker.js) bytes"
if [ "${1:-deploy}" = "bundle-only" ]; then exit 0; fi
python3 "$HOME/workspace/custom-connectors/custom.cloudflare/bin/upload_worker.py" \
  squeekchain-leaderboard dist/worker.js "$DB_ID"
