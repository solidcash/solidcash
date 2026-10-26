#!/usr/bin/env bash
# Gate for any performance change to this toolchain.
#
#   scripts/gate.sh fast    bytecode identity + timing (about 1 minute)
#   scripts/gate.sh full    fast + utils suite + solidc suite (about 15 minutes)
#
# A performance change is only acceptable if `full` reports the SAME solidc counts as the baseline
# (0 failed / 7366 passed of 7366) and the identity line below is unchanged. `full` fails when a suite fails or
# leaves test files unreported; each suite's full output is kept in the log it names.
set -uo pipefail
cd "$(dirname "$0")/.."

EXPECTED='{"routeBytes":44865,"fullBytes":249869,"fullHash":"2a2a23be9b3b401c"}'
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

# A suite passes when vitest exits 0 and every test file it collected reports a result: a worker the system kills
# leaves its files out of the counts without failing them.
suite_logs=$(mktemp -d)
run_suite() {
  local name=$1
  shift
  "$@" > "$suite_logs/$name.log" 2>&1
  local code=$?
  grep -E '^ +(Tests|Test Files) ' "$suite_logs/$name.log"
  local files total counted
  files=$(grep -E '^ +Test Files ' "$suite_logs/$name.log" | tail -1)
  total=$(printf '%s' "$files" | sed -nE 's/.*\(([0-9]+)\).*/\1/p')
  counted=$(printf '%s' "$files" | sed -E 's/\([0-9]+\)//' | grep -oE '[0-9]+' | awk '{ s += $1 } END { print s + 0 }')
  if [ "$code" -ne 0 ] || [ -z "$total" ] || [ "$counted" != "$total" ]; then
    echo "   FAIL: $name suite (exit $code, $counted of ${total:-?} files reported); log: $suite_logs/$name.log"
    status=1
  fi
}

if [ "${1:-fast}" = "full" ]; then
  echo "== utils suite =="
  run_suite utils yarn workspace @solidcash/utils vitest run test/
  echo "== solidc suite (expect 0 failed / 7366 passed of 7366) =="
  run_suite solidc yarn workspace @solidcash/solidc vitest run test/
fi

echo "== gate status: $status =="
exit $status
