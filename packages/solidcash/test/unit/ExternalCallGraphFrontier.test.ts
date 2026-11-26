import { describe, expect, it } from 'vitest';
import {
  assertAcyclicExternalCallPath, visitExpandingExternalCallGroups,
} from '../../src/stateful/StatefulContract.js';
import {
  snapshotExternalCallFrontier, wouldCreateExternalCallParentCycle,
} from '../../src/stateful/external-call-graph-frontier.js';

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

  it('preserves a callback path when a descendant retargets an ancestor physical carrier', () => {
    // A.release -> B.claim -> A.setClaimed uses one physical A master. The second A call is a
    // separate logical child of B; it must not reparent A's original carrier below B.
    expect(wouldCreateExternalCallParentCycle([-1, 0], 0, 1)).toBe(true);
    expect(wouldCreateExternalCallParentCycle([-1, 0, -1], 2, 1)).toBe(false);
  });

  it('keeps a sibling logical ancestry after its physical carrier is retargeted', () => {
    const physicalGroups = [
      { categoryId: 'aa', functionName: 'root' },
      { categoryId: 'bb', functionName: 'forward' },
      { categoryId: 'cc', functionName: 'read' },
    ];
    const physicalParents = [-1, 0, 0];
    const physicalCallsites = ['root', 'forward', 'read'];
    const logical = snapshotExternalCallFrontier(physicalGroups, physicalParents, physicalCallsites);
    physicalGroups[2]!.functionName = 'write';
    physicalParents[2] = 1;
    physicalCallsites[2] = 'write';
    expect(logical.groups[2]!.functionName).toBe('read');
    expect(logical.parents[2]).toBe(0);
    expect(logical.callsites[2]).toBe('read');
    expect(() => assertAcyclicExternalCallPath(logical.groups, logical.parents, 2, 'bb', 'forward'))
      .not.toThrow();
    expect(() => assertAcyclicExternalCallPath(physicalGroups, physicalParents, 2, 'bb', 'forward'))
      .toThrow(/Recursive external-call graph/);
  });
});
