// Layer-3 transcript covenant generator (production). Generates the reusable participant-binding FRAMEWORK
// for N participants - identity-by-reference, canonical byte-lex order, controller-brand cross-check,
// membership, and value/commitment preservation, with the self-audit fixes (F1/F2/N1/N2) baked in - then
// emits invocation, resource, and effect logic from the transcript spec. The MODULE owns the transaction
// LAYOUT (see transcriptLayout): the spec is index-free, and the generator + the deriver both read indices
// from the layout so covenant and transaction always agree. Every generated covenant runs on every
// participant input and validates the whole transcript. Unrolled per shape; the generator is general.
import { binToHex, hexToBin, sha256, utf8ToBin } from '@bitauth/libauth';
import { buildAnonymousEventNftCovenantScript } from '@solidcash/utils';
import { scriptToLockingBytecode } from '../utils.js';
import {
  compilerDerivedCallStatements, isCompilerDerivedExternalCalls, type DerivedExternalCallTable,
} from './derive-native.js';
import { normalizeProtocolVersions, protocolVersionHex } from './protocol.js';

/**
 * The canonical 4-byte selector of a participant METHOD (audit P3): first 4 bytes of sha256(signature). The
 * callee's generated covenant requires the edge selector to equal this, so an arbitrary selector makes the
 * covenant unspendable - the selector is bound to the callee's declared method, not a free label. (True
 * Native-call rows require a dispatched (multi-entry) callee: a single-entry artifact elides its selector,
 * making selector authentication impossible from transaction introspection alone.
 */
export function methodSelector(signature: string): string {
  return binToHex(sha256.hash(utf8ToBin(signature)).slice(0, 4));
}

/** The default controller brand: `L3B1CTRL` prologue (`<salt> OP_DROP` -> `084c3342314354524c75`). */
export const CONTROLLER_BRAND_PREFIX = '084c3342314354524c75';
/** The salt value that produces CONTROLLER_BRAND_PREFIX when passed as a Contract `salt` option. */
export const CONTROLLER_SALT_HEX = '4c3342314354524c';

/** An authenticated invocation: caller -> callee, msg.sender delivered to the layout's sender OP_RETURN. */
export interface InvocationSpec { caller: number; callee: number }
/**
 * An execution-transcript edge: caller -> callee.selector(args) -> result, in list order. Committed by the
 * framed execution root (R2/P4). `argsHex`/`resultHex` are the edge's canonical argument/result bytes for a
 * deterministic settlement; the callee authenticates `result == f(args, state)` in its own body.
 */
export interface ExecutionInvocation {
  caller: number; callee: number; selectorHex: string; argsHex?: string; resultHex?: string;
}
/** An execution-transcript event: an authenticated OP_RETURN record (emitter identity + topic), committed by the root. */
export interface ExecutionEvent { emitter: number; topicHex: string }
/**
 * An execution-transcript resource (audit P5): a co-spent state NFT of `categoryHex` OWNED by a participant,
 * committed in the framed execution root. The owner participant verifies the resource input carries the
 * committed category (its state is bound to the transcript). Resource k is co-spent at input `n+1+k`.
 */
export interface ExecutionResource { owner: number; categoryHex: string }
/**
 * A committed native call (audit finding 6): physical executor input `caller` makes an on-chain
 * `IContract(addr).method()` call to `calleeAddrHex` selecting `selectorHex`. Participant inputs use their
 * balanced base; a transitive caller uses its callee-slot input index. Committing the physical caller and
 * callee in the root makes the edge part of the authenticated transcript.
 */
export interface ExecutionExternalCall {
  caller: number;
  calleeAddrHex: string;
  selectorHex: string;
  /** Exact minimally-encoded unlocking prefix: selector push followed by all argument pushes. */
  callPrefixHex: string;
}
/** Domain tag for the canonical execution root ("L3EXEC1\0"), separating it from any other sha256 usage. */
export const EXEC_DOMAIN = '4c33455845433100';
/** Version byte of the framed execution-root encoding (audit P1). Bump on any encoding change. */
export const EXEC_VERSION = '03';
/** Fixed dust value (satoshis) of a balanced event-log NFT, so no value can be siphoned into a log output. */
export const EVENT_DUST = 1000;

/** P2SH32 locking bytecode of the standard 144-block anonymous event-NFT covenant for `categoryHex`. */
export function eventNftLockingBytecode(categoryHex: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(categoryHex)) {
    throw new Error('layer3: event category must be 32-byte hex');
  }
  return binToHex(scriptToLockingBytecode(
    buildAnonymousEventNftCovenantScript(hexToBin(categoryHex)), 'p2sh32',
  ));
}

const u8hex = (n: number): string => {
  if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error('layer3: framed count/index out of byte range');
  return n.toString(16).padStart(2, '0');
};

/**
 * The FRAMED execution-root sha256 expression (audit P1), byte-for-byte identical to the SDK `executionRoot`
 * encoder: domain || version || n || (len(lbc_i) || lbc_i)* || invCount || (callerIdx || calleeIdx ||
 * selector[4])* || evCount || (emitterIdx || len(topic) || topic)*. All counts/indices/selectors/topics are
 * compile-time literals; only the participant lbcs (and their lengths) are read at runtime from `lbc0..lbc_{n-1}`,
 * which the caller must have in scope. Length-counted tables + fixed 4-byte selectors make the preimage
 * collision-free.
 */
