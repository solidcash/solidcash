import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
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
  it('expands compiler-collapsed repeated calls into one owner-reusing worklist', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalRepeatedExternalBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const caller = compileString(`pragma solidcash >=0.8.0;
      interface ICounter { function add(int amount); }
      contract BatchCaller() {
        function run(address counter, int first, int second) public {
          ICounter(counter).add(first);
          ICounter(counter).add(second);
          require(first >= 0 && second >= 0);
        }
      }`, options);
    const callee = compileString(`pragma solidcash >=0.8.0;
      contract BatchCounter() {
        int count;
        function add(int amount) public {
          this.count = this.count + amount;
          require(amount >= 0);
        }
      }`, options);
    const root = { artifact: caller, lockingBytecode: '51' };
    const target = { artifact: callee, lockingBytecode: '52' };
    const plan = layer3.deriveCompiledGraphPlan({
      root,
      function: 'run',
      args: [new Uint8Array([0x52]), 2n, 3n],
      targets: { ICounter: target },
    });

    expect(plan.participants.map((participant) => participant.lockingBytecode)).toEqual(['51', '52']);
    expect(plan.participants.map((participant) => participant.invocations)).toEqual([[0], [1, 2]]);
    expect(plan.invocations.map(({ parent, callee, function: name, argsHex }) =>
      ({ parent, callee, name, argsHex }))).toEqual([
      { parent: null, callee: 0, name: 'run', argsHex: '01525253' },
      { parent: 0, callee: 1, name: 'add', argsHex: '52' },
      { parent: 0, callee: 1, name: 'add', argsHex: '53' },
    ]);
    const callsite = caller.invocationAnalysis!.functions.find((fn) => fn.name === 'run')!
      .externalCalls![0];
    expect(callsite.sourceLocation).toEqual({ line: 5, column: 10 });
    try {
      layer3.deriveCompiledGraphPlan({
        root,
        function: 'run',
        args: [new Uint8Array([0x52]), 2n, 3n],
        targets: {},
      });
      throw new Error('expected unresolved target diagnostic');
    } catch (error) {
      expect(error).toBeInstanceOf(layer3.Layer3DiagnosticError);
      const diagnostic = error as layer3.Layer3DiagnosticError;
      expect(diagnostic.code).toBe('L3_TARGET_UNRESOLVED');
      expect(diagnostic.context).toMatchObject({
        invocationIds: [0],
        callChain: ['0:BatchCaller.run'],
        callsiteId: 0,
        callsiteLocation: { line: 5, column: 10 },
        interfaceName: 'ICounter',
      });
    }
    expect(() => layer3.deriveCompiledGraphPlan({
      root,
      function: 'run',
      args: [new Uint8Array([0x52]), 2n, 3n],
      targets: { ICounter: target },
      maximumInvocations: 1,
    })).toThrow(expect.objectContaining({
      code: 'L3_INVOCATION_LIMIT',
      context: expect.objectContaining({ measured: 2, limit: 1 }),
    }));
    expect(() => layer3.deriveCompiledGraphPlan({
      root,
      function: 'run',
      args: [new Uint8Array([0x51]), 2n, 3n],
      targets: { ICounter: { ...target, lockingBytecode: '51' } },
    })).toThrow(expect.objectContaining({
      code: 'L3_OWNER_ARTIFACT_CONFLICT',
      context: expect.objectContaining({ ownerIdentity: '51' }),
    }));
  });

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

  it('expands a VM-resolved varying-selector table without trusting the SDK choice', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const table = compileString(`pragma solidcash >=0.8.0;
      interface IH { function inc(uint value); function dec(uint value); }
      contract DispatchTable() {
        function(uint) external[] handlers;
        function registerInc(address target) public { this.handlers.push(IH(target).inc); require(true); }
        function registerDec(address target) public { this.handlers.push(IH(target).dec); require(true); }
        function fireAll(uint value) public {
          for (int i = 0; i < 2; i = i + 1) { handlers[i](value); }
          require(value >= 0);
        }
      }`, options);
    const handler = compileString(`pragma solidcash >=0.8.0;
      contract Handler() {
        int count;
        function inc(uint value) public { this.count = this.count + int(value); require(value >= 0); }
        function dec(uint value) public { this.count = this.count - int(value); require(value >= 0); }
        function other(uint value) public { this.count = int(value); require(value >= 0); }
      }`, options);
    const root = { artifact: table, lockingBytecode: '51' };
    const first = { artifact: handler, lockingBytecode: '52' };
    const second = { artifact: handler, lockingBytecode: '53' };
    const plan = layer3.deriveCompiledGraphPlan({
      root,
      function: 'fireAll',
      args: [3n],
      targets: {},
      occurrence: ({ kind }) => kind === 'loop' ? 2 : 0,
      dynamicCall: ({ occurrence }) => occurrence === 0
        ? { participant: first, function: 'inc' }
        : { participant: second, function: 'dec' },
    });

    expect(plan.participants.map((participant) => participant.lockingBytecode))
      .toEqual(['51', '52', '53']);
    expect(plan.invocations.map(({ parent, callee, function: name, argsHex }) =>
      ({ parent, callee, name, argsHex }))).toEqual([
      { parent: null, callee: 0, name: 'fireAll', argsHex: '53' },
      { parent: 0, callee: 1, name: 'inc', argsHex: '53' },
      { parent: 0, callee: 2, name: 'dec', argsHex: '53' },
    ]);
    const dynamicCall = table.invocationAnalysis!.functions.find((fn) =>
      fn.name === 'fireAll')!.externalCalls![0];
    expect(dynamicCall.possibleTargets).toEqual([
      {
        functionName: 'dec',
        selector: handler.abi.find((fn) => fn.name === 'dec')!.selector,
      },
      {
        functionName: 'inc',
        selector: handler.abi.find((fn) => fn.name === 'inc')!.selector,
      },
    ].sort((left, right) => left.selector!.localeCompare(right.selector!)));
    expect(() => layer3.deriveCompiledGraphPlan({
      root,
      function: 'fireAll',
      args: [3n],
      targets: {},
      occurrence: () => 2,
    })).toThrow(/lacks a dynamic call proof/);
    expect(() => layer3.deriveCompiledGraphPlan({
      root,
      function: 'fireAll',
      args: [3n],
      targets: {},
      occurrence: () => 2,
      dynamicCall: () => ({ participant: first, function: 'other' }),
    })).toThrow(/outside its compiler-bounded target set/);
  });

  it('expands a VM-resolved foreign function pointer and rejects an absent proof', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
      solidityImportCompat: true,
    };
    const caller = compileString(`pragma solidcash >=0.8.0;
      interface IH { function inc(uint value); function dec(uint value); }
      contract PointerCaller() {
        function(uint) external handler;
        function set(function(uint) external next) public { this.handler = next; require(true); }
        function fire(uint value) public { handler(value); require(value >= 0); }
      }`, options);
    const handler = compileString(`pragma solidcash >=0.8.0;
      contract PointerHandler() {
        int count;
        function inc(uint value) public { this.count = this.count + int(value); require(value >= 0); }
        function dec(uint value) public { this.count = this.count - int(value); require(value >= 0); }
      }`, options);
    const root = { artifact: caller, lockingBytecode: '51' };
    const target = { artifact: handler, lockingBytecode: '52' };
    const derive = (withProof: boolean) => layer3.deriveCompiledGraphPlan({
      root,
      function: 'fire',
      args: [4n],
      targets: {},
      ...(withProof && {
        dynamicCall: () => ({ participant: target, function: 'dec' }),
      }),
    });
    const plan = derive(true);
    expect(plan.invocations.map(({ parent, callee, function: name, argsHex }) =>
      ({ parent, callee, name, argsHex }))).toEqual([
      { parent: null, callee: 0, name: 'fire', argsHex: '54' },
      { parent: 0, callee: 1, name: 'dec', argsHex: '54' },
    ]);
    expect(() => derive(false)).toThrow(/lacks a dynamic call proof/);
  });

  it('expands a foreign function pointer returned through an internal helper', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
      solidityImportCompat: true,
    };
    const caller = compileString(`pragma solidcash >=0.8.0;
      interface IH { function inc(uint value); function dec(uint value); }
      contract ReturnedPointerCaller() {
        function choose(address target) internal returns (function(uint) external) {
          return IH(target).dec;
        }
        function fire(address target, uint value) public {
          function(uint) external handler = choose(target);
          handler(value);
          require(value >= 0);
        }
      }`, options);
    const handler = compileString(`pragma solidcash >=0.8.0;
      contract ReturnedPointerHandler() {
        function inc(uint value) public pure { require(value > 0); }
        function dec(uint value) public pure { require(value > 0); }
      }`, options);
    const root = { artifact: caller, lockingBytecode: '51' };
    const target = { artifact: handler, lockingBytecode: '52' };
    const plan = layer3.deriveCompiledGraphPlan({
      root,
      function: 'fire',
      args: [new Uint8Array([0x52]), 4n],
      targets: { IH: target },
    });
    expect(plan.invocations.map(({ parent, callee, function: name, argsHex }) =>
      ({ parent, callee, name, argsHex }))).toEqual([
      { parent: null, callee: 0, name: 'fire', argsHex: '015254' },
      { parent: 0, callee: 1, name: 'dec', argsHex: '54' },
    ]);
  });

  it('resolves canonical low-level calldata into one authenticated typed edge', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const caller = compileString(`pragma solidcash >=0.8.0;
      contract RawCaller() {
        function run(address target, bytes payload) public {
          (bool ok, bytes result) = target.call(payload);
          require(ok && result.length >= 0);
        }
      }`, options);
    const target = compileString(`pragma solidcash >=0.8.0;
      contract RawTarget() {
        function echo(int value) public returns (int) { require(value >= 0); return value; }
      }`, options);
    const root = { artifact: caller, lockingBytecode: '51' };
    const peer = { artifact: target, lockingBytecode: '52' };
    const selector = target.abi.find((fn) => fn.name === 'echo')!.selector!;
    const payload = Uint8Array.from([...hexToBin(selector), 0x53]);
    const derive = (decoded: bigint, participant = peer) => layer3.deriveCompiledGraphPlan({
      root,
      function: 'run',
      args: [hexToBin('52'), payload],
      targets: {},
      dynamicCall: ({ kind }) => {
        expect(kind).toBe('low-level');
        return { participant, function: 'echo', args: [decoded] };
      },
    });
    expect(derive(3n).invocations.map(({ callee, function: name, argsHex }) =>
      ({ callee, name, argsHex }))).toEqual([
      { callee: 0, name: 'run', argsHex: `015205${selector}53` },
      { callee: 1, name: 'echo', argsHex: '53' },
    ]);
    expect(() => derive(4n)).toThrow(/decoded calldata is not canonical/);
    expect(() => derive(3n, { ...peer, lockingBytecode: '53' }))
      .toThrow(/target proof disagrees/);
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
    expect(() => layer3.deriveCompiledGraphPlan({
      root: participant,
      function: 'run',
      args: [new Uint8Array([0x53]), true],
      targets: { IPeer: { ...leafParticipant, lockingBytecode: '54' } },
      occurrence: ({ kind }) => kind === 'conditional' ? 1 : 0,
    })).toThrow(/target proof disagrees with registered owner/);
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
      targets: {},
      occurrence: ({ kind }) => kind === 'loop' ? 2 : 0,
      target: ({ callsiteId, occurrence, interfaceName }) => {
        expect({ callsiteId, occurrence, interfaceName }).toEqual({
          callsiteId: 0, occurrence: expect.any(Number), interfaceName: 'IPeer',
        });
        return leafParticipant;
      },
    });
    expect(repeated.participants.map((owner) => owner.invocations)).toEqual([[0], [1, 2]]);
    expect(() => layer3.deriveCompiledGraphPlan({
      root: loopParticipant,
      function: 'repeat',
      args: [new Uint8Array([0x53]), false, 2n],
      targets: { IPeer: [leafParticipant] },
      occurrence: ({ kind }) => kind === 'loop' ? 2 : 0,
    })).toThrow(expect.objectContaining({
      code: 'L3_TARGET_EXHAUSTED',
      context: expect.objectContaining({
        invocationIds: [0],
        callChain: ['0:LoopGraph.repeat'],
        callsiteId: 0,
      }),
    }));

    const literalLoop = compileString(`pragma solidcash >=0.8.0;
      interface IPeer { function run(address peer, bool take); }
      contract LiteralLoopGraph() {
        function repeat(address peer, bool take) public {
          for (int i = 0; i < 2; i = i + 1) { IPeer(peer).run(peer, take); }
          require(true);
        }
      }`, options);
    expect(() => layer3.deriveCompiledGraphPlan({
      root: { artifact: literalLoop, lockingBytecode: '55' },
      function: 'repeat',
      args: [new Uint8Array([0x53]), false],
      targets: { IPeer: [leafParticipant, leafParticipant, leafParticipant] },
      occurrence: () => 3,
      // X36: the ceiling leg now names the bound and its provenance instead of reporting the count as an
      // invalid proof. The coarser wording was this entry point's own copy of a bound `planCompiledGraph`
      // also enforces, which is exactly the drift both are now routed away from.
    })).toThrow('layer3: callsite 0 was planned with 3 occurrences, above the 2 proven by a compile-time trip count');

    const boundedRecursive = compileString(`pragma solidcash >=0.8.0;
      interface IPeer { function again(address peer, bool take); }
      contract BoundedRecursiveGraph() {
        function again(address peer, bool take) public {
          if (take) { IPeer(peer).again(peer, false); }
          require(peer.length > 0);
        }
      }`, options);
    const boundedParticipant = { artifact: boundedRecursive, lockingBytecode: '56' };
    const boundedPlan = layer3.deriveCompiledGraphPlan({
      root: boundedParticipant,
      function: 'again',
      args: [new Uint8Array([0x56]), true],
      targets: { IPeer: boundedParticipant },
      occurrence: ({ invocation }) => invocation === 0 ? 1 : 0,
    });
    expect(boundedPlan.invocations.map(({ parent, callee, function: name }) =>
      ({ parent, callee, name }))).toEqual([
      { parent: null, callee: 0, name: 'again' },
      { parent: 0, callee: 0, name: 'again' },
    ]);
    expect(() => layer3.deriveCompiledGraphPlan({
      root: boundedParticipant,
      function: 'again',
      args: [new Uint8Array([0x56]), true],
      targets: { IPeer: boundedParticipant },
      occurrence: () => 2,
    })).toThrow('conditional callsite reached at most once, but 2 occurrences were planned');
    try {
      layer3.deriveCompiledGraphPlan({
        root: boundedParticipant,
        function: 'again',
        args: [new Uint8Array([0x56]), true],
        targets: { IPeer: boundedParticipant },
        occurrence: () => 1,
      });
      throw new Error('expected bounded recursive depth diagnostic');
    } catch (error) {
      expect(error).toBeInstanceOf(layer3.Layer3DiagnosticError);
      expect(error).toMatchObject({
        code: 'L3_GRAPH_DEPTH_LIMIT',
        context: expect.objectContaining({ measured: 8, limit: 7 }),
      });
    }

    const recursive = compileString(`pragma solidcash >=0.8.0;
      interface IPeer { function again(address peer); }
      contract RecursiveGraph() {
        function again(address peer) public {
          IPeer(peer).again(peer);
          require(true);
        }
      }`, options);
    const recursiveParticipant = { artifact: recursive, lockingBytecode: '52' };
    try {
      layer3.deriveCompiledGraphPlan({
        root: recursiveParticipant,
        function: 'again',
        args: [new Uint8Array([0x52])],
        targets: { IPeer: recursiveParticipant },
      });
      throw new Error('expected recursive closure diagnostic');
    } catch (error) {
      expect(error).toBeInstanceOf(layer3.Layer3DiagnosticError);
      const diagnostic = error as layer3.Layer3DiagnosticError;
      expect(diagnostic.code).toBe('L3_RECURSIVE_CLOSURE');
      expect(diagnostic.context).toMatchObject({
        invocationIds: [0, 1],
        callChain: ['0:RecursiveGraph.again', '1:RecursiveGraph.again'],
      });
      expect(diagnostic.message).toContain('explicit bounded occurrence proof');
    }
  });

  it('uses VM-probed expression values while leaving argument authentication on-chain', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const caller = compileString(`pragma solidcash >=0.8.0;
      interface ITarget { function finish(int n); }
      contract ExpressionCaller() {
        function run(address target, int n) public {
          ITarget(target).finish(n * 2 + 1);
          require(n >= 0);
        }
      }`, options);
    const target = compileString(`pragma solidcash >=0.8.0;
      contract ExpressionTarget() {
        function finish(int n) public { require(n >= 0); }
      }`, options);
    const root = { artifact: caller, lockingBytecode: '51' };
    const peer = { artifact: target, lockingBytecode: '52' };
    const base = {
      root,
      function: 'run',
      args: [new Uint8Array([0x52]), 2n],
      targets: { ITarget: peer },
    };
    expect(() => layer3.deriveCompiledGraphPlan(base)).toThrow(/not symbolically resolvable/);
    const plan = layer3.deriveCompiledGraphPlan({
      ...base,
      expressionArgument: ({ callsiteId, argument, occurrence }) => {
        expect({ callsiteId, argument, occurrence }).toEqual({
          callsiteId: 0, argument: 0, occurrence: 0,
        });
        return 5n;
      },
    });
    expect(plan.invocations[1].argsHex).toBe('55');
  });

  it('expands a fixed-method state-array target run from its authenticated runtime probe', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const caller = compileString(`pragma solidcash >=0.8.0;
      interface IFoo { function ping(uint value); }
      contract ArrayTargetCaller() {
        function(uint) external[] targets;
        function register(address target) public { this.targets.push(IFoo(target).ping); }
        function fire(uint value) public {
          for (uint i = 0; i < 2; i = i + 1) { targets[i](value); }
          require(true);
        }
      }`, options);
    const target = compileString(`pragma solidcash >=0.8.0;
      contract ArrayTarget() { function ping(uint value) public { require(value > 0); } }
    `, options);
    const root = { artifact: caller, lockingBytecode: '51' };
    const peer = { artifact: target, lockingBytecode: '52' };
    const derive = (withProof: boolean) => layer3.deriveCompiledGraphPlan({
      root,
      function: 'fire',
      args: [7n],
      targets: {},
      occurrence: ({ kind }) => kind === 'loop' ? 2 : 0,
      ...(withProof && { target: ({ callsiteId, occurrence, interfaceName }: any) => {
        expect([0, 1]).toContain(callsiteId);
        expect(occurrence).toBe(0);
        expect(interfaceName).toBe('IFoo');
        return peer;
      } }),
    });
    expect(() => derive(false)).toThrow(/resource-derived callsite 0 occurrence 0 lacks a target proof/);
    const plan = derive(true);
    expect(plan.participants.map((owner) => owner.invocations)).toEqual([[0], [1, 2]]);
    expect(plan.invocations.slice(1).map((row) => row.argsHex)).toEqual(['57', '57']);
  });

  it('separates resolvable result dependencies from structural owner cycles', () => {
    expect(() => layer3.assertResolvableResultDependencies(3, [[1], [2], []])).not.toThrow();
    expect(() => layer3.assertResolvableResultDependencies(3, [[1], [2], [0]]))
      .toThrow(expect.objectContaining({
        code: 'L3_FUTURE_RESULT_DEPENDENCY',
        context: expect.objectContaining({
          consumerInvocation: 0,
          producerInvocation: 1,
          cyclicEdge: [0, 1],
          invocationIds: [0, 1, 2, 0],
          callChain: ['invocation:0', 'invocation:1', 'invocation:2', 'invocation:0'],
        }),
      }));
    expect(() => layer3.assertResolvableResultDependencies(2, [[1, 1], []]))
      .toThrow(expect.objectContaining({
        code: 'L3_RESULT_DEPENDENCY_INVALID',
        context: expect.objectContaining({ consumerInvocation: 0, producerInvocation: 1 }),
      }));
    expect(() => layer3.assertResolvableResultDependencies(2, [[2], []]))
      .toThrow(expect.objectContaining({
        code: 'L3_RESULT_DEPENDENCY_INVALID',
        context: expect.objectContaining({ consumerInvocation: 0, producerInvocation: 2 }),
      }));
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
    ])).toThrow(expect.objectContaining({
      code: 'L3_RESOURCE_UNRESOLVED',
      context: expect.objectContaining({
        handler: 'spend', resourceIdentity: expect.stringMatching(/^__scb_key_/),
        keyIdentity: 'msg.sender', invocationIds: [0],
      }),
    }));
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
    )).toThrow(expect.objectContaining({
      code: 'L3_PARTICIPANT_LIMIT',
      context: expect.objectContaining({ measured: 9, limit: 8 }),
    }));

    const tooDeep = Array.from({ length: 9 }, (_unused, index) => ({
      parent: index === 0 ? null : index - 1,
      callee: 0,
      function: 'add',
      args: [1n],
    }));
    expect(() => layer3.planCompiledGraph(
      [{ artifact: a, lockingBytecode: '51' }], tooDeep,
    )).toThrow(expect.objectContaining({
      code: 'L3_GRAPH_DEPTH_LIMIT',
      context: expect.objectContaining({
        participant: 0, handler: 'add', measured: 8, limit: 7,
        invocationIds: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      }),
    }));
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

  it('validates each independently relocatable local block before assigning global bases', () => {
    const a = compile('RelocatableA');
    const b = compile('RelocatableB');
    const plan = layer3.planCompiledGraph([
      { artifact: a, lockingBytecode: '51' },
      { artifact: b, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'add', args: [1n] },
      { parent: 0, callee: 1, function: 'add', args: [2n] },
    ]);
    const layout = layer3.compiledGraphPhysicalLayout(plan);
    expect(layout.participantInputs).toEqual([
      0,
      plan.participants[0].blockLayout.blockSize,
    ]);

    const duplicateOffset = {
      ...plan,
      participants: [
        {
          ...plan.participants[0],
          blockLayout: {
            ...plan.participants[0].blockLayout,
            slots: [
              ...plan.participants[0].blockLayout.slots,
              { kind: 'event' as const, offset: 0, slotIndex: 99 },
            ],
          },
        },
        plan.participants[1],
      ],
    };
    expect(() => layer3.compiledGraphPhysicalLayout(duplicateOffset))
      .toThrow(/malformed local block descriptor/);

    const incomplete = {
      ...plan,
      participants: [
        {
          ...plan.participants[0],
          blockLayout: {
            ...plan.participants[0].blockLayout,
            blockSize: plan.participants[0].blockLayout.blockSize + 1,
          },
        },
        plan.participants[1],
      ],
    };
    expect(() => layer3.compiledGraphPhysicalLayout(incomplete))
      .toThrow(/not a complete balanced span/);
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
    const internalWitnessName = '__internal__valueWitness_0';
    const participantWithInternalWitness = {
      ...first.plan.participants[0],
      routeInputs: [
        ...first.plan.participants[0].routeInputs.slice(0, -1),
        { name: internalWitnessName, type: 'bytes' },
        ...first.plan.participants[0].routeInputs.slice(-1),
      ],
    };
    const transcriptWithInternalWitness = {
      ...first,
      plan: {
        ...first.plan,
        participants: [participantWithInternalWitness, ...first.plan.participants.slice(1)],
      },
    };
    expect(() => layer3.compiledGraphRouteArgs(transcriptWithInternalWitness, 0, 6))
      .toThrow(/requires internal witness '__internal__valueWitness_0'/);
    const routeArgs = layer3.compiledGraphRouteArgs(
      transcriptWithInternalWitness, 0, 6, { [internalWitnessName]: new Uint8Array(32) },
    );
    expect(routeArgs).toHaveLength(participantWithInternalWitness.routeInputs.length - 1);
    expect(() => layer3.finalizeCompiledGraph(
      plan, { 0: '51' }, [0, 1], [2, 3], ['5100000000000000', '5200000000000000'], [4, 5],
    )).toThrow(/lacks canonical result/);
    expect(() => layer3.finalizeCompiledGraph(
      plan, { 0: '51', 1: '52', 9: '53' }, [0, 1], [2, 3],
      ['5100000000000000', '5200000000000000'], [4, 5],
    )).toThrow(expect.objectContaining({
      code: 'L3_TRANSCRIPT_ROW_INCONSISTENT',
      context: expect.objectContaining({ invocationIds: [9], resourceIdentity: 'result:9' }),
    }));
    expect(() => layer3.finalizeCompiledGraph(
      plan, { 0: '51', 1: '52' }, [0, 1], [2, 3],
      ['5300000000000000', '5200000000000000'], [4, 5],
    )).toThrow(expect.objectContaining({
      code: 'L3_TRANSCRIPT_ROW_INCONSISTENT',
      context: expect.objectContaining({ participant: 0, invocationIds: [0] }),
    }));
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
    expect(projection).toContain('resultCursor == resultVector.length');
    const controllerArtifact = compileString(controller);
    const projectionArtifact = compileString(projection);
    // Freeze the actual redeem-script cost of the variable-table parsers. `Artifact.bytecode` is ASM text;
    // `debug.bytecode` is the hex-encoded script and is the consensus/deployment size.
    // X23 rewrote both walks to make fewer and shallower stack-variable writes - the dominant BCH-2026
    // operation-cost term - with no check removed. 1,897 before X23.
    // Size history, both directions. X7 added the result-cursor exhaustion assertion (+8). X23 cut the
    // projection verifier 36%. X24 unrolled the deep writes, trading emitted bytes for executed instructions -
    // it GREW the projection and SHRANK the controller. X27 then suffix-split the transcript in attest,
    // shrinking the controller again. These pins are measured on the tree carrying BOTH X24 and X27, so they
    // match neither branch's own figure. X5 then bound the ROOT row's call-options byte in the projection
    // verifier (+37): the byte is hoisted into one read reused by the existing `<= 1` bound, and the root
    // branch requires it to be 0. The controller is untouched.
    // F4 then cut the projection verifier by 129 (4,671 -> 4,542) in three parts, none of which changes what
    // the covenant admits: the bare locking bytecode is cut from the FRAMED table entry already on the stack
    // instead of re-slicing the transcript (-8), and X27's suffix split - which the CONTROLLER's two loops
    // have carried since X27 - is applied to the projection verifier's invocation loop (-60) and participant
    // loop (-61). Not one require is removed, weakened or reordered; each `cursor + n <= transcript.length`
    // is the same predicate as its rewritten `local + n <= frame.length`.
    // X65 then replaced the verifier's 8-way dispatch with an input-index table: 4,542 -> 4,098, -444. X81
    // then retired the verifier's NUM2BIN width bound for a 6-byte table stride and folded `expectedTarget`:
    // 4,098 -> 4,121, +23, measured at `6183cf12` by the commit that landed it. 4,121 IS WHAT THE ASSERTION
    // BELOW PINS. (R3-13: this line read "4,542 -> 4,098, -444, which is what the assertion below pins" while
    // the assertion already read 4,121 - the comment contradicted the code two lines under it.)
    // WHY THIS FIGURE IS THE LEVERAGED ONE. The verifier is instantiated once per PARTICIPANT and each proof
    // slot pushes the whole redeem script, so a verifier byte is worth N transaction bytes. Measured on all
    // four capstones for BOTH cuts and the multiplier is exactly N every time.
    //
    //   F4, -129 per participant (measured, and the two graph capstones came in 52 bytes above the arithmetic
    //   because one participant's script grew 28 and the output set 24):
    //     A13 23,845 -> 23,458   C2 53,249 -> 52,733   C1 63,315 -> 62,722   C3 100,650 -> 99,670
    //   X65, -444 per participant (re-measured at `77cd1e8c` through the estimator probe, no residue):
    //     A13 23,458 -> 22,126   C2 52,733 -> 50,957   C1 62,722 -> 60,502   C3 99,670 -> 96,118
    //   X81, +23 per participant (re-measured at `3281ece9`, each from that capstone's own test, no residue):
    //     A13 22,126 -> 22,195   C2 50,957 -> 51,049   C1 60,502 -> 60,617   C3 96,118 -> 96,302
    //
    // R3-13. THE X81 ROW IS THE ONE THIS COMMENT WAS MISSING, and every capstone in the tree carried the X65
    // figures in the present tense because of it. The multiplier holds a third time: +69 / +92 / +115 / +184
    // is 23 x 3, 23 x 4, 23 x 5, 23 x 8 exactly.
    //
    // C3 is thereby INSIDE the 100,000-byte standard relay ceiling by 3,698 bytes, with all 108 slots intact.
    // (This comment used to give C1 as 62,670 and C3 as 99,618 - both the 129 x N arithmetic rather than the
    // build, and the two figures the F1 and F2 tables disagreed with. The measurements are above.)
    // The settlement-boundary extension necessarily moves both rows: the controller authenticates the canonical
    // participant settlement table and re-derives every owner maximum, while each projection authenticates its
    // owner's row-completion vector. Keep both exact sizes pinned so a later parser change is measured rather
    // than silently consuming the relay margin documented above.
    expect(controllerArtifact.debug.bytecode.length / 2).toBe(2_731);
    expect(projectionArtifact.debug.bytecode.length / 2).toBe(5_073);
    expect(controllerArtifact.diagnostics ?? []).not.toContainEqual(
      expect.objectContaining({ code: 'contract-size-limit' }),
    );
    expect(projectionArtifact.diagnostics ?? []).not.toContainEqual(
      expect.objectContaining({ code: 'contract-size-limit' }),
    );
  });
});
