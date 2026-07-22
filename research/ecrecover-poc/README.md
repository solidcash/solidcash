# ecrecover-poc

Pure-script secp256k1 public-key recovery for BCH-2026, built and **verified on the real VM**
(`@bitauth/libauth` `createVirtualMachineBch2026`) against `@noble/curves`. Companion to the design in
`packages/solidc/docs/ecrecover.md`.

## Run

```
node ecrecover-poc/field.mjs    # modmul reduction variants: general OP_MOD vs fast-reduce, measured
node ecrecover-poc/group.mjs    # point double / mixed add / looped-double, all validated vs noble + real cost
node ecrecover-poc/cost-model.mjs   # JS algorithm model (GLV+Shamir) validated vs noble + golden vector
```

## Files

- `harness.mjs` - VM harness: assemble ASM, run on the 2026 VM, return stack (as bigints) + `operationCost`.
- `emit.mjs` - stack register-machine + `OP_DEFINE` prelude for `modmul`/`modadd`/`modsub`. Lets point formulas be
  written over named registers; emits the `OP_PICK`/`OP_ROLL` juggling.
- `field.mjs` - field reduction: general `OP_MOD` vs fast-reduce (`p = 2^256 - 2^32 - 977`), measured.
- `group.mjs` - Jacobian point double (dbl-2009-l), mixed add (madd-2007-bl), looped double via a defined function.
- `cost-model.mjs` - JS model of the full GLV + 4-way Shamir recovery; validated vs noble and the golden EVM vector.
- `recover.mjs` - ethers.js signature -> in-Script recovery -> recovered address == `ethers.recoverAddress`.
- `glv.mjs` / `atomic.mjs` - GLV 4-way Shamir recovery; atomic 2-input checkpoint chain (tamper-rejected).
- `sound.mjs` / `full.mjs` - on-chain binding of the witnesses to `(hash,v,r,s)` and of the mask blob to the scalars.
- `lib.mjs` - `recover(digest,v,r,s)`: the sound + atomic + 2-input BAKED (per-signature) recovery engine vs ethers.
- `aav.mjs` / `wsound.mjs` / `wtable.mjs` - WITNESSED building blocks for the reusable covenant: affine-add-verified
  atom, witnessed sig+mask binding, witnessed table verification.
- `sidecar.mjs` - the self-preserving, reusable covenant pair (deploy once, reuse; recovered pubkey in the 2nd output).
- `engine.mjs` - **the full 2-input SELF-VERIFYING reusable recovery**: input A self-verifies sig+mask + ladders to a
  checkpoint; input B verifies the table + ladders to the pubkey; adaptive witnessed split, pre-split ladder; 40/40
  vs ethers, both inputs < 8.03M, forgeries rejected.
- `feature.mjs` - a contract co-spends the recovery and authenticates a signer (the end-user language feature).

## Verified on-VM (all PASS vs noble)

| primitive | check | op-cost |
|---|---|---|
| `modmul` (256-bit) | 400 random + edges | **4029** |
| point double (a=0) | 60 random vs `noble.double()` | 64193 |
| mixed add | 60 random vs `noble.add()` | 76702 |
| loop + `OP_DEFINE` + double | `2^N*G`, N=10/40/100 vs noble | 454-byte script |

## Key measured findings (correct the earlier JS estimate)

1. **Fast reduction LOSES.** general `OP_MOD` = 4029/modmul is optimal; every fold-based reduce is slower
   (fold1+MOD 4855, fold2 6241, fold3 7855) because the `NUM2BIN`/`SPLIT`/`BIN2NUM` byte-juggling costs more than
   the native bignum `OP_MOD`.
2. **Point ops cost ~2x their mul-count** (dbl 7 muls -> 64193 ~= 16 modmul-equiv) from `modadd`/`modsub` +
   operand-copy overhead.
3. **Single-input recovery is mathematically impossible.** Pure-mul floor `128*7 + 138*11` muls `* 4029 = ~9.7M`
   > the 8.03M per-input budget. GLV + 4-way Shamir uses ~2400 muls minimum; the 128 shared doublings alone are
   ~8.2M. **The recovery needs >= 2 sidecar inputs** (checkpoint the ladder at a witnessed midpoint).

## Recovery engine: DONE + VM-proven

The full recovery is built and verified: correct crypto (vs noble), full recovery (vs ethers), GLV, atomic 2-input,
sound witness/mask/table binding, and the self-verifying reusable 2-input covenant pair (`engine.mjs`) with the master
authenticating a signer (`feature.mjs`). The soundness model is the keccak one: the **sidecar self-verifies** on its
own budget; the **master** only body-hashes the covenant + binds `(hash,v,r,s)` + copies the pubkey.

## Remaining (productionization)

- Wrap `engine.mjs`'s A/B with self-preservation + the A->B hash-commit (the `sidecar.mjs` pattern) into the
  deployable pair, and the master read.
- Compiler/SDK wiring: `ecrecoverPubKey`/`ecrecover`/`ecrecoverEvm`/`ecrecoverP2pkh` builtins, `ecrecoverSideCar`
  block-layout slot, `emitEcrecoverComputeCall`, a `utils/ecrecover-compute-library.ts`, SDK auto-co-spend - all
  mirroring the keccak compute sidecar. Remove the misleading 3-arg verify-with-pubkey alias.
