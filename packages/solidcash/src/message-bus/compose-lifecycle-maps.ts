/**
 * phase-boundary extract: Compose phase-boundary extract — validate and index lifecycle split/merge/selfdestruct maps.
 */

import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { funderUtxo } from './compose-participant-helpers.js';
import type { ComposeAtomicMessageBusOptions } from './compose-prepared-invocation.js';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;

export interface ComposeLifecycleSplitFunding {
  invocationIndex: number;
  funders: readonly UnlockableUtxo[];
  createdValues: readonly bigint[];
}

export interface ComposeLifecycleMergeInputs {
  invocationIndex: number;
  consumedMasters: readonly Utxo[];
}

export interface ComposeLifecycleSelfdestructRecipient {
  invocationIndex: number;
  recipient: string | Uint8Array;
}

export interface ComposeLifecycleMaps {
  splitByParticipant: Map<number, ComposeLifecycleSplitFunding>;
  mergeByParticipant: Map<number, ComposeLifecycleMergeInputs>;
  selfdestructByParticipant: Map<number, ComposeLifecycleSelfdestructRecipient>;
}

/**
 * Validate caller-supplied lifecycle funding/recipients against the compiled plan and index them by
 * participant for later assemble / semantic-effect passes.
 */
export function resolveComposeLifecycleMaps(
  plan: CompiledGraphPlan,
  options: Pick<
  ComposeAtomicMessageBusOptions,
  'lifecycleSplits' | 'lifecycleMerges' | 'lifecycleSelfdestructs'
  >,
): ComposeLifecycleMaps {
  const suppliedSplits = options.lifecycleSplits ?? [];
  const splitByParticipant = new Map<number, ComposeLifecycleSplitFunding>();
  for (const supplied of suppliedSplits) {
    const invocation = plan.invocations[supplied.invocationIndex];
    if (!invocation) throw new Error(`messageBus: split invocation ${supplied.invocationIndex} is absent`);
    const participant = plan.participants[invocation.callee];
    if (participant.lifecycle?.kind !== 'split'
      || participant.invocations.length !== 1 || participant.invocations[0] !== supplied.invocationIndex) {
      throw new Error(`messageBus: invocation ${supplied.invocationIndex} is not one exact split participant`);
    }
    if (splitByParticipant.has(invocation.callee)) {
      throw new Error(`messageBus: participant ${invocation.callee} has duplicate split funding`);
    }
    if (supplied.funders.length !== participant.lifecycle.count
      || supplied.createdValues.length !== participant.lifecycle.count
      || supplied.createdValues.some((value) => typeof value !== 'bigint' || value <= 0n)) {
      throw new Error(`messageBus: split participant ${invocation.callee} funding does not match its exact count`);
    }
    const funders = supplied.funders.map(funderUtxo);
    if (funders.some((funder) => funder.token !== undefined)) {
      throw new Error(`messageBus: split participant ${invocation.callee} funders must be token-free`);
    }
    const outpoints = new Set(funders.map((funder) => `${funder.txid.toLowerCase()}:${funder.vout}`));
    if (outpoints.size !== funders.length) {
      throw new Error(`messageBus: split participant ${invocation.callee} funder outpoints must be unique`);
    }
    splitByParticipant.set(invocation.callee, {
      invocationIndex: supplied.invocationIndex, funders, createdValues: supplied.createdValues,
    });
  }
  for (const participant of plan.participants) {
    if (participant.lifecycle?.kind === 'split' && !splitByParticipant.has(participant.participant)) {
      throw new Error(`messageBus: split participant ${participant.participant} lacks explicit funding`);
    }
  }
  const suppliedMerges = options.lifecycleMerges ?? [];
  const mergeByParticipant = new Map<number, ComposeLifecycleMergeInputs>();
  for (const supplied of suppliedMerges) {
    const invocation = plan.invocations[supplied.invocationIndex];
    if (!invocation) throw new Error(`messageBus: merge invocation ${supplied.invocationIndex} is absent`);
    const participant = plan.participants[invocation.callee];
    if (participant.lifecycle?.kind !== 'merge'
      || participant.invocations.length !== 1 || participant.invocations[0] !== supplied.invocationIndex) {
      throw new Error(`messageBus: invocation ${supplied.invocationIndex} is not one exact merge participant`);
    }
    if (mergeByParticipant.has(invocation.callee)) {
      throw new Error(`messageBus: participant ${invocation.callee} has duplicate merge inputs`);
    }
    if (supplied.consumedMasters.length !== participant.lifecycle.count) {
      throw new Error(`messageBus: merge participant ${invocation.callee} inputs do not match its exact count`);
    }
    const outpoints = new Set(supplied.consumedMasters.map((input) =>
      `${input.txid.toLowerCase()}:${input.vout}`));
    if (outpoints.size !== supplied.consumedMasters.length) {
      throw new Error(`messageBus: merge participant ${invocation.callee} input outpoints must be unique`);
    }
    mergeByParticipant.set(invocation.callee, {
      invocationIndex: supplied.invocationIndex,
      consumedMasters: Object.freeze([...supplied.consumedMasters]),
    });
  }
  for (const participant of plan.participants) {
    if (participant.lifecycle?.kind === 'merge' && !mergeByParticipant.has(participant.participant)) {
      throw new Error(`messageBus: merge participant ${participant.participant} lacks explicit consumed masters`);
    }
  }
  const suppliedSelfdestructs = options.lifecycleSelfdestructs ?? [];
  const selfdestructByParticipant = new Map<number, ComposeLifecycleSelfdestructRecipient>();
  for (const supplied of suppliedSelfdestructs) {
    const invocation = plan.invocations[supplied.invocationIndex];
    if (!invocation) {
      throw new Error(`messageBus: selfdestruct invocation ${supplied.invocationIndex} is absent`);
    }
    const participant = plan.participants[invocation.callee];
    if (participant.lifecycle?.kind !== 'selfdestruct'
      || participant.invocations.length !== 1 || participant.invocations[0] !== supplied.invocationIndex) {
      throw new Error(
        `messageBus: invocation ${supplied.invocationIndex} is not one exact selfdestruct participant`,
      );
    }
    if (selfdestructByParticipant.has(invocation.callee)) {
      throw new Error(`messageBus: participant ${invocation.callee} has duplicate selfdestruct recipient`);
    }
    const recipient = supplied.recipient;
    if (typeof recipient === 'string' ? recipient.length === 0 : recipient.length === 0) {
      throw new Error(`messageBus: selfdestruct participant ${invocation.callee} recipient is empty`);
    }
    selfdestructByParticipant.set(invocation.callee, {
      invocationIndex: supplied.invocationIndex, recipient,
    });
  }
  for (const participant of plan.participants) {
    if (participant.lifecycle?.kind === 'selfdestruct'
      && !selfdestructByParticipant.has(participant.participant)) {
      throw new Error(
        `messageBus: selfdestruct participant ${participant.participant} lacks an explicit recipient`,
      );
    }
  }
  return { splitByParticipant, mergeByParticipant, selfdestructByParticipant };
}
