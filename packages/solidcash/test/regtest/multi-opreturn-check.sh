#!/bin/sh
# Task 5 regtest check: does the real BCHN node's mempool policy accept a transaction with MULTIPLE
# OP_RETURN outputs (the layer-3 transcript uses two - msg.sender + result records)?
# Requires the regtest stack up (docker-compose.regtest.yml). Prints testmempoolaccept -> expect allowed:true.
set -e
CTR="${BCHN_CONTAINER:-cashscript-bchn-1}"
docker exec "$CTR" sh -c '
CLI="bitcoin-cli -regtest -rpcuser=user -rpcpassword=password"
# Two OP_RETURN outputs (data), no inputs; fundrawtransaction adds an input + change.
RAW=$($CLI createrawtransaction "[]" "[{\"data\":\"04534342310011\"},{\"data\":\"6a08deadbeefcafe\"}]")
FUNDED=$($CLI fundrawtransaction "$RAW")
FHEX=$(echo "$FUNDED" | sed -n "s/.*\"hex\": *\"\([0-9a-f]*\)\".*/\1/p")
SIGNED=$($CLI signrawtransactionwithwallet "$FHEX")
SHEX=$(echo "$SIGNED" | sed -n "s/.*\"hex\": *\"\([0-9a-f]*\)\".*/\1/p")
echo "testmempoolaccept for a 2-OP_RETURN transaction:"
$CLI testmempoolaccept "[\"$SHEX\"]"
'
