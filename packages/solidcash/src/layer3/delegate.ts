import type { Artifact, AbiFunction, ReadValueProvenance } from '@solidcash/utils';
import {
  describeProvenance, isAddressCommittedProvenance, lowLevelCallTargetProvenance, signatureGuardKeyProvenance,
} from '@solidcash/utils';

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
 *
 * ADMISSION READS SEMANTICS, NOT PUBLISHED TYPES (X43). Two shapes escaped the round-13 revision of this module
 * (review A13, `test/e2e/ReviewA13DelegateE3.test.ts`), both settling a foreign implementation rewriting proxy
 * state on the VM: a proxy pinning one implementation in its constructor while delegatecalling a caller-supplied
 * `address`, and a proxy whose `checkSig` runs against a caller-supplied `pubkey`. Round 14 closed both by
 * refusing those PARAMETER TYPES, and both reopened immediately - route the same caller value through a `bytes`
 * parameter and cast it, and no `address` or `pubkey` parameter is published at all. A type could never have
 * answered the question, and refusing `bytes` is not available: every admitted class carries a `bytes` calldata
 * parameter.
 *
 * X37 publishes the answer instead. `lowLevelCalls[].target` says where the delegatecall target came from and
 * `signatureGuard.key` says where the checked key came from, both with casts stripped and alias bindings
 * followed - so `address t = address(target)` over a `bytes` parameter resolves to `parameter`, not to
 * `computed`. This gate reads those two fields:
 *
 *  - `bytecode-pinned` requires the target to be `constructorArg` or `literal`, i.e. committed into the proxy's
 *    own p2sh32, AND the implementation locking bytecode to appear in the proxy bytecode. Provenance says the
 *    target is FIXED; containment says WHICH script it is fixed to. Neither alone is the class.
 *  - `caller-authorized` requires the target to be `parameter`, a `sig` parameter to exist, AND the
 *    signature-guard key to be one the proxy commits (`constructorArg`, `literal` or `stateVar`).
 *
 * Every other target - `stateVar`, `computed`, and the `unknown` that an artifact publishing no `target` reads
 * back as - is refused by name.
 *
 * READING AN ABSENT FIELD, which is the X37 compatibility contract as this consumer honours it. Both fields are
 * additive and optional, so a consumer must do three things and this module does all three:
 *
 *  1. Never touch `call.target` or `fn.signatureGuard` directly. Go through `lowLevelCallTargetProvenance` and
 *     `signatureGuardKeyProvenance`, which spell the missing case `unknown` - a kind the compiler never emits -
 *     so "the artifact said nothing" can never be written the same way as one of its five answers.
 *  2. Decide admission on an explicit ALLOW-LIST of kinds (`isAddressCommittedProvenance` for the target,
 *     COMMITTED_KEY_PROVENANCE_KINDS for the key). `unknown`, and any kind a later compiler adds, then falls
 *     closed instead of being admitted by omission.
 *  3. State the consequence rather than hide it: an artifact compiled before X37 carries no `target` on its
 *     delegatecall row and is refused here as `unpublished-target-provenance`. Recompiling the proxy is the
 *     fix. There is no reading of an absent field that admits anything.
 *
 * WHAT `signatureGuard` DOES NOT SAY. It describes the KEY's provenance, not the whole authority story.
 * P2PKH-shaped authority - `require(hash160(pk) == this.pkh); require(checkSig(s, pk));` - publishes
 * `{parameter, pk}`, because what makes it authority is a separate require this field does not describe. The
 * compiler credits exactly that idiom (round-15 SEC-17, `hasAuthorizingSignatureGuard`). This gate deliberately
 * does NOT, because the fact it would need - that an unconditional top-level require commits that parameter -
 * is published in no artifact field, and reconstructing it from types (a `bytes20` constructor argument next to
 * a `pubkey` parameter) is the exact reasoning X43 removed. The shape is therefore refused as `self-authorized`
 * and named as the false-negative class `hash160-committed-key`. Closing it needs one additive artifact field,
 * not a cleverer reading of the fields that exist.
 */

