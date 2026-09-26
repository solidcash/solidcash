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
  PerCallEncodingError,
  SELECTOR_LENGTH,
  argsHash,
  bytesEqual,
  encodeArgumentList,
  type FrameKindValue,
  type RecordEntry,
  type Transcript,
} from '@solidcash/utils';
import { assertValidatorCoverage, type EntryFacts } from './need-test.js';
import {
  allocateOutputRegions,
  layoutTransaction,
  type ContractBlock,
  type OutputRegions,
  type TransactionLayout,
} from './layout.js';
import { assertOutputOccupancy } from './settlement.js';
import {
  assembleMasterWitness,
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
}

/** The whole plan. Every reference is an identity, and every coordinate comes from the layout. */
export interface CompositionPlan {
  readonly blocks: readonly ContractBlock[];
  readonly userInputs: readonly PlannedUserInput[];
  readonly masters: readonly PlannedMaster[];
  /** Present when the composition has a validator. */
  readonly validator?: {
    readonly id: string;
    /**
     * The contracts whose masters point at this validator.
     *
     * Coverage is wider than settlement: a contract that a validator covers without settling keeps its own single
     * master's settlement while still having every edge into it bound, so this is stated rather than derived from the
     * contracts the validator settles.
     */
    readonly covers: readonly string[];
    /** The validator's redeem script: the category pin followed by the validator program. */
    readonly redeemScript: Uint8Array;
    /** The contracts the validator settles, with the state inputs each spends. */
    readonly settles: readonly PlannedSettlement[];
  };
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

/** The assembled composition. */
export interface CompositionAssembly {
  readonly layout: TransactionLayout;
  readonly inputs: readonly AssembledInput[];
  /** Where the trailing outputs are: one per event, one per send, one per created record, then change. */
  readonly outputs: OutputRegions;
  readonly calls: readonly ResolvedCall[];
  readonly transcript?: Transcript;
}

/** The outputs a plan creates records at, in first-appearance order. */
function createdRecordOutputs(masters: readonly PlannedMaster[]): readonly number[] {
  const created: number[] = [];
  for (const master of masters) {
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
  const created = createdRecordOutputs(plan.masters);

  const regions = allocateOutputRegions(layout, {
    events: declaredEvents.length,
    sends: declaredSends.length,
    created: created.length,
  });
  if (!sameIndices(declaredEvents, regions.eventIndices)) {
    throw new PerCallEncodingError(
      `the plan lists events at [${declaredEvents.join(', ')}], and the trailing region puts them at `
      + `[${regions.eventIndices.join(', ')}]`,
    );
  }
  if (!sameIndices(declaredSends, regions.sendIndices)) {
    throw new PerCallEncodingError(
      `the plan lists sends at [${declaredSends.join(', ')}], and the trailing region puts them at `
      + `[${regions.sendIndices.join(', ')}]`,
    );
  }
  if (!sameIndices(created, regions.createdIndices)) {
    throw new PerCallEncodingError(
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
  for (const master of plan.masters) {
    for (const call of master.calls) {
      if (call.callee === master.master) {
        throw new PerCallEncodingError(`master "${master.master}" calls itself, which the format refuses`);
      }
      const selector = call.argumentPushes[0];
      if (selector === undefined || selector.length !== SELECTOR_LENGTH) {
        throw new PerCallEncodingError(
          `the call from "${master.master}" to "${call.callee}" does not begin with a ${SELECTOR_LENGTH}-byte selector`,
        );
      }
      const previous = recorded.get(call.callee);
      if (previous !== undefined && !samePushes(previous, call.argumentPushes)) {
        throw new PerCallEncodingError(
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
      if (master.argumentPushes.length > 0) {
        throw new PerCallEncodingError(
          `"${master.master}" is entered by a user, so it carries no call data`,
        );
      }
      continue;
    }
    if (!samePushes(committed, master.argumentPushes)) {
      throw new PerCallEncodingError(
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
  const layout = layoutTransaction(plan.blocks);
  const outputs = resolveOutputRegions(plan, layout);
  const indexOf = new Map<string, number>();
  for (const participant of layout.participants) indexOf.set(participant.id, participant.index);
  for (const user of plan.userInputs) {
    if (indexOf.has(user.id)) {
      throw new PerCallEncodingError(`"${user.id}" is both a participant and a user input`);
    }
    indexOf.set(user.id, user.index);
  }

  const resolve = (reference: string, what: string): number => {
    const index = indexOf.get(reference);
    if (index === undefined) throw new UnresolvedReferenceError(reference, what);
    return index;
  };

  // The validator that covers a contract is the one whose plan covers it, and a master's reference names it.
  const validatorByContract = new Map<string, string>();
  for (const block of plan.blocks) {
    if (!block.validator || !plan.validator) continue;
    for (const covered of [block.contract, ...plan.validator.covers]) {
      if (validatorByContract.has(covered)) {
        throw new PerCallEncodingError(`"${covered}" is covered by more than one validator`);
      }
      validatorByContract.set(covered, plan.validator.id);
    }
  }

  const entries: { facts: EntryFacts; hasValidator: boolean }[] = [];
  const assembled: AssembledInput[] = [];
  const resolvedCalls: ResolvedCall[] = [];

  for (const master of plan.masters) {
    const validatorId = validatorByContract.get(master.contract);
    const validatorRef = validatorId === undefined ? INDEX_NONE : resolve(validatorId, 'validator');
    entries.push({ facts: master.facts, hasValidator: validatorRef !== INDEX_NONE });

    const calls = master.calls.map((call) => {
      const calleeRef = resolve(call.callee, 'callee');
      if (calleeRef === resolve(master.master, 'master')) {
        throw new PerCallEncodingError(`master "${master.master}" calls itself, which the format refuses`);
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
    });
    assembled.push({
      id: master.master,
      index: resolve(master.master, 'master'),
      unlockingBytecode: witness.unlockingBytecode,
    });
  }

  // Coverage is checked before the validator is assembled, so a plan that cannot be verified is refused as a plan
  // rather than producing inputs.
  assertValidatorCoverage(entries);

  if (!plan.validator) {
    return { layout, inputs: ordered(layout, assembled), outputs, calls: resolvedCalls };
  }

  const transcript: Transcript = {
    // Ascending by index, so two builders of the same composition produce the same transcript.
    roots: plan.masters
      .filter((master) => master.facts.kind === 0)
      .map((master) => resolve(master.master, 'master'))
      .sort((left, right) => left - right),
    masters: plan.masters
      .map((master) => resolve(master.master, 'master'))
      .sort((left, right) => left - right),
    settles: plan.validator.settles.map((settled) => ({
      category: settled.category,
      stateInputs: settled.stateInputs.map((state) => resolve(state, 'state input')),
    })),
  };
  const validatorWitness = assembleValidatorWitness({
    transcript,
    redeemScript: plan.validator.redeemScript,
  });
  assembled.push({
    id: plan.validator.id,
    index: resolve(plan.validator.id, 'validator'),
    unlockingBytecode: validatorWitness.unlockingBytecode,
  });

  return { layout, inputs: ordered(layout, assembled), outputs, calls: resolvedCalls, transcript };
}

/** The argument hash of a planned call: the selector and the argument pushes, in their canonical encoding. */
function argsHashOf(call: PlannedCall): Uint8Array {
  const pushes = call.argumentPushes;
  if (pushes.length === 0) {
    throw new PerCallEncodingError('a call carries at least its selector');
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
      throw new PerCallEncodingError(`input "${input.id}" sits at ${input.index}, outside the layout's participants`);
    }
  }
  return byIndex;
}
