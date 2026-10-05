# Libauth fork performance (W1)

Measured 2026-10-05 on `feat/per-call` at `57dfa942e`.

| cell | libauth | SDK overrides |
|---|---|---|
| stock off | `node_modules/@bitauth/libauth` `3.1.0-next.8` | not installed |
| stock on | same | `createVirtualMachineBch2026ForProvider` with `maximumInputBytes` 10,000,000, so the zero-copy stack ops, the bigint `OP_SPLIT` index, and the fast limit check install |
| fork off | `/Code/libauth` branch `perf-vm-fixes`, `3.1.0-next.8-solidcash.1`, head `f3be79bd` | not installed |
| fork on | same | same provider path, loading the fork through a module hook |

Fork commits under test: `7d141363` encodeDataPush copies once, `20df1db2` function table shared with conditional copy-on-write, `5549fdb4` dup-family ops push references, `40fa1c3f` `OP_SPLIT` returns views.

The micro-benchmark is one script per opcode family, run on the VM's `stateEvaluate`. Operand sizes are 32, 256, 1,024, 4,096, and 8,192 bytes (the consensus stack item cap is 10,000). Each script's unlocking bytecode is 80,000 bytes so the density budget can finish the loop; those bytes are not executed. Times are the median of 5 runs (3 for `OP_DEFINE`), in milliseconds. VM share of these runs is 100 percent: there is no compilation and no derivation. A 256-byte dup + split + cat left the same stack on all four cells (`top` hex starts `05162738495a6b7c`, length 256, no error).

## Opcode families (ms)

`OP_DUP` + `OP_DROP` x200, `OP_SPLIT` at half the item x200, `OP_CAT` x200, `OP_PICK` depth 4 x200, `OP_SHA256` x40.

| family | size | stock off | stock on | fork off | fork on |
|---|---:|---:|---:|---:|---:|
| dup | 32 | 0.559 | 0.450 | 0.539 | 0.451 |
| dup | 256 | 0.320 | 0.161 | 0.247 | 0.133 |
| dup | 1024 | 0.120 | 0.051 | 0.050 | 0.049 |
| dup | 4096 | 0.408 | 0.031 | 0.034 | 0.031 |
| dup | 8192 | 0.638 | 0.030 | 0.047 | 0.044 |
| split | 32 | 0.685 | 0.629 | 0.650 | 0.589 |
| split | 256 | 0.751 | 0.613 | 0.560 | 0.616 |
| split | 1024 | 0.642 | 0.292 | 0.376 | 0.378 |
| split | 4096 | 1.112 | 0.174 | 0.191 | 0.154 |
| split | 8192 | 1.312 | 0.134 | 0.219 | 0.175 |
| cat | 32 | 0.394 | 0.405 | 0.407 | 0.407 |
| cat | 256 | 0.626 | 0.478 | 0.542 | 0.508 |
| cat | 1024 | 0.450 | 0.487 | 0.540 | 0.494 |
| cat | 4096 | 0.293 | 0.462 | 0.612 | 0.506 |
| cat | 8192 | 0.484 | 0.925 | 0.842 | 0.546 |
| pick | 32 | 0.361 | 0.294 | 0.306 | 0.296 |
| pick | 256 | 0.207 | 0.225 | 0.203 | 0.188 |
| pick | 1024 | 0.231 | 0.164 | 0.138 | 0.140 |
| pick | 4096 | 0.290 | 0.074 | 0.112 | 0.107 |
| pick | 8192 | 0.483 | 0.078 | 0.080 | 0.075 |
| sha256 | 32 | 0.362 | 0.358 | 0.386 | 0.348 |
| sha256 | 256 | 0.512 | 0.487 | 0.486 | 0.490 |
| sha256 | 1024 | 0.437 | 0.442 | 0.434 | 0.432 |
| sha256 | 4096 | 1.337 | 1.271 | 1.326 | 1.292 |
| sha256 | 8192 | 2.568 | 2.411 | 2.427 | 2.548 |

`OP_CAT` and `OP_SHA256` do not get faster. Cat must allocate the joined item. SHA256 is the control. Above 4 KB, dup, split, and pick on stock without overrides are the slow cells. The fork without overrides matches the SDK overrides on dup and pick. Split stays a little faster with the SDK override (0.134 ms vs 0.219 ms at 8,192 bytes) because that override reads the index as a bigint instead of `Number([value])`.

## encodeDataPush (ms for 20 calls)

