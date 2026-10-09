/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 runtime-loop events + transfers.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import { Op } from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { decodeScriptNumber, extractCommitmentMapFromTrace } from './trace-commitment-helpers.js';
import { extractVerifiedValuesFromTrace } from './trace-verified-value-helpers.js';

export type DeriveFullPhase2RuntimeLoopHost = {
  extractExpectedOutputCommitmentFromTrace: (
    trace: AuthenticationProgramStateCommon[],
    outputIndex: number,
    actualCommitment: string,
  ) => string | undefined;
  parseNftCapability: (catBytes: Uint8Array) => 'none' | 'mutable' | 'minting';
};

export type DeriveFullPhase2RuntimeLoopDerivedFlags = {
  bytecodesDerived: boolean[];
  amountsDerived: boolean[];
  commitmentsDerived: boolean[];
  capabilitiesDerived: boolean[];
};

export type DeriveFullPhase2RuntimeLoopResult = {
  commitmentProgress: number;
};

/**
 * Converge runtime-loop event commitments and BCH/NFT/token transfer outputs
 * from Phase-2 probe traces. Mutates derived-flag arrays in place.
 */
export function deriveFullPhase2ApplyRuntimeLoop(
  host: DeriveFullPhase2RuntimeLoopHost,
  stb: StatefulTransactionBuilder,
  params: {
    probeBuilder2: TransactionBuilder;
    fullTrace2: AuthenticationProgramStateCommon[];
    commitmentProgress: number;
    derivedFlags: DeriveFullPhase2RuntimeLoopDerivedFlags;
    phaseCheckpoint: (stage: string) => void;
  },
): DeriveFullPhase2RuntimeLoopResult {
  let { commitmentProgress } = params;
  const { probeBuilder2, fullTrace2, derivedFlags, phaseCheckpoint } = params;
  const {
    bytecodesDerived: runtimeLoopTransferBytecodesDerived,
    amountsDerived: runtimeLoopTransferAmountsDerived,
    commitmentsDerived: runtimeLoopTransferCommitmentsDerived,
    capabilitiesDerived: runtimeLoopTransferCapabilitiesDerived,
  } = derivedFlags;

  // Runtime-loop event outputs immediately follow the mapping-entry family. Their count and event
  // covenants are fixed before the first probe; only source-evaluated commitments need convergence.
  const runtimeLoopEvents = stb.getRuntimeLoopEventOutputs();
  if (runtimeLoopEvents.length > 0) {
    for (let eventIndex = 0; eventIndex < runtimeLoopEvents.length; eventIndex += 1) {
      const outputIndex = stb.getRuntimeLoopEventOutputIndex(eventIndex);
      const actual = probeBuilder2.outputs[outputIndex]?.token?.nft?.commitment ?? '';
      const commitmentMap = extractCommitmentMapFromTrace(
        fullTrace2, { min: outputIndex, max: outputIndex + 1 }, true, true, true,
      );
      const commitment = commitmentMap.get(outputIndex)
        ?? host.extractExpectedOutputCommitmentFromTrace(fullTrace2, outputIndex, actual);
      if (commitment === undefined || commitment === runtimeLoopEvents[eventIndex].commitment) continue;
      if (runtimeLoopEvents[eventIndex].commitment.length > 0) {
        throw new Error(`Runtime event ${eventIndex} trace commitment does not match compiler metadata`);
      }
      stb.setRuntimeLoopEventRawCommitment(eventIndex, commitment);
      commitmentProgress += 1;
    }
  }

  phaseCheckpoint('runtime-loop-events');
  // Runtime-loop BCH outputs are outside the fixed transfer block. Derive each coordinate directly from
  // the same OUTPUTBYTECODE/OUTPUTVALUE checks which authenticate it on-chain. A failing placeholder may
  // reveal only the bytecode in one probe and the amount in the next, so retain progress per field.
  const runtimeLoopTransfers = stb.getRuntimeLoopTransferOutputs();
  for (let transferIndex = 0; transferIndex < runtimeLoopTransfers.length; transferIndex += 1) {
    const outputIndex = stb.getRuntimeLoopTransferOutputIndex(transferIndex);
    const current = runtimeLoopTransfers[transferIndex];
    const bytecodes = extractVerifiedValuesFromTrace(
      fullTrace2, Op.OP_OUTPUTBYTECODE, { min: outputIndex, max: outputIndex + 1 },
      false, true, true,
    );
    const lockingBytecode = bytecodes[0] ?? current.lockingBytecode;
    let changed = false;
    if (bytecodes[0] !== undefined) {
      runtimeLoopTransferBytecodesDerived[transferIndex] = true;
      if (binToHex(lockingBytecode) !== binToHex(current.lockingBytecode)) changed = true;
    }
    if (current.kind === 'nft') {
      const commitments = extractVerifiedValuesFromTrace(
        fullTrace2, Op.OP_OUTPUTTOKENCOMMITMENT, { min: outputIndex, max: outputIndex + 1 },
        false, true, true,
      );
      const categories = extractVerifiedValuesFromTrace(
        fullTrace2, Op.OP_OUTPUTTOKENCATEGORY, { min: outputIndex, max: outputIndex + 1 },
        false, true, true,
      );
      const commitment = commitments[0] ?? current.commitment ?? new Uint8Array();
      const capability = categories[0] === undefined
        ? current.capability ?? 'none' : host.parseNftCapability(categories[0]);
      if (commitments[0] !== undefined) {
        runtimeLoopTransferCommitmentsDerived[transferIndex] = true;
        if (binToHex(commitment) !== binToHex(current.commitment ?? new Uint8Array())) changed = true;
      }
      if (categories[0] !== undefined) {
        runtimeLoopTransferCapabilitiesDerived[transferIndex] = true;
        if (capability !== current.capability) changed = true;
      }
      if (changed) {
        stb.setRuntimeLoopNftTransferOutput(
          transferIndex, lockingBytecode, commitment, capability,
        );
        commitmentProgress += 1;
      }
    } else {
      const values = extractVerifiedValuesFromTrace(
        fullTrace2, current.kind === 'token' ? Op.OP_OUTPUTTOKENAMOUNT : Op.OP_OUTPUTVALUE,
        { min: outputIndex, max: outputIndex + 1 },
        false, true, true,
      );
      const amount = values[0] === undefined ? current.amount : decodeScriptNumber(values[0]);
      if (values[0] !== undefined) {
        runtimeLoopTransferAmountsDerived[transferIndex] = true;
        if (amount !== current.amount) changed = true;
      }
      if (changed) {
        stb.setRuntimeLoopTransferOutput(transferIndex, lockingBytecode, amount);
        commitmentProgress += 1;
      }
    }
  }

  phaseCheckpoint('runtime-loop-transfers');

  return { commitmentProgress };
}
