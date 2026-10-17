#!/usr/bin/env bash
# Build the patched BCHN image in a dedicated Docker build container.
#
# The source checkout is not built in place. A temporary context excludes the existing build tree,
# git metadata, and test/bench sources so the build container sees only what the daemon needs.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
bchn_src=${BCHN_SRC:-/Code/bitcoin-cash-node}
tag=${BCHN_IMAGE:-solidcash/bchn-relaxed:29.2.1}

if [ ! -f "$bchn_src/CMakeLists.txt" ]; then
  echo "BCHN source not found at $bchn_src (set BCHN_SRC)" >&2
  exit 1
fi

context=$(mktemp -d)
trap 'rm -rf "$context"' EXIT

tar -C "$bchn_src" \
  --exclude=.git \
  --exclude=build \
  --exclude=depends \
  --exclude=test \
  --exclude=src/test \
  --exclude=src/bench \
  --exclude=src/qt \
  -cf - . | tar -C "$context" -xf -

docker build \
  --file "$root/docker/bchn-relaxed/Dockerfile" \
  --tag "$tag" \
  "$context"

echo "Built $tag"
