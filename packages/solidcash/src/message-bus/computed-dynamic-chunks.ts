import {
  binToHex, encodeTransaction, hash256, vmNumberToBigInt,
  type AuthenticationProgramStateCommon, type Transaction,
} from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { parseChunkCommitment } from '@solidcash/utils';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { gateWouldApplyRepairsIfRecipe } from './materialization-mode.js';
import { inputMayExecuteOutputTokenCommitment } from './executable-opcode-eligibility.js';
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

export interface ComputedDynamicChunkConvergence {
  repairs: number;
  rounds: number;
  ownedOutputs: readonly number[];
  /** Owned outputs whose equality covenant executed in at least one convergence round. */
  authenticatedOutputs: readonly number[];
  outputs: readonly number[];
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

type DynamicChunkRepairBuilder = {
  outputs: ReadonlyArray<{
    token?: { nft?: { commitment: string; capability?: string } };
  }>;
};

/**
 * Count OTC commitment proposals that would mutate builder outputs.
 * Recipe refuse uses this count so already-matching observations are no-ops.
 */
export function countWouldApplyDynamicChunkRepairs(
  builder: DynamicChunkRepairBuilder,
  commitmentProposals: ReadonlyMap<number, Uint8Array>,
): number {
  return wouldApplyDynamicChunkRepairOutputs(builder, commitmentProposals).length;
}

/** Outputs whose commitment a dynamic-chunk repair would rewrite. */
export function wouldApplyDynamicChunkRepairOutputs(
  builder: DynamicChunkRepairBuilder,
  commitmentProposals: ReadonlyMap<number, Uint8Array>,
): number[] {
  const wouldApply: number[] = [];
  for (const [outputIndex, expected] of commitmentProposals) {
    const output = builder.outputs[outputIndex];
    if (!output?.token?.nft || output.token.nft.capability !== 'mutable') continue;
    if (output.token.nft.commitment !== binToHex(expected)) wouldApply.push(outputIndex);
  }
  return wouldApply;
}

/** Refuse VM-mined dynamic-chunk repairs that would change state under recipe. */
export function gateWouldApplyDynamicChunkRepairsIfRecipe(
  builder: DynamicChunkRepairBuilder,
  commitmentProposals: ReadonlyMap<number, Uint8Array>,
  provenRevert?: (repair: RefusedOutputRepair) => Error | undefined,
): number {
  const commitments = wouldApplyDynamicChunkRepairOutputs(builder, commitmentProposals);
  return gateWouldApplyRepairsIfRecipe(
    commitments.length, provenRevert && ((): Error | undefined => provenRevert({ commitments })),
  );
}

/** Include prerequisite output changes even when this chunk still has the same placeholder. */
export function dynamicChunkConvergenceStateKey(
  transaction: Transaction,
  ownedOutputs: readonly number[],
): string {
  const transactionState = binToHex(hash256(encodeTransaction(transaction)));
  return `${transactionState}|${ownedOutputs
    .map((outputIndex) => `${outputIndex}:${binToHex(
      transaction.outputs[outputIndex]?.token?.nft?.commitment ?? new Uint8Array(),
    )}`)
    .join('|')}`;
}

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
  if (!assembly) {
    return freezeGeometry({ repairs: 0, rounds: 0, ownedOutputs: [], authenticatedOutputs: [], outputs: [] });
  }

