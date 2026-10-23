/**
 * Assembling a composition into transaction inputs.
 *
 * The plan supplies identities — which master entered which, which master a call targets, which contract a validator
 * covers — and this module turns them into the absolute input indices the wire format carries. Doing that in one
 * place from one layout is the point: a reference resolved twice, once by a caller and once by a verifier, is how the
 * two come to disagree, and the plan's own history is full of coordinate defects.
 *
 * A reference that cannot be resolved is refused rather than defaulted. An unresolved reference would produce a
 * composition whose parts describe different transactions.
 */

import {
  INDEX_NONE,
  FramedEncodingError,
  SELECTOR_LENGTH,
  VALIDATOR_PIN_PUSH_LENGTH,
  argsHash,
  bytesEqual,
  encodeArgumentList,
  encodeMinimalDataPush,
  mintedRef,
  type FrameKindValue,
  type MintedMaster,
  type MintedTranscript,
  type RecordEntry,
  type Transcript,
  type WitnessBlock,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { assertValidatorCoverage, type EntryFacts } from './need-test.js';
import {
  allocateOutputRegions,
  facetId,
  layoutTransaction,
  type ContractBlock,
  type OutputRegions,
  type TransactionLayout,
} from './layout.js';
import { assertOutputOccupancy } from './settlement.js';
import {
  assembleMasterWitness,
  assembleMintedMasterBlock,
  assembleValidatorWitness,
  type FrameWitness,
} from './witness.js';

/** A call one master makes, named by the identity of the master it reaches. */
export interface PlannedCall {
  readonly kind: FrameKindValue;
  /** Identity of the callee master. */
  readonly callee: string;
  /** The address the call targets. */
  readonly target: Uint8Array;
  readonly value: bigint;
  /**
   * The callee's call data, as pushes in the order its unlocking bytecode carries them: the selector first, then
   * the argument pushes with the first parameter's last. `encodeCallDataArguments` builds these from values named
   * in parameter order.
   */
  readonly argumentPushes: readonly Uint8Array[];
  readonly result: Uint8Array;
}

/** One master's execution, as the plan intends it. */
export interface PlannedMaster {
  /** The master's identity within its contract's pool. */
  readonly master: string;
  readonly contract: string;
  /** The facts the validator need test reads. */
  readonly facts: EntryFacts;
  /** The frame the master runs in. */
  readonly frame: FrameWitness;
  /** Identity of the input that entered this execution: a master, or the user's signed input. */
  readonly enteredBy: string;
  /** Identity of the root user's input, which is the origin of everything below it. */
  readonly origin: string;
  readonly calls: readonly PlannedCall[];
  readonly retval: Uint8Array;
  readonly segments: readonly (readonly RecordEntry[])[];
  readonly events: readonly number[];
  readonly sends: readonly number[];
  readonly argumentPushes: readonly Uint8Array[];
  /** The master's redeem script: the category pin followed by the contract code. */
  readonly redeemScript: Uint8Array;
  /** The long mapping values the body reads, by value-witness slot. */
  readonly values?: readonly Uint8Array[];
  /** True when the program dispatches over several entries, so a user's call data selects one. */
  readonly dispatches?: boolean;
}

/** An input that is not a master: the users that entered the composition. */
export interface PlannedUserInput {
  readonly id: string;
  readonly index: number;
}

/** One contract the composition settles, named by the identities of its state inputs. */
export interface PlannedSettlement {
  readonly category: Uint8Array;
  readonly stateInputs: readonly string[];
  /**
   * The output indices of the records this settlement creates.
   *
   * A created record has no input to name, so it is named by the trailing output the plan places it at. The
   * assembly holds the indices, not identities: a created record is not a participant, and the plan states its
   * index where it states the trailing output.
   */
  readonly createdOutputs?: readonly number[];
}

/**
 * One master the transaction mints rather than spends: a genesis root frame whose witness block the validator's
 * transcript carries inline (v0x03). It has no input, so it is never a run of its own; its caller and origin are
 * `INDEX_NONE`, and its callees name it by `mintedRef(output)`.
 */
export interface PlannedMintedMaster {
  /** The master's identity within its contract's pool. */
  readonly master: string;
  readonly contract: string;
  /** The frame the master runs in: a ROOT frame with an empty sender and no value. */
  readonly frame: FrameWitness;
  readonly calls: readonly PlannedCall[];
  readonly retval: Uint8Array;
  readonly segments: readonly (readonly RecordEntry[])[];
  readonly events: readonly number[];
  readonly sends: readonly number[];
}

/** One validator the composition spends: the contracts it covers, what it settles, and its program. */
export interface PlannedValidator {
  /** The identity the hosting block names and the layout places. */
  readonly id: string;
  /**
   * The contracts whose masters point at this validator, beyond the one whose block hosts it.
   *
   * Coverage is wider than settlement: a contract that a validator covers without settling keeps its own single
   * master's settlement while still having every edge into it bound, so this is stated rather than derived from the
   * contracts the validator settles.
   */
  readonly covers: readonly string[];
  /** The validator's redeem script: the category pin followed by the validator program. */
  readonly redeemScript: Uint8Array;
  /**
   * The codes the validator's program binds as facets, one per input at `head + k`.
   *
   * Facet `k` is locked by `P2SH32(facets[k - 1])` and carries only its own code, so its input reads the transcript
   * from the head. Empty — the default — is a validator that runs in one input.
   */
  readonly facets?: readonly Uint8Array[];
  /** The contracts the validator settles, with the state inputs each spends. */
  readonly settles: readonly PlannedSettlement[];
}

/**
 * A composition's validators: one named directly, or one per independent group.
 *
 * A single-validator composition names it directly and behaves exactly as one that names a one-element list.
 */
export type PlannedValidators = PlannedValidator | PlannedValidator[];

/** The whole plan. Every reference is an identity, and every coordinate comes from the layout. */
export interface CompositionPlan {
  readonly blocks: readonly ContractBlock[];
  /** The inputs placed ahead of every block, each recreated at its own index (`layoutTransaction`). */
  readonly leading?: readonly string[];
  readonly userInputs: readonly PlannedUserInput[];
  readonly masters: readonly PlannedMaster[];
  /** The masters the transaction mints, whose blocks ride in the validator transcript (v0x03). */
  readonly mintedMasters?: readonly PlannedMintedMaster[];
  /** The length of each token run the trailing region leads with (`TrailingOutputCounts.tokenRuns`). */
  readonly tokenRuns?: readonly number[];
  /**
   * The composition's validators. A composition of one group names its validator directly; a composition of
   * independent groups names one per group, each hosted by the block that names it.
   */
  readonly validator?: PlannedValidators;
}

/** The plan's validators, whether it named a single one or several. */
export function declaredValidators(plan: { readonly validator?: PlannedValidators }): readonly PlannedValidator[] {
  const declared = plan.validator;
  if (declared === undefined) return [];
  return Array.isArray(declared) ? declared : [declared];
}

/**
 * The shipped validator program and the facets it binds, built once.
 *
 * A plan states its validator by its redeem script, so recognising the shipped program is what lets the facets it
 * binds be composed without every plan restating them.
 */
const SHIPPED_VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const SHIPPED_VALIDATOR_FACETS = framedValidator.buildValidatorFacets();

/**
 * The facets a validator's plan composes.
 *
 * A plan that states the codes composes those. A plan that states none and carries the shipped validator program
 * composes the facets that program binds: the head carries each facet's lock as a constant, so a composition that
 * left one out is one the head refuses, and every plan of the shipped program would have to state the same codes.
 * A plan that composes a program of its own states its facets, because the composer knows only this one's.
 */
export function validatorFacetsOf(validator: PlannedValidator): readonly Uint8Array[] {
  if (validator.facets !== undefined) return validator.facets;
  const program = validator.redeemScript.slice(VALIDATOR_PIN_PUSH_LENGTH);
  return bytesEqual(program, SHIPPED_VALIDATOR_PROGRAM) ? SHIPPED_VALIDATOR_FACETS : [];
}

/** How a plan's validators bind to the contracts their masters run on. */
export interface ValidatorBinding {
  /** Every validator the plan names. */
  readonly validators: readonly PlannedValidator[];
  /** The validators a block hosts, in block order. */
  readonly hosted: readonly PlannedValidator[];
  /** The validator that covers each contract, by contract name. */
  readonly byContract: ReadonlyMap<string, PlannedValidator>;
}

/**
 * Binds each contract to the validator that covers it.
 *
 * A validator covers the contract whose block hosts it and every contract its `covers` lists. A contract is bound
 * to exactly one validator, because a master carries one validator reference; a second claim is refused rather than
 * resolved.
 */
export function bindContractValidators(plan: {
  readonly blocks: readonly ContractBlock[];
  readonly validator?: PlannedValidators;
}): ValidatorBinding {
  const validators = declaredValidators(plan);
  // A plan that names no validator is one whose blocks carry no coverage to bind, even if a block still names one.
  if (validators.length === 0) return { validators, hosted: [], byContract: new Map() };
  const byId = new Map(validators.map((validator) => [validator.id, validator]));
  const hosted: PlannedValidator[] = [];
  const byContract = new Map<string, PlannedValidator>();
  for (const block of plan.blocks) {
    if (block.validator === undefined) continue;
    const validator = byId.get(block.validator.id);
    if (validator === undefined) {
      throw new FramedEncodingError(
        `the block for "${block.contract}" hosts validator "${block.validator.id}", which the plan does not name`,
      );
    }
    if (!hosted.includes(validator)) hosted.push(validator);
    for (const covered of [block.contract, ...validator.covers]) {
      if (byContract.has(covered)) {
        throw new FramedEncodingError(`"${covered}" is covered by more than one validator`);
      }
      byContract.set(covered, validator);
    }
  }
  return { validators, hosted, byContract };
}

/** One assembled input. */
export interface AssembledInput {
  readonly id: string;
  readonly index: number;
  readonly unlockingBytecode: Uint8Array;
}

/** A call after its coordinates were resolved, for diagnostics and for a caller that has to sign. */
export interface ResolvedCall {
  readonly from: string;
  readonly callee: string;
  readonly calleeRef: number;
  readonly argsHash: Uint8Array;
}

/** One validator's transcript, as the assembly built it from the plan. */
export interface ValidatorTranscript {
  /** The validator identity the transcript belongs to. */
  readonly validator: string;
  readonly transcript: Transcript | MintedTranscript;
}

/** The assembled composition. */
export interface CompositionAssembly {
  readonly layout: TransactionLayout;
  readonly inputs: readonly AssembledInput[];
  /** Where the trailing outputs are: one per event, one per send, one per created record, then change. */
  readonly outputs: OutputRegions;
  readonly calls: readonly ResolvedCall[];
  /** One transcript per validator the plan spends, in block order; empty when the composition has none. */
  readonly transcripts: readonly ValidatorTranscript[];
}

/** The outputs a plan creates records at, in first-appearance order, for the spent and the minted masters. */
function createdRecordOutputs(
  masters: readonly PlannedMaster[], mintedMasters: readonly PlannedMintedMaster[] = [],
): readonly number[] {
  const created: number[] = [];
  for (const master of [...masters, ...mintedMasters]) {
    for (const segment of master.segments) {
      for (const entry of segment) {
        if (entry.in !== INDEX_NONE) continue;
        if (!created.includes(entry.out)) created.push(entry.out);
      }
    }
  }
  return created;
}

/** True when two index lists are the same numbers in the same order. */
function sameIndices(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * True when two index lists hold the same numbers, once each, in any order.
 *
 * A region whose entries are independent of one another is a set, not a sequence: nothing reads the position of a
 * created record in the list, only the pair of the record and the output it lands at, so a plan that names the
 * outputs the region allocated in another order still declares every landing correctly.
 */
function sameIndexSet(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length || new Set(left).size !== left.length) return false;
  const held = new Set(right);
  return left.every((value) => held.has(value));
}

/**
 * Allocates the trailing outputs and requires the plan's declared indices to be the ones allocated.
 *
 * The plan names where its events, sends and created records sit; the assembly is the authority on where they
 * actually sit. Comparing the two is what keeps a caller from being its own source of coordinates, which is the
 * class of defect this module exists to remove.
 */
function resolveOutputRegions(
  plan: CompositionPlan,
  layout: TransactionLayout,
): OutputRegions {
  const declaredEvents = plan.masters.flatMap((master) => master.events);
  const declaredSends = plan.masters.flatMap((master) => master.sends);
  // A record created at a leading input's own index is that input's output, not one of the trailing region.
  const leading = new Set(layout.participants.filter((placed) => placed.kind === 'leading').map((placed) => placed.index));
  const created = createdRecordOutputs(plan.masters, plan.mintedMasters ?? []).filter((index) => !leading.has(index));

  const regions = allocateOutputRegions(layout, {
    ...(plan.mintedMasters?.length === undefined || plan.mintedMasters.length === 0
      ? {}
      : { mintedMasters: plan.mintedMasters.length }),
    ...(plan.tokenRuns === undefined ? {} : { tokenRuns: plan.tokenRuns }),
    events: declaredEvents.length,
    sends: declaredSends.length,
    sendRuns: plan.masters.map((master) => master.sends.length).filter((run) => run > 0),
    created: created.length,
  });
  if (!sameIndices(declaredEvents, regions.eventIndices)) {
    throw new FramedEncodingError(
      `the plan lists events at [${declaredEvents.join(', ')}], and the trailing region puts them at `
      + `[${regions.eventIndices.join(', ')}]`,
    );
  }
  if (!sameIndices(declaredSends, regions.sendIndices)) {
    throw new FramedEncodingError(
      `the plan lists sends at [${declaredSends.join(', ')}], and the trailing region puts them at `
      + `[${regions.sendIndices.join(', ')}]`,
    );
  }
  // The created region is a set: a record's landing is the pair of the record and its output, and no consumer reads
  // the list's order, so the plan may name the allocated outputs in the order its own walk reaches them.
  if (!sameIndexSet(created, regions.createdIndices)) {
    throw new FramedEncodingError(
      `the plan creates records at [${created.join(', ')}], and the trailing region puts them at `
      + `[${regions.createdIndices.join(', ')}]`,
    );
  }
  // Every participant recreates at its own index, so nothing else may sit there.
  assertOutputOccupancy({
    records: layout.participants.map((participant) => participant.index),
    events: declaredEvents,
    sends: declaredSends,
  });
  return regions;
}

/** A settlement's created outputs, requiring each to be one the plan's trailing region creates. */
function requireCreatedOutputs(settled: PlannedSettlement, outputs: OutputRegions): readonly number[] {
  const declared = settled.createdOutputs ?? [];
  const created = new Set(outputs.createdIndices);
  for (const index of declared) {
    if (!created.has(index)) {
      throw new FramedEncodingError(
        `a settlement lists created output ${index}, which the plan's trailing region does not create`,
      );
    }
  }
  return [...declared];
}

/** The plan reference for a frame that has no origin: a minted genesis root and every frame it enters. */
export const INDEX_NONE_REFERENCE = '\u0000index-none';

/** Raised when a plan names an identity that has no place in the layout. */
export class UnresolvedReferenceError extends Error {
  constructor(reference: string, what: string) {
    super(`${what} "${reference}" has no place in this composition`);
    this.name = 'UnresolvedReferenceError';
  }
}

/**
 * Requires every callee to carry exactly the call data its caller committed to.
 *
 * A call's arguments live in the callee's unlocking bytecode, above its witness block, and the caller commits to
 * their hash in its own block. So the callee's call data is not the callee's to choose: it is what its caller
 * recorded, and the two have to agree or the hash the caller's master checks on chain will not match.
 *
 * A callee is one input with one call data, so two callers that pass different arguments cannot both be right. A
 * master nobody calls was entered by a user, and a user's entry carries no call data at all.
 */
function assertCallDataAgrees(plan: CompositionPlan): void {
  const recorded = new Map<string, readonly Uint8Array[]>();
  for (const master of [...plan.masters, ...(plan.mintedMasters ?? [])]) {
    for (const call of master.calls) {
      if (call.callee === master.master) {
        throw new FramedEncodingError(`master "${master.master}" calls itself, which the format refuses`);
      }
      const selector = call.argumentPushes[0];
      if (selector === undefined || selector.length !== SELECTOR_LENGTH) {
        throw new FramedEncodingError(
          `the call from "${master.master}" to "${call.callee}" does not begin with a ${SELECTOR_LENGTH}-byte selector`,
        );
      }
      const previous = recorded.get(call.callee);
      if (previous !== undefined && !samePushes(previous, call.argumentPushes)) {
        throw new FramedEncodingError(
          `"${call.callee}" is called with different arguments by more than one caller, `
          + 'so its single input cannot carry both',
        );
      }
      recorded.set(call.callee, call.argumentPushes);
    }
  }

  for (const master of plan.masters) {
    const committed = recorded.get(master.master);
    if (committed === undefined) {
      // A user's entry carries no call data unless the program dispatches over several entries, in which case the
      // selector the user's call data leads with is what picks the entry the user asked for.
      if (master.argumentPushes.length > 0 && master.dispatches !== true) {
        throw new FramedEncodingError(
          `"${master.master}" is entered by a user, so it carries no call data`,
        );
      }
      continue;
    }
    if (!samePushes(committed, master.argumentPushes)) {
      throw new FramedEncodingError(
        `"${master.master}" carries call data its caller did not record`,
      );
    }
  }
}

/** True when two push lists are the same bytes in the same order. */
function samePushes(left: readonly Uint8Array[], right: readonly Uint8Array[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((push, index) => bytesEqual(push, right[index]!));
}

/**
 * Resolves every reference and assembles the composition.
 *
 * The order of the returned inputs is the layout's, so a caller can build the transaction without recomputing any
 * index.
 */
export function assembleComposition(plan: CompositionPlan): CompositionAssembly {
  assertCallDataAgrees(plan);
  const declared = declaredValidators(plan);
  const layout = layoutTransaction(
    plan.blocks,
    new Map(declared.map((validator) => [validator.id, validatorFacetsOf(validator)])),
    plan.leading,
  );
  const outputs = resolveOutputRegions(plan, layout);
  const indexOf = new Map<string, number>();
  for (const participant of layout.participants) indexOf.set(participant.id, participant.index);
  for (const user of plan.userInputs) {
    if (indexOf.has(user.id)) {
      throw new FramedEncodingError(`"${user.id}" is both a participant and a user input`);
    }
    indexOf.set(user.id, user.index);
  }
  // A genesis frame's origin is INDEX_NONE: the minted root has no P2PKH caller, and every frame it enters inherits it.
  indexOf.set(INDEX_NONE_REFERENCE, INDEX_NONE);
  // A minted master is not an input: a callee names it by `mintedRef(output)`, the flagged reference the transcript
  // carries. Its output index is the trailing slot the minted region allocates, in plan order.
  (plan.mintedMasters ?? []).forEach((minted, position) => {
    const output = outputs.mintedMasterIndices[position];
    if (output === undefined) {
      throw new FramedEncodingError(`the plan mints "${minted.master}" past the minted output region`);
    }
    if (indexOf.has(minted.master)) {
      throw new FramedEncodingError(`"${minted.master}" is both a participant and a minted master`);
    }
    indexOf.set(minted.master, mintedRef(output));
  });

  const resolve = (reference: string, what: string): number => {
    const index = indexOf.get(reference);
    if (index === undefined) throw new UnresolvedReferenceError(reference, what);
    return index;
  };

  // The validator that covers a contract is the one whose plan covers it, and a master's reference names it.
  const binding = bindContractValidators(plan);

  const entries: { facts: EntryFacts; hasValidator: boolean }[] = [];
  const assembled: AssembledInput[] = [];
  const resolvedCalls: ResolvedCall[] = [];

  for (const master of plan.masters) {
    const validator = binding.byContract.get(master.contract);
    const validatorRef = validator === undefined ? INDEX_NONE : resolve(validator.id, 'validator');
    entries.push({ facts: master.facts, hasValidator: validatorRef !== INDEX_NONE });

    const calls = master.calls.map((call) => {
      const calleeRef = resolve(call.callee, 'callee');
      if (calleeRef === resolve(master.master, 'master')) {
        throw new FramedEncodingError(`master "${master.master}" calls itself, which the format refuses`);
      }
      const hashed = argsHashOf(call);
      resolvedCalls.push({ from: master.master, callee: call.callee, calleeRef, argsHash: hashed });
      return {
        kind: call.kind, target: call.target, value: call.value, calleeRef, argsHash: hashed, result: call.result,
      };
    });

    const witness = assembleMasterWitness({
      frame: master.frame,
      callerRef: resolve(master.enteredBy, 'caller'),
      originRef: resolve(master.origin, 'origin'),
      validatorRef,
      calls,
      retval: master.retval,
      segments: master.segments,
      events: master.events,
      sends: master.sends,
      argumentPushes: master.argumentPushes,
      redeemScript: master.redeemScript,
      ...(master.values === undefined ? {} : { values: master.values }),
    });
    assembled.push({
      id: master.master,
      index: resolve(master.master, 'master'),
      unlockingBytecode: witness.unlockingBytecode,
    });
  }

  // A minted master's block rides in the validator transcript: a genesis root has no P2PKH caller and no origin, and
  // its calls name their callees by input index as any other caller's do.
  const mintedBlocks = new Map<string, WitnessBlock>();
  for (const minted of plan.mintedMasters ?? []) {
    const validator = binding.byContract.get(minted.contract);
    const validatorRef = validator === undefined ? INDEX_NONE : resolve(validator.id, 'validator');
    const calls = minted.calls.map((call) => {
      const calleeRef = resolve(call.callee, 'callee');
      const hashed = argsHashOf(call);
      resolvedCalls.push({ from: minted.master, callee: call.callee, calleeRef, argsHash: hashed });
      return {
        kind: call.kind, target: call.target, value: call.value, calleeRef, argsHash: hashed, result: call.result,
      };
    });
    mintedBlocks.set(minted.master, assembleMintedMasterBlock({
      frame: minted.frame,
      callerRef: INDEX_NONE,
      originRef: INDEX_NONE,
      validatorRef,
      calls,
      retval: minted.retval,
      segments: minted.segments,
      events: minted.events,
      sends: minted.sends,
    }));
  }

  // Coverage is checked before the validators are assembled, so a plan that cannot be verified is refused as a plan
  // rather than producing inputs.
  assertValidatorCoverage(entries);

  const transcripts: ValidatorTranscript[] = [];
  for (const validator of binding.hosted) {
    // A validator's transcript names the masters that point at it, not every master of the composition.
    const covered = plan.masters.filter((master) => binding.byContract.get(master.contract) === validator);
    const minted: MintedMaster[] = [];
    (plan.mintedMasters ?? []).forEach((master, position) => {
      if (binding.byContract.get(master.contract) !== validator) return;
      const block = mintedBlocks.get(master.master);
      if (block === undefined) throw new FramedEncodingError(`the minted master "${master.master}" was not assembled`);
      minted.push({ output: outputs.mintedMasterIndices[position]!, block });
    });
    const settles: Transcript['settles'] = validator.settles.map((settled) => ({
      category: settled.category,
      stateInputs: settled.stateInputs.map((state) => resolve(state, 'state input')),
      createdOutputs: requireCreatedOutputs(settled, outputs),
    }));
    const transcript: Transcript | MintedTranscript = {
      // Ascending by index, so two builders of the same composition produce the same transcript.
      roots: covered
        .filter((master) => master.facts.kind === 0)
        .map((master) => resolve(master.master, 'master'))
        .sort((left, right) => left - right),
      masters: covered
        .map((master) => resolve(master.master, 'master'))
        .sort((left, right) => left - right),
      ...(minted.length === 0 ? {} : { mintedMasters: minted }),
      settles,
    };
    const validatorWitness = assembleValidatorWitness({
      transcript,
      redeemScript: validator.redeemScript,
    });
    assembled.push({
      id: validator.id,
      index: resolve(validator.id, 'validator'),
      unlockingBytecode: validatorWitness.unlockingBytecode,
    });
    // A facet's unlocking bytecode is its own code and nothing else: the transcript rides with the head.
    validatorFacetsOf(validator).forEach((code, at) => {
      const id = facetId(validator.id, at + 1);
      assembled.push({ id, index: resolve(id, 'facet'), unlockingBytecode: encodeMinimalDataPush(code) });
    });
    transcripts.push({ validator: validator.id, transcript });
  }

  return { layout, inputs: ordered(layout, assembled), outputs, calls: resolvedCalls, transcripts };
}

/** The argument hash of a planned call: the selector and the argument pushes, in their canonical encoding. */
function argsHashOf(call: PlannedCall): Uint8Array {
  const pushes = call.argumentPushes;
  if (pushes.length === 0) {
    throw new FramedEncodingError('a call carries at least its selector');
  }
  const [selector, ...args] = pushes;
  return argsHash(selector!, encodeArgumentList(args));
}

/** The assembled inputs in layout order, so a caller never recomputes an index. */
function ordered(layout: TransactionLayout, assembled: readonly AssembledInput[]): readonly AssembledInput[] {
  const byIndex = [...assembled].sort((left, right) => left.index - right.index);
  const participants = new Set(layout.participants.map((participant) => participant.index));
  for (const input of byIndex) {
    if (!participants.has(input.index)) {
      throw new FramedEncodingError(`input "${input.id}" sits at ${input.index}, outside the layout's participants`);
    }
  }
  return byIndex;
}
