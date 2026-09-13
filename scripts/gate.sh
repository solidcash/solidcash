#!/usr/bin/env bash
# Gate for any performance change to this toolchain.
#
#   scripts/gate.sh fast    bytecode identity + timing (about 1 minute)
#   scripts/gate.sh full    fast + utils suite + solidc suite (about 15 minutes)
#
# A performance change is only acceptable if `full` reports the SAME solidc counts as the baseline
# (189 failed / 4828 passed of 5017) and the identity line below is unchanged.
set -uo pipefail
cd "$(dirname "$0")/.."

EXPECTED='{"routeBytes":40019,"fullBytes":115274,"fullHash":"ed6cfff8760a3ca8"}'
status=0

echo "== build =="
yarn tsc -b tsconfig.packages.json 2>&1 | grep -E 'error TS' && status=1
grep -q 'error TS' /dev/null 2>/dev/null || true

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
  echo "== solidc suite (expect 189 failed / 4828 passed of 5017) =="
  yarn workspace solidc vitest run test/ 2>&1 | grep -E '^ +(Tests|Test Files) '
fi

echo "== gate status: $status =="
exit $status
