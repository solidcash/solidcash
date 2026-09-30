/* eslint-disable max-len */
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeTransaction, encodeTransactionOutput, hash256, hexToBin,
  vmNumberToBigInt, type AuthenticationProgramStateCommon, type Output, type Transaction,
} from '@bitauth/libauth';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { scriptToBytecode } from '@solidcash/utils';
import { addressToLockScript, generateLibauthSourceOutputs } from '../utils.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import { rememberPreparedCovenantValidation } from '../network/createPreparedTxVerifier.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  deriveBalancedAssemblyFromInputs, preflightBalancedBlockAssembly,
} from '../stateful/balancedBlocks.js';
import type { BalancedAssembly, BalancedAssemblyOptions } from '../stateful/balancedBlocks.js';
import { canApplyRepairedNftCommitment } from '../stateful/computed-output-repair.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { isContractUnlocker } from '../interfaces.js';
import { getMessageBusEnvelopeTransport } from '../stateful/covenant-helpers.js';
import { assertGraphTrailingCapacity, type GraphTrailingRegion } from './graph.js';
import { ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES, decodeAtomicMessageEnvelope } from './atomic.js';
import { MessageBusDiagnosticError } from './diagnostics.js';
import { inputMayExecuteOutputTokenCommitment } from './executable-opcode-eligibility.js';
import {
  assertUnlockerLayoutMatchesResolve,
} from './layout-resolver.js';
import {
  gateWouldApplyRepairsIfRecipe,
} from './materialization-mode.js';
import {
  MonotoneCell,
  finalizeMonotonePass,
  freezeGeometry,
  recordMonotonePass,
} from './monotone-lattice.js';
import { isVmValidationOnly } from './materialization-mode.js';
import { selectActiveConstraintCandidate } from '../stateful/value-chunk-persist.js';
import { builderConstraintFixpoint } from './constraint-fixpoint-session.js';

/**
 * Measure each participant's ACTUAL runtime-resource run off the unsigned builder, and refuse a run the
 * balanced model cannot describe.
 *
 * `assertGraphTrailingCapacity` is the rule; this is what makes it a gate instead of a capability the composer
 * must remember to invoke. The composer never declares its run: it is read from the transaction, so stripping
 * the declaration cannot silence the check.
 *
 * WHAT COUNTS. A run is the contiguous prefix of token-bearing outputs starting at the region's first slot -
 * one per dynamic-storage chunk, loop entry or loop sidecar. Inside the declared region every token output
 * counts, because the region is that participant's private space. PAST the region a token output counts only
 * when it carries the participant's own state category (read off its master input) AND is not explained as
 * another block's master output. That second clause is what catches the shape the model could not otherwise
 * see: with two dynamic participants, an over-capacity run spills into the NEXT participant's block, where
 * neither the token-outside-the-region rule nor the input/output balance rule fires, and only the VM objects.
 *
 * It under-counts rather than over-counts wherever the evidence is ambiguous - a trailing output minted under
 * some other category, or a next participant sharing this one's category - so it never manufactures a refusal
 * for a transaction the covenants would have accepted. Nor does it manufacture one past the LAST block: a
 * claimed output there is already refused by the token-outside-the-region rule below, so the only thing that
 * changes for that shape is which message the composer reads.
 */
const trailingRunsFromBuilder = (
  builder: TransactionBuilder, assembly: BalancedAssembly, regions: readonly GraphTrailingRegion[],
): Record<number, number> => {
  const runs: Record<number, number> = {};
  const blockAt = new Map(assembly.blocks.map((block) => [block.base, block]));
  for (const region of regions) {
    const block = assembly.blocks.find((candidate) => candidate.participant === region.participant)!;
    const own = builder.inputs[block.base]?.token?.category;
    const blockEnd = block.base + block.blockLayout.blockSize;
    let run = 0;
    for (let index = region.base; index < builder.outputs.length; index += 1) {
      const token = builder.outputs[index].token;
      if (token === undefined) break;
      if (index >= region.base + region.capacity) {
        // Outside the region: only the participant's own category, and only where no other block's master
        // output already explains the slot.
        if (index < blockEnd || own === undefined || token.category !== own) break;
        const displaced = blockAt.get(index);
        if (displaced !== undefined
          && builder.inputs[displaced.base]?.token?.category === token.category) break;
      }
      run += 1;
    }
    runs[region.participant] = run;
  }
  return runs;
};

/** The declared regions of a derived assembly, in the same participant indexing the assembly uses. */
const trailingRegionsOf = (assembly: BalancedAssembly): GraphTrailingRegion[] =>
  assembly.blocks.flatMap((block) => (block.blockLayout.trailingBase === undefined
    || block.blockLayout.trailingCapacity === undefined
    ? []
    : [{
      participant: block.participant,
      base: block.base + block.blockLayout.trailingBase,
      capacity: block.blockLayout.trailingCapacity,
    }]));

/**
 * Structural block-assembly gate, run BEFORE any unlocker is asked for bytecode.
 *
 * The assembly is read off the builder's own inputs (each participant's master input carries the compiler-
 * published block layout), so this fires without the caller opting in. Only a transaction where NO input
 * publishes a participant master is left alone; a transaction that publishes one but cannot be described is
 * refused - see `deriveBalancedAssemblyFromInputs`.
 *
 * It also runs the runtime-resource capacity rule (`assertGraphTrailingCapacity`) against runs measured off the
 * transaction itself. That rule used to exist without a caller: an over-capacity chunk run was built, funded and
 * signed, and only then refused by the VM at a participant input - a slot that names nothing about the
 * cause. A gate the caller must remember to call is not a gate.
 *
 * Returns the assembly it checked, or undefined when the transaction is out of the block model's scope.
 */
export const preflightMessageBusBlockAssembly = (
  builder: TransactionBuilder, options?: BalancedAssemblyOptions,
): BalancedAssembly | undefined => {
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_BLOCK_ASSEMBLY === '1') {
    console.error('block-assembly-inputs', JSON.stringify(builder.inputs.map((input, index) => {
      const abi = (input as unknown as {
        unlocker?: { abiFunction?: { name?: string; blockLayout?: { blockSize?: number } } };
      }).unlocker?.abiFunction;
      const unlocker = (input as unknown as { unlocker?: { contract?: { artifact?: { contractName?: string } } } })
        .unlocker;
      return {
        index, functionName: abi?.name, blockSize: abi?.blockLayout?.blockSize,
        category: input.token?.category?.slice(0, 12),
        contract: unlocker?.contract?.artifact?.contractName,
        satoshis: String(input.satoshis),
      };
    })));
  }
  const assembly = deriveBalancedAssemblyFromInputs(
    builder.inputs as never, builder.inputs.length,
  );
  if (!assembly) return undefined;
  // The describability rule runs BEFORE the generic structural checks, so an over-capacity run reports its
  // cause. Left second, the same transaction reports whatever its overflow happened to collide with - a token
  // in the sidecar tail, or nothing at all when the collision lands inside the next participant's block.
  const regions = trailingRegionsOf(assembly);
  if (regions.length > 0) {
    assertGraphTrailingCapacity(
      { participantInputs: assembly.blocks.map((block) => block.base), trailingRegions: regions },
      trailingRunsFromBuilder(builder, assembly, regions),
    );
  }
  preflightBalancedBlockAssembly(builder, assembly, options);
  return assembly;
};

/**
 * Run the structural gate on a transaction whose caller has already declared it a message bus composition.
 *
 * `preflightMessageBusBlockAssembly` stays silent on a transaction no input describes, because it is also a
 * standalone capability that may be pointed at anything. The two message bus send paths below are not: reaching
 * them means the caller asserts this transaction IS a participant composition, so "nothing was checkable" is a
 * refusal rather than a pass. Without this, stripping `abiFunction` from every master input silences the gate
 * completely while the transaction bytes stay identical.
 */
const requireMessageBusBlockAssembly = (builder: TransactionBuilder): BalancedAssembly => {
  const assembly = preflightMessageBusBlockAssembly(builder);
  if (assembly !== undefined) return assembly;
  throw new Error(
    'messageBus: no participant master block could be derived from this transaction, so the balanced block '
    + 'assembly gate cannot run; every participant master input must expose its contract unlocker',
  );
};

export interface MessageBusComputedResourceConvergence {
  /** Number of commitment writes applied to the unsigned builder. */
  repairs: number;
  /** Number of complete-transaction VM passes needed to reach the fixed point. */
  rounds: number;
  /** Physical output coordinates changed at least once. */
  outputs: readonly number[];
}

/** A balanced trailing reservation is an entry target only when it reuses a declared entry collection lock. */
export const isTrailingEntryRepairCandidate = (candidate: {
  slotKind: string;
  inputHasToken: boolean;
  outputCapability?: string;
  outputCategory?: string;
  outputTokenAmount?: bigint;
  blockCategory?: string;
  outputLockingBytecode: string;
  entryLockingBytecodes: ReadonlySet<string>;
}): boolean => candidate.slotKind === 'trailing'
  && !candidate.inputHasToken
  && candidate.outputCapability === 'mutable'
  && candidate.outputCategory?.toLowerCase() === candidate.blockCategory?.toLowerCase()
  && candidate.outputTokenAmount === 0n
  && candidate.entryLockingBytecodes.has(candidate.outputLockingBytecode.toLowerCase());

/**
 * Converge compiler-declared mutable outputs against the complete atomic transaction.
 *
 * Participant-local builders cannot derive state whose value depends on another participant: the covenant only
 * sees that value once every block and the verifier tail have been assembled. This recovery therefore runs on
 * the aggregate, before strict preflight and final signing, and accepts only an exact covenant equality witness:
 * `expectedCommitment outputIndex OP_OUTPUTTOKENCOMMITMENT OP_EQUAL[VERIFY]`.
 *
 * The repair authority is deliberately structural. An evaluating input may update only a mutable `dataNft` or
 * `entry` coordinate declared inside its own balanced participant block. Data NFTs must preserve category, value,
 * and locking bytecode in place. Entry targets may also replace a token-free balanced input when the compiler
 * reserved that exact entry slot. Dynamic chunks, events, transfers, read-only state, identities, verifiers, and
 * the fee tail are never candidates. Conflicting covenant observations are refused rather than resolved by
 * evaluation order.
 */
const convergeMessageBusMutableResourceOutputs = (
  builder: TransactionBuilder,
  includeEntries: boolean,
  observedProposals?: Map<number, Uint8Array>,
): MessageBusComputedResourceConvergence => {
  const assembly = requireMessageBusBlockAssembly(builder);
  const ownedByBlock = new Map<number, Set<number>>();
  const fixedStateOutputs = new Set<number>();
  for (const block of assembly.blocks) {
    const owned = new Set<number>();
    const blockCategory = builder.inputs[block.base]?.token?.category?.toLowerCase();
    const entryLockingBytecodes = new Set(block.blockLayout.slots.flatMap((slot) => {
      if (slot.kind !== 'entry') return [];
      const output = builder.outputs[block.base + slot.offset];
      if (!output) return [];
      const lock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
      return [binToHex(lock).toLowerCase()];
    }));
    for (const slot of block.blockLayout.slots) {
      if (slot.kind !== 'dataNft' && (!includeEntries || slot.kind !== 'entry')) continue;
      const outputIndex = block.base + slot.offset;
      const input = builder.inputs[outputIndex];
      const output = builder.outputs[outputIndex];
      if (!input || output?.token?.nft?.capability !== 'mutable') continue;
      if (slot.kind === 'dataNft') {
        if (input.token?.nft?.capability !== 'mutable'
          || input.token.category.toLowerCase() !== output.token.category.toLowerCase()
          || input.token.amount !== output.token.amount
          || input.satoshis !== output.amount) continue;
        const inputLock = input.unlocker.generateLockingBytecode();
        const outputLock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
        if (binToHex(inputLock) !== binToHex(outputLock)) continue;
        fixedStateOutputs.add(outputIndex);
      } else {
        if (blockCategory === undefined || output.token.category.toLowerCase() !== blockCategory
          || output.token.amount !== 0n) continue;
        if (input.token !== undefined) {
          if (input.token.nft?.capability !== 'mutable'
            || input.token.category.toLowerCase() !== output.token.category.toLowerCase()
            || input.token.amount !== output.token.amount
            || input.satoshis !== output.amount) continue;
          const inputLock = input.unlocker.generateLockingBytecode();
          const outputLock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
          if (binToHex(inputLock) !== binToHex(outputLock)) continue;
        }
      }
      owned.add(outputIndex);
    }
    // Sorted insertion recreates the predecessor (P') in the trailing band. Its balanced input is deliberately
    // token-free, so it is not covered by the fixed entry-slot loop above; the collection lock ties the reserved
    // coordinate back to a compiler-declared entry family without admitting dynamic/event/sidecar outputs.
    for (const slot of block.blockLayout.slots) {
      const outputIndex = block.base + slot.offset;
      const input = builder.inputs[outputIndex];
      const output = builder.outputs[outputIndex];
      if (!output?.token?.nft) continue;
      const outputLock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
      if (isTrailingEntryRepairCandidate({
        slotKind: slot.kind,
        inputHasToken: input?.token !== undefined,
        outputCapability: output.token.nft.capability,
        outputCategory: output.token.category,
        outputTokenAmount: output.token.amount,
        blockCategory,
        outputLockingBytecode: binToHex(outputLock),
        entryLockingBytecodes,
      })) owned.add(outputIndex);
    }
    ownedByBlock.set(block.participant, owned);
  }

  const candidateCount = [...ownedByBlock.values()].reduce((sum, owned) => sum + owned.size, 0);
  if (candidateCount === 0) return { repairs: 0, rounds: 0, outputs: [] };

  const changedOutputs = new Set<number>();
  // Computed-output convergence: placeholders progress toward a frozen final geometry (resolved only at exit).
  const commitmentLattice = new MonotoneCell<string>();
  const seenStates = new Set<string>();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  // Input programs are authenticated by immutable source outputs. Cache only proofs of opcode absence; uncertain
  // or malformed spends stay eligible. Output repairs may rebuild arguments, but cannot change the authenticated
  // direct program or P2SH redeem script without making the spend invalid.
  const observerEligibility = new Map<number, boolean>();
  let repairs = 0;
  const maximumRounds = candidateCount * 2 + 1;
  for (let round = 1; round <= maximumRounds; round += 1) {
    const transaction = builder.buildLibauthTransaction();
    // A resource covenant can be gated by another semantic output (most notably an event-slot scan). The owned
    // commitments alone are therefore not a complete convergence state: after that prerequisite changes, the
    // same `00` entry placeholder must be eligible for a new authenticated observation. Hashing the complete
    // transaction keeps the shared fixpoint strict for truly repeated states while distinguishing that progress.
    const transactionState = binToHex(hash256(encodeTransaction(transaction)));
    const stateKey = `${transactionState}|${[...ownedByBlock.values()]
      .flatMap((owned) => [...owned].sort((a, b) => a - b))
      .map((outputIndex) => `${outputIndex}:${builder.outputs[outputIndex]?.token?.nft?.commitment ?? ''}`)
      .join('|')}`;
    recordMonotonePass(
      commitmentLattice,
      seenStates,
      stateKey,
      'messageBus: mutable resource output convergence entered a repeated state',
    );
    // constraint fixpoint: multi-candidate API — single progressing key here; soft-exit when joint cycles.
    // Observation does not advance the mutable convergence session. It must remain repeatable after a
    // prior build finalized that session, or a later build/send can silently lose exact state claims.
    if (observedProposals === undefined) {
      const picked = selectActiveConstraintCandidate(
        'resource',
        [stateKey],
        'messageBus: mutable resource output convergence entered a repeated state',
        builderConstraintFixpoint(builder),
      );
      if (picked === undefined) {
        finalizeMonotonePass(commitmentLattice, stateKey);
        return freezeGeometry({
          repairs, rounds: round, outputs: [...changedOutputs].sort((a, b) => a - b),
        });
      }
    }

    // constraint fixpoint: accumulate all OTC observations per output, then collapse with multi-way ranking.
    const proposalCandidates = new Map<number, Array<{
      commitment: Uint8Array; inputIndex: number; ip: number;
    }>>();
    const observed = new Map<number, { commitment: Uint8Array; ip: number }>();
    const debugResourceValues = new Set<string>();
    let owned = new Set<number>();
    const vm = createVirtualMachineBch2026ForProvider(builder.provider, {
      opcodes: new Set([Op.OP_OUTPUTTOKENCOMMITMENT]),
      beforeOperation: (unknownState) => {
        const state = unknownState as AuthenticationProgramStateCommon;
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RESOURCE_VALUES === '1') {
          for (const item of state.stack) {
            if (item.length < 190 || item.length > 210) continue;
            const hex = binToHex(item);
            if (debugResourceValues.has(hex)) continue;
            debugResourceValues.add(hex);
            console.error('message-bus-resource-value', JSON.stringify({ bytes: item.length, value: hex }));
          }
        }
        if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTTOKENCOMMITMENT
          || state.stack.length < 2) return;
        // Libauth invokes operation hooks for instructions in inactive IF/ELSE branches too. Those opcodes
        // are not executed and their stack shape belongs to the active branch. Interpreting them as covenant
        // observations can manufacture a preservation proposal from a write covenant's inactive read path.
        if (state.controlStack.some((frame) => frame === false)) return;
        const nextOpcode = state.instructions[state.ip + 1]?.opcode;
        if (nextOpcode !== Op.OP_EQUAL && nextOpcode !== Op.OP_EQUALVERIFY) return;
        let outputIndex: number;
        try {
          outputIndex = Number(vmNumberToBigInt(state.stack[state.stack.length - 1]));
        } catch {
          return;
        }
        if (!Number.isSafeInteger(outputIndex) || !owned.has(outputIndex)) return;
        observed.set(outputIndex, {
          commitment: state.stack[state.stack.length - 2].slice(), ip: state.ip,
        });
      },
    });
    for (const [blockIndex, block] of assembly.blocks.entries()) {
      owned = ownedByBlock.get(block.participant)!;
      if (owned.size === 0) continue;
      // A delegate participant's compiler-declared state block can be followed by authenticated logical-identity
      // and executor inputs before the next participant begins. The executor is the input which actually runs the
      // implementation covenant and exposes computed entry commitments; stopping at `blockLayout.blockSize`
      // leaves those OTC witnesses invisible. Repair ownership remains restricted to `ownedByBlock` above, so
      // widening only the observer span cannot authorize a suffix input to mutate an undeclared coordinate.
      const observerEnd = assembly.blocks[blockIndex + 1]?.base
        ?? Math.min(...assembly.verifierInputs, assembly.verifierInput);
      for (let inputIndex = block.base;
        inputIndex < observerEnd;
        inputIndex += 1) {
        let eligible = observerEligibility.get(inputIndex);
        if (eligible === undefined) {
          const source = sourceOutputs[inputIndex];
          const input = transaction.inputs[inputIndex];
          eligible = source === undefined || input === undefined
            || inputMayExecuteOutputTokenCommitment(source.lockingBytecode, input.unlockingBytecode);
          observerEligibility.set(inputIndex, eligible);
        }
        if (!eligible) continue;
        observed.clear();
        const evaluated = vm.evaluate({ inputIndex, sourceOutputs, transaction });
        if (vm.stateSuccess(evaluated) === true) continue;
        for (const [outputIndex, { commitment, ip }] of observed) {
          const list = proposalCandidates.get(outputIndex) ?? [];
          const hex = binToHex(commitment);
          if (!list.some((candidate) => binToHex(candidate.commitment) === hex
            && candidate.inputIndex === inputIndex)) {
            list.push({ commitment, inputIndex, ip });
            proposalCandidates.set(outputIndex, list);
          }
        }
      }
    }
    const proposals = new Map<number, { commitment: Uint8Array; inputIndex: number; ip: number }>();
    for (const [outputIndex, candidates] of proposalCandidates) {
      if (candidates.length === 1) {
        proposals.set(outputIndex, candidates[0]!);
        continue;
      }
      const ranked = rankResourceOtcConflictCandidatesMany(candidates);
      if (observedProposals === undefined) {
        selectActiveConstraintCandidate(
          'resource-otc-conflict',
          ranked.map((candidate) => (
            `${outputIndex}:${binToHex(candidate.commitment)}@${candidate.inputIndex}`
          )),
          'messageBus: OTC conflict fingerprint entered a repeated state',
          builderConstraintFixpoint(builder),
        );
      }
      if (isVmValidationOnly()) {
        proposals.set(outputIndex, ranked[0]!);
        continue;
      }
      const witnessSummary = (index: number): string => {
        const unlocker = builder.inputs[index]?.unlocker as unknown as {
          abiFunction?: { inputs?: readonly { name: string }[] };
          params?: readonly unknown[];
        };
        const rows = unlocker?.abiFunction?.inputs?.flatMap((input, paramIndex) => {
          if (!/^__internal__vmapBatch(?:Proof|PredOut)_\d+$/.test(input.name)) return [];
          const value = unlocker.params?.[paramIndex];
          if (input.name.includes('PredOut') && value === -2n) return [];
          return [`${input.name}=${value instanceof Uint8Array ? binToHex(value) : String(value)}`];
        }) ?? [];
        return rows.length === 0 ? 'no active batch witnesses' : rows.join(', ');
      };
      const first = ranked[0]!;
      const second = ranked[1]!;
      throw new Error(
        `messageBus: covenants disagree on mutable resource output ${outputIndex}: `
        + `${ranked.length} distinct OTC proposals `
        + `(first input ${first.inputIndex} proposes ${binToHex(first.commitment)}, `
        + `input ${second.inputIndex} proposes ${binToHex(second.commitment)}); `
        + `input ${first.inputIndex}: ${witnessSummary(first.inputIndex)}; `
        + `input ${second.inputIndex}: ${witnessSummary(second.inputIndex)}`,
      );
    }

    // constraint fixpoint: multi-proposal + cross-output joint OTC ranking fingerprint.
    if (observedProposals === undefined && proposals.size > 0) {
      const proposalKeys = [...proposals.entries()]
        .map(([outputIndex, { commitment }]) => `${outputIndex}:${binToHex(commitment)}`)
        .sort();
      const jointCrossOutput = [...proposals.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([outputIndex, candidate]) => (
          `${outputIndex}:${binToHex(candidate.commitment)}@${candidate.inputIndex}`
        ))
        .join('|');
      selectActiveConstraintCandidate(
        'resource-proposals',
        [proposalKeys.join('|'), jointCrossOutput, ...proposalKeys],
        'messageBus: resource proposal fingerprint entered a repeated state',
        builderConstraintFixpoint(builder),
      );
      selectActiveConstraintCandidate(
        'resource-otc-cross-output',
        [jointCrossOutput, ...proposalKeys],
        'messageBus: cross-output OTC ranking entered a repeated state',
        builderConstraintFixpoint(builder),
      );
    }

    // resource would-apply recipe gate: refuse only proposals that would apply (matching / canApply-skip are no-ops under recipe).
    const maximumCommitmentBytes = builder.provider.consensusLimits?.maximumNftCommitmentBytes ?? 128;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RESOURCE_REPAIRS === '1') {
      console.error('message-bus-resource-repair-proposals', JSON.stringify([...proposals].map(
        ([outputIndex, proposal]) => ({
          outputIndex,
          block: (() => {
            const block = assembly.blocks.find((candidate) => outputIndex >= candidate.base
              && outputIndex < candidate.base + candidate.blockLayout.blockSize);
            return block === undefined ? undefined
              : {
                participant: block.participant,
                base: block.base,
                offset: outputIndex - block.base,
                slot: block.blockLayout.slots.find((candidate) => candidate.offset === outputIndex - block.base),
                master: (() => {
                  const unlocker = (builder.inputs[block.base] as unknown as {
                    unlocker?: {
                      contract?: { artifact?: { contractName?: string } };
                      abiFunction?: { name?: string; inputs?: readonly { name: string }[] };
                      params?: readonly unknown[];
                    };
                  }).unlocker;
                  const describe = (value: unknown): unknown => value instanceof Uint8Array
                    ? binToHex(value) : typeof value === 'bigint' ? value.toString() : value;
                  return {
                    contract: unlocker?.contract?.artifact?.contractName,
                    function: unlocker?.abiFunction?.name,
                    witnesses: unlocker?.abiFunction?.inputs?.flatMap((input, index) =>
                      /(?:message_bus_key.*_r7|vmapBatch.*_7)$/.test(input.name)
                        ? [{ name: input.name, value: describe(unlocker.params?.[index]) }] : []),
                  };
                })(),
              };
          })(),
          current: builder.outputs[outputIndex]?.token?.nft?.commitment,
          proposed: binToHex(proposal.commitment),
          inputIndex: proposal.inputIndex,
          ip: proposal.ip,
          fixedState: fixedStateOutputs.has(outputIndex),
        }),
      )));
    }
    if (observedProposals !== undefined) {
      observedProposals.clear();
      for (const [outputIndex, proposal] of proposals) {
        observedProposals.set(outputIndex, proposal.commitment.slice());
      }
      return freezeGeometry({ repairs: 0, rounds: round, outputs: [] });
    }
    gateWouldApplyResourceRepairsIfRecipe(
      builder,
      proposals,
      fixedStateOutputs,
      maximumCommitmentBytes,
    );
    let changed = false;
    for (const [outputIndex, { commitment: proposed }] of proposals) {
      const output = builder.outputs[outputIndex];
      if (!output?.token?.nft) continue;
      const inputCommitment = builder.inputs[outputIndex]?.token?.nft?.commitment;
      const action = canApplyRepairedNftCommitment({
        capability: output.token.nft.capability,
        currentCommitmentHex: output.token.nft.commitment,
        proposed,
        hasLockingBytecode: false,
        fixedStateSlot: fixedStateOutputs.has(outputIndex),
        maximumCommitmentBytes,
        inputCommitmentHex: inputCommitment === undefined ? undefined
          : typeof inputCommitment === 'string' ? inputCommitment : binToHex(inputCommitment),
      });
      if (action === 'skip') continue;
      output.token.nft.commitment = binToHex(proposed);
      changedOutputs.add(outputIndex);
      repairs += 1;
      changed = true;
    }
    if (!changed) {
      const finalKey = [...ownedByBlock.values()].flatMap((owned) => [...owned].sort((a, b) => a - b))
        .map((outputIndex) => `${outputIndex}:${builder.outputs[outputIndex]?.token?.nft?.commitment ?? ''}`)
        .join('|');
      finalizeMonotonePass(commitmentLattice, finalKey);
      return freezeGeometry({
        repairs, rounds: round, outputs: [...changedOutputs].sort((a, b) => a - b),
      });
    }
  }
  throw new Error(
    `messageBus: mutable resource outputs did not converge after ${maximumRounds} complete-transaction passes`,
  );
};

