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
/** An execution-transcript edge: caller -> callee.selector, in list order. Committed by the execution root (R2). */
export interface ExecutionInvocation { caller: number; callee: number; selectorHex: string }
/** An execution-transcript event: an authenticated OP_RETURN record (emitter identity + topic), committed by the root. */
export interface ExecutionEvent { emitter: number; topicHex: string }
/** Domain tag for the canonical execution root ("L3EXEC1\0"), separating it from any other sha256 usage. */
export const EXEC_DOMAIN = '4c33455845433100';
/**
 * A TYPED transition (R6): add `delta` to the `width`-byte little-endian field at `offset` in the resource's
 * NFT commitment (which is `total` bytes), preserving every other byte. The module generates the full,
 * fail-closed output-commitment binding - no raw `appBody` needed for this common case.
 */
export interface TypedTransition { offset: number; width: number; total: number; delta: number }
/**
 * A resource: an owner-branded state NFT co-spent and preserved (locking bytecode, category, value, and -
 * unless `transition` - commitment). `transition` may be: absent/false = preserve commitment; a
 * `TypedTransition` = a typed, module-generated, fail-closed field-delta (R6, preferred); or `true` = opt out
 * of commitment binding entirely, requiring the app's `appBody` to bind it (raw escape hatch - see R6).
 */
export interface ResourceSpec { owner: number; transition?: boolean | TypedTransition }
/** An effect: a settlement output bound to a consumer participant with an app-computed value expression. */
export interface EffectSpec { consumer: number; valueExpr: string }
/** An event: an authenticated OP_RETURN log bound to the emitter's identity + a fixed topic (EVM indexed log). */
export interface EventSpec { emitter: number; topicHex: string }

export interface TranscriptSpec {
  /** Number of co-spent participant owners. */
  participants: number;
  invocations?: InvocationSpec[];
  resources?: ResourceSpec[];
  effects?: EffectSpec[];
  events?: EventSpec[];
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
  events: number;
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
  /** Output index of the event log OP_RETURN for event v. */
  eventOutput: (v: number) => number;
  /** Total output count before the change output. */
  outputCount: number;
}

/** Compute the canonical transaction layout for a spec. */
export function transcriptLayout(spec: TranscriptSpec): TranscriptLayout {
  const n = spec.participants;
  const I = spec.invocations?.length ?? 0;
  const R = spec.resources?.length ?? 0;
  const E = spec.effects?.length ?? 0;
  const V = spec.events?.length ?? 0;
  return {
    participants: n, invocations: I, resources: R, effects: E, events: V,
    stateInput: (k) => n + k,
    feeInput: n + R,
    senderOutput: (j) => n + j,
    stateOutput: (k) => n + I + k,
    effectOutput: (m) => n + I + R + m,
    eventOutput: (v) => n + I + R + E + v,
    outputCount: n + I + R + E + V,
  };
}

/** The p2sh32 locking-bytecode length an authenticated record carries as its identity prefix (aa20<32>87). */
const IDENTITY_LEN = 35;

/** OP_RETURN prologue hex (`6a` + a minimal push opcode) carrying `dataLen` bytes of pushed data. */
export function opReturnPrefix(dataLen: number): string {
  if (dataLen < 0 || dataLen > 255) throw new Error('layer3: event payload out of range');
  const len = dataLen.toString(16).padStart(2, '0');
  return dataLen <= 75 ? `6a${len}` : `6a4c${len}`;
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
  // L3-1: bind every named participant to ONE canonical transcript blob (the SCB1 args region, identical up
  // to the redeem push). Without this each input validated only its own local participant mapping, so
  // divergent/overlapping views (e.g. [A,B] and [B,C]) could co-validate. Note: this closes the reproduced
  // overlapping/divergent/reordered/omitted counterexamples; full exhaustiveness against an injected DISJOINT
  // transcript (a structure-independent canonical digest) is a further correction - see layer3-production-audit.md L3-1.
  for (let i = 1; i < n; i += 1) body.push(`require(u${i}.slice(0, rp) == u0.slice(0, rp));`);
  const members = Array.from({ length: n }, (_u, i) => `this.activeInputIndex == input${i}`);
  body.push(`require(${members.join(' || ')});`);
  return body;
}

