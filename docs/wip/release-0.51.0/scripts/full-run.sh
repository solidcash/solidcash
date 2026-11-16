#!/bin/bash
# usage: full-run.sh <commit> <out-dir>
#
# Every package suite once, on a detached snapshot worktree release-full at <commit>, so work can go on in the
# branch's own worktree meanwhile: solidc (about 18 min), utils, testing, solidhat, then solidcash (about 3 h, every
# file including e2e, with a 600 s test timeout). A wide run: it needs the user's approval each time it runs.
C=$1; L=$2
[ -n "$C" ] && [ -n "$L" ] || { echo "usage: full-run.sh <commit> <out-dir>"; exit 1; }
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$L"
DST=/Code/cashscript/.worktrees/release-full
[ -d "$DST" ] || bash "$HERE/mkwt.sh" release-full "$C" || exit 1
cd "$DST" && git checkout -q --detach "$C" && echo "full run at $(git log --oneline -1 | cut -c1-90)"
for p in utils solidc solidcash testing solidhat create-solidhat; do
  (cd "$DST/packages/$p" && ../../node_modules/.bin/tsc -p tsconfig.build.json) > "$L/build-$p.log" 2>&1 \
    || { echo "$p build failed"; exit 1; }
done
run() { # <package> <name> [extra vitest args]
  local p=$1 n=$2; shift 2
  cd "$DST/packages/$p" && (time timeout 16000 ../../node_modules/.bin/vitest run --reporter=json \
    --outputFile="$L/$n.json" "$@" > "$L/$n.out" 2>&1) 2> "$L/$n.time"
  echo "$n done $(date -u +%H:%M) $(grep real "$L/$n.time")"
}
run solidc solidc-full
run utils utils-full
run testing testing-full --passWithNoTests
run solidhat solidhat-full --passWithNoTests
run solidcash solidcash-full --testTimeout=600000
python3 -I "$HERE/summarize.py" "$L"/*-full.json
echo full-done
