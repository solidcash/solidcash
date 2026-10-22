#!/usr/bin/env bash
# Gate for any performance change to this toolchain.
#
#   scripts/gate.sh fast    bytecode identity + timing (about 1 minute)
#   scripts/gate.sh full    fast + utils suite + solidc suite (about 15 minutes)
#
# A performance change is only acceptable if `full` reports the SAME solidc counts as the baseline
# (0 failed / 7366 passed of 7366) and the identity line below is unchanged.
set -uo pipefail
cd "$(dirname "$0")/.."

EXPECTED='{"routeBytes":44840,"fullBytes":247572,"fullHash":"bf00ad8f2b11dc1e"}'
status=0

echo "== build =="
# Note: the `status=1` inside a pipeline runs in a subshell and would be lost, so capture the output first.
build_output=$(yarn tsc -b tsconfig.packages.json 2>&1)
if printf '%s' "$build_output" | grep -q 'error TS'; then
  printf '%s\n' "$build_output" | grep -E 'error TS'
  echo "   FAIL: build errors"
  status=1
else
  echo "   ok"
fi

echo "== bytecode identity =="
actual=$(node --max-old-space-size=8192 scripts/verify-id.mjs 2>/dev/null | tail -1)
echo "   expected: $EXPECTED"
echo "   actual  : $actual"
if [ "$actual" != "$EXPECTED" ]; then
  echo "   FAIL: bytecode changed"
  status=1
else
  echo "   ok"
fi

echo "== timing =="
node --max-old-space-size=8192 scripts/perf-compile-time.mjs 2>/dev/null | tail -1

if [ "${1:-fast}" = "full" ]; then
  echo "== utils suite =="
  yarn workspace @solidcash/utils vitest run test/ 2>&1 | grep -E '^ +(Tests|Test Files) '
  echo "== solidc suite (expect 0 failed / 7366 passed of 7366) =="
  yarn workspace solidc vitest run test/ 2>&1 | grep -E '^ +(Tests|Test Files) '
fi

echo "== gate status: $status =="
exit $status
