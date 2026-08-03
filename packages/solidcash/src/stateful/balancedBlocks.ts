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

/** Standard value for participant-local sidecar continuation outputs. */
export const BALANCED_SLOT_SATOSHIS = 1000n;

/**
 * Upper bound on an event / return-event slot output's value (X21).
 *
 * The covenant does NOT pin an event slot to a single value; it bounds it. Both the event path and the
 * return-event path emit `OP_OUTPUTVALUE <1200> OP_LESSTHANOREQUAL OP_VERIFY`, an anti-siphon ceiling that
 * stops satoshis being parked in an anyone-can-spend log output. 1,200 is also the smallest round value that
 * clears the relay dust threshold for the largest event a covenant admits (a 128-byte commitment needs 1,068),
 * which is why the SDK emits event NFTs at 1,200 while return events settle at 800 or 1,000 depending on the
 * route. This model previously required all three to be exactly `BALANCED_SLOT_SATOSHIS`, which rejected every
 * one of those legitimate values and matched none of them.
 */
export const BALANCED_EVENT_SLOT_CEILING = 1200n;

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
  /** Physical verifier region, one artifact-specialized covenant per participant. */
  verifierInputs: readonly number[];
  /** Final verifier input; it carries the canonical callManifest consumed by participant binders. */
  verifierInput: number;
  /** Physical index of the fee-funding input; follows the verifier covenant. */
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
  /** Upper bound on an event / return-event slot output's value; the emitting covenant enforces it. */
  eventSlotCeiling?: bigint;
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

/** Minimal view of one builder input for deriving an assembly without a caller-declared layout. */
export interface BalancedAssemblyInputView {
  unlocker?: { abiFunction?: { blockLayout?: FunctionBlockLayout } };
}

/** The block layout an input publishes as a participant master, or `undefined` when it publishes none. */
const publishedMasterBlock = (
  input: BalancedAssemblyInputView | undefined,
): FunctionBlockLayout | undefined => {
  const layout = input?.unlocker?.abiFunction?.blockLayout;
  if (!layout || !layout.slots.some((slot) => slot.kind === 'master' && slot.offset === 0)) return undefined;
  return layout;
};

/**
 * Derive the physical index space from the transaction itself.
 *
 * Every participant block starts at its master input, and that input's contract unlocker carries the ABI
 * function whose `blockLayout` the compiler published. So the block set can be read off an unsigned builder with
 * no cooperation from the caller - which is what makes the preflight a GATE rather than a capability the caller
 * may decline to use.
 *
 * Returns `undefined` only when NO input publishes a participant master, which is an ordinary or stateless
 * transaction the block model was never meant to judge. Once any input does publish one the transaction is in
 * scope, and a shape the model cannot describe is REFUSED rather than skipped: the field it reads is owned by
 * the caller, so an unlocker that produces byte-identical unlocking bytecode without re-exposing `abiFunction`
 * used to erase the whole gate by making it report "nothing to check".
 *
 * The canonical layout is participant prefix || one verifier per participant || fee/change. Any other gap is
 * structurally refused here.
 */
export function deriveBalancedAssemblyFromInputs(
  inputs: readonly BalancedAssemblyInputView[], totalSlots: number,
): BalancedAssembly | undefined {
  if (!Number.isInteger(totalSlots) || totalSlots < 1) return undefined;
  const published: number[] = [];
  for (let index = 0; index < totalSlots; index += 1) {
    if (publishedMasterBlock(inputs[index])) published.push(index);
  }
  if (published.length === 0) return undefined;
  const blocks: BalancedBlockPlacement[] = [];
  let cursor = 0;
  while (cursor < totalSlots) {
    const layout = publishedMasterBlock(inputs[cursor]);
    if (!layout) break;
    blocks.push({ participant: blocks.length, base: cursor, blockLayout: layout });
    cursor += layout.blockSize;
  }
  if (blocks.length === 0) {
    fail(
      `input ${published[0]} publishes a participant master block but no block starts at index 0; `
      + 'the participant region must be concatenated from index 0',
    );
  }
  const bases = new Set(blocks.map((block) => block.base));
  const swallowed = published.find((index) => index < cursor && !bases.has(index));
  if (swallowed !== undefined) {
    fail(`input ${swallowed} publishes a participant master block inside another block's span`);
  }
  if (cursor > totalSlots) {
    fail(`participant ${blocks.length - 1} block runs past the transaction's ${totalSlots} slots`);
  }
  if (cursor !== totalSlots - blocks.length - 1) {
    fail(
      `participant region ends at ${cursor}, but ${blocks.length} verifier slots plus fee require tail start `
      + `${totalSlots - blocks.length - 1}; `
      + 'atomic compositions permit no auxiliary or padding slots',
    );
  }
  const verifierInputs = blocks.map((_block, participant) => cursor + participant);
  return {
    blocks,
    verifierInputs,
    verifierInput: verifierInputs[verifierInputs.length - 1],
    feeInput: cursor + blocks.length,
    changeOutput: cursor + blocks.length,
    totalSlots,
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
 * event or return-event output whose value exceeds the covenant's anti-siphon ceiling; a token output outside
 * every participant block (an
 * event NFT that escaped its emitter's block); and fee/change slots inside a relocatable participant block.
 */
export function preflightBalancedBlockAssembly(
  transaction: BalancedAssemblyView,
  assembly: BalancedAssembly,
  options: BalancedAssemblyOptions = {},
): void {
  const eventSlotCeiling = options.eventSlotCeiling ?? BALANCED_EVENT_SLOT_CEILING;
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

  const expectedVerifiers = assembly.blocks.map((_block, participant) => regionEnd + participant);
  if (assembly.verifierInputs.length !== expectedVerifiers.length
    || assembly.verifierInputs.some((input, participant) => input !== expectedVerifiers[participant])
    || assembly.verifierInput !== expectedVerifiers[expectedVerifiers.length - 1]
    || assembly.feeInput !== regionEnd + assembly.blocks.length
    || assembly.changeOutput !== regionEnd + assembly.blocks.length
    || regionEnd !== assembly.totalSlots - assembly.blocks.length - 1) {
    fail(
      `verifier/fee/change slots ${assembly.verifierInputs.join(',')}/${assembly.feeInput}/${assembly.changeOutput} must `
      + `follow participant region [0, ${regionEnd}) and end at the terminal slot`,
    );
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
      // X21: an event slot is BOUNDED, not pinned. The emitting covenant checks `value <= 1200`, so the model
      // checks the same ceiling instead of an equality no route emits.
      if (!ignoreValueAt.has(index) && (output.amount <= 0n || output.amount > eventSlotCeiling)) {
        fail(
          `participant ${block.participant} '${slot.kind}' output ${index} is ${output.amount} satoshis, `
          + `the emitting covenant bounds an event slot at ${eventSlotCeiling}`,
        );
      }
    }
  }

  // Only the canonical verifier NFT may sit outside the participant region.
  for (let index = regionEnd; index < transaction.outputs.length; index += 1) {
    if (!assembly.verifierInputs.includes(index) && transaction.outputs[index].token !== undefined) {
      fail(`output ${index} carries a token outside every participant block (region ends at ${regionEnd})`);
    }
  }
}