export function framedRootExpr(
  n: number, invocations: ExecutionInvocation[], events: ExecutionEvent[], resources: ExecutionResource[] = [],
  externalCalls: ExecutionExternalCall[] = [],
  protocolVersion: number = Number.parseInt(EXEC_VERSION, 16),
): string {
  let p = `bytes.concat(hex"${EXEC_DOMAIN}${protocolVersionHex(protocolVersion)}${u8hex(n)}", `
    + 'bytes.concat(bytes1(lbc0.length), lbc0))';
  for (let i = 1; i < n; i += 1) p = `bytes.concat(${p}, bytes.concat(bytes1(lbc${i}.length), lbc${i}))`;
  p = `bytes.concat(${p}, hex"${u8hex(invocations.length)}")`;
  for (const inv of invocations) {
    if (inv.caller < 0 || inv.caller >= n || inv.callee < 0 || inv.callee >= n) {
      throw new Error('layer3: execution invocation endpoint out of range');
    }
    const sel = inv.selectorHex.toLowerCase();
    if (!/^[0-9a-f]{8}$/.test(sel)) throw new Error('layer3: selector must be exactly 4 bytes');
    const args = (inv.argsHex ?? '').toLowerCase();
    const result = (inv.resultHex ?? '').toLowerCase();
    if (args && !/^([0-9a-f]{2})+$/.test(args)) throw new Error('layer3: argsHex must be hex bytes');
    if (result && !/^([0-9a-f]{2})+$/.test(result)) throw new Error('layer3: resultHex must be hex bytes');
    // framed row: callerIdx || calleeIdx || selector[4] || len(args) || args || len(result) || result
    p = `bytes.concat(${p}, hex"${u8hex(inv.caller)}${u8hex(inv.callee)}${sel}`
      + `${u8hex(args.length / 2)}${args}${u8hex(result.length / 2)}${result}")`;
  }
  p = `bytes.concat(${p}, hex"${u8hex(events.length)}")`;
  for (const ev of events) {
    if (ev.emitter < 0 || ev.emitter >= n) throw new Error('layer3: execution event emitter out of range');
    const topic = ev.topicHex.toLowerCase();
    if (!/^([0-9a-f]{2})+$/.test(topic)) throw new Error('layer3: event topic must be hex bytes');
    p = `bytes.concat(${p}, hex"${u8hex(ev.emitter)}${u8hex(topic.length / 2)}${topic}")`;
  }
  p = `bytes.concat(${p}, hex"${u8hex(resources.length)}")`;
  for (const r of resources) {
    if (r.owner < 0 || r.owner >= n) throw new Error('layer3: execution resource owner out of range');
    const cat = r.categoryHex.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(cat)) throw new Error('layer3: resource category must be 32-byte hex');
    p = `bytes.concat(${p}, hex"${u8hex(r.owner)}${cat}")`; // ownerIdx || category(32)
  }
  p = `bytes.concat(${p}, hex"${u8hex(externalCalls.length)}")`;
  for (const x of externalCalls) {
    if (!Number.isInteger(x.caller) || x.caller < 0 || x.caller > 255) {
      throw new Error('layer3: external-call caller input out of byte range');
    }
    const addr = x.calleeAddrHex.toLowerCase();
    if (!/^([0-9a-f]{2})+$/.test(addr)) throw new Error('layer3: external-call address must be hex bytes');
    const xsel = x.selectorHex.toLowerCase();
    if (!/^[0-9a-f]{8}$/.test(xsel)) throw new Error('layer3: external-call selector must be exactly 4 bytes');
    const prefix = x.callPrefixHex.toLowerCase();
    if (!/^([0-9a-f]{2})+$/.test(prefix) || !prefix.startsWith(`04${xsel}`)) {
      throw new Error('layer3: external-call prefix must begin with the minimally-pushed selector');
    }
    // framed row: callerInput || len(addr) || addr || selector[4] || len(callPrefix) || callPrefix
    p = `bytes.concat(${p}, hex"${u8hex(x.caller)}${u8hex(addr.length / 2)}${addr}${xsel}`
      + `${u8hex(prefix.length / 2)}${prefix}")`;
  }
  return `sha256(${p})`;
}
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
  events?: ExecutionEvent[], oneShot = false, resources: ExecutionResource[] = [],
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
  body.push(`bytes execRoot = ${framedRootExpr(n, invocations, evs, resources)};`); // framed, collision-free (audit P1)
  const catInternal = (controllerCategory.toLowerCase().match(/../g) as string[]).reverse().join('');
  body.push(`require(tx.inputs[${n}].tokenCategory.slice(0, 32) == hex"${catInternal}");`);
  body.push(`require(tx.inputs[${n}].lockingBytecode == hex"${controllerLbc.toLowerCase()}");`);
  body.push(`require(tx.inputs[${n}].nftCommitment == execRoot);`);
  if (!oneShot) {
    // Reusable controller: preserved in place. (One-shot: the controller covenant BURNS itself instead, so
    // preserving it here would contradict the burn - the replay policy lives in the controller.)
    body.push(`require(tx.outputs[${n}].lockingBytecode == tx.inputs[${n}].lockingBytecode);`);
    body.push(`require(tx.outputs[${n}].tokenCategory == tx.inputs[${n}].tokenCategory);`);
    body.push(`require(tx.outputs[${n}].nftCommitment == tx.inputs[${n}].nftCommitment);`);
    body.push(`require(tx.outputs[${n}].value == tx.inputs[${n}].value);`);
  }
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
  // P5: the OWNER of each resource verifies its co-spent state NFT (at input n+1+k) carries the committed
  // category - so the resource's state is bound into the same execution root, not a disconnected scaffold.
  resources.forEach((r, k) => {
    if (r.owner === selfPos) {
      const resCatInternal = (r.categoryHex.toLowerCase().match(/../g) as string[]).reverse().join('');
      body.push(`require(tx.inputs[${n + 1 + k}].tokenCategory.slice(0, 32) == hex"${resCatInternal}");`);
    }
  });
  return body;
}

