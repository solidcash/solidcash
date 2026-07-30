import {
  binToHex, decodeTransactionUnsafe, hash256, hexToBin,
  type AuthenticationProgramStateCommon, type Transaction,
} from '@bitauth/libauth';
import { generateLibauthSourceOutputs } from '../utils.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import {
  deriveBalancedAssemblyFromInputs, preflightBalancedBlockAssembly,
} from '../stateful/balancedBlocks.js';
import type { BalancedAssembly, BalancedAssemblyOptions } from '../stateful/balancedBlocks.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { assertGraphTrailingCapacity, type GraphTrailingRegion } from './graph.js';

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
 * signed, and only then refused by the VM at the first projection input - a slot that names nothing about the
 * cause. A gate the caller must remember to call is not a gate.
 *
 * Returns the assembly it checked, or undefined when the transaction is out of the block model's scope.
 */
export const preflightLayer3BlockAssembly = (
  builder: TransactionBuilder, options?: BalancedAssemblyOptions,
): BalancedAssembly | undefined => {
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
 * Run the structural gate on a transaction whose caller has already declared it a Layer-3 composition.
 *
 * `preflightLayer3BlockAssembly` stays silent on a transaction no input describes, because it is also a
 * standalone capability that may be pointed at anything. The two Layer-3 send paths below are not: reaching
 * them means the caller asserts this transaction IS a participant composition, so "nothing was checkable" is a
 * refusal rather than a pass. Without this, stripping `abiFunction` from every master input silences the gate
 * completely while the transaction bytes stay identical.
 */
const requireLayer3BlockAssembly = (builder: TransactionBuilder): void => {
  if (preflightLayer3BlockAssembly(builder) !== undefined) return;
  throw new Error(
    'layer3: no participant master block could be derived from this transaction, so the balanced block '
    + 'assembly gate cannot run; every participant master input must expose its contract unlocker',
  );
};

const evaluateEveryInput = (
  builder: TransactionBuilder, transaction: Transaction,
): void => {
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);

  transaction.inputs.forEach((_input, inputIndex) => {
    const state = vm.evaluate({
      inputIndex,
      sourceOutputs,
      transaction,
    }) as AuthenticationProgramStateCommon;
    if (state.error !== undefined) {
      throw new Error(`layer3: BCH-2026 preflight failed at input ${inputIndex}: ${state.error}`);
    }
  });
};

/**
 * Evaluate every input of a fully assembled Layer-3 transaction on the BCH-2026 VM.
 *
 * Layer-3 derivation is an untrusted witness-construction step. This gate is not a
 * substitute for covenant checks; it ensures the exact final transaction satisfies
 * every covenant before it is handed to a provider.
 */
export const preflightLayer3Transaction = (builder: TransactionBuilder): Transaction => {
  // Structural gate first: a malformed or unbalanced block assembly is rejected before any signature is taken.
  requireLayer3BlockAssembly(builder);
  const transaction = builder.buildLibauthTransaction();
  evaluateEveryInput(builder, transaction);
  return transaction;
};

/**
 * Build and fee-check once, evaluate that exact byte sequence, then broadcast it unchanged.
 *
 * Layer-3 assembly must explicitly include every sidecar and funding input before this call;
 * unlike the general TransactionBuilder send path, this function never mutates the shape
 * between preflight and broadcast.
 */
export async function sendPreflightedLayer3Transaction(
  builder: TransactionBuilder,
): Promise<string> {
  // Structural gate first: this runs before build() takes a single signature.
  requireLayer3BlockAssembly(builder);
  const raw = builder.build();
  const transaction = decodeTransactionUnsafe(hexToBin(raw));
  evaluateEveryInput(builder, transaction);
  const txid = await builder.provider.sendRawTransaction(raw);
  const expected = binToHex(hash256(hexToBin(raw)).reverse());
  if (txid !== expected) {
    throw new Error(`layer3: provider returned txid '${txid}', expected '${expected}'`);
  }
  return txid;
}
