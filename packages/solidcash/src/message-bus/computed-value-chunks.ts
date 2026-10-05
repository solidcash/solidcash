import { binToHex, hexToBin, vmNumberToBigInt, type AuthenticationProgramStateCommon } from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { VALUE_CHUNK_SIZE, VALUE_HEAD_SIZE, VALUE_INLINE_LIMIT } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import {
  chunksFromValue, persistValueChunkLock, valueChunkIndexFromCommitment, valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from '../stateful/StatefulTransactionBuilder.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../utils.js';
import { gateWouldApplyRepairsIfRecipe } from './materialization-mode.js';
import {
  MonotoneCell,
  finalizeMonotonePass,
  freezeGeometry,
  recordMonotonePass,
} from './monotone-lattice.js';
import {
  preflightMessageBusBlockAssembly, provenSourceRevertIndependentOfRepair, type RefusedOutputRepair,
} from './preflight.js';
import { selectActiveConstraintCandidate } from '../stateful/value-chunk-persist.js';
import { builderConstraintFixpoint } from './constraint-fixpoint-session.js';
import {
  computedValueChunkOutputIndexInBand,
  computedValueChunkOutputPin,
  isValidComputedValueChunkCommitmentEncoding,
} from '../stateful/computed-value-chunk-pin.js';
export {
  computedValueChunkOutputIndexInBand,
  computedValueChunkOutputPin,
  isValidComputedValueChunkCommitmentEncoding,
} from '../stateful/computed-value-chunk-pin.js';

export interface ComputedValueChunkConvergence {
  repairs: number;
  rounds: number;
  ownedOutputs: readonly number[];
  outputs: readonly number[];
}

const isP2sh32 = (bytecode: Uint8Array | undefined): bytecode is Uint8Array => !!bytecode
  && bytecode.length === 35 && bytecode[0] === 0xaa && bytecode[1] === 0x20 && bytecode[34] === 0x87;

/** Retire duplicate provisional outputs only when a complete zero-based continuation run proves its owner. */
export function retireOutputsOutsideAuthenticatedValueChunkRuns(
  outputs: Array<{
    to?: string | Uint8Array;
    amount?: bigint;
    token?: { category?: string; nft?: { capability?: string; commitment?: string } };
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
        || !isValidComputedValueChunkCommitmentEncoding(output.token.nft.commitment ?? '')
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
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
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

export interface ComputedValueChunkValueObservation {
  write: ValueChunkWriteDescriptor;
  value: Uint8Array;
  lockingBytecode: Uint8Array;
  chunkCount: number;
}

function traceComputedValueChunkObservation(
  inputIndex: number,
  observation: ComputedValueChunkValueObservation,
): void {
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS !== '1') return;
  console.error('computed-value-convergence-observation', JSON.stringify({
    inputIndex, resource: valueChunkWriteResourceIdentity(observation.write),
    bytes: observation.value.length, lock: binToHex(observation.lockingBytecode),
  }));
}

export interface IndexedComputedValueChunkValueObservation extends ComputedValueChunkValueObservation {
  inputIndex: number;
  requiresMaterialization: boolean;
}

/**
 * Match a VM-exposed value to an exact compiler-described write at the chunk-count covenant.
 * A large stack item alone is not authority: its root-addressed lock and the expected count must both be
 * present in the same executing frame. The final transaction still has to pass the complete BCH VM preflight.
 */
export function matchComputedValueChunkStack(
  stack: readonly Uint8Array[], writes: readonly ValueChunkWriteDescriptor[],
): ComputedValueChunkValueObservation[] {
  // `emitSortedValueChunkPin` reaches its terminal count equality with the compact suffix
  // `[completeValue, persistenceLock, expectedCount, actualCount]`. Other values and P2SH32 locks may remain
  // alive below that suffix (notably call arguments and sibling resources); scanning the whole stack can pair one
  // of those stale values with this resource's count and silently replace the compiler-published value.
  if (stack.length < 4 || writes.length === 0) return [];
  const value = stack[stack.length - 4];
  const frameLock = stack[stack.length - 3];
  if (value.length <= VALUE_INLINE_LIMIT || !isP2sh32(frameLock)) return [];
  const counts = new Set<number>();
  for (const operand of stack.slice(-2)) {
    try {
      const count = Number(vmNumberToBigInt(operand));
      if (Number.isSafeInteger(count) && count > 0) counts.add(count);
    } catch { /* Not a minimally encoded count. */ }
  }
  if (counts.size === 0) return [];
  const lockHex = binToHex(frameLock);
  const found: ComputedValueChunkValueObservation[] = [];
  for (const write of writes) {
    const chunkCount = Math.ceil((value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
    if (!counts.has(chunkCount)) continue;
    const lockingBytecode = persistValueChunkLock(write.categoryId, value, write);
    if (!lockingBytecode || binToHex(lockingBytecode) !== lockHex) continue;
    found.push({ write, value: value.slice(), lockingBytecode, chunkCount });
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
    console.error('computed-value-count-frame', JSON.stringify({
      counts: [...counts],
      locks: [lockHex],
      writes: writes.map((write) => ({
        resource: valueChunkWriteResourceIdentity(write),
        candidates: stack.filter((candidate) => candidate.length > VALUE_INLINE_LIMIT).map((candidate) => ({
          bytes: candidate.length,
          value: binToHex(candidate),
          lock: binToHex(persistValueChunkLock(write.categoryId, candidate, write) ?? new Uint8Array()),
        })),
      })),
      matches: found.map((match) => ({
        resource: valueChunkWriteResourceIdentity(match.write),
        bytes: match.value.length,
        lock: binToHex(match.lockingBytecode),
      })),
    }));
  }
  return found;
}

/** Match a complete value while generated read reconstruction verifies one of its continuation chunks. */
export function matchComputedValueChunkReconstructionStack(
  stack: readonly Uint8Array[], writes: readonly ValueChunkWriteDescriptor[],
): ComputedValueChunkValueObservation[] {
  const locks = new Set(stack.filter(isP2sh32).map(binToHex));
  if (locks.size === 0) return [];
  const found: ComputedValueChunkValueObservation[] = [];
  for (const write of writes) {
    for (const value of stack) {
      if (value.length <= VALUE_INLINE_LIMIT) continue;
      const chunkCount = Math.ceil((value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
      if (chunkCount < 1 || chunkCount > write.outputCount) continue;
      const lockingBytecode = persistValueChunkLock(write.categoryId, value, write);
      if (!lockingBytecode || !locks.has(binToHex(lockingBytecode))) continue;
      found.push({ write, value: value.slice(), lockingBytecode, chunkCount });
    }
  }
  return found.filter((candidate, index, all) => all.findIndex((prior) => (
    valueChunkWriteResourceIdentity(prior.write) === valueChunkWriteResourceIdentity(candidate.write)
      && binToHex(prior.value) === binToHex(candidate.value)
  )) === index);
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
    const recordObservation = (
      observation: ComputedValueChunkValueObservation, requiresMaterialization: boolean,
    ): void => {
      const identity = `${inputIndex}:${valueChunkWriteResourceIdentity(observation.write)}`;
      const prior = observations.get(identity);
      const candidate = { ...observation, inputIndex, requiresMaterialization };
      if (prior && binToHex(prior.value) !== binToHex(observation.value)
        && prior.requiresMaterialization === candidate.requiresMaterialization) {
        throw new Error(`messageBus: computed value-chunk resource '${identity}' has ambiguous VM values`);
      }
      if (!prior || candidate.requiresMaterialization || !prior.requiresMaterialization) {
        observations.set(identity, candidate);
      }
    };
    const recordTerminalCountFrame = (state: AuthenticationProgramStateCommon): void => {
      const verifyIp = state.instructions[state.ip]?.opcode === Op.OP_EQUALVERIFY
        ? state.ip : state.instructions[state.ip - 1]?.opcode === Op.OP_EQUALVERIFY ? state.ip - 1 : -1;
      if (verifyIp < 1 || state.instructions[verifyIp - 1]?.opcode !== Op.OP_DROP
        || state.controlStack.some((frame) => frame === false)) return;
      for (const observation of matchComputedValueChunkStack(state.stack, writes)) {
        let actualCount = -1;
        try {
          actualCount = Number(vmNumberToBigInt(state.stack[state.stack.length - 1]!));
        } catch { /* A non-numeric actual count is necessarily unsatisfied. */ }
        recordObservation(observation, actualCount !== observation.chunkCount);
      }
    };
    const vm = createVirtualMachineBch2026ForProvider(builder.provider, {
      opcodes: new Set([Op.OP_EQUALVERIFY]),
      beforeOperation: (unknownState) => {
        const state = unknownState as AuthenticationProgramStateCommon;
        recordTerminalCountFrame(state);
        if (state.instructions[state.ip]?.opcode === Op.OP_EQUALVERIFY
          && state.instructions[state.ip - 1]?.opcode === Op.OP_CAT
          && !state.controlStack.some((frame) => frame === false)) {
          for (const observation of matchComputedValueChunkReconstructionStack(state.stack, writes)) {
            recordObservation(observation, true);
          }
        }
      },
    });
    const terminal = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as AuthenticationProgramStateCommon;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1' && (terminal as { error?: string }).error !== undefined) {
      console.error('computed-value-terminal-frame', JSON.stringify({
        inputIndex,
        ip: terminal.ip,
        opcode: terminal.instructions[terminal.ip]?.opcode,
        priorOpcode: terminal.instructions[terminal.ip - 1]?.opcode,
        priorPriorOpcode: terminal.instructions[terminal.ip - 2]?.opcode,
        error: (terminal as { error?: string }).error,
        suffix: terminal.stack.slice(-4).map((item) => ({ bytes: item.length, value: binToHex(item) })),
        controlFrames: terminal.controlStack.map((frame) => typeof frame === 'object' && frame !== null
          ? (() => {
            const invoked = frame as { ip?: number; instructions?: readonly { opcode: number }[] };
            return {
              ip: invoked.ip,
              count: invoked.instructions?.length,
              opcode: invoked.ip === undefined ? undefined : invoked.instructions?.[invoked.ip]?.opcode,
              priorOpcode: invoked.ip === undefined ? undefined : invoked.instructions?.[invoked.ip - 1]?.opcode,
            };
          })() : frame),
      }));
    }
    // Libauth returns the pre-operation stack for a failing VERIFY, but does not dispatch the instrumentation
    // callback for that opcode. Computed outputs intentionally begin as placeholders, so their first authenticated
    // count frame is commonly this terminal failure. Apply the identical frame matcher to the returned state;
    // successful executions were already observed by the callback and coalesce under the same resource identity.
    recordTerminalCountFrame(terminal);
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
  const repair = wouldApplyValueChunkRepairOutputs(builder, lockingBytecodeProposals, commitmentProposals);
  return repair.lockingBytecodes.length + repair.commitments.length;
}

/** Outputs whose locking bytecode or commitment a value-chunk repair would rewrite. */
export function wouldApplyValueChunkRepairOutputs(
  builder: ValueChunkRepairBuilder,
  lockingBytecodeProposals: ReadonlyMap<number, Uint8Array>,
  commitmentProposals: ReadonlyMap<number, Uint8Array>,
): { lockingBytecodes: number[]; commitments: number[] } {
  const lockingBytecodes: number[] = [];
  const commitments: number[] = [];
  for (const [outputIndex, expected] of lockingBytecodeProposals) {
    const output = builder.outputs[outputIndex];
    if (!output) continue;
    const current = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
    if (current === undefined || binToHex(current) !== binToHex(expected)) lockingBytecodes.push(outputIndex);
  }
  for (const [outputIndex, expected] of commitmentProposals) {
    const output = builder.outputs[outputIndex];
    if (!output?.token?.nft || output.token.nft.capability !== 'mutable') continue;
    if (output.token.nft.commitment !== binToHex(expected)) commitments.push(outputIndex);
  }
  return { lockingBytecodes, commitments };
}

/** Refuse VM-mined value-chunk repairs that would change state under recipe. */
export function gateWouldApplyValueChunkRepairsIfRecipe(
  builder: ValueChunkRepairBuilder,
  lockingBytecodeProposals: ReadonlyMap<number, Uint8Array>,
  commitmentProposals: ReadonlyMap<number, Uint8Array>,
  provenRevert?: (repair: RefusedOutputRepair) => Error | undefined,
): number {
  const repair = wouldApplyValueChunkRepairOutputs(builder, lockingBytecodeProposals, commitmentProposals);
  return gateWouldApplyRepairsIfRecipe(
    repair.lockingBytecodes.length + repair.commitments.length,
    provenRevert && ((): Error | undefined => provenRevert(repair)),
  );
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
  if (!assembly) {
    return freezeGeometry({ repairs: 0, rounds: 0, ownedOutputs: [], outputs: [] });
  }
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
      if (!computedValueChunkOutputIndexInBand(outputBase, {
        start: trailingStart, end: trailingEnd - 1,
      })) continue;
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
  const ownedOutputs = [...owners.keys()].sort((a, b) => a - b);
  const describedWrites = ((builder as TransactionBuilder & {
    __messageBusComputedValueChunkTargets?: readonly {
      inputIndex: number; write: ValueChunkWriteDescriptor;
    }[];
  }).__messageBusComputedValueChunkTargets ?? []).map((target) => target.write)
    .filter((write, index, all) => all.findIndex((candidate) => (
      valueChunkWriteResourceIdentity(candidate) === valueChunkWriteResourceIdentity(write)
    )) === index);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
    console.error('computed-value-convergence', JSON.stringify({
      inputs: builder.inputs.length,
      blocks: assembly.blocks.map((block) => ({ base: block.base, size: block.blockLayout.blockSize,
        trailingBase: block.blockLayout.trailingBase })),
      ownedOutputs,
      writes: describedWrites.map((write) => ({ resource: valueChunkWriteResourceIdentity(write),
        outputBase: write.outputBase, outputCount: write.outputCount })),
    }));
  }
  if (owners.size === 0) {
    return freezeGeometry({ repairs: 0, rounds: 0, ownedOutputs, outputs: [] });
  }

  const changedOutputs = new Set<number>();
  // Constraint fixpoint: value-chunk repairs progress on the same
  // monotone lattice as fixed-state resources.
  const commitmentLattice = new MonotoneCell<string>();
  const seenStates = new Set<string>();
  const maximumRounds = owners.size * 2 + 1;
  let repairs = 0;
  for (let round = 1; round <= maximumRounds; round += 1) {
    const stateKey = ownedOutputs
      .map((outputIndex) => {
        const output = builder.outputs[outputIndex];
        const lock = typeof output?.to === 'string' ? output.to
          : output?.to instanceof Uint8Array ? binToHex(output.to) : '';
        return `${outputIndex}:${lock}:${output?.token?.nft?.commitment ?? ''}`;
      })
      .join('|');
    recordMonotonePass(
      commitmentLattice,
      seenStates,
      stateKey,
      'messageBus: computed value-chunk output convergence entered a repeated state',
    );
    // constraint fixpoint: multi-candidate API inside the value-chunk converge loop.
    const picked = selectActiveConstraintCandidate(
      'value-chunk',
      [stateKey],
      'messageBus: computed value-chunk output convergence entered a repeated state',
      builderConstraintFixpoint(builder),
    );
    if (picked === undefined) {
      finalizeMonotonePass(commitmentLattice, stateKey);
      return freezeGeometry({
        repairs,
        rounds: round,
        ownedOutputs,
        outputs: [...changedOutputs].sort((a, b) => a - b),
      });
    }

    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const lockingBytecodeProposals = new Map<number, Uint8Array>();
    const commitmentProposals = new Map<number, Uint8Array>();
    const roundConfirmedByInput = new Map<number, Set<number>>();
    const inputIndices = new Set([...owners.values()].flatMap((indices) => [...indices]));
    for (const inputIndex of inputIndices) {
      const outputBase = outputBaseByInput.get(inputIndex);
      if (outputBase === undefined) continue;
      const inputWrites = describedWrites.filter((write) => (
        write.outputCount > 0 && owners.get(write.outputBase)?.has(inputIndex)
      ));
      const vm = createVirtualMachineBch2026ForProvider(builder.provider, {
        opcodes: new Set([Op.OP_OUTPUTBYTECODE, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY]),
        beforeOperation: (unknownState) => {
          const state = unknownState as AuthenticationProgramStateCommon;
          const opcode = state.instructions[state.ip]?.opcode;
          if (opcode === Op.OP_OUTPUTBYTECODE) {
            const pin = computedValueChunkOutputPin(state, outputBase);
            if (pin && owners.get(pin.outputIndex)?.has(inputIndex)) {
              const confirmed = roundConfirmedByInput.get(inputIndex) ?? new Set<number>();
              confirmed.add(pin.outputIndex);
              roundConfirmedByInput.set(inputIndex, confirmed);
            }
          }
          if (opcode === Op.OP_EQUALVERIFY && state.instructions[state.ip - 1]?.opcode === Op.OP_DROP
            && !state.controlStack.some((frame) => frame === false)) {
            for (const observation of matchComputedValueChunkStack(state.stack, inputWrites)) {
              traceComputedValueChunkObservation(inputIndex, observation);
              const chunks = chunksFromValue(observation.value, {
                lockingBytecode: observation.lockingBytecode,
                write: observation.write,
                categoryId: observation.write.categoryId,
              });
              if (chunks.length !== observation.write.outputCount
                || chunks.some((_chunk, chunkIndex) => !owners.get(
                  observation.write.outputBase + chunkIndex,
                )?.has(inputIndex))) continue;
              chunks.forEach((chunk, chunkIndex) => {
                const outputIndex = observation.write.outputBase + chunkIndex;
                const priorLock = lockingBytecodeProposals.get(outputIndex);
                if (priorLock && binToHex(priorLock) !== binToHex(chunk.lockingBytecode)) {
                  throw new Error(
                    `messageBus: computed-value covenants disagree on output ${outputIndex} locking bytecode`,
                  );
                }
                const commitment = hexToBin(chunk.commitment);
                const priorCommitment = commitmentProposals.get(outputIndex);
                if (priorCommitment && binToHex(priorCommitment) !== chunk.commitment) {
                  throw new Error(
                    `messageBus: computed-value covenants disagree on output ${outputIndex} commitment`,
                  );
                }
                lockingBytecodeProposals.set(outputIndex, chunk.lockingBytecode.slice());
                commitmentProposals.set(outputIndex, commitment);
              });
            }
            return;
          }
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
      (repair) => provenSourceRevertIndependentOfRepair(builder, repair),
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
    if (!changed) {
      const completeRuns = [...roundConfirmedByInput.entries()].flatMap(([inputIndex, confirmed]) => {
        const outputBase = outputBaseByInput.get(inputIndex);
        if (outputBase === undefined) return [];
        const owned: number[] = [];
        for (let outputIndex = outputBase; owners.get(outputIndex)?.has(inputIndex); outputIndex += 1) {
          owned.push(outputIndex);
        }
        return owned.length > 0 && owned.every((outputIndex) => confirmed.has(outputIndex)) ? [owned] : [];
      });
      const retirementPreview = builder.outputs.map((output) => output && { ...output });
      const wouldRetire = retireOutputsOutsideAuthenticatedValueChunkRuns(
        retirementPreview, completeRuns,
      );
      gateWouldApplyRepairsIfRecipe(wouldRetire.length);
      for (const outputIndex of retireOutputsOutsideAuthenticatedValueChunkRuns(
        builder.outputs, completeRuns,
      )) {
        changedOutputs.add(outputIndex);
        repairs += 1;
      }
      const finalKey = ownedOutputs
        .map((outputIndex) => {
          const output = builder.outputs[outputIndex];
          const lock = typeof output?.to === 'string' ? output.to
            : output?.to instanceof Uint8Array ? binToHex(output.to) : '';
          return `${outputIndex}:${lock}:${output?.token?.nft?.commitment ?? ''}`;
        })
        .join('|');
      finalizeMonotonePass(commitmentLattice, finalKey);
      return freezeGeometry({
        repairs,
        rounds: round,
        ownedOutputs,
        outputs: [...changedOutputs].sort((a, b) => a - b),
      });
    }
  }
  throw new Error(
    `messageBus: computed value-chunk outputs did not converge after ${maximumRounds} complete-graph passes`,
  );
}