/**
 * Auto-wiring (refinement 1): generate a full participant covenant from a spec, injecting the execution-
 * transcript verification (`executionMemberBody`) automatically so the developer does NOT hand-splice it. The
 * developer supplies the contract/function shell + their own `appBody`; the module wires the transcript. When
 * an invocation names this participant (`selfPos`) as caller, its `nativeCall` (e.g.
 * `IFoo(tx.inputs[1].lockingBytecode).method(x)`) is emitted in the SAME body, so the native call and its
 * transcript edge come from ONE declaration. (Full compiler-side derivation of the edge directly from
 * `IContract(addr).method()` syntax is a further ergonomic step; this is the module-level auto-wiring.)
 */
export interface ExecutionParticipantSpec {
  contractName: string;
  functionName: string;
  functionParams?: string;
  n: number;
  selfPos: number;
  invocations: ExecutionInvocation[];
  controllerCategory: string;
  controllerLbc: string;
  events?: ExecutionEvent[];
  oneShot?: boolean;
  resources?: ExecutionResource[];
  appBody?: string[];
  /** Native calls to emit for the edges this participant is the caller of (index-aligned to `invocations`). */
  nativeCalls?: Record<number, string>;
  /**
   * A callee STATE JOURNAL (audit P2/P3/P6/P7): this participant EXECUTES every edge naming it as callee, in
   * list order, against the 8-byte state field of its resource `resourceIndex`. Each edge's selector selects
   * the operation from `ops` (selectorHex -> add|sub|mul), applied with the edge's args; the final state is
   * flushed once to the resource output. So repeated calls to one physical callee, ordered dependency, and
   * selector-to-operation dispatch are REAL state transitions, not hashed labels.
   */
  journal?: {
    resourceIndex: number;
    ops: Record<string, 'add' | 'sub' | 'mul'>;
    /**
     * A->B->A response edges: invocation indices of OUTGOING edges (this participant is the caller) whose args
     * must equal this participant's flushed post-state. This makes the participant emit its AUTHENTIC computed
     * state to a downstream consumer, so a caller that consumes the response applies a real result, not a label.
     */
    emits?: number[];
  };
}
export function generateExecutionParticipant(spec: ExecutionParticipantSpec): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(spec.contractName)) throw new Error('layer3: invalid contractName');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(spec.functionName)) throw new Error('layer3: invalid functionName');
  const member = executionMemberBody(
    spec.n, spec.selfPos, spec.invocations, spec.controllerCategory, spec.controllerLbc, spec.events, spec.oneShot,
    spec.resources,
  );
  // P3: this participant's method has a canonical selector; every edge naming it as callee must use that
  // selector, or the covenant is unspendable (an arbitrary selector can no longer pass). P4: expose each such
  // edge's committed args/result (bound in the framed root) so the appBody can authenticate result==f(args,state).
  const sel = methodSelector(spec.functionName);
  const edgeVars: string[] = [];
  spec.invocations.forEach((inv, j) => {
    if (inv.callee === spec.selfPos) {
      // P3: without a journal, the single-method callee binds its edges to its own method selector. WITH a
      // journal, the journal's op-map dispatches each edge's selector to an operation (real multi-op dispatch),
      // so the selector is bound there instead.
      if (!spec.journal) edgeVars.push(`require(hex"${inv.selectorHex.toLowerCase()}" == hex"${sel}"); // P3: selector == method`);
      edgeVars.push(`bytes edgeArgs${j} = hex"${(inv.argsHex ?? '').toLowerCase()}";`);
      edgeVars.push(`bytes edgeResult${j} = hex"${(inv.resultHex ?? '').toLowerCase()}";`);
    }
  });
  const calls: string[] = [];
  spec.invocations.forEach((inv, j) => {
    if (inv.caller === spec.selfPos && spec.nativeCalls?.[j]) calls.push(spec.nativeCalls[j]);
  });
  // P2/P6/P7: the callee JOURNAL executes every incoming edge, in order, against its resource state.
  const journalBody: string[] = [];
  if (spec.journal) {
    const k = spec.journal.resourceIndex;
    if (!Number.isInteger(k) || k < 0 || k >= (spec.resources?.length ?? 0)) {
      throw new Error('layer3: journal resourceIndex out of range');
    }
    const at = spec.n + 1 + k; // the participant's state resource is co-spent at input n+1+k and recreated there
    // The state field is EXACTLY 8 bytes on both sides (audit): no hidden trailing state can ride along.
    journalBody.push(`require(tx.inputs[${at}].nftCommitment.length == 8);`);
    journalBody.push(`bigint jstate = int(tx.inputs[${at}].nftCommitment);`);
    spec.invocations.forEach((inv, j) => {
      if (inv.callee === spec.selfPos) {
        const op = spec.journal!.ops[inv.selectorHex.toLowerCase()];
        if (!op) throw new Error(`layer3: journal has no operation for edge ${j} selector ${inv.selectorHex}`);
        const sym = op === 'add' ? '+' : op === 'sub' ? '-' : '*';
        journalBody.push(`jstate = jstate ${sym} int(edgeArgs${j});`); // apply this edge's op, in order
      }
    });
    // Preserve locking bytecode + category + value + fungible amount; only the NFT commitment transitions.
    journalBody.push(`require(tx.outputs[${at}].lockingBytecode == tx.inputs[${at}].lockingBytecode);`);
    journalBody.push(`require(tx.outputs[${at}].tokenCategory == tx.inputs[${at}].tokenCategory);`);
    journalBody.push(`require(tx.outputs[${at}].value == tx.inputs[${at}].value);`);
    journalBody.push(`require(tx.outputs[${at}].tokenAmount == tx.inputs[${at}].tokenAmount);`);
    journalBody.push('require(jstate >= 0);'); // non-negative counter: reject underflow; bytes8 fails on overflow
    journalBody.push(`require(tx.outputs[${at}].nftCommitment == bytes8(jstate));`); // flush once, full commitment
    // A->B->A: each designated outgoing edge must carry this participant's authentic post-state as its args,
    // so a downstream journal that consumes it applies the real computed result, not a committed label.
    (spec.journal.emits ?? []).forEach((e) => {
      const out = spec.invocations[e];
      if (!out || out.caller !== spec.selfPos) {
        throw new Error(`layer3: journal emits[${e}] is not an outgoing edge of this participant`);
      }
      journalBody.push(`require(bytes8(jstate) == hex"${(out.argsHex ?? '').toLowerCase()}");`);
    });
  }
  const body = [...member, ...edgeVars, ...journalBody, ...calls, ...(spec.appBody ?? [])];
  return `pragma solidcash >=0.8.0;\ncontract ${spec.contractName}() {\n`
    + `  function ${spec.functionName}(${spec.functionParams ?? ''}) {\n    ${body.join('\n    ')}\n  }\n}`;
}

