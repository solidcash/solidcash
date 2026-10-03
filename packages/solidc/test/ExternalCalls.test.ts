import { describe, it, expect } from 'vitest';
import { PrimitiveType } from '@solidcash/utils';
import {
  ArrayAssignNode, BinaryOpNode, BlockNode, ExternalFunctionCallNode, IdentifierNode, IntLiteralNode,
  NewArrayNode, ReturnNode, VariableDefinitionNode, WhileNode,
} from '../src/ast/AST.js';
import { BinaryOperator } from '../src/ast/Operator.js';
import { resultArrayOutputOf } from '../src/artifact/Artifact.js';
import { Symbol } from '../src/ast/SymbolTable.js';
import { hasEffectiveCallValue } from '../src/semantic/branchOps.js';
import { compileString } from './direct-compile.js';
import { compileString as compileMessageBus } from '../dist/compiler.js';

describe('returned external-call loop metadata', () => {
  const makeBody = (step = 1n, competingWrite = false, allocationBound = 'count'): {
    target: ExternalFunctionCallNode; body: BlockNode;
  } => {
    const target = new ExternalFunctionCallNode(
      'IData', new IdentifierNode('data'), 'get', [new IdentifierNode('i')],
    );
    const result = new VariableDefinitionNode(
      PrimitiveType.INT, [], 'result',
      new NewArrayNode(PrimitiveType.INT, new IdentifierNode(allocationBound)),
    );
    const index = new VariableDefinitionNode(PrimitiveType.INT, [], 'i', new IntLiteralNode(0n));
    index.isLoopVariable = true;
    index.loopInitialValue = 0n;
    index.loopStepValue = step;
    const statements = [new ArrayAssignNode('result', new IdentifierNode('i'), target)];
    if (competingWrite) {
      statements.push(new ArrayAssignNode('result', new IdentifierNode('i'), new IntLiteralNode(0n)));
    }
    const loop = new WhileNode(
      new BinaryOpNode(new IdentifierNode('i'), BinaryOperator.LT, new IdentifierNode('count')),
      new BlockNode(statements),
    );
    return {
      target,
      body: new BlockNode([result, index, loop, new ReturnNode([new IdentifierNode('result')])]),
    };
  };

  it('marks only a complete canonical map into the returned array', () => {
    const canonical = makeBody();
    expect(resultArrayOutputOf(canonical.body, canonical.target)).toBe(0);

    const skippedIndices = makeBody(2n);
    expect(resultArrayOutputOf(skippedIndices.body, skippedIndices.target)).toBeUndefined();

    const competingWrite = makeBody(1n, true);
    expect(resultArrayOutputOf(competingWrite.body, competingWrite.target)).toBeUndefined();

    const mismatchedLength = makeBody(1n, false, 'otherCount');
    expect(resultArrayOutputOf(mismatchedLength.body, mismatchedLength.target)).toBeUndefined();
  });

  it('publishes each semantic aggregate loop callsite exactly once', () => {
    const source = `pragma solidity ^0.8.19;
      struct Pair { uint left; address right; }

      interface ISource {
        function size() external view returns (uint);
        function read(uint index) external view returns (Pair memory);
      }

      contract Collector {
        ISource source;

        constructor(ISource source_) {
          source = source_;
        }

        function collect(uint offset) public view returns (Pair[] memory) {
          uint length = source.size() - offset;
          Pair[] memory output = new Pair[](length);
          for (uint index = 0; index < length; index++) {
            output[index] = source.read(index + offset);
          }
          return output;
        }
      }
    `;
    const compileAt = (messageBusKernel: boolean): ReturnType<typeof compileMessageBus> => compileMessageBus(source, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      messageBusKernel,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: false,
      suppressWarnings: true,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
    });

    const kernel = compileAt(true);
    const legacy = compileAt(false);
    expect(kernel.messageBus?.convention).toBe('kernel-row-loop');
    expect(legacy.messageBus?.convention).toBe('legacy-unroll');

    for (const artifact of [kernel, legacy]) {
      const calls = artifact.abi.find((entry) => entry.name === 'collect')?.externalCalls ?? [];
      expect(calls.map(({ callsiteId, functionName }) => ({ callsiteId, functionName }))).toEqual([
        { callsiteId: 0, functionName: 'size' },
        { callsiteId: 1, functionName: 'read' },
      ]);
      expect(new Set(calls.map(({ callsiteId }) => callsiteId)).size).toBe(calls.length);
      expect(calls.filter(({ functionName }) => functionName === 'read')).toHaveLength(1);
      expect(calls[1]).toMatchObject({ occurrence: 'loop', resultArrayOutput: 0 });
    }
  });

  it('does not clone an effectful producer to derive a constructed collection key', () => {
    const artifact = compileMessageBus(`
      interface ISource { function keyAt(uint index) external view returns (uint); }
      contract Registry(ISource source) {
        mapping(uint => uint) records;

        function apply(uint count) public {
          uint[] memory keys = new uint[](count);
          for (uint producer = 0; producer < count; producer++) {
            keys[producer] = source.keyAt(producer);
          }
          for (uint consumer = 0; consumer < count; consumer++) {
            this.records[keys[consumer]] = consumer;
          }
          require(true);
        }

        function control() public { require(true); }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: false,
      suppressWarnings: true,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
    });
    const calls = artifact.abi.find((entry) => entry.name === 'apply')?.externalCalls ?? [];
    expect(calls.map(({ callsiteId, functionName }) => ({ callsiteId, functionName }))).toEqual([
      { callsiteId: 0, functionName: 'keyAt' },
    ]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });
});

// External and low-level calls: interface-typed targets, call{value}, transfer/send, and their receivers.

describe('Low-level call options + tuple-slot modifiers + value units', () => {
  it('does not emit a single-return uniqueness pin when a loop also returns from the same callee', () => {
    const iface = 'interface IData {'
      + ' function registered(address a) external returns (bool);'
      + ' function tagAt(int i) external returns (string);'
      + '}';
    const unique = compileMessageBus(
      `${iface} contract C(IData data) {`
      + '  function f(address arb) { require(data.registered(arb)); }'
      + '}',
    );
    const withLoop = compileMessageBus(
      `${iface} contract C(IData data) {`
      + '  function f(address arb, int n) {'
      + '    require(data.registered(arb));'
      + '    for (int i = 0; i < n; i = i + 1) { string t = data.tagAt(i); require(t.length > 0); }'
      + '  }'
      + '}',
    );
    // emitSingleReturnEventUniqueness: count outputs with category==B and LBC==OP_TRUE, then == 1.
    const uniquenessPin = 'OP_OUTPUTTOKENCATEGORY OP_3 OP_PICK OP_EQUAL OP_IF OP_DUP OP_OUTPUTBYTECODE';
    expect(unique.bytecode).toContain(uniquenessPin);
    expect(withLoop.bytecode).not.toContain(uniquenessPin);
  });

  it('solidityImportCompat .call(data) compiles a presence pin for the callee input', () => {
    const artifact = compileString(
      'contract C() { int n; function f(address to, bytes data) {'
      + ' (bool ok, bytes res) = to.call(data); require(ok); this.n = res.length; } }',
      { solidityImportCompat: true },
    );
    expect(artifact.contractName).toBe('C');
    expect(artifact.abi.some((fn) => fn.name === 'f')).toBe(true);
  });

  it('supports the {value:} call option on a low-level call', () => {
    const a = compileString('contract C() { int n; function f(address to, bytes data, int v) { (bool ok, bytes res) = to.call{value: v}(data); require(ok); this.n = res.length; } }');
    expect(a.contractName).toBe('C');
  });

  it('supports a data-location modifier in a tuple slot', () => {
    const a = compileString('contract C() { int n; function f(address to, bytes data) { (bool ok, bytes memory res) = to.call(data); require(ok); this.n = res.length; } }');
    expect(a.contractName).toBe('C');
  });

  it.each([
    ['ether', 'this.n = 1 ether;'],
    ['gwei', 'this.n = 2 gwei;'],
    ['wei', 'this.n = 100 wei;'],
  ])('accepts the %s value unit', (_l, body) => {
    expect(compileString(`contract C() { int n; function f() { ${body} } }`).contractName).toBe('C');
  });
});

describe('state-backed external-call expected address', () => {
  const IFACE = 'interface IData { function ping() external; }';
  it('publishes the declared type for an imported-style struct constructor argument', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Packet { uint256 code; bytes payload; }
      interface IData { function put(Packet value) external; }
      contract C {
        IData data;
        function forward(uint256 code, bytes payload) public {
          data.put(Packet(code, payload));
          require(true);
        }
      }
    `, { solidityImportCompat: true, forceStateful: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'forward')
      ?.externalCalls?.[0]?.argSources?.[0]).toMatchObject({
      kind: 'expression',
      expression: { kind: 'call', name: 'Packet', type: 'Packet' },
    });
  });

  it('publishes an explicit empty argument-source list for zero-argument calls', () => {
    const artifact = compileString(`${IFACE}
      contract C(IData data) {
        function f(sig s, pubkey pk) { data.ping(); require(checkSig(s, pk)); }
      }`);
    expect(artifact.abi.find((candidate) => candidate.name === 'f')?.externalCalls?.[0]?.argSources)
      .toEqual([]);
  });

  it('publishes the live arithmetic progression for a loop-dependent argument', () => {
    const artifact = compileString(`
      interface IData { function touch(uint index) external; }
      contract C(IData data) {
        function values(uint start, uint count) public {
          for (uint i = 0; i < count; i = i + 1) {
            data.touch(start + i);
          }
          require(true);
        }
      }
    `, { solidityImportCompat: true });
    const call = artifact.abi.find((candidate) => candidate.name === 'values')?.externalCalls?.[0];
    expect(call?.occurrence).toBe('loop');
    expect(call?.argSources).toEqual([{
      kind: 'expression',
      expression: {
        kind: 'binary', operator: '+',
        left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
        right: {
          kind: 'source',
          source: { kind: 'loopIndex', initialValue: '0', stepValue: '1' },
        },
      },
    }]);
  });

  it('re-reads an interface-typed state var at the epilogue instead of a HASH160 PICK', () => {
    const artifact = compileString(`${IFACE}
      contract C() {
        IData public data;
        function set(IData d) { this.data = d; }
        function f(sig s, pubkey pk) { data.ping(); require(checkSig(s, pk)); }
      }`);
    const fn = artifact.abi.find((candidate) => candidate.name === 'f');
    expect(fn?.externalCalls?.[0]?.addressStateVar).toBe('data');
    expect(fn?.externalCalls?.[0]?.addressParam).toBe('__extaddr_data');
    // The 20-byte identity path projects the co-spent master's locking bytecode; the empty legacy sentinel
    // duplicates that already-authenticated bytecode. Neither path copies an unrelated master/anchor index.
    const bytecode = artifact.bytecode.replace(/\s+/g, '');
    expect(bytecode).toContain('01149c637c82008763');
    expect(bytecode).toContain('77009c63757668');
  });
});

describe('state-field arguments after sibling writes', () => {
  it('retains the state read after a storage-pointer partial struct update', () => {
    const artifact = compileString(`
      struct Roles { address creator; address arbitrator; address worker; }
      struct Job { Roles roles; uint state; }
      interface IFee { function getFee(address arbitrator) external view returns (uint); }
      contract C(IFee feeContract) {
        Job[] jobs;
        function pay(uint id, address worker) public {
          Job storage job = jobs[id];
          job.state = 1;
          job.roles.worker = worker;
          feeContract.getFee(job.roles.arbitrator);
          require(true);
        }
      }
    `, { solidityImportCompat: true, forceStateful: true });
    const call = artifact.abi.find((candidate) => candidate.name === 'pay')?.externalCalls
      ?.find((candidate) => candidate.functionName === 'getFee');
    const source = JSON.stringify(call?.argSources);
    expect(source).toContain('"name":"jobs"');
    expect(source).toContain('"name":"arbitrator"');
    expect(source).not.toContain('"kind":"reference"');
    expect(source).not.toContain('"kind":"unsupported"');
  });
});

describe('unlocking selector extract', () => {
  it('takes the first 4-byte script push, not a 0x04 prefix plus three selector bytes', () => {
    const artifact = compileString(
      'interface IData { function ping() external; function pong() external; }'
      + ' contract C(IData data) {'
      + '   function f(sig s, pubkey pk) { data.ping(); require(checkSig(s, pk)); }'
      + ' }',
    );
    const compact = artifact.bytecode.replace(/\s+/g, '');
    // After INPUTBYTECODE, consume the first script push and keep it only when
    // SIZE == 4. DROP leftover so the compared value is the 4-byte payload,
    // not the 0x04 prefix plus three selector bytes.
    expect(compact).toContain('OP_INPUTBYTECODEOP_1OP_SPLITOP_SWAP');
    expect(compact).toContain('OP_OVEROP_SIZEOP_NIPOP_4OP_NUMEQUALOP_IFOP_DROP');
  });
});

describe('external-call witness frame access', () => {
  it('captures logical-identity anchors by stable bottom ordinal', () => {
    const artifact = compileString(
      'interface IA { function ping() external; }'
      + ' interface IB { function pong() external; }'
      + ' contract C(IA a, IB b) {'
      + '   function f(sig s, pubkey pk) { a.ping(); b.pong(); require(checkSig(s, pk)); }'
      + ' }',
    );
    const fn = artifact.abi.find((candidate) => candidate.name === 'f');
    expect(fn?.inputs.some((input) => input.name === '__internal__extcallAnchorIdx0')).toBe(true);
    expect(fn?.inputs.some((input) => input.name === '__internal__extcallAnchorIdx1')).toBe(true);
    const compact = artifact.bytecode.replace(/\s+/g, '');
    // OP_DEPTH - bottom ordinal - OP_SUB - OP_PICK is immune to untracked epilogue working values. The captured
    // anchor is parked on the alt stack before address normalization grows the main stack further.
    expect(compact).toMatch(/OP_DEPTH(?:OP_[A-Z0-9]+|[0-9a-f]+)OP_SUBOP_PICKOP_TOALTSTACK/);
  });
});

describe('address.code with an authenticated external-call slot', () => {
  it('checks the requested address before using the authenticated slot as a code marker', () => {
    const artifact = compileMessageBus(
      'interface IERC20 { function balanceOf(address a) external returns (int); }'
      + ' contract C() { function f(address token) {'
      + ' require(token.code.length > 0 && IERC20(token).balanceOf(msg.sender) > 0, "invalid token");'
      + ' require(true); } }',
    );
    expect(artifact.abi.find((candidate) => candidate.name === 'f')?.externalCalls?.[0]?.addressParam)
      .toBe('token');
    expect(artifact.abi.find((candidate) => candidate.name === 'f')?.externalCalls?.[0]?.condition)
      .toEqual({
        kind: 'binary', operator: '>',
        left: {
          kind: 'addressCodeLength',
          expression: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
          type: 'bigint',
        },
        right: { kind: 'literal', type: 'bigint', value: '0' },
      });
    // Preserve address(0) as empty `.code`; only a non-empty address may select the authenticated slot marker.
    expect(artifact.bytecode).toContain('OP_DUP OP_SIZE OP_0 OP_NUMEQUAL OP_IF OP_ELSE OP_DROP');
  });
});

describe('inactive conditional external-call identity', () => {
  const IFACE = 'interface IERC20 { function transfer(address t, int a) external returns (bool); }';
  it('preserves an outer parameter predicate through an inlined public helper call', () => {
    const artifact = compileString(`pragma solidity ^0.8.19;
      interface IData {
        function updateUserRating(address worker, uint8 rating) external;
      }
      contract C {
        IData data;
        mapping(uint => uint8) ratings;
        function review(uint jobId, address worker, uint8 rating) public {
          ratings[jobId] = rating;
          data.updateUserRating(worker, rating);
          require(true);
        }
        function approveResult(uint jobId, address worker, uint8 rating) public {
          // The caller's rating guards this call, while the helper's same-named parameter receives a literal.
          if (rating > 0) { review(jobId, worker, uint8(5)); }
          require(true);
        }
      }
    `, { solidityImportCompat: true, messageBus: true });
    const calls = artifact.abi.find((candidate) => candidate.name === 'approveResult')?.externalCalls ?? [];
    expect(calls.map((call) => call.functionName)).toEqual(['updateUserRating']);
    expect(calls[0].condition).toEqual({
      kind: 'binary', operator: '>',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
      right: { kind: 'literal', type: 'bigint', value: '0' },
    });
  });
  it('skips UTXOBYTECODE identity when the SDK binds masterIdx < 0', () => {
    const artifact = compileString(`${IFACE}
      contract C(IERC20 token) {
        int n;
        function f(bool pay, address to, sig s, pubkey pk) {
          if (pay) { bool ok = token.transfer(to, 1); require(ok); }
          this.n = 1;
          require(checkSig(s, pk));
        }
      }`);
    const fn = artifact.abi.find((candidate) => candidate.name === 'f');
    expect(fn?.externalCalls?.[0]?.occurrence).toBe('conditional');
    expect(fn?.externalCalls?.[0]?.condition).toEqual({
      kind: 'source',
      source: { kind: 'forward', paramIndex: 0 },
    });
    const published = JSON.parse(JSON.stringify(artifact)) as typeof artifact;
    expect(published.abi.find((candidate) => candidate.name === 'f')?.externalCalls?.[0]?.condition)
      .toEqual(fn?.externalCalls?.[0]?.condition);
    expect(artifact.bytecode).toContain('OP_0 OP_LESSTHAN OP_IF OP_DROP OP_ELSE');
  });

  it('publishes nested else predicates without contract-specific branch knowledge', () => {
    const artifact = compileString(`${IFACE}
      interface ISecond { function transfer(address t, int a) external returns (bool); }
      contract C(IERC20 first, ISecond second) {
        function f(bool enabled, bool primary, address to, sig s, pubkey pk) {
          if (enabled) {
            if (primary) { bool a = first.transfer(to, 1); require(a); }
            else { bool b = second.transfer(to, 2); require(b); }
          }
          require(checkSig(s, pk));
        }
      }`);
    const calls = artifact.abi.find((candidate) => candidate.name === 'f')?.externalCalls ?? [];
    expect(calls).toHaveLength(2);
    expect(calls[0].condition).toMatchObject({ kind: 'binary', operator: '&&' });
    expect(calls[1].condition).toMatchObject({
      kind: 'binary',
      operator: '&&',
      right: { kind: 'unary', operator: '!' },
    });
  });

  it('publishes a replayable ABI-decoded branch predicate', () => {
    const artifact = compileString(`${IFACE}
      contract C(IERC20 token) {
        function f(address to, sig s, pubkey pk) {
          bytes memory encoded = hex"01";
          if (abi.decode(encoded, (bool))) { bool sent = token.transfer(to, 2); require(sent); }
          require(checkSig(s, pk));
        }
      }`, { messageBus: true });
    const calls = artifact.abi.find((candidate) => candidate.name === 'f')?.externalCalls ?? [];
    expect(calls).toHaveLength(1);
    expect(calls[0].condition).toEqual({
      kind: 'abiDecode',
      expression: { kind: 'literal', type: 'bytes1', value: '01' },
      fields: ['bool'],
    });
  });
});

describe('SBE-6: external calls on interface-typed variables (EVM parity)', () => {
  const IFACE = 'interface IERC20 { function transferFrom(address f, address t, int a) external returns (bool); }';
  it('routes a method call on an interface-typed state var to an external call', () => {
    const a = compileString(`${IFACE}
      contract C(IERC20 token) {
        function f(address from, address to, sig s, pubkey pk) {
          bool ok = token.transferFrom(from, to, 5);
          require(checkSig(s, pk));
        }
      }`);
    expect(a.contractName).toBe('C');
  });
  it('routes a method call on an interface-typed local (IFoo x = IFoo(addr))', () => {
    const a = compileString(`interface IFoo { function bar(int x) external returns (int); }
      contract C() {
        function f(address a, sig s, pubkey pk) { IFoo foo = IFoo(a); int r = foo.bar(5); require(checkSig(s, pk)); }
      }`);
    expect(a.contractName).toBe('C');
  });
  it('routes a method call on an interface-typed parameter', () => {
    const a = compileString(`interface IFoo { function bar(int x) external returns (int); }
      contract C() { function f(IFoo foo, sig s, pubkey pk) { int r = foo.bar(5); require(checkSig(s, pk)); } }`);
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-7: ether-send via low-level call{value:}', () => {
  it('does not allocate a BCH transfer output for a literal zero value', () => {
    const artifact = compileString(
      'contract C() { function f(address dst, bytes data) { '
      + '(bool ok, bytes ret) = dst.call{value: 0}(data); require(ok || ret.length >= 0); } }',
    );
    const fn = artifact.abi.find((entry) => entry.name === 'f')!;
    expect(fn.transferCount).toBeUndefined();
    expect(fn.blockLayout?.slots.some((slot) => slot.kind === 'transfer') ?? false).toBe(false);
  });

  it('does not allocate a BCH transfer output for zero passed through an inlined helper', () => {
    const artifact = compileString(
      'function invoke(address dst, bytes data, int value) returns (bytes) { '
      + '(bool ok, bytes ret) = dst.call{value: value}(data); require(ok); return ret; } '
      + 'contract C() { int n; function f(address dst, bytes data) { '
      + 'bytes ret = invoke(dst, data, 0); this.n = ret.length; } }',
      { solidityImportCompat: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'f')!;
    expect(fn.transferCount).toBeUndefined();
    expect(fn.blockLayout?.slots.some((slot) => slot.kind === 'transfer') ?? false).toBe(false);
  });

  it('follows zero through multiple inlined helper aliases', () => {
    const artifact = compileString(
      'function invoke(address dst, bytes data, int value) returns (bytes) { '
      + '(bool ok, bytes ret) = dst.call{value: value}(data); require(ok); return ret; } '
      + 'function relay(address dst, bytes data, int value) returns (bytes) { '
      + 'return invoke(dst, data, value); } '
      + 'function safeRelay(address dst, bytes data) returns (bytes) { '
      + 'return relay(dst, data, 0); } '
      + 'contract C() { int n; function f(address dst, bytes data) { '
      + 'bytes ret = safeRelay(dst, data); this.n = ret.length; } }',
      { solidityImportCompat: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'f')!;
    expect(fn.transferCount).toBeUndefined();
    expect(fn.blockLayout?.slots.some((slot) => slot.kind === 'transfer') ?? false).toBe(false);
  });

  it('does not infer a mutable user local from its zero initializer', () => {
    const definition = new VariableDefinitionNode(
      PrimitiveType.BIGINT, [], 'value', new IntLiteralNode(0n),
    );
    const value = new IdentifierNode('value');
    value.definition = Symbol.variable(definition);
    expect(hasEffectiveCallValue(value)).toBe(true);
  });

  it('addr.call{value:}(data) on an address variable', () => {
    const a = compileString('contract C() { function f(address dst, sig s, pubkey pk) { (bool ok, bytes d) = dst.call{value: 100}(0x); require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
  it('msg.sender.call{value:}(data)', () => {
    const a = compileString('contract C() { function f(sig s, pubkey pk) { (bool ok, bytes d) = msg.sender.call{value: 100}(0x); require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-8: stateless value-send (transfer/send) compiles (no stateful block required)', () => {
  it('compiles address.transfer() in a stateless contract (output verified at an absolute index)', () => {
    const a = compileString('contract C() { function f(address payable dst, sig s, pubkey pk) { dst.transfer(100); require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
  it('compiles address.send() in a stateless contract', () => {
    const a = compileString('contract C() { function f(address payable dst, sig s, pubkey pk) { bool ok = dst.send(100); require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
  it('still allows address.transfer() in a stateful contract', () => {
    const a = compileString('contract C() { int n; function f(address payable dst, sig s, pubkey pk) { dst.transfer(100); this.n = 1; require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-13: void external-call helpers are inlined at internal call sites (SafeERC20 pattern)', () => {
  const IFACE = 'interface IERC20 { function transferFrom(address f, address t, int a) external returns (bool); }';
  it('inlines a helper called twice; each inline collects its own external call', () => {
    const a = compileString(`${IFACE}
      contract C(IERC20 token1, IERC20 token2) {
        int n;
        function _safe(IERC20 t, address f, address r, int v) internal {
          bool sent = t.transferFrom(f, r, v); require(sent);
        }
        function go(address f, address r, sig s, pubkey pk) {
          require(checkSig(s, pk));
          _safe(token1, f, r, 5);
          _safe(token2, r, f, 7);
          this.n = 1;
        }
      }`);
    // Two internal calls -> two inlined transferFrom external calls in `go` (the helper's `sent` local is
    // alpha-renamed per inline, so the two copies do not collide).
    const go = a.abi.find((f) => f.name === 'go');
    expect(go?.externalCalls?.length).toBe(2);
    expect(go?.externalCalls?.every((c) => c.functionName === 'transferFrom')).toBe(true);
  });
});

// A value-returning internal/library helper whose body performs a low-level call injects a synthetic
// __internal__callInputIndex covenant param (supplied only at the top-level entry), so calling it as a
// subroutine used to fail with a phantom arg-count mismatch. It is now inlined at direct call sites.
describe('value-returning low-level-call helpers are inlined at direct call sites', () => {
  const LIB = 'library L { function fwd(address a, bytes d) internal returns (bytes) {'
    + ' (bool ok, bytes r) = a.call(d); require(ok); return r; } }';
  it('a direct call to a bytes-returning helper doing a low-level call compiles', () => {
    const a = compileString(`${LIB} contract C() {`
      + ' function f(address x, bytes d) returns (bytes) { return L.fwd(x, d); } }');
    expect(a.contractName).toBe('C');
  });
  it('the inlined low-level-call co-spend covenant is byte-identical to the hand-written form', () => {
    const inlined = compileString(`${LIB} contract C() {`
      + ' function f(address x, bytes d) returns (bytes) { return L.fwd(x, d); } }',
    { messageBus: false }).bytecode.split(' ');
    const hand = compileString('contract C() { function f(address x, bytes d) returns (bytes) {'
      + ' (bool ok, bytes r) = x.call(d); require(ok); return r; } }',
    { messageBus: false }).bytecode.split(' ');
    // Inlining adds a benign param-copy at the front; the entire co-spend covenant tail must be identical.
    expect(inlined.slice(-150).join(' ')).toBe(hand.slice(-150).join(' '));
  });
  it('inlines the same helper reached via `using L for address` on a cast receiver (address(x).fwd(d))', () => {
    const a = compileString(`${LIB} contract C() { using L for address;`
      + ' function f(address x, bytes d) returns (bytes) { return address(x).fwd(d); } }');
    expect(a.contractName).toBe('C');
  });

  // A wrapper that only CALLS another low-level-call helper is transitively tainted and must inline too, else it
  // stays a subroutine calling a callee that needs the synthetic covenant param it never forwards.
  it('inlines a TRANSITIVE chain (wrapper -> low-level-call helper)', () => {
    const src = 'function llCall(address a, bytes d) view returns (bytes) {'
      + ' (bool ok, bytes ret) = a.call(d); require(ok); return ret; }'
      + ' function llWrap(address a, bytes d) view returns (bytes) { return llCall(a, d); }'
      + ' contract C { int n; function f(address t, bytes d) public {'
      + ' bytes out = llWrap(t, d); this.n = int(out.length); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('inlines a multi-return wrapper which directly forwards an external call', () => {
    const src = 'interface IVault { function deposit(uint a) external returns (uint, uint); }'
      + ' contract C { uint n; function wrap(IVault v, uint a) internal returns (uint, uint) {'
      + ' return v.deposit(a); } function f(IVault v, uint a) public {'
      + ' (uint x, uint y) = wrap(v, a); this.n = x + y; require(this.n >= x); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('lowers a recursive external-call helper and binds its loop-local returned target', () => {
    const src = 'interface P { function swap(uint x) external; }'
      + ' interface F { function pair(address a) external returns (P); }'
      + ' contract C(F factory) { uint total;'
      + ' function step(address a, uint n) internal returns (uint result) {'
      + ' P p = factory.pair(a); p.swap(n);'
      + ' if (n == 0) result = n; else result = step(a, n - 1); }'
      + ' function run(address a, uint n) public {'
      + ' total = step(a, n); require(true); } }';
    const artifact = compileString(src, { solidityImportCompat: true, messageBus: false });
    const run = artifact.abi.find((entry) => entry.name === 'run');
    expect(run?.externalCalls?.map((call) => call.functionName)).toEqual(['pair', 'swap']);
    expect(run?.inputs.some((input) => input.name.startsWith('__internal__loopTargets'))).toBe(true);
  });

  it('rewrites a cast receiver introduced by nested helpers inside a lowered tail loop', () => {
    const src = 'interface T { function move(uint x) external; }'
      + ' library Safe { function sendSafe(T token, uint x) internal { token.move(x); } }'
      + ' contract C { uint total;'
      + ' function swap(address token, uint x) private returns (uint out) {'
      + ' Safe.sendSafe(T(token), x); out = x; }'
      + ' function step(address token, uint n) private returns (uint result) {'
      + ' uint out = swap(token, n);'
      + ' if (n == 0) result = out; else result = step(token, n - 1); }'
      + ' function run(address token, uint n) public {'
      + ' total = step(token, n); require(true); } }';
    const artifact = compileString(src, { solidityImportCompat: true, messageBus: false });
    const run = artifact.abi.find((entry) => entry.name === 'run');
    expect(run?.externalCalls?.map((call) => call.functionName)).toEqual(['move']);
    expect(run?.externalCalls?.[0].addressSource).toEqual({ kind: 'forward', paramIndex: 0 });
    // Tail recursion changes n, but not token. The nested cast/library boundary must preserve that provenance
    // instead of allocating a runtime target table for a receiver which is invariant across every iteration.
    expect(run?.inputs.some((input) => input.name.startsWith('__internal__loopTargets'))).toBe(false);
  });

  // Overloaded chain call/2 -> call/3: name-keyed resolution can't tell them apart, so this exercises the
  // arity-keyed overload lookup + recursion stack, and the {value: value} option's param alpha-rename.
  it('resolves overloads in a chain (call/2 -> call/3 with a {value:} low-level call)', () => {
    const src = 'function llCall(address a, bytes d) view returns (bytes) { return llCall(a, d, 0); }'
      + ' function llCall(address a, bytes d, int value) view returns (bytes) {'
      + ' (bool ok, bytes ret) = a.call{value: value}(d); require(ok); return ret; }'
      + ' contract C { int n; function f(address t, bytes d) public {'
      + ' bytes out = llCall(t, d); this.n = int(out.length); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  // Same-library sibling calls are written unqualified (`fwd(a,d,0)` inside library V's other `fwd`); they must be
  // qualified to `V.fwd` so the chain resolves + inlines (else the wrapper stays a subroutine -> phantom param).
  it('inlines a same-library overloaded chain called via a qualified library name (V.fwd)', () => {
    const src = 'library V { function fwd(address a, bytes d) internal returns (bytes) { return fwd(a, d, 0); }'
      + ' function fwd(address a, bytes d, int value) internal returns (bytes) {'
      + ' (bool ok, bytes ret) = a.call{value: value}(d); require(ok); return ret; } }'
      + ' contract C { int n; function f(address t, bytes d) public {'
      + ' bytes out = V.fwd(t, d); this.n = int(out.length); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  // Full SafeERC20 shape: a VOID library wrapper -> a value-returning library chain -> a {value:} low-level call.
  // The void wrapper inlines (InlineExternalCallHelpers) bubbling the value chain into the entry point, where the
  // returning-helper inliner flattens it to the direct low-level call. Two helpers share `ok`/`ret` tuple names,
  // exercising the tuple-slot alpha-rename.
  it('inlines a void wrapper -> value chain -> low-level call end to end (SafeERC20 shape)', () => {
    const src = 'library Address { function functionCall(address t, bytes d) internal returns (bytes) {'
      + ' return functionCallWithValue(t, d, 0); }'
      + ' function functionCallWithValue(address t, bytes d, int v) internal returns (bytes) {'
      + ' (bool ok, bytes ret) = t.call{value: v}(d); require(ok); return ret; } }'
      + ' library Safe { function xfer(address token, bytes data) internal { Address.functionCall(token, data); }'
      + ' function tryXfer(address token, bytes data) internal returns (bool) {'
      + ' (bool ok, bytes ret) = token.call(data); return ok; }'
      + ' function force(address token, bytes data) internal { if (!tryXfer(token, data)) { require(false); } } }'
      + ' contract C { int n; function f(address t, bytes d) public { Safe.xfer(t, d); Safe.force(t, d); this.n = 1; } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  // The exact OZ SafeERC20 shape: a void wrapper calls the value chain via the using-for `address(x).method()`
  // form (not a plain `L.method(x)`), where the library-level `using Address for address` lands on the file.
  it('inlines a void wrapper using the `address(token).functionCall(data)` using-for form', () => {
    const src = 'library Address {'
      + ' function functionCall(address t, bytes d) internal returns (bytes) { return functionCallWithValue(t, d, 0); }'
      + ' function functionCallWithValue(address t, bytes d, int v) internal returns (bytes) {'
      + ' (bool ok, bytes ret) = t.call{value: v}(d); require(ok); return ret; } }'
      + ' library Safe { using Address for address;'
      + ' function xfer(address token, bytes data) internal { address(token).functionCall(data); } }'
      + ' contract C { int n; function f(address t, bytes d) public { Safe.xfer(t, d); this.n = 1; } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('publishes an inlined returning raw call as a decoded graph edge', () => {
    const src = 'interface IERC20 { function transferFrom(address f, address t, uint256 v) external returns (bool); }'
      + ' library Address { function functionCall(address t, bytes d) internal returns (bytes) {'
      + ' return functionCallWithValue(t, d, 0); }'
      + ' function functionCallWithValue(address t, bytes d, uint256 v) internal returns (bytes) {'
      + ' (bool ok, bytes ret) = t.call{value: v}(d); require(ok); return ret; } }'
      + ' library Safe { using Address for address;'
      + ' function xfer(IERC20 token, address f, address t, uint256 v) internal {'
      + ' bytes memory ret = address(token).functionCall('
      + ' abi.encodeWithSelector(token.transferFrom.selector, f, t, v));'
      + ' require(ret.length >= 0); } }'
      + ' contract C { uint256 n; function f(IERC20 token, address from, address to, uint256 value) public {'
      + ' Safe.xfer(token, from, to, value); this.n = value; require(true); } }';
    const artifact = compileString(src, {
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    const fn = artifact.abi.find((candidate) => candidate.name === 'f');
    expect(fn?.lowLevelCalls).toBeUndefined();
    expect(fn?.externalCalls).toEqual([
      expect.objectContaining({
        interfaceName: '__raw__',
        functionName: '__raw__',
        opaqueReturn: true,
        rawSelector: expect.stringMatching(/^[0-9a-f]{8}$/),
        rawArgSources: expect.arrayContaining([
          expect.objectContaining({ kind: 'forward' }),
        ]),
      }),
    ]);
  });

  it('publishes the typed selector for abi.encodeCall graph arguments derived from address(this)', () => {
    const src = 'interface ITarget { function approve(address spender, uint256 value) external returns (bool); }'
      + ' library Raw { function call(address target, bytes memory payload) internal returns (bytes) {'
      + ' (bool ok, bytes memory result) = target.call(payload); require(ok); return result; } }'
      + ' contract C { uint256 marker; function run(address target, uint256 value) public {'
      + ' Raw.call(target, abi.encodeCall(ITarget.approve, (address(this), value)));'
      + ' this.marker = 1; require(true); } }';
    const artifact = compileString(src, {
      solidityImportCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
    });
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run')?.eligible).toBe(true);
    const call = artifact.abi.find((candidate) => candidate.name === 'run')?.externalCalls?.[0];
    expect(call).toEqual(expect.objectContaining({
      interfaceName: '__raw__',
      functionName: '__raw__',
      rawFunctionName: 'approve',
      rawSelector: '9f0bb8a9',
      rawArgSources: [
        expect.objectContaining({ kind: 'selfAddress' }),
        expect.objectContaining({ kind: 'forward' }),
      ],
    }));
  });

  // Inlining the SAME low-level-call helper through two paths (`fcv` directly and via `fcv2`) must not collide:
  // cloneNode shares plain-object `elements`/`callOptions` across clones, so an in-place rename would stomp the
  // other frame's `(bool ok, bytes ret)` slot or `{value: v}` option (dangling `__rhN_ok`/`__rhN_v`).
  it('inlines the same low-level-call helper via two paths without a shared-clone rename collision', () => {
    const src = 'function verify(address t, bool ok, bytes ret) view returns (bytes) {'
      + ' if (ok) { return ret; } require(false); return ret; }'
      + ' function fcv(address t, bytes d, int v) view returns (bytes) {'
      + ' (bool ok, bytes ret) = t.call{value: v}(d); return verify(t, ok, ret); }'
      + ' function fcv2(address t, bytes d) view returns (bytes) { return fcv(t, d, 0); }'
      + ' contract C { int n; function f(address t, bytes d) public {'
      + ' bytes a = fcv(t, d, 0); bytes b = fcv2(t, d); this.n = int(a.length + b.length); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  // A void wrapper that discards a value-chain call's result: the wrapper inlines, the discarded value call is
  // then inlined at its statement position, and the chain flattens. Must compile - never a dangling reference.
  it('inlines a void wrapper that discards a value-returning low-level-call helper result', () => {
    const src = 'function llCall(address a, bytes d) view returns (bytes) {'
      + ' (bool ok, bytes ret) = a.call(d); require(ok); return ret; }'
      + ' function vwrap(address a, bytes d) view { llCall(a, d); }'
      + ' contract C { int n; function f(address t, bytes d) public { vwrap(t, d); this.n = 1; } }';
    let msg = '';
    try { compileString(src, { solidityImportCompat: true }); } catch (e) { msg = (e as Error).message; }
    expect(msg).not.toMatch(/Undefined reference/);
    expect(msg).toBe('');
  });
});

describe('external call on a tuple-destructured / copied local interface var', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const ccBus = (src: string): string => compileMessageBus(src, { solidityImportCompat: true }).contractName;
  const iface = 'interface IERC20 { function transferFrom(address f, address t, uint256 a) external returns (bool);'
    + ' function balanceOf(address o) external view returns (uint256); function transfer(address t, uint256 a) external returns (bool); }';

  it('routes a method call on a tuple-destructured interface var to an external call', () => {
    expect(cc(`${iface} contract C { IERC20 token0; IERC20 token1;`
      + ' function swap(uint256 amt) public { (IERC20 tokenIn, IERC20 tokenOut) = (token0, token1);'
      + ' tokenIn.transferFrom(msg.sender, address(this), amt); require(true); } }')).toBe('C');
  });

  it('routes a method call on a tuple-ternary-destructured interface var (CSAMM shape)', () => {
    expect(ccBus(`${iface} contract C { IERC20 token0; IERC20 token1;`
      + ' function swap(bool isToken0, uint256 amt) public {'
      + ' (IERC20 tokenIn, IERC20 tokenOut) = isToken0 ? (token0, token1) : (token1, token0);'
      + ' tokenIn.transferFrom(msg.sender, address(this), amt);'
      + ' uint256 x = tokenIn.balanceOf(address(this)); tokenOut.transfer(msg.sender, x); require(true); } }')).toBe('C');
  }, 120_000);
});

describe('SBE-21: external call on a state-var target in fallback/receive', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // SynthesizeExternalAddressLocals visits fallback/receive too, so a re-entrancy-style fallback that calls
  // back into an interface/contract-typed state var resolves the target like any function (unblocks ReEntrancy).
  it('compiles a fallback + receive that call a contract-typed state var', () => {
    expect(cc('contract Store { int counter; function withdraw() external { require(true); } }'
      + ' contract C { Store s; constructor(address a){ s = Store(a); }'
      + ' fallback() external { s.withdraw(); }'
      + ' receive() external payable { s.withdraw(); } }')).toBe('C');
  });

  it('pins a bare low-level-call state receiver through a surviving address local', () => {
    expect(cc('contract C { address target; constructor(address a) { target = a; }'
      + ' function forward(bytes data) public { (bool ok,) = target.call(data); require(ok); } }')).toBe('C');
  });
});

// Low-level call `.call{value:}(data)` on a COMPLEX (non-identifier) address receiver: the receiver type is
// resolved structurally in the symbol-table pass (types are not on nodes yet). Unblocks MultiSigWallet's
// `transactions[i].to.call{value: ...value}(...data)` (a struct field of an array element).
describe('Low-level call on a struct-field / array-element address receiver', () => {
  it('compiles `structVar.field.call{value:}(data)` where the struct is an array element', () => {
    const a = compileString(
      'contract C { struct T { address to; uint256 value; bytes data; } T[] txs;'
      + ' function exec(uint256 i) public { T storage t = txs[i];'
      + ' (bool ok,) = t.to.call{value: t.value}(t.data); require(ok); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
    expect(a.bytecode.length).toBeGreaterThan(0);
  });
});

// A redundant same-interface cast on an interface-typed state-var external-call target (`IFoo(pool).bar()`,
// where `pool` is already IFoo-typed) is a no-op cast; it must route through the same synthesized __extaddr_
// local as the bare `pool.bar()` form instead of demanding a param target.
describe('redundant interface cast on a state-var external-call target', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const iface = 'interface IFoo { function bar() external; }';
  it('accepts IFoo(statePool).bar() like the bare statePool.bar()', () => {
    expect(cc(`${iface} contract C { IFoo pool; constructor(address _p) { pool = IFoo(_p); }`
      + ' function f() external { IFoo(pool).bar(); } }')).toBe('C');
  });
  it('accepts the immutable-state-var form too', () => {
    expect(cc(`${iface} contract C { IFoo immutable pool; constructor(address _p) { pool = IFoo(_p); }`
      + ' function f() external { IFoo(pool).bar(); } }')).toBe('C');
  });
});

describe('public state getter on a self-pinned contract target', () => {
  it('treats a public mapping getter as a callable contract member', () => {
    const artifact = compileString(
      'interface ISwapper {} contract Master { mapping(ISwapper => bool) public swappers; }'
      + ' contract C { Master public immutable masterContract;'
      + ' constructor(Master _master) { masterContract = _master; }'
      + ' function liquidate(ISwapper swapper) public {'
      + ' require(masterContract.swappers(swapper), "invalid swapper"); } }',
      { solidityImportCompat: true },
    );
    expect(artifact.contractName).toBe('C');
    expect(artifact.abi.find((entry) => entry.name === 'liquidate')?.externalCalls?.[0]).toMatchObject({
      interfaceName: 'Master',
      functionName: 'swappers',
      addressStateVar: 'masterContract',
    });
  });
});

// An external-call address local must survive to the covenant epilogue. Reading the same handle another way in
// the same function (`address(car).balance` alongside `car.method()`) must not OP_ROLL-consume it as a last use.
describe('external-call address local survives a same-function balance read', () => {
  const base = 'contract Car { address owner; constructor(address _o) { owner = _o; }'
    + ' function owner_() external view returns (address) { return owner; } }';
  const cc = (body: string): string => compileString(
    `${base} contract F { Car[] cars; function g(uint i) public view returns (${body} } }`,
    { solidityImportCompat: true },
  ).contractName;
  it('compiles ext-call then address(handle).balance in a tuple', () => {
    expect(cc('address, uint) { Car car = cars[i]; return (car.owner_(), address(car).balance);')).toBe('F');
  });
  it('does not regress an ext-call with no balance read', () => {
    expect(cc('address) { Car car = cars[i]; return car.owner_();')).toBe('F');
  });
});

// Solidity auto-generates an external getter for every `public` state var. Genuine `address` getters are now
// synthesized (so `other.owner()` resolves). Enum placeholders are now resolved against the declaring contract
// before getter synthesis; unrelated contract-typed placeholders retain their address-getter behavior.
describe('public address state-var auto-getter (external-callable)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('synthesizes an address getter and resolves an external call to it', () => {
    expect(cc('contract Car { address public owner; constructor(address _o) { owner = _o; } }'
      + ' contract F { Car[] cars; function g(uint i) public view returns (address) {'
      + ' Car car = cars[i]; return car.owner(); } }')).toBe('F');
  });
  it('exposes the address getter in the contract ABI', () => {
    const abi = compileString('contract Car { address public owner; constructor(address _o) { owner = _o; } }',
      { solidityImportCompat: true }).abi;
    const g = abi.find((f) => f.name === 'owner');
    expect(g?.outputs?.[0]?.type).toBe('address');
  });
  it('resolves and exposes an enum-typed public getter', () => {
    const abi = compileString('contract C { enum S { A, B } S public status; int n; function f() public { this.n = 1; } }',
      { solidityImportCompat: true }).abi;
    expect(abi.find((f) => f.name === 'status')?.outputs?.[0]?.type).toBe('S');
  });
});

describe('Named-arg external interface call', () => {
  it('reorders named args into the interface function param order', () => {
    const a = compileString(`
      interface IBank { function balanceOf(address who, int day) external view returns (int); }
      contract C() {
        int n;
        function f(bytes32 cat, address who) { int b = IBank(cat).balanceOf({day: 5, who: who}); this.n = b; }
      }`);
    expect(a.contractName).toBe('C');
  });
});

describe('pre-call require reachability metadata', () => {
  const header = `pragma solidity ^0.8.19;
    interface ITarget { function ping() external; }
    contract C {
      struct Job { address worker; uint8 state; }
      mapping(uint256 => Job) jobs;
      ITarget target;
  `;

  it('publishes source require guards separately from branch activation', () => {
    const artifact = compileString(`${header}
      function run(uint256 id) public {
        require(jobs[id].worker == msg.sender, "not worker");
        require(jobs[id].state == 1, "wrong state");
        target.ping();
      }
    }`, { solidityImportCompat: true, forceStateful: true });
    const call = artifact.abi.find((fn) => fn.name === 'run')?.externalCalls?.[0];
    expect(call?.condition).toBeUndefined();
    expect(call?.preCallRequires).toHaveLength(2);
    expect(call?.preCallRequires?.[0]).toMatchObject({
      kind: 'binary', operator: '==', left: { kind: 'field', name: 'worker' },
      right: { kind: 'source', source: { kind: 'msgSender' } },
    });
  });

  it('serializes a guard at the require, before an intervening state write', () => {
    const artifact = compileString(`${header}
      function run(uint256 id) public {
        require(jobs[id].state == 1);
        jobs[id].state = 0;
        target.ping();
      }
    }`, { solidityImportCompat: true, forceStateful: true });
    const guard = artifact.abi.find((fn) => fn.name === 'run')?.externalCalls?.[0]?.preCallRequires?.[0];
    expect(guard?.left).toMatchObject({ kind: 'field', name: 'state' });
    expect(guard?.left?.expression).toMatchObject({ kind: 'stateAccess', name: 'jobs' });
  });

  it('does not publish a lowered constant placeholder around a returning external call', () => {
    const artifact = compileString(`pragma solidity ^0.8.19;
      interface ITarget { function check() external returns (uint256); }
      interface IOther { function ping() external; }
      contract C { ITarget target; IOther other;
        function run() public { require(target.check() > 0); other.ping(); }
      }`, { solidityImportCompat: true, forceStateful: true });
    const calls = artifact.abi.find((fn) => fn.name === 'run')?.externalCalls ?? [];
    expect(calls.map((call) => call.functionName)).toEqual(['check', 'ping']);
    expect(calls[1]?.preCallRequires).toBeUndefined();
  });

  it('publishes a replayable necessary conjunct before a later call', () => {
    const artifact = compileString(`pragma solidity ^0.8.19;
      interface IToken { function balanceOf(address owner) external returns (uint256); }
      interface ISink { function ping() external; }
      contract C(ISink sink) {
        function run(address token) public {
          require(token.code.length > 0 && IToken(token).balanceOf(msg.sender) > 0);
          sink.ping();
          require(true);
        }
      }`, { solidityImportCompat: true, forceStateful: true, messageBus: true });
    const calls = artifact.abi.find((fn) => fn.name === 'run')?.externalCalls ?? [];
    expect(calls.map((call) => call.functionName)).toEqual(['balanceOf', 'ping']);
    expect(calls[1]?.preCallRequires).toContainEqual({
      kind: 'binary', operator: '>',
      left: {
        kind: 'addressCodeLength',
        expression: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
        type: 'bigint',
      },
      right: { kind: 'literal', type: 'bigint', value: '0' },
    });
  });
});

describe('SBE-25: msg.sender category forwarded across internal calls', () => {
  // A function using msg.sender gets a synthetic `bytes32 __internal__msgSenderCategory` param. A positional
  // internal call to such a function must forward the caller's own category (msg.sender is identical across an
  // internal call), otherwise the call is short an argument -> InvalidParameterTypeError. Unblocks ERC721
  // (safeTransferFrom -> transferFrom) and WETH (fallback -> deposit -> _mint(msg.sender, ..)).
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('forwards the synthetic category on an internal call to a msg.sender-using function', () => {
    expect(cc('contract C { mapping(uint256 => address) o;'
      + ' function inner(address from, uint256 id) public { require(msg.sender == o[id]); o[id] = from; }'
      + ' function outer(address from, uint256 id) external { require(msg.sender != address(0)); inner(from, id); } }'))
      .toBe('C');
  });

  it('compiles the ERC721 safeTransferFrom -> transferFrom shape', () => {
    expect(cc('contract C { mapping(uint256 => address) _ownerOf; mapping(address => uint256) _balanceOf;'
      + ' function transferFrom(address from, address to, uint256 id) public {'
      + ' require(from == _ownerOf[id]); require(msg.sender == from); _balanceOf[from]--; _balanceOf[to]++; _ownerOf[id] = to; }'
      + ' function safeTransferFrom(address from, address to, uint256 id) external { transferFrom(from, to, id); } }'))
      .toBe('C');
  });
});

describe('try/catch around a VOID external call', () => {
  // A void external call sets no expression type (only non-empty returnTypes assign one); the try codegen
  // treated undefined as one pushed value and emitted a phantom OP_DROP that consumed an unrelated slot
  // (a pending state write, the __extaddr_ address local) and broke the epilogue. Sound by reduction: the
  // try form must be byte-identical to the bare call-statement form (catch is dead code on BCH).
  const DECL = 'abstract contract D { function d() external virtual; }\n';
  const opts = { solidityImportCompat: true };

  it('is byte-identical to the bare statement form (state-var target, prior state write)', () => {
    const tryForm = compileString(
      `${DECL}contract C { int x; D d; function f() public { x = 0; try d.d() {} catch {} } }`, opts,
    );
    const stmtForm = compileString(
      `${DECL}contract C { int x; D d; function f() public { x = 0; d.d(); } }`, opts,
    );
    expect(tryForm.bytecode).toBe(stmtForm.bytecode);
  });

  it('is byte-identical without a prior state write', () => {
    const tryForm = compileString(
      `${DECL}contract C { D d; function f() public { try d.d() {} catch {} } }`, opts,
    );
    const stmtForm = compileString(
      `${DECL}contract C { D d; function f() public { d.d(); } }`, opts,
    );
    expect(tryForm.bytecode).toBe(stmtForm.bytecode);
  });
});

describe('external call on a struct-field target (s.field.m())', () => {
  const IF = 'interface IFoo { function m() external returns (uint); }\n';
  const opts = { solidityImportCompat: true };

  it('compiles a call on an interface-typed struct STATE-var field', () => {
    const a = compileString(
      `${IF}struct S { IFoo target; uint x; } contract C { S s; function f() public returns (uint) { return s.target.m(); } }`,
      opts,
    );
    expect(a.contractName).toBe('C');
    const f = a.abi.find((fn) => fn.name === 'f')!;
    // The field read is hoisted into a synthesized __extaddr_ local that the dispatch PICKs (never a caller
    // witness); the sound self-pinned-state form records addressParam, not addressLiteral.
    expect(f.externalCalls?.[0]?.addressParam).toBe('__extaddr_s_target');
    expect(f.externalCalls?.[0]?.addressLiteral).toBeUndefined();
  });

  it('is byte-identical to the explicit __extaddr_ hoist (sound by reduction)', () => {
    const auto = compileString(
      `${IF}struct S { IFoo target; uint x; } contract C { S s; function f() public returns (uint) { return s.target.m(); } }`,
      opts,
    );
    const manual = compileString(
      `${IF}struct S { IFoo target; uint x; } contract C { S s; function f() public returns (uint) `
      + '{ IFoo __extaddr_s_target = s.target; return __extaddr_s_target.m(); } }',
      opts,
    );
    expect(auto.bytecode).toBe(manual.bytecode);
  });

  it('leaves a memory-struct-param field unsupported (conservative gate: not self-pinned state)', () => {
    expect(() => compileString(
      `${IF}struct S { IFoo target; } contract C { function f(S memory s) public returns (uint) { return s.target.m(); } }`,
      opts,
    )).toThrow();
  });
});

describe('external call on a state-rooted access-chain target (ss[i].f.m(), ms[k].f.m(), s.a.b.m())', () => {
  const IF = 'interface IFoo { function m() external returns (uint); }\n';
  const opts = { solidityImportCompat: true };
  // Each chain hoists to `IFoo x = <chain>; x.m()` - byte-identical to the manual hoist that uses the audited
  // interface-local dispatch (sound by reduction; every step is self-pinned state).

  it('direct interface-mapping value: strategy[token].m()', () => {
    const auto = compileString(
      `${IF}contract C { mapping(uint => IFoo) strategy; function f(uint token) public returns (uint) { return strategy[token].m(); } }`, opts,
    );
    const manual = compileString(
      `${IF}contract C { mapping(uint => IFoo) strategy; function f(uint token) public returns (uint) { IFoo x = strategy[token]; return x.m(); } }`, opts,
    );
    expect(auto.bytecode).toBe(manual.bytecode);
    const f = auto.abi.find((entry) => entry.name === 'f')!;
    expect(f.externalCalls?.[0]?.loopArrayVar).toBeUndefined();
    expect(f.externalCalls?.[0]?.addressParam).toBe('__extaddr_strategy_token');
  });

  it('struct-array element: ss[0].target.m()', () => {
    const auto = compileString(
      `${IF}struct S { IFoo target; } contract C { S[] ss; function f() public returns (uint) { return ss[0].target.m(); } }`, opts,
    );
    const manual = compileString(
      `${IF}struct S { IFoo target; } contract C { S[] ss; function f() public returns (uint) { IFoo x = ss[0].target; return x.m(); } }`, opts,
    );
    expect(auto.bytecode).toBe(manual.bytecode);
  });

  it('struct-mapping value with a param key: ms[k].target.m()', () => {
    const auto = compileString(
      `${IF}struct S { IFoo target; } contract C { mapping(uint => S) ms; function f(uint k) public returns (uint) { return ms[k].target.m(); } }`, opts,
    );
    const manual = compileString(
      `${IF}struct S { IFoo target; } contract C { mapping(uint => S) ms; function f(uint k) public returns (uint) { IFoo x = ms[k].target; return x.m(); } }`, opts,
    );
    expect(auto.bytecode).toBe(manual.bytecode);
  });

  it('nested struct field: s.inner.target.m()', () => {
    const auto = compileString(
      `${IF}struct Inner { IFoo target; } struct S { Inner inner; } contract C { S s; function f() public returns (uint) { return s.inner.target.m(); } }`, opts,
    );
    const manual = compileString(
      `${IF}struct Inner { IFoo target; } struct S { Inner inner; } contract C { S s; function f() public returns (uint) { IFoo x = s.inner.target; return x.m(); } }`, opts,
    );
    expect(auto.bytecode).toBe(manual.bytecode);
  });

  // A LOCAL-indexed struct-array-element field chain `ss[i].target.m()` is NOT body-top hoistable (i is defined
  // mid-body), but it is now handled by the array-element co-spend loop (emitArrayExternalCallLoop decodes the
  // field from each self-pinned element) - parity with the plain `arr[i].m()` element call, VM-proven sound in
  // StructFieldArrayExternalCall.test.ts (MasterChef massUpdatePools `poolInfo[i].lpToken.balanceOf(..)`).
  it('compiles a LOCAL-indexed struct-field chain via the array co-spend loop', () => {
    expect(() => compileString(
      `${IF}struct S { IFoo target; } contract C { S[] ss; function f() public returns (uint) { uint i = 0; return ss[i].target.m(); } }`, opts,
    )).not.toThrow();
  });
});
