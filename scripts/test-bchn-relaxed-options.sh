#!/usr/bin/env bash
# Verify the patched BCHN image accepts the relaxed consensus options on regtest and rejects them elsewhere.
set -euo pipefail

image=${BCHN_IMAGE:-solidcash/bchn-relaxed:29.2.1}
args=(
  -maxscriptsigsize=10000000
  -maxstackitemsize=10000000
  -maxstacksize=1000000
  -maxtxsize=100000000
  -maxtokencommitmentsize=10000000
  -maxopcostperinputbyte=1000000
  -maxhashitersperinputbyte=10000000
)

echo "== version =="
docker run --rm --entrypoint /usr/local/bin/bitcoind "$image" -version

echo "== regtest startup with relaxed options =="
regtest_log=$(mktemp)
if docker run --rm --entrypoint /bin/sh "$image" -c \
  "mkdir -p /tmp/bchn-options && timeout 8 bitcoind -regtest -datadir=/tmp/bchn-options ${args[*]} -printtoconsole" \
  >"$regtest_log" 2>&1; then
  echo "bitcoind exited unexpectedly"
  cat "$regtest_log"
  rm -f "$regtest_log"
  exit 1
fi
if grep -q "Invalid parameter" "$regtest_log"; then
  echo "relaxed option was rejected"
  cat "$regtest_log"
  rm -f "$regtest_log"
  exit 1
fi
grep -E "Bitcoin Cash Node|Loading blocks|Done loading" "$regtest_log" | head -3
rm -f "$regtest_log"

echo "== non-regtest rejection =="
mainnet_log=$(mktemp)
if docker run --rm --entrypoint /bin/sh "$image" -c \
  "mkdir -p /tmp/bchn-mainnet && bitcoind -datadir=/tmp/bchn-mainnet -maxscriptsigsize=20000 -printtoconsole" \
  >"$mainnet_log" 2>&1; then
  echo "mainnet accepted a regtest-only option"
  cat "$mainnet_log"
  rm -f "$mainnet_log"
  exit 1
fi
grep -q "Consensus limit overrides are only supported on regtest" "$mainnet_log"
grep -E "Consensus limit overrides|Error" "$mainnet_log" | head -3
rm -f "$mainnet_log"

echo "bchn-relaxed option gating: PASS"
