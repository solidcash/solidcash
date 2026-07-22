# Pure-script keccak256 (proof of concept)

A working keccak256 implemented entirely in BCH-2026 Script - **no `OP_KECCAK` opcode, no solidc
compiler**. The script is generated directly in JS and its output matches Ethereum's keccak256.

## Result

- `keccak256` of the empty string and of dynamic preimages computed on the BCH VM **match the EVM
  hash exactly** (checked against the `keccak` npm lib).
- A real **contract spend** (`spend.mjs`, SDK + MockNetworkProvider) verifies `keccak256(preimage)
  == expectedHash` on-chain; wrong hashes are rejected.

## How it works

- Lanes are 8 bytes stored **big-endian**, so `(x<<k)|(x>>(64-k))` (LSHIFTBIN/RSHIFTBIN) is a correct
  64-bit `ROTL`. Bitwise `~` = XOR with `0xff..ff` (OP_INVERT is consensus-disabled).
- The shipped artifact keeps the 25 lanes as **separate stack items** (the optimized form; the
  initial version used one 200-byte blob - see *Optimization results*). Each round (theta, rho, pi,
  chi, iota) is built functionally; the round body is factored via `OP_DEFINE`/`OP_INVOKE` so it fits
  the 10 KB bytecode limit (~1.8 KB redeem script for the full 24-round permutation + sponge).
- Sponge: absorb reverses each 8-byte message word into a BE lane (Ethereum pad `0x01..0x80`);
  squeeze reverses lanes 0-3.
- A budget-padding `pad` argument (dropped by the script) sizes the input so the per-input
  operation-cost budget covers the ~2.2M-op computation.

## Files

- `keccak.mjs`   - JS keccak-f oracle (validated against the `keccak` lib).
- `vm.mjs`       - libauth BCH-2026 VM harness.
- `gen25.mjs`    - **optimized** generator (25 separate lane items); used by the shipped artifact.
- `genvar.mjs`   - **variable-length** generator (arbitrary input, multi-block; 25-lane state + a
  runtime absorb loop with full Ethereum padding).
- `gen.mjs`      - original/reference generator (200-byte blob state).
- `test-perm25.mjs` / `test-msg25.mjs` - validate + measure the optimized permutation / full hash.
- `test-var.mjs` - validate variable-length keccak256 vs EVM across lengths (pad edges + multi-block).
- `test-round.mjs` / `test-perm.mjs` / `test-empty.mjs` / `test-msg.mjs` - blob-version validation.
- `build-artifact.mjs` - emits `Keccak256.artifact.json` (a hand-authored SolidCash artifact).
- `spend.mjs`    - standalone contract spend verifying script output == EVM keccak256.

## Run

```
node keccak-poc/test-msg25.mjs   # optimized full keccak256 vs EVM, with op-cost metrics
node keccak-poc/spend.mjs        # contract spend (SDK + MockNetworkProvider) vs EVM
```

## Optimization results (measured on the BCH-2026 VM)

The cost model (CHIP-2021-05) is, in practice,
`operationCost ~= 100 * evaluatedInstructionCount + 1 * stackPushedBytes`, with a per-input budget of
`~800 * unlockingBytecodeLength`. Two representations of the full keccak256 (single 32-byte block):

| metric | blob (200-byte state) | 25 separate lanes | improvement |
|--------|----------------------:|------------------:|:-----------:|
| operation cost      | 5,822,910 | 2,205,012 | **2.64x** |
| evaluated instrs    |    40,251 |    20,635 | 1.95x |
| stack pushed bytes  | 1,797,810 |   141,512 | **12.7x** |
| redeem script bytes |     2,728 |     1,778 | 1.54x |
| budget-pad input    |     ~5 KB |   ~1.5 KB | 3.3x |

The blob version was **pushed-bytes-bound** (the 200-byte blob is copied on every lane access).
Storing the 25 lanes as separate 8-byte items makes each access an 8-byte `OP_PICK` (no SPLIT, no CAT
rebuild) - cutting pushed bytes ~13x and flipping the bottleneck to **instruction count**.
`gen25.mjs` is the optimized generator; the shipped `Keccak256.artifact.json` uses it.

### Remaining headroom (diminishing returns)

At ~20.6k instructions the cost is now instruction-bound (~2.06M of 2.2M). Per round (~860 instrs)
the big chunks are the 60-item intermediate cleanup (~180) and the rotations (~180). Further options,
each smaller and more complex: in-place chi (2 temps/row) to skip the A'[25] buffer + its cleanup;
in-place theta; SPLIT/CAT for the two byte-aligned rotation offsets. These could reach ~1.6-1.8M but
add real complexity; the practical floor on a stack VM is ~1.2M.

**Bytecode size** is a non-issue (1.8 KB << 10 KB limit). A loop (OP_BEGIN/OP_UNTIL + an RC table)
would shave the 24 invoke/iota sequences but not the op cost, so it isn't worth the RC-indexing cost.

## Variable-length (genvar.mjs)

`genKeccak256var` hashes an **arbitrary-length** message: it pads in script (Ethereum `0x01..0x80`,
to a multiple of the 136-byte rate) and absorbs block-by-block in an `OP_BEGIN/OP_UNTIL` loop over the
25-lane state. Verified vs EVM for lengths 0..300 incl. every pad edge (135 = single `0x81` pad byte;
136 and 272 = full-block boundaries that need an extra block). Cost is linear at **~2.25M op / block**
(1 block 2.26M, 2 -> 4.5M, 3 -> 6.76M); script ~2.3 KB.

The blob permutation (~5.8M/block) cannot do multi-block - 2 blocks exceed the budget - which is why
the variable-length path uses the 25-lane permutation.

**Practical cap: ~3 blocks (~408 bytes) per input - bounded by *compute*, not message size.** The
per-input op budget is `~32,800 + 800 * unlockingLength`, and the unlocking length is capped at 10,000
bytes (consensus `maximumBytecodeLength`, confirmed in libauth - multi-push doesn't help, 11,999 B is
rejected). So the budget maxes at ~8M op -> ~3 keccak blocks. The budget is strictly per-input and
cannot be pooled across inputs in one tx.

**Note: optimizing for compute budget increases the max message size.** Because the cap is
op-budget / op-per-block, reducing the permutation cost directly raises the reachable input size:
in-place chi/theta (~2.25M -> ~1.6M/block) reaches ~5 blocks (~680 B); the ~1.2M floor reaches ~6-7
blocks (~900 B). For unbounded input, a chained-tx streaming sponge (commit the 200-byte state between
transactions, absorb ~3 blocks per tx, squeeze at the end) removes the size limit at `ceil(blocks/3)`
transactions.

## Limits / caveats

- Variable-length is capped at ~3 blocks per input (above). The shipped artifact is the fixed 32-byte
  single-block form; `genvar.mjs` is the general path.
- Reclassifies keccak256 in the Solidity gap analysis from Category D ("N/A - no Keccak opcode") to
  implementable. (ecrecover stays impractical - separate problem.)
