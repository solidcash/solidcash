// Layer-3 transcript covenant generator (production). Generates the reusable participant-binding FRAMEWORK
// for N participants - identity-by-reference, canonical byte-lex order, controller-brand cross-check,
// membership, and value/commitment preservation, with the self-audit fixes (F1/F2/N1/N2) baked in - then
// emits the invocation and resource logic hard-coded from the transcript spec. Every generated covenant runs
// on every participant input and validates the whole transcript.
//
// UNROLLED per shape: the generator is general (correct covenant for any spec), matching how a compiler
// emits fixed-shape code. The blob (./codec.ts) carries `input_i = i, output_i = i` over the sorted set.

/** The default controller brand: `L3B1CTRL` prologue (`<salt> OP_DROP` -> `084c3342314354524c75`). */
export const CONTROLLER_BRAND_PREFIX = '084c3342314354524c75';
/** The salt value that produces CONTROLLER_BRAND_PREFIX when passed as a Contract `salt` option. */
export const CONTROLLER_SALT_HEX = '4c3342314354524c';

/** An authenticated invocation: caller -> callee, with the caller's identity delivered to an OP_RETURN output. */
export interface InvocationSpec {
  /** Caller participant index (into the canonically-ordered set). */
  caller: number;
  /** Callee participant index. */
  callee: number;
  /** Output index carrying the OP_RETURN `6a23 <caller lockingBytecode>` msg.sender record. */
  senderOutput: number;
}

/** A resource: an owner-branded state NFT co-spent at a fixed input index. */
export interface ResourceSpec {
  /** Owner participant index whose category authenticates this state NFT. */
  owner: number;
  /** Input index of the co-spent state NFT. */
  stateInput: number;
}

export interface TranscriptSpec {
  /** Number of co-spent participant owners. */
  participants: number;
  /** Invocations to bind (msg.sender delivery). */
  invocations?: InvocationSpec[];
  /** Resource state NFTs to bind (owner category + distinctness). */
  resources?: ResourceSpec[];
  /** Application-specific covenant statements appended last (SolidCash source; e.g. state transitions). */
  appBody?: string[];
  /** Controller brand prefix (10-byte hex). Defaults to CONTROLLER_BRAND_PREFIX. */
  brandPrefix?: string;
}

/** Participant-binding parameters (`input_i, output_i` pairs). */
export function bindingParams(n: number): string[] {
  return Array.from({ length: n }, (_u, i) => `bigint input${i}, bigint output${i}`);
}

/** The participant-binding framework body (statements) for `n` participants, with the audit fixes baked in. */
export function bindingFrameworkBody(n: number, brandPrefix = CONTROLLER_BRAND_PREFIX): string[] {
  if (!Number.isInteger(n) || n < 2) throw new Error('layer3: need >= 2 participants');
  const body: string[] = [];
  for (let i = 0; i < n; i += 1) {
    body.push(`bytes u${i} = tx.inputs[input${i}].unlockingBytecode;`);
    body.push(`require(u${i}.slice(0, 5) == hex"0453434231");`);
    body.push(`bytes lbc${i} = tx.inputs[input${i}].lockingBytecode;`);
    body.push(`require(tx.inputs[input${i}].tokenCategory.slice(32, 33) == hex"02");`);
    body.push(`require(tx.outputs[output${i}].lockingBytecode == lbc${i});`);
    body.push(`require(tx.outputs[output${i}].tokenCategory == tx.inputs[input${i}].tokenCategory);`);
    body.push(`require(tx.outputs[output${i}].nftCommitment == tx.inputs[input${i}].nftCommitment);`);
    body.push(`require(tx.outputs[output${i}].value == tx.inputs[input${i}].value);`);
    body.push(`bigint hi${i} = int(bytes.concat(lbc${i}.slice(2, 18).reverse(), hex"01"));`);
    body.push(`bigint lo${i} = int(bytes.concat(lbc${i}.slice(18, 34).reverse(), hex"01"));`);
  }
  for (let i = 0; i + 1 < n; i += 1) {
    body.push(`require(hi${i} < hi${i + 1} || (hi${i} == hi${i + 1} && lo${i} < lo${i + 1}));`);
  }
  body.push('bigint l0 = int(bytes.concat(u0.slice(5, 6), hex"00"));');
  body.push('bigint a = 6 + l0;');
  body.push('bigint l1 = int(bytes.concat(u0.slice(a, a + 1), hex"00"));');
  body.push('bigint rp = a + 1 + l1;');
  body.push('require(u0.slice(rp, rp + 1) == hex"4d");');
  for (let i = 0; i < n; i += 1) body.push(`require(u${i}.slice(rp + 3, rp + 13) == hex"${brandPrefix}");`);
  const members = Array.from({ length: n }, (_u, i) => `this.activeInputIndex == input${i}`);
  body.push(`require(${members.join(' || ')});`);
  return body;
}

/** Generate the full `__layer3_bind` covenant source for a transcript spec. */
export function generateTranscriptCovenant(spec: TranscriptSpec): string {
  const n = spec.participants;
  const body = bindingFrameworkBody(n, spec.brandPrefix ?? CONTROLLER_BRAND_PREFIX);
  for (const inv of spec.invocations ?? []) {
    if (inv.caller < 0 || inv.caller >= n || inv.callee < 0 || inv.callee >= n) {
      throw new Error('layer3: invocation endpoint out of range');
    }
    if (inv.caller === inv.callee) throw new Error('layer3: invocation caller == callee');
    // msg.sender = the caller participant's real locking bytecode, delivered + bound to an OP_RETURN.
    body.push(`require(tx.outputs[${inv.senderOutput}].lockingBytecode == bytes.concat(hex"6a23", tx.inputs[input${inv.caller}].lockingBytecode));`);
  }
  for (const r of spec.resources ?? []) {
    if (r.owner < 0 || r.owner >= n) throw new Error('layer3: resource owner out of range');
    const distinct = Array.from({ length: n }, (_u, i) => `${r.stateInput} != input${i}`).join(' && ');
    body.push(`require(${distinct});`); // N2: state input is not a participant
    body.push(`require(tx.inputs[${r.stateInput}].tokenCategory.slice(0, 32) == tx.inputs[input${r.owner}].tokenCategory.slice(0, 32));`); // F1
  }
  body.push(...(spec.appBody ?? []));
  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${bindingParams(n).join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}
