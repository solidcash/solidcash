#! /usr/bin/env sh

DIR=$(dirname "$0")
cd $DIR

CASHC="../../../solidc/dist/solidc-cli.js"

find . -maxdepth 1 -name "*.scash" | while read fn; do
    echo node "$CASHC" "$fn" -o "$(basename "$fn" .scash).json"
    node "$CASHC" "$fn" -o "$(basename "$fn" .scash).json"
    echo node "$CASHC" "$fn" -o "$(basename "$fn" .scash).artifact.ts" -f ts
    node "$CASHC" "$fn" -o "$(basename "$fn" .scash).artifact.ts" -f ts
done

echo node "$CASHC" "hodl_vault.scash" -o "$(basename "hodl_vault.scash" .scash)-unenforced-types.artifact.ts" -f ts -S
node "$CASHC" "hodl_vault.scash" -o "$(basename "hodl_vault.scash" .scash)-unenforced-types.artifact.ts" -f ts -S
