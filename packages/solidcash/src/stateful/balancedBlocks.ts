import type { BlockSlotKind, FunctionBlockLayout } from '@solidcash/utils';

/**
 * Balanced participant-block assembly checks (plan tasks L1/L2).
 *
 * A composed transaction is a concatenation of participant blocks. Every block owns one contiguous physical
 * span whose INPUT extent equals its OUTPUT extent, so the next block's input base equals its output base and
 * a block can be relocated by changing only the sizes of the blocks in front of it - never its own bytecode.
 * See docs/balanced-block-layout-composability.md.
 *
 * These functions are structural: they read an unsigned builder and the declared layout and throw before any
 * unlocker runs. They are a preflight, not a covenant substitute - the covenants still enforce their own
 * block-relative addressing on chain.
 */

/**
 * Block slot kinds that create an OUTPUT but consume no participant-owned input. The SDK must fill the input
 * side of such a slot with a funding input, otherwise the block's input extent is shorter than its output
 * extent and every later block's two bases diverge.
 */
export const OUTPUT_ONLY_BLOCK_SLOT_KINDS: ReadonlySet<BlockSlotKind> = new Set<BlockSlotKind>([
  'transfer', 'tcTransfer', 'event', 'returnEvent', 'deploy',
]);

/** Block slot kinds whose paired output carries an authenticated NFT commitment inside the block. */
export const EVENT_BLOCK_SLOT_KINDS: ReadonlySet<BlockSlotKind> = new Set<BlockSlotKind>([
  'event', 'returnEvent',
]);

/** Satoshi value the balanced layout specifies for an ordinary/event/return-event slot output. */
export const BALANCED_SLOT_SATOSHIS = 1000n;

/** One participant's placement: its compiler-declared local block at a physical input == output base. */
export interface BalancedBlockPlacement {
  /** Participant index in the composed graph. */
  participant: number;
  /** Physical input base; the output base must be identical. */
  base: number;
  /** Compiler-declared local block extent for the executed route. */
  blockLayout: FunctionBlockLayout;
}

/** The physical index space of a composed balanced transaction. */
export interface BalancedAssembly {
  /** Participant blocks in physical order, concatenated from index 0. */
  blocks: readonly BalancedBlockPlacement[];
  /** 1:1 proof/authority slots following the participant region (projection proofs, controller). */
  auxiliaryInputs: readonly number[];
  /** Physical index of the fee-funding input; must sit outside every participant block. */
  feeInput: number;
  /** Physical index of the terminal change output; must sit outside every participant block. */
  changeOutput: number;
  /** Total input == output count. */
  totalSlots: number;
}

/** Minimal structural view of an unsigned transaction builder. */
export interface BalancedAssemblyView {
  inputs: readonly { satoshis: bigint; token?: { nft?: { commitment?: string } } | undefined }[];
  outputs: readonly { amount: bigint; token?: { nft?: { commitment?: string } } | undefined }[];
}

export interface BalancedAssemblyOptions {
  /** Value every event/return-event and unused ordinary slot output must carry. */
  slotSatoshis?: bigint;
  /** Skip the value check for slots whose output value is protocol-defined elsewhere. */
  ignoreValueAt?: readonly number[];
}

const fail = (message: string): never => {
  throw new Error(`balanced assembly: ${message}`);
};

/** Reject a local block descriptor that is not a complete, master-first, gapless span. */
export function assertCompleteLocalBlock(participant: number, layout: FunctionBlockLayout): void {
  if (!Number.isInteger(layout.blockSize) || layout.blockSize < 1) {
    fail(`participant ${participant} declares block size ${layout.blockSize}`);
  }
  const offsets = new Set<number>();
  for (const slot of layout.slots) {
    if (!Number.isInteger(slot.offset) || slot.offset < 0 || slot.offset >= layout.blockSize) {
      fail(`participant ${participant} slot '${slot.kind}' has out-of-range offset ${slot.offset}`);
    }
    if (offsets.has(slot.offset)) {
      fail(`participant ${participant} has two slots at local offset ${slot.offset}`);
    }
    offsets.add(slot.offset);
  }
  if (offsets.size !== layout.blockSize) {
    fail(`participant ${participant} declares ${layout.blockSize} slots but covers ${offsets.size} offsets`);
  }
  const masters = layout.slots.filter((slot) => slot.kind === 'master');
  if (masters.length !== 1 || masters[0].offset !== 0) {
    fail(`participant ${participant} must declare exactly one master slot at local offset 0`);
  }
}

/**
 * Build the physical index space from a compiled-graph plan and its layout. Both arguments are read
 * structurally, so the caller can pass the layer-3 plan/layout objects directly.
 */
export function balancedAssemblyFromGraphLayout(
  participants: readonly { blockLayout?: FunctionBlockLayout }[],
  layout: {
    participantInputs: readonly number[];
    projectionInputs: readonly number[];
    controllerInput: number;
    feeInput: number;
    totalSlots: number;
  },
): BalancedAssembly {
  if (participants.length !== layout.participantInputs.length) {
    fail(`layout describes ${layout.participantInputs.length} bases for ${participants.length} participants`);
  }
  const blocks = participants.map((participant, index) => {
    if (!participant.blockLayout) fail(`participant ${index} publishes no block layout`);
    return {
      participant: index,
      base: layout.participantInputs[index],
      blockLayout: participant.blockLayout!,
    };
  });
  return {
    blocks,
    auxiliaryInputs: [...layout.projectionInputs, layout.controllerInput],
    feeInput: layout.feeInput,
    changeOutput: layout.totalSlots - 1,
    totalSlots: layout.totalSlots,
  };
}