/** How the proxy decides which script may write its state. */
export type DelegateCodeIdentity =
  /**
   * The delegatecall target resolves to a source literal or a constructor argument, so the proxy's own p2sh32
   * commits to it and no caller value can be the target, AND the implementation locking bytecode is in that
   * bytecode, so the commitment names THIS implementation.
   */
  | 'bytecode-pinned'
  /**
   * The target resolves to a function parameter, the proxy function also takes a signature, and the key that
   * signature is checked against is one the PROXY commits to (a constructor argument, a compile-time literal or
   * a state variable) rather than one the caller hands in - so an authorized signer, not any signer, selects
   * the implementation.
   */
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
    reason: 'the delegatecall target resolves to a caller-supplied parameter and the proxy function takes no '
      + 'signature parameter, so any spender selects the code that writes the proxy state',
  }),
  Object.freeze({
    id: 'pinned-but-caller-selected',
    reason: 'the proxy bytecode DOES contain the implementation locking bytecode, and the delegatecall target '
      + 'still resolves to a caller-supplied parameter. Containment proves only that the p2sh32 commits to '
      + 'those bytes somewhere, not that they are what the call reaches. A proxy that pins one implementation '
      + 'in its constructor and delegatecalls a parameter is `caller-chosen` wearing a pin',
  }),
  Object.freeze({
    id: 'self-authorized',
    reason: 'the delegatecall target resolves to a caller-supplied parameter, and the key the function\'s '
      + 'signature is checked against is not one the proxy commits to - it is a parameter the caller also '
      + 'supplies, an expression the compiler could not resolve, or absent entirely. A caller who picks both '
      + 'the key and the target authorizes nobody',
  }),
  Object.freeze({
    id: 'unpinned-p2pkh',
    reason: 'a P2PKH implementation address emits no co-spend pin at all (SECURITY-AUDIT C1)',
  }),
  Object.freeze({
    id: 'dynamically-resolved-implementation',
    reason: 'the delegatecall target is resolved at spend time rather than committed for the proxy address: '
      + 'either it reads a state variable, whose authority is only whatever wrote it, or it is committed to '
      + 'bytes that are not this implementation\'s locking bytecode',
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
  Object.freeze({
    id: 'computed-delegate-target',
    reason: 'the published target provenance is `computed`: a ternary, an array element, a slice, a '
      + 'concatenation, a struct field, a tuple-destructured local, `tx.origin`/`msg.sender`, or an alias cycle '
      + 'the compiler refused to pick an arm of. The compiler could not say where the target came from, and '
      + '"could not say" is never evidence that a spender cannot choose it',
  }),
  Object.freeze({
    id: 'unpublished-target-provenance',
    reason: 'the proxy artifact publishes no `target` on its delegatecall row, which identifies an artifact '
      + 'compiled before X37 added the field - every compiler that knows how to answer writes the row, '
      + '`computed` included. An absent field is the weakest fact, never "unconstrained": recompile the proxy '
      + 'with a compiler that publishes `lowLevelCalls[].target`',
  }),
  Object.freeze({
    id: 'hash160-committed-key',
    reason: 'a FALSE NEGATIVE this gate accepts rather than guess around. `require(hash160(pk) == <committed>); '
      + 'require(checkSig(s, pk));` is honest P2PKH-shaped authority, but `signatureGuard` publishes the KEY\'s '
      + 'provenance only - `{parameter, pk}` - so the commitment that turns it into authority is invisible '
      + 'here. The compiler credits the idiom (SEC-17); this gate refuses it as `self-authorized` until an '
      + 'artifact field publishes the commitment',
  }),
]) as readonly { id: string; reason: string }[];

