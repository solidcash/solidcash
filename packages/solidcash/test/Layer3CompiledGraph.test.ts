import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { layer3 } from '../src/index.js';

const compile = (name: string) => compileString(`pragma solidcash >=0.8.0;
contract ${name}() {
  int count;
  function add(int n) public returns (int) {
    this.count = this.count + n;
    require(n >= 0);
    return this.count;
  }
}`, { forceStateful: true, experimentalHiddenBatch: true });

describe('layer3.planCompiledGraph', () => {
  it('groups an A -> B -> A cycle into one ordered execution per physical owner', () => {
    const a = compile('GraphA');
    const b = compile('GraphB');
    const plan = layer3.planCompiledGraph([
      { artifact: a, lockingBytecode: '51' },
      { artifact: b, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'add', args: [1n] },
      { parent: 0, callee: 1, function: 'add', args: [2n] },
      { parent: 1, callee: 0, function: 'add', args: [3n] },
    ]);

    expect(plan.participants.map((participant) => participant.invocations)).toEqual([[0, 2], [1]]);
    expect(plan.invocations.map(
      ({ parent, caller, callee, localRow, subtreeEnd }) =>
        ({ parent, caller, callee, localRow, subtreeEnd }),
    )).toEqual([
      { parent: null, caller: null, callee: 0, localRow: 0, subtreeEnd: 2 },
      { parent: 0, caller: 0, callee: 1, localRow: 0, subtreeEnd: 2 },
      { parent: 1, caller: 1, callee: 0, localRow: 1, subtreeEnd: 2 },
    ]);
    expect(plan.invocations.every((invocation) =>
      invocation.selectorHex.length === 8 && invocation.resultTypes[0] === 'int256')).toBe(true);
  });

  it('rejects ambiguous owners, missing roots, idle participants, and invalid endpoints', () => {
    const a = compile('GraphGuard');
    expect(() => layer3.planCompiledGraph([
      { artifact: a, lockingBytecode: '51' },
      { artifact: a, lockingBytecode: '51' },
    ], [{ parent: null, callee: 0, function: 'add', args: [1n] }])).toThrow(/same physical/);
    expect(() => layer3.planCompiledGraph(
      [{ artifact: a, lockingBytecode: '51' }],
      [{ parent: 0, callee: 0, function: 'add', args: [1n] }],
    )).toThrow(/exactly one root/);
    expect(() => layer3.planCompiledGraph([
      { artifact: a, lockingBytecode: '51' },
      { artifact: a, lockingBytecode: '52' },
    ], [{ parent: null, callee: 0, function: 'add', args: [1n] }])).toThrow(/no invocation/);
    expect(() => layer3.planCompiledGraph(
      [{ artifact: a, lockingBytecode: '51' }],
      [{ parent: null, callee: 1, function: 'add', args: [1n] }],
    )).toThrow(/out of range/);
  });

  it('rejects a child attached after its parent subtree has completed', () => {
    const a = compile('GraphTreeGuard');
    expect(() => layer3.planCompiledGraph([
      { artifact: a, lockingBytecode: '51' },
      { artifact: a, lockingBytecode: '52' },
      { artifact: a, lockingBytecode: '53' },
    ], [
      { parent: null, callee: 0, function: 'add', args: [1n] },
      { parent: 0, callee: 1, function: 'add', args: [2n] },
      { parent: 0, callee: 2, function: 'add', args: [3n] },
      { parent: 1, callee: 1, function: 'add', args: [4n] },
    ])).toThrow(/completed subtree/);
  });

  it('frames the global tree, local owner batches, and authenticated results into one root', () => {
    const a = compile('GraphCommitA');
    const b = compile('GraphCommitB');
    const plan = layer3.planCompiledGraph([
      { artifact: a, lockingBytecode: '51' },
      { artifact: b, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'add', args: [1n] },
      { parent: 0, callee: 1, function: 'add', args: [2n] },
    ]);
    const first = layer3.finalizeCompiledGraph(
      plan, { 0: '51', 1: '52' }, [0, 1], [2, 3],
      ['5100000000000000', '5200000000000000'],
    );
    const changed = layer3.finalizeCompiledGraph(
      plan, { 0: '51', 1: '53' }, [0, 1], [2, 3],
      ['5100000000000000', '5300000000000000'],
    );
    expect(first.root).toMatch(/^[0-9a-f]{64}$/);
    expect(first.root).not.toBe(changed.root);
    expect(first.bytes.length).toBeGreaterThan(
      plan.participants.reduce((sum, participant) => sum + participant.batch.blob.length, 0),
    );
    expect(() => layer3.finalizeCompiledGraph(
      plan, { 0: '51' }, [0, 1], [2, 3], ['5100000000000000', '5200000000000000'],
    )).toThrow(/lacks canonical result/);
    expect(() => layer3.finalizeCompiledGraph(
      plan, { 0: '51', 1: '52', 9: '53' }, [0, 1], [2, 3],
      ['5100000000000000', '5200000000000000'],
    ))
      .toThrow(/unknown invocation/);

    const controller = layer3.generateGraphRootController();
    expect(controller).toContain('nftCommitment == sha256(transcript)');
    expect(controller).toContain('participantInput > previousInput');
    expect(controller).toContain('unlocking.slice(0, 5) == hex"0453434231"');
    expect(controller).toContain('outputCategory.slice(0, 32) != controllerCategory');
    expect(compileString(controller).bytecode.length).toBeGreaterThan(0);
  });
});
