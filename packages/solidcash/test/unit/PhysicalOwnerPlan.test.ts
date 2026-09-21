import { describe, expect, it } from 'vitest';
import {
  planPhysicalOwnerComponents,
  type PhysicalOwnerOccurrence,
} from '../../src/message-bus/physical-owner-plan.js';

const occurrence = (
  occurrenceKey: string,
  physicalOwner: number,
  parentOccurrenceKey?: string,
  resultProducerOccurrenceKeys?: readonly string[],
): PhysicalOwnerOccurrence => ({
  occurrenceKey, physicalOwner, parentOccurrenceKey, resultProducerOccurrenceKeys,
});

describe('physical-owner dependency planning', () => {
  it('orders exact logical occurrences by call/effect dependencies rather than numeric position', () => {
    const input = [occurrence('root', 0), occurrence('left', 1, 'root'), occurrence('right', 2, 'root')];

    const plan = planPhysicalOwnerComponents(input);

    expect(plan.physicalOwnerByOccurrence).toEqual({ root: 0, left: 1, right: 2 });
    expect(plan.components).toEqual([
      { owners: [1], occurrenceKeys: ['left'], dependencyComponents: [], cyclic: false },
      { owners: [2], occurrenceKeys: ['right'], dependencyComponents: [], cyclic: false },
      { owners: [0], occurrenceKeys: ['root'], dependencyComponents: [0, 1], cyclic: false },
    ]);
    expect(input).toEqual([
      occurrence('root', 0), occurrence('left', 1, 'root'), occurrence('right', 2, 'root'),
    ]);
  });

  it('retains every exact occurrence when a callback reuses an earlier physical owner', () => {
    const plan = planPhysicalOwnerComponents([
      occurrence('root-run', 0),
      occurrence('relay', 1, 'root-run'),
      occurrence('root-provide', 0, 'relay'),
    ]);

    expect(plan.components).toEqual([{
      owners: [0, 1],
      occurrenceKeys: ['relay', 'root-provide', 'root-run'],
      dependencyComponents: [],
      cyclic: true,
    }]);
  });

  it('orders a sibling consumer after its exact authenticated producer', () => {
    const plan = planPhysicalOwnerComponents([
      occurrence('root', 0),
      occurrence('producer', 2, 'root'),
      occurrence('consumer', 1, 'root', ['producer']),
    ]);

    expect(plan.components).toEqual([
      { owners: [2], occurrenceKeys: ['producer'], dependencyComponents: [], cyclic: false },
      { owners: [1], occurrenceKeys: ['consumer'], dependencyComponents: [0], cyclic: false },
      { owners: [0], occurrenceKeys: ['root'], dependencyComponents: [0, 1], cyclic: false },
    ]);
  });

  it('rejects logical producer-result cycles before physical-owner collapse', () => {
    expect(() => planPhysicalOwnerComponents([
      occurrence('a', 0, undefined, ['b']),
      occurrence('b', 0, undefined, ['a']),
    ])).toThrow(/producer-result dependencies contain a logical cycle/);
  });

  it('retains same-owner call/effect dependencies as physical self edges', () => {
    const plan = planPhysicalOwnerComponents([
      occurrence('first', 0), occurrence('second', 0, 'first'),
    ]);

    expect(plan.components).toEqual([{
      owners: [0], occurrenceKeys: ['first', 'second'], dependencyComponents: [], cyclic: true,
    }]);
  });

  it('is deterministic and deeply freezes the returned schedule', () => {
    const input = [occurrence('a', 0), occurrence('b', 1), occurrence('c', 2, 'a', ['b'])];
    const first = planPhysicalOwnerComponents(input);
    const second = planPhysicalOwnerComponents(input.map((item) => ({ ...item })));

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.components)).toBe(true);
    expect(Object.isFrozen(first.physicalOwnerByOccurrence)).toBe(true);
    expect(first.components.every((component) => Object.isFrozen(component)
      && Object.isFrozen(component.owners)
      && Object.isFrozen(component.occurrenceKeys)
      && Object.isFrozen(component.dependencyComponents))).toBe(true);
  });

  it('fails closed on missing, duplicate, or malformed occurrence metadata', () => {
    expect(() => planPhysicalOwnerComponents([occurrence('', 0)]))
      .toThrow(/empty identity/);
    expect(() => planPhysicalOwnerComponents([occurrence('same', 0), occurrence('same', 1)]))
      .toThrow(/duplicate occurrence identity/);
    expect(() => planPhysicalOwnerComponents([occurrence('bad-owner', -1)]))
      .toThrow(/invalid physical owner/);
    expect(() => planPhysicalOwnerComponents([occurrence('child', 0, 'missing')]))
      .toThrow(/references missing occurrence/);
    expect(() => planPhysicalOwnerComponents([
      occurrence('producer', 0), occurrence('consumer', 1, undefined, ['producer', 'producer']),
    ])).toThrow(/repeats dependency/);
  });
});