type ResourceRepairBuilder = {
  outputs: ReadonlyArray<{
    token?: { nft?: { commitment: string; capability?: string } };
  }>;
  inputs?: ReadonlyArray<{
    token?: { nft?: { commitment?: string | Uint8Array } };
  }>;
};

type ResourceCommitmentProposal = {
  commitment: Uint8Array;
};

/**
 * resource would-apply recipe gate: count resource OTC proposals that `canApplyRepairedNftCommitment` would apply.
 * Already-matching / skip observations must not trip the recipe refuse gate.
 */
export function countWouldApplyResourceRepairs(
  builder: ResourceRepairBuilder,
  proposals: ReadonlyMap<number, ResourceCommitmentProposal>,
  fixedStateOutputs: ReadonlySet<number>,
  maximumCommitmentBytes = 128,
): number {
  let wouldApply = 0;
  for (const [outputIndex, { commitment: proposed }] of proposals) {
    const output = builder.outputs[outputIndex];
    if (!output?.token?.nft) continue;
    const inputCommitment = builder.inputs?.[outputIndex]?.token?.nft?.commitment;
    const action = canApplyRepairedNftCommitment({
      capability: output.token.nft.capability,
      currentCommitmentHex: output.token.nft.commitment,
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: fixedStateOutputs.has(outputIndex),
      maximumCommitmentBytes,
      inputCommitmentHex: inputCommitment === undefined ? undefined
        : typeof inputCommitment === 'string' ? inputCommitment : binToHex(inputCommitment),
    });
    if (action !== 'skip') wouldApply += 1;
  }
  return wouldApply;
}

/**
 * constraint fixpoint: rank conflicting OTC proposals.
 * Primary: higher optional `weight` wins (explicit priority / confidence).
 * Then earlier inputIndex, earlier ip, then lex commitment.
 */
export function rankResourceOtcConflictCandidates<T extends {
  commitment: Uint8Array; inputIndex: number; ip: number; weight?: number;
}>(left: T, right: T): [T, T] {
  const leftWeight = left.weight ?? 0;
  const rightWeight = right.weight ?? 0;
  if (leftWeight !== rightWeight) {
    return leftWeight > rightWeight ? [left, right] : [right, left];
  }
  const score = (candidate: T): number => candidate.inputIndex * 1_000_000 + candidate.ip;
  const leftScore = score(left);
  const rightScore = score(right);
  if (leftScore < rightScore) return [left, right];
  if (rightScore < leftScore) return [right, left];
  const leftHex = binToHex(left.commitment);
  const rightHex = binToHex(right.commitment);
  return leftHex <= rightHex ? [left, right] : [right, left];
}

/**
 * constraint fixpoint: multi-way (>2) OTC arbitration — stable sort by the same ranking as the pairwise helper.
 */
export function rankResourceOtcConflictCandidatesMany<T extends {
  commitment: Uint8Array; inputIndex: number; ip: number; weight?: number;
}>(candidates: readonly T[]): T[] {
  if (candidates.length <= 1) return [...candidates];
  return [...candidates].sort((left, right) => {
    const [first] = rankResourceOtcConflictCandidates(left, right);
    return first === left ? -1 : 1;
  });
}

/** resource would-apply recipe gate: refuse VM-mined resource repairs that would change state under recipe. */
export function gateWouldApplyResourceRepairsIfRecipe(
  builder: ResourceRepairBuilder,
  proposals: ReadonlyMap<number, ResourceCommitmentProposal>,
  fixedStateOutputs: ReadonlySet<number>,
  maximumCommitmentBytes = 128,
): number {
  return gateWouldApplyRepairsIfRecipe(countWouldApplyResourceRepairs(
    builder, proposals, fixedStateOutputs, maximumCommitmentBytes,
  ));
}

/** Complete-graph convergence for fixed state and compiler-declared sorted-entry targets. */
export const convergeMessageBusComputedResourceOutputs = (
  builder: TransactionBuilder,
): MessageBusComputedResourceConvergence => convergeMessageBusMutableResourceOutputs(builder, true);

/** Observe compiler-authenticated mutable resource commitments without mutating the aggregate transaction. */
export const discoverMessageBusComputedResourceOutputs = (
  builder: TransactionBuilder,
): ReadonlyMap<number, Uint8Array> => {
  const proposals = new Map<number, Uint8Array>();
  convergeMessageBusMutableResourceOutputs(builder, true, proposals);
  return proposals;
};

/** Backwards-compatible fixed-state-only convergence entry point. */
export const convergeMessageBusFixedStateOutputs = (
  builder: TransactionBuilder,
): MessageBusComputedResourceConvergence => convergeMessageBusMutableResourceOutputs(builder, false);

/** Enforce the physical carrier encoding selected by the artifact's generated verifier. */
const assertCanonicalMessageEnvelopePush = (
  builder: TransactionBuilder, transaction: Transaction, assembly: BalancedAssembly,
): void => {
  const rootUnlocker = builder.inputs[0]?.unlocker;
  const rootEnvelopeLocation = rootUnlocker && isContractUnlocker(rootUnlocker)
    ? rootUnlocker.contract.artifact.messageBus?.atomicMessageBus?.messageEnvelope : undefined;
  const rootBlock = assembly.blocks[0];
  const executorOffset = rootBlock?.blockLayout.slots.find((slot) => slot.kind === 'lowLevelCall')?.offset;
  const executorUnlocker = executorOffset === undefined ? undefined : builder.inputs[executorOffset]?.unlocker;
  const executorEnvelopeLocation = executorUnlocker && isContractUnlocker(executorUnlocker)
    ? executorUnlocker.contract.artifact.messageBus?.atomicMessageBus?.messageEnvelope : undefined;
  if (executorEnvelopeLocation?.region === 'proxy-forward') {
    if (!rootBlock || rootBlock.base !== 0 || executorOffset === undefined || executorOffset < 1
      || !rootUnlocker || !isContractUnlocker(rootUnlocker)
      || rootUnlocker.abiFunction?.name !== '__forward'
      || !executorUnlocker || !isContractUnlocker(executorUnlocker)
      || getMessageBusEnvelopeTransport(executorUnlocker.contract.artifact) !== 'proxy-forward') {
      throw new Error('messageBus: V5 proxy-forward envelope has no authenticated root proxy/executor pair');
    }
    for (const block of assembly.blocks) {
      if (block.authority === 'direct') continue;
      const routeOffset = block.blockLayout.slots.find((slot) => slot.kind === 'lowLevelCall')?.offset ?? 0;
      const unlocker = builder.inputs[block.base + routeOffset]?.unlocker;
      if (!unlocker || !isContractUnlocker(unlocker)
        || getMessageBusEnvelopeTransport(unlocker.contract.artifact) !== 'proxy-forward') {
        throw new Error('messageBus: V5 proxy-forward envelope cannot mix participant transports');
      }
    }
    const root = transaction.inputs[0]?.unlockingBytecode ?? new Uint8Array();
    const maximumInputBytes = builder.provider.consensusLimits?.maximumInputBytes ?? 10_000;
    const indexPush = scriptToBytecode([bigIntToVmNumber(BigInt(executorOffset))]);
    if (root.length > maximumInputBytes || root.length < indexPush.length + 4
      || binToHex(root.slice(0, indexPush.length)) !== binToHex(indexPush)
      || root[indexPush.length] !== 0x4d) {
      throw new Error('messageBus: V5 proxy input 0 must pin its executor and a PUSHDATA2 forward payload');
    }
    const forward = readPush(root, indexPush.length);
    const outerLength = root[indexPush.length + 1] | (root[indexPush.length + 2] << 8);
    const payload = forward?.data;
    if (!forward || !payload || outerLength !== payload.length || payload.length < 7
      || binToHex(payload.slice(0, 4)) !== '53434231' || payload[4] !== 0x4d) {
      throw new Error('messageBus: V5 proxy input 0 has no canonical SCB1 forward payload');
    }
    const envelopeLength = payload[5] | (payload[6] << 8);
    const envelope = payload.slice(7);
    if (envelopeLength !== envelope.length || envelope.length < ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES) {
      throw new Error('messageBus: V5 proxy input 0 has no canonical L3C1 envelope');
    }
    decodeAtomicMessageEnvelope(envelope);
    const redeem = readPush(root, forward.nextOffset);
    if (!redeem || redeem.nextOffset !== root.length) {
      throw new Error('messageBus: V5 proxy input 0 has a non-canonical __forward frame');
    }
    const executor = transaction.inputs[executorOffset]?.unlockingBytecode ?? new Uint8Array();
    if (executor.length > maximumInputBytes || executor.length < payload.length + 1
      || executor[0] !== 4 || binToHex(executor.slice(1, payload.length + 1)) !== binToHex(payload)) {
      throw new Error('messageBus: V5 proxy forward payload does not match its SCB1 executor prefix');
    }
    const carrier = readPush(executor, 5);
    const batch = carrier && readPush(executor, carrier.nextOffset);
    if (!carrier || binToHex(carrier.data) !== binToHex(envelope)
      || !batch || !isCanonicalCompilerRouteEnvelope(batch.data)
      || !readPush(executor, batch.nextOffset)) {
      throw new Error('messageBus: V5 proxy executor envelope must precede canonical batch and reserve');
    }
    for (const inputIndex of assembly.verifierInputs) {
      const verifierUnlock = transaction.inputs[inputIndex]?.unlockingBytecode ?? new Uint8Array();
      const redundant = firstPush(verifierUnlock);
      if (redundant && binToHex(redundant) === binToHex(envelope)) {
        throw new Error(`messageBus: V5 verifier input ${inputIndex} redundantly carries the root envelope`);
      }
    }
    return;
  }
  if (rootEnvelopeLocation?.region === 'root-route') {
    if (!rootUnlocker || !isContractUnlocker(rootUnlocker)
      || getMessageBusEnvelopeTransport(rootUnlocker.contract.artifact) !== 'root-route'
      || assembly.blocks[0]?.base !== 0) {
      throw new Error('messageBus: V5 root-route envelope has no authenticated input-0 participant');
    }
    for (const block of assembly.blocks) {
      if (block.authority === 'direct') continue;
      const unlocker = builder.inputs[block.base]?.unlocker;
      if (!unlocker || !isContractUnlocker(unlocker)
        || getMessageBusEnvelopeTransport(unlocker.contract.artifact) !== 'root-route') {
        throw new Error('messageBus: V5 root-route envelope cannot mix participant transports');
      }
    }
    const root = transaction.inputs[0]?.unlockingBytecode ?? new Uint8Array();
    const maximumInputBytes = builder.provider.consensusLimits?.maximumInputBytes ?? 10_000;
    if (root.length > maximumInputBytes || root.length < 8 || root[0] !== 4
      || binToHex(root.slice(1, 5)) !== '53434231' || root[5] !== 0x4d) {
      throw new Error('messageBus: V5 input 0 must begin with SCB1 and a bounded OP_PUSHDATA2 envelope');
    }
    const carrier = readPush(root, 5);
    const declaredLength = root[6] | (root[7] << 8);
    if (!carrier || declaredLength !== carrier.data.length
      || carrier.nextOffset !== 8 + declaredLength
      || carrier.data.length < ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES) {
      throw new Error('messageBus: V5 input 0 has no canonical root-route envelope');
    }
    decodeAtomicMessageEnvelope(carrier.data);
    const batch = readPush(root, carrier.nextOffset);
    if (!batch || !isCanonicalCompilerRouteEnvelope(batch.data)
      || !readPush(root, batch.nextOffset)) {
      throw new Error('messageBus: V5 root-route envelope must precede the canonical batch and reserve');
    }
    for (const inputIndex of assembly.verifierInputs) {
      const verifierUnlock = transaction.inputs[inputIndex]?.unlockingBytecode ?? new Uint8Array();
      const redundant = firstPush(verifierUnlock);
      if (redundant && binToHex(redundant) === binToHex(carrier.data)) {
        throw new Error(`messageBus: V5 verifier input ${inputIndex} redundantly carries the root envelope`);
      }
    }
    return;
  }
  const unlockingBytecode = transaction.inputs[assembly.verifierInput]?.unlockingBytecode ?? new Uint8Array();
  const messageEnvelope = firstPush(unlockingBytecode);
  if (unlockingBytecode[0] !== 0x4d || messageEnvelope === undefined
    || messageEnvelope.length < ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES) {
    throw new Error(
      `messageBus: canonical verifier input ${assembly.verifierInput} must begin with an OP_PUSHDATA2 `
      + `messageEnvelope of at least ${ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES} bytes`,
    );
  }
  decodeAtomicMessageEnvelope(messageEnvelope);
};

const assertNoDerivationProbeOutpoints = (builder: TransactionBuilder): void => {
  if (builder.inputs.some((input) => input.vout === 0xffffffff)) {
    throw new Error('messageBus: finalized transactions cannot contain the internal derivation-probe outpoint');
  }
};

/** V5 direct owners have no detached verifier; bind their dormant nested-call witness before VM evaluation. */
const assertDirectParticipantFrames = (
  builder: TransactionBuilder, transaction: Transaction, assembly: BalancedAssembly,
): void => {
  for (const block of assembly.blocks) {
    if (block.authority !== 'direct') continue;
    const unlocker = builder.inputs[block.base]?.unlocker;
    const encoded = transaction.inputs[block.base]?.unlockingBytecode ?? new Uint8Array();
    if (!unlocker || !isContractUnlocker(unlocker)
      || unlocker.contract.artifact.compiler?.options?.messageBusDirectParticipant !== true
      || unlocker.contract.artifact.messageBus !== undefined
      || unlocker.abiFunction.blockLayout?.blockSize !== block.blockLayout.blockSize) {
      throw new Error(`messageBus: direct participant ${block.participant} has no V5 master authority`);
    }
    const indices = unlocker.abiFunction.inputs.flatMap((input, index) =>
      input.name === '__internal__callInputIndex' ? [index] : []);
    const expected = BigInt(assembly.totalSlots);
    const selector = readPush(encoded, 0);
    const hidden = selector && readPush(encoded, selector.nextOffset);
    const canonicalHidden = scriptToBytecode([bigIntToVmNumber(expected)]);
    if (indices.length !== 1 || indices[0] !== unlocker.abiFunction.inputs.length - 1
      || unlocker.params[indices[0]] !== expected
      || !selector || encoded[0] !== 4
      || binToHex(selector.data) !== unlocker.abiFunction.selector?.toLowerCase()
      || !hidden || binToHex(encoded.slice(selector.nextOffset, hidden.nextOffset))
        !== binToHex(canonicalHidden)) {
      throw new Error(`messageBus: direct participant ${block.participant} has an unbound call-index frame`);
    }
  }
};

/* ------------------------------------------------------------------------------------------------------ */
/* The finalized-bytes gate                                                                                 */
/* ------------------------------------------------------------------------------------------------------ */

/**
 * WHY THIS GATE EXISTS HERE AND NOT AT PLAN TIME.
 *
 * R1 built a plan-time envelope screen and then MEASURED that it cannot be the gate, for two reasons that do
 * not depend on each other:
 *
 *  1. Nothing reaches REFUSE. At the re-derived estimator allowances the relay-size REFUSE threshold is
 *     141,562 bytes while the largest shape ever built predicts 112,955, so the screen is inert on every real
 *     subject. A screen that cannot say no is not a gate.
 *  2. A per-input VM evaluation is STRUCTURALLY BLIND to three whole classes of limit - transaction size, dust
 *     and output shape. Those are properties of the finalized transaction, not of any one input's script, so no
 *     amount of per-input evaluation can see them. Measured: a 100,650-byte transaction carrying a 10-satoshi
 *     one-byte output produced ZERO per-input refusals at both real profiles.
 *
 * This is that missing gate, sitting where the transaction actually exists. Two prior misses are exactly its
 * subject: C3 serialized to 100,354 bytes against a 100,000-byte ceiling and every in-repo check passed it - a
 * human noticed the number - and C1 was refused `64: dust` on a real node for a 10-satoshi placeholder against
 * a 474-satoshi threshold, invisible because the mock sets `enforceDust: false` and `dustRelayFeePerKb: 0n`.
 *
 * WHAT IT IS NOT. message bus derivation is an untrusted witness construction; every accepted shape is justified
 * by covenants and consensus, never by this gate. This is a usability and correctness aid: it refuses bytes no
 * peer would forward, and it makes nothing newly buildable. Suppressing it cannot make an invalid transaction
 * valid, and passing it is agreement with a rule set rather than evidence about a shape.
 *
 * PROVIDER LIMITS ARE DELIBERATELY NOT READ. `evaluateEveryInput` builds its VM from
 * `provider.consensusLimits`, and on every message bus test that is the relaxed semantic profile - 100x the real
 * bytecode ceiling and 20,000,000x the real op-cost budget. An envelope check against those numbers passes
 * vacuously. Every threshold below is a libauth BCH-2026 constant or arithmetic over the finalized bytes, and
 * no argument can raise one.
 */

/** Real BCH-2026 figures this gate decides against. Read from libauth so a version bump is visible. */
const RELAY_TRANSACTION_SIZE_LIMIT = ConsensusBch2026.maximumStandardTransactionSize;
const CONSENSUS_TRANSACTION_SIZE_LIMIT = ConsensusBch2026.maximumTransactionLengthBytes;
const CONSENSUS_UNLOCKING_BYTES_LIMIT = ConsensusBch2026.maximumBytecodeLength;
const RELAY_LOCKING_BYTES_LIMIT = ConsensusBch2026.maximumStandardLockingBytecodeLength;
const RELAY_DATA_CARRIER_LIMIT = ConsensusBch2026.maximumDataCarrierBytes;

/**
 * BCHN's dust threshold as arithmetic: `3 * dustRelayFee.GetFee(GetSerializeSize(txout) + 148)`, which at the
 * default 1,000 sat/kB dust relay fee is `3 * (serialized + 148)`. The 148 is the assumed cost of the input
 * that will eventually sweep the output, which is why the floor grows with the output's own size.
 *
 * The SDK already computes exactly this in `calculateDust` (`src/utils.ts`, spelled `444 + outputSize * 3`).
 * The reason a 10-satoshi output survived every measurement on this effort is not a wrong formula: it is that
 * `validateOutput` is handed `provider.policy?.enforceDust ?? true` and the message bus profile sets it false. The
 * rule was correct, present, and switched off. This one is not switchable by a provider field.
 */
const DUST_SPEND_SIZE_ALLOWANCE = 148;
const DUST_RELAY_FEE_PER_KB = 1_000;

/** `consensus` cannot be suppressed by any argument; `policy` can, by an explicit caller opt-out. */
export type FinalizedByteRegime = 'consensus' | 'policy';

export interface FinalizedByteRule {
  /** Stable diagnostic name. A refusal quotes this, so it must not be reworded silently. */
  id: string;
  regime: FinalizedByteRegime;
  scope: 'transaction' | 'input' | 'output';
  /** The number, or the arithmetic when the threshold is per-subject. */
  threshold: string;
  /** Where the threshold comes from, and how well it is known. */
  source: string;
}

/**
 * THE RULE SET. Byte rules only: everything here is decidable from the finalized transaction with no VM.
 *
 * The regime split is load-bearing and is not a severity ranking dressed up. The 100,000-byte ceiling is
 * POLICY, established on a real BCHN v29 node: the same 101,513 bytes were refused `64: tx-size` through the
 * mempool and ACCEPTED in a hand-assembled block. Conflating it with the 1,000,000-byte consensus figure would
 * refuse transactions a miner will include; conflating them the other way would call an invalid transaction
 * merely unrelayable.
 */
export const FINALIZED_BYTE_RULES: readonly FinalizedByteRule[] = Object.freeze([
  {
    id: 'relay-transaction-size',
    regime: 'policy',
    scope: 'transaction',
    threshold: `${RELAY_TRANSACTION_SIZE_LIMIT} serialized bytes`,
    source: 'NODE MEASURED, byte-exact. BCHN v29 applies the size policy BEFORE input lookup: 100,000 bytes '
      + 'reaches the loop and reports `missing-inputs`, 100,001 is refused `64: tx-size`. The same 101,513 '
      + 'bytes were separately accepted in a hand-assembled block, so this is policy and not consensus.',
  },
  {
    id: 'consensus-transaction-size',
    regime: 'consensus',
    scope: 'transaction',
    threshold: `${CONSENSUS_TRANSACTION_SIZE_LIMIT} serialized bytes`,
    source: 'libauth `ConsensusBch2026.maximumTransactionLengthBytes`. Kept separate from the relay ceiling so '
      + 'the two are never conflated: a shape between them is mineable and unrelayable, which is a different '
      + 'verdict from invalid.',
  },
  {
    id: 'output-dust',
    regime: 'policy',
    scope: 'output',
    threshold: `3 * (serialized output bytes + ${DUST_SPEND_SIZE_ALLOWANCE}) satoshis`,
    source: 'NODE MEASURED. BCHN refused C1 `64: dust` for a 10-satoshi output to a one-byte script against a '
      + '474-satoshi threshold. OP_RETURN outputs are exempt, matching both BCHN `IsStandardTx` and the SDK '
      + 'own `validateOutput`.',
  },
  {
    id: 'relay-locking-bytes',
    regime: 'policy',
    scope: 'output',
    threshold: `${RELAY_LOCKING_BYTES_LIMIT} locking bytecode bytes`,
    source: 'libauth `ConsensusBch2026.maximumStandardLockingBytecodeLength`. Measured against the BARE '
      + 'locking bytecode, not the token-prefixed serialization. Whether BCHN applies this to the prefixed '
      + 'form is UNVERIFIED here, and measuring the prefixed form would refuse an honest p2sh32 state output '
      + 'carrying a 128-byte commitment and a fungible amount at 203 bytes; under-refusing is the correct '
      + 'direction while the applicability is uncertain. The two message bus send paths agree on this number by '
      + 'measurement: `decodeTransactionUnsafe` splits the token prefix back out, so a built transaction and '
      + 'the decoded broadcast bytes report the same bare length.',
  },
  {
    id: 'relay-data-carrier',
    regime: 'policy',
    scope: 'output',
    threshold: `${RELAY_DATA_CARRIER_LIMIT} bytes of OP_RETURN locking bytecode`,
    source: 'NODE MEASURED as a class: BCHN refused an OP_RETURN carrying 300 bytes with '
      + '`64: oversize-op-return`. The exact boundary was not measured on a node; the number is libauth '
      + '`maximumDataCarrierBytes`, which matches BCHN default `-datacarriersize`.',
  },
  {
    id: 'scriptsig-push-only',
    regime: 'policy',
    scope: 'input',
    threshold: 'unlocking bytecode must be a pure push sequence: every opcode <= OP_16 (0x60)',
    source: 'NODE MEASURED. BCHN refuses `64: scriptsig-not-pushonly`; a non-push-only scriptSig was put in '
      + 'front of the node and refused with exactly that. The predicate matches `CScript::IsPushOnly` to the '
      + 'opcode, OP_RESERVED included - see `isPushOnlyBytecode`.',
  },
  {
    id: 'consensus-unlocking-bytes',
    regime: 'consensus',
    scope: 'input',
    threshold: `${CONSENSUS_UNLOCKING_BYTES_LIMIT} unlocking bytecode bytes`,
    source: 'libauth `ConsensusBch2026.maximumBytecodeLength`. The standard ceiling coincides: X49 accepted a '
      + '6,035-byte scriptSig on the node, so the legacy 1,650-byte standard limit is gone in v29 and one rule '
      + 'expresses both. Reported here as well as in the VM because the VM reads the provider limits, which on '
      + 'every message bus test are 100x this figure.',
  },
  /*
   * `standard-output-template` IS DELIBERATELY ABSENT AND MUST NOT BE RE-ADDED WITHOUT A NEW MEASUREMENT.
   *
   * It was measured against `mainnet/bitcoin-cash-node:v29.0.0`, on a throwaway container started with an
   * explicit `-acceptnonstdtxn=0`, and BCHN does not enforce it: a bare `OP_1` output was funded, accepted,
   * mined, and then spent with an EMPTY unlocking script. The same one-byte script at 10 satoshis is refused
   * `64: dust`, which proves the per-output policy loop runs and reaches that script - it looked and declined
   * to refuse.
   *
   * A rule that refuses more than the node does is wrong, not conservative. Keeping this one would have taken
   * two working shapes out of the envelope over eighteen fixtures that build a bare `OP_1` output.
   */
]);

