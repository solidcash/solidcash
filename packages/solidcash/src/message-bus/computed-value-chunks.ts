import { binToHex, vmNumberToBigInt, type AuthenticationProgramStateCommon } from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { VALUE_CHUNK_SIZE, VALUE_HEAD_SIZE, VALUE_INLINE_LIMIT } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import {
  persistValueChunkLock, valueChunkIndexFromCommitment, valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from '../stateful/StatefulTransactionBuilder.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../utils.js';
import { refuseVmExtractedRepairsIfRecipe } from './materialization-mode.js';
import { preflightMessageBusBlockAssembly } from './preflight.js';

export interface ComputedValueChunkConvergence {
  repairs: number;
  rounds: number;
  ownedOutputs: readonly number[];
  outputs: readonly number[];
}

const isP2sh32 = (bytecode: Uint8Array | undefined): bytecode is Uint8Array => !!bytecode
  && bytecode.length === 35 && bytecode[0] === 0xaa && bytecode[1] === 0x20 && bytecode[34] === 0x87;

export interface ComputedValueChunkValueObservation {
  write: ValueChunkWriteDescriptor;
  value: Uint8Array;
  lockingBytecode: Uint8Array;
  chunkCount: number;
}

export interface IndexedComputedValueChunkValueObservation extends ComputedValueChunkValueObservation {
  inputIndex: number;
}

/**
 * Match a VM-exposed value to an exact compiler-described write at the chunk-count covenant.
 * A large stack item alone is not authority: its root-addressed lock and the expected count must both be
 * present in the same executing frame. The final transaction still has to pass the complete BCH VM preflight.
 */
export function matchComputedValueChunkStack(
  stack: readonly Uint8Array[], writes: readonly ValueChunkWriteDescriptor[],
): ComputedValueChunkValueObservation[] {
  if (stack.length < 3 || writes.length === 0) return [];
  const counts = new Set<number>();
  for (const operand of stack.slice(-2)) {
    try {
      const count = Number(vmNumberToBigInt(operand));
      if (Number.isSafeInteger(count) && count > 0) counts.add(count);
    } catch { /* Not a minimally encoded count. */ }
  }
  if (counts.size === 0) return [];
  const locks = new Set(stack.filter(isP2sh32).map(binToHex));
  if (locks.size === 0) return [];
  const found: ComputedValueChunkValueObservation[] = [];
  const seen = new Set<string>();
  for (const write of writes) {
    for (const value of stack) {
      if (value.length <= VALUE_INLINE_LIMIT) continue;
      const chunkCount = Math.ceil((value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
      if (!counts.has(chunkCount)) continue;
      const lockingBytecode = persistValueChunkLock(write.categoryId, value, write);
      if (!lockingBytecode || !locks.has(binToHex(lockingBytecode))) continue;
      const identity = `${valueChunkWriteResourceIdentity(write)}:${binToHex(lockingBytecode)}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      found.push({ write, value: value.slice(), lockingBytecode, chunkCount });
    }
  }
  return found;
}

/** Observe only executed chunk-count equalities on the complete graph; retain no VM history. */
export function discoverMessageBusComputedValueChunkValues(
  builder: TransactionBuilder,
  targets: readonly { inputIndex: number; write: ValueChunkWriteDescriptor }[],
): IndexedComputedValueChunkValueObservation[] {
  if (targets.length === 0) return [];
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const byInput = new Map<number, ValueChunkWriteDescriptor[]>();
  for (const target of targets) {
    if (!Number.isSafeInteger(target.inputIndex) || target.inputIndex < 0
      || target.inputIndex >= transaction.inputs.length) continue;
    const writes = byInput.get(target.inputIndex) ?? [];
    writes.push(target.write);
    byInput.set(target.inputIndex, writes);
  }
  const observations = new Map<string, IndexedComputedValueChunkValueObservation>();
  for (const [inputIndex, writes] of byInput) {
    const vm = createVirtualMachineBch2026ForProvider(builder.provider, {
      opcodes: new Set([Op.OP_EQUALVERIFY]),
      beforeOperation: (unknownState) => {
        const state = unknownState as AuthenticationProgramStateCommon;
        if (state.instructions[state.ip]?.opcode !== Op.OP_EQUALVERIFY
          || state.instructions[state.ip - 1]?.opcode !== Op.OP_DROP
          || state.controlStack.some((frame) => frame === false)) return;
        for (const observation of matchComputedValueChunkStack(state.stack, writes)) {
          const identity = `${inputIndex}:${valueChunkWriteResourceIdentity(observation.write)}`;
          const prior = observations.get(identity);
          if (prior && binToHex(prior.value) !== binToHex(observation.value)) {
            throw new Error(`messageBus: computed value-chunk resource '${identity}' has ambiguous VM values`);
          }
          observations.set(identity, { ...observation, inputIndex });
        }
      },
    });
    vm.evaluate({ inputIndex, sourceOutputs, transaction });
  }
  return [...observations.values()];
}

type ValueChunkRepairBuilder = {
  outputs: ReadonlyArray<{
    to?: string | Uint8Array;
    token?: { nft?: { commitment: string; capability?: string } };
  }>;
};

/**
 * Count OTC proposals that would mutate builder outputs.
 * Recipe refuse uses this count so already-matching observations are no-ops.
 */
export function countWouldApplyValueChunkRepairs(
  builder: ValueChunkRepairBuilder,
  lockingBytecodeProposals: ReadonlyMap<number, Uint8Array>,
  commitmentProposals: ReadonlyMap<number, Uint8Array>,
): number {
  let wouldApply = 0;
  for (const [outputIndex, expected] of lockingBytecodeProposals) {
    const output = builder.outputs[outputIndex];
    if (!output) continue;
    const current = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
    if (current === undefined) {
      wouldApply += 1;
      continue;
    }
    if (binToHex(current) !== binToHex(expected)) wouldApply += 1;
  }
  for (const [outputIndex, expected] of commitmentProposals) {
    const output = builder.outputs[outputIndex];
    if (!output?.token?.nft || output.token.nft.capability !== 'mutable') continue;
    if (output.token.nft.commitment !== binToHex(expected)) wouldApply += 1;
  }
  return wouldApply;
}

/** F9′: refuse VM-mined value-chunk repairs that would change state under recipe. */
export function gateWouldApplyValueChunkRepairsIfRecipe(
  builder: ValueChunkRepairBuilder,
  lockingBytecodeProposals: ReadonlyMap<number, Uint8Array>,
  commitmentProposals: ReadonlyMap<number, Uint8Array>,
): number {
  const wouldApply = countWouldApplyValueChunkRepairs(
    builder, lockingBytecodeProposals, commitmentProposals,
  );
  refuseVmExtractedRepairsIfRecipe(wouldApply);
  return wouldApply;
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
        || valueChunkIndexFromCommitment(first.token.nft.commitment) !== 0) continue;
      for (let outputIndex = outputBase; outputIndex < trailingEnd; outputIndex += 1) {
        const output = builder.outputs[outputIndex];
        const chunkIndex = outputIndex - outputBase;
        if (output?.token?.category !== category || output.token.nft?.capability !== 'mutable'
          || output.token.amount !== 0n
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
  const ownedOutputs = [...owners.keys()].sort((a, b) => a - b);
  if (owners.size === 0) return { repairs: 0, rounds: 0, ownedOutputs, outputs: [] };

  const changedOutputs = new Set<number>();
  const maximumRounds = owners.size * 2 + 1;
  let repairs = 0;
  for (let round = 1; round <= maximumRounds; round += 1) {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const lockingBytecodeProposals = new Map<number, Uint8Array>();
    const commitmentProposals = new Map<number, Uint8Array>();
    const inputIndices = new Set([...owners.values()].flatMap((indices) => [...indices]));
    for (const inputIndex of inputIndices) {
      const vm = createVirtualMachineBch2026ForProvider(builder.provider, {
        opcodes: new Set([Op.OP_OUTPUTBYTECODE, Op.OP_OUTPUTTOKENCOMMITMENT]),
        beforeOperation: (unknownState) => {
          const state = unknownState as AuthenticationProgramStateCommon;
          const opcode = state.instructions[state.ip]?.opcode;
          const nextOpcode = state.instructions[state.ip + 1]?.opcode;
          const tightEquality = nextOpcode === Op.OP_EQUALVERIFY
            || (nextOpcode === Op.OP_EQUAL
              && state.instructions[state.ip + 2]?.opcode === Op.OP_VERIFY);
          if ((opcode !== Op.OP_OUTPUTBYTECODE && opcode !== Op.OP_OUTPUTTOKENCOMMITMENT)
            || !tightEquality
            || state.controlStack.some((frame) => frame === false)
            || state.stack.length < 2) return;
          let outputIndex: number;
          try {
            outputIndex = Number(vmNumberToBigInt(state.stack[state.stack.length - 1]));
          } catch { return; }
          if (!owners.get(outputIndex)?.has(inputIndex)) return;
          const expected = state.stack[state.stack.length - 2];
          if (opcode === Op.OP_OUTPUTBYTECODE && !isP2sh32(expected)) return;
          if (opcode === Op.OP_OUTPUTTOKENCOMMITMENT && expected.length > 128) return;
          const proposals = opcode === Op.OP_OUTPUTBYTECODE
            ? lockingBytecodeProposals : commitmentProposals;
          const prior = proposals.get(outputIndex);
          if (prior && binToHex(prior) !== binToHex(expected)) {
            throw new Error(
              `messageBus: computed-value covenants disagree on output ${outputIndex} `
              + (opcode === Op.OP_OUTPUTBYTECODE ? 'locking bytecode' : 'commitment'),
            );
          }
          proposals.set(outputIndex, expected.slice());
        },
      });
      vm.evaluate({ inputIndex, sourceOutputs, transaction });
    }
    gateWouldApplyValueChunkRepairsIfRecipe(
      builder, lockingBytecodeProposals, commitmentProposals,
    );
    let changed = false;
    for (const [outputIndex, expected] of lockingBytecodeProposals) {
      const output = builder.outputs[outputIndex];
      if (!output) continue;
      const current = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
      if (binToHex(current) === binToHex(expected)) continue;
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
    if (!changed) return {
      repairs,
      rounds: round,
      ownedOutputs,
      outputs: [...changedOutputs].sort((a, b) => a - b),
    };
  }
  throw new Error(
    `messageBus: computed value-chunk outputs did not converge after ${maximumRounds} complete-graph passes`,
  );
}
