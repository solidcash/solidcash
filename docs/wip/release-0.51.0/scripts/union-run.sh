#!/bin/bash
# usage: union-run.sh <worktree> <list-dir>
#
# The lander's run over named test files: <list-dir>/solidc.txt, utils.txt and solidcash.txt hold paths relative to
# each package. The script refuses an empty or missing list rather than let vitest run a whole package: a missing list
# once turned a union run into a full solidc run. Optional: SOLIDPOOL_SANDBOX=<dir> runs SolidPool's deployer tests
# there (a copy of bch-next whose node_modules/@solidcash/* link to <worktree>'s packages).
#
# Reports land in <list-dir>/out. Wide runs (a package's whole suite) need the user's approval each time.
W=$1; D=$2
[ -d "$W/packages" ] && [ -d "$D" ] || { echo "usage: union-run.sh <worktree> <list-dir>"; exit 1; }
HERE=$(cd "$(dirname "$0")" && pwd)
O=$D/out; mkdir -p "$O"
for list in solidc utils solidcash; do
  [ -s "$D/$list.txt" ] || { echo "missing or empty list $D/$list.txt: refusing a wide run"; exit 1; }
done
for p in utils solidc solidcash; do
  (cd "$W/packages/$p" && ../../node_modules/.bin/tsc -p tsconfig.build.json) >> "$O/build.log" 2>&1 \
    || { echo "$p build failed"; exit 1; }
done
echo "built at $(git -C "$W" log --oneline -1 | cut -c1-80)"
cd "$W/packages/solidc" && (time timeout 6000 ../../node_modules/.bin/vitest run --reporter=json \
  --outputFile="$O/solidc.json" $(cat "$D/solidc.txt") > "$O/solidc.out" 2>&1) 2> "$O/solidc.time"
cd "$W/packages/utils" && (time timeout 900 ../../node_modules/.bin/vitest run --reporter=json \
  --outputFile="$O/utils.json" $(cat "$D/utils.txt") > "$O/utils.out" 2>&1) 2> "$O/utils.time"
cd "$W/packages/solidcash" && (time timeout 14000 ../../node_modules/.bin/vitest run --testTimeout=600000 \
  --reporter=json --outputFile="$O/solidcash.json" $(cat "$D/solidcash.txt") > "$O/solidcash.out" 2>&1) \
  2> "$O/solidcash.time"
if [ -n "$SOLIDPOOL_SANDBOX" ]; then
  cd "$SOLIDPOOL_SANDBOX" && (timeout 1500 node scripts/solidhat.mjs compile 2>&1 | grep -v '^Warning' | tail -1) \
    > "$O/solidpool-compile.log"
  timeout 3000 node node_modules/vitest/vitest.mjs run --config vitest.solidhat.config.ts \
    contracts/test/deployer.test.ts contracts/test/deployer-genesis.test.ts > "$O/solidpool.log" 2>&1
  echo solidpool; cat "$O/solidpool-compile.log"; grep -E 'Test Files|Tests |FAIL' "$O/solidpool.log" | head -4
fi
python3 -I "$HERE/summarize.py" "$O/solidc.json" "$O/utils.json" "$O/solidcash.json"
grep real "$O"/*.time
echo union-done