/** The physical index one past the last participant block. */
export function participantRegionEnd(assembly: BalancedAssembly): number {
  return assembly.blocks.reduce(
    (end, block) => Math.max(end, block.base + block.blockLayout.blockSize), 0,
  );
}

/**
 * Preflight a composed balanced transaction BEFORE any unlocker runs.
 *
 * Rejects: a transaction whose input and output counts disagree with each other or with the layout;
 * participant blocks that are not concatenated from index 0; an incomplete local block descriptor; an
 * output-only slot whose paired funding input is missing (which is what makes the two bases diverge); an
 * event or return-event output that is not the specified dust value; a token output outside every
 * participant block (an event NFT that escaped its emitter's block); and fee/change slots that fall inside
 * a relocatable participant block.
 */
export function preflightBalancedBlockAssembly(
  transaction: BalancedAssemblyView,
  assembly: BalancedAssembly,
  options: BalancedAssemblyOptions = {},
): void {
  const slotSatoshis = options.slotSatoshis ?? BALANCED_SLOT_SATOSHIS;
  const ignoreValueAt = new Set(options.ignoreValueAt ?? []);
  if (!Number.isInteger(assembly.totalSlots) || assembly.totalSlots < 1) {
    fail(`layout declares ${assembly.totalSlots} total slots`);
  }
  if (transaction.inputs.length !== transaction.outputs.length) {
    fail(`unbalanced transaction: ${transaction.inputs.length} inputs, ${transaction.outputs.length} outputs`);
  }
  if (transaction.inputs.length !== assembly.totalSlots) {
    fail(`transaction has ${transaction.inputs.length} slots, layout declares ${assembly.totalSlots}`);
  }

  let cursor = 0;
  for (const block of assembly.blocks) {
    assertCompleteLocalBlock(block.participant, block.blockLayout);
    if (block.base !== cursor) {
      fail(`participant ${block.participant} block base ${block.base} breaks concatenation at ${cursor}`);
    }
    cursor += block.blockLayout.blockSize;
    if (cursor > assembly.totalSlots) {
      fail(`participant ${block.participant} block runs past the transaction's ${assembly.totalSlots} slots`);
    }
  }
  const regionEnd = cursor;

  // Every 1:1 proof/authority slot follows the participant region, in order, before the fee slot.
  let previousAuxiliary = regionEnd - 1;
  for (const auxiliary of assembly.auxiliaryInputs) {
    if (!Number.isInteger(auxiliary) || auxiliary <= previousAuxiliary) {
      fail(`auxiliary slot ${auxiliary} does not follow the participant region in order`);
    }
    if (auxiliary < regionEnd) {
      fail(`auxiliary slot ${auxiliary} falls inside the participant region [0, ${regionEnd})`);
    }
    previousAuxiliary = auxiliary;
  }
  if (assembly.feeInput < regionEnd) {
    fail(`fee input ${assembly.feeInput} falls inside a relocatable participant block`);
  }
  if (assembly.changeOutput < regionEnd) {
    fail(`change output ${assembly.changeOutput} falls inside a relocatable participant block`);
  }
  if (assembly.feeInput >= assembly.totalSlots || assembly.changeOutput >= assembly.totalSlots) {
    fail(`fee/change slots ${assembly.feeInput}/${assembly.changeOutput} exceed the declared slot count`);
  }

  // Output-only slots need their paired funding input, and their outputs carry the specified value/shape.
  for (const block of assembly.blocks) {
    for (const slot of block.blockLayout.slots) {
      const index = block.base + slot.offset;
      if (index >= transaction.inputs.length) {
        fail(`participant ${block.participant} slot '${slot.kind}' has no paired input at ${index}`);
      }
      if (!OUTPUT_ONLY_BLOCK_SLOT_KINDS.has(slot.kind)) continue;
      if (transaction.inputs[index] === undefined) {
        fail(`participant ${block.participant} output-only slot '${slot.kind}' lacks a funding input at ${index}`);
      }
      if (!EVENT_BLOCK_SLOT_KINDS.has(slot.kind) || slot.conditional) continue;
      const output = transaction.outputs[index];
      if (!output.token?.nft) {
        fail(`participant ${block.participant} '${slot.kind}' output ${index} carries no authenticated NFT`);
      }
      if (!ignoreValueAt.has(index) && output.amount !== slotSatoshis) {
        fail(
          `participant ${block.participant} '${slot.kind}' output ${index} is ${output.amount} satoshis, `
          + `the balanced layout specifies ${slotSatoshis}`,
        );
      }
    }
  }

  // Nothing token-bearing may sit outside the participant region: an event NFT must stay in its block.
  for (let index = regionEnd; index < transaction.outputs.length; index += 1) {
    if (transaction.outputs[index].token !== undefined) {
      fail(`output ${index} carries a token outside every participant block (region ends at ${regionEnd})`);
    }
  }
  // Each auxiliary slot pairs with an ordinary dust output; the terminal change output absorbs the remainder.
  for (const auxiliary of assembly.auxiliaryInputs) {
    const output = transaction.outputs[auxiliary];
    if (!ignoreValueAt.has(auxiliary) && output.amount !== slotSatoshis) {
      fail(
        `auxiliary slot ${auxiliary} output is ${output.amount} satoshis, `
        + `the balanced layout specifies ${slotSatoshis}`,
      );
    }
  }
}
