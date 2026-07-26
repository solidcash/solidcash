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
  it('expands a compiler-authored worklist while acquiring each physical owner once', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const a = compileString(`pragma solidcash >=0.8.0;
      interface IB { function step(address c, int n); }
      contract WorklistA() {
        function run(address b, address c, int first, int second) public {
          IB(b).step(c, first);
          IB(b).step(c, second);
          require(first >= 0 && second >= 0);
        }
      }`, options);
    const b = compileString(`pragma solidcash >=0.8.0;
      interface IC { function finish(int n); }
      contract WorklistB() {
        function step(address c, int n) public {
          IC(c).finish(n);
          require(n >= 0);
        }
      }`, options);
    const c = compileString(`pragma solidcash >=0.8.0;
      contract WorklistC() {
        int total;
        function finish(int n) public {
          this.total = this.total + n;
          require(n >= 0);
        }
      }`, options);
    const pa = { artifact: a, lockingBytecode: '51' };
    const pb = { artifact: b, lockingBytecode: '52' };
    const pc = { artifact: c, lockingBytecode: '53' };
    const plan = layer3.deriveCompiledGraphPlan({
      root: pa,
      function: 'run',
      args: [new Uint8Array([0x52]), new Uint8Array([0x53]), 2n, 3n],
      targets: { IB: [pb, pb], IC: [pc, pc] },
    });

    expect(plan.participants.map((participant) => participant.lockingBytecode))
      .toEqual(['51', '52', '53']);
    expect(plan.participants.map((participant) => participant.invocations))
      .toEqual([[0], [1, 3], [2, 4]]);
    expect(plan.invocations.map(({ parent, caller, callee, argsHex }) =>
      ({ parent, caller, callee, argsHex }))).toEqual([
      { parent: null, caller: null, callee: 0, argsHex: '015201535253' },
      { parent: 0, caller: 0, callee: 1, argsHex: '015352' },
      { parent: 1, caller: 1, callee: 2, argsHex: '52' },
      { parent: 0, caller: 0, callee: 1, argsHex: '015353' },
      { parent: 3, caller: 1, callee: 2, argsHex: '53' },
    ]);
  });

  it('fails the symbolic worklist closed on runtime occurrence and recursive expansion', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const conditional = compileString(`pragma solidcash >=0.8.0;
      interface IPeer { function run(address peer, bool take); }
      contract ConditionalGraph() {
        function run(address peer, bool take) public {
          if (take) { IPeer(peer).run(peer, false); }
          require(true);
        }
      }`, options);
    const participant = { artifact: conditional, lockingBytecode: '51' };
    expect(() => layer3.deriveCompiledGraphPlan({
      root: participant,
      function: 'run',
      args: [new Uint8Array([0x51]), true],
      targets: { IPeer: participant },
    })).toThrow(/lacks a valid conditional occurrence proof/);
    const leaf = compileString(`pragma solidcash >=0.8.0;
      contract ConditionalLeaf() {
        function run(address peer, bool take) public { require(!take || peer.length > 0); }
      }`, options);
    const leafParticipant = { artifact: leaf, lockingBytecode: '53' };
    const reached = layer3.deriveCompiledGraphPlan({
      root: participant,
      function: 'run',
      args: [new Uint8Array([0x53]), true],
      targets: { IPeer: leafParticipant },
      occurrence: ({ kind }) => kind === 'conditional' ? 1 : 0,
    });
    expect(reached.participants.map((owner) => owner.invocations)).toEqual([[0], [1]]);
    const loop = compileString(`pragma solidcash >=0.8.0;
      interface IPeer { function run(address peer, bool take); }
      contract LoopGraph() {
        function repeat(address peer, bool take, int times) public {
          for (int i = 0; i < times; i = i + 1) { IPeer(peer).run(peer, take); }
          require(times >= 0);
        }
      }`, options);
    const loopParticipant = { artifact: loop, lockingBytecode: '54' };
    const repeated = layer3.deriveCompiledGraphPlan({
      root: loopParticipant,
      function: 'repeat',
      args: [new Uint8Array([0x53]), false, 2n],
      targets: { IPeer: [leafParticipant, leafParticipant] },
      occurrence: ({ kind }) => kind === 'loop' ? 2 : 0,
    });
    expect(repeated.participants.map((owner) => owner.invocations)).toEqual([[0], [1, 2]]);

    const recursive = compileString(`pragma solidcash >=0.8.0;
      interface IPeer { function again(address peer); }
      contract RecursiveGraph() {
        function again(address peer) public {
          IPeer(peer).again(peer);
          require(true);
        }
      }`, options);
    const recursiveParticipant = { artifact: recursive, lockingBytecode: '52' };
    expect(() => layer3.deriveCompiledGraphPlan({
      root: recursiveParticipant,
      function: 'again',
      args: [new Uint8Array([0x52])],
      targets: { IPeer: recursiveParticipant },
    })).toThrow(/explicit bounded occurrence proof/);
  });

  it('separates resolvable result dependencies from structural owner cycles', () => {
    expect(() => layer3.assertResolvableResultDependencies(3, [[1], [2], []])).not.toThrow();
    expect(() => layer3.assertResolvableResultDependencies(3, [[1], [2], [0]]))
      .toThrow(/unavailable future result/);
    expect(() => layer3.assertResolvableResultDependencies(2, [[1, 1], []]))
      .toThrow(/duplicate/);
    expect(() => layer3.assertResolvableResultDependencies(2, [[2], []]))
      .toThrow(/out-of-range/);
  });

  it('derives msg.sender-keyed collection witnesses from the authenticated parent owner', () => {
    const graphOptions = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const caller = compileString(`contract Caller() {
      function start() public { require(true); }
    }`, graphOptions);
    const token = compileString(`contract CallerAllowance() {
      mapping(address => bigint) balances;
      mapping(address => mapping(address => bigint)) allowance;
      function spend(address from, address to, bigint amount) public {
        require(this.allowance[from][msg.sender] >= amount);
        require(this.balances[from] >= amount);
        this.allowance[from][msg.sender] = this.allowance[from][msg.sender] - amount;
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
      }
    }`, graphOptions);
    const plan = layer3.planCompiledGraph([
      { artifact: caller, lockingBytecode: '51' },
      { artifact: token, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'start', args: [] },
      { parent: 0, callee: 1, function: 'spend', args: [new Uint8Array([0x53]), new Uint8Array([0x54]), 3n] },
      { parent: 0, callee: 1, function: 'spend', args: [new Uint8Array([0x53]), new Uint8Array([0x55]), 2n] },
    ]);
    expect(plan.participants[1].batch.routeWitnesses).toContainEqual(new Uint8Array([0x51]));
    expect(() => layer3.encodeHiddenBatch(token, [
      { function: 'spend', args: [new Uint8Array([0x53]), new Uint8Array([0x54]), 3n] },
      { function: 'spend', args: [new Uint8Array([0x53]), new Uint8Array([0x55]), 2n] },
    ])).toThrow(/authenticated logical caller/);
  });

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
    // Reusing owner A does not itself create a value cycle.
    expect(plan.invocations.map((invocation) => invocation.resultDependencies)).toEqual([[], [], []]);
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
    expect(() => layer3.planCompiledGraph(
      Array.from({ length: 9 }, (_unused, index) => ({
        artifact: a, lockingBytecode: (0x51 + index).toString(16),
      })),
      [{ parent: null, callee: 0, function: 'add', args: [1n] }],
    )).toThrow(/between 1 and 8/);
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
      ['5100000000000000', '5200000000000000'], [4, 5],
    );
    const changed = layer3.finalizeCompiledGraph(
      plan, { 0: '51', 1: '53' }, [0, 1], [2, 3],
      ['5100000000000000', '5300000000000000'], [4, 5],
    );
    expect(first.root).toMatch(/^[0-9a-f]{64}$/);
    expect(first.root).not.toBe(changed.root);
    expect(first.bytes.length).toBeGreaterThan(
      plan.participants.reduce((sum, participant) => sum + participant.batch.blob.length, 0),
    );
    expect(() => layer3.finalizeCompiledGraph(
      plan, { 0: '51' }, [0, 1], [2, 3], ['5100000000000000', '5200000000000000'], [4, 5],
    )).toThrow(/lacks canonical result/);
    expect(() => layer3.finalizeCompiledGraph(
      plan, { 0: '51', 1: '52', 9: '53' }, [0, 1], [2, 3],
      ['5100000000000000', '5200000000000000'], [4, 5],
    ))
      .toThrow(/unknown invocation/);
    expect(() => layer3.finalizeCompiledGraph(
      plan, { 0: '51', 1: '52' }, [0, 1], [2, 3],
      ['5100000000000000', '5200000000000000'], [5, 4],
    )).toThrow(/strictly increasing/);

    const projection = layer3.generateGraphProjectionVerifier();
    const controller = layer3.generateGraphRootController('51');
    expect(controller).toContain('nftCommitment == sha256(transcript)');
    expect(controller).toContain('participantInput == expectedInput');
    expect(controller).toContain('unlocking.slice(0, 5) == hex"0453434231"');
    expect(controller).toContain('outputCategory.slice(0, 32) != controllerCategory');
    expect(projection).toContain('projectionInput == this.activeInputIndex');
    const controllerArtifact = compileString(controller);
    const projectionArtifact = compileString(projection);
    // Freeze the actual redeem-script cost of the variable-table parsers. `Artifact.bytecode` is ASM text;
    // `debug.bytecode` is the hex-encoded script and is the consensus/deployment size.
    expect(controllerArtifact.debug.bytecode.length / 2).toBe(1_897);
    expect(projectionArtifact.debug.bytecode.length / 2).toBe(7_025);
    expect(controllerArtifact.diagnostics ?? []).not.toContainEqual(
      expect.objectContaining({ code: 'contract-size-limit' }),
    );
    expect(projectionArtifact.diagnostics ?? []).not.toContainEqual(
      expect.objectContaining({ code: 'contract-size-limit' }),
    );
  });
});
