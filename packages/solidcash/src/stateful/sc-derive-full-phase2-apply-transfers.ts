/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 satoshi/FT/NFT transfer apply.
 */

import { type AuthenticationProgramStateCommon } from '@bitauth/libauth';
import { Op, type AbiFunction, type BlockSlotKind } from '@solidcash/utils';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import type { DeriveFullTokenContainerTransferOp } from './sc-seed-derive-full-phase2-placeholders.js';
import { decodeScriptNumber } from './trace-commitment-helpers.js';
import { extractVerifiedValuesFromTrace } from './trace-verified-value-helpers.js';
import { physicalDelegateSlotOffset } from './writer-event-delegate-layout.js';

export type DeriveFullPhase2TransfersHost = {
  parseNftCapability: (catBytes: Uint8Array) => 'none' | 'mutable' | 'minting';
};

export type DeriveFullPhase2TransfersResult = {
  derivedTransfers: Array<{ lockingBytecode: Uint8Array; amount: bigint }> | undefined;
  derivedFtTransfers: Array<{
    categoryId: string; lockingBytecode: Uint8Array; amount: bigint;
  }> | undefined;
  derivedNftTransfers: Array<{
    categoryId: string; lockingBytecode: Uint8Array; commitment: Uint8Array; capability: string;
  }> | undefined;
  satoshiAmountsFullyDerived: boolean;
  ftAmountsFullyDerived: boolean;
};

/**
 * Progressively extract and apply satoshi / FT / NFT transfer outputs from the
 * Phase-2 probe trace. Returns derived transfer bags and amount-complete flags.
 */
