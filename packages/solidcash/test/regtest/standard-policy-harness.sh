#!/usr/bin/env bash
# Audit P13: a committed, reproducible STANDARD-POLICY harness for the layer-3 N-party lifecycle.
#
# Regtest defaults to acceptnonstdtxn=1 (accepts non-standard txs), which only proves consensus-node
# acceptance. This harness recreates the bchn node with -acceptnonstdtxn=0 (mainnet standard relay policy),
# runs the N-party execution-transcript lifecycle against it, then restores the node - so the standard-policy
# result is reproducible, not a one-off manual assertion.
#
# Usage (from repo root, with the regtest stack up):  bash packages/solidcash/test/regtest/standard-policy-harness.sh
set -euo pipefail

COMPOSE="docker-compose.regtest.yml"
PROJECT="cashscript"
BCHN="cashscript-bchn-1"
FLAG="-acceptnonstdtxn=0"

cli() { docker exec "$BCHN" bitcoin-cli -regtest -rpcuser=user -rpcpassword=password "$@"; }
wait_healthy() {
  for _ in $(seq 1 20); do
    [ "$(docker inspect "$BCHN" --format '{{.State.Health.Status}}' 2>/dev/null)" = "healthy" ] && return 0
    sleep 3
  done
  echo "bchn did not become healthy" >&2; return 1
}

echo "== standard-policy harness =="
if grep -q "acceptnonstdtxn" "$COMPOSE"; then
  echo "compose already sets acceptnonstdtxn; aborting to avoid clobbering" >&2; exit 1
fi

# 1. Recreate bchn with standard policy (non-standard acceptance DISABLED).
cleanup() {
  echo "-- restoring bchn to default policy --"
  git checkout -- "$COMPOSE" 2>/dev/null || sed -i "\|      $FLAG|d" "$COMPOSE"
  docker compose -p "$PROJECT" -f "$COMPOSE" up -d --force-recreate bchn >/dev/null 2>&1 || true
  wait_healthy || true
}
trap cleanup EXIT

sed -i "s|^      -upgrade12activationtime=.*|&\n      $FLAG|" "$COMPOSE"
docker compose -p "$PROJECT" -f "$COMPOSE" up -d --force-recreate bchn >/dev/null
wait_healthy
echo "bchn recreated with $FLAG; chain at block $(cli getblockchaininfo | grep -o '"blocks": [0-9]*' | grep -o '[0-9]*')"

# 2. Run the N-party lifecycle under standard relay policy.
echo "-- running N-party lifecycle against the standard-policy node --"
TESTS_USE_REGTEST=true yarn vitest run --no-file-parallelism \
  packages/solidcash/test/e2e/Layer3ControllerGenesis.test.ts \
  packages/solidcash/test/e2e/Layer3Heterogeneous.test.ts

echo "== PASS: the N-party execution-transcript lifecycle is accepted under mainnet standard policy =="
