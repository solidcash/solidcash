#!/bin/bash
# usage: tc-commits.sh <scratch-worktree> <from> <to>
#
# Typecheck (build) utils, solidc and solidcash at every commit in <from>..<to>, oldest first, by checking each one
# out detached in <scratch-worktree> (made with mkwt.sh; its own checkout moves, nothing else does). Every commit on
# a branch should print utils=0 solidc=0 solidcash=0.
W=$1; FROM=$2; TO=$3
[ -d "$W/packages" ] && [ -n "$FROM" ] && [ -n "$TO" ] || { echo "usage: tc-commits.sh <worktree> <from> <to>"; exit 1; }
L=${LOGS:-$W/.tc-logs}; mkdir -p "$L"
cd "$W" || exit 1
for c in $(git rev-list --reverse "$FROM..$TO"); do
  git checkout -q --detach "$c"
  (cd packages/utils && ../../node_modules/.bin/tsc -p tsconfig.build.json) > "$L/$c-utils.log" 2>&1; u=$?
  (cd packages/solidc && ../../node_modules/.bin/tsc -p tsconfig.build.json) > "$L/$c-solidc.log" 2>&1; a=$?
  (cd packages/solidcash && ../../node_modules/.bin/tsc -p tsconfig.build.json) > "$L/$c-solidcash.log" 2>&1; b=$?
  echo "$(git log --oneline -1 "$c" | cut -c1-72) utils=$u solidc=$a solidcash=$b"
done
