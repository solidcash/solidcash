/**
 * phase-boundary extract: StateEffectEvidence / StateEffectReading (X176 writesState reading model).
 * (phase-boundary extract from StatefulContract.ts).
 */

export type StateEffectEvidence =
  /** A collection entry is written, deleted or upserted, straight-line or as a fixed sorted batch. */
  | 'entry-write'
  /** A collection is written by a runtime loop, or by a sorted insert loop. */
  | 'entry-loop-write'
  /** A chunk-backed dynamic-storage variable is rewritten. */
  | 'dynamic-write'
  /** A lifecycle modifier that rewrites or retires the covenant: upgrade, selfdestruct, delegate, unsafe. */
  | 'lifecycle-modifier'
  /** `split(n)` / `merge(n)`: the master set changes, the state variables do not. */
  | 'split-merge'
  /** An event NFT is minted. Output shape, not a state variable. */
  | 'emit'
  /** Native value is moved. Balance, not a state variable. */
  | 'transfer'
  /** A token container is read or written. */
  | 'token-container'
  /** A child contract is deployed. The CHILD gets state; this handler's own variables need not move. */
  | 'deploy'
  /** ANOTHER contract's handler is co-spent. The callee's state may change; this handler's need not. */
  | 'external-call'
  /** A delegate-library call, or a low-level call/staticcall/delegatecall. */
  | 'delegate-or-low-level';

/**
 * X176. What `writesState` actually answers about one ABI entry.
 *
 * `writesState` IS READ BY COMPOSERS AS "THIS HANDLER MUTATES STATE" AND IT DOES NOT MEAN THAT. The compiler
 * computes it conservatively: `false` only when the body has NO stateful statement and the function has no
 * external call, child deploy, library delegate, dynamic write, low-level call, split/merge or covenant-bypass
 * modifier. Anything else is `true`, so `true` means "not provably read-only", which in SDK terms is "needs the
 * state machinery" - and that is a strictly weaker claim than "changes a state variable".
 *
 * MEASURED, not argued. `Foo.callBar` publishes `writesState: true` and its whole body is `bar.log();` - one
 * external call and not one assignment. `Attack.attack` is the same shape. So of the seven handlers the L2-F2
 * partition counts as explicit writers, at least two write nothing at all, and the four that publish the flag
 * ABSENT and are conservatively counted as writers are handlers of contracts with `dataNftCount === 0`, which
 * have no state variable for any handler to change.
 *
 * ONE READING IS SOUND IN ONE DIRECTION ONLY, and this type keeps that visible:
 *   `writesState === false`  the compiler PROVED read-only. Sound to act on - it is what the derivation skip
 *                            in `_prepareCall` acts on, and misclassification there fails closed anyway.
 *   `writesState === true`   NOT a proof of mutation. Read `evidence`.
 *   absent                   unknown or stateless. Never a proof of either.
 */
export interface StateEffectReading {
  /** The field verbatim, including the absent case. */
  published: boolean | undefined;
  /** The only sound reading of the flag: everything but an explicit `false` needs the machinery. */
  needsStateMachinery: boolean;
  /** True only for an explicit `false` - the compiler's own proof that output state == input state. */
  provablyReadOnly: boolean;
  /** Published evidence that this handler changes its OWN persisted state. */
  ownStateEvidence: StateEffectEvidence[];
  /** Published evidence of an effect that is NOT a change to this handler's own state variables. */
  otherEffectEvidence: StateEffectEvidence[];
  /**
   * The flag is set and the ABI itemizes NOTHING. A plain `this.x = y` lands here: the ABI publishes no
   * "assigns a state variable" field, so this is as close as an artifact gets to naming one - and it is
   * indistinguishable from a bus-mode journal reservation, which is why it is reported rather than concluded.
   */
  unattributed: boolean;
  /**
   * The contract has NO data NFT, so it has no persisted state variable and no handler of it can change one.
   * Structural and decisive where it applies; requires the artifact, so it is false when only the ABI entry is
   * supplied. This is what settles the four absent-flag handlers.
   */
  contractHasNoState: boolean;
}

/** Evidence classes that are changes to the handler's OWN persisted state. */
export const OWN_STATE_EVIDENCE: readonly StateEffectEvidence[] = [
  'entry-write', 'entry-loop-write', 'dynamic-write', 'lifecycle-modifier',
];

/** Function modifiers the compiler treats as covenant-rewriting. Mirrors `STATE_WRITING_MODIFIERS`. */
export const LIFECYCLE_MODIFIERS = ['upgrade', 'selfdestruct', 'delegate', 'unsafe'];
