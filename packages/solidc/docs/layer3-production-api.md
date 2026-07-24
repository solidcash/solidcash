# Layer-3 transcript - production SDK module (`src/layer3`)

The proven spike covenants are generalized into a reusable SDK module, exported from `solidcash` as
`layer3.*`. It has three parts - a covenant GENERATOR, a blob CODEC, and a transaction DERIVER - so an
application describes a transcript by SPEC and gets a generated covenant + a derived, VM-valid transaction,
with no hand-written per-case covenant.

## API

```ts
import { compileString } from 'solidc';
import { Contract, layer3 } from 'solidcash';

// 1. Describe the transcript shape.
const spec: layer3.TranscriptSpec = {
  participants: 2,
  invocations: [{ caller: 0, callee: 1, senderOutput: 2 }],   // msg.sender delivered to OP_RETURN output 2
  resources:   [{ owner: 1, stateInput: 3 }],                 // owner-branded state NFT co-spent at input 3
  appBody: [ /* SolidCash statements: the resource state transition, effects */ ],
};

// 2. Generate the covenant (binding framework + invocation/resource logic) and compile it.
const artifact = compileString(layer3.generateTranscriptCovenant(spec), {
  forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
});

// 3. Instantiate the participants branded with the controller salt, then derive the transaction.
const salt = hexToBin(layer3.CONTROLLER_SALT_HEX);
const participants = /* [{ contract: new Contract(artifact, [], { provider, salt }), master, categoryId }, ...] */;
const { builder, ordered } = layer3.deriveTranscriptTransaction({
  provider, route: artifact.hiddenBatch.route, sel: hexToBin(artifact.hiddenBatch.selector),
  handlerSelector: artifact.hiddenBatch.handlers[0].selector, participants,
});

// 4. Add the fee and the application effects (OP_RETURN records, resource state outputs, settlements).
//    Then send(). `ordered` is the canonical order; participant i is at input i / output i.
```

## What the generator emits (`covenant.ts`)

`generateTranscriptCovenant(spec)` produces a `__layer3_bind` covenant, UNROLLED for the spec's shape (the
generator is general - the correct covenant for any spec). It always includes the participant-binding
FRAMEWORK with all self-audit fixes:

- identity-by-reference (identity read from the co-spent input, never claimed);
- canonical strict byte-lexicographic owner order (subsumes distinctness);
- controller-brand cross-check on EVERY participant's redeem;
- active-input membership;
- owner output preservation: locking bytecode, category, commitment, AND satoshi value (N1);

then, per the spec:

- each invocation binds msg.sender = the caller's real locking bytecode to its OP_RETURN output;
- each resource binds its state NFT to the OWNER's token category (F1) and requires it distinct from the
  participants (N2);
- `appBody` statements (the application's resource transitions / effects) run last.

## Codec (`codec.ts`) and deriver (`transcript.ts`)

`encodeTranscriptBlob(handlerSelector, participantArgs(n))` builds the SCB1 hidden-batch envelope.
`deriveTranscriptTransaction(...)` sorts participants canonically, assigns `input_i = i, output_i = i`,
encodes the blob, adds the participant inputs (compiler route unlockers), and adds owner-preserving
recreation outputs. The application adds the fee and its effects.

## Status and scope

Built, `tsc`-clean, lint-clean, and covered by `Layer3Production.test.ts` (invocation transcript accepted +
under budget; forged msg.sender rejected; resource state transition accepted). This is the production SDK
layer over the audited covenants (`layer3-spike-audit-findings.md`). Bounded to `MAX_PARTICIPANTS = 8` per
generated covenant (blob < 76 bytes). The effect/event tables and a compiler-side `transcript` language
construct are the remaining product surface; the SDK generation/derivation of participant binding,
invocations, and resources is production-ready here.