/**
 * R3/R5: the reusable EXECUTION-transcript verification snippet a HETEROGENEOUS participant embeds in its own
 * function body (alongside its app logic), so independently-compiled contracts - not clones - mutually
 * authenticate under one controller-attested execution root. Fixed layout: the `n` participants are at inputs
 * 0..n-1, the controller at input `n`. The snippet reads every participant's locking bytecode at its fixed
 * position, recomputes the execution root (domain || lbcs || ordered edges), and requires the co-spent
 * controller (exact category + lbc) to commit exactly that root and be preserved. `selfPos` is this
 * participant's own fixed input index. Because the root binds each lbc to its POSITION, no participant can be
 * substituted or permuted without changing the root the controller attests.
 */
export function executionMemberBody(
  n: number, selfPos: number, invocations: ExecutionInvocation[], controllerCategory: string, controllerLbc: string,
  events?: ExecutionEvent[],
): string[] {
  if (!Number.isInteger(n) || n < 2) throw new Error('layer3: need >= 2 participants');
  if (selfPos < 0 || selfPos >= n) throw new Error('layer3: selfPos out of range');
  if (!/^[0-9a-fA-F]{64}$/.test(controllerCategory)) throw new Error('layer3: controllerCategory must be 32-byte hex');
  if (!/^([0-9a-fA-F]{2})+$/.test(controllerLbc)) throw new Error('layer3: controllerLbc must be hex bytes');
  const evs = events ?? [];
  evs.forEach((ev) => {
    if (ev.emitter < 0 || ev.emitter >= n) throw new Error('layer3: execution event emitter out of range');
    if (!/^([0-9a-fA-F]{2})+$/.test(ev.topicHex)) throw new Error('layer3: event topic must be hex bytes');
  });
  const body: string[] = [];
  for (let i = 0; i < n; i += 1) body.push(`bytes lbc${i} = tx.inputs[${i}].lockingBytecode;`);
  let lbcConcat = 'lbc0';
  for (let i = 1; i < n; i += 1) lbcConcat = `bytes.concat(${lbcConcat}, lbc${i})`;
  let payload = `bytes.concat(hex"${EXEC_DOMAIN}", ${lbcConcat})`;
  for (const inv of invocations) {
    if (inv.caller < 0 || inv.caller >= n || inv.callee < 0 || inv.callee >= n) {
      throw new Error('layer3: execution invocation endpoint out of range');
    }
    const edge = `bytes.concat(bytes.concat(lbc${inv.caller}, lbc${inv.callee}), hex"${inv.selectorHex.toLowerCase()}")`;
    payload = `bytes.concat(${payload}, ${edge})`;
  }
  // R4: events are committed in the root too, so the emitter set is part of the canonical transcript.
  for (const ev of evs) payload = `bytes.concat(${payload}, bytes.concat(lbc${ev.emitter}, hex"${ev.topicHex.toLowerCase()}"))`;
  body.push(`bytes execRoot = sha256(${payload});`);
  const catInternal = (controllerCategory.toLowerCase().match(/../g) as string[]).reverse().join('');
  body.push(`require(tx.inputs[${n}].tokenCategory.slice(0, 32) == hex"${catInternal}");`);
  body.push(`require(tx.inputs[${n}].lockingBytecode == hex"${controllerLbc.toLowerCase()}");`);
  body.push(`require(tx.inputs[${n}].nftCommitment == execRoot);`);
  body.push(`require(tx.outputs[${n}].lockingBytecode == tx.inputs[${n}].lockingBytecode);`);
  body.push(`require(tx.outputs[${n}].tokenCategory == tx.inputs[${n}].tokenCategory);`);
  body.push(`require(tx.outputs[${n}].nftCommitment == tx.inputs[${n}].nftCommitment);`);
  body.push(`require(tx.outputs[${n}].value == tx.inputs[${n}].value);`);
  body.push(`require(this.activeInputIndex == ${selfPos});`);
  // R4 EMITTER EXHAUSTIVENESS: each committed event record is present at its fixed output (n+1+j), AND the
  // total number of OP_RETURN outputs equals the committed event count - so no UNRECORDED record can be
  // emitted and none omitted. Only enforced when `events` is provided.
  if (events !== undefined) {
    evs.forEach((ev, j) => {
      const prefix = opReturnPrefix(IDENTITY_LEN + ev.topicHex.length / 2);
      body.push(`require(tx.outputs[${n + 1 + j}].lockingBytecode == bytes.concat(hex"${prefix}", lbc${ev.emitter}, hex"${ev.topicHex.toLowerCase()}"));`);
    });
    body.push('bigint opret = 0;');
    body.push('for (bigint oi = 0; oi < tx.outputs.length; oi = oi + 1) {');
    body.push('  if (tx.outputs[oi].lockingBytecode.slice(0, 1) == hex"6a") { opret = opret + 1; }');
    body.push('}');
    body.push(`require(opret == ${evs.length});`);
  }
  return body;
}

