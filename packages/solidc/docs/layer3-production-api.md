# Layer-3 transcript - production SDK module (`src/layer3`)

The proven spike covenants are generalized into a reusable SDK module, exported from `solidcash` as
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
  forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
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

- `Layer3Production.test.ts` (7/7, real consensus VM): an invocation transcript built end to end from a spec
  is accepted + under budget; a forged msg.sender is rejected; an unauthorized caller (M4 intent) is
  rejected; a COMPLETE Kashi-shaped transcript (invocation + resource transition + settlement) is assembled
  from one `buildTranscriptTransaction` call and accepted; a 3-participant / two-invocation transcript is
  built from a spec; an authenticated event log is bound; a forged event topic is rejected.
- `Layer3Module.test.ts` (11/11, pure logic): pins the module-owned layout indices, the SCB1 blob envelope,
  the OP_RETURN push encoding, every generated binding string, and the fail-closed validation guards.

This is the production SDK layer over the audited covenants (`layer3-spike-audit-findings.md`) - end to end
from spec to transaction, carrying the full capstone (target-corpus section 12): participant binding,
authenticated invocations (M3 msg.sender + M4 caller intent), owner-bound resources, consumer-bound
settlements (M5 result), and provenance-bound event logs. Bounded to `MAX_PARTICIPANTS = 8` per generated
covenant (blob < 76 bytes); intent binds a caller to one callee per master.

Architectural note: a transcript is a MULTI-participant, multi-output TRANSACTION SHAPE, not a single
covenant, so the SDK transaction layer is its natural home (a `contract` compiles to one covenant; a
transcript spans several plus their records/settlements). The covenant generation still runs through the
compiler - `generateTranscriptCovenant` emits SolidCash that `solidc` compiles - so the compiler is on the
path; what the SDK owns is the cross-participant transaction assembly the language has no single-covenant
form for.

Remaining product surface, NOT built here: a compiler-side `transcript` LANGUAGE CONSTRUCT (sugar so a
developer writes a `transcript { }` block instead of a spec object + appBody strings) - a convenience over
the complete SDK path above, not a missing capability; and a loop-parsed variable-N covenant (only the
unrolled-per-shape generator is wired; it is general for any concrete shape). The resource state TRANSITION
remains application business logic (appBody) by design, exactly as a contract function body is.
