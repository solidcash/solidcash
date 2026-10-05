/** Authenticate a routed predecessor recreation before moving its local output witness into a composition. */

import { binToHex } from '@bitauth/libauth';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';

export interface PhysicalPredOutWitness {
  index: number;
  localOutputIndex: number;
}

/**
 * A route's PredOut argument names an output, while its proof argument is relative to the executor input.
 * Rebase only an output authenticated by the predecessor's lock, owner category, mutable capability, and
 * unchanged slot/value bytes. The next pointer may differ for several inserts sharing one predecessor;
 * prefer the exact target pointer when available, otherwise require a unique predecessor identity.
 */
export function resolvePhysicalPredOutWitnesses(parts: {
  routeInputs: readonly { name: string }[];
  params: readonly unknown[];
  routeInputOffset: number;
  inputs: readonly UnlockableUtxo[];
  outputs: readonly Output[];
  categoryId: string;
}): PhysicalPredOutWitness[] {
  const { routeInputs, params, routeInputOffset, inputs, outputs, categoryId } = parts;
  const valueOf = (name: string): unknown => {
    const index = routeInputs.findIndex((candidate) => candidate.name === name);
    return index < 0 ? undefined : params[index];
  };
  const commitmentHex = (value: unknown): string => value instanceof Uint8Array
    ? binToHex(value).toLowerCase() : typeof value === 'string' ? value.toLowerCase() : '';
  const result: PhysicalPredOutWitness[] = [];
  for (const [index, parameter] of routeInputs.entries()) {
    const match = /^__internal__vmapBatchPredOut_(\d+)$/.exec(parameter.name);
    if (!match) continue;
    const current = params[index];
    if (typeof current !== 'bigint' || current < 0n) continue;
    const proof = valueOf(`__internal__vmapBatchProof_${match[1]}`);
    const target = valueOf(`__internal__vmapBatchSlot_${match[1]}`);
    if (typeof proof !== 'bigint' || proof < 0n || proof >= BigInt(inputs.length)
      || !(target instanceof Uint8Array) || target.length !== 32) {
      throw new Error(`messageBus: active ${parameter.name} lacks a valid predecessor proof`);
    }
    // Existing standalone routes may have already rebased proof offsets. Require output content, not either
    // coordinate convention, to establish which interpretation belongs to this executor.
    const proofIndices = new Set([Number(proof), routeInputOffset + Number(proof)]);
    const exactMatches = new Set<number>();
    const identityMatches = new Set<number>();
    for (const proofIndex of proofIndices) {
      const predecessor = inputs[proofIndex];
      const predecessorCommitment = commitmentHex(predecessor?.token?.nft?.commitment);
      if (!predecessor?.unlocker || predecessorCommitment.length < 128) continue;
      const predecessorLock = binToHex(predecessor.unlocker.generateLockingBytecode()).toLowerCase();
      for (const [outputIndex, output] of outputs.entries()) {
        const outputLock = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
        const outputCommitment = commitmentHex(output.token?.nft?.commitment);
        if (output.token?.category?.toLowerCase() !== categoryId.toLowerCase()
          || output.token.nft?.capability !== 'mutable'
          || binToHex(outputLock).toLowerCase() !== predecessorLock
          || outputCommitment.length !== predecessorCommitment.length
          || outputCommitment.slice(0, 64) !== predecessorCommitment.slice(0, 64)
          || outputCommitment.slice(128) !== predecessorCommitment.slice(128)) continue;
        identityMatches.add(outputIndex);
        if (outputCommitment.slice(64, 128) === binToHex(target).toLowerCase()) {
          exactMatches.add(outputIndex);
        }
      }
    }
    const matches = exactMatches.size > 0 ? exactMatches : identityMatches;
    if (matches.size !== 1) {
      throw new Error(`messageBus: ${parameter.name} has ${matches.size} authenticated predecessor outputs`);
    }
    result.push({ index, localOutputIndex: [...matches][0]! });
  }
  return result;
}