// ---------------------------------------------------------------------------------------------------------
// Balanced block layouts (audit P8/P9/P10). Every participant owns a CONTIGUOUS block with equal input and
// output cardinality: slot 0 is its covenant EXECUTOR (a one-shot spend), followed by `dataSlots` co-spent
// state NFTs and `events` event-NFT slots. Blocks concatenate by computed bases (base_{i+1} = base_i +
// size_i), so a later block's input base equals its output base regardless of earlier block contents. The
// controller is its own 1-slot block after the participants; the fee input is paired with the change output
// in the final tail slot. Covenants address every slot by block base, never by a fixed global index, so real
// native calls and event NFTs compose without relocating references.
// See docs/balanced-block-layout-composability.md.

/** One participant's balanced block: executor (slot 0) + `dataSlots` co-spent state NFTs + `events` event slots. */
export interface BalancedBlock { dataSlots: number; events: number }

/** The computed physical index space for a balanced transcript: participant blocks, controller, fee tail. */
export interface BalancedLayout {
  n: number;
  blocks: BalancedBlock[];
  /** Physical index of participant i's covenant executor (block slot 0; input == output base). */
  base: (i: number) => number;
  /** Total slots in participant i's block (1 executor + dataSlots + events). */
  size: (i: number) => number;
  /** Physical index of state NFT `d` in participant i's block (after the executor). */
  dataSlot: (i: number, d: number) => number;
  /** Physical index of event slot `e` in participant i's block (after its state NFTs). */
  eventSlot: (i: number, e: number) => number;
  /** Physical index of native-call callee slot `k` (after all participant blocks, before the controller). */
  calleeBase: (k: number) => number;
  /** Number of native-call callee slots. */
  calleeSlots: number;
  /** Physical base of the controller's 1-slot block (after participants + callee blocks). */
  controllerBase: number;
  /** Physical index of the fee/change tail slot (after the controller). */
  feeBase: number;
  /** Total input == output count of the whole balanced transaction. */
  totalSlots: number;
}

/**
 * Compute the balanced layout from each participant's block shape. Participant blocks come first, in order,
 * then `calleeSlots` native-call callee slots (audit P8), then the controller block, then the fee tail.
 */
