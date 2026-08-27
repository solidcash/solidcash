import { binToHex, vmNumberToBigInt, type AuthenticationProgramStateCommon } from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import type { FunctionArgument } from '../Argument.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import {
  computedValueChunkOutputPin, isValidComputedValueChunkCommitmentEncoding,
} from '../stateful/computed-value-chunk-pin.js';
export {
  computedValueChunkOutputIndexInBand, computedValueChunkOutputPin,
  isValidComputedValueChunkCommitmentEncoding,
} from '../stateful/computed-value-chunk-pin.js';
import { valueChunkIndexFromCommitment } from '../stateful/StatefulTransactionBuilder.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import { preflightMessageBusBlockAssembly } from './preflight.js';

const isP2sh32 = (bytecode: Uint8Array | undefined): bytecode is Uint8Array => !!bytecode
  && bytecode.length === 35 && bytecode[0] === 0xaa && bytecode[1] === 0x20 && bytecode[34] === 0x87;

export interface ComputedValueChunkConvergence {
  repairs: number;
  rounds: number;
  ownedOutputs: readonly number[];
  outputs: readonly number[];
}

/**
 * Retire provisional outputs after the compiler has authenticated every member of their final continuation run.
 *
 * The P2SH32 lock commits to the collection identity, resolved slot, and value root. Once a complete zero-based
 * run is proven, another mutable output with the same category and lock is necessarily a duplicate of that value
 * version, even when its placeholder commitment is malformed and therefore cannot be classified as a chunk.
 */
export function retireOutputsOutsideAuthenticatedValueChunkRuns(
  outputs: Array<{
    to?: string | Uint8Array;
    amount?: bigint;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: string };
    };
  }>,
  runs: readonly (readonly number[])[],
): number[] {
  const authoritativeByRoot = new Map<string, Set<number>>();
  for (const indices of runs) {
    if (indices.length === 0) continue;
    let root: string | undefined;
    let valid = true;
    for (const [offset, outputIndex] of indices.entries()) {
      if (outputIndex !== indices[0] + offset) { valid = false; break; }
      const output = outputs[outputIndex];
      const lock = output?.to instanceof Uint8Array ? output.to : undefined;
      if (!isP2sh32(lock)
        || output.token?.nft?.capability !== 'mutable'
        || valueChunkIndexFromCommitment(output.token.nft.commitment ?? '') !== offset) {
        valid = false;
        break;
      }
      const candidate = `${output.token.category ?? ''}:${binToHex(lock)}`;
      if (root !== undefined && candidate !== root) { valid = false; break; }
      root = candidate;
    }
    if (!valid || root === undefined) continue;
    const authoritative = authoritativeByRoot.get(root) ?? new Set<number>();
    for (const index of indices) authoritative.add(index);
    authoritativeByRoot.set(root, authoritative);
  }

  const retired: number[] = [];
  for (const [outputIndex, output] of outputs.entries()) {
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    if (!isP2sh32(lock) || output.token?.nft?.capability !== 'mutable') continue;
    const root = `${output.token.category ?? ''}:${binToHex(lock)}`;
    const authoritative = authoritativeByRoot.get(root);
    if (authoritative === undefined || authoritative.has(outputIndex)) continue;
    outputs[outputIndex] = {
      to: Uint8Array.of(0x51),
      amount: output.amount !== undefined && output.amount > 0n ? output.amount : 1000n,
    };
    retired.push(outputIndex);
  }
  return retired;
}

/**
 * Converge computed value-chunk outputs which exist only in the complete atomic graph.
 *
 * Authority is deliberately narrow: a compiler ABI witness nominates one absolute continuation coordinate,
 * that coordinate must be inside the executing participant's declared trailing region, and the executing VM
 * must expose each replacement as the expected side of the compiler's tight output equality covenants.
 */
