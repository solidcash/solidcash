# Libauth fork performance (W1)

Measured 2026-10-05 on `feat/framed` at `57dfa942e`.

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

At 4 KB bodies that is about 250 times. SDK overrides do not touch the clone. A debug trace that clones every step pays this. A single `stateEvaluate` clones once, at the start, so a normal framed execution does not.

## What the fork makes redundant (superseded by the 2026-10-10 addendum at the end)

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
2. After `yarn build:wasm`, a rerun still threw once: `secp256k1.spec.ts` could not open the unplugged native package `secp256k1@5.0.0`. The wasm VM tests had already passed. The package zip was in `.yarn/cache` and was extracted to the unplugged path Yarn named. `import('secp256k1')` then loaded.
3. The restored `yarn test:unit` exited 0. Ava reported 1328 passed, 118 known failures, 1985 skipped, and 78 todo. There was no uncaught exception. The log is `w1-libauth-suite.log` and ends with `YARN_TEST_UNIT_EXIT=0`. The 118 known failures are Ava's expected-failure count, not a non-zero exit.

## Marketplace titles

The four-cell matrix has not been repeated on marketplace titles. Every marketplace number in
`PERF_KERNEL_VS_FRAMED.md` is stock `@bitauth/libauth` from `node_modules`, with the SDK overrides on.
That doc records the proxied framed lane (take job 62.208 s, approve result 131.787 s, worker CPU 80.9
percent VM), the kernel proxied lane (take job 126.242 s, approve result 111.212 s, no CPU profile), and
the no-proxy framed sanity titles (approve sanity 1044.307 s, refund sanity 718.767 s, worker CPU 89.5
percent VM). Kernel transaction bytes, fee, and input counts were not collected on that kernel run.

## Addendum (2026-10-10): the fork is now the resolved package, and it has grown

The decision above chose an upstream PR. The repo instead pinned the fork's committed dist build: `package.json`
resolves `@bitauth/libauth` to `git+https://github.com/mainnet-pat/libauth.git#vm-performance-dist` (`5b2e5e4ea`,
2026-10-08), the committed build of branch `vm-performance` at `c705e4b4`. That series is wider than the four
`perf-vm-fixes` commits the table above measured. It also caches the OP_ACTIVEBYTECODE encoding per instruction list and
code separator (`0768b3f5`), pushes OP_INPUTBYTECODE's unlocking bytecode without a copy (`006372b8`), decodes each
OP_INVOKE body once (`f75a8886`), shares the function table between a clone and its source (`66a81eb3`), decodes and
encodes small VM numbers with Number arithmetic (`17789703`, `72958b9a`), and allocates each push once (`06d82b98`).
The installed build is byte-identical to that branch's `build/`.

Re-evaluated against that build, the `installXXX` overrides in
`packages/solidcash/src/network/createVirtualMachine.ts`:

| override | the fork build | action |
|---|---|---|
| the duplicating operations (OP_DUP, OP_IFDUP, OP_OVER, OP_2DUP, OP_3DUP, OP_2OVER, OP_TUCK) | covered (`b3371211`) | removed |
| OP_DEFINE's compact body | covered (`da4cc27a`: `createOpDefine` stores `functionBody.slice()`) | removed |
| OP_SPLIT's views | covered (`da4cc27a`) | kept, for the split trace |
| OP_PICK | covered (`b3371211`) | kept, for the pick trace |
| OP_ACTIVEBYTECODE's cached encoding | covered (`0768b3f5`) | removed |
| OP_INPUTBYTECODE's push without a copy | covered (`006372b8`) | removed |
| OP_INVOKE's decoded-body cache | covered (`f75a8886`) | kept: the install also carries the invoke traces |
| OP_INVOKE's return probe, `invokeTrace`, `invoke-boundary` | not covered | kept (read by `preflight.ts`) |
| the per-operation limit check (`every`) | not covered: libauth still measures the cost and re-runs every check | kept |
| the P2SH decode cache, the failed-close recorder, the step trace, the sparse-probe branch skips | not covered | kept |

`installZeroCopyStackOperations` is now `installStackOperationTraces`: it installs only OP_PICK and OP_SPLIT, so the
last reads of a mis-indexed slot and the operands and frames of a failing split are still named under
`SOLIDC_DEBUG_SPLIT_FAILURE`, while every other stack operation is libauth's own.

Two residual notes. The pin names a mutable branch, so the fork's coverage is not pinned by content: a moved branch
would silently change what the removals relied on. And `installCachedInvokeEvaluator` still reimplements OP_INVOKE; the
invoke traces it carries would need re-homing onto libauth's `opInvoke` before that install can go.
