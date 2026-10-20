#!/usr/bin/env bash
# Move internal Markdown documents to the orphan branch archive/docs.
#
# The script copies each file at its original path, appends an INDEX.md row, commits the archive, and then
# removes the file from the current branch unless --copy-only is given. It never rewrites archive history.
#
# Usage:
#   scripts/archive-docs.sh [--push] [--copy-only] [--kind TEXT] [--destination TEXT] [--remote NAME] <path>...
#
# Examples:
#   scripts/archive-docs.sh docs/wip/my-stream/HANDOFF.md
#   scripts/archive-docs.sh --push --kind snapshot --destination docs/framed/DECISIONS.md docs/wip/my-stream/*.md

set -euo pipefail

BRANCH="${ARCHIVE_BRANCH:-archive/docs}"
REMOTE="${ARCHIVE_REMOTE:-mew}"
KIND="archived document"
DESTINATION="see docs/README.md"
PUSH=0
COPY_ONLY=0
PATHS=()

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --push) PUSH=1 ;;
    --copy-only) COPY_ONLY=1 ;;
    --kind) KIND="$2"; shift ;;
    --destination) DESTINATION="$2"; shift ;;
    --remote) REMOTE="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) PATHS+=("$1") ;;
  esac
  shift
done

if [ "${#PATHS[@]}" -eq 0 ]; then
  usage >&2
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

for path in "${PATHS[@]}"; do
  if ! git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
    echo "Not a tracked file: $path" >&2
    exit 1
  fi
  case "$path" in
    INDEX.md|*/INDEX.md) echo "Refusing to archive an index: $path" >&2; exit 1 ;;
    *.md) ;;
    *) echo "Refusing to archive a non-Markdown file: $path" >&2; exit 1 ;;
  esac
done

# Reuse the worktree that already has the archive branch checked out, or create a temporary one.
WT="$(git worktree list --porcelain | awk -v ref="refs/heads/$BRANCH" '
  $1 == "worktree" { worktree = $2 }
  $1 == "branch" && $2 == ref { print worktree; exit }
')"
CREATED=0
if [ -z "$WT" ]; then
  WT="$(mktemp -d "${TMPDIR:-/tmp}/archive-docs.XXXXXX")"
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git worktree add "$WT" "$BRANCH" >/dev/null
  else
    git worktree add --orphan -b "$BRANCH" "$WT" >/dev/null
  fi
  CREATED=1
fi

cleanup() {
  if [ "$CREATED" -eq 1 ]; then
    git worktree remove --force "$WT" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [ -n "$(git -C "$WT" status --porcelain)" ]; then
  echo "The archive worktree has uncommitted changes: $WT" >&2
  exit 1
fi

TODAY="$(date +%F)"
SHORT_HEAD="$(git rev-parse --short HEAD)"
ROWS="$(mktemp "${TMPDIR:-/tmp}/archive-rows.XXXXXX")"
trap 'rm -f "$ROWS"; cleanup' EXIT

for path in "${PATHS[@]}"; do
  if git -C "$WT" cat-file -e "HEAD:$path" 2>/dev/null; then
    echo "Already on $BRANCH: $path" >&2
    exit 1
  fi
  mkdir -p "$WT/$(dirname "$path")"
  git show "HEAD:$path" > "$WT/$path"
  first="$(git log --diff-filter=A --format=%cs -- "$path" | tail -1)"
  last="$(git log -1 --format=%cs -- "$path")"
  commit="$(git log -1 --format=%h -- "$path")"
  [ -n "$first" ] || first="$last"
  printf '| `%s` | %s | %s | %s | `%s` | %s |\n' "$path" "$KIND" "$first" "$last" "$commit" "$DESTINATION" >> "$ROWS"
done

if [ ! -f "$WT/INDEX.md" ]; then
  cat > "$WT/INDEX.md" <<'EOF'
# SolidCash documentation archive

This orphan branch holds internal documents removed from `master` as closed, superseded, or historical. Files
keep the path they had, so an old citation resolves with `git show archive/docs:<path>`.

Archived text is history, not instructions. Check current code and the live ledgers before acting on it.
EOF
fi

{
  printf '\n## Batch %s\n\n' "$TODAY"
  printf 'Archived from `master` at `%s`. %s file(s).\n\n' "$SHORT_HEAD" "${#PATHS[@]}"
  printf '| path | kind | first seen | last active | last commit | open items now live in |\n'
  printf '| --- | --- | --- | --- | --- | --- |\n'
  cat "$ROWS"
} >> "$WT/INDEX.md"

git -C "$WT" add -A
git -C "$WT" commit -q -m "docs(archive): archive ${#PATHS[@]} document(s) from $SHORT_HEAD"

if [ "$PUSH" -eq 1 ]; then
  git -C "$WT" push "$REMOTE" "$BRANCH"
fi

echo "Archived ${#PATHS[@]} document(s) on $BRANCH at $(git -C "$WT" rev-parse --short HEAD)."
if [ "$PUSH" -eq 0 ]; then
  echo "Push with: git push $REMOTE $BRANCH"
fi

if [ "$COPY_ONLY" -eq 0 ]; then
  for path in "${PATHS[@]}"; do
    git rm -q "$path"
  done
  echo "Removed ${#PATHS[@]} document(s) from the working tree; review and commit."
fi

echo
echo "Citations that still name an archived document:"
for path in "${PATHS[@]}"; do
  basename="$(basename "$path")"
  git grep -n -F "$basename" -- ':!website' ":!$path" || true
done
echo "Replace a citation with archive/docs:<path>."