  const owners = new Map<number, Set<number>>();
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
      const commitment = output.token.nft.commitment ?? '';
      const ordinal = runStart < 0 ? 0 : outputIndex - runStart;
      const placeholder = commitment === '' || commitment === '00';
      if (!placeholder && !isDynamicChunkCommitmentAtIndex(commitment, ordinal)) {
        if (runStart >= 0) break;
        continue;
      }
      if (runStart < 0) runStart = outputIndex;
      const inputs = owners.get(outputIndex) ?? new Set<number>();
      for (const inputIndex of observerInputs) inputs.add(inputIndex);
      owners.set(outputIndex, inputs);
    }
  }

  const ownedOutputs = [...owners.keys()].sort((a, b) => a - b);
  if (owners.size === 0) {
    return freezeGeometry({ repairs: 0, rounds: 0, ownedOutputs, authenticatedOutputs: [], outputs: [] });
  }

  const changedOutputs = new Set<number>();
  const authenticatedOutputs = new Set<number>();
  // Dynamic-chunk repairs progress on the same monotone lattice
  // as fixed-state resources.
  const commitmentLattice = new MonotoneCell<string>();
  const seenStates = new Set<string>();
  const maximumRounds = owners.size * 2 + 1;
  let repairs = 0;
  for (let round = 1; round <= maximumRounds; round += 1) {
    const { transaction, sourceOutputs } = builder.buildLibauthProgram();
    // Earlier resource or event repairs can open a later chunk equality without changing this chunk's
    // placeholder. A chunk-only key would skip the newly reachable proof in the shared fixpoint session.
    const stateKey = dynamicChunkConvergenceStateKey(transaction, ownedOutputs);
    recordMonotonePass(
      commitmentLattice,
      seenStates,
      stateKey,
      'messageBus: dynamic-chunk output convergence entered a repeated state',
    );
    // constraint fixpoint: multi-candidate API inside the dynamic-chunk converge loop.
    const picked = selectActiveConstraintCandidate(
      'dynamic-chunk',
      [stateKey],
      'messageBus: dynamic-chunk output convergence entered a repeated state',
      builderConstraintFixpoint(builder),
    );
    if (picked === undefined) {
      finalizeMonotonePass(commitmentLattice, stateKey);
      return freezeGeometry({
        repairs,
        rounds: round,
        ownedOutputs,
        authenticatedOutputs: [...authenticatedOutputs].sort((a, b) => a - b),
        outputs: [...changedOutputs].sort((a, b) => a - b),
      });
    }

    const commitmentProposals = new Map<number, Uint8Array>();
    const inputIndices = new Set([...owners.values()].flatMap((indices) => [...indices]));
    let observedInputIndex = -1;
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
        const expected = state.stack[state.stack.length - 2];
        if (!owners.get(outputIndex)?.has(observedInputIndex)) return;
        if (expected.length === 0 || expected.length > 128) return;
        const expectedHex = binToHex(expected);
        // Ordinal is relative to the contiguous owned run that contains this output.
        let ordinalStart = outputIndex;
        while (ordinalStart > 0 && owners.has(ordinalStart - 1)) ordinalStart -= 1;
        // Reject non-chunk OTC pairs (scalar data-NFT lengths, empty pads) before they poison the run.
        if (!isDynamicChunkCommitmentAtIndex(expectedHex, outputIndex - ordinalStart)) return;
        const prior = commitmentProposals.get(outputIndex);
        if (prior && binToHex(prior) !== expectedHex) {
          throw new Error(
            `messageBus: dynamic-chunk covenants disagree on output ${outputIndex} commitment`,
          );
        }
        commitmentProposals.set(outputIndex, expected.slice());
      },
    });
    for (const inputIndex of inputIndices) {
      const source = sourceOutputs[inputIndex];
      const input = transaction.inputs[inputIndex];
      // Only a proven absence of the observed opcode can exclude an input. Unknown or malformed spends
      // still run in the VM, and final preflight continues to validate every input independently.
      if (source && input
        && !inputMayExecuteOutputTokenCommitment(source.lockingBytecode, input.unlockingBytecode)) continue;
      observedInputIndex = inputIndex;
      vm.evaluate({ inputIndex, sourceOutputs, transaction });
    }
    for (const outputIndex of commitmentProposals.keys()) authenticatedOutputs.add(outputIndex);

    gateWouldApplyDynamicChunkRepairsIfRecipe(
      builder, commitmentProposals, (repair) => provenSourceRevertIndependentOfRepair(builder, repair),
    );
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
      // No output was rewritten, so the round's exact transaction key is already the final key.
      finalizeMonotonePass(commitmentLattice, stateKey);
      return freezeGeometry({
        repairs,
        rounds: round,
        ownedOutputs,
        authenticatedOutputs: [...authenticatedOutputs].sort((a, b) => a - b),
        outputs: [...changedOutputs].sort((a, b) => a - b),
      });
    }
  }
  throw new Error(
    `messageBus: dynamic-chunk outputs did not converge after ${maximumRounds} complete-graph passes`,
  );
}

/**
 * Local participant builders report incomplete dynamic chunks from frozen `00` probe placeholders. Complete-graph
 * OTC convergence may already have replaced those commitments on `builder`; only treat the graph as incomplete
 * when a placeholder remains in the owned trailing chunk run.
 *
 * J7: an unselected handler's empty dynamic array can leave resolved=0 `00` stubs with no owned trailing run.
 * That is zero physical chunks, not incompleteness — only fail closed when some chunk was already resolved
 * (owned band missing) or an owned trailing output still holds a placeholder.
 */
export function dynamicChunkPlaceholdersRemain(
  builder: TransactionBuilder,
  convergence: ComputedDynamicChunkConvergence,
  incomplete: readonly { participant: number; variable: string; resolved: number; total: number }[],
): boolean {
  if (incomplete.length === 0) return false;
  if (convergence.ownedOutputs.length === 0) {
    return convergence.rounds > 0 || incomplete.some((entry) => entry.resolved > 0);
  }
  return (convergence.authenticatedOutputs ?? convergence.ownedOutputs).some((outputIndex) => {
    const commitment = builder.outputs[outputIndex]?.token?.nft?.commitment ?? '';
    return commitment === '' || commitment === '00';
  });
}