export function balancedLayout(blocks: BalancedBlock[], calleeSlots = 0): BalancedLayout {
  if (blocks.length < 2) throw new Error('layer3: need >= 2 participant blocks');
  if (!Number.isInteger(calleeSlots) || calleeSlots < 0) throw new Error('layer3: calleeSlots must be >= 0');
  const bases: number[] = [];
  let acc = 0;
  for (const b of blocks) {
    if (!Number.isInteger(b.dataSlots) || b.dataSlots < 0) throw new Error('layer3: block dataSlots must be >= 0');
    if (!Number.isInteger(b.events) || b.events < 0) throw new Error('layer3: block events must be >= 0');
    bases.push(acc);
    acc += 1 + b.dataSlots + b.events;
  }
  const calleeStart = acc;
  const controllerBase = acc + calleeSlots;
  return {
    n: blocks.length,
    blocks,
    base: (i) => bases[i],
    size: (i) => 1 + blocks[i].dataSlots + blocks[i].events,
    dataSlot: (i, d) => bases[i] + 1 + d,
    eventSlot: (i, e) => bases[i] + 1 + blocks[i].dataSlots + e,
    calleeBase: (k) => calleeStart + k,
    calleeSlots,
    controllerBase,
    feeBase: controllerBase + 1,
    totalSlots: controllerBase + 2,
  };
}

/** Local data-slot index of each resource within its owner's block (resources of one owner get 0,1,2...). */
function resourceLocalIndex(resources: ExecutionResource[]): number[] {
  const perOwner = new Map<number, number>();
  return resources.map((r) => {
    const d = perOwner.get(r.owner) ?? 0;
    perOwner.set(r.owner, d + 1);
    return d;
  });
}

/**
 * The balanced membership body (audit P9). Reads each participant's lbc at its executor base, recomputes the
 * framed execution root, binds the co-spent controller (exact category + lbc + commitment, preserved unless
 * one-shot) at `controllerBase`, and asserts the whole balanced slot count so no output can be inserted or
 * omitted to shift a later block's base (audit P9 criterion 7). Each owner pins and preserves its state NFTs
 * (block-relative data slots); their commitments are bound by the generator (preserved or journal-flushed).
 */
