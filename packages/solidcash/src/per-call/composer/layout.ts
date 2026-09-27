/**
 * Block layout.
 *
 * A transaction is one block per contract, in order of first entry. A block holds the contract's masters as a
 * ladder, then, when the contract is a group's first root, its validator, then the contract's touched state
 * UTXOs. Every participant recreates at the same index it was spent at, so an input index is also its output
 * index. Funder inputs follow the blocks, and every output that is not a participant — events, value sends,
 * created records, then change — is trailing.
 */

/** A contract's block, in the order its members are placed. */
export interface ContractBlock {
  readonly contract: string;
  /** Masters in entry order, one per entry into the contract. */
  readonly masters: readonly string[];
  /** The validator this block hosts, when the contract roots a group. */
  readonly validator?: { readonly id: string; readonly settles: readonly string[] };
  /** The contract's touched state UTXOs, after its masters and validator. */
  readonly state: readonly string[];
}

/** What a participant is: a master of a contract, a validator, or a state UTXO. */
export type ParticipantKind = 'master' | 'validator' | 'state';

/** One participant's coordinates. A participant recreates at its own index, so input and output index agree. */
export interface PlacedParticipant {
  readonly id: string;
  readonly contract: string;
  readonly kind: ParticipantKind;
  readonly index: number;
}

/** Where every participant of a composition sits, and where the non-participant regions begin. */
export interface TransactionLayout {
  readonly blocks: readonly ContractBlock[];
  readonly participants: readonly PlacedParticipant[];
  /** The input slots the blocks occupy; the trailing output region starts here. */
  readonly participantCount: number;
  /** Index of the first funder input. Roots' signed inputs and the fee payer follow it. */
  readonly funderInputBase: number;
}

/** Counts of the non-participant outputs, in the order the trailing region holds them. */
export interface TrailingOutputCounts {
  /** One output per emitted event, in emission order. */
  readonly events: number;
  /** One output per value send to a user. */
  readonly sends: number;
  /** One output per created record: a new mapping entry, chunk or container. */
  readonly created: number;
}

/** The indices of the trailing outputs, ending with change. */
export interface OutputRegions {
  /** Index of the first trailing output: one past the last participant. */
  readonly trailingBase: number;
  readonly eventIndices: readonly number[];
  readonly sendIndices: readonly number[];
  readonly createdIndices: readonly number[];
  /** The funder's change output, after every created record. */
  readonly changeIndex: number;
}

/** One trailing output the plan states, with the output index the layout gives it. */
export interface PlacedTrailingOutput<T> {
  readonly index: number;
  readonly output: T;
}

/**
 * Places the plan's trailing outputs in the order the plan states them, beginning one past the last participant.
 *
 * A trailing output is not recreated by any input, so its index is an output index only: funder inputs keep their
 * own indices and their recreations follow the trailing region.
 */
export function placeTrailingOutputs<T>(
  layout: TransactionLayout,
  outputs: readonly T[],
): readonly PlacedTrailingOutput<T>[] {
  return outputs.map((output, offset) => ({ index: layout.participantCount + offset, output }));
}

/** Assigns every participant its input and output index, following the block convention. */
export function layoutTransaction(blocks: readonly ContractBlock[]): TransactionLayout {
  const seenContracts = new Set<string>();
  const seenIds = new Set<string>();
  const participants: PlacedParticipant[] = [];

  const place = (id: string, contract: string, kind: ParticipantKind): void => {
    if (seenIds.has(id)) throw new Error(`composer layout: participant "${id}" appears twice`);
    seenIds.add(id);
    participants.push({ id, contract, kind, index: participants.length });
  };

  for (const block of blocks) {
    if (seenContracts.has(block.contract)) {
      throw new Error(`composer layout: contract "${block.contract}" has two blocks`);
    }
    seenContracts.add(block.contract);
    for (const master of block.masters) place(master, block.contract, 'master');
    if (block.validator !== undefined) place(block.validator.id, block.contract, 'validator');
    for (const state of block.state) place(state, block.contract, 'state');
  }

  return {
    blocks,
    participants,
    participantCount: participants.length,
    funderInputBase: participants.length,
  };
}

/** The participant placed under this id, or `undefined` when the layout has none. */
export function findParticipant(layout: TransactionLayout, id: string): PlacedParticipant | undefined {
  return layout.participants.find((placed) => placed.id === id);
}

/** The participant placed under this id, refusing when the layout has none. */
export function participant(layout: TransactionLayout, id: string): PlacedParticipant {
  const placed = findParticipant(layout, id);
  if (placed === undefined) throw new Error(`composer layout: no participant "${id}"`);
  return placed;
}

/** Allocates the trailing outputs: events, then value sends, then created records, then change. */
export function allocateOutputRegions(layout: TransactionLayout, counts: TrailingOutputCounts): OutputRegions {
  let cursor = layout.participantCount;
  const allocate = (count: number): readonly number[] => {
    if (!Number.isInteger(count) || count < 0) throw new Error(`composer layout: negative output count ${count}`);
    const indices = Array.from({ length: count }, () => cursor++);
    return indices;
  };
  const eventIndices = allocate(counts.events);
  const sendIndices = allocate(counts.sends);
  const createdIndices = allocate(counts.created);
  return {
    trailingBase: layout.participantCount,
    eventIndices,
    sendIndices,
    createdIndices,
    changeIndex: cursor,
  };
}
