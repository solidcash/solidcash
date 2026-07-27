import type { Artifact, AbiFunction } from '@solidcash/utils';

/**
 * E3 - explicit delegate-participant classes.
 *
 * "delegate" is not one class. A proxy/implementation pair answers three separate authority questions, and each
 * is answered by a DIFFERENT mechanism depending on how the proxy resolves `impl` and what the implementation's
 * `delegate` function touches:
 *
 * - CODE IDENTITY: which script is allowed to write the proxy's state.
 * - STATE OWNER: which master the implementation's covenant treats as "the proxy".
 * - OUTPUT AUTHORITY: which outputs the implementation's covenant pins.
 *
 * This module enumerates the admitted combinations explicitly and rejects everything else with a stable,
 * named diagnostic instead of leaving `delegate` as one undifferentiated bucket.
 *
 * SCOPE OF THIS GATE. Everything here is an SDK BUILDER guard over published artifact metadata. It is not a
 * covenant check: a caller that splices unlocking bytecode directly never reaches it. The covenant-level
 * authority for an admitted class is listed per class below and is what the VM cases in
 * `test/e2e/Layer3DelegateClassesE3.test.ts` attack.
 */

/** How the proxy decides which script may write its state. */
export type DelegateCodeIdentity =
  /** `impl` is a source literal or constructor argument, so the proxy's own p2sh32 commits to it. */
  | 'bytecode-pinned'
  /** `impl` is a parameter and the proxy function also takes a signature, so an authorized signer selects it. */
  | 'caller-authorized';

/** Which master the implementation covenant treats as the proxy. */
export type DelegateStateOwner =
  /**
   * Positional, identity-free: the covenant requires `_proxyMasterIndex == OP_INPUTINDEX - (1 + dataNftCount)`
   * plus minting capability and self-preservation at that input. It does NOT pin the proxy's category or
   * locking bytecode, so one implementation serves many proxies by design.
   */
  | 'adjacent-proxy-block'
  /** Branded library: the covenant additionally pins the proxy master's category to the `__brand` ctor arg. */
  | 'brand-pinned';

/** Which outputs the implementation covenant pins. */
export type DelegateOutputAuthority =
  /** The implementation's own auto-covenant pins every proxy data NFT it accesses, and preserves its own. */
  | 'delegate-covenant-scalar'
  /** The same, plus one return-event output funded inside the proxy block. */
  | 'delegate-covenant-scalar-return';

export interface DelegateParticipantClass {
  /** Stable class id. Report this, not "delegate". */
  id: string;
  codeIdentity: DelegateCodeIdentity;
  stateOwner: DelegateStateOwner;
  outputAuthority: DelegateOutputAuthority;
}

/**
 * The admitted classes. A class is listed here only when a BCH-2026 VM case settles it AND separate hostile
 * cases attack its code identity, state owner and output authority.
 */
export const ADMITTED_DELEGATE_PARTICIPANT_CLASSES: readonly DelegateParticipantClass[] = Object.freeze([
  Object.freeze({
    id: 'bytecode-pinned/adjacent-proxy-block/scalar',
    codeIdentity: 'bytecode-pinned',
    stateOwner: 'adjacent-proxy-block',
    outputAuthority: 'delegate-covenant-scalar',
  }),
  Object.freeze({
    id: 'caller-authorized/adjacent-proxy-block/scalar',
    codeIdentity: 'caller-authorized',
    stateOwner: 'adjacent-proxy-block',
    outputAuthority: 'delegate-covenant-scalar',
  }),
]) as readonly DelegateParticipantClass[];

/**
 * Classes that are named and deliberately NOT admitted, with the reason each fails closed. Keeping them named
 * is the point of E3: an unadmitted shape gets its own diagnostic rather than a generic failure.
 */
export const UNADMITTED_DELEGATE_PARTICIPANT_CLASSES: readonly { id: string; reason: string }[] = Object.freeze([
  Object.freeze({
    id: 'caller-chosen',
    reason: 'the proxy takes the implementation address as a parameter with no signature parameter, so any '
      + 'spender selects the code that writes the proxy state',
  }),
  Object.freeze({
    id: 'unpinned-p2pkh',
    reason: 'a P2PKH implementation address emits no co-spend pin at all (SECURITY-AUDIT C1)',
  }),
  Object.freeze({
    id: 'dynamically-resolved-implementation',
    reason: 'the proxy bytecode does not contain the implementation locking bytecode, so code identity is only '
      + 'as strong as whatever resolves it at spend time',
  }),
  Object.freeze({
    id: 'emitting-delegate',
    reason: 'a delegated implementation that emits does not settle; the SDK grafts its event slot inside the '
      + 'proxy block and leaves an unfilled position (board task X12)',
  }),
  Object.freeze({
    id: 'collection-writing-delegate',
    reason: 'a C2 sorted write inside a delegate function has no settling instance on this baseline '
      + '(board task X11)',
  }),
  Object.freeze({
    id: 'multi-edge-proxy',
    reason: 'a proxy function publishing more or fewer than one delegatecall edge is outside every admitted '
      + 'class; occurrence is not bound per edge',
  }),
  Object.freeze({
    id: 'conditional-delegate-edge',
    reason: 'a delegatecall inside a branch is a LIVE state forgery: the proxy skips its own state covenant for '
      + 'the whole function but only forces the delegate co-spend on the taken branch, so an untaken branch '
      + 'leaves the proxy data NFT writable by any spender. NOT DETECTABLE HERE - see UNDETECTED_BY_THIS_GATE',
  }),
  Object.freeze({
    id: 'iterated-delegate-edge',
    reason: 'a delegatecall inside a loop publishes one edge whatever the trip count, so a source that '
      + 'delegates N times produces a covenant satisfied by delegating once. NOT DETECTABLE HERE - see '
      + 'UNDETECTED_BY_THIS_GATE',
  }),
]) as readonly { id: string; reason: string }[];