export function balancedMemberBody(
  layout: BalancedLayout, selfPos: number, invocations: ExecutionInvocation[],
  controllerCategory: string, controllerLbc: string, events: ExecutionEvent[] = [], oneShot = false,
  resources: ExecutionResource[] = [], externalCalls: ExecutionExternalCall[] = [],
  protocolVersions: readonly number[] = [Number.parseInt(EXEC_VERSION, 16)],
): string[] {
  if (selfPos < 0 || selfPos >= layout.n) throw new Error('layer3: selfPos out of range');
  if (!/^[0-9a-fA-F]{64}$/.test(controllerCategory)) throw new Error('layer3: controllerCategory must be 32-byte hex');
  if (!/^([0-9a-fA-F]{2})+$/.test(controllerLbc)) throw new Error('layer3: controllerLbc must be hex bytes');
  if (layout.calleeSlots > 0 && !isCompilerDerivedExternalCalls(externalCalls)) {
    throw new Error('layer3: native external-call rows must be derived from compiler artifact metadata');
  }
  if (externalCalls.length !== layout.calleeSlots) {
    throw new Error('layer3: every callee slot must have exactly one external-call row');
  }
  externalCalls.forEach((x) => {
    if (x.caller >= layout.controllerBase) {
      throw new Error('layer3: external-call caller must be a participant or preceding callee input');
    }
  });
  const body: string[] = [];
  for (let i = 0; i < layout.n; i += 1) body.push(`bytes lbc${i} = tx.inputs[${layout.base(i)}].lockingBytecode;`);
  const versions = normalizeProtocolVersions(protocolVersions);
  versions.forEach((version, index) => {
    body.push(
      `bytes execRoot${index} = ${
        framedRootExpr(layout.n, invocations, events, resources, externalCalls, version)
      };`,
    );
  });
  const cb = layout.controllerBase;
  const catInternal = (controllerCategory.toLowerCase().match(/../g) as string[]).reverse().join('');
  body.push(`require(tx.inputs[${cb}].tokenCategory.slice(0, 32) == hex"${catInternal}");`);
  body.push(`require(tx.inputs[${cb}].lockingBytecode == hex"${controllerLbc.toLowerCase()}");`);
  body.push(`require(${
    versions.map((_version, index) => `tx.inputs[${cb}].nftCommitment == execRoot${index}`).join(' || ')
  });`);
  if (!oneShot) {
    body.push(`require(tx.outputs[${cb}].lockingBytecode == tx.inputs[${cb}].lockingBytecode);`);
    body.push(`require(tx.outputs[${cb}].tokenCategory == tx.inputs[${cb}].tokenCategory);`);
    body.push(`require(tx.outputs[${cb}].nftCommitment == tx.inputs[${cb}].nftCommitment);`);
    body.push(`require(tx.outputs[${cb}].value == tx.inputs[${cb}].value);`);
  }
  body.push(`require(this.activeInputIndex == ${layout.base(selfPos)});`);
  // Balanced closure: the transcript is a CLOSED block set (participants + controller + fee). Pinning the exact
  // total prevents inserting or omitting any slot to shift a later block's base. Native-call callee blocks
  // extend the layout total (see generateBalancedParticipant), so this stays exact under composition.
  body.push(`require(tx.inputs.length == ${layout.totalSlots});`);
  body.push(`require(tx.outputs.length == ${layout.totalSlots});`);
  // P5: each owner pins + preserves its state NFTs (block-relative data slots). Category is committed in the
  // same root; lbc + category are preserved input->output; the commitment is bound by the generator.
  const local = resourceLocalIndex(resources);
  resources.forEach((r, k) => {
    if (r.owner === selfPos) {
      const si = layout.dataSlot(selfPos, local[k]);
      const resCatInternal = (r.categoryHex.toLowerCase().match(/../g) as string[]).reverse().join('');
      body.push(`require(tx.inputs[${si}].tokenCategory.slice(0, 32) == hex"${resCatInternal}");`);
      body.push(`require(tx.outputs[${si}].lockingBytecode == tx.inputs[${si}].lockingBytecode);`);
      body.push(`require(tx.outputs[${si}].tokenCategory == tx.inputs[${si}].tokenCategory);`);
      // Value + fungible-amount preservation (audit): the state NFT's satoshis cannot be siphoned into change,
      // and no fungible amount can be added or dropped while the covenant only rewrites the NFT commitment.
      body.push(`require(tx.outputs[${si}].value == tx.inputs[${si}].value);`);
      body.push(`require(tx.outputs[${si}].tokenAmount == tx.inputs[${si}].tokenAmount);`);
    }
  });
  // P10: events are NFT slots INSIDE the emitter's own balanced block (block-relative), branded with the
  // emitter's committed state category (provenance) and carrying the topic in the commitment. Exhaustiveness
  // is structural - the block has exactly `events` event slots and the balanced closure pins the total - so no
  // event can be added or omitted. No global OP_RETURN scan, no cross-protocol interference, spendable records.
  const myEvents = events.filter((ev) => ev.emitter === selfPos);
  if (myEvents.length !== layout.blocks[selfPos].events) {
    throw new Error('layer3: block.events count disagrees with the events emitted by this participant');
  }
  if (myEvents.length > 0) {
    const myRes = resources.find((r) => r.owner === selfPos);
    if (!myRes) throw new Error('layer3: an event emitter must own a state NFT (minting) to brand its events');
    const brandInternal = (myRes.categoryHex.toLowerCase().match(/../g) as string[]).reverse().join('');
    const eventLbc = eventNftLockingBytecode(myRes.categoryHex);
    myEvents.forEach((ev, e) => {
      const eo = layout.eventSlot(selfPos, e);
      // FULLY authenticate the event NFT (audit): a log record is an IMMUTABLE (none-capability), zero-amount,
      // dust NFT locked to the standard delayed-cleanup covenant. Comparing the WHOLE tokenCategory forces none -
      // a mutable/minting NFT carries a 33-byte category and fails, so no extra mint/mutate authority can be
      // smuggled into an event slot. Value is pinned to dust so satoshis cannot be siphoned into the log.
      body.push(`require(tx.outputs[${eo}].tokenCategory == hex"${brandInternal}");`);
      body.push(`require(tx.outputs[${eo}].nftCommitment == hex"${ev.topicHex.toLowerCase()}");`);
      body.push(`require(tx.outputs[${eo}].tokenAmount == 0);`);
      body.push(`require(tx.outputs[${eo}].value == ${EVENT_DUST});`);
      // Use the platform event covenant, not the participant master covenant. The output is independently
      // spendable by anyone after 144 blocks, while provenance/content remain authenticated by this emitter.
      body.push(`require(tx.outputs[${eo}].lockingBytecode == hex"${eventLbc}");`);
    });
  }
  // Finding 6: pin each committed native call's callee to the layout callee slot, from the ROOT (not the
  // caller's runtime witness). So the co-spent callee at calleeBase(k) IS the transcript-committed address -
  // the call cannot be retargeted outside the controller-attested transcript, and every participant enforces it.
  externalCalls.forEach((x, k) => {
    const addr = x.calleeAddrHex.toLowerCase();
    const selector = x.selectorHex.toLowerCase();
    const prefix = x.callPrefixHex.toLowerCase();
    const callee = layout.calleeBase(k);
    // A callee cannot call itself or a later, not-yet-authenticated slot. Requiring a preceding executor makes
    // the row table a topological physical-call chain; logical A->B->A cycles remain represented by participant
    // invocation edges, while each UTXO still executes once.
    if (x.caller >= callee) {
      throw new Error('layer3: external-call caller must precede its callee slot');
    }
    const participantCaller = layout.blocks.findIndex((_block, participant) => layout.base(participant) === x.caller);
    if (participantCaller >= 0) {
      body.push(`require(tx.inputs[${x.caller}].lockingBytecode == lbc${participantCaller});`);
    } else {
      const callerSlot = x.caller - layout.calleeBase(0);
      const callerRow = externalCalls[callerSlot];
      if (!callerRow) throw new Error('layer3: transitive caller is not a preceding committed callee');
      body.push(`require(tx.inputs[${x.caller}].lockingBytecode == hex"${callerRow.calleeAddrHex.toLowerCase()}");`);
    }
    body.push(`require(tx.inputs[${callee}].lockingBytecode == hex"${addr}");`);
    // Match the compiler's native external-call verification exactly: a dispatched entry point begins with a
    // minimal 4-byte push (0x04), followed by the canonical ABI selector. Magic/content scanning is forbidden.
    body.push(`require(tx.inputs[${callee}].unlockingBytecode.slice(0, 5) == hex"04${selector}");`);
    body.push(`require(tx.inputs[${callee}].unlockingBytecode.slice(0, ${prefix.length / 2}) == hex"${prefix}");`);
  });
  return body;
}

