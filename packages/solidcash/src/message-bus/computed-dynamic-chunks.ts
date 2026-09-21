import { binToHex, vmNumberToBigInt, type AuthenticationProgramStateCommon } from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { parseChunkCommitment } from '@solidcash/utils';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import { preflightMessageBusBlockAssembly } from './preflight.js';

export interface ComputedDynamicChunkConvergence {
  repairs: number;
  rounds: number;
  ownedOutputs: readonly number[];
  outputs: readonly number[];
  authenticatedOutputs: readonly number[];
}

const isP2sh32 = (bytecode: Uint8Array | undefined): bytecode is Uint8Array => !!bytecode
  && bytecode.length === 35 && bytecode[0] === 0xaa && bytecode[1] === 0x20 && bytecode[34] === 0x87;

const isDynamicChunkCommitmentAtIndex = (commitmentHex: string, index: number): boolean => {
  try {
    const parsed = parseChunkCommitment(commitmentHex);
    return parsed.chunkIndex === index && parsed.chunkData.length > 0;
  } catch {
    return false;
  }
};

/**
 * Converge top-level dynamic-storage chunk commitments on the complete atomic graph.
 *
 * Local participant builders freeze an RMW chunk's prior commitment (`0001aa`) because isolated probes often
 * die before the route can expose the concat-derived replacement. Data-NFT length slots are already repaired by
 * `convergeMessageBusComputedResourceOutputs`; this helper applies the same complete-graph OTC equality authority
 * to compiler-published trailing chunk outputs so nonempty foreign RMW (aa→aabb) can settle under compose.
 *
 * Ownership is the compact trailing band of each balanced participant block. Only contiguous mutable NFTs of the
 * participant's category whose current or proposed commitment parses as a dynamic chunk at its ordinal are
 * candidates. Value-chunk continuations and fixed data-NFT slots are out of scope.
 */
