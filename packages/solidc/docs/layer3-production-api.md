# Legacy homogeneous Layer-3 transcript scaffold (`src/layer3`)

> STATUS: RETIRED RESEARCH SCAFFOLD - NOT THE PRODUCTION MESSAGE BUS. An independent audit
> (`layer3-production-audit.md`, Decision 3) found VM-accepted unsafe states and a scope gap versus the
> research spec. L3-2 (resource commitment) and L3-3 (resource value) are now fail-closed; L3-1 (canonical
> transcript) is partially closed (overlapping/divergent views rejected; disjoint-injection residual open);
> L3-4..L3-9 (real heterogeneous-contract composition, complete invocation/intent/result, full resource
> authority, exact controller identity, deployability, typed API) remain OPEN. This module generates a
> HOMOGENEOUS participant covenant and instantiates N copies - it does NOT yet co-spend independently
> compiled application contracts. Do not use this legacy homogeneous generator for new integrations.
>
> **SCOPE UPDATE at `1591e87f`: this banner describes `covenant.ts`/`transcript.ts`, not `graph.ts`.**
> `src/layer3` has since grown the `L3GRAPH1` graph path, and the sentence "does NOT yet co-spend
> independently compiled application contracts" is false for that path: the C2 capstone is a heterogeneous
> cycle over four independently compiled participants, executed, accepted and **mined** by BCHN v29.0.0 at
> 52,733 bytes over 79 inputs (citation, X59/X60 as recorded in the completion ledger). The rest of the
> banner stands for the retired homogeneous path. Everything below documents the ORIGINAL scaffold; for the
> stable default-on graph path read
> `graph.ts`, the completion ledger, and `layer3-production-envelope.md`.

The spike covenants are generalized into a reusable SDK module, exported from `solidcash` as
`layer3.*`. It has three parts - a covenant GENERATOR, a blob CODEC, and a transaction DERIVER - so an
application describes a transcript by SPEC and gets a generated covenant + a derived, VM-valid transaction,
with no hand-written per-case covenant.

## API

The spec is INDEX-FREE: the module owns the transaction layout (`transcriptLayout`), so the generated
covenant and the assembled transaction always agree on where each record/state/settlement lives.

```ts
import { compileString } from 'solidc';
import { Contract, layer3 } from 'solidcash';

// 1. Describe the transcript shape (roles only - no indices).
const shape: layer3.TranscriptSpec = {
  participants: 2,
  invocations: [{ caller: 0, callee: 1 }],          // msg.sender bound for each
  resources:   [{ owner: 1 }],                       // owner-branded state NFT, preserved + transitioned
  effects:     [{ consumer: 0, valueExpr: 'share' }],// settlement bound to the consumer + an app value expr
};
// The application supplies the resource transition as appBody, using the module's layout indices:
const layout = layer3.transcriptLayout(shape);
const spec = { ...shape, appBody: [
  `bytes packed = tx.inputs[${layout.stateInput(0)}].nftCommitment;`,
  'bigint elastic = int(packed.slice(0, 4)); bigint base = int(packed.slice(4, 8));',
  'bigint share = 5 * base / elastic;',
  `require(tx.outputs[${layout.stateOutput(0)}].nftCommitment == bytes.concat(bytes4(elastic + 5), bytes4(base + share)));`,
]};

// 2. Generate + compile the covenant; instantiate the participants branded with the controller salt.
const artifact = compileString(layer3.generateTranscriptCovenant(spec), {
  forceStateful: true, __testLayer3BindingSpike: true,
});
const salt = hexToBin(layer3.CONTROLLER_SALT_HEX);
const participants = /* [{ contract: new Contract(artifact, [], { provider, salt }), master, categoryId }, ...] */;

// 2b. Authorize the callers (M4): each caller's master must commit to hash160(its callee) so the covenant's
//     intent gate accepts the invocation. `authorizeParticipants` mints them via addUtxo (mock/local dev);
//     on a real network mint each master (genesis) with the matching `deriveIntentCommitments(...)` entry
//     (the pure, provider-agnostic core - index i is the canonical order).
await layer3.authorizeParticipants(provider, participants, spec);

// 3. Assemble the WHOLE transaction from the spec + per-instance data (state guards + post-state commitments,
//    settlement values). The module builds every input and output in the canonical layout.
const { builder } = layer3.buildTranscriptTransaction({
  provider, route: artifact.hiddenBatch.route, sel: hexToBin(artifact.hiddenBatch.selector),
  handlerSelector: artifact.hiddenBatch.handlers[0].selector, participants, spec,
  resources: [{ utxo: stateUtxo, unlocker: stateGuard, address: stateAddr, outputCommitment: newCommitment }],
  effects: [settlementValue],
  fee: { utxo: feeUtxo, unlocker: feeUnlocker },
  change: { address: changeAddr, satoshis: changeSats },
});
await builder.send();
```

