#!/usr/bin/env bash
# Compiler A/B harness: measure the working tree against a named baseline commit.
#
#   scripts/perf-ab.sh <baseline-commit> [pairs] [marker]
#
# The working tree's `packages/solidc/src/compiler.ts` is the "new" half; `<baseline-commit>` supplies the "old"
# half. Each half is built and then asserted by grepping the emitted `dist/compiler.js` for `marker` (default:
# the feature string that only the change adds), so an incremental `tsc -b` that silently emits nothing cannot
# masquerade as a baseline - the failure mode that made an earlier round report a delta between two identical
# builds. Name the commit explicitly: documentation-only commits sit on top of code changes in this repository,
# so `HEAD~1` is often not a baseline at all.
#
# Judgement rule: compare `totalCpuMs`/`cpuMs`, not `totalMs`. The machine is shared, and identical
# configurations differ by up to 18% in wall clock between pairs while paired CPU deltas keep their sign.
# A pair whose absolute CPU is far above the others was taken under a sibling session's load; drop it rather
# than averaging it in.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"

baseline=${1:?usage: perf-ab.sh <baseline-commit> [pairs] [marker]}
pairs=${2:-3}
marker=${3:-}
compiler=packages/solidc/src/compiler.ts
emitted=packages/solidc/dist/compiler.js
scratch=$(mktemp -d)
results="$scratch/results.jsonl"
newCopy="$scratch/new-compiler.ts"

cp "$compiler" "$newCopy"
restore() {
  cp "$newCopy" "$compiler"
  yarn build >/dev/null 2>&1 || true
  rm -rf "$scratch"
}
trap restore EXIT

if ! git cat-file -e "${baseline}^{commit}" 2>/dev/null; then
  echo "unknown baseline commit: $baseline" >&2
  exit 2
fi

build_half() {
  local half=$1
  # Restore by writing the file, never `git checkout <commit> -- <path>`: that also updates the index, so a
  # later `git commit` silently commits the baseline over the change being measured.
  if [ "$half" = base ]; then git show "$baseline:$compiler" > "$compiler"; else cp "$newCopy" "$compiler"; fi
  # Touch so an incremental build cannot skip the changed file, then build.
  touch "$compiler"
  yarn build >/dev/null 2>&1
  local found
  found=$(grep -c -- "$marker" "$emitted" || true)
  if [ -n "$marker" ]; then
    if [ "$half" = base ] && [ "$found" != "0" ]; then
      echo "ASSERT FAILED: baseline build at $baseline already contains '$marker'" >&2; exit 1
    fi
    if [ "$half" = new ] && [ "$found" = "0" ]; then
      echo "ASSERT FAILED: working-tree build does not contain '$marker'" >&2; exit 1
    fi
  fi
}

for ((i = 1; i <= pairs; i += 1)); do
  for half in base new; do
    build_half "$half"
    node --max-old-space-size=8192 scripts/perf-project-compile.mjs 2>/dev/null \
      | grep '^\[project-compile\] ' \
      | sed 's/^\[project-compile\] //' \
      | sed "s/^/{\"pair\":$i,\"half\":\"$half\",\"payload\":/;s/$/}/" >> "$results"
  done
done

python3 - "$results" <<'PY'
import json, statistics, sys

pairs = {}
for line in open(sys.argv[1]):
    row = json.loads(line)
    pairs.setdefault(row['pair'], {})[row['half']] = row['payload']
if not pairs:
    print('no measurements collected')
    raise SystemExit(1)

def median(values):
    return statistics.median(values)

print(f"{'pair':<6}{'base cpu':>10}{'new cpu':>10}{'cpu d':>9}{'base wall':>11}{'new wall':>10}")
base_cpu, new_cpu, base_wall, new_wall = [], [], [], []
for pair in sorted(pairs):
    base, new = pairs[pair]['base'], pairs[pair]['new']
    base_cpu.append(base['totalCpuMs']); new_cpu.append(new['totalCpuMs'])
    base_wall.append(base['totalMs']); new_wall.append(new['totalMs'])
    delta = (new['totalCpuMs'] - base['totalCpuMs']) / base['totalCpuMs'] * 100
    print(f"{pair:<6}{base['totalCpuMs']:>10}{new['totalCpuMs']:>10}{delta:>8.2f}%"
          f"{base['totalMs']:>11}{new['totalMs']:>10}")
print(f"{'median':<6}{median(base_cpu):>10.0f}{median(new_cpu):>10.0f}"
      f"{(median(new_cpu) - median(base_cpu)) / median(base_cpu) * 100:>8.2f}%"
      f"{median(base_wall):>11.0f}{median(new_wall):>10.0f}")

roots = [row['root'] for row in pairs[sorted(pairs)[0]]['new']['perRoot']]
print(f"\n{'root':<32}{'base cpu':>10}{'new cpu':>10}{'delta':>9}")
for index, root in enumerate(roots):
    base = [pairs[p]['base']['perRoot'][index]['cpuMs'] for p in sorted(pairs)]
    new = [pairs[p]['new']['perRoot'][index]['cpuMs'] for p in sorted(pairs)]
    print(f"{root:<32}{median(base):>10.0f}{median(new):>10.0f}"
          f"{(median(new) - median(base)) / median(base) * 100:>8.1f}%")

mismatched = [row['root'] for row in pairs[sorted(pairs)[0]]['new']['perRoot']
              if not row.get('fullHash')]
print()
if mismatched:
    print('roots that failed to compile: ' + ', '.join(mismatched))
first = sorted(pairs)[0]
changed = []
for base_row, new_row in zip(pairs[first]['base']['perRoot'], pairs[first]['new']['perRoot']):
    if base_row.get('fullHash') != new_row.get('fullHash'):
        changed.append(f"{base_row['root']} ({base_row.get('fullBytes')} -> {new_row.get('fullBytes')} B)")
if changed:
    print('bytecode differs between halves:')
    for entry in changed:
        print('  ' + entry)
else:
    print('bytecode identical between halves on every root')
PY
