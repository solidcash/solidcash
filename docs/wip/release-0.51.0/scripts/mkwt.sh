#!/bin/bash
# usage: mkwt.sh <name> <commit-ish> [--branch]
#
# Create /Code/cashscript/.worktrees/<name> at <commit-ish>, detached, or on a new branch <name> with --branch. Link its
# node_modules the way every SolidCash worktree here is linked (.bin and the third-party packages come from the main
# checkout's node_modules by node's upward lookup; @mem-cash from /Code/mem-cash; @solidcash/* from the worktree's own
# packages), then build utils, solidc and solidcash, which is also their typecheck.
#
# git runs from an existing worktree ($SRC), never from /Code/cashscript itself, which another party works in.
set -e
name=$1; base=$2; mode=$3
[ -n "$name" ] && [ -n "$base" ] || { echo "usage: mkwt.sh <name> <commit-ish> [--branch]"; exit 1; }
SRC=${SRC:-/Code/cashscript/.worktrees/release-0.51.0}
DST=/Code/cashscript/.worktrees/$name
if [ "$mode" = "--branch" ]; then
  git -C "$SRC" worktree add -q -b "$name" "$DST" "$base"
else
  git -C "$SRC" worktree add -q --detach "$DST" "$base"
fi
cd "$DST"
mkdir -p node_modules/@mem-cash node_modules/@solidcash
ln -sfn /Code/cashscript/node_modules/.bin node_modules/.bin
for p in types storage validation; do ln -sfn /Code/mem-cash/packages/$p node_modules/@mem-cash/$p; done
for p in solidcash create-solidhat utils solidc testing solidhat; do ln -sfn ../../packages/$p node_modules/@solidcash/$p; done
# Link every other main-checkout package too. Node finds them by its upward lookup anyway, at the same real paths,
# but solidhat's init test links a generated project in /tmp to this node_modules and needs vitest in it.
for e in /Code/cashscript/node_modules/* /Code/cashscript/node_modules/.[a-z]*; do
  n=$(basename "$e"); [ -e "node_modules/$n" ] || [ -L "node_modules/$n" ] || ln -s "$e" "node_modules/$n"
done
for p in utils solidc solidcash; do
  (cd packages/$p && ../../node_modules/.bin/tsc -p tsconfig.build.json) || { echo "$p build failed"; exit 1; }
done
echo "ready $DST at $(git log --oneline -1 | cut -c1-80)"