`deriveTranscriptTransaction` (binding half only) remains for advanced callers who assemble effects
themselves; `buildTranscriptTransaction` is the complete end-to-end path.

## What the generator emits (`covenant.ts`)

`generateTranscriptCovenant(spec)` produces a `__layer3_bind` covenant, UNROLLED for the spec's shape (the
generator is general - the correct covenant for any spec). It always includes the participant-binding
FRAMEWORK with all self-audit fixes:

- identity-by-reference (identity read from the co-spent input, never claimed);
- canonical strict byte-lexicographic owner order (subsumes distinctness);
- controller-brand cross-check on EVERY participant's redeem;
- active-input membership;
- owner output preservation: locking bytecode, category, commitment, AND satoshi value (N1);

then, per the spec (all at module-computed layout indices):

- each invocation binds BOTH msg.sender (M3: the caller's real locking bytecode to its OP_RETURN output)
  AND caller intent (M4: the caller's own master NFT commitment must equal `hash160(callee lockingBytecode)`,
  so an authenticated caller cannot be co-opted into a call it did not pre-authorize). Intent is always on:
  a caller commits to exactly one callee (its single master), so a caller calling two callees is a
  generation-time error;
- each resource binds its state NFT to the OWNER's token category (F1), requires it distinct from the
  participants (N2), and preserves its locking bytecode + category (the commitment transition is appBody);
- `appBody` statements (the application's resource transitions) run;
- each effect binds a settlement output's RECIPIENT to the consumer participant (F2) and its value to the
  application's value expression;
- each event binds an authenticated OP_RETURN log to the EMITTER participant's identity + a fixed topic
  (an EVM indexed-log analogue: provenance cannot be forged, the topic cannot be altered).

## Codec (`codec.ts`) and deriver (`transcript.ts`)

`encodeTranscriptBlob(handlerSelector, participantArgs(n))` builds the SCB1 hidden-batch envelope.
`deriveTranscriptTransaction(...)` sorts participants canonically, assigns `input_i = i, output_i = i`,
encodes the blob, adds the participant inputs (compiler route unlockers), and adds owner-preserving
recreation outputs. The application adds the fee and its effects.

## Status and scope

Built, `tsc`-clean, lint-clean, and covered by two suites:

- `Layer3Production.test.ts` (8/8, real consensus VM): an invocation transcript built end to end from a spec
  is accepted + under budget; a forged msg.sender is rejected; an unauthorized caller (M4 intent) is
  rejected; a COMPLETE Kashi-shaped transcript (invocation + resource transition + settlement) is assembled
  from one `buildTranscriptTransaction` call and accepted; the FULL 3-owner, 9-field Kashi oracle
  (Bento/Kashi/token, min-share math at millions-magnitude - target-corpus section 4) transitions end to end
  through `buildTranscriptTransaction`; a 3-participant / two-invocation transcript is built from a spec; an
  authenticated event log is bound; a forged event topic is rejected.
- `Layer3Module.test.ts` (11/11, pure logic): pins the module-owned layout indices, the SCB1 blob envelope,
  the OP_RETURN push encoding, every generated binding string, and the fail-closed validation guards.

This exercises the capstone BINDING MECHANISMS (target-corpus section 12) end to end from spec to
transaction - participant binding, authenticated invocations (M3 msg.sender + M4 caller intent), owner-bound
resources with fail-closed preservation, consumer-bound settlements (M5 result), and provenance-bound event
logs - for the specific measured shapes in the tests. It does NOT establish a general, sound, heterogeneous
message bus: see the audit banner above and `layer3-production-audit.md` for the VM-accepted issues (L3-1
residual) and the open scope items (L3-4..L3-9). Bounded to `MAX_PARTICIPANTS = 8` per generated covenant
(blob < 76 bytes); M4 intent binds a caller to one callee per master (a persistent callee allowlist, not
authorization of an exact call - L3-5).

Architectural note: a transcript is a MULTI-participant, multi-output TRANSACTION SHAPE, not a single
covenant, so the SDK transaction layer is its natural home (a `contract` compiles to one covenant; a
transcript spans several plus their records/settlements). The covenant generation still runs through the
compiler - `generateTranscriptCovenant` emits SolidCash that `solidc` compiles - so the compiler is on the
path; what the SDK owns is the cross-participant transaction assembly the language has no single-covenant
form for.

## Design decision: NO `transcript` language construct (2026-07-24)

We deliberately do NOT add a compiler-side `transcript { }` keyword. Reasons, in order:

1. **Anti-parity.** Solidity has no such construct. A developer never declares a transcript; the call graph
   IS the transcript, and the EVM provides `msg.sender`, the call, and the return value at runtime. Parity
   means the same authenticated-invocation surface must be IMPLICIT in the code a developer already writes
   (`msg.sender`, `IContract(addr).method(args)`), not a BCH-only keyword.
2. **Zero new capability.** A `transcript { }` block would lower to exactly the covenant
   `generateTranscriptCovenant` already emits, and the SDK would still assemble the multi-participant
   transaction. It is ergonomic sugar, not a new guarantee.
3. **Wrong home.** A transcript is a multi-participant, multi-output TRANSACTION SHAPE, not a single
   covenant, so the SDK transaction layer is its natural home (a `contract` compiles to one covenant; a
   transcript spans several plus their records/settlements). Covenant generation still runs through the
   compiler (`generateTranscriptCovenant` emits SolidCash that `solidc` compiles), so the compiler is on the
   path; the SDK owns the cross-participant assembly the language has no single-covenant form for.

### What the existing constructs already provide (the parity map)

A code-grounded comparison of the EXISTING `msg.sender` + `IContract(addr).method()` machinery against the
transcript's guarantees:

| Guarantee | Existing construct | Transcript |
|---|---|---|
| Authenticated `msg.sender` | ALREADY implicit - `emitMsgSender` + minting-NFT scan, fail-closed (`GenerateTargetTraversal.ts`) | M3 is the same primitive |
| Result binding | ALREADY implicit - return-event NFT category-bound to the co-spent callee (`call-model.md`) | M5 adds a recipient-bound settlement delivery |
| Caller-intent authorization (M4) | ABSENT - the star model has no callee-side proof "A authorized this call" | GENUINELY NEW |
| N-party mutual authentication | ABSENT - star topology; callees don't authenticate each other; mutual cycles unconstructible (`external-contract-calls.md`) | GENUINELY NEW (canonical order + controller brand) |

The two genuinely-new guarantees (M4 caller intent, N-party mutual authentication) are NOT blocked on a
language construct - they are delivered by this SDK module today. The parity-correct direction for closing
gaps is to fold guarantees back into the EXISTING constructs implicitly: e.g. `msg.sender` resolution was
hardened to enforce EXACTLY ONE co-spent caller master (`call-model.md` soundness invariants;
`MsgSenderUniqueMaster.test.ts`), closing the peer-mode ambiguity seam without any new keyword.

The resource state TRANSITION remains application business logic (appBody) by design, exactly as a contract
function body is. A loop-parsed variable-N covenant is not wired (only the unrolled-per-shape generator,
which is general for any concrete shape).