export function convergeMessageBusComputedDynamicChunkOutputs(
  builder: TransactionBuilder,
): ComputedDynamicChunkConvergence {
  const assembly = preflightMessageBusBlockAssembly(builder);
  if (!assembly) return { repairs: 0, rounds: 0, ownedOutputs: [], outputs: [], authenticatedOutputs: [] };

  const owners = new Map<number, Set<number>>();
  const ordinals = new Map<number, number>();
  for (const block of assembly.blocks) {
    const trailingBase = block.blockLayout.trailingBase;
    if (trailingBase === undefined || trailingBase >= block.blockLayout.blockSize) continue;
    const trailingStart = block.base + trailingBase;
    const trailingEnd = block.base + block.blockLayout.blockSize;
    const category = builder.inputs[block.base]?.token?.category?.toLowerCase();
    if (category === undefined) continue;

    const observerInputs = new Set<number>();
    for (let inputIndex = block.base; inputIndex < trailingEnd; inputIndex += 1) {
      observerInputs.add(inputIndex);
    }

    let runStart = -1;
    let runLock = '';
    for (let outputIndex = trailingStart; outputIndex < trailingEnd; outputIndex += 1) {
      const output = builder.outputs[outputIndex];
      const lock = output?.to instanceof Uint8Array ? output.to
        : undefined;
      if (output?.token?.category?.toLowerCase() !== category
        || output.token.nft?.capability !== 'mutable'
        || output.token.amount !== 0n
        || !isP2sh32(lock)) {
        if (runStart >= 0) break;
        continue;
      }
      const lockHex = binToHex(lock);
      // Adjacent dynamic variables can share a category while using different chunk covenants. Their chunk
      // indices each begin at zero; adjacency alone is not a storage-resource identity.
      if (runStart >= 0 && lockHex !== runLock) runStart = -1;
      const commitment = output.token.nft.commitment ?? '';
      const ordinal = runStart < 0 ? 0 : outputIndex - runStart;
      const placeholder = commitment === '' || commitment === '00';
      if (!placeholder && !isDynamicChunkCommitmentAtIndex(commitment, ordinal)) {
        if (runStart >= 0) break;
        continue;
      }
      if (runStart < 0) {
        runStart = outputIndex;
        runLock = lockHex;
      }
      ordinals.set(outputIndex, ordinal);
      const inputs = owners.get(outputIndex) ?? new Set<number>();
      for (const inputIndex of observerInputs) inputs.add(inputIndex);
      owners.set(outputIndex, inputs);
    }
  }

  const ownedOutputs = [...owners.keys()].sort((a, b) => a - b);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_DYNAMIC_CHUNK_CONVERGE === '1') {
    console.error('dynamic-chunk-converge-owners', JSON.stringify({
      blocks: assembly.blocks.map((block) => ({
        base: block.base,
        blockSize: block.blockLayout.blockSize,
        trailingBase: block.blockLayout.trailingBase,
        trailingCapacity: block.blockLayout.trailingCapacity,
      })),
      ownedOutputs,
      placeholders: ownedOutputs.map((outputIndex) => ({
        outputIndex,
        commitment: builder.outputs[outputIndex]?.token?.nft?.commitment ?? '',
        category: String(builder.outputs[outputIndex]?.token?.category ?? '').slice(0, 16),
        outputLock: builder.outputs[outputIndex]?.to instanceof Uint8Array
          ? binToHex(builder.outputs[outputIndex].to as Uint8Array).slice(0, 32) : '',
      })),
    }));
  }
  if (owners.size === 0) return {
    repairs: 0, rounds: 0, ownedOutputs, outputs: [], authenticatedOutputs: [],
  };

  const changedOutputs = new Set<number>();
  const maximumRounds = owners.size * 2 + 1;
  let repairs = 0;
  for (let round = 1; round <= maximumRounds; round += 1) {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const commitmentProposals = new Map<number, Uint8Array>();
    const inputIndices = new Set([...owners.values()].flatMap((indices) => [...indices]));
    for (const inputIndex of inputIndices) {
      const vm = createVirtualMachineBch2026ForProvider(builder.provider, {
        opcodes: new Set([Op.OP_OUTPUTTOKENCOMMITMENT]),
        beforeOperation: (unknownState) => {
          const state = unknownState as AuthenticationProgramStateCommon;
          const opcode = state.instructions[state.ip]?.opcode;
          const nextOpcode = state.instructions[state.ip + 1]?.opcode;
          const tightEquality = nextOpcode === Op.OP_EQUALVERIFY
            || (nextOpcode === Op.OP_EQUAL
              && state.instructions[state.ip + 2]?.opcode === Op.OP_VERIFY);
          if (opcode !== Op.OP_OUTPUTTOKENCOMMITMENT
            || !tightEquality
            || state.controlStack.some((frame) => frame === false)
            || state.stack.length < 2) return;
          let outputIndex: number;
          try {
            outputIndex = Number(vmNumberToBigInt(state.stack[state.stack.length - 1]));
          } catch { return; }
          if (!owners.get(outputIndex)?.has(inputIndex)) return;
          const expected = state.stack[state.stack.length - 2];
          if (expected.length === 0 || expected.length > 128) return;
          const expectedHex = binToHex(expected);
          // Reject non-chunk OTC pairs (scalar data-NFT lengths, empty pads) before they poison the run.
          // The ordinal was measured within the same locking-bytecode run, not across adjacent variables.
          if (!isDynamicChunkCommitmentAtIndex(expectedHex, ordinals.get(outputIndex)!)) return;
          const prior = commitmentProposals.get(outputIndex);
          if (prior && binToHex(prior) !== expectedHex) {
            throw new Error(
              `messageBus: dynamic-chunk covenants disagree on output ${outputIndex} commitment`,
            );
          }
          commitmentProposals.set(outputIndex, expected.slice());
        },
      });
      vm.evaluate({ inputIndex, sourceOutputs, transaction });
    }

    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_DYNAMIC_CHUNK_CONVERGE === '1') {
      console.error('dynamic-chunk-converge-round', JSON.stringify({
        round,
        observers: [...inputIndices],
        proposals: [...commitmentProposals.entries()].map(([outputIndex, expected]) => ({
          outputIndex,
          expected: binToHex(expected),
          current: builder.outputs[outputIndex]?.token?.nft?.commitment ?? '',
        })),
      }));
    }
    let changed = false;
    for (const [outputIndex, expected] of commitmentProposals) {
      const output = builder.outputs[outputIndex];
      if (!output?.token?.nft || output.token.nft.capability !== 'mutable') continue;
      const expectedHex = binToHex(expected);
      if (output.token.nft.commitment === expectedHex) continue;
      output.token.nft.commitment = expectedHex;
      changedOutputs.add(outputIndex);
      repairs += 1;
      changed = true;
    }
    if (!changed) {
      return {
        repairs,
        rounds: round,
        ownedOutputs,
        outputs: [...changedOutputs].sort((a, b) => a - b),
        authenticatedOutputs: [...commitmentProposals.keys()].sort((a, b) => a - b),
      };
    }
  }
  throw new Error(
    `messageBus: dynamic-chunk outputs did not converge after ${maximumRounds} complete-graph passes`,
  );
}

/**
 * Local participant builders report incomplete dynamic chunks from frozen `00` probe placeholders. Complete-graph
 * OTC convergence may already have replaced those commitments on `builder`. Only a placeholder whose chunk
 * equality actually ran is an incomplete active write; an unselected route arm may reserve a `00` pad without
 * executing its write. Final BCH preflight remains the authority when a prior covenant prevents observation.
 */
export function dynamicChunkPlaceholdersRemain(
  builder: TransactionBuilder,
  convergence: ComputedDynamicChunkConvergence,
  incomplete: readonly { participant: number; variable: string; resolved: number; total: number }[],
): boolean {
  if (incomplete.length === 0) return false;
  if (convergence.ownedOutputs.length === 0) return true;
  return convergence.authenticatedOutputs.some((outputIndex) => {
    const commitment = builder.outputs[outputIndex]?.token?.nft?.commitment ?? '';
    return commitment === '' || commitment === '00';
  });
}
