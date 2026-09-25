import { describe, expect, it } from 'vitest';
import {
  type ContractBlock,
  allocateOutputRegions,
  layoutTransaction,
  participant,
} from '../../../src/per-call/composer/index.js';

/** The block shapes of spec section 5.4, with the input index each participant gets. */
interface Shape {
  readonly name: string;
  readonly blocks: readonly ContractBlock[];
  readonly indices: Readonly<Record<string, number>>;
  readonly funderInputBase: number;
}

const shapes: readonly Shape[] = [
  {
    name: 'A',
    blocks: [{ contract: 'A', masters: ['A m1'], state: ['DA'] }],
    indices: { 'A m1': 0, DA: 1 },
    funderInputBase: 2,
  },
  {
    name: 'AA for internal calls or this.g(), all inline',
    blocks: [{ contract: 'A', masters: ['A m1'], state: ['DA'] }],
    indices: { 'A m1': 0, DA: 1 },
    funderInputBase: 2,
  },
  {
    name: 'AA through a runtime address equal to address(this)',
    blocks: [{ contract: 'A', masters: ['A m1', 'A m2'], validator: { id: 'V_A', settles: ['A'] }, state: ['DA'] }],
    indices: { 'A m1': 0, 'A m2': 1, V_A: 2, DA: 3 },
    funderInputBase: 4,
  },
  {
    name: 'AB',
    blocks: [
      { contract: 'A', masters: ['A m1'], validator: { id: 'V_A', settles: ['A'] }, state: ['DA'] },
      { contract: 'B', masters: ['B m1'], state: ['DB'] },
    ],
    indices: { 'A m1': 0, V_A: 1, DA: 2, 'B m1': 3, DB: 4 },
    funderInputBase: 5,
  },
  {
    name: 'ABBA',
    blocks: [
      { contract: 'A', masters: ['A m1', 'A m2'], validator: { id: 'V_A', settles: ['A'] }, state: ['DA'] },
      { contract: 'B', masters: ['B m1'], state: ['DB'] },
    ],
    indices: { 'A m1': 0, 'A m2': 1, V_A: 2, DA: 3, 'B m1': 4, DB: 5 },
    funderInputBase: 6,
  },
  {
    name: 'ABCBA',
    blocks: [
      { contract: 'A', masters: ['A m1', 'A m2'], validator: { id: 'V_A', settles: ['A', 'B'] }, state: ['DA'] },
      { contract: 'B', masters: ['B m1', 'B m2'], state: ['DB'] },
      { contract: 'C', masters: ['C m1'], state: ['DC'] },
    ],
    indices: { 'A m1': 0, 'A m2': 1, V_A: 2, DA: 3, 'B m1': 4, 'B m2': 5, DB: 6, 'C m1': 7, DC: 8 },
    funderInputBase: 9,
  },
  {
    name: 'A.x and C.y, independent',
    blocks: [
      { contract: 'A', masters: ['A m1'], state: ['DA'] },
      { contract: 'C', masters: ['C m1'], state: ['DC'] },
    ],
    indices: { 'A m1': 0, DA: 1, 'C m1': 2, DC: 3 },
    funderInputBase: 4,
  },
  {
    name: 'AB and CD, independent',
    blocks: [
      { contract: 'A', masters: ['A m1'], validator: { id: 'V_A', settles: ['A'] }, state: ['DA'] },
      { contract: 'B', masters: ['B m1'], state: ['DB'] },
      { contract: 'C', masters: ['C m1'], validator: { id: 'V_C', settles: ['C'] }, state: ['DC'] },
      { contract: 'D', masters: ['D m1'], state: ['DD'] },
    ],
    indices: { 'A m1': 0, V_A: 1, DA: 2, 'B m1': 3, DB: 4, 'C m1': 5, V_C: 6, DC: 7, 'D m1': 8, DD: 9 },
    funderInputBase: 10,
  },
  {
    name: 'A.x and A.y, same contract twice',
    blocks: [{ contract: 'A', masters: ['A m1', 'A m2'], validator: { id: 'V_A', settles: ['A'] }, state: ['DA'] }],
    indices: { 'A m1': 0, 'A m2': 1, V_A: 2, DA: 3 },
    funderInputBase: 4,
  },
];

describe('block layout', () => {
  for (const shape of shapes) {
    it(`places ${shape.name} in the documented order`, () => {
      const layout = layoutTransaction(shape.blocks);

      for (const [id, index] of Object.entries(shape.indices)) {
        expect(participant(layout, id).index).toBe(index);
      }
      expect(layout.participantCount).toBe(Object.keys(shape.indices).length);
      expect(layout.funderInputBase).toBe(shape.funderInputBase);
    });
  }

  it('recreates each participant at its own index, so its output index equals its input index', () => {
    const layout = layoutTransaction(shapes[4]!.blocks);

    expect(layout.participants.map((placed) => placed.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(layout.participants.map((placed) => placed.kind)).toEqual([
      'master', 'master', 'validator', 'state', 'master', 'state',
    ]);
    expect(layout.participants.map((placed) => placed.contract)).toEqual([
      'A', 'A', 'A', 'A', 'B', 'B',
    ]);
  });

  it('allocates events, then value sends, then created records, then change', () => {
    const layout = layoutTransaction(shapes[4]!.blocks);

    const regions = allocateOutputRegions(layout, { events: 1, sends: 1, created: 2 });

    expect(regions.trailingBase).toBe(6);
    expect(regions.eventIndices).toEqual([6]);
    expect(regions.sendIndices).toEqual([7]);
    expect(regions.createdIndices).toEqual([8, 9]);
    expect(regions.changeIndex).toBe(10);
  });

  it('refuses a duplicate participant and a second block for one contract', () => {
    expect(() => layoutTransaction([
      { contract: 'A', masters: ['A m1'], state: ['DA'] },
      { contract: 'A', masters: ['A m2'], state: [] },
    ])).toThrowError(/two blocks/);

    expect(() => layoutTransaction([
      { contract: 'A', masters: ['A m1', 'A m1'], state: [] },
    ])).toThrowError(/appears twice/);
  });
});
