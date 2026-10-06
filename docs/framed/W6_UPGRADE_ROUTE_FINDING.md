# W6 finding: the kernel upgrade route refuses every positive upgrade composition

Status: diagnosed to the instruction, not fixed. Both files below are pre-existing kernel failures
(present on the kernel parent, so the per-call work did not introduce them).

Files and titles:

- `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeCompose.test.ts` — 4 failed / 3 passed.
- `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeSignature.test.ts` — 3 failed / 3 passed.

Every *positive* title fails; every *negative* (expected-refusal) title passes.

## Reproduction

```bash
cd packages/solidcash
SOLIDC_DEBUG_FAILURE_POINT=1 ../../node_modules/.bin/vitest run \
  test/journal-message-bus/e2e/KernelUpgradeCompose.test.ts -t "selects an overloaded upgrade" --maxWorkers=2
```

Reported refusal:

    messageBus: BCH-2026 preflight failed at input 1 (ip 16 of 32, opcode 91, failing opcode 157,
    window 207 192 210 136 90 138 118 81 157 91) (participant OverloadedCurrent.__message_bus1):
    Program failed an OP_VERIFY operation.

Decoded window (`packages/utils` `Op` numbers): `OP_UTXOTOKENCOMMITMENT OP_INPUTINDEX
OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY OP_10 OP_INVOKE OP_DUP OP_1 OP_NUMEQUALVERIFY` — the failing
instruction is `OP_DUP OP_1 OP_NUMEQUALVERIFY`, i.e. `require(<value> == 1)`.

## Root cause

The failing frame is the outlined span `-114` of the compiled `OverloadedCurrent` route (34 bytes, 32
instructions). Its body is:

    OP_PICK OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY        # next-instance bytecode check
    <133> OP_INVOKE
    OP_INPUTINDEX OP_UTXOTOKENCOMMITMENT OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY
    <10> OP_INVOKE                                                # span 10
    OP_DUP OP_1 OP_NUMEQUALVERIFY                                 # require(count == 1)  <-- fails at ip 15
    <11> OP_INVOKE                                                # span 11
    OP_2 OP_BEGIN <7> OP_INVOKE OP_UNTIL OP_DROP
    OP_0 OP_NUMEQUALVERIFY OP_DROP
    <134> OP_INVOKE <12> OP_INVOKE OP_NIP

Span `10` is the kernel "how many inputs carry my token category" counter:

    OP_INPUTINDEX OP_UTXOTOKENCATEGORY          # category || capability
    OP_PUSHBYTES_1 0x20 OP_SPLIT OP_DROP        # keep the 32-byte category
    OP_1 OP_CAT                                 # normalise to category||0x01 (mutable)
    OP_0 OP_TXINPUTCOUNT OP_BEGIN ... OP_UNTIL OP_DROP   # count matches over all inputs

So the guard is `require(countInputsWithMyMutableCategory == 1)`.

That guard is emitted **only for the upgrade variant**. Compiling the same contract with the upgrade
modifier removed drops it (`packages/solidc` leaves no `OP_INVOKE OP_DUP OP_1 OP_NUMEQUALVERIFY`
sequence in the plain variant).

A correctly composed upgrade transaction cannot satisfy it. Token inventory captured at the refusal
(`builder.inputs` through `generateLibauthSourceOutputs`, and `transaction.outputs`):

    inputs : 0:9acef6ea/minting    1*:b6fdf3f9/minting    2:b6fdf3f9/mutable/00
             3:9acef6ea/mutable/4c3356310000   4:b6fdf3f9/mutable/4c3356310000   5:none
    outputs: 0:9acef6ea/minting    1:b6fdf3f9/minting    2:b6fdf3f9/mutable/00
             3:9acef6ea/mutable/... 4:b6fdf3f9/mutable/... 5:none

For `b6fdf3f9` (OverloadedCurrent) three inputs carry the category: the minting master (1), the
mutable state carrier (2) and the mutable detached message-bus verifier NFT (4). The guard normalises
to `category||0x01`, so it counts **2**, and `require(2 == 1)` fails.

The same shape explains `KernelUpgradeSignature`: there the counter is compared against `0`
(`OP_DUP OP_0 OP_NUMEQUALVERIFY`) on the coordinator's route, i.e. the peer/index variant of the same
guard family.

## What the guard should be — decision needed

Two readings, and the choice is a design call that belongs to the kernel route author:

1. The guard is too broad. A kernel contract's category is carried by the instance (minting) NFT, the
   state NFT, **and** the detached verifier NFT. Requiring exactly one mutable-category input is
   inconsistent with that geometry whenever an upgrade co-spends the detached verifier. If the intent
   is "exactly one *state* carrier", the guard has to exclude the verifier NFT (its commitment starts
   with `4c335631`, the message-bus verifier marker) or read the state container directly.
2. The composer is wrong. An upgrade may be expected to use the **atomic** verifier rather than the
   detached `MessageBusVerifier_*` input; the generated route already accepts
   `__internal__activeVerifierIndex` and runs `__message_bus_verify_atomic(...)` when the verifier
   input is absent. Composing the upgrade participant that way would leave exactly one
   mutable-category input and satisfy the guard.

The second reading is checkable and cheap: make the composer choose the atomic verifier for the
participant that carries the upgrade row, then re-run the two files. The first reading is a compiler
change in the kernel route's upgrade authorization.

## Evidence commands used

```bash
# failing frame, full 32-instruction program and token inventory
SOLIDC_DEBUG_FAILURE_POINT=1 SOLIDC_DEBUG_ROUTE_INPUTS=1 ../../node_modules/.bin/vitest run ...

# generated route source for the same contract (dumps to stderr)
SOLIDC_DUMP_ROUTE=1 node -e "import('.../packages/solidc/dist/index.js').then(m => m.compileString(SRC, KERNEL))"

# artifact debug tables: invokeDebug[<id>] = { name, bytecode, requires, sourceMap }
# span -114 carries the failing body; its sourceMap attributes it to line 3 of the contract source.
```

## Related defect, same file

`KernelUpgradeCompose` "selects an overloaded upgrade ..." also self-reports a compiler defect while
compiling `OverloadedCurrent`:

    Warning: could not build the delegate (proxy-implementation) variant of 'OverloadedCurrent':
    No overload of function 'replace' matches argument types (bool, bigint) ... This is a compiler
    defect. The contract itself compiled; it just cannot be used behind a proxy.

`OverloadedCurrent` therefore publishes no `delegateArtifact`, which is a second, independent reason a
proxy-shaped route cannot be built for it.