export function convergeMessageBusComputedValueChunkOutputs(
  builder: TransactionBuilder,
): ComputedValueChunkConvergence {
  const assembly = preflightMessageBusBlockAssembly(builder);
  if (!assembly) return { repairs: 0, rounds: 0, ownedOutputs: [], outputs: [] };
  const owners = new Map<number, Set<number>>();
  const outputBaseByInput = new Map<number, number>();
  for (const block of assembly.blocks) {
    const trailingBase = block.blockLayout.trailingBase;
    if (trailingBase === undefined || trailingBase >= block.blockLayout.blockSize) continue;
    const trailingStart = block.base + trailingBase;
    // The derived assembly's blockSize is the compact physical span. Some proxy masters retain a zero maximum
    // trailingCapacity even after the implementation route has materialized a non-empty compact suffix; the
    // half-open interval from trailingBase to blockSize is nevertheless exact, compiler-published ownership.
    const trailingEnd = block.base + block.blockLayout.blockSize;
    for (let inputIndex = block.base; inputIndex < block.base + block.blockLayout.blockSize; inputIndex += 1) {
      const unlocker = builder.inputs[inputIndex]?.unlocker as {
        abiFunction?: { name?: string; inputs?: readonly { name: string }[] };
        params?: readonly FunctionArgument[];
      } | undefined;
      const argumentIndex = unlocker?.abiFunction?.inputs?.findIndex(
        (input) => input.name === '__internal__valueChunkOutputBase',
      ) ?? -1;
      const value = argumentIndex < 0 ? undefined : unlocker?.params?.[argumentIndex];
      if (typeof value !== 'bigint') continue;
      const outputBase = Number(value);
      if (!Number.isSafeInteger(outputBase) || outputBase < trailingStart || outputBase >= trailingEnd) continue;
      const first = builder.outputs[outputBase];
      const category = first?.token?.category;
      if (category === undefined || first.token?.nft?.capability !== 'mutable'
        || first.token.amount !== 0n
        || !isValidComputedValueChunkCommitmentEncoding(first.token.nft.commitment)
        || valueChunkIndexFromCommitment(first.token.nft.commitment) !== 0) continue;
      outputBaseByInput.set(inputIndex, outputBase);
      for (let outputIndex = outputBase; outputIndex < trailingEnd; outputIndex += 1) {
        const output = builder.outputs[outputIndex];
        const chunkIndex = outputIndex - outputBase;
        if (output?.token?.category !== category || output.token.nft?.capability !== 'mutable'
          || output.token.amount !== 0n
          || !isValidComputedValueChunkCommitmentEncoding(output.token.nft.commitment)
          || valueChunkIndexFromCommitment(output.token.nft.commitment) !== chunkIndex) break;
        // A computed run is intentionally born with the builder's non-P2SH placeholder lock: its exact P2SH32
        // lock exists only on the complete graph VM stack below. Requiring the output to already be P2SH32 makes
        // convergence circular. Ownership instead comes from the compiler witness, bounded trailing range, token
        // category/capability, and contiguous self-describing chunk indices; proposals remain P2SH32-only.
        const inputs = owners.get(outputIndex) ?? new Set<number>();
        inputs.add(inputIndex);
        owners.set(outputIndex, inputs);
      }
    }
  }
  if (owners.size === 0) return { repairs: 0, rounds: 0, ownedOutputs: [], outputs: [] };

  const changedOutputs = new Set<number>();
  const confirmedOutputs = new Set<number>();
  const maximumRounds = owners.size * 2 + 1;
  let repairs = 0;
  for (let round = 1; round <= maximumRounds; round += 1) {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const lockingBytecodeProposals = new Map<number, Uint8Array>();
    const commitmentProposals = new Map<number, Uint8Array>();
    const roundConfirmedByInput = new Map<number, Set<number>>();
    const inputIndices = new Set([...owners.values()].flatMap((indices) => [...indices]));
    for (const inputIndex of inputIndices) {
      const outputBase = outputBaseByInput.get(inputIndex);
      if (outputBase === undefined) continue;
      const pinnedOutputs = new Set<number>();
      const vm = createVirtualMachineBch2026ForProvider(builder.provider, {
        opcodes: new Set([Op.OP_OUTPUTBYTECODE, Op.OP_OUTPUTTOKENCOMMITMENT]),
        beforeOperation: (unknownState) => {
          const state = unknownState as AuthenticationProgramStateCommon;
          const opcode = state.instructions[state.ip]?.opcode;
          if (opcode !== Op.OP_OUTPUTBYTECODE && opcode !== Op.OP_OUTPUTTOKENCOMMITMENT) return;
          if (opcode === Op.OP_OUTPUTBYTECODE) {
            const pin = computedValueChunkOutputPin(state, outputBase);
            if (!pin || !owners.get(pin.outputIndex)?.has(inputIndex)) return;
            pinnedOutputs.add(pin.outputIndex);
            confirmedOutputs.add(pin.outputIndex);
            const confirmed = roundConfirmedByInput.get(inputIndex) ?? new Set<number>();
            confirmed.add(pin.outputIndex);
            roundConfirmedByInput.set(inputIndex, confirmed);
            const prior = lockingBytecodeProposals.get(pin.outputIndex);
            if (prior && binToHex(prior) !== binToHex(pin.lockingBytecode)) {
              throw new Error(
                `messageBus: computed-value covenants disagree on output ${pin.outputIndex} locking bytecode`,
              );
            }
            lockingBytecodeProposals.set(pin.outputIndex, pin.lockingBytecode.slice());
            return;
          }
          if (state.instructions[state.ip + 1]?.opcode !== Op.OP_EQUALVERIFY
            || state.controlStack.some((frame) => frame === false)
            || state.stack.length < 2) return;
          let outputIndex: number;
          try {
            outputIndex = Number(vmNumberToBigInt(state.stack[state.stack.length - 1]));
          } catch { return; }
          if (!owners.get(outputIndex)?.has(inputIndex) || !pinnedOutputs.has(outputIndex)) return;
          const expected = state.stack[state.stack.length - 2];
          if (!isValidComputedValueChunkCommitmentEncoding(binToHex(expected))
            || valueChunkIndexFromCommitment(binToHex(expected)) !== outputIndex - outputBase) return;
          const prior = commitmentProposals.get(outputIndex);
          if (prior && binToHex(prior) !== binToHex(expected)) {
            throw new Error(
              `messageBus: computed-value covenants disagree on output ${outputIndex} commitment`,
            );
          }
          commitmentProposals.set(outputIndex, expected.slice());
        },
      });
      vm.evaluate({ inputIndex, sourceOutputs, transaction });
    }
    let changed = false;
    for (const [outputIndex, expected] of lockingBytecodeProposals) {
      const output = builder.outputs[outputIndex];
      if (!output || !(output.to instanceof Uint8Array) || binToHex(output.to) === binToHex(expected)) continue;
      output.to = expected;
      changedOutputs.add(outputIndex);
      repairs += 1;
      changed = true;
    }
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
    const completeRuns = [...roundConfirmedByInput.entries()].flatMap(([inputIndex, confirmed]) => {
      const outputBase = outputBaseByInput.get(inputIndex);
      if (outputBase === undefined) return [];
      const owned: number[] = [];
      for (let outputIndex = outputBase; owners.get(outputIndex)?.has(inputIndex); outputIndex += 1) {
        owned.push(outputIndex);
      }
      return owned.length > 0 && owned.every((outputIndex) => confirmed.has(outputIndex)) ? [owned] : [];
    });
    const retired = retireOutputsOutsideAuthenticatedValueChunkRuns(builder.outputs, completeRuns);
    for (const outputIndex of retired) {
      changedOutputs.add(outputIndex);
      repairs += 1;
      changed = true;
    }
    if (!changed) return {
      repairs,
      rounds: round,
      ownedOutputs: [...confirmedOutputs].sort((a, b) => a - b),
      outputs: [...changedOutputs].sort((a, b) => a - b),
    };
  }
  throw new Error(
    `messageBus: computed value-chunk outputs did not converge after ${maximumRounds} complete-graph passes`,
  );
}
