import { describe, expect, it } from 'vitest';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import {
  assignPhysicalReturnIndices,
  writerReturnSlotReservations,
} from '../../src/stateful/physical-return-layout.js';
import { bindWriterReturnWitness, type InBlockWriterReturnHost } from '../../src/stateful/stb-inblock-writer-returns.js';
import type { PhysicalReturnGroup } from '../../src/stateful/value-chunk-geometry.js';

const CATEGORY = 'ab'.repeat(31) + '54';

const TOKEN_ABI = [
  { name: 'balanceOf', writesState: false, outputs: [{ type: 'uint256' }] },
  { name: 'approve', writesState: true, outputs: [{ type: 'bool' }] },
];

function makeGroup(overrides: Record<string, unknown> = {}): PhysicalReturnGroup {
  return {
    categoryId: CATEGORY,
    functionName: 'view',
    ...overrides,
  } as unknown as PhysicalReturnGroup;
}

describe('framedsite return channel for a callsite aliased onto a shared participant', () => {
  it('seats two distinct logical tail families on distinct return outputs', () => {
    // A shared participant's owner view and an aliased view of another method both plan output 28. A band right
    // after it sends the packer back to the plans; the covenant reads each callsite at its own
    // `__internal__externalReturnOutputIdx*`, so the two families must not share one output.
    const groups = [
      makeGroup({ functionName: 'ownerView', returnOutputIndex: 28 }),
      makeGroup({ functionName: 'aliasView', sharedGroupIndex: 0, returnOutputIndex: 28 }),
    ];
    const assigned = assignPhysicalReturnIndices(groups, () => 0, 28, { band: { start: 29, end: 34 } });
    expect(assigned.get(0)).toBe(28);
    expect(assigned.get(1)).not.toBe(assigned.get(0));
    expect(new Set(assigned.values()).size).toBe(assigned.size);
  });

  it('reserves the in-block writer alias\'s built slot, not its stale pre-placement plan', () => {
    // The writer alias planned output 27 but publishes at the participant's in-block return slot (18). Reserving
    // the stale plan evicts a real view tail; the built coordinate is the one a view tail must avoid.
    const alias = makeGroup({
      functionName: 'approve',
      sharedGroupIndex: 0,
      returnOutputIndex: 18,
      plannedReturnOutputIndex: 27,
      externalContract: { inner: { artifact: { abi: TOKEN_ABI } } },
    });
    const owner = makeGroup({
      functionName: 'balanceOf',
      returnEventInBlock: true,
      returnOutputIndex: 30,
      blockLayout: { blockSize: 8, slots: [{ kind: 'returnEvent', offset: 7 }] },
      externalContract: { inner: { artifact: { abi: TOKEN_ABI } } },
    });
    const slots = writerReturnSlotReservations([owner, alias]);
    expect(slots.has(18)).toBe(true);
    expect(slots.has(27)).toBe(false);
  });

  it('binds a writer alias without moving its view owner\'s own tail', () => {
    // The physical owner is a view whose result is a tail (output 30); the writer alias publishes at the in-block
    // slot (18). Binding the writer may not move the owner's coordinate or the caller witness that names it.
    const owner = makeGroup({
      functionName: 'balanceOf',
      returnEventInBlock: true,
      returnOutputIndex: 30,
      blockLayout: { blockSize: 4, slots: [{ kind: 'master', offset: 0 }, { kind: 'returnEvent', offset: 3 }] },
      externalContract: { inner: { artifact: { abi: TOKEN_ABI } } },
    });
    const writer = makeGroup({
      functionName: 'approve',
      sharedGroupIndex: 0,
      returnOutputIndex: 27,
      externalContract: { inner: { artifact: { abi: TOKEN_ABI } } },
    });
    const witnessUpdates: Array<Record<string, bigint>> = [];
    const carrier = makeGroup({
      functionName: 'route',
      returnWitnessGroups: { ownerReturn: 0, writerReturn: 1 },
      internalArgs: { ownerReturn: 30n, writerReturn: 27n },
      refreshInternalArgs: (updates: Record<string, bigint>) => { witnessUpdates.push(updates); },
    });
    const host = {
      allInputs: [],
      externalCallUtxoGroups: [owner, writer, carrier],
      lowLevelCallUtxoGroups: [],
      syncBuilderUnlockers: () => {},
    } as unknown as InBlockWriterReturnHost;

    bindWriterReturnWitness(host, 1, 18, {} as TransactionBuilder);
    expect(writer.returnOutputIndex).toBe(18);
    expect(owner.returnOutputIndex).toBe(30);
    expect(witnessUpdates).toEqual([{ writerReturn: 18n }]);
  });
});
