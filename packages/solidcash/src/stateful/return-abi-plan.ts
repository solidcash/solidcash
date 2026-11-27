/**
 * phase-boundary extract: return-ABI selection + dynamic-chunk input-base helpers
 * (phase-boundary extract from StatefulContract.ts).
 */

import type { AbiFunction } from '@solidcash/utils';

export class AutoDerivationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'AutoDerivationError';
  }
}

/**
 * Convert a participant-local dynamic-storage chunk coordinate to the physical transaction coordinate expected
 * by the covenant. A participant builder remains block-local after materialization; its enclosing block base is
 * therefore always part of the aggregate coordinate.
 */
export function resolveDynamicChunkInputBase(
  inputIndex: number,
  blockBase: number,
  writeActive = true,
): bigint {
  if (!writeActive) return inputIndex < 0 ? -2n : -BigInt(blockBase + inputIndex + 3);
  if (inputIndex < 0) return -1n;
  return BigInt(blockBase + inputIndex);
}

export type ReturnAbiCandidate<T> = {
  logicalFunction: AbiFunction;
  physicalFunction: AbiFunction;
  context: T;
};

export type ReturnAbiPlan<T> = {
  logicalFunction: AbiFunction;
  physicalFunction: AbiFunction;
  context?: T;
};

/**
 * Select the ABI which describes a call's logical value independently from the ABI which physically carries
 * its return event. A function with no direct result (such as a proxy forwarder) takes the result of its one
 * returning candidate call, and fails closed when more than one candidate returns a value.
 */
export function selectReturnAbiPlan<T>(
  functionName: string,
  directFunction: AbiFunction | undefined,
  candidates: readonly ReturnAbiCandidate<T>[],
): ReturnAbiPlan<T> | undefined {
  if ((directFunction?.outputs?.length ?? 0) > 0) {
    return { logicalFunction: directFunction!, physicalFunction: directFunction! };
  }
  const returning = candidates.filter((candidate) => candidate.logicalFunction.outputs?.length);
  if (returning.length > 1) {
    throw new Error(
      `staticCall: '${functionName}' selects ${returning.length} logical return rows; `
      + 'a result taken from more than one returning call has no single return value.',
    );
  }
  const selected = returning[0];
  return selected && {
    logicalFunction: selected.logicalFunction,
    physicalFunction: selected.physicalFunction,
    context: selected.context,
  };
}