/**
 * Classes this gate CANNOT refuse, and exactly why.
 *
 * A conditional, an iterated and a singular delegate edge publish BYTE-IDENTICAL artifact metadata today:
 * `lowLevelCalls: [{ callMode: 'delegatecall' }]` and one `lowLevelCall` block slot, with no `externalCalls`
 * entry. Typed interface edges already publish `occurrence`/`maximumOccurrences`; low-level edges do not.
 * Until that additive field exists, refusing these two classes has to happen in the compiler, not here.
 *
 * X43 REMOVED TWO ENTRIES from this list. `bytes-typed-delegate-target` (`address t = address(target);
 * t.delegatecall(input);`) and `bytes-typed-key-material` (`checkSig(s, pubkey(k))`) were the residual of the
 * round-14 fixes, which keyed off parameter TYPES because a type was the only thing published metadata then
 * offered. X37 publishes where the target and the checked key resolve to, both routes resolve to `parameter`,
 * and this gate now refuses both. They are asserted refused in `Layer3DelegateClassesE3.test.ts` rather than
 * silently dropped from the list.
 *
 * Naming the blind spot is part of the enumeration: a gate that silently admits a class it cannot see is worse
 * than one that says so. These two are named because they are known, not because they are harmless.
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
 * Signature-guard key provenances the PROXY commits to, as an ALLOW-LIST - so `computed`, `parameter`, and the
 * `unknown` an artifact publishing no guard reads back as all fall closed, and so does any kind a later
 * compiler adds.
 *
 * `stateVar` is on this list while `isAddressCommittedProvenance` refuses it, and the difference is deliberate.
 * A `pubkey` state variable lives in the proxy's own data NFT and changes only through the proxy's own
 * authorized writes, which is what "the proxy commits this key" means (round-14's `PROXY_STATE_KEY_AUTHORIZED`,
 * settled). A delegatecall TARGET read from state is a different question - an upgrade pointer whose authority
 * is whatever wrote it, with no settling case here - and is refused below.
 */
const COMMITTED_KEY_PROVENANCE_KINDS: ReadonlySet<string> = new Set(['constructorArg', 'literal', 'stateVar']);

