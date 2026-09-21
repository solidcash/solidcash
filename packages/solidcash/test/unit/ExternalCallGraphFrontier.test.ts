import { describe, expect, it } from 'vitest';
import {
  assertAcyclicExternalCallPath, visitExpandingExternalCallGroups,
} from '../../src/stateful/StatefulContract.js';

describe('transitive external-call graph frontier', () => {
  it('visits children discovered after the original frontier and preserves parent order', async () => {
    const groups = [{ categoryId: 'aa', functionName: 'root' }];
    const visited: string[] = [];
    await visitExpandingExternalCallGroups(groups, async (group) => {
      visited.push(group.functionName);
      if (group.functionName === 'root') groups.push({ categoryId: 'bb', functionName: 'middle' });
      if (group.functionName === 'middle') groups.push({ categoryId: 'cc', functionName: 'leaf' });
    });
    expect(visited).toEqual(['root', 'middle', 'leaf']);
  });

  it('rejects an external recursion by deployed identity and function, not just a repeated name', () => {
    const groups = [
      { categoryId: 'aa', functionName: 'run' },
      { categoryId: 'bb', functionName: 'run' },
      { categoryId: 'aa', functionName: 'other' },
    ];
    expect(() => assertAcyclicExternalCallPath(groups, [-1, 0, 1], 2, 'bb', 'run'))
      .toThrow(/Recursive external-call graph/);
    expect(() => assertAcyclicExternalCallPath(groups, [-1, 0, 1], 2, 'cc', 'run'))
      .not.toThrow();
    expect(() => assertAcyclicExternalCallPath(groups, [-1, 0, 1], 2, 'aa', 'new'))
      .not.toThrow();
    expect(() => assertAcyclicExternalCallPath(groups, [-1, 0, 1], 2, 'aa', 'other'))
      .toThrow(/Recursive external-call graph/);
  });

  it('rejects a malformed parent cycle instead of looping indefinitely', () => {
    const groups = [{ categoryId: 'aa', functionName: 'one' }, { categoryId: 'bb', functionName: 'two' }];
    expect(() => assertAcyclicExternalCallPath(groups, [1, 0], 1, 'cc', 'three'))
      .toThrow(/cyclic parent relation/);
  });
});