This is the push encoder, not an opcode. The SDK overrides do not wrap it.

| size | stock off | stock on | fork off | fork on |
|---:|---:|---:|---:|---:|
| 32 | 0.006 | 0.005 | 0.003 | 0.003 |
| 4096 | 0.731 | 0.694 | 0.031 | 0.029 |
| 65536 | 14.582 | 14.970 | 0.449 | 0.523 |
| 262144 | 57.091 | 56.938 | 1.256 | 1.233 |
| 1048576 | 271.728 | 272.587 | 6.202 | 6.507 |

At 1 MiB the fork is about 44 times faster (272 ms vs 6.2 ms). Per-call redeem scripts are large, so this is the dominant libauth cost in script building.

## Function table

In-place `OP_DEFINE` x441 is the same speed on stock and the fork (under 1 ms). Stock already assigns the table in place during `stateEvaluate`. The cost the fork removes is the clone: stock's `partiallyCloneProgramState` deep-copies `functionTable`; the fork shares it and copies only on the next `OP_DEFINE` while the table is marked shared. 100 clones after 441 defines:

| body size | stock off | stock on | fork off | fork on |
|---:|---:|---:|---:|---:|
| 64 | 30.803 | 29.090 | 0.955 | 0.926 |
| 1024 | 71.897 | 70.995 | 0.610 | 0.660 |
| 4096 | 132.497 | 132.264 | 0.519 | 0.537 |

At 4 KB bodies that is about 250 times. SDK overrides do not touch the clone. A debug trace that clones every step pays this. A single `stateEvaluate` clones once, at the start, so a normal per-call execution does not.

## What the fork makes redundant

Keep the SDK overrides until the resolved `@bitauth/libauth` is the fork. Removing them on stock `3.1.0-next.8` regresses dup, split, and pick above 4 KB (the stock-off column).

Once the fork is the resolved package:

- Dup-family reference pushes and `OP_PICK` reference pushes in `installZeroCopyStackOperations` match the fork. They can go.
- `OP_SPLIT` views match the fork. The bigint index decode is still faster in the SDK (the 8 KB row). Keep that override, or send it upstream with the four commits.
- `encodeDataPush` and the function-table clone have no SDK equivalent. Only the fork fixes them.
- The fast per-operation limit check and the zero-copy active/input bytecode pushes are SDK work, not in these four commits. They stay either way.

## Decision

**Upstream PR**, not an npm alias and not a published package.

The four commits on `perf-vm-fixes` are the patch. Adopting them in this repo by a Yarn 1 `resolutions` entry would not reach downstream consumers. An npm alias needs a published package, and publishing to the public registry was not approved in this session. A `file:` link to `/Code/libauth` would fail a clean-clone `yarn && yarn build`.

No dependency change is in the tree. The measured case for the PR is the encodeDataPush result (about 44x at 1 MiB) and the function-table clone (about 250x at 4 KB bodies), with dup, split, and pick matching the SDK overrides above 4 KB. `OP_CAT` and `OP_SHA256` are unchanged, which is the expected control.

## Fork test suite

`yarn test:unit` (`c8 ava`) on `/Code/libauth`.

1. Without `yarn build:wasm`, five tests failed with `ENOENT` for `ripemd160.wasm`, `sha1.wasm`, `sha256.wasm`, `sha512.wasm`, and `secp256k1.wasm`. `test:unit` does not copy wasm; `yarn build` does. That run is not the suite result.
2. After `yarn build:wasm`, the wasm tests passed, including `getEmbeddedSecp256k1Binary` and the BCH-2026 `OP_DEFINE` copy-on-write specs. The run reported 1271 passed, 118 known failures, 1985 skipped, 77 todo, and 1 uncaught exception: `src/lib/crypto/secp256k1.spec.ts` could not open the unplugged native package `secp256k1@5.0.0` at `.yarn/unplugged/secp256k1-npm-5.0.0-cbca9dfca0`. That is a missing install artifact, not a VM assertion. The log is `w1-libauth-suite.log`. A rerun after the native package is materialized is required before this cell is exit 0.

## Marketplace titles

Not in this revision. The same four cells still have to time approve sanity and refund sanity on the no-proxy lane, approve result and take job on the proxied lane, and those titles on the kernel lane, with wall time and VM share. The harness recipe in `UPSTREAM_PLAN.md` section 1 applies, including a fixture recompile. Those numbers land in this file before the release commit. The micro-benchmark above is the opcode-family half of the matrix and does not depend on them.