const isCommittedKeyProvenance = (provenance: ReadValueProvenance): boolean =>
  COMMITTED_KEY_PROVENANCE_KINDS.has(provenance.kind);

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

  // NECESSARY, NOT SUFFICIENT, AND NO LONGER LOAD-BEARING ALONE. The implementation locking bytecode appearing
  // in the proxy's instantiated bytecode proves the proxy's own p2sh32 commits to those bytes - a source
  // literal or a constructor argument both land there. It does not prove those bytes are what the delegatecall
  // target expression evaluates to; the published target provenance answers that, and `bytecode-pinned` is the
  // conjunction of the two. The covenant-level pin remains the compiler's `OP_UTXOBYTECODE[delegateIndex] ==
  // impl` emission, attacked separately on the VM.
  const proxyBytecode = input.proxy.bytecode.toLowerCase();
  const implementationLbc = input.implementation.lockingBytecode.toLowerCase();
  const pinnedInProxyBytecode = proxyBytecode.includes(implementationLbc);

  // X43. WHERE the target and the checked key came from, read through the `unknown`-spelling readers so an
  // artifact that predates the fields cannot be confused with one that answered.
  const targetProvenance = lowLevelCallTargetProvenance(delegateEdges[0]);
  const guardKey = signatureGuardKeyProvenance(proxyFn);
  // A `sig` parameter stays REQUIRED for caller-authorized, on top of the committed key. It is not redundant
  // with the key: `signatureGuard` covers `checkDataSig` too, and no BCH-2026 case settles a
  // checkDataSig-authorized proxy - an admitted class without a settling case is exactly what this module
  // refuses to have. It is still not sufficient either: the artifact cannot show that the signature check
  // dominates the delegatecall, which remains the compiler's `checkSig` emission.
  const hasSignatureParameter = proxyFn.inputs.some((parameter) => parameter.type === 'sig');

  let codeIdentity: DelegateCodeIdentity;
  if (isAddressCommittedProvenance(targetProvenance)) {
    // `constructorArg` or `literal`: fixed for this proxy address, so no caller value can be the target. Which
    // script it is fixed TO is a separate question, and containment is what answers it.
    if (!pinnedInProxyBytecode) {
      throw new DelegateParticipantClassError(
        "class 'dynamically-resolved-implementation' is not admitted: proxy function "
        + `'${input.proxy.functionName}' delegatecalls ${describeProvenance(targetProvenance)}, which the proxy `
        + 'address does commit - but the implementation locking bytecode does not appear in the proxy '
        + 'bytecode, so what it commits to is some script other than '
        + `'${input.implementation.artifact.contractName}'`,
      );
    }
    codeIdentity = 'bytecode-pinned';
  } else if (targetProvenance.kind === 'parameter') {
    // The caller picks the target, so the only thing that can make this a class is authority over who calls.
    if (!hasSignatureParameter) {
      throw new DelegateParticipantClassError(pinnedInProxyBytecode
        ? `class 'pinned-but-caller-selected' is not admitted: proxy function '${input.proxy.functionName}' `
          + `delegatecalls ${describeProvenance(targetProvenance)} and takes no signature parameter. Its `
          + 'bytecode does contain the implementation locking bytecode, so the p2sh32 commits to those bytes '
          + 'somewhere - but they are not what the call reaches, and any spender may pass a different address '
          + 'and select the code that writes the proxy state'
        : `class 'caller-chosen' is not admitted: proxy function '${input.proxy.functionName}' delegatecalls `
          + `${describeProvenance(targetProvenance)} and takes no signature parameter, so any spender selects `
          + 'the code that writes the proxy state');
    }
    if (!isCommittedKeyProvenance(guardKey)) {
      throw new DelegateParticipantClassError(
        `class 'self-authorized' is not admitted: proxy function '${input.proxy.functionName}' delegatecalls `
        + `${describeProvenance(targetProvenance)}, and the signature it takes is checked against `
        + `${describeProvenance(guardKey)} rather than a key the proxy commits to. A caller who picks both the `
        + 'key and the target authorizes nobody. Check the signature against a constructor argument, a '
        + 'compile-time literal or a state variable. If the key IS pinned by an unconditional '
        + '`require(hash160(key) == <committed>)`, this is the named false-negative class '
        + "'hash160-committed-key': no artifact field publishes that commitment, so this gate cannot read it",
      );
    }
    codeIdentity = 'caller-authorized';
  } else if (targetProvenance.kind === 'stateVar') {
    throw new DelegateParticipantClassError(
      "class 'dynamically-resolved-implementation' is not admitted: proxy function "
      + `'${input.proxy.functionName}' delegatecalls ${describeProvenance(targetProvenance)}, so code identity `
      + 'is only as strong as whatever authorized the write that put the value there - a question no published '
      + 'field answers, and one no BCH-2026 case here settles',
    );
  } else if (targetProvenance.kind === 'unknown') {
    throw new DelegateParticipantClassError(
      "class 'unpublished-target-provenance' is not admitted: the artifact for proxy "
      + `'${input.proxy.artifact.contractName}' publishes no target provenance on the delegatecall edge of `
      + `'${input.proxy.functionName}'. Every compiler that knows how to answer writes that row, 'computed' `
      + 'included, so an absent one identifies an artifact compiled before the field existed. An absent field '
      + 'is not a claim that the target is fixed; recompile the proxy',
    );
  } else {
    // `computed`, and any kind a later compiler adds: an allow-list, so a new kind falls closed here.
    throw new DelegateParticipantClassError(
      "class 'computed-delegate-target' is not admitted: proxy function "
      + `'${input.proxy.functionName}' delegatecalls ${describeProvenance(targetProvenance)} `
      + `(provenance '${targetProvenance.kind}') - a ternary, an array element, a slice, a concatenation, a `
      + 'struct field, a tuple-destructured local, `tx.origin`/`msg.sender`, or an alias cycle. The compiler '
      + 'could not say where the target came from, and "could not say" is never evidence that a spender cannot '
      + 'choose it',
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