const finalizedRuleById = new Map(FINALIZED_BYTE_RULES.map((rule) => [rule.id, rule]));

/** Look a rule up by the id a refusal quotes, so a caller can check a diagnostic against its rule. */
export const finalizedByteRule = (id: string): FinalizedByteRule | undefined => finalizedRuleById.get(id);

/**
 * WHAT THIS GATE CANNOT SEE, stated as scope rather than left as an omission. An envelope claiming
 * completeness it does not have is worse than a narrow one that says where it stops.
 *
 * Each entry names a real refusal class this gate does not decide and why it is out of scope here, so a reader
 * never mistakes an ADMIT for "the network will accept this".
 */
export const FINALIZED_BYTE_GATE_BLIND_SPOTS: readonly string[] = Object.freeze([
  'VM-priced rules - operation-cost density, hash-iteration density, per-input and per-transaction SigChecks. '
  + 'They need an evaluation, not bytes. `evaluateEveryInput` owns that surface and currently runs at the '
  + 'PROVIDER limits, which is an open contradiction (X109/X121) this gate deliberately does not touch.',
  'Minimum relay fee. Computable from these bytes, and DELIBERATELY not a rule: unlike dust, this class is '
  + 'not invisible. `MockNetworkProvider` already publishes `minRelayFeePerKb: 1000n` to its verifier '
  + 'unconditionally, so every fixture that broadcasts through the mock has already been judged against it, '
  + 'and the SDK own `checkMaxFee` covers the other direction. The threshold is also not node-measured on '
  + 'this effort. A rule here would add a second decider for a class that already has one.',
  'More than one OP_RETURN output (`multi-op-return`). BCHN enforces it; nobody here has measured it.',
  'The rest of `IsStandardTx`: version range, mempool ancestor and descendant limits, and the transaction '
  + 'version policy. Seven byte rules are not the complete standardness set and this list is not exhaustive.',
  'Anything about chain state - double spends, mempool conflicts, missing or already-spent inputs, coinbase '
  + 'maturity, locktime and sequence finality. These are not properties of the bytes.',
  'Consensus minimum transaction size. libauth publishes 65 bytes and BCHN enforces 100; the two disagree and '
  + 'no admissible message bus composition comes within an order of magnitude of either, so a rule here would be '
  + 'a guard that cannot fire on its own subject.',
  'Whether a covenant is satisfied. That is what the VM evaluation is for, and this gate is not a security '
  + 'boundary in any case.',
]);

export interface FinalizedByteRefusal {
  rule: string;
  regime: FinalizedByteRegime;
  where: string;
  measured: number;
  allowed: number;
  /** How far past the limit, in the rule's own units. Always positive. */
  overBy: number;
  detail: string;
}

/**
 * What an input SPENDS, so an input-scoped refusal can name it. X158.
 *
 * `consensus-unlocking-bytes` reports the input index and the byte count, and that is not enough to act on: an
 * over-limit spend's cause is a CONTRACT, and the index alone does not name it. Worse, the compiler's own
 * `contract-size-limit` diagnostic and this rule measure DIFFERENT subjects, so the contract named there is not
 * the set refused here - see `describeInputSubject`.
 *
 * Optional and additive. A subject is a LABEL appended to the detail; no rule reads one, no threshold moves,
 * and a caller that supplies none gets the identical verdict it got before.
 */
export interface FinalizedByteSubject {
  /** Contract name, when the input is a contract spend. */
  contractName?: string;
  /** Bytes of the redeem script the unlocking bytecode carries (constructor arguments included). */
  redeemBytes?: number;
}

export interface FinalizedByteReading {
  rule: string;
  where: string;
  measured: number;
  allowed: number;
  /** Utilization. Above 1 means the rule is broken. */
  ratio: number;
}

export interface FinalizedByteVerdict {
  admitted: boolean;
  /** Every violated rule, not just the first: a caller shrinking one limit needs to know about the others. */
  refusals: readonly FinalizedByteRefusal[];
  /** Utilization of every rule that produced a number, worst first. The head is what binds. */
  readings: readonly FinalizedByteReading[];
  serializedBytes: number;
  inputCount: number;
  outputCount: number;
  /** Total satoshis in outputs. Reported so a caller can compute a fee rate this gate does not judge. */
  outputSatoshis: bigint;
}

export interface FinalizedByteGateOptions {
  /** Explicit mock-consensus overrides. Real providers should leave these undefined. */
  consensusLimits?: { maximumInputBytes?: number; maximumTransactionBytes?: number };
  /**
   * Admit a transaction whose only refusals are POLICY. This is the mineable-but-unrelayable case: a shape
   * between the 100,000-byte relay ceiling and the 1,000,000-byte consensus ceiling is valid, and a caller
   * submitting directly to a miner is not wrong to build it.
   *
   * It can never suppress a `consensus` refusal, and it is not a provider field on purpose: reading
   * `provider.policy.enforceDust` is exactly how the dust rule came to be present, correct and switched off.
   * Suppressing a policy refusal cannot make an invalid transaction valid, so this widens nothing.
   */
  allowNonRelayable?: boolean;
  /**
   * What each input spends, indexed by input. Purely descriptive: it appends a label to an input-scoped
   * refusal and can neither create nor suppress one. `inputSubjectsOfBuilder` reads it off a builder.
   */
  inputSubjects?: readonly (FinalizedByteSubject | undefined)[];
  /**
   * PredOut preflight claims: compose-discovered PredOut physical claims threaded into the finalized-tx layout assert.
   * Without these, PredOut checks stay compose-path-only.
   */
  predOutClaimsByParticipant?: ReadonlyMap<number, ReadonlyArray<{
    witnessName: string;
    physicalLocalOffset: number;
    concreteLocalSlot?: number;
  }>>;
}

/**
 * Destination profile proven by a successful exact message-bus preflight. Kept outside TransactionBuilder's
 * public options so relay/consensus policy cannot become another application-controlled construction switch.
 * The final send still reassesses its current bytes; the receipt carries only which destination rules apply.
 */
const finalizedByteGateReceipts = new WeakMap<TransactionBuilder, FinalizedByteGateOptions>();

export const finalizedByteGateReceiptOf = (
  builder: TransactionBuilder,
): FinalizedByteGateOptions | undefined => finalizedByteGateReceipts.get(builder);

/**
 * Make the finalized-byte gate judge the same profile as its destination provider.
 *
 * `consensusLimits` is already the provider's consensus authority, so a second boolean deciding whether those
 * limits count would be contradictory. A transaction profile wider than the standard relay ceiling identifies
 * a direct-submit/private profile; policy observations remain in the verdict but do not block that path.
 */
export const finalizedByteGateOptionsForProvider = (
  provider: Pick<NetworkProvider, 'consensusLimits'>,
): FinalizedByteGateOptions => ({
  ...(provider.consensusLimits === undefined ? {} : { consensusLimits: provider.consensusLimits }),
  ...((provider.consensusLimits?.maximumTransactionBytes ?? RELAY_TRANSACTION_SIZE_LIMIT)
    > RELAY_TRANSACTION_SIZE_LIMIT ? { allowNonRelayable: true } : {}),
});

/**
 * Read each input's subject off a builder, for the gate's message. X158.
 *
 * A contract input publishes both halves; anything else - a P2PKH input, a side-car, a custom unlocker -
 * yields `undefined` and the refusal reads exactly as it did before. `contract.bytecode` is a HEX STRING of
 * the redeem script, so its byte length is `.length / 2`; measuring it as characters is the X148/X153 unit
 * error, and it would report a contract at twice its size here.
 */
export const inputSubjectsOfBuilder = (
  builder: Pick<TransactionBuilder, 'inputs'>,
): (FinalizedByteSubject | undefined)[] => builder.inputs.map((input) => {
  const unlocker = input.unlocker as { contract?: { name?: string; bytecode?: string } } | undefined;
  const contract = unlocker?.contract;
  if (contract === undefined) return undefined;
  return {
    contractName: contract.name,
    redeemBytes: typeof contract.bytecode === 'string' ? contract.bytecode.length / 2 : undefined,
  };
});

/**
 * Name the contract behind an over-limit input, and say where its bytes went. X158.
 *
 * THE TWO SUBJECTS ARE NOT THE SAME SET, which is the whole reason this text exists. `solidc` warns when
 * `scriptToBytecode(script).length > 10_000` - the UN-CONSTRUCTED script. Consensus limits the UNLOCKING
 * BYTECODE, which is that script PLUS the constructor-argument pushes baked into the redeem script, PLUS the
 * redeem push prefix, PLUS every call argument. Measured on one contract family: the compiler is silent at
 * 9,878 script bytes and the spend is refused by 3, so the true boundary sits 122 bytes below the compiler's
 * threshold and every contract in that band compiles clean and cannot be spent.
 *
 * `redeemBytes` is what a `Contract` publishes as its locking script preimage, so `unlockingBytes -
 * redeemBytes` is exactly the argument and push-prefix overhead - reported rather than re-derived, because a
 * re-derivation would be a second place to get the same arithmetic wrong.
 */
const describeInputSubject = (subject: FinalizedByteSubject, unlockingBytes: number): string => {
  const name = subject.contractName === undefined ? 'an unnamed contract' : `contract '${subject.contractName}'`;
  if (subject.redeemBytes === undefined) return `; input spends ${name}`;
  const overhead = unlockingBytes - subject.redeemBytes;
  if (subject.redeemBytes > CONSENSUS_UNLOCKING_BYTES_LIMIT) {
    return `; it spends ${name}, whose redeem script is ${subject.redeemBytes} bytes on its own - already `
      + `${subject.redeemBytes - CONSENSUS_UNLOCKING_BYTES_LIMIT} over the limit before any of its `
      + `${overhead} bytes of arguments and redeem push`;
  }
  return `; it spends ${name}, whose ${subject.redeemBytes}-byte redeem script fits the limit on its own but `
    + `leaves only ${CONSENSUS_UNLOCKING_BYTES_LIMIT - subject.redeemBytes} bytes for the ${overhead} bytes of `
    + 'arguments and redeem push it must also carry. The limit is on the WHOLE unlocking bytecode, so a '
    + "contract the compiler's script-size check passes can still be unspendable";
};

const serializedOutputBytes = (output: Output): number => encodeTransactionOutput(output).length;

/** BCHN's dust floor for one output, in satoshis. */
export const finalizedOutputDustThreshold = (output: Output): number => Math.ceil(
  3 * (serializedOutputBytes(output) + DUST_SPEND_SIZE_ALLOWANCE) * DUST_RELAY_FEE_PER_KB / 1_000,
);

const isOpReturnOutput = (output: Output): boolean =>
  output.lockingBytecode.length > 0 && output.lockingBytecode[0] === 0x6a;

/**
 * A pure push sequence, which is what `scriptsig-not-pushonly` requires.
 *
 * MATCHES `CScript::IsPushOnly` EXACTLY, INCLUDING ITS ONE SURPRISE: every opcode up to and including OP_16
 * (0x60) is push-only, so OP_RESERVED (0x50) IS push-only even though executing it fails. The node's own
 * comment says so. This function first refused 0x50, which would have refused a scriptSig BCHN accepts - the
 * wrong direction, and not made right by 0x50 being useless. Nothing is widened by admitting it either: the
 * VM evaluation runs first on both send paths and refuses OP_RESERVED on its own.
 *
 * A truncated push is NOT push-only, matching `GetOp` failing.
 *
 * Deliberately not shared with any "redeem script length" helper: those return 0 both for "not push-only" and
 * for "an empty final push", which would conflate a refusal with a legal shape.
 */
export function isPushOnlyBytecode(bytecode: Uint8Array): boolean {
  let cursor = 0;
  while (cursor < bytecode.length) {
    const opcode = bytecode[cursor];
    cursor += 1;
    let length: number;
    if (opcode <= 0x4b) length = opcode;
    else if (opcode === 0x4c) {
      length = bytecode[cursor];
      cursor += 1;
    } else if (opcode === 0x4d) {
      length = bytecode[cursor] | (bytecode[cursor + 1] << 8);
      cursor += 2;
    } else if (opcode === 0x4e) {
      length = bytecode[cursor] | (bytecode[cursor + 1] << 8)
        | (bytecode[cursor + 2] << 16) | (bytecode[cursor + 3] << 24);
      cursor += 4;
    } else if (opcode <= 0x60) length = 0; // OP_1NEGATE, OP_RESERVED and OP_1..OP_16
    else return false;
    if (!Number.isFinite(length) || length < 0 || cursor + length > bytecode.length) return false;
    cursor += length;
  }
  return true;
}

/**
 * Decide ONE finalized transaction against the byte rules. Pure: no builder, no provider, no plan.
 *
 * Not a plan, because the bytes are what a node judges and a plan is not the bytes - the same plan built twice
 * can differ by an output and one of the two be refused. Not a provider, because the relaxed limits every
 * message bus test publishes are exactly what made the existing capacity checks vacuous.
 */
export function assessFinalizedTransactionBytes(
  transaction: Transaction, subjects: readonly (FinalizedByteSubject | undefined)[] = [],
  consensusLimits: FinalizedByteGateOptions['consensusLimits'] = {},
): FinalizedByteVerdict {
  const refusals: FinalizedByteRefusal[] = [];
  const readings: FinalizedByteReading[] = [];
  const serializedBytes = encodeTransaction(transaction).length;
  const maximumTransactionBytes = consensusLimits.maximumTransactionBytes
    ?? CONSENSUS_TRANSACTION_SIZE_LIMIT;
  const maximumInputBytes = consensusLimits.maximumInputBytes ?? CONSENSUS_UNLOCKING_BYTES_LIMIT;
  const refuse = (
    rule: string, where: string, measured: number, allowed: number, detail: string,
  ): void => {
    refusals.push({
      rule, regime: finalizedRuleById.get(rule)!.regime, where, measured, allowed,
      overBy: measured - allowed, detail,
    });
  };

  /* --- transaction scope --- */
  readings.push({
    rule: 'relay-transaction-size',
    where: 'transaction',
    measured: serializedBytes,
    allowed: RELAY_TRANSACTION_SIZE_LIMIT,
    ratio: serializedBytes / RELAY_TRANSACTION_SIZE_LIMIT,
  });
  if (serializedBytes > RELAY_TRANSACTION_SIZE_LIMIT) {
    refuse('relay-transaction-size', 'transaction', serializedBytes, RELAY_TRANSACTION_SIZE_LIMIT,
      `${serializedBytes} serialized bytes is ${serializedBytes - RELAY_TRANSACTION_SIZE_LIMIT} over the `
      + `${RELAY_TRANSACTION_SIZE_LIMIT}-byte standard relay ceiling; a node refuses these bytes with `
      + '`64: tx-size` before it looks up a single input, though a miner may still include them');
  }
  readings.push({
    rule: 'consensus-transaction-size',
    where: 'transaction',
    measured: serializedBytes,
    allowed: maximumTransactionBytes,
    ratio: serializedBytes / maximumTransactionBytes,
  });
  if (serializedBytes > maximumTransactionBytes) {
    refuse('consensus-transaction-size', 'transaction', serializedBytes, maximumTransactionBytes,
      `${serializedBytes} serialized bytes is ${serializedBytes - maximumTransactionBytes} over the `
      + `${maximumTransactionBytes}-byte consensus ceiling; these bytes are invalid however they are `
      + 'transported, not merely unrelayable');
  }

  /* --- input scope --- */
  let worstUnlocking = { input: -1, bytes: 0 };
  transaction.inputs.forEach((input, index) => {
    const bytes = input.unlockingBytecode.length;
    if (bytes > worstUnlocking.bytes) worstUnlocking = { input: index, bytes };
    if (bytes > maximumInputBytes) {
      const subject = subjects[index];
      refuse('consensus-unlocking-bytes', `input ${index}`, bytes, maximumInputBytes,
        `${bytes} unlocking bytecode bytes is ${bytes - maximumInputBytes} over the `
        + `${maximumInputBytes}-byte per-input script limit`
        + (subject === undefined ? '' : describeInputSubject(subject, bytes)));
    }
    if (!isPushOnlyBytecode(input.unlockingBytecode)) {
      refuse('scriptsig-push-only', `input ${index}`, 1, 0,
        'unlocking bytecode is not a pure push sequence; a node refuses `64: scriptsig-not-pushonly`');
    }
  });
  if (worstUnlocking.input >= 0) {
    readings.push({
      rule: 'consensus-unlocking-bytes',
      where: `input ${worstUnlocking.input}`,
      measured: worstUnlocking.bytes,
      allowed: maximumInputBytes,
      ratio: worstUnlocking.bytes / maximumInputBytes,
    });
  }

  /* --- output scope --- */
  let worstDust = { output: -1, ratio: 0, satoshis: 0, threshold: 0 };
  let worstLocking = { output: -1, bytes: 0 };
  let outputSatoshis = 0n;
  transaction.outputs.forEach((output, index) => {
    outputSatoshis += output.valueSatoshis;
    const locking = output.lockingBytecode.length;
    if (isOpReturnOutput(output)) {
      if (locking > RELAY_DATA_CARRIER_LIMIT) {
        refuse('relay-data-carrier', `output ${index}`, locking, RELAY_DATA_CARRIER_LIMIT,
          `${locking} bytes of OP_RETURN locking bytecode is ${locking - RELAY_DATA_CARRIER_LIMIT} over the `
          + `${RELAY_DATA_CARRIER_LIMIT}-byte data-carrier allowance; a node refuses `
          + '`64: oversize-op-return`');
      }
      // OP_RETURN is exempt from dust and is not judged against the standard locking-bytecode ceiling, both
      // matching BCHN: a null-data output is its own template.
      return;
    }
    if (locking > worstLocking.bytes) worstLocking = { output: index, bytes: locking };
    if (locking > RELAY_LOCKING_BYTES_LIMIT) {
      refuse('relay-locking-bytes', `output ${index}`, locking, RELAY_LOCKING_BYTES_LIMIT,
        `${locking} locking bytecode bytes is ${locking - RELAY_LOCKING_BYTES_LIMIT} over the `
        + `${RELAY_LOCKING_BYTES_LIMIT}-byte standard allowance`);
    }
    const threshold = finalizedOutputDustThreshold(output);
    const satoshis = Number(output.valueSatoshis);
    // Ratio inverted deliberately: dust is a FLOOR, so utilization is threshold-over-value and an output at
    // exactly the threshold reads 1.0000x like every other rule at its boundary.
    const ratio = satoshis === 0 ? Infinity : threshold / satoshis;
    if (ratio > worstDust.ratio) worstDust = { output: index, ratio, satoshis, threshold };
    if (satoshis < threshold) {
      refuse('output-dust', `output ${index}`, threshold, satoshis,
        `${satoshis} satoshis is ${threshold - satoshis} short of the ${threshold}-satoshi dust threshold for `
        + `a ${serializedOutputBytes(output)}-byte output (3 * (${serializedOutputBytes(output)} + `
        + `${DUST_SPEND_SIZE_ALLOWANCE})); a node refuses \`64: dust\``);
    }
  });
  if (worstLocking.output >= 0) {
    readings.push({
      rule: 'relay-locking-bytes',
      where: `output ${worstLocking.output}`,
      measured: worstLocking.bytes,
      allowed: RELAY_LOCKING_BYTES_LIMIT,
      ratio: worstLocking.bytes / RELAY_LOCKING_BYTES_LIMIT,
    });
  }
  if (worstDust.output >= 0) {
    readings.push({
      rule: 'output-dust',
      where: `output ${worstDust.output}`,
      measured: worstDust.threshold,
      allowed: worstDust.satoshis,
      ratio: worstDust.ratio,
    });
  }

  readings.sort((left, right) => right.ratio - left.ratio);
  return {
    admitted: refusals.length === 0,
    refusals,
    readings,
    serializedBytes,
    inputCount: transaction.inputs.length,
    outputCount: transaction.outputs.length,
    outputSatoshis,
  };
}

/** One-line summary of a verdict: what bound, how hard, and every refusal. */
export function formatFinalizedByteVerdict(verdict: FinalizedByteVerdict): string {
  const binding = verdict.readings[0];
  return [
    verdict.admitted ? 'ADMITTED' : 'REFUSED',
    `inputs=${verdict.inputCount}`,
    `outputs=${verdict.outputCount}`,
    `serialized=${verdict.serializedBytes}B`,
    binding === undefined ? 'binds=none'
      : `binds=${binding.rule} ${binding.ratio.toFixed(4)}x at ${binding.where}`,
    verdict.refusals.length === 0 ? 'refusals=none'
      : `refusals=${verdict.refusals.map((row) => `${row.regime}:${row.rule}@${row.where}`).join(',')}`,
  ].join(' | ');
}

const enforcedFinalizedByteRefusals = (
  verdict: FinalizedByteVerdict, allowNonRelayable: boolean | undefined,
): readonly FinalizedByteRefusal[] => allowNonRelayable === true
  ? verdict.refusals.filter((row) => row.regime === 'consensus')
  : verdict.refusals;

/**
 * THE GATE. Refuse a finalized transaction that breaks a byte rule.
 *
 * Consensus and policy are reported separately and cannot be collapsed: `allowNonRelayable` admits a
 * policy-only refusal and has no effect on a consensus one. A message always names every violated rule, its
 * regime, and the arithmetic that produced the limit, because a caller who fixes only the first refusal has
 * learned nothing about the second.
 */
export function assertFinalizedTransactionBytes(
  transaction: Transaction, options: FinalizedByteGateOptions = {},
): FinalizedByteVerdict {
  const verdict = assessFinalizedTransactionBytes(
    transaction, options.inputSubjects ?? [], options.consensusLimits,
  );
  const policy = verdict.refusals.filter((row) => row.regime === 'policy');
  const enforced = enforcedFinalizedByteRefusals(verdict, options.allowNonRelayable);
  if (enforced.length === 0) return verdict;
  const lines = enforced.map((row) => `  [${row.regime}] ${row.rule} at ${row.where}: ${row.detail}`);
  const suppressed = options.allowNonRelayable === true && policy.length > 0
    ? `\n  (${policy.length} policy refusal(s) suppressed by allowNonRelayable: `
      + `${policy.map((row) => row.rule).join(', ')})`
    : '';
  const binding = enforced[0];
  throw new MessageBusDiagnosticError(
    'MESSAGE_BUS_FINALIZED_BYTE_LIMIT',
    `messageBus: finalized transaction refused by ${enforced.length} byte rule(s) `
    + `(${verdict.serializedBytes} serialized bytes, ${verdict.inputCount} inputs, `
    + `${verdict.outputCount} outputs):\n${lines.join('\n')}${suppressed}`,
    {
      rule: binding.rule,
      resourceIdentity: binding.where,
      measured: binding.measured,
      limit: binding.allowed,
      ...(binding.where.startsWith('input ') && { inputIndex: Number(binding.where.slice(6)) }),
    },
    true,
  );
}

/**
 * X175/X186. THE COVENANT'S OWN OBJECTION to a finalized transaction, or undefined when every input evaluates.
 *
 * The same per-input BCH-2026 evaluation `sendPreflightedMessageBusTransaction` runs, from the same
 * provider-derived factory `StatefulTransactionBuilder._strictRecursiveVmPreflight` uses, which at
 * `@mem-cash/validation` 0.0.8 agrees with the mock's own decider on every shape measured (X121).
 *
 * `debug()` IS NOT THE INSTRUMENT TO REACH FOR at any of the sites that route through here. The four
 * `StatefulContract` lifecycle-admin sites bypass it outright; `TransactionBuilder.send` debugs a COVENANT
 * input best-effort and SWALLOWS the result, and does not debug a custom unlocker at all. Evaluating the
 * finalized bytes needs no wallet template and no swallowing.
 *
 * NEVER THROWS, and that is load-bearing: it annotates a refusal that is already decided, so a harness that
 * cannot supply source outputs must leave the byte refusal exactly as it was rather than replace it.
 *
 * X186. IT ASKS `stateSuccess`, NOT `state.error`, AND THE DIFFERENCE IS A WHOLE FAILURE CLASS. `evaluate`
 * reports only errors raised BY an operation; a script that runs to completion and leaves a FALSY item on top
 * has no `error` at all, so reading the field alone declared a broken covenant clean and let its refusal report
 * bytes only - the absorption shape this whole mechanism exists to remove, surviving inside the instrument
 * meant to close it. Measured on a one-byte `OP_0` locking script paying dust: `state.error` undefined,
 * `stateSuccess` `Unsuccessful evaluation: completed with a non-truthy value on top of the stack. Top stack
 * item: ""`, which is the SAME sentence the provider's own `verify` produces for those bytes. libauth's
 * `success` returns `state.error` when there is one and checks truthiness otherwise, so this is a strict
 * widening that cannot lose a message it used to report - and it can only ever annotate a refusal that has
 * already been decided, never create one.
 */
