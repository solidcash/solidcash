#!/usr/bin/env bash
# usage: publish-one.sh <version> <package> [one-time-password]
#
# How SolidCash 0.51.0 was published (2026-11-16). `yarn publish-all` (lerna 3.22) cannot finish npm's sign-in for an
# account whose second factor is a security key, so the packages went out one at a time with npm itself, from the
# checkout of master at tag v<version>, in dependency order: utils solidc solidcash testing solidhat create-solidhat.
#
# Without a password the script only asks npm for a sign-in link for <package>: npm refuses the write, so nothing is
# published. Open the link, sign in with the security key, and npm shows a one-time password; run again with it. One
# password publishes one package, but npm then accepts writes without one for a few minutes, so the script goes on
# down the order until npm asks again, and prints the link for the package it stopped at.
#
# --ignore-scripts keeps each package's prepublishOnly (its whole test suite and lint) from running: run the suites on
# the release commit before publishing. npm still runs `prepare`, a clean rebuild, because pacote packs a directory
# that way. npm processes a publish asynchronously ("may take a few minutes to become available"), so a package can
# be missing from `npm view` just after its publish; `lerna publish from-package` would publish it again and fail.
version=$1; pkg=$2; otp=$3
M=${SOLIDCASH_CHECKOUT:-/Code/cashscript}
LOGS=${PUBLISH_LOG_DIR:-${TMPDIR:-/tmp}/solidcash-publish}
ORDER=(utils solidc solidcash testing solidhat create-solidhat)
[ -n "$version" ] && [[ " ${ORDER[*]} " == *" $pkg "* ]] \
  || { echo "usage: publish-one.sh <version> <package> [one-time-password]; package: ${ORDER[*]}"; exit 1; }
test "$(git -C "$M" rev-parse HEAD)" = "$(git -C "$M" rev-parse "v$version^{commit}" 2>/dev/null)" \
  || { echo "$M is not at v$version, stopping"; exit 2; }
test -z "$(git -C "$M" status --porcelain)" || { echo "$M has local changes, stopping"; exit 2; }
mkdir -p "$LOGS"

attempt() { # <package> [password]; sets LINK
  local p=$1 code=$2 log
  log=$LOGS/$p-$(date +%H%M%S).log
  ( cd "$M/packages/$p" && npm publish --ignore-scripts --auth-type=legacy ${code:+--otp "$code"} ) \
    < /dev/null > "$log" 2>&1
  local e=$?
  echo "[$p] npm exit $e at $(date +%H:%M:%S) (log $log)"
  grep -E '^\+ @solidcash|total files|npm error (code|.*previously published)' "$log" | head -4
  LINK=$(grep -o 'https://www.npmjs.com/login/[0-9a-f-]*' "$log" | tail -1)
  return $e
}

for i in "${!ORDER[@]}"; do [ "${ORDER[$i]}" = "$pkg" ] && start=$i; done
for ((i = start; i < ${#ORDER[@]}; i++)); do
  p=${ORDER[$i]}
  if [ "$(npm view "@solidcash/$p@$version" version 2>/dev/null)" = "$version" ]; then
    echo "[$p] $version is already on npm, skipping"
    continue
  fi
  if attempt "$p" "$otp"; then
    echo "published @solidcash/$p@$version"
    otp=""
    continue
  fi
  if [ -n "$LINK" ]; then
    echo "stopped at $p: sign in at $LINK, then run: publish-one.sh $version $p <password>"
  else
    echo "stopped at $p: npm returned no sign-in link; see the log"
  fi
  exit 3
done
echo "all published from $pkg on"