/**
 * Classes this gate CANNOT refuse, and exactly why.
 *
 * A conditional, an iterated and a singular delegate edge publish BYTE-IDENTICAL artifact metadata today:
 * `lowLevelCalls: [{ callMode: 'delegatecall' }]` and one `lowLevelCall` block slot, with no `externalCalls`
 * entry. Typed interface edges already publish `occurrence`/`maximumOccurrences`; low-level edges do not.
 * Until that additive field exists, refusing these two classes has to happen in the compiler, not here. Naming
 * the blind spot is part of the enumeration: a gate that silently admits a class it cannot see is worse than
 * one that says so.
 */
export const UNDETECTED_BY_THIS_GATE: readonly string[] = Object.freeze([
  'conditional-delegate-edge',
  'iterated-delegate-edge',
]);

/** Stable, exact rejection for a delegate participant outside the admitted classes. */
export class DelegateParticipantClassError extends Error {
  constructor(message: string) {
    super(`layer3/delegate: ${message}`);
    this.name = 'DelegateParticipantClassError';
  }
}

export interface DelegateParticipantInput {
  proxy: {
    artifact: Artifact;
    functionName: string;
    /** The INSTANTIATED redeem script hex, i.e. `Contract.bytecode` - constructor arguments included. */
    bytecode: string;
  };
  implementation: {
    artifact: Artifact;
    functionName: string;
    /** The implementation's real locking bytecode hex. */
    lockingBytecode: string;
  };
}

const findFunction = (artifact: Artifact, name: string): AbiFunction => {
  const entry = artifact.abi.find((candidate) => candidate.name === name);
  if (!entry) throw new DelegateParticipantClassError(`'${artifact.contractName}' publishes no function '${name}'`);
  return entry;
};

const isP2pkh = (lockingBytecode: string): boolean => {
  const bytes = lockingBytecode.toLowerCase();
  return bytes.length === 50 && bytes.startsWith('76a914') && bytes.endsWith('88ac');
};

/** Block-slot kinds an admitted implementation function may publish, mapped to their output authority. */
const ADMITTED_IMPLEMENTATION_SLOTS = new Set(['master', 'dataNft', 'returnEvent']);

/**
 * Classify one proxy/implementation pair, or throw a named diagnostic.
 *
 * Every rejection names the class it refused and why, so an unadmitted shape never surfaces as an internal
 * error. Nothing here proves a covenant property; see the module header.
 */
