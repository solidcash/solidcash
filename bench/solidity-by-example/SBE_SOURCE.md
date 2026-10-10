# solidity-by-example bench corpus (source pin)

This directory holds ONLY the SolidCash bench **harness** (`bench.mjs`, `_bench/run.mjs`, `categorize.mjs`).
The solidity-by-example contracts are **not** vendored into this repository - the harness compiles them from a
sibling checkout so we don't carry third-party Solidity in-tree.

The corpus is compiled **as-is** (correctness, not porting): we measure how far `solidc` gets on the unmodified
upstream sources. There are no source interventions.

## Pinned upstream

- Repo: https://github.com/solidity-by-example/solidity-by-example.github.io
- Branch: `gh-pages`
- Commit: **`5bcdca0239409d7336a07b66a6fca8d0bcc710e6`** ("metrge")

## Where the harness expects it

Default: a checkout at `../solidity-by-example` relative to the repo root (i.e. `/Code/solidity-by-example`,
a sibling of `cashscript`). Override with the `SBE_ROOT` env var if you keep it elsewhere.

## Recreate the corpus

```bash
git clone -b gh-pages https://github.com/solidity-by-example/solidity-by-example.github.io ../solidity-by-example
git -C ../solidity-by-example checkout 5bcdca0239409d7336a07b66a6fca8d0bcc710e6
```

## Run

```bash
node bench.mjs        # or: SBE_ROOT=/path/to/solidity-by-example node bench.mjs
```