/** Generate the full `__layer3_bind` covenant source for a transcript spec, using the module's layout. */
export function generateTranscriptCovenant(spec: TranscriptSpec): string {
  const n = spec.participants;
  const layout = transcriptLayout(spec);
  const body = bindingFrameworkBody(n, spec.brandPrefix ?? CONTROLLER_BRAND_PREFIX);

  const callerAuthorizes = new Map<number, number>(); // each caller's single committed callee (one master)
  (spec.invocations ?? []).forEach((inv, j) => {
    if (inv.caller < 0 || inv.caller >= n || inv.callee < 0 || inv.callee >= n) {
      throw new Error('layer3: invocation endpoint out of range');
    }
    if (inv.caller === inv.callee) throw new Error('layer3: invocation caller == callee');
    const prior = callerAuthorizes.get(inv.caller);
    if (prior !== undefined && prior !== inv.callee) {
      throw new Error('layer3: a caller commits to one callee (its single master); it cannot call two callees');
    }
    callerAuthorizes.set(inv.caller, inv.callee);
    // M3: msg.sender = the caller's real locking bytecode, delivered + bound to its OP_RETURN.
    body.push(`require(tx.outputs[${layout.senderOutput(j)}].lockingBytecode == bytes.concat(hex"6a23", tx.inputs[input${inv.caller}].lockingBytecode));`);
    // M4: caller intent - the caller's own master commitment must pre-authorize exactly this callee.
    body.push(`require(tx.inputs[input${inv.caller}].nftCommitment == hash160(tx.inputs[input${inv.callee}].lockingBytecode));`);
  });

  (spec.resources ?? []).forEach((r, k) => {
    if (r.owner < 0 || r.owner >= n) throw new Error('layer3: resource owner out of range');
    const si = layout.stateInput(k); const so = layout.stateOutput(k);
    const distinct = Array.from({ length: n }, (_u, i) => `${si} != input${i}`).join(' && ');
    body.push(`require(${distinct});`); // N2: state input is not a participant
    body.push(`require(tx.inputs[${si}].tokenCategory.slice(0, 32) == tx.inputs[input${r.owner}].tokenCategory.slice(0, 32));`); // F1
    // Resource preservation, fail-closed by default: locking bytecode, category, and satoshi value are ALWAYS
    // preserved (L3-3). The commitment is preserved unless the resource opts into a transition (L3-2); a
    // transition delegates the output commitment to appBody.
    body.push(`require(tx.outputs[${so}].lockingBytecode == tx.inputs[${si}].lockingBytecode);`);
    body.push(`require(tx.outputs[${so}].tokenCategory == tx.inputs[${si}].tokenCategory);`);
    body.push(`require(tx.outputs[${so}].value == tx.inputs[${si}].value);`);
    if (!r.transition) {
      body.push(`require(tx.outputs[${so}].nftCommitment == tx.inputs[${si}].nftCommitment);`);
    } else if (typeof r.transition === 'object') {
      // R6 typed field-delta: preserve every byte except the [offset, offset+width) field, which is += delta.
      const t = r.transition;
      if (!(Number.isInteger(t.offset) && Number.isInteger(t.width) && Number.isInteger(t.total)
        && t.offset >= 0 && t.width > 0 && t.offset + t.width <= t.total)) {
        throw new Error('layer3: invalid TypedTransition field bounds');
      }
      const inC = `tx.inputs[${si}].nftCommitment`;
      const field = `int(${inC}.slice(${t.offset}, ${t.offset + t.width}))`;
      const pre = `${inC}.slice(0, ${t.offset})`;
      const post = `${inC}.slice(${t.offset + t.width}, ${t.total})`;
      const rebuilt = `bytes.concat(bytes.concat(${pre}, bytes${t.width}(${field} + ${t.delta})), ${post})`;
      body.push(`require(tx.outputs[${so}].nftCommitment == ${rebuilt});`);
    } // transition === true: raw appBody escape hatch (must bind the output commitment itself)
  });

  body.push(...(spec.appBody ?? []));

  (spec.effects ?? []).forEach((e, m) => {
    if (e.consumer < 0 || e.consumer >= n) throw new Error('layer3: effect consumer out of range');
    const eo = layout.effectOutput(m);
    // F2: bind the settlement RECIPIENT to the consumer and its value to the app expression.
    body.push(`require(tx.outputs[${eo}].lockingBytecode == tx.inputs[input${e.consumer}].lockingBytecode);`);
    body.push(`require(tx.outputs[${eo}].value == ${e.valueExpr});`);
  });

  (spec.events ?? []).forEach((ev, v) => {
    if (ev.emitter < 0 || ev.emitter >= n) throw new Error('layer3: event emitter out of range');
    if (!/^([0-9a-fA-F]{2})+$/.test(ev.topicHex)) throw new Error('layer3: event topic must be non-empty hex bytes');
    const vo = layout.eventOutput(v);
    const prefix = opReturnPrefix(IDENTITY_LEN + ev.topicHex.length / 2);
    // Authenticated event log: OP_RETURN <emitter identity><topic>, provenance bound to the emitter participant.
    body.push(`require(tx.outputs[${vo}].lockingBytecode == bytes.concat(hex"${prefix}", tx.inputs[input${ev.emitter}].lockingBytecode, hex"${ev.topicHex.toLowerCase()}"));`);
  });

  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${bindingParams(n).join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}

/** Params for the controller-bound framework: participant `input_i, output_i` pairs + the controller input index. */
export function controllerBindingParams(n: number): string[] {
  return [...bindingParams(n), 'bigint controllerIdx'];
}

/**
 * A minimal category-agnostic controller covenant (R7). The deployer sets the transcript root once via
 * `setRoot` (their signature); the transcript spend uses `attest`, which preserves everything (locking
 * bytecode, category, value, commitment). Category-agnostic so its p2sh32 address depends only on
 * `deployerPkh` and is stable/known before genesis - participants bake THIS address for exact controller
 * identity. Genesis it MINT-ONCE: one mutable NFT and NO minting NFT, so the CashToken category is
 * fixed-supply and can never be duplicated (the uniqueness proof R7 requires).
 */
export function generateControllerCovenant(): string {
  const preserve = (extra: string): string => `
    require(tx.outputs[this.activeInputIndex].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);
    require(tx.outputs[this.activeInputIndex].tokenCategory == tx.inputs[this.activeInputIndex].tokenCategory);
    require(tx.outputs[this.activeInputIndex].value == tx.inputs[this.activeInputIndex].value);
    ${extra}`;
  return `pragma solidcash >=0.8.0;
contract Layer3Controller(bytes deployerPkh) {
  function setRoot(bytes newRoot, pubkey pk, sig s) {
    require(hash160(pk) == deployerPkh);
    require(checkSig(s, pk));${preserve('require(tx.outputs[this.activeInputIndex].nftCommitment == newRoot);')}
  }
  function attest() {${preserve('require(tx.outputs[this.activeInputIndex].nftCommitment == tx.inputs[this.activeInputIndex].nftCommitment);')}
  }
}`;
}

/**
 * Controller-attested participant-SET binding (membership only - NOT a canonical execution transcript; see
 * layer3-production-reaudit.md R2). Homogeneous clone participants are bound to ONE attested address SET by a
 * co-spent CONTROLLER NFT (category `controllerCategory` baked in) whose commitment is
 * `sha256(ordered participant locking bytecodes)`. Every participant reconstructs the root from the co-spent
 * set and requires it == the controller's attestation, so an INJECTED extra participant fails membership (or
 * mismatches the root) and a DISJOINT co-bundle cannot match the one controller's one root. It preserves the
 * controller in place (bytecode/category/commitment/value) and the participant masters.
 *
 * SCOPE / what this does NOT do: it commits WHO the participants are, not WHAT they execute - no calls,
 * selectors, arguments, results, resources, events, or ordering are bound. The participants are clones of one
 * generated covenant (homogeneous), not independently compiled application contracts. It relies on the
 * EXTERNAL assumption of a single immutable mint-once controller NFT for the baked category (no genesis /
 * uniqueness proof here). It is an experimental building block toward a canonical execution transcript, not a
 * complete heterogeneous cyclic message bus.
 */
export function bindingFrameworkBodyControllerBound(
  n: number, controllerCategory: string, controllerLbc?: string, invocations?: ExecutionInvocation[],
): string[] {
  if (!Number.isInteger(n) || n < 2) throw new Error('layer3: need >= 2 participants');
  if (!/^[0-9a-fA-F]{64}$/.test(controllerCategory)) throw new Error('layer3: controllerCategory must be 32-byte hex');
  if (controllerLbc !== undefined && !/^([0-9a-fA-F]{2})+$/.test(controllerLbc)) {
    throw new Error('layer3: controllerLbc must be hex bytes');
  }
  (invocations ?? []).forEach((inv) => {
    if (inv.caller < 0 || inv.caller >= n || inv.callee < 0 || inv.callee >= n) {
      throw new Error('layer3: execution invocation endpoint out of range');
    }
    if (!/^([0-9a-fA-F]{2})+$/.test(inv.selectorHex)) throw new Error('layer3: selectorHex must be hex bytes');
  });
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
  for (let i = 1; i < n; i += 1) body.push(`require(u${i}.slice(0, rp) == u0.slice(0, rp));`);
  const members = Array.from({ length: n }, (_u, i) => `this.activeInputIndex == input${i}`);
  body.push(`require(${members.join(' || ')});`);
  // Controller attestation - exact identity + exhaustiveness.
  const distinct = Array.from({ length: n }, (_u, i) => `controllerIdx != input${i}`).join(' && ');
  body.push(`require(${distinct});`);
  // OP_UTXOTOKENCATEGORY returns the category in INTERNAL (reversed) byte order, so bake the reverse of the
  // display-order controllerCategory to compare against it.
  const catInternal = (controllerCategory.toLowerCase().match(/../g) as string[]).reverse().join('');
  body.push(`require(tx.inputs[controllerIdx].tokenCategory.slice(0, 32) == hex"${catInternal}");`);
  // R7 exact controller identity: the co-spent controller must be at the expected controller covenant address,
  // not merely carry the category. Combined with mint-once genesis (one NFT of that category, no minting NFT),
  // this uniquely identifies the genuine controller.
  if (controllerLbc !== undefined) {
    body.push(`require(tx.inputs[controllerIdx].lockingBytecode == hex"${controllerLbc.toLowerCase()}");`);
  }
  let lbcConcat = 'lbc0';
  for (let i = 1; i < n; i += 1) lbcConcat = `bytes.concat(${lbcConcat}, lbc${i})`;
  if (invocations && invocations.length) {
    // R2 EXECUTION root: domain || participant lbcs || ordered (caller_lbc, callee_lbc, selector) edges. This
    // commits the call GRAPH + selectors + order (read from the co-spent participants), not just addresses.
    let payload = `bytes.concat(hex"${EXEC_DOMAIN}", ${lbcConcat})`;
    for (const inv of invocations) {
      const edge = `bytes.concat(bytes.concat(lbc${inv.caller}, lbc${inv.callee}), hex"${inv.selectorHex.toLowerCase()}")`;
      payload = `bytes.concat(${payload}, ${edge})`;
    }
    body.push(`require(tx.inputs[controllerIdx].nftCommitment == sha256(${payload}));`);
  } else {
    body.push(`require(tx.inputs[controllerIdx].nftCommitment == sha256(${lbcConcat}));`); // participant-set root
  }
  body.push('require(tx.outputs[controllerIdx].lockingBytecode == tx.inputs[controllerIdx].lockingBytecode);');
  body.push('require(tx.outputs[controllerIdx].tokenCategory == tx.inputs[controllerIdx].tokenCategory);');
  body.push('require(tx.outputs[controllerIdx].nftCommitment == tx.inputs[controllerIdx].nftCommitment);');
  body.push('require(tx.outputs[controllerIdx].value == tx.inputs[controllerIdx].value);'); // R1: preserve value
  return body;
}

/**
 * Generate the controller-attested participant-SET binding covenant for `n` homogeneous participants
 * (membership only - not an execution transcript; see `bindingFrameworkBodyControllerBound`).
 */
export function generateControllerBoundCovenant(n: number, controllerCategory: string, controllerLbc?: string): string {
  const body = bindingFrameworkBodyControllerBound(n, controllerCategory, controllerLbc);
  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${controllerBindingParams(n).join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}

/**
 * Generate the EXECUTION-bound N-party covenant (R2): the controller commitment is a domain-separated root
 * over the participant set AND the ordered invocation edges (caller -> callee.selector), so the controller
 * attests the canonical call GRAPH, not just membership. Every participant recomputes the execution root from
 * the co-spent participants + the baked edges and requires it == the controller's attestation.
 */
export function generateExecutionBoundCovenant(
  n: number, invocations: ExecutionInvocation[], controllerCategory: string, controllerLbc?: string,
): string {
  const body = bindingFrameworkBodyControllerBound(n, controllerCategory, controllerLbc, invocations);
  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${controllerBindingParams(n).join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}
