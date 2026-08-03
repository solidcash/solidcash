#!/usr/bin/env bash
# Reproducible live BCHN proof for the controllerless single-transaction bus.
#
# The temporary Compose override runs BCHN with mainnet standard relay policy. No tracked file is edited, and
# the original regtest service is restored on exit. Every selected test deploys participant resources and each
# participant's static verifier pool once, then broadcasts one controllerless application transaction. That final
# transaction consumes and recreates a genesis verifier for each participant; it creates no execution-specific
# controller, verifier, root, or setup UTXO.
#
# Usage from the repository root:
#   bash packages/solidcash/test/regtest/standard-policy-harness.sh
set -euo pipefail

COMPOSE="docker-compose.regtest.yml"
PROJECT="cashscript"
BCHN="cashscript-bchn-1"

if [[ ! -f "$COMPOSE" ]]; then
  echo "run this harness from the repository root" >&2
  exit 1
fi

override_file="$(mktemp)"
cli() { docker exec "$BCHN" bitcoin-cli -regtest -rpcuser=user -rpcpassword=password "$@"; }
wait_healthy() {
  for _ in $(seq 1 30); do
    if [[ "$(docker inspect "$BCHN" --format '{{.State.Health.Status}}' 2>/dev/null || true)" == "healthy" ]]; then
      return 0
    fi
    sleep 3
  done
  echo "bchn did not become healthy" >&2
  return 1
}
restore() {
  echo "-- restoring BCHN's default regtest policy --"
  docker compose -p "$PROJECT" -f "$COMPOSE" up -d --force-recreate bchn >/dev/null 2>&1 || true
  wait_healthy || true
  rm -f "$override_file"
}
trap restore EXIT

cat >"$override_file" <<'YAML'
services:
  bchn:
    command:
      - bitcoind
      - -regtest
      - -server=1
      - -txindex=1
      - -rpcuser=user
      - -rpcpassword=password
      - -rpcallowip=0.0.0.0/0
      - -rpcbind=0.0.0.0
      - -zmqpubhashblock=tcp://0.0.0.0:28332
      - -upgrade12activationtime=1762596456
      - -acceptnonstdtxn=0
YAML

echo "== controllerless single-transaction bus: live standard-policy proof =="
docker compose -p "$PROJECT" -f "$COMPOSE" -f "$override_file" up -d --force-recreate bchn >/dev/null
wait_healthy
if ! docker inspect "$BCHN" --format '{{json .Config.Cmd}}' | grep -q -- '-acceptnonstdtxn=0'; then
  echo "BCHN did not start with -acceptnonstdtxn=0" >&2
  exit 1
fi
if [[ "$(cli getnetworkinfo | tr -d '\n ' | grep -o '"localrelay":true' || true)" != '"localrelay":true' ]]; then
  echo "BCHN is not relaying transactions" >&2
  exit 1
fi
echo "BCHN healthy at block $(cli getblockcount), acceptnonstdtxn=0"

# Heterogeneous state+return, three-party transitive return chain, and the three effect families required by
# the completion specification. Vitest executes the selected tests serially against one live provider.
TESTS_USE_REGTEST=true yarn workspace solidcash test \
  test/journal-message-bus/e2e/Layer3SingleTxCompose.test.ts --no-file-parallelism \
  -t 'builds and broadcasts one transaction|converges nested authenticated returns|binds an emitted event row|authenticates a BCH transfer|authenticates repeated fungible-token calls'

# The published eight-participant shape is the protocol maximum under stock BCH-2026 operation density and
# transaction size. This test verifies every input, pins the exact capacity reading, and broadcasts those bytes.
TESTS_USE_REGTEST=true yarn workspace solidcash test \
  test/journal-message-bus/e2e/Layer3SingleTxCapacity.test.ts --no-file-parallelism -t '8-participant'

echo "== PASS: all controllerless capstones were accepted by BCHN under standard relay policy =="
