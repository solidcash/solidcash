// Layer-3 transcript covenant generator (production). Generates the reusable participant-binding FRAMEWORK
// for N participants - identity-by-reference, canonical byte-lex order, controller-brand cross-check,
// membership, and value/commitment preservation, with the self-audit fixes (F1/F2/N1/N2) baked in - then
// emits invocation, resource, and effect logic from the transcript spec. The MODULE owns the transaction
// LAYOUT (see transcriptLayout): the spec is index-free, and the generator + the deriver both read indices
// from the layout so covenant and transaction always agree. Every generated covenant runs on every
// participant input and validates the whole transcript. Unrolled per shape; the generator is general.

/** The default controller brand: `L3B1CTRL` prologue (`<salt> OP_DROP` -> `084c3342314354524c75`). */
export const CONTROLLER_BRAND_PREFIX = '084c3342314354524c75';
/** The salt value that produces CONTROLLER_BRAND_PREFIX when passed as a Contract `salt` option. */
export const CONTROLLER_SALT_HEX = '4c3342314354524c';

/** An authenticated invocation: caller -> callee, msg.sender delivered to the layout's sender OP_RETURN. */
export interface InvocationSpec { caller: number; callee: number }
/** A resource: an owner-branded state NFT co-spent and preserved (transition supplied by appBody). */
export interface ResourceSpec { owner: number }
/** An effect: a settlement output bound to a consumer participant with an app-computed value expression. */
export interface EffectSpec { consumer: number; valueExpr: string }

export interface TranscriptSpec {
  /** Number of co-spent participant owners. */
  participants: number;
  invocations?: InvocationSpec[];
  resources?: ResourceSpec[];
  effects?: EffectSpec[];
  /** Application-specific covenant statements (resource state transitions), appended before effect binding. */
  appBody?: string[];
  /** Controller brand prefix (10-byte hex). Defaults to CONTROLLER_BRAND_PREFIX. */
  brandPrefix?: string;
}

/** The canonical input/output layout the module assigns for a spec, so covenant and transaction agree. */
export interface TranscriptLayout {
  participants: number;
  invocations: number;
  resources: number;
  effects: number;
  /** Input index of the resource state NFT for resource k (participants ... then resources). */
  stateInput: (k: number) => number;
  /** Fee input index (after participants + resources). */
  feeInput: number;
  /** Output index of the msg.sender OP_RETURN for invocation j (after participant recreations). */
  senderOutput: (j: number) => number;
  /** Output index of the resource state recreation for resource k. */
  stateOutput: (k: number) => number;
  /** Output index of the settlement for effect m. */
  effectOutput: (m: number) => number;
  /** Total output count before the change output. */
  outputCount: number;
}

/** Compute the canonical transaction layout for a spec. */
export function transcriptLayout(spec: TranscriptSpec): TranscriptLayout {
  const n = spec.participants;
  const I = spec.invocations?.length ?? 0;
  const R = spec.resources?.length ?? 0;
  const E = spec.effects?.length ?? 0;
  return {
    participants: n, invocations: I, resources: R, effects: E,
    stateInput: (k) => n + k,
    feeInput: n + R,
    senderOutput: (j) => n + j,
    stateOutput: (k) => n + I + k,
    effectOutput: (m) => n + I + R + m,
    outputCount: n + I + R + E,
  };
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

/** Generate the full `__layer3_bind` covenant source for a transcript spec, using the module's layout. */
export function generateTranscriptCovenant(spec: TranscriptSpec): string {
  const n = spec.participants;
  const layout = transcriptLayout(spec);
  const body = bindingFrameworkBody(n, spec.brandPrefix ?? CONTROLLER_BRAND_PREFIX);

  (spec.invocations ?? []).forEach((inv, j) => {
    if (inv.caller < 0 || inv.caller >= n || inv.callee < 0 || inv.callee >= n) {
      throw new Error('layer3: invocation endpoint out of range');
    }
    if (inv.caller === inv.callee) throw new Error('layer3: invocation caller == callee');
    // msg.sender = the caller participant's real locking bytecode, delivered + bound to its OP_RETURN.
    body.push(`require(tx.outputs[${layout.senderOutput(j)}].lockingBytecode == bytes.concat(hex"6a23", tx.inputs[input${inv.caller}].lockingBytecode));`);
  });

  (spec.resources ?? []).forEach((r, k) => {
    if (r.owner < 0 || r.owner >= n) throw new Error('layer3: resource owner out of range');
    const si = layout.stateInput(k); const so = layout.stateOutput(k);
    const distinct = Array.from({ length: n }, (_u, i) => `${si} != input${i}`).join(' && ');
    body.push(`require(${distinct});`); // N2: state input is not a participant
    body.push(`require(tx.inputs[${si}].tokenCategory.slice(0, 32) == tx.inputs[input${r.owner}].tokenCategory.slice(0, 32));`); // F1
    // Resource self-preservation (locking bytecode + category); the commitment transition is appBody.
    body.push(`require(tx.outputs[${so}].lockingBytecode == tx.inputs[${si}].lockingBytecode);`);
    body.push(`require(tx.outputs[${so}].tokenCategory == tx.inputs[${si}].tokenCategory);`);
  });

  body.push(...(spec.appBody ?? []));

  (spec.effects ?? []).forEach((e, m) => {
    if (e.consumer < 0 || e.consumer >= n) throw new Error('layer3: effect consumer out of range');
    const eo = layout.effectOutput(m);
    // F2: bind the settlement RECIPIENT to the consumer and its value to the app expression.
    body.push(`require(tx.outputs[${eo}].lockingBytecode == tx.inputs[input${e.consumer}].lockingBytecode);`);
    body.push(`require(tx.outputs[${eo}].value == ${e.valueExpr});`);
  });

  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${bindingParams(n).join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}