export function deriveFullPhase2ApplyTransfers(
  host: DeriveFullPhase2TransfersHost,
  stb: StatefulTransactionBuilder,
  params: {
    fullTrace2: AuthenticationProgramStateCommon[];
    satoshiTransferCount: number;
    ftOps: readonly DeriveFullTokenContainerTransferOp[];
    nftOps: readonly DeriveFullTokenContainerTransferOp[];
    dummyLbc: Uint8Array;
    delegatecallInputIndex: number | undefined;
    derivedTransfers: Array<{ lockingBytecode: Uint8Array; amount: bigint }> | undefined;
    derivedFtTransfers: Array<{
      categoryId: string; lockingBytecode: Uint8Array; amount: bigint;
    }> | undefined;
    derivedNftTransfers: Array<{
      categoryId: string; lockingBytecode: Uint8Array; commitment: Uint8Array; capability: string;
    }> | undefined;
    satoshiAmountsFullyDerived: boolean;
    ftAmountsFullyDerived: boolean;
    phaseCheckpoint: (stage: string) => void;
  },
): DeriveFullPhase2TransfersResult {
  let {
    derivedTransfers,
    derivedFtTransfers,
    derivedNftTransfers,
    satoshiAmountsFullyDerived,
    ftAmountsFullyDerived,
  } = params;
  const {
    fullTrace2,
    satoshiTransferCount,
    ftOps,
    nftOps,
    dummyLbc,
    delegatecallInputIndex,
    phaseCheckpoint,
  } = params;

  // Extract transfer outputs progressively from trace.
  // The compiler verifies transfers via:
  //   <expected_lbc> <idx> OP_OUTPUTBYTECODE OP_EQUALVERIFY
  //   <expected_amount> <idx> OP_OUTPUTVALUE OP_EQUALVERIFY
  // The VM fails at the first mismatch, so we may only get bytecodes (not amounts)
  // on the first iteration. Apply what we find (with placeholder amounts), re-probe.
  //
  // IMPORTANT: The compiler also verifies output bytecodes for preservation checks
  // (data NFTs, written entries, read-only entries) via OP_OUTPUTBYTECODE + OP_EQUALVERIFY
  // BEFORE the transfer checks. We filter by output index to only capture transfer
  // bytecodes: the STB's getTransferOutputBase() gives us the first transfer output index.
  const totalBytecodeCount = satoshiTransferCount + ftOps.length + nftOps.length;
  if (totalBytecodeCount > 0) {
    const delegateGroup = delegatecallInputIndex === undefined ? undefined
      : stb.getLowLevelCallUtxoGroups().find((_group, groupIdx) =>
        stb.getLowLevelCallMasterInputIndex(groupIdx) === delegatecallInputIndex);
    const delegateFn = delegateGroup?.compilerRoute?.abiFunction
      ?? (delegateGroup
        ? (delegateGroup.externalContract?.inner?.artifact?.abi as readonly AbiFunction[] | undefined)
          ?.find((candidate) => candidate.name === delegateGroup.functionName)
        : undefined);
    const absoluteDelegateSlot = (kind: BlockSlotKind): number | undefined => {
      if (delegatecallInputIndex === undefined) return undefined;
      const offset = delegateFn?.blockLayout?.slots.find((slot) => slot.kind === kind)?.offset;
      return offset === undefined ? undefined : delegatecallInputIndex + physicalDelegateSlotOffset(
        delegateFn?.blockLayout, offset, delegateGroup?.externalContract.inner.artifact.delegateOnly === true,
      );
    };
    const transferOutputBase = absoluteDelegateSlot('transfer') ?? stb.getTransferOutputBase();
    const tcTransferOutputBase = absoluteDelegateSlot('tcTransfer')
      ?? stb.getTokenContainerTransferOutputBase();

    // Satoshi transfer bytecodes: filter by output index range [transferOutputBase, tcTransferOutputBase)
    const satoshiBytecodes = extractVerifiedValuesFromTrace(
      fullTrace2, Op.OP_OUTPUTBYTECODE,
      { min: transferOutputBase, max: transferOutputBase + satoshiTransferCount },
      false, false, delegatecallInputIndex !== undefined,
    );
    // Satoshi transfer amounts: same output index range
    const satoshiValues = extractVerifiedValuesFromTrace(
      fullTrace2, Op.OP_OUTPUTVALUE,
      { min: transferOutputBase, max: transferOutputBase + satoshiTransferCount },
      false, false, delegatecallInputIndex !== undefined,
    );

    // Satoshi transfers: apply progressively (partial bytecodes + amounts).
    // The VM stops at the first mismatching OP_EQUALVERIFY, so for N transfers
    // we may only extract K<N bytecodes per iteration. Apply what we have and
    // keep placeholders for the rest - re-probing will extract more.
    if (satoshiTransferCount > 0 && satoshiBytecodes.length > 0) {
      stb.clearTransfers();
      derivedTransfers = [];
      if (satoshiValues.length >= satoshiTransferCount) satoshiAmountsFullyDerived = true;
      for (let i = 0; i < satoshiTransferCount; i++) {
        const lbc = i < satoshiBytecodes.length ? satoshiBytecodes[i] : dummyLbc;
        // Use extracted amount if available, otherwise keep placeholder
        const amt = i < satoshiValues.length
          ? decodeScriptNumber(satoshiValues[i]) : 1200n;
        stb._addDerivedTransfer(lbc, amt);
        derivedTransfers.push({ lockingBytecode: lbc, amount: amt });
      }
    }

    // FT token container transfers: bytecodes + token amounts (progressive)
    if (ftOps.length > 0) {
      const ftFields = ftOps.map((op, index) => {
        const outputSlot = op.outputSlot ?? index;
        const range = {
          min: tcTransferOutputBase + outputSlot,
          max: tcTransferOutputBase + outputSlot + 1,
        };
        return {
          outputSlot,
          bytecode: extractVerifiedValuesFromTrace(
            fullTrace2, Op.OP_OUTPUTBYTECODE, range,
            false, false, delegatecallInputIndex !== undefined,
          )[0],
          amount: extractVerifiedValuesFromTrace(
            fullTrace2, Op.OP_OUTPUTTOKENAMOUNT, range,
            false, false, delegatecallInputIndex !== undefined,
          )[0],
        };
      });
      if (ftFields.some((field) => field.bytecode !== undefined)) {
        if (ftFields.every((field) => field.amount !== undefined)) ftAmountsFullyDerived = true;
        stb.clearTokenContainerTransfers();
        derivedFtTransfers = [];
        for (let i = 0; i < ftOps.length; i++) {
          const lbc = ftFields[i].bytecode ?? dummyLbc;
          const amt = ftFields[i].amount === undefined
            ? 1n : decodeScriptNumber(ftFields[i].amount!);
          stb.addTokenContainerTransfer(
            ftOps[i].categoryId, lbc, amt, ftFields[i].outputSlot,
          );
          derivedFtTransfers.push({
            categoryId: ftOps[i].categoryId, lockingBytecode: lbc, amount: amt,
          });
        }
      }
    }

    // NFT token container transfers: bytecodes + commitments from OP_OUTPUTTOKENCOMMITMENT
    if (nftOps.length > 0) {
      const nftFields = nftOps.map((op, index) => {
        const outputSlot = op.outputSlot ?? ftOps.length + index;
        const range = {
          min: tcTransferOutputBase + outputSlot,
          max: tcTransferOutputBase + outputSlot + 1,
        };
        return {
          outputSlot,
          bytecode: extractVerifiedValuesFromTrace(
            fullTrace2, Op.OP_OUTPUTBYTECODE, range,
            false, false, delegatecallInputIndex !== undefined,
          )[0],
          commitment: extractVerifiedValuesFromTrace(
            fullTrace2, Op.OP_OUTPUTTOKENCOMMITMENT, range,
            false, false, delegatecallInputIndex !== undefined,
          )[0],
          category: extractVerifiedValuesFromTrace(
            fullTrace2, Op.OP_OUTPUTTOKENCATEGORY, range,
            false, false, delegatecallInputIndex !== undefined,
          )[0],
        };
      });
      if (nftFields.some((field) => field.bytecode !== undefined)) {
        derivedNftTransfers = [];
        stb.clearTokenContainerTransferNfts();
        for (let i = 0; i < nftOps.length; i++) {
          const lbc = nftFields[i].bytecode ?? dummyLbc;
          const commitment = nftFields[i].commitment ?? new Uint8Array(0);
          const capability = nftFields[i].category === undefined
            ? 'none' as const : host.parseNftCapability(nftFields[i].category!);
          stb.addTokenContainerTransferNft(
            nftOps[i].categoryId, lbc, commitment, capability, nftFields[i].outputSlot,
          );
          derivedNftTransfers.push({
            categoryId: nftOps[i].categoryId, lockingBytecode: lbc,
            commitment, capability,
          });
        }
      }
    }
  }

  phaseCheckpoint('transfers');

  return {
    derivedTransfers,
    derivedFtTransfers,
    derivedNftTransfers,
    satoshiAmountsFullyDerived,
    ftAmountsFullyDerived,
  };
}
