/**
 * Leaving out of a segment the records a frame's code does not touch there.
 *
 * A master declares its data records in every segment, each kept at the view it holds there unless the segment
 * writes it. The validator chains a record's declarations across every frame in walk order, so a record a segment
 * does not name keeps its view across that segment, and a declaration that only restates a kept view carries nothing
 * a chain needs. The frame's own code reads a record from its own segment's declaration and closes the ones it
 * writes against theirs, so a segment has to declare the records its code reads or writes there, which the entry
 * publishes (`readSegments`, `writeSegments`). The block oracle is read from the transaction, not from a
 * declaration, and a mapping's nodes only by a segment whose code reaches the mapping. The first segment, which sets
 * the frame's record base, and the last, which the body's epilogue closes, keep every declaration, and so does a
 * segment whose code reaches a mapping or a dynamic value, whose records the frame addresses by position in the
 * segment.
 *
 * The transaction carries the shorter block; the draft keeps the full one, which is what its learned views name.
 */

import { FrameKind, INDEX_NONE, bytesEqual, type Artifact, type WitnessBlock } from '@solidcash/utils';

/** Which of a master's declarations a segment may leave out. */
export interface SparseDeclarations {
  /** The layout offset of each data record the frame declares, by NFT index, as its block layout names them. */
  readonly offsets: ReadonlyMap<number, number>;
  /** The layout offsets of the block oracle and of the mapping nodes the block layout names, none of which a segment
   * whose code reaches no mapping reads. */
  readonly untouchedOffsets: readonly number[];
  /** The data records the code reads or writes in each segment, by segment index. */
  readonly touched: ReadonlyMap<number, ReadonlySet<number>>;
  /** The segments whose code reaches a mapping or a dynamic value, by segment index. */
  readonly complete: ReadonlySet<number>;
}

/**
 * The declarations a master of `functionName` may leave out, read from the artifact that publishes the entry, or
 * undefined when the entry does not say what its segments touch or the frame declares another contract's records.
 */
export function sparseDeclarationsOf(
  artifacts: readonly Pick<Artifact, 'composition'>[],
  functionName: string,
  kind: number,
): SparseDeclarations | undefined {
  // A delegate frame declares the records of its caller's layout, which its own artifact does not describe.
  if (kind === FrameKind.DELEGATE) return undefined;
  const publishing = artifacts.flatMap((artifact) => (artifact.composition?.stopSites?.entries ?? [])
    .filter((entry) => entry.functionName === functionName)
    .map((entry) => ({ artifact: artifact as Partial<Artifact>, entry })));
  if (publishing.length !== 1) return undefined;
  const { artifact, entry } = publishing[0]!;
  if (entry.readSegments === undefined || entry.writeSegments === undefined) return undefined;
  const abi = (artifact.abi ?? []).find((fn) => `${artifact.contractName}.${fn.name}()` === functionName);
  const slots = abi?.blockLayout?.slots;
  if (slots === undefined) return undefined;
  const offsets = new Map<number, number>();
  const untouchedOffsets: number[] = [];
  for (const slot of slots) {
    if (slot.kind === 'dataNft' && slot.nftIndex !== undefined) offsets.set(slot.nftIndex, slot.offset);
    if (slot.kind === 'blockInfoOracle' || slot.kind === 'entry') untouchedOffsets.push(slot.offset);
  }
  const touched = new Map<number, Set<number>>();
  const complete = new Set<number>();
  const touch = (segment: number, record: number): void => {
    const records = touched.get(segment) ?? new Set<number>();
    records.add(record);
    touched.set(segment, records);
  };
  for (const read of entry.readSegments) {
    if (read.record !== undefined) touch(read.segment, read.record);
    else complete.add(read.segment);
  }
  for (const write of entry.writeSegments) {
    // A write that lands in the last segment touches only the segment that keeps every declaration anyway.
    if (write.segment === 'last') continue;
    if (write.record !== undefined && write.turns === undefined) touch(write.segment, write.record);
    else complete.add(write.segment);
  }
  return { offsets, untouchedOffsets, touched, complete };
}

/** The block with each segment's untouched kept data records, block oracle and nodes left out (`SparseDeclarations`). */
export function sparseBlock(block: WitnessBlock, sparse: SparseDeclarations | undefined): WitnessBlock {
  if (sparse === undefined || block.segments.length < 3 || sparse.offsets.size === 0) return block;
  // The frame's record base is the record its first segment declares first, which is its lowest-offset data record.
  const base = block.segments[0]?.[0]?.in;
  const firstOffset = Math.min(...sparse.offsets.values());
  if (base === undefined || base === INDEX_NONE) return block;
  const coordinate = (offset: number): number => base + offset - firstOffset;
  const records = new Map([...sparse.offsets].map(([nftIndex, offset]) => [coordinate(offset), nftIndex]));
  const untouched = new Set(sparse.untouchedOffsets.map(coordinate));
  const last = block.segments.length - 1;
  const segments = block.segments.map((segment, index) => {
    if (index === 0 || index === last || sparse.complete.has(index)) return segment;
    const touched = sparse.touched.get(index);
    return segment.filter((entry) => {
      const kept = entry.in !== INDEX_NONE && entry.out === entry.in && bytesEqual(entry.viewIn, entry.viewOut);
      if (!kept) return true;
      if (untouched.has(entry.in)) return false;
      const record = records.get(entry.in);
      return record === undefined || touched?.has(record) === true;
    });
  });
  return { ...block, segments };
}