/** A balanced participant: its block shape is `blocks[selfPos]`; journal operates on its own master state. */
export interface BalancedParticipantSpec {
  contractName: string;
  functionName: string;
  functionParams?: string;
  selfPos: number;
  /** Block shape for EVERY participant (so every covenant computes the same bases). */
  blocks: BalancedBlock[];
  /** Native-call callee slots appended after the participant blocks (audit P8); shifts the controller base. */
  calleeSlots?: number;
  /** Source that precedes the contract (interface declarations for native `IContract(addr).method()` calls). */
  preamble?: string;
  /** Constructor params for the participant contract (e.g. `bytes calleeAddr` for a native call target). */
  constructorParams?: string;
  invocations: ExecutionInvocation[];
  controllerCategory: string;
  controllerLbc: string;
  events?: ExecutionEvent[];
  resources?: ExecutionResource[];
  /** Committed native calls (finding 6): each pins the co-spent callee at a layout callee slot from the root. */
  externalCalls?: DerivedExternalCallTable;
  oneShot?: boolean;
  /** Immutable transcript protocols retained by this artifact (maximum two). */
  protocolVersions?: readonly number[];
  appBody?: string[];
  /**
   * A state journal over one of this participant's co-spent state NFTs (`dataIndex` = which of its own data
   * slots, default 0): apply every incoming edge in order (committed selector -> op), flush once to the
   * recreated state NFT commitment. `emits` designates outgoing edges whose args must equal the flushed
   * post-state (A->B->A authentic result). The state NFT must be listed in `resources` (owner == selfPos).
   */
  journal?: { ops: Record<string, 'add' | 'sub' | 'mul'>; emits?: number[]; dataIndex?: number };
}

/**
 * Generate a full participant covenant on the balanced block layout (audit P8/P9). The participant is a
 * one-shot covenant executor (block slot 0) that governs its co-spent state NFTs (data slots) - preserved or
 * journal-flushed. Every slot is addressed by block base, so the covenant composes with native-call callee
 * blocks and event slots without relocating references.
 */