export function classifyDelegateParticipant(input: DelegateParticipantInput): DelegateParticipantClass {
  const proxyFn = findFunction(input.proxy.artifact, input.proxy.functionName);
  const implFn = findFunction(input.implementation.artifact, input.implementation.functionName);

  // --- the edge itself -------------------------------------------------------------------------------------
  const delegateEdges = (proxyFn.lowLevelCalls ?? []).filter((call) => call.callMode === 'delegatecall');
  if (delegateEdges.length !== 1) {
    throw new DelegateParticipantClassError(
      `class 'multi-edge-proxy' is not admitted: proxy function '${input.proxy.functionName}' publishes `
      + `${delegateEdges.length} delegatecall edge(s); an admitted delegate participant binds exactly one`,
    );
  }
  if (!(implFn.modifiers ?? []).includes('delegate')) {
    throw new DelegateParticipantClassError(
      `implementation function '${input.implementation.functionName}' is not declared 'delegate', so it runs `
      + 'against its own state rather than the proxy\'s',
    );
  }

  // The forwarded-selector pin compares the implementation's leading unlocking push against the proxy's
  // calldata. A single-entry-point implementation has no selector to lead with.
  const implementationEntryPoints = input.implementation.artifact.abi.length;
  if (implementationEntryPoints < 2) {
    throw new DelegateParticipantClassError(
      `implementation '${input.implementation.artifact.contractName}' is not selector-dispatched `
      + `(${implementationEntryPoints} entry point(s)); the proxy's forwarded-selector pin needs at least 2`,
    );
  }

  // --- output authority ------------------------------------------------------------------------------------
  // Checked before code identity: these are properties of the implementation alone, so they diagnose the same
  // way whichever proxy is asking.
  const slotKinds = (implFn.blockLayout?.slots ?? []).map((slot) => slot.kind);
  if (slotKinds.includes('event')) {
    throw new DelegateParticipantClassError(
      'class \'emitting-delegate\' is not admitted: implementation function '
      + `'${input.implementation.functionName}' publishes an event slot, and the emitting delegate class does `
      + 'not settle (board task X12)',
    );
  }
  if (slotKinds.includes('entry')) {
    throw new DelegateParticipantClassError(
      'class \'collection-writing-delegate\' is not admitted: implementation function '
      + `'${input.implementation.functionName}' publishes a collection entry slot, and a C2 sorted write inside `
      + 'a delegate function has no settling instance on this baseline (board task X11)',
    );
  }
  const unsupported = slotKinds.filter((kind) => !ADMITTED_IMPLEMENTATION_SLOTS.has(kind));
  if (unsupported.length > 0) {
    throw new DelegateParticipantClassError(
      `implementation function '${input.implementation.functionName}' publishes unsupported block slot kind(s) `
      + `${[...new Set(unsupported)].join(', ')}; the admitted implementation slots are `
      + `${[...ADMITTED_IMPLEMENTATION_SLOTS].join(', ')}`,
    );
  }
  const outputAuthority: DelegateOutputAuthority = slotKinds.includes('returnEvent')
    ? 'delegate-covenant-scalar-return'
    : 'delegate-covenant-scalar';

  // --- code identity ---------------------------------------------------------------------------------------
  if (isP2pkh(input.implementation.lockingBytecode)) {
    throw new DelegateParticipantClassError(
      "class 'unpinned-p2pkh' is not admitted: the implementation locking bytecode is P2PKH, so the proxy "
      + 'emits no co-spend pin and any spender can rewrite proxy state (SECURITY-AUDIT C1)',
    );
  }

  // NECESSARY, NOT SUFFICIENT. The implementation locking bytecode appearing in the proxy's instantiated
  // bytecode proves the proxy's own p2sh32 commits to those bytes - a source literal or a constructor argument
  // both land there. It does not prove those bytes are what the delegatecall target expression evaluates to;
  // that is the compiler's `OP_UTXOBYTECODE[delegateIndex] == impl` emission, attacked separately on the VM.
  const proxyBytecode = input.proxy.bytecode.toLowerCase();
  const implementationLbc = input.implementation.lockingBytecode.toLowerCase();
  const pinnedInProxyBytecode = proxyBytecode.includes(implementationLbc);
  const addressParameters = proxyFn.inputs.filter((parameter) => parameter.type === 'address');
  // A `sig` parameter is NECESSARY for the caller-authorized class, not sufficient: the artifact cannot show
  // that the signature check dominates the delegatecall. That remains the compiler's `checkSig` emission.
  const hasSignatureParameter = proxyFn.inputs.some((parameter) => parameter.type === 'sig');

  let codeIdentity: DelegateCodeIdentity;
  if (pinnedInProxyBytecode) {
    codeIdentity = 'bytecode-pinned';
  } else if (addressParameters.length > 0 && hasSignatureParameter) {
    codeIdentity = 'caller-authorized';
  } else if (addressParameters.length > 0) {
    throw new DelegateParticipantClassError(
      `class 'caller-chosen' is not admitted: proxy function '${input.proxy.functionName}' takes the `
      + 'implementation address as a parameter with no signature parameter, so any spender selects the code '
      + 'that writes the proxy state',
    );
  } else {
    throw new DelegateParticipantClassError(
      "class 'dynamically-resolved-implementation' is not admitted: proxy function "
      + `'${input.proxy.functionName}' neither commits the implementation locking bytecode in its own bytecode `
      + 'nor names it as an authorized parameter, so code identity is only as strong as whatever resolves it '
      + 'at spend time',
    );
  }

  // --- state owner -----------------------------------------------------------------------------------------
  const stateOwner: DelegateStateOwner = input.implementation.artifact.brandedLibrary === true
    ? 'brand-pinned'
    : 'adjacent-proxy-block';

  const id = `${codeIdentity}/${stateOwner}/${
    outputAuthority === 'delegate-covenant-scalar-return' ? 'scalar-return' : 'scalar'}`;
  const admitted = ADMITTED_DELEGATE_PARTICIPANT_CLASSES.find((candidate) => candidate.id === id);
  if (!admitted) {
    throw new DelegateParticipantClassError(
      `class '${id}' is not admitted: it is a real combination of code identity, state owner and output `
      + 'authority, but no BCH-2026 case settles it yet. Admitted classes: '
      + `${ADMITTED_DELEGATE_PARTICIPANT_CLASSES.map((candidate) => candidate.id).join(', ')}`,
    );
  }
  return admitted;
}

/** Throwing form, for callers that only want the gate. */
export function assertAdmittedDelegateClass(input: DelegateParticipantInput): DelegateParticipantClass {
  return classifyDelegateParticipant(input);
}