export function covenantObjectionOf(
  builder: TransactionBuilder, transaction: Transaction,
): string | undefined {
  try {
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const objection = vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }));
      if (objection !== true) return `input ${inputIndex}: ${objection}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * X175/X186. THE BYTE GATE WHEREVER NO DECIDER IS GUARANTEED TO HAVE SPOKEN FIRST. It reports BOTH objections,
 * so the ordering it used to have cannot matter.
 *
 * WHAT THE ORDERING COST. At a site with no covenant verdict ahead of it the gate is the first decider to
 * speak, and a transaction that broke its covenant AND paid dust reported the dust. That is the exact shape
 * that made the seventh vacuous guard on this effort: a hostile test whose loose match absorbed a new gate's
 * dust error and kept passing while its rejection was no longer the forgery's. Pinning the window with an
 * ordering row recorded the hazard; it did not remove it, because any future hostile that pays dust and
 * matches loosely walks back into it.
 *
 * SO NEITHER OBJECTION IS ALLOWED TO MASK THE OTHER. When the bytes are refused this asks the covenant too, and
 * a transaction that breaks both names both - covenant FIRST, matching the ordering principle every other live
 * site already follows ("a transaction that cannot execute reports its semantic cause"). A test matching on the
 * covenant's message and a test matching on the byte rule now both find their own subject, whichever fires.
 *
 * WHERE IT IS ROUTED. The four `StatefulContract` lifecycle-admin sites (destroy, split, merge,
 * `_sendRawBuilder`), which bypass `debug()`, and `TransactionBuilder.send`, whose two residual windows are a
 * COVENANT input (debugged best-effort, result swallowed) and a CUSTOM UNLOCKER (not debugged at all). The
 * `send` window is why this lives here rather than beside its first caller.
 *
 * THE BLAST RADIUS IS THE SET THE GATE ALREADY REFUSED, and nothing else. The VM is consulted only on a path
 * that has already decided to throw, so no transaction that used to settle can now fail, and it costs nothing
 * on the admitted path because the bytes are assessed FIRST and an admitted verdict returns before anything
 * else runs. A byte-only refusal keeps its message byte for byte - `assertFinalizedTransactionBytes` still
 * produces it. `admitted` decides the branch rather than the refusal list because these sites pass no
 * `allowNonRelayable`, so every refusal is enforced and `admitted === false` is exactly "the assert throws".
 *
 * NOT A SECURITY BOUNDARY. The SDK is an untrusted witness constructor and an attacker does not call
 * `StatefulContract.split` or `TransactionBuilder.send`. A composer reads two causes here instead of building,
 * funding, signing and broadcasting twice to find the second one.
 */
export function assertFinalizedBytesWithCovenant(
  builder: TransactionBuilder, transaction: Transaction,
  subjects: readonly (FinalizedByteSubject | undefined)[],
  options: Omit<FinalizedByteGateOptions, 'inputSubjects'> = {},
): void {
  const verdict = assessFinalizedTransactionBytes(transaction, subjects, options.consensusLimits);
  const enforced = enforcedFinalizedByteRefusals(verdict, options.allowNonRelayable);
  if (enforced.length === 0) return;
  const covenant = covenantObjectionOf(builder, transaction);
  // Byte-only: the one decider that speaks is the one that always spoke, with the message it always produced.
  if (covenant === undefined) {
    assertFinalizedTransactionBytes(transaction, {
      inputSubjects: subjects,
      consensusLimits: options.consensusLimits,
      allowNonRelayable: options.allowNonRelayable,
    });
  }
  throw new Error(
    `messageBus: finalized transaction refused by its covenant and ${enforced.length} byte rule(s) `
    + `(${verdict.serializedBytes} serialized bytes, ${verdict.inputCount} inputs, `
    + `${verdict.outputCount} outputs):\n  [covenant] ${covenant}\n`
    + enforced.map((row) => `  [${row.regime}] ${row.rule} at ${row.where}: ${row.detail}`).join('\n'),
  );
}

/**
 * X198. THE COVENANT DECIDER FOR BOTH MESSAGE BUS ENTRY POINTS, and it asks `stateSuccess` for the same reason
 * `covenantObjectionOf` does - except this one THROWS, so the field it read was a fail-closed boundary.
 *
 * IT USED TO READ `state.error`, WHICH IS A STRICT SUBSET OF THE VM'S OWN VERDICT. libauth's BCH instruction
 * set defines `success(state)` as "return `state.error` if there is one, otherwise refuse an empty stack or a
 * non-truthy top item", and `createVirtualMachine` hands that same function to `vm.verify`. So `stateSuccess`
 * IS the VM's verification predicate and `state.error` is only its first branch. The DEMONSTRATED gap is the
 * non-truthy top item: it produced a full objection that this function never looked at, admitted the
 * transaction, and passed the bytes to the byte rules and then to the network. (The empty-stack branch is NOT
 * demonstrated - BCH's clean-stack rule raises before it can fire - and row 2b of the test records that.)
 *
 * THE CLASS IS WHAT THE COMPILER EMITS, not a curiosity. `GenerateTargetTraversal` deletes the final
 * `require`'s OP_VERIFY when the stack is shallow ("If the final op is OP_VERIFY and the stack size is less
 * than 4 we remove it from the script"), so a plain contract's LAST check leaves its boolean on the stack
 * rather than verifying it: `require(v == brand)` compiles to a script ending in OP_NUMEQUAL, and its failure
 * raises nothing. `X198SubmitCovenantAbsorption` builds a real two-participant composition whose fee-slot
 * covenant fails exactly that way and measures both halves - `covenantObjectionOf` naming `input 7`, and this
 * function admitting the same bytes.
 *
 * THE WIDENING CANNOT LOSE A MESSAGE. `success` returns `state.error` verbatim when there is one, so every
 * diagnostic this produced before it produces byte for byte, at the same input index.
 *
 * THE BLAST RADIUS WAS MEASURED, NOT ASSUMED. A census instrumented this function to log every objection the
 * VM PRODUCED alongside whether the old `state.error` read OBSERVED it, over the message bus population that can
 * reach here. Across all three capstones plus two further graph fixtures - 179 tests - the VM produced 84
 * objections and the old read saw all 84: every one was a raised error (82 OP_VERIFY, 2 OP_SPLIT). The
 * population never steers into the window, which is why it survived X186; the evidence that it is real is
 * CONSTRUCTED, not sampled. The mock provider refuses the constructed shape on its own, so this only moves the
 * refusal earlier and never disagrees with the network.
 */
/** Snapshot mutable VM callback state before its next instruction changes the stack or instruction pointer. */
export function snapshotPreflightDiagnosticState<T extends { stack: Uint8Array[] }>(state: T): T {
  return { ...state, stack: state.stack.map((item) => item.slice()) };
}

export function shouldCapturePreflightDiagnosticInput(inputIndex: number, requestedInput?: number): boolean {
  return requestedInput === undefined || inputIndex === requestedInput;
}

const evaluateEveryInput = (
  builder: TransactionBuilder, transaction: Transaction,
): void => {
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
    console.error('preflight-provider-limits', builder.provider?.consensusLimits);
  }
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  // Diagnostic: name the two operands a coverage/identity comparison reads. A failing OP_EQUALVERIFY reports only
  // "failedVerify" and leaves neither operand, so `message-bus-failure-point` cannot say whether the INDEX or the
  // EXPECTED value was wrong. The shapes that matter here read an output bytecode and then pick the expected value,
  // so hook OP_OUTPUTBYTECODE and print both operands when the next three operations are `OP_3; OP_PICK; OP_EQUALVERIFY`.
  const outputCompareDebug = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_OUTPUT_COMPARE === '1';
  // See `operands` in the failure dump: keeping the previous state makes a refusal's consumed operands readable
  // without a second, allocation-heavy evaluation. OP_INVOKE shares the stack, so this also shows which frame item
  // a misread coordinate actually resolved to.
  const failurePreStateDebug = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_FAILURE_POINT_PRE_STATE === '1';
  const failurePreStateInputValue = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_TRACE_INPUT;
  const failurePreStateInput = failurePreStateInputValue === undefined ? undefined : Number(failurePreStateInputValue);
  const resourceSlotIndexDebug = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_RESOURCE_SLOT_INDEX === '1';
  let resourceSlotIndexLogged = false;
  const returnCommitmentReads: Array<Record<string, unknown>> = [];
  // Keyed by the input the state belongs to: this one VM evaluates every input, so a single "last state" slot is
  // overwritten by whichever input runs last and would report another input's frame as the failure's operands
  // (measured: the dumped operands did not match the VM's own message for the failing split).
  // A short ring of recent pre-states per input. The reported failure comes from whichever pass failed LAST, so the
  // operands must be selected by instruction position rather than by pass: the terminal state's ip is one past the
  // failing instruction, so the entry whose `ip === evaluated.ip - 1` in the SAME instruction array is that
  // instruction's pre-state. (Earlier attempts keyed on "last state" or "first pass" reported another frame:
  // measured dumps at ip 22 of a 22-deep frame while the failure was ip 3 of a 6-instruction body.)
  const preStateRingByInput = new Map<number, AuthenticationProgramStateCommon[]>();
  const vm = createVirtualMachineBch2026ForProvider(builder.provider,
    (outputCompareDebug || failurePreStateDebug || resourceSlotIndexDebug) ? {
    opcodes: failurePreStateDebug
      ? new Set(Array.from({ length: 256 }, (_, opcode) => opcode))
      : resourceSlotIndexDebug
        ? new Set(Array.from({ length: 256 }, (_, opcode) => opcode))
        : new Set([Op.OP_OUTPUTBYTECODE, Op.OP_UTXOTOKENCOMMITMENT, Op.OP_OUTPUTTOKENCOMMITMENT]),
    beforeOperation: (unknownState) => {
      const resourceState = unknownState as AuthenticationProgramStateCommon;
      if (resourceSlotIndexDebug && resourceState.program?.inputIndex === 227
        && resourceState.instructions.length === 642 && [473, 475].includes(resourceState.ip)) {
        const depth = Number(vmNumberToBigInt(resourceState.stack.at(-1) ?? new Uint8Array()));
        console.error('graph-event-park', JSON.stringify({
          ip: resourceState.ip,
          depth,
          selected: resourceState.stack.at(-2 - depth) && binToHex(resourceState.stack.at(-2 - depth)!),
          stackDepth: resourceState.stack.length,
          top: resourceState.stack.slice(-12).map((item) => binToHex(item)),
        }));
      }
      if (resourceSlotIndexDebug
        && resourceState.program?.inputIndex === 227
        && resourceState.instructions.length === 13
        && resourceState.instructions[resourceState.ip]?.opcode === Op.OP_OUTPUTTOKENCOMMITMENT) {
        const outputIndex = Number(vmNumberToBigInt(resourceState.stack.at(-1) ?? new Uint8Array()));
        const output = resourceState.program.transaction.outputs[outputIndex];
        returnCommitmentReads.push({
          ip: resourceState.ip,
          outputIndex,
          expected: resourceState.stack.at(-2) && binToHex(resourceState.stack.at(-2)!),
          outputCommitment: output?.token?.nft && binToHex(output.token.nft.commitment),
        });
        if (returnCommitmentReads.length > 50) returnCommitmentReads.shift();
      }
      if (resourceSlotIndexDebug && !resourceSlotIndexLogged
        && resourceState.program?.inputIndex === 227
        && resourceState.instructions.length === 13 && resourceState.ip === 5) {
        const outputIndex = Number(vmNumberToBigInt(resourceState.stack.at(-1) ?? new Uint8Array()));
        const output = resourceState.program.transaction.outputs[outputIndex];
        if (output?.token === undefined) return;
        resourceSlotIndexLogged = true;
        console.error('resource-slot-index', JSON.stringify({
          inputIndex: resourceState.program.inputIndex,
          outputIndex,
          output: output === undefined ? undefined : {
            lockingBytecode: binToHex(output.lockingBytecode),
            category: output.token && binToHex(output.token.category),
            capability: output.token?.nft?.capability,
            commitment: output.token?.nft && binToHex(output.token.nft.commitment),
          },
          stack: resourceState.stack.slice(-6).map((item) => binToHex(item)),
        }));
      }
      if (failurePreStateDebug) {
        const captured = unknownState as AuthenticationProgramStateCommon;
        const ownedInput = captured.program?.inputIndex;
        if (typeof ownedInput === 'number' && shouldCapturePreflightDiagnosticInput(ownedInput, failurePreStateInput)) {
          const ring = preStateRingByInput.get(ownedInput) ?? [];
          ring.push(snapshotPreflightDiagnosticState(captured));
          // 256, not 64: an input can iterate a loop (or a convergence pass) more than 64 times, and at 64 the ring
          // held only the loop's own iterations - every entry the same ip, with the coordinate instructions that
          // built the failing operands already evicted.
          if (ring.length > 256) ring.splice(0, ring.length - 256);
          preStateRingByInput.set(ownedInput, ring);
        }
      }
      if (!outputCompareDebug) return;
      const state = unknownState as unknown as {
        ip: number;
        stack: Uint8Array[];
        instructions: Array<{ opcode: number }>;
        program?: { inputIndex?: number; transaction?: { outputs?: Array<{ lockingBytecode: Uint8Array }> } };
      };
      const { instructions, ip, stack } = state;
      if (ip < 2 || instructions[ip - 1]?.opcode !== Op.OP_DUP) return;
      if (instructions[ip + 1]?.opcode !== Op.OP_3 || instructions[ip + 2]?.opcode !== Op.OP_PICK) return;
      if (instructions[ip + 3]?.opcode !== Op.OP_EQUALVERIFY) return;
      const indexItem = stack.at(-1);
      const index = indexItem === undefined ? -1 : Number(vmNumberToBigInt(indexItem));
      const expected = stack[stack.length - 1 - 3];
      const output = state.program?.transaction?.outputs?.[index];
      console.error('output-compare-operands', JSON.stringify({
        inputIndex: state.program?.inputIndex,
        ip,
        programLength: instructions.length,
        index,
        actual: output === undefined ? undefined : binToHex(output.lockingBytecode),
        expected: expected === undefined ? undefined : `${expected.length}:${binToHex(expected)}`,
        stackDepth: stack.length,
      }));
    },
  } : undefined);
  const debugOnlyInputValue = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ONLY_PREFLIGHT_INPUT;
  const debugOnlyInput = debugOnlyInputValue === undefined ? undefined : Number(debugOnlyInputValue);
  // A suite can assemble several smaller transactions before the one under diagnosis. Narrow only when the
  // requested input exists in THIS transaction; otherwise skipping the entire loop would silently disable
  // preflight and allow an intermediate/provisional transaction to reach the provider.
  const narrowPreflight = debugOnlyInput !== undefined && Number.isInteger(debugOnlyInput)
    && debugOnlyInput >= 0 && debugOnlyInput < transaction.inputs.length;
  const debugTiming = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_PREFLIGHT_TIMING === '1';

  const invokeDebugEnv = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
  const invokeDebugInput = Number(invokeDebugEnv?.SOLIDC_DEBUG_INVOKE_INPUT ?? -1);
  const invokeDebugId = Number(invokeDebugEnv?.SOLIDC_DEBUG_INVOKE_ID ?? -1);
  const invokeDebugAfter = Number(invokeDebugEnv?.SOLIDC_DEBUG_INVOKE_AFTER ?? 0);
  const invokeDebugWatchHex = invokeDebugEnv?.SOLIDC_DEBUG_INVOKE_WATCH_HEX?.toLowerCase();
  if (Number.isInteger(invokeDebugInput) && invokeDebugInput >= 0
    && invokeDebugInput < transaction.inputs.length
    && Number.isInteger(invokeDebugId) && invokeDebugId !== -1) {
    type InvokeDebugState = AuthenticationProgramStateCommon & {
      instructions: Array<{ opcode: number }>;
    };
    type PendingInvoke = {
      callerInstructions: InvokeDebugState['instructions'];
      resumeIp: number;
    };
    let pendingInvoke: PendingInvoke | undefined;
    let activeInvoke: PendingInvoke | undefined;
    let afterInvokeRemaining = 0;
    let targetReturned = false;
    let priorWatchShape = '';
    const operationRing: Array<{ ip: number; opcode: number; top: string[] }> = [];
    const watchedBytes = invokeDebugWatchHex && invokeDebugWatchHex.length % 2 === 0
      ? hexToBin(invokeDebugWatchHex) : undefined;
    const watchOpcodes = new Set([
      Op.OP_CAT, Op.OP_SPLIT, Op.OP_DROP, Op.OP_PICK, Op.OP_ROLL,
      Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUAL, Op.OP_EQUALVERIFY,
    ]);
    const describeStack = (state: InvokeDebugState) => ({
      depth: state.stack.length,
      top: state.stack.slice(-12).map((item, offset, items) => ({
        index: state.stack.length - items.length + offset,
        fromTop: items.length - offset - 1,
        bytes: item.length,
        head: binToHex(item.slice(0, 32)),
        ...(item.length > 32 ? { tail: binToHex(item.slice(-16)) } : {}),
      })),
      large: state.stack.flatMap((item, index) => item.length >= 100 ? [{
        index,
        fromTop: state.stack.length - index - 1,
        bytes: item.length,
        head: binToHex(item.slice(0, 32)),
        tail: binToHex(item.slice(-16)),
      }] : []),
    });
    createVirtualMachineBch2026ForProvider(builder.provider, {
      opcodes: new Set(Array.from({ length: 256 }, (_unused, opcode) => opcode)),
      beforeOperation: (unknownState) => {
        const state = unknownState as InvokeDebugState;
        operationRing.push({
          ip: state.ip,
          opcode: state.instructions[state.ip]?.opcode ?? -1,
          top: state.stack.slice(-6).map((item) => `${item.length}:${binToHex(item.slice(0, 24))}`),
        });
        if (operationRing.length > 800) operationRing.shift();
        if (pendingInvoke !== undefined) {
          activeInvoke = pendingInvoke;
          pendingInvoke = undefined;
          console.error('message-bus-invoke-entry', JSON.stringify({
            inputIndex: invokeDebugInput,
            functionId: invokeDebugId,
            ip: state.ip,
            instructionCount: state.instructions.length,
            controlDepth: state.controlStack.length,
            ...describeStack(state),
          }));
        } else if (activeInvoke !== undefined
          && state.instructions === activeInvoke.callerInstructions
          && state.ip === activeInvoke.resumeIp) {
          console.error('message-bus-invoke-return', JSON.stringify({
            inputIndex: invokeDebugInput,
            functionId: invokeDebugId,
            ip: state.ip,
            instructionCount: state.instructions.length,
            controlDepth: state.controlStack.length,
            ...describeStack(state),
          }));
          activeInvoke = undefined;
          targetReturned = true;
          afterInvokeRemaining = Number.isInteger(invokeDebugAfter) && invokeDebugAfter > 0
            ? invokeDebugAfter : 0;
        }
        if (targetReturned && watchedBytes !== undefined
          && watchOpcodes.has(state.instructions[state.ip]?.opcode ?? -1)) {
          const matches = state.stack.flatMap((item, index) => {
            // Return vectors and their pushdata frames are small. Excluding larger items is both exact for this
            // observer and critical for huge route frames, which can contain the 500KB active bytecode itself.
            if (item.length < watchedBytes.length || item.length > 256) return [];
            let offset = -1;
            for (let start = 0; start <= item.length - watchedBytes.length; start += 1) {
              let matchesAtStart = true;
              for (let byte = 0; byte < watchedBytes.length; byte += 1) {
                if (item[start + byte] !== watchedBytes[byte]) {
                  matchesAtStart = false;
                  break;
                }
              }
              if (matchesAtStart) {
                offset = start;
                break;
              }
            }
            return offset < 0 ? [] : [{
              index,
              fromTop: state.stack.length - index - 1,
              bytes: item.length,
              byteOffset: offset,
              head: binToHex(item.slice(0, 16)),
              tail: binToHex(item.slice(-16)),
            }];
          });
          const shape = JSON.stringify(matches.map(({ bytes, byteOffset }) => ({ bytes, byteOffset })));
          if (shape !== priorWatchShape) {
            console.error('message-bus-invoke-watch', JSON.stringify({
              ip: state.ip,
              opcode: state.instructions[state.ip]?.opcode,
              instructionCount: state.instructions.length,
              matches,
            }));
            priorWatchShape = shape;
          }
        }
        const functionId = state.stack.at(-1);
        if (state.instructions[state.ip]?.opcode !== Op.OP_INVOKE
          || functionId === undefined
          || Number(vmNumberToBigInt(functionId)) !== invokeDebugId
          || state.controlStack.some((item) => item === false)) return;
        console.error('message-bus-invoke-call', JSON.stringify({
          inputIndex: invokeDebugInput,
          functionId: invokeDebugId,
          ip: state.ip,
          instructionCount: state.instructions.length,
          controlDepth: state.controlStack.length,
          ...describeStack(state),
          operationRing,
        }));
        pendingInvoke = { callerInstructions: state.instructions, resumeIp: state.ip + 1 };
        return;
      },
      operation: (opcode, unknownState, operation) => {
        const state = unknownState as InvokeDebugState;
        if (afterInvokeRemaining > 0) {
          const rawDepth = state.stack.at(-1);
          const selectedDepth = rawDepth === undefined ? -1 : Number(vmNumberToBigInt(rawDepth));
          const selected = (opcode === Op.OP_PICK || opcode === Op.OP_ROLL) && selectedDepth >= 0
            ? state.stack[state.stack.length - selectedDepth - 2] : undefined;
          console.error('message-bus-invoke-after', JSON.stringify({
            ip: state.ip,
            opcode,
            depth: state.stack.length,
            top: state.stack.slice(-8).map((item) => `${item.length}:${binToHex(item.slice(0, 24))}`),
            ...(selected === undefined ? {} : {
              selectedDepth,
              selectedBytes: selected.length,
              selectedHead: binToHex(selected.slice(0, 32)),
            }),
          }));
          afterInvokeRemaining -= 1;
        }
        return operation(state as never);
      },
    }).evaluate({ inputIndex: invokeDebugInput, sourceOutputs, transaction });
  }

  transaction.inputs.forEach((_input, inputIndex) => {
    if (narrowPreflight && inputIndex !== debugOnlyInput) return;
    const startedAt = debugTiming ? Date.now() : 0;
    const evaluated = vm.evaluate({ inputIndex, sourceOutputs, transaction });
    const objection = vm.stateSuccess(evaluated);
    if (resourceSlotIndexDebug && inputIndex === 227 && objection !== true) {
      console.error('return-commitment-reads', JSON.stringify(returnCommitmentReads));
    }
    if (debugTiming) {
      console.error('preflight-input-timing', {
        inputIndex,
        ms: Date.now() - startedAt,
        unlockingBytes: transaction.inputs[inputIndex]?.unlockingBytecode.length,
        instructions: evaluated.instructions.length,
        functionName: (builder.inputs[inputIndex] as unknown as {
          unlocker?: { abiFunction?: { name?: string } };
        })?.unlocker?.abiFunction?.name,
        passed: objection === true,
        ...(objection === true ? {} : { objection: String(objection) }),
      });
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_OUTLINE_COMPARE === '1' && inputIndex === 3) {
      const trace = vm.debug({ inputIndex, sourceOutputs, transaction });
      console.error('outline-compare-nine', trace.flatMap((state, traceIndex) => (
        state.instructions.length === 9 ? [{
          traceIndex, ip: state.ip, opcode: state.instructions[state.ip]?.opcode,
          error: state.error,
          stack: state.stack.slice(-8).map((item) => binToHex(item)),
        }] : []
      )));
    }
    if (objection !== true) {
      const debugEnv = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
      const requestedTraceInput = debugEnv?.SOLIDC_TRACE_INPUT === undefined
        ? undefined : Number(debugEnv.SOLIDC_TRACE_INPUT);
      if (debugEnv?.SOLIDC_DEBUG_FAILURE_TAIL === '1'
        && (requestedTraceInput === undefined || requestedTraceInput === inputIndex)) {
        const tailIndexBytes = evaluated.stack.at(-1);
        const tailIndex = tailIndexBytes === undefined ? -1 : Number(vmNumberToBigInt(tailIndexBytes));
        const output = transaction.outputs[tailIndex];
        const outputLock = output && binToHex(output.lockingBytecode);
        const outputCategory = output?.token && binToHex(output.token.category);
        const outputCommitment = output?.token?.nft && binToHex(output.token.nft.commitment);
        console.error('message-bus-failure-tail', JSON.stringify({
          inputIndex,
          ip: evaluated.ip,
          stackTail: evaluated.stack.slice(-4).map((item) => binToHex(item)),
          output: output === undefined ? undefined : {
            index: tailIndex,
            lockingBytecode: outputLock,
            category: outputCategory,
            commitment: outputCommitment,
            capability: output.token?.nft?.capability,
          },
          exactInputMatches: output === undefined ? [] : sourceOutputs.flatMap((source, sourceIndex) => (
            binToHex(source.lockingBytecode) === outputLock
              && (source.token === undefined ? undefined : binToHex(source.token.category)) === outputCategory
              && (source.token?.nft === undefined
                ? undefined : binToHex(source.token.nft.commitment)) === outputCommitment
              && source.token?.nft?.capability === output.token?.nft?.capability
              ? [sourceIndex] : []
          )),
        }));
      }
      if (debugEnv?.SOLIDC_DEBUG_FAILURE_TRACE === '1'
        && (requestedTraceInput === undefined || requestedTraceInput === inputIndex)) {
        // A failing comparison has already popped its operands from `evaluated.stack`. The preceding trace states
        // are the only place the two values (and the index a coordinate resolved to) can still be read.
        const trace = vm.debug({ inputIndex, sourceOutputs, transaction });
        console.error('message-bus-failure-trace', JSON.stringify(trace.slice(-4).map((state, offset, states) => ({
          step: offset - states.length,
          ip: state.ip,
          opcode: state.instructions[state.ip]?.opcode,
          error: state.error,
          stackTail: state.stack.slice(-6).map((item) => binToHex(item)),
        }))));
      }
      if (debugEnv?.SOLIDC_DEBUG_CATEGORY_COUNTS === '1'
        && (requestedTraceInput === undefined || requestedTraceInput === inputIndex)) {
        const category = sourceOutputs[inputIndex]?.token?.category;
        const categoryHex = category && binToHex(category);
        console.error('message-bus-category-counts', {
          inputIndex,
          category: categoryHex,
          inputs: categoryHex === undefined ? [] : sourceOutputs.flatMap((output, index) =>
            output.token && binToHex(output.token.category) === categoryHex ? [{
              index,
              capability: output.token.nft?.capability,
              commitment: output.token.nft && binToHex(output.token.nft.commitment).slice(0, 24),
            }] : []),
          outputs: categoryHex === undefined ? [] : transaction.outputs.flatMap((output, index) =>
            output.token && binToHex(output.token.category) === categoryHex ? [{
              index,
              capability: output.token.nft?.capability,
              commitment: output.token.nft && binToHex(output.token.nft.commitment).slice(0, 24),
            }] : []),
        });
      }
      if ((debugEnv?.SOLIDC_DEBUG_GRAPH_PARAMS === '1' || narrowPreflight)
        && (requestedTraceInput === undefined || requestedTraceInput === inputIndex)) {
        const unlocker = (builder.inputs[inputIndex] as unknown as {
          unlocker?: {
            abiFunction?: { inputs?: readonly { name: string }[] };
            params?: readonly unknown[];
          };
        }).unlocker;
        console.error('message-bus-graph-params', JSON.stringify(
          unlocker?.abiFunction?.inputs?.flatMap<Record<string, unknown>>((input, index) => {
            if (!input.name.startsWith('__internal__graph')) return [];
            const value = unlocker.params?.[index];
            if (input.name === '__internal__graphEmissions' && value instanceof Uint8Array) {
              const rows: unknown[] = [];
              let cursor = 0;
              while (cursor + 2 <= value.length) {
                const lbcLength = value[cursor] + value[cursor + 1] * 256;
                const rowStart = cursor;
                cursor += 2;
                if (cursor + lbcLength + 7 > value.length) break;
                const lockingBytecode = value.slice(cursor, cursor + lbcLength);
                cursor += lbcLength;
                const mode = value[cursor++];
                const selector = value.slice(cursor, cursor + 4);
                cursor += 4;
                const argsLength = value[cursor] + value[cursor + 1] * 256;
                cursor += 2;
                const args = value.slice(cursor, cursor + argsLength);
                cursor += argsLength;
                if (cursor + 2 > value.length) break;
                const resultLength = value[cursor] + value[cursor + 1] * 256;
                cursor += 2;
                const result = value.slice(cursor, cursor + resultLength);
                cursor += resultLength;
                rows.push({
                  rowStart, rowLength: cursor - rowStart, lockingBytecode: binToHex(lockingBytecode), mode,
                  selector: binToHex(selector), argsLength, args: binToHex(args),
                  resultLength, result: binToHex(result),
                });
              }
              return [{ name: input.name, length: value.length, rows, parsedLength: cursor }];
            }
            return [{
              name: input.name,
              value: value instanceof Uint8Array ? binToHex(value) : String(value),
            }];
          }) ?? [],
        ));
      }
      if ((debugEnv?.SOLIDC_DEBUG_FAILURE_POINT === '1' || narrowPreflight)
        && (requestedTraceInput === undefined || requestedTraceInput === inputIndex)) {
        const failedUnlocker = (builder.inputs[inputIndex] as unknown as {
          unlocker?: {
            abiFunction?: { inputs?: readonly { name: string }[] };
            params?: readonly unknown[];
          };
        }).unlocker;
        const tailIndexBytes = evaluated.stack.at(-1);
        const tailIndex = tailIndexBytes === undefined ? -1 : Number(vmNumberToBigInt(tailIndexBytes));
        const tailOutput = transaction.outputs[tailIndex];
        const tailLock = tailOutput && binToHex(tailOutput.lockingBytecode);
        const tailCategory = tailOutput?.token && binToHex(tailOutput.token.category);
        const tailCommitment = tailOutput?.token?.nft && binToHex(tailOutput.token.nft.commitment);
        console.error('message-bus-failure-point', JSON.stringify({
          inputIndex,
          metrics: evaluated.metrics,
          ip: evaluated.ip,
          opcode: evaluated.instructions[evaluated.ip]?.opcode,
          programLength: evaluated.instructions.length,
          programHead: evaluated.instructions.slice(0, 6).map((instruction) => {
            const data = (instruction as { data?: Uint8Array }).data;
            return data === undefined || data.length === 0
              ? instruction.opcode
              : `${instruction.opcode}:${binToHex(data).slice(0, 12)}`;
          }),
          window: evaluated.instructions.slice(Math.max(0, evaluated.ip - 24), evaluated.ip + 2)
            .map((instruction) => {
              const data = (instruction as { data?: Uint8Array }).data;
              return data === undefined || data.length === 0
                ? instruction.opcode
                : `${instruction.opcode}:${binToHex(data).slice(0, 20)}`;
            }),
          controlStack: evaluated.controlStack.map((item) => typeof item === 'object' ? {
            ip: item.ip,
            instructionCount: item.instructions.length,
            opcode: item.instructions[item.ip]?.opcode,
          } : item),
          stack: evaluated.stack.slice(-24).map((item, offset, items) => (
            `${evaluated.stack.length - items.length + offset}:${item.length}:${binToHex(item).slice(0, 70)}`
          )),
          // A failing comparison has ALREADY popped its operands from this terminal state, so the values that
          // explain the refusal are only in the state the VM held BEFORE the failing operation. That state is
          // captured by the hook below (one reference assignment per operation) - deliberately NOT re-derived with
          // `vm.debug()`, which deep-clones the OP_DEFINE body table per instruction and killed the worker on this
          // program size (measured: "Worker exited unexpectedly").
          operands: (() => {
            if (!failurePreStateDebug) return undefined;
            // preflight evaluates an input several times (the convergence loop re-runs it after repairing mutable
            // resources), and an outlined body is invoked from several sites - so neither "last state" nor "first
            // ip match" identifies the operands on its own. Print EVERY candidate whose position matches the
            // reported failure (`evaluated` carries the error and an ip one past the failing instruction) and use
            // the first one, i.e. the earliest pass.
            const ring = preStateRingByInput.get(inputIndex) ?? [];
            const candidates = ring.filter((candidate) =>
              candidate.instructions.length === evaluated.instructions.length
              && candidate.ip === evaluated.ip - 1);
            // The failing operation popped its operands before failing, so the failing state's stack is the
            // pre-state's with those operands (two for the comparisons this gate is used on) removed. Comparing the
            // REMAINDER byte for byte identifies the right invocation among the many that share a position -
            // selecting by position alone reported another pass's operands (measured: a 154-vs-256 pair where the
            // VM's own message described a locking-bytecode comparison).
            const samePrefix = (candidate: AuthenticationProgramStateCommon): boolean => {
              if (candidate.stack.length !== evaluated.stack.length + 2) return false;
              for (let item = 0; item < evaluated.stack.length; item += 1) {
                if (binToHex(candidate.stack[item]) !== binToHex(evaluated.stack[item])) return false;
              }
              return true;
            };
            const preState = [...ring].reverse().find(samePrefix) ?? candidates[0] ?? ring.at(-1);
            if (preState === undefined) return { unavailable: 'no state captured for this input' };
            return {
              ip: preState.ip,
              opcode: preState.instructions[preState.ip]?.opcode,
              depth: preState.stack.length,
              candidateCount: candidates.length,
              candidates: candidates.slice(0, 4).map((candidate) => ({
                depth: candidate.stack.length,
                top: candidate.stack.slice(-3).map((item) => `${item.length}:${binToHex(item).slice(0, 24)}`),
              })),
              error: preState.error === undefined ? undefined : String(
                (preState.error as { error?: unknown }).error ?? preState.error,
              ),
              // 16 items, not 8: a failing coordinate is built from frame reads whose inputs sit deeper than the
              // compared pair, and the compared pair alone cannot say which frame item was wrong.
              top: preState.stack.slice(-16).map((item, offset, items) => (
                `${items.length - 1 - offset}:${item.length}:${binToHex(item).slice(0, 96)}`
              )),
              // The BOTTOM region too: coordinates are built with `OP_DEPTH; <n>; OP_SUB; OP_PICK` terms as well,
              // and those address ordinals counted from the bottom - the very slots this gate exists to check.
              bottom: preState.stack.slice(0, 8).map((item, ordinal) => (
                `${ordinal}:${item.length}:${binToHex(item).slice(0, 96)}`
              )),
              // Deep bottom ordinals too: a coordinate term can be a bottom pick far from the ends (measured: a
              // term that reads the 41st item from the bottom, invisible in both the top window and the bottom 8).
              bottomDeep: preState.stack.length > 40
                ? preState.stack.slice(34, 46).map((item, offset) => (
                  `${34 + offset}:${item.length}:${binToHex(item).slice(0, 96)}`
                ))
                : undefined,
              // The whole frame, top-relative. A model-index pick that resolved to the wrong slot can be judged
              // only against the runtime distance of the item it was MEANT to read, and that item (a route input
              // like the authenticated emission stream) normally sits far outside both the top window and the
              // bottom ordinals the windows above cover. Gated because a full frame is large: match the intended
              // item by its leading bytes to read its real distance from the top.
              stackFull: debugEnv?.SOLIDC_DEBUG_FAILURE_POINT_STACK_FULL === '1'
                ? preState.stack.map((item, offset, items) => (
                  `${items.length - 1 - offset}:${item.length}:${binToHex(item).slice(0, 240)}`
                )).reverse()
                : undefined,
              // Step through a coordinate's construction: every captured pre-state of the failing program whose ip
              // falls in the requested range, with the top of the stack at that point. A four-term coordinate is
              // only readable this way - the terminal operands alone cannot say which term was wrong.
              trace: (() => {
                const from = Number(debugEnv?.SOLIDC_DEBUG_FAILURE_POINT_TRACE_FROM ?? Number.NaN);
                const to = Number(debugEnv?.SOLIDC_DEBUG_FAILURE_POINT_TRACE_TO ?? Number.NaN);
                if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;
                // By default only the failing frame; with TRACE_ANY=1 every frame. A coordinate is usually built in
                // the CALLER of the body that fails (measured: the failure is ip 3 of a 6-instruction outlined body
                // while the size/pick instructions that fed it live in the 6338-instruction caller).
                const anyFrame = debugEnv?.SOLIDC_DEBUG_FAILURE_POINT_TRACE_ANY === '1';
                return ring.filter((candidate) =>
                  (anyFrame || candidate.instructions.length === evaluated.instructions.length)
                  && candidate.ip >= from && candidate.ip <= to)
                  .map((candidate) => ({
                    ip: candidate.ip,
                    instructions: candidate.instructions.length,
                    opcode: candidate.instructions[candidate.ip]?.opcode,
                    depth: candidate.stack.length,
                    top: candidate.stack.slice(-5).map((item) => `${item.length}:${binToHex(item).slice(0, 40)}`),
                  }));
              })(),
            };
          })(),
          // Many output-conservation loops retain their current output index at the top of the stack. Reporting
          // the referenced tuple and all exact predecessor matches makes a failed preservation check diagnosable
          // without another full VM trace. For failures with a non-index tail this remains an inert undefined row.
          tailIndexedOutput: tailOutput === undefined ? undefined : {
            index: tailIndex,
            lockingBytecode: tailLock,
            category: tailCategory,
            commitment: tailCommitment,
            capability: tailOutput.token?.nft?.capability,
            exactInputMatches: sourceOutputs.flatMap((source, sourceIndex) => (
              binToHex(source.lockingBytecode) === tailLock
                && (source.token === undefined ? undefined : binToHex(source.token.category)) === tailCategory
                && (source.token?.nft === undefined
                  ? undefined : binToHex(source.token.nft.commitment)) === tailCommitment
                && source.token?.nft?.capability === tailOutput.token?.nft?.capability
                ? [sourceIndex] : []
            )),
          },
          focus: {
            inputs: builder.inputs.slice(Math.max(0, inputIndex - 2), inputIndex + 7)
              .map((input, offset) => ({
                index: Math.max(0, inputIndex - 2) + offset,
                lockingBytecode: binToHex(sourceOutputs[Math.max(0, inputIndex - 2) + offset].lockingBytecode),
                category: input.token?.category,
                commitment: input.token?.nft?.commitment,
                contract: (input as unknown as {
                  unlocker?: { contract?: { artifact?: { contractName?: string } } };
                }).unlocker?.contract?.artifact?.contractName,
                functionName: (input as unknown as {
                  unlocker?: { abiFunction?: { name?: string } };
                }).unlocker?.abiFunction?.name,
                unlockingHead: binToHex(
                  (transaction.inputs[Math.max(0, inputIndex - 2) + offset]?.unlockingBytecode ?? new Uint8Array())
                    .slice(0, 24),
                ),
                unlockingLen: transaction.inputs[Math.max(0, inputIndex - 2) + offset]?.unlockingBytecode.length,
              })),
            outputs: transaction.outputs.slice(Math.max(0, inputIndex - 2), inputIndex + 7)
              .map((output, offset) => ({
                index: Math.max(0, inputIndex - 2) + offset,
                lockingBytecode: binToHex(output.lockingBytecode),
                category: output.token && binToHex(output.token.category),
                commitment: output.token?.nft && binToHex(output.token.nft.commitment),
                capability: output.token?.nft?.capability,
              })),
          },
          output26: transaction.outputs[26] && {
            lockingBytecode: binToHex(transaction.outputs[26].lockingBytecode),
            category: transaction.outputs[26].token && binToHex(transaction.outputs[26].token.category),
            commitment: transaction.outputs[26].token?.nft
              && binToHex(transaction.outputs[26].token.nft.commitment),
            capability: transaction.outputs[26].token?.nft?.capability,
            amount: transaction.outputs[26].token?.amount,
          },
          outputs: debugEnv?.SOLIDC_DEBUG_FAILURE_POINT_FULL === '1'
            ? transaction.outputs.map((output, outputIndex) => ({
              outputIndex,
              lockingBytecode: binToHex(output.lockingBytecode).slice(0, 16),
              category: output.token && binToHex(output.token.category),
              commitmentLength: output.token?.nft?.commitment.length,
              commitmentHead: output.token?.nft && binToHex(output.token.nft.commitment.slice(0, 20)),
              capability: output.token?.nft?.capability,
              amount: output.token?.amount,
            })) : undefined,
          functionName: (builder.inputs[inputIndex] as unknown as {
            unlocker?: { abiFunction?: { name?: string; selector?: string } };
          }).unlocker?.abiFunction?.name,
          selector: (builder.inputs[inputIndex] as unknown as {
            unlocker?: { abiFunction?: { selector?: string } };
          }).unlocker?.abiFunction?.selector,
          routeParams: failedUnlocker?.abiFunction?.inputs?.flatMap((input, index) => {
            if (!input.name.startsWith('__internal__graph')
              && !input.name.startsWith('__internal__vmapBatch')
              && !input.name.startsWith('__internal__valueWitness')
              && !input.name.startsWith('__internal__leadingPushValue')) return [];
            const value = failedUnlocker.params?.[index];
            return [{
              name: input.name,
              value: value instanceof Uint8Array ? binToHex(value) : String(value),
            }];
          }),
          inputs: debugEnv?.SOLIDC_DEBUG_FAILURE_POINT_FULL === '1'
            ? builder.inputs.map((input, index) => ({
              index,
              category: input.token?.category,
              commitmentLength: input.token?.nft?.commitment.length,
              lockLen: sourceOutputs[index]?.lockingBytecode.length,
              lockHead: sourceOutputs[index] && binToHex(sourceOutputs[index].lockingBytecode).slice(0, 16),
              tokenCatLen: sourceOutputs[index]?.token?.category.length,
              contract: (input as unknown as {
                unlocker?: { contract?: { artifact?: { contractName?: string } } };
              }).unlocker?.contract?.artifact?.contractName,
              fn: (input as unknown as {
                unlocker?: { abiFunction?: { name?: string } };
              }).unlocker?.abiFunction?.name,
            })) : undefined,
          ipWindow: evaluated.instructions.slice(
            Math.max(0, evaluated.ip - 20),
            evaluated.ip + 8,
          ).map((instruction, offset) => ({
            ip: Math.max(0, evaluated.ip - 20) + offset,
            opcode: instruction.opcode,
            ...('data' in instruction && { data: binToHex(instruction.data).slice(0, 40) }),
          })),
          invokeWindow: evaluated.instructions.slice(72700, 72710).map((instruction, offset) => ({
            ip: 72700 + offset,
            opcode: instruction.opcode,
            ...('data' in instruction && { data: binToHex(instruction.data) }),
          })),
          frameWindow: typeof evaluated.controlStack[0] === 'object'
            ? {
              instructionCount: (evaluated.controlStack[0] as { instructions: unknown[] }).instructions.length,
              ip: (evaluated.controlStack[0] as { ip: number }).ip,
            }
            : undefined,
        }, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
      }
      const failureDebugEnv = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
      const failureDebugInput = Number(failureDebugEnv?.SOLIDC_DEBUG_ROUTE_INPUT_INDEX ?? inputIndex);
      if (failureDebugEnv?.SOLIDC_DUMP_UNLOCKING_CHUNKS === '1' && failureDebugInput === inputIndex) {
        // The failing input's unlocking bytecode carries the composed program and the message envelope the VM
        // executed. Dump it on request alone: the ring dump below rebuilds the block assembly and can abort on an
        // assembly that the ordinary preflight never reaches.
        const unlockingHex = binToHex(transaction.inputs[inputIndex].unlockingBytecode);
        console.error('message-bus-failing-unlocking-bytes', unlockingHex.length / 2);
        for (let offset = 0; offset < unlockingHex.length; offset += 400) {
          console.error('message-bus-failing-unlocking-hex',
            `${offset / 2}:${unlockingHex.slice(offset, offset + 400)}`);
        }
      }
      if (failureDebugEnv?.SOLIDC_DEBUG_FAILURE_RING === '1' && failureDebugInput === inputIndex) {
        const unlockingInstructions = decodeAuthenticationInstructions(transaction.inputs[inputIndex].unlockingBytecode);
        const redeemBytecode = (unlockingInstructions.at(-1) as { data?: Uint8Array } | undefined)?.data;
        if (failureDebugEnv?.SOLIDC_DUMP_FAILING_REDEEM === '1' && redeemBytecode !== undefined) {
          console.error('message-bus-failing-redeem-hex', binToHex(redeemBytecode));
        }
        const unlockerBytecodeHex = (builder.inputs[inputIndex] as unknown as {
          unlocker?: { contract?: { bytecode?: string } };
        }).unlocker?.contract?.bytecode;
        console.error('message-bus-failing-input', {
          inputIndex,
          builderInputKeys: Object.keys(builder.inputs[inputIndex] as unknown as object),
          inputCategory: builder.inputs[inputIndex].token?.category,
          unlockerCategory: (builder.inputs[inputIndex] as unknown as {
            unlocker?: { contract?: { category?: Uint8Array } };
          }).unlocker?.contract?.category === undefined ? undefined : binToHex((builder.inputs[inputIndex] as unknown as {
              unlocker: { contract: { category: Uint8Array } };
            }).unlocker.contract.category),
          unlockerContract: (builder.inputs[inputIndex] as unknown as {
            unlocker?: { contract?: { artifact?: { contractName?: string; fingerprint?: string } } };
          }).unlocker?.contract?.artifact?.contractName,
          unlockerLockingBytecode: (builder.inputs[inputIndex] as unknown as {
            unlocker?: { contract?: { lockingBytecode?: string } };
          }).unlocker?.contract?.lockingBytecode,
          redeemBytes: redeemBytecode?.length,
          redeemHash: redeemBytecode === undefined ? undefined : binToHex(hash256(redeemBytecode)),
          unlockerRedeemHash: unlockerBytecodeHex === undefined
            ? undefined : binToHex(hash256(hexToBin(unlockerBytecodeHex))),
          lockingBytecode: binToHex(sourceOutputs[inputIndex].lockingBytecode),
          unlockingBytecode: binToHex(transaction.inputs[inputIndex].unlockingBytecode),
          sourceCommitment: sourceOutputs[inputIndex].token?.nft === undefined
            ? undefined : binToHex(sourceOutputs[inputIndex].token!.nft!.commitment),
        });
        console.error('message-bus-participant-masters', (() => {
          const assembly = requireMessageBusBlockAssembly(builder);
          return assembly.blocks.flatMap((block) => [0, 1, 2, 3].map((offset) => {
            const output = sourceOutputs[block.base + offset];
            return {
              participant: block.participant,
              index: block.base + offset,
              category: output?.token === undefined ? undefined : binToHex(output.token.category),
              capability: output?.token?.nft?.capability,
              commitment: output?.token?.nft === undefined
                ? undefined : binToHex(output.token.nft.commitment),
            };
          }));
        })());
        console.error('message-bus-selected-source-commitments', sourceOutputs.slice(105, 114).map((output, offset) => ({
          inputIndex: offset + 105,
          commitment: output.token?.nft === undefined ? undefined : binToHex(output.token.nft.commitment),
        })));
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_FAILURE_RING === '1') {
          console.error('message-bus-selected-outputs', [3, 35, 40, 42, 105, 106, 107, 108, 109].map((outputIndex) => ({
            outputIndex,
            output: transaction.outputs[outputIndex],
          })));
          console.error('message-bus-output-summary', transaction.outputs.slice(100, 140).map((output, offset) => ({
            outputIndex: offset + 100,
            lockingLength: output.lockingBytecode.length,
            category: output.token === undefined ? undefined : Array.from(output.token.category, (byte) => byte.toString(16).padStart(2, '0')).join(''),
            capability: output.token?.nft?.capability,
            commitment: output.token?.nft === undefined ? undefined : Array.from(output.token.nft.commitment, (byte) => byte.toString(16).padStart(2, '0')).join(''),
          })));
          console.error('message-bus-loop-output-summary', transaction.outputs.map((output, outputIndex) => ({
            outputIndex,
            lockingBytecode: binToHex(output.lockingBytecode),
            category: output.token === undefined ? undefined : binToHex(output.token.category),
            commitment: output.token?.nft === undefined ? undefined : binToHex(output.token.nft.commitment),
          })).filter((output) => output.lockingBytecode
            === 'aa2020a1837b930aebaba6eb9e9300138a50768a4cd1b72771f674c6d9503ebcc28f87'));
        }
        const lockingGroups = new Map<string, { inputs: number[]; outputs: number[]; contracts: string[] }>();
        sourceOutputs.forEach((source, index) => {
          const locking = binToHex(source.lockingBytecode);
          const group = lockingGroups.get(locking) ?? { inputs: [], outputs: [], contracts: [] };
          group.inputs.push(index);
          const contractName = (builder.inputs[index] as unknown as {
            unlocker?: { contract?: { artifact?: { contractName?: string } } };
          }).unlocker?.contract?.artifact?.contractName;
          if (contractName && !group.contracts.includes(contractName)) group.contracts.push(contractName);
          lockingGroups.set(locking, group);
        });
        transaction.outputs.forEach((output, index) => {
          const locking = binToHex(output.lockingBytecode);
          const group = lockingGroups.get(locking) ?? { inputs: [], outputs: [], contracts: [] };
          group.outputs.push(index);
          lockingGroups.set(locking, group);
        });
        console.error('message-bus-locking-groups', [...lockingGroups].filter(([, group]) => (
          group.contracts.length > 0 || group.inputs.some((index) => index >= 90)
        )));
        const recent: Array<Record<string, unknown>> = [];
        let priorProgramRecent: Array<Record<string, unknown>> = [];
        let lastInstructionCount = -1;
        const inputReads: Array<Record<string, unknown>> = [];
        const largeEqualVerifies: Array<Record<string, unknown>> = [];
        const failedVerifyPoints: Array<Record<string, unknown>> = [];
        const outputCommitmentReads: Array<Record<string, unknown>> = [];
        const outputBytecodeReads: Array<Record<string, unknown>> = [];
        const instructionWindow: Array<string> = [];
        let body29Captured = false;
        createVirtualMachineBch2026ForProvider(builder.provider, {
          opcodes: new Set(Array.from({ length: 256 }, (_, opcode) => opcode)),
          beforeOperation: (unknownState) => {
            const state = unknownState as AuthenticationProgramStateCommon;
            const debugBodyLength = Number(failureDebugEnv?.SOLIDC_DEBUG_STACK_BODY_LENGTH ?? -1);
            const debugBodyFrom = Number(failureDebugEnv?.SOLIDC_DEBUG_STACK_BODY_FROM ?? 0);
            const debugBodyTo = Number(failureDebugEnv?.SOLIDC_DEBUG_STACK_BODY_TO ?? Number.MAX_SAFE_INTEGER);
            // Instruction COUNT alone is ambiguous: the composed program holds 20 distinct 7-instruction
            // bodies, so gating on a count can trace a completely different body than the one under
            // investigation (measured: the fragment that reads outputs[base + 3].nftCommitment[32:64] has
            // opcodes 83,147,210,1,1,138,126 while another length-7 body showed up instead). An optional
            // opcode signature pins the body exactly.
            const debugOpcodeIndex = Number(failureDebugEnv?.SOLIDC_DEBUG_STACK_BODY_OPCODE_INDEX ?? -1);
            const debugOpcode = Number(failureDebugEnv?.SOLIDC_DEBUG_STACK_BODY_OPCODE ?? -1);
            // An opcode at one index is NOT a unique body signature (measured: two instruction streams of the
            // same length and opcode produced contradictory stacks in one evaluation). Comparing the PUSHED DATA
            // as well pins the body exactly, which is what a trustworthy trace needs - e.g. the body that invokes
            // the outlined keccak fragment is the one whose instruction 463 pushes `7d81`.
            const debugDataHex = failureDebugEnv?.SOLIDC_DEBUG_STACK_BODY_DATA;
            const debugData = debugOpcodeIndex < 0
              ? undefined
              : (state.instructions[debugOpcodeIndex] as { data?: Uint8Array } | undefined)?.data;
            const dataMatches = debugDataHex === undefined
              || (debugData !== undefined
                && binToHex(debugData).toLowerCase() === debugDataHex.toLowerCase());
            const signatureMatches = (debugOpcodeIndex < 0
              || state.instructions[debugOpcodeIndex]?.opcode === debugOpcode) && dataMatches;
            if ((debugBodyLength < 0 || state.instructions.length === debugBodyLength)
              && signatureMatches
              && state.ip >= debugBodyFrom && state.ip <= debugBodyTo) {
              // A block base is addressed by a top-relative stack index, so a one-slot model/physical
              // disagreement is invisible unless the whole frame is visible: print enough of the stack to line
              // it up against the compiler's model (SOLIDC_DEBUG_COMPUTE_BASE).
              const debugStackDepth = Number(failureDebugEnv?.SOLIDC_DEBUG_STACK_DEPTH ?? 4);
              console.error('[vm-stack]', JSON.stringify({
                ip: state.ip,
                opcode: state.instructions[state.ip]?.opcode,
                depth: state.stack.length,
                stack: state.stack.slice(-Math.max(1, debugStackDepth)).map((item, offset, items) => ({
                  d: items.length - 1 - offset,
                  bytes: item.length,
                  // The 128-byte default truncates exactly the values a contract-bytecode comparison needs: two
                  // covenants differing only in an embedded address look identical in their first 128 bytes. Raise
                  // it with SOLIDC_DEBUG_STACK_HEX_BYTES when the operands themselves are the evidence.
                  hex: binToHex(item).slice(0, Number(failureDebugEnv?.SOLIDC_DEBUG_STACK_HEX_BYTES ?? 256)),
                })),
              }));
            }
            if (lastInstructionCount !== -1 && state.instructions.length !== lastInstructionCount) {
              priorProgramRecent = recent.slice();
              recent.length = 0;
            }
            lastInstructionCount = state.instructions.length;
            if (!body29Captured && inputIndex === 105 && state.instructions.length === 29 && state.ip === 0) {
              body29Captured = true;
              console.error('message-bus-body29-entry', JSON.stringify(state.stack.map((item, index) => ({
                index, fromTop: state.stack.length - index - 1, value: binToHex(item),
              }))));
            }
            if (state.controlStack.every((item) => item !== false)) {
              recent.push({
                ip: state.ip,
                opcode: state.instructions[state.ip]?.opcode,
                instructionCount: state.instructions.length,
                depth: state.stack.length,
                top: state.stack.slice(-6).map((item) => `${item.length}:${binToHex(item.slice(0, 48))}`),
              });
              if (recent.length > 40) recent.shift();
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_EQUALVERIFY) {
              largeEqualVerifies.push({
                ip: state.ip,
                instructionCount: state.instructions.length,
                left: binToHex(state.stack.at(-2)!), right: binToHex(state.stack.at(-1)!),
              });
              if (largeEqualVerifies.length > 12) largeEqualVerifies.shift();
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_VERIFY
              && state.controlStack.every((item) => item !== false)
              && (state.stack.at(-1)?.length === 0
                || state.stack.at(-1)?.every((byte) => byte === 0))) {
              failedVerifyPoints.push({
                ip: state.ip,
                instructionCount: state.instructions.length,
                controlStack: state.controlStack.map((item) => typeof item === 'object' ? {
                  ip: item.ip,
                  instructionCount: item.instructions.length,
                  opcode: item.instructions[item.ip]?.opcode,
                } : item),
                stack: state.stack.slice(-12).map((item) => `${item.length}:${binToHex(item)}`),
                instructions: state.instructions.slice(Math.max(0, state.ip - 12), state.ip + 4)
                  .map((instruction, offset) => ({
                    ip: Math.max(0, state.ip - 12) + offset,
                    opcode: instruction.opcode,
                    ...('data' in instruction && { data: binToHex(instruction.data) }),
                  })),
              });
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_OUTPUTTOKENCOMMITMENT
              && state.instructions.length > 10_000) {
              const rawIndex = state.stack.at(-1);
              const index = rawIndex ? Number(vmNumberToBigInt(rawIndex)) : -1;
              outputCommitmentReads.push({
                ip: state.ip,
                index,
                commitment: binToHex(transaction.outputs[index]?.token?.nft?.commitment ?? new Uint8Array()),
                stack: state.stack.slice(-5).map((item) => `${item.length}:${binToHex(item)}`),
              });
              if (outputCommitmentReads.length > 40) outputCommitmentReads.shift();
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_OUTPUTBYTECODE) {
              const rawIndex = state.stack.at(-1);
              const index = rawIndex ? Number(vmNumberToBigInt(rawIndex)) : -1;
              outputBytecodeReads.push({
                ip: state.ip,
                instructionCount: state.instructions.length,
                index,
                lockingBytecode: index >= 0 && index < transaction.outputs.length
                  ? binToHex(transaction.outputs[index]!.lockingBytecode) : undefined,
              });
              if (outputBytecodeReads.length > 400) outputBytecodeReads.shift();
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_UTXOBYTECODE) {
              const rawIndex = state.stack.at(-1);
              const index = rawIndex ? Number(vmNumberToBigInt(rawIndex)) : -1;
              outputBytecodeReads.push({
                ip: state.ip,
                instructionCount: state.instructions.length,
                index,
                lockingBytecode: index >= 0 && index < sourceOutputs.length
                  ? binToHex(sourceOutputs[index]!.lockingBytecode) : undefined,
                inputRead: true,
              });
              if (outputBytecodeReads.length > 400) outputBytecodeReads.shift();
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_UTXOTOKENCATEGORY) {
              const rawIndex = state.stack.at(-1);
              const index = rawIndex ? Number(vmNumberToBigInt(rawIndex)) : -1;
              outputBytecodeReads.push({
                ip: state.ip,
                instructionCount: state.instructions.length,
                index,
                lockingBytecode: index >= 0 && index < sourceOutputs.length
                  ? binToHex(sourceOutputs[index]!.token?.category ?? new Uint8Array()) : undefined,
                inputCategoryRead: true,
              });
              if (outputBytecodeReads.length > 400) outputBytecodeReads.shift();
            }
            if (state.instructions.length > 1000) {
              const instruction = state.instructions[state.ip];
              instructionWindow.push(`${state.ip}:${instruction?.opcode ?? -1}`
                + `:d${state.stack.length}`
                + `${instruction && 'data' in instruction && instruction.data.length > 0
                  ? `:${binToHex(instruction.data.slice(0, 4))}` : ''}`);
              if (instructionWindow.length > 60) instructionWindow.shift();
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_PICK
              && state.instructions.length > 1000) {
              const rawDepth = state.stack.at(-1);
              const depth = rawDepth ? Number(vmNumberToBigInt(rawDepth)) : -1;
              const picked = state.stack.length >= depth + 2
                ? state.stack[state.stack.length - 2 - depth] : undefined;
              outputBytecodeReads.push({
                ip: state.ip,
                instructionCount: state.instructions.length,
                index: depth,
                lockingBytecode: picked === undefined ? undefined : binToHex(picked.slice(0, 8)),
                pickDepth: true,
                ...(depth >= 18 && {
                  frame: state.stack.slice(-(depth + 4)).reverse()
                    .map((item, ordinal) => `${ordinal}:${item.length}:${binToHex(item.slice(0, 6))}`),
                }),
              });
              if (outputBytecodeReads.length > 400) outputBytecodeReads.shift();
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_INPUTBYTECODE) {
              const rawIndex = state.stack.at(-1);
              inputReads.push({
                ip: state.ip,
                instructionCount: state.instructions.length,
                index: rawIndex ? String(vmNumberToBigInt(rawIndex)) : 'missing',
                prior: state.stack.at(-2) ? binToHex(state.stack.at(-2)!.slice(0, 16)) : undefined,
                unlockingHead: rawIndex && Number(vmNumberToBigInt(rawIndex)) >= 0
                  ? binToHex(transaction.inputs[Number(vmNumberToBigInt(rawIndex))]
                    ?.unlockingBytecode.slice(0, 24) ?? new Uint8Array()) : undefined,
              });
              if (inputReads.length > 30) inputReads.shift();
            }
          },
        }).evaluate({ inputIndex, sourceOutputs, transaction });
        console.error('message-bus-failure-ring', recent);
        console.error('message-bus-prior-program-ring', priorProgramRecent);
        console.error('message-bus-input-reads', inputReads);
        // Keep long equality operands on one line so focused diagnostics can be filtered without losing the
        // continuation lines to terminal truncation.
        console.error('message-bus-large-equals', JSON.stringify(largeEqualVerifies));
        console.error('message-bus-failed-verifies', JSON.stringify(failedVerifyPoints));
        console.error('message-bus-output-commitment-reads', JSON.stringify(outputCommitmentReads));
        console.error('message-bus-output-bytecode-reads', JSON.stringify(outputBytecodeReads));
        console.error('message-bus-instruction-window', JSON.stringify(instructionWindow));
        const allOutputs = transaction.outputs.map((output, index) => ({
          index,
          category: binToHex(output.token?.category ?? new Uint8Array()),
          commitment: binToHex(output.token?.nft?.commitment ?? new Uint8Array()),
          locking: binToHex(output.lockingBytecode),
        }));
        // Compact inventory: every OUTPUTBYTECODE that matches a CashToken entry P2SH32 (aa20…87).
        // Cardinality EQUALVERIFY failures (count vs expected) need the full set, not a mid-tx window.
        console.error('message-bus-entry-lock-inventory', allOutputs
          .filter((output) => /^aa20[0-9a-f]{64}87$/i.test(output.locking))
          .map((output) => ({
            index: output.index,
            lock: output.locking.slice(0, 28),
            cat: output.category.slice(0, 16),
            commitLen: output.commitment.length,
            commitHead: output.commitment.slice(0, 64),
          })));
        console.error('message-bus-return-band', allOutputs.slice(24, 34));
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
        const bytecode = transaction.inputs[inputIndex]?.unlockingBytecode ?? new Uint8Array();
        const pushes: Array<{ at: number; length: number; head: string }> = [];
        for (let at = 0; at < bytecode.length && pushes.length < 80;) {
          const opcode = bytecode[at];
          let width = 0; let length = 0;
          if (opcode >= 1 && opcode <= 75) { width = 1; length = opcode; } else if (opcode === 76 && at + 1 < bytecode.length) { width = 2; length = bytecode[at + 1]; } else if (opcode === 77 && at + 2 < bytecode.length) {
            width = 3; length = bytecode[at + 1] | (bytecode[at + 2] << 8);
          } else break;
          if (at + width + length > bytecode.length) break;
          const payload = bytecode.slice(at + width, at + width + length);
          pushes.push({ at, length, head: binToHex(payload.slice(0, 12)) });
          at += width + length;
        }
        const routeInputs = transaction.inputs.map((txInput, routeInputIndex) => {
          const code = txInput.unlockingBytecode;
          const terminalPushes = Array.from({ length: code.length }, (_unused, at) => {
            const opcode = code[at];
            const width = opcode >= 1 && opcode <= 75 ? 1 : opcode === 76 ? 2 : opcode === 77 ? 3 : 0;
            const length = width === 1 ? opcode : width === 2 ? code[at + 1]
              : width === 3 ? (code[at + 1] | (code[at + 2] << 8)) : -1;
            return width > 0 && at + width + length === code.length ? { at, width, length } : undefined;
          }).filter((value) => value !== undefined);
          const frames: Array<{ at: number; length: number; head: string }> = [];
          for (let at = 0; at < code.length && frames.length < 80;) {
            const opcode = code[at];
            let width = 0; let length = 0;
            if (opcode === 0) { width = 1; length = 0; } else if (opcode >= 1 && opcode <= 75) { width = 1; length = opcode; } else if (opcode === 76 && at + 1 < code.length) { width = 2; length = code[at + 1]; } else if (opcode === 77 && at + 2 < code.length) {
              width = 3; length = code[at + 1] | (code[at + 2] << 8);
            } else break;
            if (at + width + length > code.length) break;
            const payload = code.slice(at + width, at + width + length);
            frames.push({ at, length, head: binToHex(payload.slice(0, 12)) });
            at += width + length;
          }
          return frames[0]?.head === '53434231'
            ? {
              routeInputIndex, bytecodeLength: code.length, frames,
              aroundArguments: binToHex(code.slice(200, 260)),
              tail: binToHex(code.slice(-40)),
              terminalPushes,
            }
            : undefined;
        }).filter((value) => value !== undefined);
        console.error('message-bus-failed-input-pushes', {
          inputIndex, bytecodeLength: bytecode.length, pushes, routeInputs,
          returnRegion: transaction.outputs.slice(36, 44).map((output, offset) => ({
            index: 36 + offset,
            lockingBytecode: binToHex(output.lockingBytecode),
            category: output.token?.category,
            commitment: output.token?.nft?.commitment,
          })),
        });
        const trackedPicks: Array<Record<string, unknown>> = [];
        createVirtualMachineBch2026ForProvider(builder.provider, {
          opcodes: new Set([Op.OP_PICK]),
          beforeOperation: (unknownState) => {
            const state = unknownState as AuthenticationProgramStateCommon;
            const prior = state.instructions[state.ip - 1]?.opcode;
            if (prior !== Op.OP_SUB) return;
            const selectedDepth = state.stack.at(-1);
            const depth = selectedDepth ? Number(vmNumberToBigInt(selectedDepth)) : -1;
            const selected = depth >= 0 ? state.stack[state.stack.length - 2 - depth] : undefined;
            trackedPicks.push({
              ip: state.ip, stackDepth: state.stack.length, selectedDepth: depth,
              selectedLength: selected?.length,
              selectedHead: selected ? binToHex(selected.slice(0, 16)) : undefined,
            });
          },
        }).evaluate({ inputIndex, sourceOutputs, transaction });
        console.error('message-bus-tracked-picks', trackedPicks);
        const proxyBinding: Array<Record<string, unknown>> = [];
        const batchConstruction: Array<Record<string, unknown>> = [];
        const forwardSelectorHistory: Array<Record<string, unknown>> = [];
        let recentlyHadForwardSelector = 0;
        createVirtualMachineBch2026ForProvider(builder.provider, {
          opcodes: new Set(Array.from({ length: 256 }, (_, opcode) => opcode)),
          beforeOperation: (unknownState) => {
            const state = unknownState as AuthenticationProgramStateCommon;
            if (state.ip === 11 && state.instructions[state.ip]?.opcode === Op.OP_EQUALVERIFY) {
              proxyBinding.push({
                instructionCount: state.instructions.length,
                stackDepth: state.stack.length,
                top: state.stack.slice(-6).map((item) => `${item.length}:${binToHex(item)}`),
                selectorDepths: state.stack.flatMap((item, index) =>
                  item.length === 4 && binToHex(item) === '9f3e4a91'
                    ? [state.stack.length - 1 - index] : []),
              });
            }
            if (state.stack.some((item) => item.length >= 4
              && item[0] === 0x53 && item[1] === 0x43 && item[2] === 0x42 && item[3] === 0x31)) {
              batchConstruction.push({
                ip: state.ip,
                opcode: state.instructions[state.ip]?.opcode,
                instructionCount: state.instructions.length,
                batchItems: state.stack.flatMap((item, index) => item.length >= 4
                  && item[0] === 0x53 && item[1] === 0x43 && item[2] === 0x42 && item[3] === 0x31
                  ? [{ depth: state.stack.length - 1 - index, length: item.length,
                    head: binToHex(item.slice(0, 32)) }] : []),
                top: state.stack.slice(-8).map((item) => `${item.length}:${binToHex(item.slice(0, 24))}`),
              });
              if (batchConstruction.length > 40) batchConstruction.shift();
            }
            const selectorDepths = state.stack.flatMap((item, index) =>
              item.length === 4 && binToHex(item) === '9f3e4a91'
                ? [state.stack.length - 1 - index] : []);
            if (selectorDepths.length > 0) recentlyHadForwardSelector = 12;
            if (recentlyHadForwardSelector > 0) {
              forwardSelectorHistory.push({
                ip: state.ip,
                opcode: state.instructions[state.ip]?.opcode,
                instructionCount: state.instructions.length,
                stackDepth: state.stack.length,
                selectorDepths,
                top: state.stack.slice(-6).map((item) => `${item.length}:${binToHex(item.slice(0, 16))}`),
              });
              if (forwardSelectorHistory.length > 60) forwardSelectorHistory.shift();
              recentlyHadForwardSelector -= 1;
            }
          },
        }).evaluate({ inputIndex, sourceOutputs, transaction });
        console.error('message-bus-proxy-binding', proxyBinding);
        console.error('message-bus-batch-construction', batchConstruction);
        console.error('message-bus-forward-selector-history', forwardSelectorHistory);
        const ccHistory: Array<Record<string, unknown>> = [];
        const recentTargetOps: Array<Record<string, unknown>> = [];
        const recentOps: Array<Record<string, unknown>> = [];
        const ccOnsets: Array<Record<string, unknown>[]> = [];
        const emptyDecodeSites: Array<Record<string, unknown>[]> = [];
        const scanUntilStates: Array<Record<string, unknown>> = [];
        let previouslyHadCc = false;
        const allOpcodes = new Set(Array.from({ length: 256 }, (_, opcode) => opcode));
        createVirtualMachineBch2026ForProvider(builder.provider, {
          opcodes: allOpcodes,
          beforeOperation: (unknownState) => {
            const state = unknownState as AuthenticationProgramStateCommon;
            const hasTargetBytecode = state.stack.some((item) => item.length === 19_152);
            const ccIndices = state.stack.flatMap((item, index) =>
              item.length === 1 && item[0] === 0xcc ? [index] : []);
            const record = {
              ip: state.ip,
              opcode: state.instructions[state.ip]?.opcode,
              instructionCount: state.instructions.length,
              programOps: state.instructions.slice(0, 12).map((instruction) => instruction.opcode),
              stackDepth: state.stack.length,
              ccDepths: ccIndices.map((index) => state.stack.length - 1 - index),
              top: state.stack.slice(-8).map((item) => binToHex(item.slice(0, 8))),
            };
            recentOps.push(record);
            if (recentOps.length > 40) recentOps.shift();
            if (hasTargetBytecode && state.instructions[state.ip]?.opcode === Op.OP_UNTIL) {
              scanUntilStates.push(record);
              if (scanUntilStates.length > 12) scanUntilStates.shift();
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_INVOKE
              && state.stack.at(-1)?.length === 1 && state.stack.at(-1)?.[0] === 0x81
              && state.stack.at(-2)?.length === 0) {
              emptyDecodeSites.push([{ ...record,
                fullStack: state.stack.map((item) => `${item.length}:${binToHex(item.slice(0, 16))}`),
              }]);
            }
            if (!hasTargetBytecode) return;
            recentTargetOps.push(record);
            if (recentTargetOps.length > 30) recentTargetOps.shift();
            const hasCc = ccIndices.length > 0;
            if (hasCc && !previouslyHadCc) ccOnsets.push(recentTargetOps.slice());
            previouslyHadCc = hasCc;
            if (!hasCc) return;
            ccHistory.push(record);
            if (ccHistory.length > 120) ccHistory.shift();
          },
        }).evaluate({ inputIndex, sourceOutputs, transaction });
        console.error('message-bus-scan-until', scanUntilStates);
        console.error('message-bus-empty-decode-sites', emptyDecodeSites.slice(-4));
        console.error('message-bus-cc-onsets', ccOnsets.slice(0, 8));
        console.error('message-bus-cc-history', ccHistory);
      }
      const routeDebugEnv = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
      const routeDebugInput = Number(routeDebugEnv?.SOLIDC_DEBUG_ROUTE_INPUT_INDEX ?? inputIndex);
      if ((routeDebugEnv?.SOLIDC_DEBUG_PREFLIGHT_ROUTE === '1' || narrowPreflight)
        && routeDebugInput === inputIndex) {
        let failedComparison: {
          ip: number; opcode?: number; instructionCount: number; left?: string; right?: string;
          lastOutputCategoryIndex?: number;
          lastOutputCategory?: string;
          lastOutputBytecodeIndex?: number;
          lastOutputCommitmentIndex?: number;
          lastInputBytecodeIndex?: number;
          lastInputSourceLock?: string;
          lastInputUnlockerLock?: string;
        } | undefined;
        let lastOutputCategoryIndex: number | undefined;
        let lastOutputCategory: string | undefined;
        let lastOutputBytecodeIndex: number | undefined;
        let lastOutputCommitmentIndex: number | undefined;
        // Input-side counterpart: a block/entry guard compares `tx.inputs[OP_INPUTINDEX + n].lockingBytecode`
        // against an expected lock, so the index it resolved is the coordinate under test. Captured at the
        // OP_UTXOBYTECODE that reads it, because the comparison itself has already popped both operands.
        let lastInputBytecodeIndex: number | undefined;
        let inputGuardOperands: Array<{ depth: number; bytes: number; hex: string }> | undefined;
        const diagnosticLargeValues = new Map<string, number>();
        createVirtualMachineBch2026ForProvider(builder.provider, {
          opcodes: new Set([
            Op.OP_VERIFY, Op.OP_EQUAL, Op.OP_EQUALVERIFY, Op.OP_NUMEQUAL, Op.OP_NUMEQUALVERIFY,
            Op.OP_OUTPUTTOKENCATEGORY, Op.OP_PICK, Op.OP_DUP, Op.OP_UTXOTOKENCATEGORY,
            Op.OP_OUTPUTBYTECODE, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_UTXOBYTECODE, Op.OP_ACTIVEBYTECODE,
            Op.OP_INVOKE,
          ]),
          beforeOperation: (unknownState) => {
            const state = unknownState as AuthenticationProgramStateCommon;
            for (const item of state.stack) {
              if (item.length < 190 || item.length > 210) continue;
              diagnosticLargeValues.set(binToHex(item), item.length);
              if (diagnosticLargeValues.size > 32) {
                diagnosticLargeValues.delete(diagnosticLargeValues.keys().next().value!);
              }
            }
            if (state.instructions.length === 84 && state.ip >= 30) {
              console.error('preflight-event-resolver', JSON.stringify({
                ip: state.ip,
                opcode: state.instructions[state.ip]?.opcode,
                stack: state.stack.slice(-12).map((item, offset, items) => ({
                  d: items.length - 1 - offset,
                  hex: binToHex(item).slice(0, 96),
                  number: (() => { try { return vmNumberToBigInt(item).toString(); } catch { return undefined; } })(),
                })),
              }));
            }
            if (state.instructions.length === 232 && [157, 159, 160, 162].includes(state.ip)) {
              console.error('preflight-effect-coordinate', JSON.stringify({
                ip: state.ip,
                depth: state.stack.length,
                top: state.stack.slice(-16).map((item, offset, items) => ({
                  d: items.length - 1 - offset,
                  bytes: item.length,
                  hex: binToHex(item).slice(0, 96),
                  number: (() => { try { return vmNumberToBigInt(item).toString(); } catch { return undefined; } })(),
                })),
              }));
            }
            if (state.instructions.length > 8 && state.instructions.length < 200
              && (state.instructions[state.ip]?.opcode === Op.OP_VERIFY
                || state.instructions[state.ip]?.opcode === Op.OP_EQUALVERIFY)) {
              console.error('preflight-mid-body', {
                ip: state.ip,
                opcode: state.instructions[state.ip]?.opcode,
                instructionCount: state.instructions.length,
                stack: state.stack.slice(-16).map((item, offset) => ({
                  d: state.stack.length - 16 + offset < 0
                    ? offset : state.stack.length - (state.stack.slice(-16).length) + offset,
                  bytes: item.length,
                  hex: binToHex(item).slice(0, 80),
                })),
                window: state.instructions.slice(Math.max(0, state.ip - 15), state.ip + 2).map((ins, offset) => ({
                  ip: Math.max(0, state.ip - 15) + offset,
                  opcode: ins.opcode,
                })),
              });
            }
            if (state.instructions.length <= 8) {
              const fullStack = state.instructions.length === 5
                && state.instructions[state.ip]?.opcode === Op.OP_PICK
                ? state.stack.map((item, depthFromBottom) => ({
                  i: depthFromBottom,
                  d: state.stack.length - 1 - depthFromBottom,
                  bytes: item.length,
                  hex: binToHex(item).slice(0, 72),
                }))
                : undefined;
              console.error('preflight-tiny-body', {
                ip: state.ip,
                opcode: state.instructions[state.ip]?.opcode,
                instructionCount: state.instructions.length,
                stack: state.stack.slice(-12).map((item) => ({
                  bytes: item.length,
                  hex: binToHex(item).slice(0, 72),
                })),
                ...(fullStack ? { fullStack } : {}),
                alt: ('alternateStack' in state
                  ? (state as { alternateStack: Uint8Array[] }).alternateStack
                  : []).slice(-4).map((item) => binToHex(item).slice(0, 40)),
              });
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_UTXOBYTECODE) {
              const indexBytes = state.stack.at(-1);
              lastInputBytecodeIndex = indexBytes === undefined ? undefined
                : Number(vmNumberToBigInt(indexBytes));
              if (state.instructions.length <= 12) {
                // A short compiler-generated guard: its whole operand window is the only place the coordinate and
                // the expected value can be read, so keep the top of the stack at the read.
                inputGuardOperands = state.stack.slice(-8).map((item, offset, items) => ({
                  depth: items.length - 1 - offset,
                  bytes: item.length,
                  hex: binToHex(item).slice(0, 80),
                }));
              }
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_OUTPUTBYTECODE) {
              const indexBytes = state.stack.at(-1);
              lastOutputBytecodeIndex = indexBytes === undefined ? undefined
                : Number(vmNumberToBigInt(indexBytes));
              if (state.instructions.length > 200) {
                console.error('preflight-outbc-stack', {
                  index: lastOutputBytecodeIndex,
                  ip: state.ip,
                  depth: state.stack.length,
                  top: state.stack.slice(-16).map((item, offset) => ({
                    d: 15 - offset,
                    bytes: item.length,
                    hex: binToHex(item).slice(0, 40),
                  })),
                });
              }
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_OUTPUTTOKENCOMMITMENT) {
              const indexBytes = state.stack.at(-1);
              lastOutputCommitmentIndex = indexBytes === undefined ? undefined
                : Number(vmNumberToBigInt(indexBytes));
            }
            if (state.instructions[state.ip]?.opcode === Op.OP_OUTPUTTOKENCATEGORY) {
              const indexBytes = state.stack.at(-1);
              lastOutputCategoryIndex = indexBytes === undefined ? undefined
                : Number(vmNumberToBigInt(indexBytes));
              lastOutputCategory = transaction.outputs[lastOutputCategoryIndex ?? -1]?.token
                ? `${binToHex(transaction.outputs[lastOutputCategoryIndex!].token!.category)}:`
                  + `${transaction.outputs[lastOutputCategoryIndex!].token!.nft?.capability ?? 'ft'}`
                : 'none';
            }
            failedComparison = {
              ip: state.ip,
              opcode: state.instructions[state.ip]?.opcode,
              instructionCount: state.instructions.length,
              left: state.stack.at(-2) && binToHex(state.stack.at(-2)!),
              right: state.stack.at(-1) && binToHex(state.stack.at(-1)!),
              lastOutputCategoryIndex,
              lastOutputCategory,
              lastOutputBytecodeIndex,
              lastOutputCommitmentIndex,
              lastInputBytecodeIndex,
              // The VM's own view of the input the guard read, next to what that input's unlocker would generate.
              // A mismatch between the two is a stale source list; agreement means the guard's EXPECTATION is wrong.
              lastInputSourceLock: lastInputBytecodeIndex === undefined ? undefined
                : binToHex(sourceOutputs[lastInputBytecodeIndex]?.lockingBytecode ?? new Uint8Array()),
              lastInputUnlockerLock: lastInputBytecodeIndex === undefined ? undefined
                : binToHex((builder.inputs[lastInputBytecodeIndex] as unknown as {
                  unlocker?: { generateLockingBytecode?: () => Uint8Array };
                })?.unlocker?.generateLockingBytecode?.() ?? new Uint8Array()),
            };
          },
        }).evaluate({ inputIndex, sourceOutputs, transaction });
        const failUnlocker = (builder.inputs[inputIndex] as unknown as {
          unlocker?: {
            abiFunction?: { name?: string; inputs?: ReadonlyArray<{ name: string }> };
            params?: readonly unknown[];
          };
        })?.unlocker;
        if (failUnlocker?.abiFunction?.inputs && failUnlocker.params) {
          console.error('preflight-unlocker-params', {
            inputIndex,
            name: failUnlocker.abiFunction.name,
            params: failUnlocker.abiFunction.inputs.map((input, i) => {
              const value = failUnlocker.params?.[i];
              let rendered: unknown = value;
              if (value instanceof Uint8Array) rendered = binToHex(value).slice(0, 72);
              else if (typeof value === 'bigint') rendered = value.toString();
              else if (Array.isArray(value)) rendered = `array(${value.length})`;
              return { name: input.name, value: rendered };
            }),
          });
        }
        console.error('preflight-head-layout', {
          inputIndex,
          inputs: builder.inputs.slice(0, 20).map((input, index) => {
            const unlocker = input && 'unlocker' in input ? input.unlocker as {
              abiFunction?: { name?: string };
              contract?: { artifact?: { contractName?: string }; name?: string };
              generateLockingBytecode?: () => Uint8Array;
            } | undefined : undefined;
            return {
              index,
              name: unlocker?.abiFunction?.name
                ?? unlocker?.contract?.artifact?.contractName
                ?? unlocker?.contract?.name,
              lock: unlocker?.generateLockingBytecode
                ? binToHex(unlocker.generateLockingBytecode()).slice(0, 28) : '',
              cap: input?.token?.nft?.capability ?? (input ? 'plain' : 'missing'),
              cat: String(input?.token?.category ?? '').slice(0, 16),
            };
          }),
          outputs: builder.outputs.slice(0, 20).map((output, index) => ({
            index,
            lock: (typeof output.to === 'string' ? output.to : binToHex(output.to as Uint8Array)).slice(0, 28),
            cap: output?.token?.nft?.capability ?? (output ? 'plain' : 'missing'),
            cat: String(output?.token?.category ?? '').slice(0, 16),
            commit: String(output?.token?.nft?.commitment ?? '').slice(0, 24),
          })),
          sourceOuts: sourceOutputs.slice(0, 20).map((output, index) => ({
            index,
            lock: binToHex(output.lockingBytecode).slice(0, 28),
            cap: output.token?.nft?.capability ?? (output.token ? 'ft' : 'plain'),
            cat: output.token ? binToHex(output.token.category).slice(0, 16) : '',
            commit: output.token?.nft ? binToHex(output.token.nft.commitment).slice(0, 40) : '',
          })),
          txOuts: transaction.outputs.slice(0, 20).map((output, index) => ({
            index,
            lock: binToHex(output.lockingBytecode).slice(0, 28),
            cap: output.token?.nft?.capability ?? (output.token ? 'ft' : 'plain'),
            cat: output.token ? binToHex(output.token.category).slice(0, 16) : '',
            commit: output.token?.nft ? binToHex(output.token.nft.commitment).slice(0, 24) : '',
          })),
        });
        const failureStackHex = new Set(evaluated.stack.map((item) => binToHex(item)));
        console.error('preflight-stack-matching-outputs', transaction.outputs.flatMap((output, index) => {
          const lock = binToHex(output.lockingBytecode);
          const commitment = output.token?.nft ? binToHex(output.token.nft.commitment) : '';
          return ((lock !== '51' && failureStackHex.has(lock))
            || (commitment.length > 0 && failureStackHex.has(commitment))) ? [{
            index,
            lock,
            commitment,
            capability: output.token?.nft?.capability,
          }] : [];
        }));
        console.error('message-bus-preflight-failure', JSON.stringify({
          diagnosticLargeValues: [...diagnosticLargeValues].map(([hex, bytes]) => ({ bytes, hex })),
          inputGuardOperands,
          inputIndex,
          ip: evaluated.ip,
          opcode: evaluated.instructions[evaluated.ip]?.opcode,
          instructionCount: evaluated.instructions.length,
          error: evaluated.error,
          failedComparison,
          stack: evaluated.stack.slice(-8).map((item) => ({
            bytes: item.length,
            hex: binToHex(item).slice(0, 128),
            ...(item.length > 64 && { truncated: true }),
          })),
          instructions: evaluated.instructions.slice(
            Math.max(0, evaluated.ip - 12), evaluated.ip + 3,
          ).map((instruction, offset) => ({
            ip: Math.max(0, evaluated.ip - 12) + offset,
            opcode: instruction.opcode,
            ...('data' in instruction && { data: binToHex(instruction.data).slice(0, 64) }),
          })),
          callers: evaluated.controlStack.slice(-8).map((frame) => typeof frame === 'object' ? {
            ip: frame.ip,
            opcode: frame.instructions[frame.ip]?.opcode,
            instructionCount: frame.instructions.length,
            stack: ('stack' in frame && Array.isArray(frame.stack))
              ? frame.stack.slice(-16).map((item: Uint8Array) => ({
                bytes: item.length, hex: binToHex(item).slice(0, 128),
              })) : undefined,
            alternateStack: ('alternateStack' in frame && Array.isArray(frame.alternateStack))
              ? frame.alternateStack.slice(-8).map((item: Uint8Array) => ({
                bytes: item.length, hex: binToHex(item).slice(0, 128),
              })) : undefined,
          } : frame),
          nearOutputs: transaction.outputs.slice(
            Math.max(0, (lastOutputBytecodeIndex ?? inputIndex) - 5),
            (lastOutputBytecodeIndex ?? inputIndex) + 6,
          ).map((output, offset) => ({
            index: Math.max(0, (lastOutputBytecodeIndex ?? inputIndex) - 5) + offset,
            lockingBytecode: binToHex(output.lockingBytecode),
            category: output.token && binToHex(output.token.category),
            capability: output.token?.nft?.capability,
            commitment: output.token?.nft && binToHex(output.token.nft.commitment),
          })),
        }));
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ROUTE_INPUTS === '1') {
        // Names the contract/function behind every co-spent input, so a failing index can be attributed without
        // decoding locking bytecode by hand. The composition places participants far from their proxies.
        console.error('route-inputs', builder.inputs.map((u, i) => {
          const un = (u as { unlocker?: { contract?: { name?: string };
            abiFunction?: { name?: string } } }).unlocker;
          if (!un?.contract?.name) return undefined;
          return `${i}${i === inputIndex ? '*FAIL' : ''}:${un.contract.name}.${un.abiFunction?.name ?? '-'}`;
        }).filter(Boolean).join(' | '));
      }
      const failingProgram = evaluated.instructions as readonly { opcode: number; data?: Uint8Array }[];
      // The instruction that failed, the one the state points at, and the window before it: a bare "failed an
      // OP_VERIFY" cannot be attributed without them, and re-running with an instrumented build should not be
      // necessary to see which construct refused.
      const windowStart = Math.max(0, evaluated.ip - 9);
      throw mapMessageBusVmFailure(builder, transaction, inputIndex, String(objection), {
        ip: evaluated.ip,
        instructions: evaluated.instructions,
        programLength: failingProgram.length,
        opcode: failingProgram[evaluated.ip]?.opcode,
        previousOpcode: failingProgram[evaluated.ip - 1]?.opcode,
        window: failingProgram.slice(windowStart, evaluated.ip + 1).map((instruction) => (
          instruction.data === undefined || instruction.data.length === 0
            ? String(instruction.opcode)
            : `${String(instruction.opcode)}:${binToHex(instruction.data).slice(0, 12)}`)),
      });
    }
  });
  if (!narrowPreflight) {
    rememberPreparedCovenantValidation(builder.provider, transaction, sourceOutputs);
  }
};

const readPush = (
  bytecode: Uint8Array, offset: number,
): { data: Uint8Array; nextOffset: number } | undefined => {
  if (offset >= bytecode.length) return undefined;
  const opcode = bytecode[offset];
  let width = 0;
  let length = 0;
  if (opcode === 0) {
    width = 1;
  } else if (opcode >= 1 && opcode <= 75) {
    width = 1;
    length = opcode;
  } else if (opcode === 76 && offset + 1 < bytecode.length) {
    width = 2;
    length = bytecode[offset + 1];
  } else if (opcode === 77 && offset + 2 < bytecode.length) {
    width = 3; length = bytecode[offset + 1] | (bytecode[offset + 2] << 8);
  } else if (opcode === 78 && offset + 4 < bytecode.length) {
    width = 5;
    length = bytecode[offset + 1]
      | (bytecode[offset + 2] << 8)
      | (bytecode[offset + 3] << 16)
      | (bytecode[offset + 4] << 24);
  }
  const dataOffset = offset + width;
  const nextOffset = dataOffset + length;
  if (width === 0 || length < 0 || nextOffset > bytecode.length) return undefined;
  return { data: bytecode.slice(dataOffset, nextOffset), nextOffset };
};

/** Atomic graph-verifier unlocks place their L3V1 envelope in the first push. */
const firstPush = (bytecode: Uint8Array): Uint8Array | undefined => readPush(bytecode, 0)?.data;

/** A compiler route unlock starts with push4(SCB1); V5 root frames insert the L3C1 carrier before the batch. */
const compilerRouteEnvelope = (bytecode: Uint8Array): Uint8Array | undefined => {
  const selector = readPush(bytecode, 0);
  if (!selector || binToHex(selector.data) !== '53434231') return undefined;
  const first = readPush(bytecode, selector.nextOffset);
  if (!first) return undefined;
  const rootCarrier = bytecode[selector.nextOffset] === 0x4d
    && first.data.length >= ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES
    && binToHex(first.data.slice(0, 4)) === '4c334331';
  return rootCarrier ? readPush(bytecode, first.nextOffset)?.data : first.data;
};

/** Validate the framing shared by canonical v1 and v2 route batches without interpreting typed arguments. */
const isCanonicalCompilerRouteEnvelope = (envelope: Uint8Array): boolean => {
  if (envelope.length < 7 || binToHex(envelope.slice(0, 4)) !== '53434231'
    || (envelope[4] !== 1 && envelope[4] !== 2)
    || (envelope[5] !== 0 && envelope[5] !== 1) || envelope[6] < 1) return false;
  const version = envelope[4];
  const valueMode = envelope[5] === 1;
  let cursor = 7;
  for (let row = 0; row < envelope[6]; row += 1) {
    const headerLength = 12 + (version === 2 ? 1 : 0) + (valueMode ? 9 : 0);
    if (cursor + headerLength > envelope.length) return false;
    const argsLength = envelope[cursor + 10] | (envelope[cursor + 11] << 8);
    if (version === 2 && envelope[cursor + 12] > 1) return false;
    cursor += headerLength + argsLength;
    if (cursor > envelope.length) return false;
  }
  return cursor === envelope.length;
};

/** Preserve the VM's raw objection while naming malformed compiler-route envelopes at their exact input. */
export function mapMessageBusVmFailure(
  builder: TransactionBuilder,
  transaction: Transaction,
  inputIndex: number,
  rawVmReason: string,
  failure?: {
    ip?: number; programLength?: number; opcode?: number; previousOpcode?: number;
    instructions?: ReturnType<typeof decodeAuthenticationInstructions>;
    window?: readonly string[];
  },
): Error {
  // libauth reports the state at the instruction that follows a failed operation, so both opcodes are named: the
  // one that failed (`ip - 1`) and the one the state points at. Without this the raw VM reason names neither the
  // instruction nor the frame, and a bare `failed an OP_VERIFY operation` cannot be attributed.
/**
 * Name the rows a failing message-bus frame executes. A frame batches one row per logical call, so "which call was
 * this input running" is the first question a participant failure raises - and it cannot be answered from the
 * selector the unlocker reports (that names the frame, not its rows). The blob is the first push of the enclosing
 * unlocking bytecode: `53434231 || version || valueMode || rowCount || rows[selector||index||..||argsLength||args]`.
 * Returns undefined for an ordinary selector-dispatched frame.
 */
function describeMessageBusBatchRows(
  unlockingBytecode: Uint8Array, artifact: { messageBus?: { handlers?: readonly { name?: string; selector?: string }[] } }
    | undefined,
): string | undefined {
  if (unlockingBytecode.length < 7) return undefined;
  if (binToHex(unlockingBytecode.slice(0, 4)) !== '53434231') return undefined;
  const valueMode = unlockingBytecode[4 + 1] === 1;
  const rowCount = unlockingBytecode[6];
  const handlers = artifact?.messageBus?.handlers ?? [];
  const rows: string[] = [];
  let offset = 7;
  for (let row = 0; row < rowCount; row += 1) {
    if (offset + 12 > unlockingBytecode.length) break;
    const selector = binToHex(unlockingBytecode.slice(offset, offset + 4));
    const logicalIndex = unlockingBytecode[offset + 4] | (unlockingBytecode[offset + 5] << 8)
      | (unlockingBytecode[offset + 6] << 16) | (unlockingBytecode[offset + 7] << 24);
    const argsLength = unlockingBytecode[offset + 10] | (unlockingBytecode[offset + 11] << 8);
    const name = handlers.find((handler) => handler.selector?.toLowerCase() === selector)?.name;
    rows.push(`${name ?? selector}@${String(logicalIndex)}${argsLength === 0 ? '' : `/${String(argsLength)}b`}`);
    offset += 12 + argsLength + (valueMode ? 8 : 0);
  }
  return ` (batch rows ${String(rowCount)}: ${rows.join(', ')})`;
}

  const detailedFailure = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_FAILURE_POINT === '1';
  const location = !detailedFailure || failure === undefined || !Number.isInteger(failure.ip) ? ''
    : ` (ip ${String(failure.ip)}`
      + `${failure.programLength === undefined ? '' : ` of ${String(failure.programLength)}`}`
      + `${failure.opcode === undefined ? '' : `, opcode ${String(failure.opcode)}`}`
      + `${failure.previousOpcode === undefined ? '' : `, failing opcode ${String(failure.previousOpcode)}`}`
      + `${failure.window === undefined || failure.window.length === 0
        ? '' : `, window ${failure.window.join(' ')}`})`;
  const input = builder.inputs[inputIndex] as {
    unlocker?: {
      abiFunction?: { selector?: string; name?: string };
      contract?: {
        artifact?: {
          contractName?: string;
          source?: string;
          functionBodies?: Record<string, string>;
          messageBus?: { handlers?: readonly { name?: string; selector?: string }[] };
          debug?: {
            functionDebug?: Record<string, {
              requires?: Array<{ ip: number; line: number; message?: string }>;
              sourceMap?: string;
            }>;
          };
        };
      };
    }
  } | undefined;
  // An exact decoded body is stronger than a source-map heuristic. Compare it to every participant's published
  // function body, since a routed input can execute another participant's implementation. An ambiguous match does
  // not authorize a require attribution.
  const bodyRequireAttribution = (() => {
    if (failure?.instructions === undefined || !Number.isSafeInteger(failure.ip)) return undefined;
    const executedBody = binToHex(encodeAuthenticationInstructions(failure.instructions));
    const matches: Array<{
      artifactName: string;
      selector: string;
      requireStatement: { ip: number; line: number; message?: string };
    }> = [];
    const visited = new Set<unknown>();
    const inspect = (candidate: unknown): void => {
      if (candidate === undefined || candidate === null || visited.has(candidate)) return;
      visited.add(candidate);
      const artifact = candidate as {
        contractName?: string;
        functionBodies?: Record<string, string>;
        debug?: { functionDebug?: Record<string, {
          requires?: Array<{ ip: number; line: number; message?: string }>;
        }> };
        delegateArtifact?: unknown;
      };
      for (const [selector, body] of Object.entries(artifact.functionBodies ?? {})) {
        if (body.toLowerCase() !== executedBody) continue;
        const requireStatement = artifact.debug?.functionDebug?.[selector]?.requires
          ?.find((entry) => entry.ip === failure.ip! - 1)
          ?? artifact.debug?.functionDebug?.[selector]?.requires
            ?.find((entry) => entry.ip === failure.ip);
        if (requireStatement !== undefined) {
          matches.push({ artifactName: artifact.contractName ?? 'contract', selector, requireStatement });
        }
      }
      inspect(artifact.delegateArtifact);
    };
    for (const participant of builder.inputs as Array<{
      unlocker?: { contract?: { artifact?: unknown } };
    }>) inspect(participant.unlocker?.contract?.artifact);
    const activeSelector = input?.unlocker?.abiFunction?.selector?.toLowerCase();
    const activeMatches = activeSelector === undefined ? []
      : matches.filter((match) => match.selector.toLowerCase() === activeSelector);
    const selected = activeMatches.length > 0 ? activeMatches : matches;
    const unique = new Map(selected.map((match) => [
      `${match.artifactName}\u0000${match.selector}\u0000${match.requireStatement.ip}\u0000${match.requireStatement.line}`
        + `\u0000${match.requireStatement.message ?? ''}`, match,
    ]));
    if (unique.size === 1) return { exact: [...unique.values()][0] };
    // Several source functions can compile to byte-identical bodies. With no selector we cannot identify their
    // source line, but a single named candidate can still give a clearly qualified diagnostic hint.
    const messages = new Set([...unique.values()].map((match) => match.requireStatement.message)
      .filter((message): message is string => message !== undefined));
    return messages.size === 1 ? { possibleMessage: [...messages][0] } : undefined;
  })();
  // Name the source predicate when the artifact maps this instruction to one. The compiler records requires per
  // function selector; libauth reports the state after the failure, so `ip - 1` is checked first.
  const exactRequire = bodyRequireAttribution?.exact;
  const requireSite = exactRequire !== undefined
    ? `; failing require in ${exactRequire.artifactName}:${exactRequire.requireStatement.line}`
      + `${exactRequire.requireStatement.message === undefined
        ? '' : ` (${exactRequire.requireStatement.message})`}`
    : bodyRequireAttribution?.possibleMessage !== undefined
      ? `; possible require reason from an equivalent function body: ${bodyRequireAttribution.possibleMessage}`
    : detailedFailure ? ((): string => {
    // A proxied call executes the implementation's body, so the delegate artifact chain is searched too - the same
    // widening `probeRequireStatement` performs for probes.
    type ArtifactDebugView = {
      contractName?: string;
      source?: string;
      functionBodies?: Record<string, string>;
      debug?: {
        /** `false` on an unoptimised build: instruction pointers map exactly to source locations. */
        optimise?: boolean;
        functionDebug?: Record<string, {
          requires?: Array<{ ip: number; line: number; message?: string }>;
          sourceMap?: string;
        }>;
      };
      delegateArtifact?: unknown;
    };
    const artifacts: ArtifactDebugView[] = [];
    const seen = new Set<unknown>();
    const add = (artifact: unknown): void => {
      if (artifact === undefined || artifact === null || seen.has(artifact)) return;
      seen.add(artifact);
      const typed = artifact as ArtifactDebugView;
      artifacts.push(typed);
      add(typed.delegateArtifact);
    };
    add(input?.unlocker?.contract?.artifact);
    const selector = input?.unlocker?.abiFunction?.selector;
    for (const artifact of artifacts) {
      const functions = artifact.debug?.functionDebug;
      if (!functions) continue;
      const selectors = selector !== undefined && functions[selector] !== undefined
        ? [selector] : Object.keys(functions);
      for (const candidate of selectors) {
        const requirements = functions[candidate]?.requires ?? [];
        const hit = requirements.find((entry) => entry.ip === (failure?.ip ?? -1) - 1)
          ?? requirements.find((entry) => entry.ip === failure?.ip);
        if (hit !== undefined) {
          return `; failing require in ${artifact.contractName ?? 'contract'}:${hit.line}`
            + `${hit.message === undefined ? '' : ` (${hit.message})`}`;
        }
      }
    }
    // No `requires` entry: fall back to the artifact's source map. The assembled frame carries a prologue the
    // artifact body does not (measured: 6183-instruction frame over a 6174-instruction body), so the body index is
    // the runtime ip minus that delta - without the correction the lookup lands on an unrelated instruction.
    const sources = artifacts.filter((candidate) => candidate.functionBodies !== undefined);
    for (const artifact of sources) {
      const functions = artifact.debug?.functionDebug;
      if (!functions) continue;
      const runtimeIp = failure?.ip;
      if (runtimeIp === undefined) continue;
      const selector = input?.unlocker?.abiFunction?.selector;
      const selectors = selector !== undefined && functions[selector] !== undefined
        ? [selector] : Object.keys(functions);
      for (const candidate of selectors) {
        const sourceMap = functions[candidate]?.sourceMap;
        const body = artifact.functionBodies?.[candidate];
        if (typeof sourceMap !== 'string' || typeof body !== 'string') continue;
        let instructions = 0;
        for (let offset = 0; offset < body.length / 2;) {
          const opcode = Number.parseInt(body.slice(offset * 2, offset * 2 + 2), 16);
          if (!Number.isFinite(opcode)) break;
          offset += opcode > 0 && opcode < 0x4c ? 1 + opcode
            : opcode === 0x4c ? 2 + Number.parseInt(body.slice((offset + 1) * 2, (offset + 2) * 2), 16)
              : opcode === 0x4d ? 3 + Number.parseInt(body.slice((offset + 1) * 2, (offset + 3) * 2), 16) : 1;
          instructions += 1;
        }
        // The assembled frame and the artifact body differ by prologue, outlining and inlining, so no single delta
        // is reliable (measured: 6183-instruction frame over a 6174-instruction body with a 15-instruction
        // prologue). Scan a small window of candidate indices and accept only a segment whose source line is a
        // `require` - the caller asked about a failed verify, so that is the construct worth naming.
        const segments = sourceMap.split(';');
        const sourceLines = (artifact.source ?? '').split('\n');
        const correction = instructions - (failure?.programLength ?? instructions);
        // An unoptimised artifact emits the generator's own instructions, so the mapping at the runtime index is
        // exact: report it whatever the line says instead of searching for a `require`-looking neighbour.
        const exact = artifact.debug?.optimise === false;
        const deltas = exact ? [0] : Array.from({ length: 29 }, (_unused, index) => index - 24);
        for (const delta of deltas) {
          for (const candidateIndex of [runtimeIp + correction + delta, runtimeIp + delta]) {
            if (candidateIndex < 0 || candidateIndex >= segments.length) continue;
            const line = Number(segments[candidateIndex]?.split(':')[0]);
            if (!Number.isFinite(line) || line <= 0) continue;
            const text = sourceLines[line - 1]?.trim();
            if (text === undefined || (!exact && !/require\s*\(|revert|assert\s*\(/.test(text))) continue;
            return `; failing instruction at ${artifact.contractName ?? 'contract'}:${line}`
              + `${exact ? ' (unoptimised artifact: exact mapping)' : ''} (${text.slice(0, 80)})`;
          }
        }
      }
    }
    return '';
  })() : '';
  if (input?.unlocker?.abiFunction?.selector?.toLowerCase() !== '53434231') {
    const batchRows = describeMessageBusBatchRows(
      transaction.inputs[inputIndex]?.unlockingBytecode ?? new Uint8Array(), input?.unlocker?.contract?.artifact,
    );
    // An ordinary selector's bare `require` has no custom reason to append. Preserve the established raw
    // preflight message for callers matching that exact VM objection; the exact source site remains available
    // as structured `requireStatement` metadata. Named reasons and explicit debug traces still render inline.
    const directRequireSite = exactRequire !== undefined
      && exactRequire.requireStatement.message === undefined && !detailedFailure
      ? '' : requireSite;
    const mapped = new Error(
      `messageBus: BCH-2026 preflight failed at input ${inputIndex}${location}${batchRows ?? ''}: `
      + `${rawVmReason}${directRequireSite}`,
    );
    if (exactRequire !== undefined) {
      Object.assign(mapped, { requireStatement: exactRequire.requireStatement, inputIndex });
    }
    return mapped;
  }
  const envelope = compilerRouteEnvelope(
    transaction.inputs[inputIndex]?.unlockingBytecode ?? new Uint8Array(),
  );
  const context = { inputIndex, rawVmReason, metadataField: 'message-bus batch.envelope' };
  if (envelope && envelope.length >= 5
    && binToHex(envelope.slice(0, 4)) === '53434231'
    && envelope[4] !== 1 && envelope[4] !== 2) {
    return new MessageBusDiagnosticError(
      'L3_MESSAGE_BUS_VERSION_UNSUPPORTED',
      `BCH-2026 preflight failed at input ${inputIndex}${location}: `
        + `message-bus batch version ${envelope[4]} is unsupported; `
        + `VM: ${rawVmReason}`,
      { ...context, metadataField: 'message-bus batch.version', actual: envelope[4], expected: [1, 2] },
    );
  }
  if (!envelope || !isCanonicalCompilerRouteEnvelope(envelope)) {
    return new MessageBusDiagnosticError(
      'L3_MESSAGE_BUS_ENVELOPE_MALFORMED',
      `BCH-2026 preflight failed at input ${inputIndex}${location}: `
        + `malformed message-bus batch envelope; VM: ${rawVmReason}`,
      context,
    );
  }
  if (/(limit|maximum|exceed|operation cost|stack|memory|sigchecks)/i.test(rawVmReason)) {
    const values = [...rawVmReason.matchAll(/\b\d[\d,]*\b/g)]
      .map((match) => Number(match[0].replace(/,/g, ''))).filter(Number.isFinite);
    return new MessageBusDiagnosticError(
      'L3_VM_RESOURCE_LIMIT',
      `BCH-2026 preflight failed at input ${inputIndex}${location}: ${rawVmReason}${requireSite}`,
      {
        inputIndex,
        resourceIdentity: `input:${inputIndex}`,
        rawVmReason,
        ...(values.length >= 2 && { measured: values[0], limit: values[1] }),
        handler: input?.unlocker?.abiFunction?.name,
      },
    );
  }
  const unlockerParams = (builder.inputs[inputIndex] as {
    unlocker?: {
      params?: unknown[];
      abiFunction?: { name?: string; inputs?: Array<{ name: string }> };
      contract?: { artifact?: { contractName?: string } };
    };
  })?.unlocker;
  if (unlockerParams?.abiFunction?.inputs && unlockerParams.params) {
    const idxParams = unlockerParams.abiFunction.inputs.flatMap((input, i) => (
      /returnOutputIdx/i.test(input.name)
        ? [{ name: input.name, value: String(unlockerParams.params?.[i]) }] : []
    ));
    if (idxParams.length > 0) console.error('preflight-return-idx', { inputIndex, idxParams, rawVmReason });
  }
  // layout invariant attribution attribution: name the owning contract/function and layout coordinate witnesses so
  // "input 225 OP_VERIFY" carries participant/resource/expected-output context without a full operand dump.
  const layoutWitnesses = (unlockerParams?.abiFunction?.inputs && unlockerParams.params)
    ? unlockerParams.abiFunction.inputs.flatMap((entry, i) => {
      if (!/valueChunkOutputBase|dynamicChunkInputBase|vmapBatchPredOut_/i.test(entry.name)) return [];
      return [`${entry.name.replace(/^__internal__/, '')}=${String(unlockerParams.params?.[i])}`];
    })
    : [];
  const owner = [
    unlockerParams?.contract?.artifact?.contractName,
    unlockerParams?.abiFunction?.name,
  ].filter((part): part is string => typeof part === 'string' && part.length > 0).join('.');
  const attribution = detailedFailure ? [
    owner.length > 0 ? `participant ${owner}` : undefined,
    layoutWitnesses.length > 0 ? `layout ${layoutWitnesses.join(',')}` : undefined,
  ].filter((part): part is string => part !== undefined).join('; ') : '';
  const mapped = new Error(
    `messageBus: BCH-2026 preflight failed at input ${inputIndex}${location}`
    + `${attribution.length > 0 ? ` (${attribution})` : ''}: ${rawVmReason}${requireSite}`,
  );
  if (exactRequire !== undefined) {
    Object.assign(mapped, { requireStatement: exactRequire.requireStatement, inputIndex });
  }
  return mapped;
}

/** Refuse any covenant failure in an exact, fully assembled transaction. */
export const assertFinalizedTransactionCovenants = (
  builder: TransactionBuilder, transaction: Transaction,
): void => {
  logComposedTransactionLayout(builder, transaction, 'converged');
  return evaluateEveryInput(
    builder, transaction,
  );
};

/**
 * Print the composed transaction's physical layout under `SOLIDC_DEBUG_LAYOUT=1`: every input and output with its
 * participant block slot kind, its owning contract/function, its token identity, and the COORDINATE witnesses its
 * unlocker supplies.
 *
 * The derivation system knows the exact layout it built, but that knowledge is spread across the block layouts, the
 * per-input unlockers and the assembled slots - so answering "what is at input N, and what does its covenant think
 * is there" otherwise costs a retrace per question. Slot kinds come from the compiler-published
 * `blockLayout` of each participant master, so the labels are the compiler's own vocabulary (master, dataNft,
 * entry, event, returnEvent, trailing, ...), not a re-derivation.
 */
export const logComposedTransactionLayout = (
  builder: TransactionBuilder, transaction: Transaction, origin = 'finalized',
): void => {
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_LAYOUT !== '1') return;
  // The dump must never preempt the gate it describes: a rejected assembly is exactly the case where the layout is
  // worth reading, so fall back to the per-input unlocker metadata instead of propagating the refusal.
  let assembly: BalancedAssembly | undefined;
  try {
    assembly = preflightMessageBusBlockAssembly(builder);
  } catch {
    assembly = undefined;
  }
  const blockAt = (index: number): string => {
    for (const block of assembly?.blocks ?? []) {
      const local = index - block.base;
      if (local < 0 || local >= block.blockLayout.blockSize) continue;
      const slot = block.blockLayout.slots.find((candidate) => candidate.offset === local);
      return `p${block.participant}+${local}:${slot === undefined ? '?' : slot.kind}${
        slot?.slotIndex === undefined ? '' : `#${slot.slotIndex}`}`;
    }
    if (assembly?.verifierInputs.includes(index) === true) return 'verifier';
    if (assembly?.feeInput === index) return 'fee';
    if (assembly?.changeOutput === index) return 'change';
    return 'outside';
  };
  const unlockerOf = (index: number): {
    contract?: string; fn?: string; params?: readonly unknown[];
    names?: readonly string[]; blockSize?: number;
  } => {
    const unlocker = (builder.inputs[index] as unknown as {
      unlocker?: {
        contract?: { artifact?: { contractName?: string } };
        abiFunction?: { name?: string; inputs?: readonly { name: string }[]; blockLayout?: { blockSize: number } };
        params?: readonly unknown[];
      };
    })?.unlocker;
    return {
      contract: unlocker?.contract?.artifact?.contractName,
      fn: unlocker?.abiFunction?.name,
      params: unlocker?.params,
      names: unlocker?.abiFunction?.inputs?.map((input) => input.name),
      blockSize: unlocker?.abiFunction?.blockLayout?.blockSize,
    };
  };
  const asHex = (value: Uint8Array | string | undefined): string => {
    if (value === undefined) return '-';
    const hex = typeof value === 'string' ? value : binToHex(value);
    return hex.length === 0 ? '-' : hex;
  };
  const tokenOf = (token: {
    category?: Uint8Array | string; amount?: bigint;
    nft?: { capability?: string; commitment?: Uint8Array | string };
  } | undefined): string => {
    if (token === undefined) return '-';
    const category = asHex(token.category).slice(0, 8);
    const capability = token.nft?.capability ?? 'ft';
    const commitment = token.nft === undefined ? '' : `:${(asHex(token.nft.commitment).length / 2)}b`;
    return `${category}/${capability}${commitment}`;
  };
  console.error('transaction-layout-participants', JSON.stringify({
    origin,
    builderInputs: builder.inputs.length,
    transactionInputs: transaction.inputs.length,
    transactionOutputs: transaction.outputs.length,
    blocks: (assembly?.blocks ?? []).map((block) => ({
      participant: block.participant,
      base: block.base,
      blockSize: block.blockLayout.blockSize,
      slots: block.blockLayout.slots.map((slot) => `${slot.offset}:${slot.kind}${
        slot.slotIndex === undefined ? '' : `#${slot.slotIndex}`}`).join(' '),
    })),
  }));
  // The VM sees `generateLibauthSourceOutputs(builder.inputs)`, so print THAT locking bytecode - a UTXO whose
  // generated lock differs from the one its own unlocker produces is a stale/placeholder input, and comparing the
  // two is what turns that into a one-line observation instead of a trace.
  const vmSourceOutputs = generateLibauthSourceOutputs(
    builder.inputs as unknown as Parameters<typeof generateLibauthSourceOutputs>[0],
  );
  console.error('transaction-layout-inputs', JSON.stringify(builder.inputs.map((input, index) => {
    const owner = unlockerOf(index);
    const builderInput = input as unknown as {
      satoshis: bigint;
      token?: { category?: Uint8Array; amount?: bigint; nft?: { capability?: string; commitment?: Uint8Array } };
      unlocker?: { generateLockingBytecode?: () => Uint8Array };
    };
    const coordinates = (owner.names ?? []).flatMap((name, position) => {
      const value = owner.params?.[position];
      if (!name.startsWith('__internal__')) return [];
      if (typeof value === 'bigint') return [`${name.replace('__internal__', '')}=${value}`];
      // Keep the size (a wrong-length witness is a distinct failure) and add the leading bytes: slot/next-key
      // witnesses are the only way to compare the key a frame ADDRESSES with the key the co-spent entry carries.
      if (value instanceof Uint8Array) {
        return value.length === 0 ? []
          : [`${name.replace('__internal__', '')}=b${value.length}:${asHex(value).slice(0, 24)}`];
      }
      return [`${name.replace('__internal__', '')}=${String(value)}`];
    });
    return [
      `${index} ${blockAt(index)} ${owner.contract ?? '-'}.${owner.fn ?? '-'}`,
      `lock=${asHex(vmSourceOutputs[index]?.lockingBytecode).slice(0, 12)}`,
      `unlockerLock=${asHex(builderInput.unlocker?.generateLockingBytecode?.()).slice(0, 12)}`,
      `outpoint=${String((input as unknown as { txid?: string }).txid ?? '?').slice(0, 8)}:${
        String((input as unknown as { vout?: number }).vout ?? '?')}`,
      `sat=${builderInput.satoshis}`,
      `token=${tokenOf(builderInput.token)}`,
      `commit=${asHex(builderInput.token?.nft?.commitment)}`,
      `block=${owner.blockSize ?? '-'}`,
      coordinates.length === 0 ? 'witnesses=-' : `witnesses=${coordinates.join(',')}`,
    ].join(' | ');
  })));
  console.error('transaction-layout-outputs', JSON.stringify(transaction.outputs.map((output, index) => [
    `${index} ${blockAt(index)}`,
    `lock=${asHex(output.lockingBytecode).slice(0, 12)}`,
    `sat=${String(output.valueSatoshis)}`,
    `token=${tokenOf(output.token)}`,
    `commit=${asHex(output.token?.nft?.commitment).slice(0, 20)}`,
  ].join(' | '))));
};

/**
 * Evaluate every input of a fully assembled message bus transaction on the BCH-2026 VM, then decide its finalized
 * bytes against the byte rules.
 *
 * message bus derivation is an untrusted witness-construction step. Neither check is a substitute for covenant
 * checks: the first establishes that the exact final transaction satisfies every covenant, the second that its
 * bytes are ones a peer would forward. `options` reaches only the byte rules.
 */
/**
 * Published value-chunk bandOffset from block geometry.
 * - filled at trailing base ⇒ bandOffset 0
 * - filled equals a published `trailing` slot absolute ⇒ bandOffset = slot.offset - trailingBase
 * Never invents an offset from a filled absolute that does not match published slots.
 */
export function publishedValueChunkBandOffsetFromGeometry(params: {
  publishedBase: number;
  trailingBase: number;
  filledValueChunk: number;
  slots: ReadonlyArray<{ kind: string; offset: number }>;
}): number | undefined {
  const trailingAbsolute = params.publishedBase + params.trailingBase;
  if (params.filledValueChunk === trailingAbsolute) return 0;
  const match = params.slots.find((slot) => (
    slot.kind === 'trailing'
    && params.publishedBase + slot.offset === params.filledValueChunk
  ));
  if (match === undefined) return undefined;
  const bandOffset = match.offset - params.trailingBase;
  return bandOffset >= 0 ? bandOffset : undefined;
}

export type AssemblyLayoutResolveOptions = {
  /**
   * Independently published PredOut physical locals (compose / compiler claims).
   * Without these, PredOut remains compose-path-only (cannot non-tautologically derive from unlocker fill).
   */
  predOutClaimsByParticipant?: ReadonlyMap<number, ReadonlyArray<{
    witnessName: string;
    physicalLocalOffset: number;
    concreteLocalSlot?: number;
  }>>;
};

/**
 * Layout-resolver sole coordinate authority: unlocker valueChunk/dyn/(optional PredOut) absolutes must equal
 * one `resolveParticipantAbsoluteWitnesses`. BandOffset comes from published trailing geometry
 * (including non-zero offsets via `trailing` slots), never from inventing against filled-only values.
 */
export function assertAssemblyLayoutWitnessesMatchResolve(
  builder: TransactionBuilder,
  assembly: BalancedAssembly,
  options?: AssemblyLayoutResolveOptions,
): void {
  for (const block of assembly.blocks) {
    const trailingBase = block.blockLayout.trailingBase;
    if (trailingBase === undefined) continue;
    const input = builder.inputs[block.base] as {
      unlocker?: {
        params?: unknown[];
        abiFunction?: { inputs?: Array<{ name: string }> };
      };
    } | undefined;
    const unlocker = input?.unlocker;
    if (!unlocker?.abiFunction?.inputs || !unlocker.params) continue;

    const valueChunkIndex = unlocker.abiFunction.inputs.findIndex((entry) => (
      entry.name === '__internal__valueChunkOutputBase'
    ));
    const dynIndex = unlocker.abiFunction.inputs.findIndex((entry) => (
      entry.name === '__internal__dynamicChunkInputBase'
    ));
    const filledValueChunk = valueChunkIndex >= 0
      ? Number(unlocker.params[valueChunkIndex] as bigint)
      : -1;
    const filledDyn = dynIndex >= 0 ? Number(unlocker.params[dynIndex] as bigint) : -1;
    const trailingAbsolute = block.base + trailingBase;
    const publishedBandOffset = filledValueChunk >= 0
      ? publishedValueChunkBandOffsetFromGeometry({
        publishedBase: block.base,
        trailingBase,
        filledValueChunk,
        slots: block.blockLayout.slots,
      })
      : undefined;
    const assertValueChunk = publishedBandOffset !== undefined;
    const assertDyn = filledDyn === trailingAbsolute;
    const predOutClaims = options?.predOutClaimsByParticipant?.get(block.participant);
    if (!assertValueChunk && !assertDyn && (predOutClaims === undefined || predOutClaims.length === 0)) {
      continue;
    }

    try {
      assertUnlockerLayoutMatchesResolve({
        inputs: unlocker.abiFunction.inputs,
        params: unlocker.params,
        publishedBase: block.base,
        blockSize: Math.max(block.blockLayout.blockSize, trailingBase + 1),
        trailingBase,
        trailingCapacity: block.blockLayout.trailingCapacity,
        dynChunkCount: assertDyn ? 0 : undefined,
        valueChunkBandOffset: assertValueChunk ? publishedBandOffset : undefined,
        // An all-inline entry update can publish the dormant trailing coordinate with zero capacity.
        // Check that coordinate without inventing an occupied chunk in a compiler-published empty band.
        valueChunkCount: assertValueChunk ? (block.blockLayout.trailingCapacity === 0 ? 0 : 1) : undefined,
        predOuts: predOutClaims,
        participant: block.participant,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `messageBus: layout resolve mismatch at participant ${block.participant} base ${block.base}: ${message}`,
      );
    }
  }
}

export const preflightMessageBusTransaction = (
  builder: TransactionBuilder, options?: FinalizedByteGateOptions,
): Transaction => {
  assertNoDerivationProbeOutpoints(builder);
  // Structural gate first: a malformed or unbalanced block assembly is rejected before any signature is taken.
  const assembly = requireMessageBusBlockAssembly(builder);
  // PredOut preflight claims: thread compose PredOut claims into the layout assert (default path no longer compose-only).
  assertAssemblyLayoutWitnessesMatchResolve(builder, assembly, {
    predOutClaimsByParticipant: options?.predOutClaimsByParticipant,
  });
  const transaction = builder.buildLibauthTransaction();
  logComposedTransactionLayout(builder, transaction, 'finalized');
  assertCanonicalMessageEnvelopePush(builder, transaction, assembly);
  assertDirectParticipantFrames(builder, transaction, assembly);
  evaluateEveryInput(builder, transaction);
  // Byte rules LAST, so a transaction that cannot execute reports its semantic cause rather than whichever
  // relay observation happens to be true of it as well. A transaction refused by the VM is broken regardless
  // of whether it would have relayed, and masking that diagnostic with a size or dust message would lose the
  // more informative half. Every existing per-input diagnostic therefore survives unchanged.
  assertFinalizedTransactionBytes(transaction, options);
  if (options !== undefined) finalizedByteGateReceipts.set(builder, {
    ...(options.consensusLimits === undefined ? {} : {
      consensusLimits: { ...options.consensusLimits },
    }),
    ...(options.allowNonRelayable === undefined ? {} : {
      allowNonRelayable: options.allowNonRelayable,
    }),
  });
  return transaction;
};

/**
 * Build and fee-check once, evaluate that exact byte sequence, then broadcast it unchanged.
 *
 * message bus assembly must explicitly include every sidecar and funding input before this call;
 * unlike the general TransactionBuilder send path, this function never mutates the shape
 * between preflight and broadcast.
 *
 * SCOPE. EVERY LIVE BROADCAST SITE IN `src/` NOW CARRIES THE BYTE GATE. There were eight; the eighth,
 * `StatefulContract._sendBuilderWithCustomUnlockers`, had no caller anywhere and is deleted rather than gated
 * (see the note at its former position). The seven live ones are this function,
 * `StatefulTransactionBuilder`'s submit phase, `TransactionBuilder.send`, and the four `StatefulContract`
 * lifecycle-admin sites - destroy, split, merge and `_sendRawBuilder`.
 *
 * THE BLAST RADIUS IS MEASURED, NOT ASSUMED (X126). Every broadcast of the whole SDK e2e population was first
 * assessed against these rules without enforcing them - 5,370 sends across 422 green files - and the per-site
 * table is in `test/journal-message-bus/e2e/message-bus-gatesite-probe.ts`. Six of the seven ungated sites would newly
 * refuse NOTHING;
 * the submit phase would newly refuse two tests in one fixture, both because that fixture paid 100/200/300
 * satoshis to a one-byte script and tripped `output-dust` at the same 474-satoshi threshold BCHN used to
 * refuse C1. The gate was node-correct and the fixture was building a transaction the network rejects, so the
 * fixture was corrected (amounts are incidental to what it asserts) and the gate landed there.
 *
 * WHY THE FOUR ADMIN SITES LANDED ANYWAY, ON 0% (X163). The population reaches them 14 times across 11 tests,
 * and 0% over 13 net-ok sends is not evidence - at that sample size the one real defect the submit-path
 * measurement found would have been invisible. The population coverage was not the evidence; CONSTRUCTED
 * coverage was. All four compute a payout arithmetically with no floor - destroy's `totalInputSats - fee`,
 * split's `totalFunding - newMintingAmount * splitCount - fee`, merge's `consumedSatoshis + totalFunding - fee`
 * - and all four then write it over a placeholder BY INDEX on `builder.outputs`, the one path into an output
 * that `addOutput`'s policy check never sees. Each was driven to a 100-satoshi output against a 576-satoshi
 * threshold, and `MockNetworkProvider` accepted every one, because its default policy is `enforceDust: false`.
 * That is the C1 blind spot exactly, on four paths the population happened never to steer into.
 * `test/e2e/L4StatefulAdminSiteGate.test.ts` is the constructed set.
 */
export async function sendPreflightedMessageBusTransaction(
  builder: TransactionBuilder, options?: FinalizedByteGateOptions,
): Promise<string> {
  // Structural gate first: this runs before build() takes a single signature.
  assertNoDerivationProbeOutpoints(builder);
  const assembly = requireMessageBusBlockAssembly(builder);
  const raw = builder.build();
  const transaction = decodeTransactionUnsafe(hexToBin(raw));
  assertCanonicalMessageEnvelopePush(builder, transaction, assembly);
  evaluateEveryInput(builder, transaction);
  // The byte gate reads the DECODED broadcast bytes, not a re-derived shape, so it judges exactly what
  // `sendRawTransaction` is about to receive. This is the last thing between the composer and the network.
  assertFinalizedTransactionBytes(transaction, options);
  const txid = await builder.provider.sendRawTransaction(raw);
  const expected = binToHex(hash256(hexToBin(raw)).reverse());
  if (txid !== expected) {
    throw new Error(`messageBus: provider returned txid '${txid}', expected '${expected}'`);
  }
  return txid;
}