export function generateBalancedParticipant(spec: BalancedParticipantSpec): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(spec.contractName)) throw new Error('layer3: invalid contractName');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(spec.functionName)) throw new Error('layer3: invalid functionName');
  if ((spec.calleeSlots ?? 0) > 0 && !isCompilerDerivedExternalCalls(spec.externalCalls ?? [])) {
    throw new Error('layer3: native external-call rows must be derived from compiler artifact metadata');
  }
  const layout = balancedLayout(spec.blocks, spec.calleeSlots ?? 0);
  const member = balancedMemberBody(
    layout, spec.selfPos, spec.invocations, spec.controllerCategory, spec.controllerLbc,
    spec.events, spec.oneShot, spec.resources, spec.externalCalls, spec.protocolVersions,
  );
  const edgeVars: string[] = [];
  spec.invocations.forEach((inv, j) => {
    if (inv.callee === spec.selfPos) {
      edgeVars.push(`bytes edgeArgs${j} = hex"${(inv.argsHex ?? '').toLowerCase()}";`);
    }
  });
  const stateBody: string[] = [];
  const journalDataIndex = spec.journal ? (spec.journal.dataIndex ?? 0) : -1;
  if (spec.journal) {
    const at = layout.dataSlot(spec.selfPos, journalDataIndex); // this participant's journaled state NFT
    // The journal reads/flushes the co-spent state NFT commitment (lbc + category already preserved by member).
    // The state field is EXACTLY 8 bytes on both sides (audit): a longer input commitment (whose trailing
    // bytes int() would ignore) and a longer output commitment (whose trailing bytes the slice would leave
    // unconstrained) are both rejected, so the entire commitment is bound - no hidden trailing state.
    stateBody.push(`require(tx.inputs[${at}].nftCommitment.length == 8);`);
    stateBody.push(`bigint jstate = int(tx.inputs[${at}].nftCommitment);`);
    spec.invocations.forEach((inv, j) => {
      if (inv.callee === spec.selfPos) {
        const op = spec.journal!.ops[inv.selectorHex.toLowerCase()];
        if (!op) throw new Error(`layer3: journal has no operation for edge ${j} selector ${inv.selectorHex}`);
        const sym = op === 'add' ? '+' : op === 'sub' ? '-' : '*';
        stateBody.push(`jstate = jstate ${sym} int(edgeArgs${j});`);
      }
    });
    // Specified arithmetic domain (audit): the state is a non-negative 8-byte counter. `require(jstate >= 0)`
    // rejects underflow (sub past zero) and negative results; `bytes8(jstate)` fails closed on overflow (a
    // magnitude that does not fit 8 bytes), so over/underflow can never silently wrap.
    stateBody.push('require(jstate >= 0);');
    stateBody.push(`require(tx.outputs[${at}].nftCommitment == bytes8(jstate));`);
    (spec.journal.emits ?? []).forEach((e) => {
      const out = spec.invocations[e];
      if (!out || out.caller !== spec.selfPos) {
        throw new Error(`layer3: journal emits[${e}] is not an outgoing edge of this participant`);
      }
      stateBody.push(`require(bytes8(jstate) == hex"${(out.argsHex ?? '').toLowerCase()}");`);
    });
  }
  // Fail-closed: every OTHER state NFT this participant owns has its commitment preserved (only the journaled
  // slot transitions). No owned state can drift unconstrained.
  const owned = resourceLocalIndex(spec.resources ?? []);
  (spec.resources ?? []).forEach((r, k) => {
    if (r.owner === spec.selfPos && owned[k] !== journalDataIndex) {
      const si = layout.dataSlot(spec.selfPos, owned[k]);
      stateBody.push(`require(tx.outputs[${si}].nftCommitment == tx.inputs[${si}].nftCommitment);`);
    }
  });
  const derivedCalls = spec.externalCalls
    ? compilerDerivedCallStatements(spec.externalCalls, layout.base(spec.selfPos)) : [];
  const body = [...member, ...edgeVars, ...stateBody, ...derivedCalls, ...(spec.appBody ?? [])];
  const preamble = spec.preamble ? `${spec.preamble}\n` : '';
  return `pragma solidcash >=0.8.0;\n${preamble}contract ${spec.contractName}(${spec.constructorParams ?? ''}) {\n`
    + `  function ${spec.functionName}(${spec.functionParams ?? ''}) {\n    ${body.join('\n    ')}\n  }\n}`;
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
      // P11: the input commitment MUST be exactly `total` bytes, so no trailing byte can be silently kept by
      // the SDK while the covenant discards it (SDK/covenant agree for every ADMITTED input).
      body.push(`require(${inC}.length == ${t.total});`);
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
    require(checkSig(s, pk));
    require(tx.inputs[this.activeInputIndex].nftCommitment.length == 0);${preserve('require(tx.outputs[this.activeInputIndex].nftCommitment == newRoot);')}
  }
  function attest() {${preserve('require(tx.outputs[this.activeInputIndex].nftCommitment == tx.inputs[this.activeInputIndex].nftCommitment);')}
  }
}`;
}

/**
 * A ONE-SHOT controller variant (replay policy). Its `attest` CONSUMES the controller: no output may recreate
 * its category, so - because the category is mint-once (one NFT, no minting NFT) - after the transcript it has
 * ZERO tokens forever and the same execution root can NEVER be re-attested. Use with `executionMemberBody
 * (..., { oneShot: true })`, which skips the controller output-preservation (the controller is burned, not
 * recreated). `setRoot` still lets the deployer set the root once before the single execution.
 */
export function generateOneShotControllerCovenant(): string {
  return `pragma solidcash >=0.8.0;
contract Layer3OneShotController(bytes deployerPkh) {
  function setRoot(bytes newRoot, pubkey pk, sig s) {
    require(hash160(pk) == deployerPkh);
    require(checkSig(s, pk));
    require(tx.inputs[this.activeInputIndex].nftCommitment.length == 0);
    require(tx.outputs[this.activeInputIndex].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);
    require(tx.outputs[this.activeInputIndex].tokenCategory == tx.inputs[this.activeInputIndex].tokenCategory);
    require(tx.outputs[this.activeInputIndex].value == tx.inputs[this.activeInputIndex].value);
    require(tx.outputs[this.activeInputIndex].nftCommitment == newRoot);
  }
  function attest() {
    bytes myCat = tx.inputs[this.activeInputIndex].tokenCategory.slice(0, 32);
    bigint recreated = 0;
    for (bigint oi = 0; oi < tx.outputs.length; oi = oi + 1) {
      bytes oc = tx.outputs[oi].tokenCategory;
      if (oc.length >= 32) {
        if (oc.slice(0, 32) == myCat) { recreated = recreated + 1; }
      }
    }
    require(recreated == 0);
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
  if (invocations && invocations.length) {
    // R2 EXECUTION root, FRAMED (audit P1): the shared collision-free encoder.
    body.push(`require(tx.inputs[controllerIdx].nftCommitment == ${framedRootExpr(n, invocations, [])});`);
  } else {
    let lbcConcat = 'lbc0';
    for (let i = 1; i < n; i += 1) lbcConcat = `bytes.concat(${lbcConcat}, lbc${i})`;
    body.push(`require(tx.inputs[controllerIdx].nftCommitment == sha256(${lbcConcat}));`); // participant-set root (membership only)
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
