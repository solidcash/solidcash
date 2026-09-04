import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, SignatureAlgorithm, SignatureTemplate, StatefulContract, messageBus,
} from '../../../src/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos } from '../../test-util.js';
import { alicePriv, alicePub, bobPriv, bobPub } from '../../fixture/vars.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

const SOURCE = `pragma solidcash ^0.13.0;
contract KernelAcc() {
  int x;
  function bump(int n) internal { this.x = this.x + n; }
  function add(int n) public {
    bump(n);
    require(true);
  }
  function inspect() public {
    assembly {
      OP_TXVERSION OP_2 OP_NUMEQUALVERIFY
      OP_INPUTINDEX OP_DROP
      OP_TXOUTPUTCOUNT OP_DROP
      OP_0 OP_UTXOVALUE OP_DROP
      OP_7 OP_0 OP_PICK OP_NUMEQUALVERIFY
      OP_TXVERSION OP_2 OP_NUMEQUAL
      OP_IF OP_9 OP_DROP OP_ELSE OP_10 OP_DROP OP_ENDIF
      OP_3 OP_BEGIN OP_1SUB OP_DUP OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP
    }
    require(true);
  }
  function check(int expected) public { require(this.x == expected); }
}`;

const COUNTER_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMapping() {
  mapping(int => int) m;
  function write(int n, int value) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = value;
    }
    require(true);
  }
  function clear(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      delete this.m[i];
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const AFFINE_COUNTER_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelAffineCounterMapping() {
  mapping(int => int) m;
  function writeAffine(int n, int value) public {
    int requested = n;
    int intermediate = requested - 2;
    int limit = 1 + intermediate;
    for (int i = 1; i < limit; i = i + 2) { this.m[i] = value; }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const COUNTER_MAPPING_RMW_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMappingRmw() {
  mapping(int => int) m;
  function credit(int n, int amount) public {
    int requested = n;
    int limit = requested;
    for (int i = 1; i < limit; i = i + 2) {
      this.m[i] = this.m[i] + amount;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const SOLE_FUNCTION_SOURCE = `pragma solidcash ^0.13.0;
contract KernelSoleFunction() {
  int x;
  function set(int value) public { this.x = value; require(true); }
}`;

const NESTED_MULTI_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelNestedMultiMapping() {
  mapping(int => mapping(int => int)) a;
  mapping(int => mapping(int => int)) b;
  function write(int aPrefix, int bPrefix, int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.a[aPrefix][i] = i + 10;
      this.b[bPrefix][i] = i + 20;
    }
    require(true);
  }
}`;

const SELECTED_MULTI_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelSelectedMultiMapping() {
  mapping(int => mapping(int => int)) a;
  mapping(int => mapping(int => int)) b;
  function write(int aPrefix, int bPrefix, int n) public {
    for (int i = 0; i < n; i = i + 1) {
      if (i % 2 == 0) this.a[aPrefix][i] = i + 10;
      if (i % 2 != 0) this.b[bPrefix][i] = i + 20;
    }
    require(true);
  }
}`;

const REPEATED_COUNTER_KEY_SOURCE = `pragma solidcash ^0.13.0;
contract KernelRepeatedCounterKey() {
  mapping(int => mapping(int => mapping(int => int))) nested;
  function write(int scope, int n) public {
    for (int i = 0; i < n; i = i + 1) { this.nested[i][scope][i] = i + 10; }
    require(true);
  }
  function transform(int scope, int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.nested[i][scope][i] = max(this.nested[i][scope][i] * 2, this.nested[i][scope][i] + i + 5);
    }
    require(true);
  }
}`;

const DERIVED_COUNTER_KEY_SOURCE = `pragma solidcash ^0.13.0;
contract KernelDerivedCounterKey() {
  mapping(int => mapping(int => int)) nested;
  function write(int bound) public {
    for (int i = 3; i < bound; i = i + 2) { this.nested[i + 1][i] = i + 10; }
    require(true);
  }
}`;

const SEQUENTIAL_MULTI_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelSequentialMultiMapping() {
  mapping(int => int) a;
  mapping(int => int) b;
  function writeBoth(int left, int right) public {
    for (int i = 0; i < left; i = i + 1) {
      this.a[i] = i + 10;
    }
    for (int j = 2; j < right; j = j + 2) {
      this.b[j] = j + 20;
    }
    require(true);
  }
  function checkA(int key, int expected) public { require(this.a[key] == expected); }
  function checkB(int key, int expected) public { require(this.b[key] == expected); }
}`;

const COUNTER_MAPPING_EVENT_SOURCE = `pragma solidcash ^0.13.0;
event Before(int i);
event Hit(int i);
event Echo(int i) anonymous;
event After(int i);
contract KernelCounterMappingEvent() {
  mapping(int => int) m;
  function write(int n) public {
    emit Before(n);
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 10;
      emit Hit(i);
      emit Echo(i);
    }
    emit After(n);
    require(true);
  }
}`;

const CONDITIONAL_COUNTER_EVENT_SOURCE = `pragma solidcash ^0.13.0;
event Hit(int i);
contract KernelConditionalCounterEvent() {
  mapping(int => int) m;
  function write(int n, bool enabled, bool oddsOnly) public {
    if (enabled) emit Hit(-1);
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 10;
      if (enabled && (!oddsOnly || i % 2 == 1)) emit Hit(i);
    }
    if (!enabled) emit Hit(-2);
    require(true);
  }
}`;

const CONDITIONAL_COUNTER_LOOP_SOURCE = `pragma solidcash ^0.13.0;
event Hit(int i);
contract KernelConditionalCounterLoop() {
  bool gate;
  mapping(int => int) m;
  mapping(int => bool) scopedGate;
  mapping(int => int) scoped;
  function write(int n, bool enabled) public {
    if (enabled && this.gate) {
      for (int i = 0; i < n; i = i + 1) {
        this.m[i] = i + 10;
        emit Hit(i);
      }
    }
    require(true);
  }
  function setScopedGate(int scope, bool enabled) public {
    this.scopedGate[scope] = enabled;
    require(true);
  }
  function writeScoped(int n, int scope, bool enabled) public {
    if (enabled && this.scopedGate[scope]) {
      for (int i = 0; i < n; i = i + 1) { this.scoped[i] = scope + i; }
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
  function checkScoped(int key, int expected) public { require(this.scoped[key] == expected); }
}`;

const SELECTED_COUNTER_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
event Selected(int i);
event Visited(int i);
contract KernelSelectedCounterMapping() {
  mapping(int => int) m;
  mapping(uint => uint) u;
  mapping(int => int) totals;
  mapping(bytes32 => int) hashedTotals;
  mapping(int => mapping(bytes32 => int)) nestedTotals;
  function write(int n, int ceiling) public {
    for (int i = 0; i < n; i = i + 1) {
      bool selected = i < ceiling;
      if (selected) {
        this.m[i] = i + 10;
        emit Selected(i);
      }
    }
    require(true);
  }
  function writeOdds(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      emit Visited(i + 100);
      if (i % 2 == 0) continue;
      this.m[i] = i + 30;
      emit Selected(i);
    }
    require(true);
  }
  function writeUntil(int n, int stop) public {
    for (int i = 0; i < n; i = i + 1) {
      emit Visited(i + 200);
      this.m[i] = i + 40;
      if (i == stop) break;
    }
    require(true);
  }
  function writeVoidReturn(int n, int stop) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 60;
      if (i == stop) return;
    }
    require(true);
  }
  function writeReturn(int n, int stop) public returns (int) {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 70;
      if (i == stop) return i;
    }
    require(true);
    return n;
  }
  function writeSwitch(int n, int choice) public {
    switch (choice) {
      case 1: {
        for (int i = 0; i < n; i = i + 1) { this.m[i] = i + 80; }
        break;
      }
      default: {
        for (int j = 0; j < n; j = j + 1) { this.m[j] = j + 90; }
        break;
      }
    }
    require(true);
  }
  function writeInnerSwitch(int n, int choice) public {
    for (int i = 0; i < n; i = i + 1) {
      switch (choice) {
        case 1: this.m[i] = i + 100; emit Visited(i + 300); break;
        default: this.m[i] = i + 110; emit Visited(i + 400); break;
      }
    }
    require(true);
  }
  function writeUnsigned(uint n) public {
    for (uint i = 0; i < n; i = i + 1) { this.u[i] = i + 500; }
    require(true);
  }
  function writeComputed(int n, int scale) public {
    int limit = n * scale;
    for (int i = 0; i < limit; i = i + 1) { this.m[i] = i + 600; }
    require(true);
  }
  function writeMixed(int n, int owner) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 700;
      this.totals[owner] = i;
    }
    require(true);
  }
  function writeComputedKey(int n, bytes owner) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 800;
      this.hashedTotals[sha256(owner)] = i;
    }
    require(true);
  }
  function writeNestedInvariant(int n, int group, bytes owner) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 900;
      this.nestedTotals[group][sha256(owner)] = i;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
  function checkUnsigned(uint key, uint expected) public { require(this.u[key] == expected); }
  function checkTotal(int key, int expected) public { require(this.totals[key] == expected); }
  function checkHashedTotal(bytes owner, int expected) public {
    require(this.hashedTotals[sha256(owner)] == expected);
  }
  function checkNestedTotal(int group, bytes owner, int expected) public {
    require(this.nestedTotals[group][sha256(owner)] == expected);
  }
}`;

const INDEPENDENT_ROW_LOOP_SOURCE = `pragma solidcash ^0.13.0;
event ABefore(int n);
event AHit(int i);
event AAfter(int n);
event BBefore(int n);
event BHit(int i);
event BAfter(int n);
contract KernelIndependentRows() {
  mapping(int => int) a;
  mapping(int => int) b;
  function writeA(int n) public {
    emit ABefore(n);
    for (int i = 0; i < n; i = i + 1) { this.a[i] = i + 10; emit AHit(i); }
    emit AAfter(n);
    require(true);
  }
  function writeB(int n) public {
    emit BBefore(n);
    for (int i = 0; i < n; i = i + 1) { this.b[i] = i + 20; emit BHit(i); }
    emit BAfter(n);
    require(true);
  }
  function checkA(int key, int expected) public { require(this.a[key] == expected); }
  function checkB(int key, int expected) public { require(this.b[key] == expected); }
}`;

const DISJOINT_SAME_COLLECTION_ROWS_SOURCE = `pragma solidcash ^0.13.0;
contract KernelDisjointSameCollectionRows() {
  mapping(int => mapping(int => int)) values;
  function seed(int group, int key, int value) public {
    this.values[group][key] = value;
    require(true);
  }
  function writeA(int n, int base) public {
    for (int i = 0; i < n; i = i + 1) { this.values[1][i] = base; }
    require(true);
  }
  function writeB(int n, int base) public {
    for (int i = 0; i < n; i = i + 1) { this.values[2][i] = base; }
    require(true);
  }
  function writeSequential(int left, int right) public {
    for (int i = 0; i < left; i = i + 1) { this.values[3][i] = 30; }
    for (int j = 10; j < right; j = j + 1) { this.values[3][j] = 31; }
    require(true);
  }
  function writeOverlap(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.values[4][i] = 40; }
    for (int j = 0; j < n; j = j + 1) { this.values[4][j] = 41; }
    require(true);
  }
  function writeDescending(int bound) public {
    for (int i = 3; i > bound; i = i - 1) { this.values[5][i] = i + 50; }
    require(true);
  }
  function writeAlias(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      int value = i + 60;
      this.values[6][i] = value;
    }
    require(true);
  }
  function transform(int group, int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.values[group][i] = max(this.values[group][i] * 2, this.values[group][i] + i + 5);
    }
    require(true);
  }
  function check(int group, int key, int expected) public {
    require(this.values[group][key] == expected);
  }
}`;

const COUNTER_MAPPING_TYPED_CALLER_SOURCE = `pragma solidcash ^0.13.0;
interface IKernelCounterSink { function ping(int value); }
contract KernelCounterCaller(address sink) {
  mapping(int => int) m;
  function invoke(int n) public {
    for (int i = 1; i < n; i = i + 2) {
      this.m[i] = i + 10;
      try IKernelCounterSink(sink).ping(i) { } catch { }
    }
    require(true);
  }
}`;

const COUNTER_MAPPING_TYPED_CALLEE_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterSink() {
  function ping(int value) public { require(value >= 0); }
}`;

const COUNTER_MAPPING_DO_TYPED_CALLER_SOURCE = `pragma solidcash ^0.13.0;
interface IKernelCounterSink { function ping(int value); }
contract KernelDoCounterCaller(address sink) {
  mapping(int => int) m;
  function invoke(int n) public {
    int i = 0;
    do {
      this.m[i] = i + 10;
      IKernelCounterSink(sink).ping(i);
      i = i + 1;
    } while (i < n);
    require(true);
  }
  function check(int key, int expected) public { require(this.m[key] == expected); }
}`;

const RANGED_DO_COUNTER_SOURCE = `pragma solidcash ^0.13.0;
contract KernelRangedDoCounter() {
  mapping(int => int) m;
  function write(int bound) public {
    int i = 5;
    do { this.m[i] = i + 20; i = i - 2; } while (i > bound);
    require(true);
  }
}`;

const COUNTER_STRUCT_RMW_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterStructRmw() {
  struct Pair { int left; int right; }
  mapping(int => Pair) pairs;
  function seed(int key, int left, int right) public {
    this.pairs[key] = Pair(left, right);
    require(true);
  }
  function update(int count) public {
    for (int i = 0; i < count; i = i + 1) {
      Pair pair = this.pairs[i];
      pair.left = pair.left + 1;
      this.pairs[i] = pair;
    }
    require(true);
  }
  function check(int key, int left, int right) public {
    require(this.pairs[key].left == left);
    require(this.pairs[key].right == right);
    require(true);
  }
}`;

describe('kernel loop message-bus compose', () => {
  it('executes isolated read-only transaction assembly inside a row handler', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'inspect')?.eligible).toBe(true);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([{ function: 'inspect', args: [] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `input ${inputIndex}`).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('evaluates two logical add rows on the kernel route', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    const routeBody = artifact.functionBodies?.['53434231'];
    expect(routeBody).toBeDefined();
    expect(bytecodeToAsm(hexToBin(routeBody!))).toMatch(/OP_UNTIL|OP_BEGIN/);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'add', args: [2n] }, { function: 'add', args: [3n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }))).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    // The route ABI includes the aligned signature array even when this batch selects only another handler.
    // Its neutral placeholder must not request or validate an unrelated signature.
    const unsignedCall = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'check', args: [5n] },
    ]);
    const unsignedBuilder = await unsignedCall.build();
    const unsignedTransaction = unsignedBuilder.buildLibauthTransaction();
    const unsignedSourceOutputs = generateLibauthSourceOutputs(unsignedBuilder.inputs);
    for (let inputIndex = 0; inputIndex < unsignedTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: unsignedSourceOutputs, transaction: unsignedTransaction,
      })), `unsigned input ${inputIndex}`).toBe(true);
    }
    await expect(unsignedCall.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);

  it('fails closed for an unknown row selector and for too many rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const add = artifact.messageBus!.handlers.find((handler) => handler.name === 'add')!;
    const encoded = encodeMessageBatch(artifact, [{ function: 'add', args: [1n] }]);
    const unknown = Uint8Array.from(encoded.blob);
    const selector = hexToBin(add.selector);
    const at = unknown.findIndex((_byte, index) => selector.every((value, offset) => unknown[index + offset] === value));
    expect(at).toBeGreaterThanOrEqual(0);
    unknown.set(hexToBin('deadbeef'), at);
    const unknownCall = contract._batchRaw(unknown, encoded.routeWitnesses);
    const unknownBuilder = await unknownCall.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const unknownTx = unknownBuilder.buildLibauthTransaction();
    const unknownSources = generateLibauthSourceOutputs(unknownBuilder.inputs);
    expect(unknownTx.inputs.some((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: unknownSources, transaction: unknownTx }))
      !== true)).toBe(true);

    expect(artifact.messageBus!.maximumRows).toBeGreaterThanOrEqual(2);
    const tooMany = Array.from({ length: artifact.messageBus!.maximumRows + 1 }, () => (
      { function: 'add', args: [1n] }
    ));
    expect(() => encodeMessageBatch(artifact, tooMany)).toThrow(/row count must be between/);

    const overflow = Uint8Array.from(encoded.blob);
    overflow[6] = artifact.messageBus!.maximumRows + 1;
    const overflowCall = contract._batchRaw(overflow, encoded.routeWitnesses);
    const overflowBuilder = await overflowCall.build();
    const overflowTx = overflowBuilder.buildLibauthTransaction();
    const overflowSources = generateLibauthSourceOutputs(overflowBuilder.inputs);
    expect(overflowTx.inputs.some((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: overflowSources, transaction: overflowTx }))
      !== true)).toBe(true);
  }, 180_000);
});

describe('kernel scalar-signature rows', () => {
  it('signs two aligned route-witness elements against the invoked handler body', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelSigned(pubkey owner) {
      int total;
      function add(sig authorization, int amount) public {
        require(checkSig(authorization, owner));
        this.total = this.total + amount;
        require(true);
      }
      function check(int expected) public { require(this.total == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[]',
    }));

    const inner = new Contract(artifact, [alicePub], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    expect(() => contract.batch([
      { function: 'add', args: [new Uint8Array(65), 1n] },
    ])).toThrow(/transaction signature argument 0 requires SignatureTemplate/);
    const call = contract.batch([
      { function: 'add', args: [new SignatureTemplate(alicePriv), 2n] },
      { function: 'add', args: [new SignatureTemplate(alicePriv), 3n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(
      StatefulContract.withCategory(inner, categoryId).check(5n).send(),
    ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);
});

describe('kernel signature-array rows', () => {
  it('signs each row of a nested route witness against the invoked handler body', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelMultiSigned() {
      int total;
      function add(sig[] authorizations, pubkey[] owners, int amount) public {
        require(checkMultiSig(authorizations, owners));
        this.total = this.total + amount;
        require(true);
      }
      function check(int expected) public { require(this.total == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[][]',
    }));

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const signatures = (): SignatureTemplate[] => [
      new SignatureTemplate(alicePriv, undefined, SignatureAlgorithm.ECDSA),
      new SignatureTemplate(bobPriv, undefined, SignatureAlgorithm.ECDSA),
    ];
    const contract = StatefulContract.withCategory(inner, categoryId);
    expect(() => contract.batch([
      { function: 'add', args: [[new Uint8Array(65)], [alicePub], 1n] },
    ])).toThrow(/transaction signature argument 0 requires SignatureTemplate/);
    const call = contract.batch([
      { function: 'add', args: [signatures(), [alicePub, bobPub], 2n] },
      { function: 'add', args: [signatures(), [alicePub, bobPub], 3n] },
    ]);
    const fee = await createBareP2pkhFeeFunder(provider);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const unsignedCall = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'check', args: [5n] },
    ]);
    const unsignedBuilder = await unsignedCall.build();
    const unsignedTransaction = unsignedBuilder.buildLibauthTransaction();
    const unsignedSourceOutputs = generateLibauthSourceOutputs(unsignedBuilder.inputs);
    for (let inputIndex = 0; inputIndex < unsignedTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: unsignedSourceOutputs, transaction: unsignedTransaction,
      })), `unsigned input ${inputIndex}`).toBe(true);
    }
  }, 180_000);

  it('recursively signs a deeper source array through one additional row dimension', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract KernelNestedSigned(pubkey owner) {
      int total;
      function add(sig[][] authorizations, int amount) public {
        require(checkSig(authorizations[0][0], owner));
        this.total = this.total + amount;
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[][][]',
    }));

    const inner = new Contract(artifact, [alicePub], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'add', args: [[[new SignatureTemplate(alicePriv)]], 2n] },
      { function: 'add', args: [[[new SignatureTemplate(alicePriv)]], 3n] },
    ]);
    const fee = await createBareP2pkhFeeFunder(provider);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);
});

describe('kernel counter-key mapping loop compose', () => {
  it('settles exactly the iterations selected by a runtime predicate', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SELECTED_COUNTER_MAPPING_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    const writeHandler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    const oddsHandler = artifact.abi.find((candidate) => candidate.name === 'writeOdds')!;
    const untilHandler = artifact.abi.find((candidate) => candidate.name === 'writeUntil')!;
    const voidReturnHandler = artifact.abi.find((candidate) => candidate.name === 'writeVoidReturn')!;
    const returnHandler = artifact.abi.find((candidate) => candidate.name === 'writeReturn')!;
    const switchHandler = artifact.abi.find((candidate) => candidate.name === 'writeSwitch')!;
    const innerSwitchHandler = artifact.abi.find((candidate) => candidate.name === 'writeInnerSwitch')!;
    const unsignedHandler = artifact.abi.find((candidate) => candidate.name === 'writeUnsigned')!;
    const computedHandler = artifact.abi.find((candidate) => candidate.name === 'writeComputed')!;
    const mixedHandler = artifact.abi.find((candidate) => candidate.name === 'writeMixed')!;
    const computedKeyHandler = artifact.abi.find((candidate) => candidate.name === 'writeComputedKey')!;
    const nestedInvariantHandler = artifact.abi.find((candidate) => candidate.name === 'writeNestedInvariant')!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(writeHandler.sortedUpsertLoopInfo?.[0].iterationCondition).toBeDefined();
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeOdds'))
      .toMatchObject({ eligible: true });
    expect(oddsHandler.sortedUpsertLoopInfo?.[0].iterationCondition).toBeDefined();
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeUntil'))
      .toMatchObject({ eligible: true });
    expect(untilHandler.sortedUpsertLoopInfo?.[0].iterationBreakCondition).toBeDefined();
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeVoidReturn'))
      .toMatchObject({ eligible: true });
    expect(voidReturnHandler.sortedUpsertLoopInfo?.[0].iterationBreakCondition).toBeDefined();
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeReturn'))
      .toMatchObject({ eligible: true });
    expect(returnHandler.sortedUpsertLoopInfo?.[0].iterationBreakCondition).toBeDefined();
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeSwitch'))
      .toMatchObject({ eligible: true });
    expect(switchHandler.sortedUpsertLoopInfo?.map((info) => info.condition)).toEqual([
      expect.objectContaining({ kind: 'binary', operator: '==' }),
      expect.objectContaining({ kind: 'unary', operator: '!' }),
    ]);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeInnerSwitch'))
      .toMatchObject({ eligible: true });
    expect(innerSwitchHandler.sortedUpsertLoopInfo?.[0].iterationCondition)
      .toMatchObject({ kind: 'binary', operator: '||' });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeUnsigned'))
      .toMatchObject({ eligible: true });
    expect(unsignedHandler.inputs).toContainEqual(expect.objectContaining({
      name: expect.stringMatching(/^__internal__vmapCounterPerm_/), type: 'uint256[]',
    }));
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeComputed'))
      .toMatchObject({ eligible: true });
    expect(computedHandler.sortedUpsertLoopInfo?.[0].iterationBound)
      .toMatchObject({ kind: 'binary', operator: '*' });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeMixed'))
      .toMatchObject({ eligible: true });
    expect(mixedHandler.sortedUpsertLoopInfo).toHaveLength(1);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeComputedKey'))
      .toMatchObject({ eligible: true });
    expect(computedKeyHandler.sortedUpsertLoopInfo).toHaveLength(1);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeNestedInvariant'))
      .toMatchObject({ eligible: true });
    expect(nestedInvariantHandler.sortedUpsertLoopInfo).toHaveLength(1);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    let contract = StatefulContract.withCategory(inner, categoryId);

    const direct = contract.call.write(5n, 2n);
    const directBuilder = await direct.build();
    const directInput = directBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === 'write');
    if (!directInput || !('params' in directInput.unlocker)) throw new Error('direct write input is missing');
    const directPermutationIndex = writeHandler.inputs.findIndex((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'));
    expect([...(directInput.unlocker.params[directPermutationIndex] as bigint[])]
      .sort((left, right) => Number(left - right))).toEqual([0n, 1n]);
    await expect(direct.send()).resolves.toMatchObject({
      events: [{ args: { i: 0n } }, { args: { i: 1n } }],
    });

    contract = StatefulContract.withCategory(inner, categoryId);
    const routed = contract.batch([{ function: 'write', args: [5n, 4n] }]);
    const builder = await routed.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const permutationName = writeHandler.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))!.name;
    const routePermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationName);
    const rowPermutations = routeUnlocker.params[routePermutationIndex] as bigint[][];
    expect([...rowPermutations[0]].sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n, 3n]);

    const routeSelector = artifact.messageBus!.route.selector!;
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const originalUnlocker = routeUnlocker;
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    for (const hostile of [rowPermutations[0].slice(1), [...rowPermutations[0], 0n]]) {
      const hostileParams = [...routeUnlocker.params];
      hostileParams[routePermutationIndex] = [hostile];
      builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      expect(hostileVm.stateSuccess(hostileVm.evaluate({
        inputIndex: routeInputIndex, sourceOutputs, transaction,
      })), `hostile selected-domain witness ${hostile.join(',')}`).not.toBe(true);
    }
    builder.inputs[routeInputIndex].unlocker = originalUnlocker;

    await expect(routed.send()).resolves.toMatchObject({
      events: [{ args: { i: 0n } }, { args: { i: 1n } }, { args: { i: 2n } }, { args: { i: 3n } }],
    });
    for (const [key, expected] of [[0n, 10n], [1n, 11n], [2n, 12n], [3n, 13n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const continued = StatefulContract.withCategory(inner, categoryId).call.writeOdds(6n);
    const continuedBuilder = await continued.build();
    const continuedInput = continuedBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === 'writeOdds');
    if (!continuedInput || !('params' in continuedInput.unlocker)) {
      throw new Error('direct writeOdds input is missing');
    }
    const oddsPermutationIndex = oddsHandler.inputs.findIndex((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'));
    expect([...(continuedInput.unlocker.params[oddsPermutationIndex] as bigint[])]
      .sort((left, right) => Number(left - right))).toEqual([1n, 3n, 5n]);
    await expect(continued.send()).resolves.toMatchObject({
      events: [
        { args: { i: 100n } },
        { args: { i: 101n } }, { args: { i: 1n } },
        { args: { i: 102n } },
        { args: { i: 103n } }, { args: { i: 3n } },
        { args: { i: 104n } },
        { args: { i: 105n } }, { args: { i: 5n } },
      ],
    });
    for (const [key, expected] of [[1n, 31n], [3n, 33n], [5n, 35n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const broken = StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeUntil', args: [8n, 3n] }]);
    const brokenBuilder = await broken.build();
    const brokenInputIndex = brokenBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const brokenInput = brokenBuilder.inputs[brokenInputIndex];
    if (!brokenInput || !('params' in brokenInput.unlocker)) {
      throw new Error('routed writeUntil input is missing');
    }
    const untilPermutationName = untilHandler.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))!.name;
    const untilPermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === untilPermutationName);
    const terminatedPermutation = (brokenInput.unlocker.params[untilPermutationIndex] as bigint[][])[0];
    expect([...terminatedPermutation]
      .sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n, 3n]);
    const brokenRouteUnlocker = brokenInput.unlocker;
    const recreateBrokenUnlocker = brokenRouteUnlocker.contract.createCompilerRouteUnlocker(
      brokenRouteUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    );
    const brokenVm = createVirtualMachineBch2026ForProvider(provider);
    for (const hostile of [terminatedPermutation.slice(1), [...terminatedPermutation, 4n]]) {
      const hostileParams = [...brokenRouteUnlocker.params];
      hostileParams[untilPermutationIndex] = [hostile];
      brokenBuilder.inputs[brokenInputIndex].unlocker = recreateBrokenUnlocker(...hostileParams);
      const transaction = brokenBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(brokenBuilder.inputs);
      expect(brokenVm.stateSuccess(brokenVm.evaluate({
        inputIndex: brokenInputIndex, sourceOutputs, transaction,
      })), `hostile terminated-domain witness ${hostile.join(',')}`).not.toBe(true);
    }
    brokenBuilder.inputs[brokenInputIndex].unlocker = brokenRouteUnlocker;
    await expect(broken.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      events: [
        { args: { i: 200n } }, { args: { i: 201n } },
        { args: { i: 202n } }, { args: { i: 203n } },
      ],
    });
    for (const [key, expected] of [[0n, 40n], [1n, 41n], [2n, 42n], [3n, 43n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    const voidReturned = StatefulContract.withCategory(inner, categoryId).call.writeVoidReturn(7n, 2n);
    const voidBuilder = await voidReturned.build();
    const voidInput = voidBuilder.inputs.find((candidate) =>
      'abiFunction' in candidate.unlocker && candidate.unlocker.abiFunction.name === 'writeVoidReturn');
    if (!voidInput || !('params' in voidInput.unlocker)) {
      throw new Error('direct writeVoidReturn input is missing');
    }
    const voidPermutationIndex = voidReturnHandler.inputs.findIndex((candidate) =>
      candidate.name.startsWith('__internal__vmapCounterPerm_'));
    expect([...(voidInput.unlocker.params[voidPermutationIndex] as bigint[])]
      .sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n]);
    await expect(voidReturned.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 60n], [1n, 61n], [2n, 62n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    const returned = StatefulContract.withCategory(inner, categoryId).call.writeReturn(7n, 2n);
    const returnBuilder = await returned.build();
    const returnInput = returnBuilder.inputs.find((candidate) =>
      'abiFunction' in candidate.unlocker && candidate.unlocker.abiFunction.name === 'writeReturn');
    if (!returnInput || !('params' in returnInput.unlocker)) {
      throw new Error('direct writeReturn input is missing');
    }
    const returnPermutationIndex = returnHandler.inputs.findIndex((candidate) =>
      candidate.name.startsWith('__internal__vmapCounterPerm_'));
    expect([...(returnInput.unlocker.params[returnPermutationIndex] as bigint[])]
      .sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n]);
    await expect(returned.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 70n], [1n, 71n], [2n, 72n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeReturn(7n, 1n).emitReturn().send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeReturn', args: [7n, 1n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeSwitch(3n, 1n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 80n], [1n, 81n], [2n, 82n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeSwitch', args: [3n, 2n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 90n], [1n, 91n], [2n, 92n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeInnerSwitch(3n, 1n).send())
      .resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
        events: [{ args: { i: 300n } }, { args: { i: 301n } }, { args: { i: 302n } }],
      });
    for (const [key, expected] of [[0n, 100n], [1n, 101n], [2n, 102n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeInnerSwitch', args: [3n, 2n] }]).send())
      .resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
        events: [{ args: { i: 400n } }, { args: { i: 401n } }, { args: { i: 402n } }],
      });
    for (const [key, expected] of [[0n, 110n], [1n, 111n], [2n, 112n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeUnsigned(3n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 500n], [1n, 501n], [2n, 502n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.checkUnsigned(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeUnsigned', args: [3n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeComputed(2n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of [[0n, 600n], [1n, 601n], [2n, 602n], [3n, 603n]] as const) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, expected).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeComputed', args: [3n, 1n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeComputed(9n, 8n).build())
      .rejects.toThrow(/outside 0\.\.64/);
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeMixed(4n, 9n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkTotal(9n, 3n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeMixed', args: [3n, 9n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkTotal(9n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const owner = hexToBin('01020304');
    await expect(StatefulContract.withCategory(inner, categoryId).call.writeComputedKey(4n, owner).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkHashedTotal(owner, 3n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeComputedKey', args: [3n, owner] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkHashedTotal(owner, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(() => StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'writeComputedKey', args: [1n, owner] },
      { function: 'writeComputedKey', args: [1n, hexToBin('05060708')] },
    ])).toThrow(/computed route witness .* disagrees across batch rows/);
    await expect(StatefulContract.withCategory(inner, categoryId)
      .call.writeNestedInvariant(4n, 7n, owner).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkNestedTotal(7n, owner, 3n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeNestedInvariant', args: [3n, 7n, owner] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkNestedTotal(7n, owner, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('settles conditionally reached counter loops and plans inactive rows as empty', async () => {
    const provider = createTestProvider();
    const artifact = compileString(CONDITIONAL_COUNTER_LOOP_SOURCE, {
      ...KERNEL, maximumInputBytes: 1_000_000,
    });
    const handler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    const permutation = handler.inputs.find((input) => input.name.startsWith('__internal__vmapCounterPerm_'))!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(handler.sortedUpsertLoopInfo?.[0].condition).toEqual({
      kind: 'binary', operator: '&&',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      right: { kind: 'state', name: 'gate' },
    });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { gate: true }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    // The inactive path accepts a source bound above the active loop ceiling because its authenticated domain is
    // exactly empty. This catches unconditional off-chain permutation planning and unconditional on-chain bounds.
    const inactive = contract.call.write(100n, false);
    const inactiveBuilder = await inactive.build();
    const inactiveInput = inactiveBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === 'write');
    if (!inactiveInput || !('params' in inactiveInput.unlocker)) throw new Error('direct write input is missing');
    const directPermutationIndex = handler.inputs.findIndex((input) => input.name === permutation.name);
    expect(inactiveInput.unlocker.params[directPermutationIndex]).toEqual([]);
    const inactiveVm = createVirtualMachineBch2026ForProvider(provider);
    const inactiveTransaction = inactiveBuilder.buildLibauthTransaction();
    const inactiveSources = generateLibauthSourceOutputs(inactiveBuilder.inputs);
    for (let inputIndex = 0; inputIndex < inactiveTransaction.inputs.length; inputIndex += 1) {
      expect(inactiveVm.stateSuccess(inactiveVm.evaluate({
        inputIndex, sourceOutputs: inactiveSources, transaction: inactiveTransaction,
      })), `inactive input ${inputIndex}`).toBe(true);
    }
    await expect(contract.call.write(100n, false).send()).resolves.toMatchObject({ events: [] });

    const routed = contract.batch([
      { function: 'write', args: [100n, false] },
      { function: 'write', args: [3n, true] },
    ]);
    const routedBuilder = await routed.build();
    const routeInput = routedBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!routeInput || !('params' in routeInput.unlocker)) throw new Error('message-bus route input is missing');
    const routePermutation = artifact.messageBus!.route.inputs.findIndex((input) => input.name === permutation.name);
    const routedPermutation = routeInput.unlocker.params[routePermutation] as bigint[][];
    expect(routedPermutation[0]).toEqual([]);
    expect([...routedPermutation[1]].sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n]);
    const receipt = await routed.send();
    expect(receipt.events?.map((event) => event.args.i)).toEqual([0n, 1n, 2n]);
    for (const key of [0n, 1n, 2n]) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(key, key + 10n).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const scopedHandler = artifact.abi.find((candidate) => candidate.name === 'writeScoped')!;
    expect(scopedHandler.entryAccesses).toContainEqual(expect.objectContaining({
      collection: 'scopedGate', slotIndex: 1, operations: ['read'],
    }));
    expect(scopedHandler.sortedUpsertLoopInfo?.[0].condition).toMatchObject({
      kind: 'binary',
      operator: '&&',
      right: {
        kind: 'stateAccess',
        name: 'scopedGate',
        args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 1 } }],
      },
    });
    const missingGate = StatefulContract.withCategory(inner, categoryId).call.writeScoped(100n, 9n, true);
    const missingBuilder = await missingGate.build();
    const missingInput = missingBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === 'writeScoped');
    if (!missingInput || !('params' in missingInput.unlocker)) {
      throw new Error('direct writeScoped input is missing');
    }
    const scopedPermutation = scopedHandler.inputs.findIndex((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'));
    expect(missingInput.unlocker.params[scopedPermutation]).toEqual([]);
    await expect(missingGate.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    await expect(StatefulContract.withCategory(inner, categoryId).call.setScopedGate(7n, true).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const mappedRoute = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'writeScoped', args: [100n, 7n, false] },
      { function: 'writeScoped', args: [2n, 7n, true] },
    ]);
    const mappedBuilder = await mappedRoute.build();
    const mappedRouteInput = mappedBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!mappedRouteInput || !('params' in mappedRouteInput.unlocker)) {
      throw new Error('mapped message-bus route input is missing');
    }
    const scopedPermutationName = scopedHandler.inputs[scopedPermutation].name;
    const scopedRoutePermutation = artifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === scopedPermutationName,
    );
    expect(mappedRouteInput.unlocker.params[scopedRoutePermutation]).toEqual([
      [], expect.arrayContaining([0n, 1n]),
    ]);
    await expect(mappedRoute.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkScoped(0n, 7n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkScoped(1n, 8n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('derives immutable affine loop bounds for direct and routed calls', async () => {
    const provider = createTestProvider();
    const artifact = compileString(AFFINE_COUNTER_MAPPING_SOURCE, KERNEL);
    const handler = artifact.abi.find((candidate) => candidate.name === 'writeAffine')!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeAffine'))
      .toMatchObject({ eligible: true });
    const permutationInput = handler.inputs.find((input) =>
      /^__internal__vmapCounterPerm_n_\d+_bound_n1_from_p1_step_p2$/.test(input.name));
    expect(permutationInput).toMatchObject({ type: 'int256[]' });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const zeroTrip = StatefulContract.withCategory(inner, categoryId).call.writeAffine(0n, 5n);
    await expect(zeroTrip.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const direct = StatefulContract.withCategory(inner, categoryId).call.writeAffine(5n, 10n);
    await expect(direct.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const routedContract = StatefulContract.withCategory(inner, categoryId);
    const routed = routedContract.batch([{ function: 'writeAffine', args: [7n, 20n] }]);
    const routedBuilder = await routed.build();
    const routeInput = routedBuilder.inputs.find((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    if (!routeInput || !('params' in routeInput.unlocker)) throw new Error('message-bus route input is missing');
    const permutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationInput!.name);
    expect(routeInput.unlocker.params[permutationIndex]).toEqual([[1n, 3n, 5n]]);
    await expect(routed.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    for (const key of [1n, 3n, 5n]) {
      await expect(StatefulContract.withCategory(inner, categoryId).check(key, 20n).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
  }, 180_000);

  it('settles an old-entry transition without a row-local fixed key witness', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_RMW_SOURCE, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'credit');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.batchKeyWitnesses).toBeUndefined();
    expect(artifact.abi.find((candidate) => candidate.name === 'credit')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ op: '+', valueScalarParam: 'amount' })]);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    expect(() => contract.batch([{ function: 'credit', args: [130n, 7n] }]))
      .toThrow(/iteration count outside 0\.\.64/);
    const call = contract.batch([{ function: 'credit', args: [8n, 7n] }]);
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const permutationInput = artifact.abi.find((candidate) => candidate.name === 'credit')!.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))!;
    expect(permutationInput.name).toMatch(/_from_p1_step_p2$/);
    const routePermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationInput.name);
    expect(routePermutationIndex).toBeGreaterThanOrEqual(0);
    const rowPermutations = routeUnlocker.params[routePermutationIndex];
    if (!Array.isArray(rowPermutations) || !Array.isArray(rowPermutations[0])) {
      throw new Error('expected row-indexed compiler-derived ranged permutations');
    }
    const originalPermutation = rowPermutations[0];
    if (!Array.isArray(originalPermutation) || originalPermutation.length !== 4) {
      throw new Error('expected a four-element compiler-derived ranged permutation');
    }
    expect([...originalPermutation].sort((left, right) => Number(BigInt(left) - BigInt(right))))
      .toEqual([1n, 3n, 5n, 7n]);

    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const malformedProgression = [...originalPermutation];
    malformedProgression[0] = 2n;
    const duplicate = [...originalPermutation];
    duplicate[0] = duplicate[1];
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    for (const hostilePermutation of [
      originalPermutation.slice(1),
      malformedProgression,
      duplicate,
      [...originalPermutation.slice(0, -1), 9n],
    ]) {
      const hostileRouteParams = [...routeUnlocker.params];
      hostileRouteParams[routePermutationIndex] = [hostilePermutation];
      builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileRouteParams);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      expect(hostileVm.stateSuccess(hostileVm.evaluate({
        inputIndex: routeInputIndex, sourceOutputs, transaction,
      })), `hostile ranged permutation ${hostilePermutation.join(',')}`).not.toBe(true);
    }
    builder.inputs[routeInputIndex].unlocker = routeUnlocker;

    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const key of [1n, 3n, 5n, 7n]) {
      await expect(
        StatefulContract.withCategory(inner, categoryId).check(key, 7n).send(),
      ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    await expect(StatefulContract.withCategory(inner, categoryId).check(0n, 0n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.credit(10n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).check(9n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('finalizes and sends a counter-keyed mapping row with the authenticated permutation', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_SOURCE, KERNEL);
    const handler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    const permutationInput = handler.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'));
    expect(permutationInput).toBeDefined();

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([
      { function: 'write', args: [2n, 10n] },
      { function: 'write', args: [3n, 10n] },
    ]).build()).rejects.toThrow(/read-your-writes transition/);
    await expect(contract.batch([
      { function: 'write', args: [3n, 10n] },
      { function: 'write', args: [3n, 11n] },
    ]).build()).rejects.toThrow(/read-your-writes transition/);
    await expect(contract.batch([
      { function: 'write', args: [3n, 10n] },
      { function: 'write', args: [3n, 10n] },
    ]).build()).rejects.toThrow(/read-your-writes transition/);

    const zeroCall = contract.batch([{ function: 'write', args: [0n, 10n] }]);
    const zeroBuilder = await zeroCall.build();
    const zeroVm = createVirtualMachineBch2026ForProvider(provider);
    const zeroTransaction = zeroBuilder.buildLibauthTransaction();
    const zeroSourceOutputs = generateLibauthSourceOutputs(zeroBuilder.inputs);
    for (let inputIndex = 0; inputIndex < zeroTransaction.inputs.length; inputIndex += 1) {
      expect(zeroVm.stateSuccess(zeroVm.evaluate({
        inputIndex, sourceOutputs: zeroSourceOutputs, transaction: zeroTransaction,
      })), `zero-trip input ${inputIndex}`).toBe(true);
    }
    await expect(zeroCall.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const call = contract.batch([{ function: 'write', args: [3n, 10n] }]);

    for (let build = 0; build < 2; build += 1) {
      const builder = await call.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `build ${build}, input ${inputIndex}`).toBe(true);
      }
    }

    const hostileBuilder = await call.build();
    const routeInputIndex = hostileBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = hostileBuilder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const routePermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationInput!.name);
    expect(routePermutationIndex).toBeGreaterThanOrEqual(0);
    const originalRouteUnlocker = routeUnlocker;
    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const rowPermutations = routeUnlocker.params[routePermutationIndex];
    if (!Array.isArray(rowPermutations) || !Array.isArray(rowPermutations[0])) {
      throw new Error('expected row-indexed compiler-derived permutations');
    }
    const originalPermutation = rowPermutations[0];
    if (!Array.isArray(originalPermutation) || originalPermutation.length !== 3) {
      throw new Error('expected a three-element compiler-derived permutation');
    }
    const validButWrongOrder = [...originalPermutation];
    [validButWrongOrder[0], validButWrongOrder[1]] = [validButWrongOrder[1], validButWrongOrder[0]];
    const hostilePermutations = [
      [0n, 1n], // wrong length
      [0n, 0n, 2n], // duplicate
      [0n, 1n, 3n], // out of range
      [0n, 1n, -1n], // negative
      validButWrongOrder, // a complete permutation which disagrees with the physical entry ordering
    ];
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    for (const hostilePermutation of hostilePermutations) {
      const hostileRouteParams = [...routeUnlocker.params];
      hostileRouteParams[routePermutationIndex] = [hostilePermutation];
      hostileBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileRouteParams);
      const transaction = hostileBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(hostileBuilder.inputs);
      expect(hostileVm.stateSuccess(hostileVm.evaluate({
        inputIndex: routeInputIndex, sourceOutputs, transaction,
      })), `hostile permutation ${hostilePermutation.join(',')}`).not.toBe(true);
    }
    hostileBuilder.inputs[routeInputIndex].unlocker = originalRouteUnlocker;

    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (let key = 0; key < 3; key += 1) {
      await expect(
        StatefulContract.withCategory(inner, categoryId).check(BigInt(key), 10n).send(),
      ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const repeatedClear = contract.batch([
      { function: 'clear', args: [3n] },
      { function: 'clear', args: [3n] },
    ]);
    await expect(repeatedClear.build()).rejects.toThrow(/read-your-writes transition/);
  }, 180_000);
});

describe('kernel direct-selector coexistence', () => {
  it('keeps the selector on a sole public function when the hidden route is also executable', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOLE_FUNCTION_SOURCE, KERNEL);
    expect(artifact.abi).toHaveLength(1);
    expect(artifact.messageBus?.available).toBe(true);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.call.set(7n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(StatefulContract.withCategory(inner, categoryId).getState()).resolves.toMatchObject({ x: 7n });

    const preAvailableArtifact = structuredClone(artifact);
    delete preAvailableArtifact.messageBus!.available;
    const preAvailableInner = new Contract(preAvailableArtifact, [], { provider });
    await expect(
      StatefulContract.withCategory(preAvailableInner, categoryId).call.set(9n).send(),
    ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(
      StatefulContract.withCategory(preAvailableInner, categoryId).getState(),
    ).resolves.toMatchObject({ x: 9n });
  }, 180_000);
});

describe('kernel composite counter-key settlement', () => {
  it('settles sequential counter loops over independent collection journals', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SEQUENTIAL_MULTI_MAPPING_SOURCE, KERNEL);
    const writeBoth = artifact.abi.find((candidate) => candidate.name === 'writeBoth')!;
    expect(writeBoth.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterPerm_')))
      .toHaveLength(2);
    expect(writeBoth.sortedUpsertLoopInfo?.map((info) => info.collection)).toEqual(['a', 'b']);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (let pass = 0; pass < 2; pass += 1) {
      const call = contract.batch([{ function: 'writeBoth', args: [3n, 8n] }]);
      const builder = await call.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `pass ${pass}, input ${inputIndex}`).toBe(true);
      }
      if (pass === 0) {
        const routeInputIndex = builder.inputs.findIndex((input) =>
          'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
        const outputWithValue = (value: number): number => transaction.outputs.findIndex((output) => {
          const commitment = output.token?.nft?.commitment;
          return commitment?.length === 65 && commitment.at(-1) === value;
        });
        const firstSegmentOutput = outputWithValue(10);
        const secondSegmentOutput = outputWithValue(22);
        expect(routeInputIndex).toBeGreaterThanOrEqual(0);
        expect(firstSegmentOutput).toBeGreaterThanOrEqual(0);
        expect(secondSegmentOutput).toBeGreaterThanOrEqual(0);
        const hostile = { ...transaction, outputs: [...transaction.outputs] };
        [hostile.outputs[firstSegmentOutput], hostile.outputs[secondSegmentOutput]] =
          [hostile.outputs[secondSegmentOutput], hostile.outputs[firstSegmentOutput]];
        expect(vm.stateSuccess(vm.evaluate({
          inputIndex: routeInputIndex, sourceOutputs, transaction: hostile,
        })), 'swapped disjoint journal segments').not.toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    const direct = StatefulContract.withCategory(inner, categoryId).call.writeBoth(3n, 8n);
    const directBuilder = await direct.build();
    const directVm = createVirtualMachineBch2026ForProvider(provider);
    const directTransaction = directBuilder.buildLibauthTransaction();
    const directSourceOutputs = generateLibauthSourceOutputs(directBuilder.inputs);
    for (let inputIndex = 0; inputIndex < directTransaction.inputs.length; inputIndex += 1) {
      expect(directVm.stateSuccess(directVm.evaluate({
        inputIndex, sourceOutputs: directSourceOutputs, transaction: directTransaction,
      })), `direct input ${inputIndex}`).toBe(true);
    }
    await expect(direct.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const key of [0n, 1n, 2n]) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.checkA(key, key + 10n).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    for (const key of [2n, 4n, 6n]) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.checkB(key, key + 20n).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
  }, 180_000);

  it('settles two nested counter-key collections for inserts and updates', async () => {
    const provider = createTestProvider();
    const artifact = compileString(NESTED_MULTI_MAPPING_SOURCE, KERNEL);
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(2);
    expect(write.sortedUpsertLoopInfo).toHaveLength(2);
    expect(new Set(write.sortedUpsertLoopInfo?.map((info) => info.varyingArrayParam)).size).toBe(2);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (let pass = 0; pass < 2; pass += 1) {
      const call = contract.batch([{ function: 'write', args: [41n, 42n, 3n] }]);
      const builder = await call.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const entryValues = transaction.outputs
        .map((output) => output.token?.nft?.commitment)
        .filter((commitment): commitment is Uint8Array => commitment?.length === 65)
        .map((commitment) => commitment.at(-1))
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(entryValues).toEqual([10, 11, 12, 20, 21, 22]);
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `pass ${pass}, input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
  }, 180_000);

  it('settles independently selected subsets across collections', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SELECTED_MULTI_MAPPING_SOURCE, KERNEL);
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(2);
    expect(write.sortedUpsertLoopInfo).toHaveLength(2);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (let pass = 0; pass < 2; pass += 1) {
      const call = contract.batch([{ function: 'write', args: [51n, 52n, 4n] }]);
      const builder = await call.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const entryValues = transaction.outputs
        .map((output) => output.token?.nft?.commitment)
        .filter((commitment): commitment is Uint8Array => commitment?.length === 65)
        .map((commitment) => commitment.at(-1))
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(entryValues).toEqual([10, 12, 21, 23]);
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `pass ${pass}, input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
  }, 180_000);

  it('settles a composite key with the counter in multiple positions', async () => {
    const provider = createTestProvider();
    const artifact = compileString(REPEATED_COUNTER_KEY_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({ varyingKeyIndices: [0, 2] }),
    ]);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (const functionName of ['write', 'transform']) {
      const call = contract.batch([{ function: functionName, args: [7n, 3n] }]);
      const builder = await call.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `${functionName}, input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    const valuesBySlot = new Map((await contract.getEntries('nested')).map((entry) => [
      binToHex(entry.slot), entry.value,
    ]));
    for (const [key, expected] of [[0n, 20n], [1n, 22n], [2n, 24n]]) {
      const slot = keyToSlotMulti([bigIntToVmNumber(key), bigIntToVmNumber(7n), bigIntToVmNumber(key)]);
      expect(valuesBySlot.get(binToHex(slot))).toBe(expected);
    }
  }, 180_000);

  it('settles a composite key component derived from the counter', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DERIVED_COUNTER_KEY_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const info = artifact.abi.find((candidate) => candidate.name === 'write')?.sortedUpsertLoopInfo?.[0];
    expect(info?.varyingKeyExpressions).toHaveLength(2);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'write', args: [8n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const valuesBySlot = new Map((await contract.getEntries('nested')).map((entry) => [
      binToHex(entry.slot), entry.value,
    ]));
    for (const [key, expected] of [[3n, 13n], [5n, 15n], [7n, 17n]]) {
      const slot = keyToSlotMulti([bigIntToVmNumber(key + 1n), bigIntToVmNumber(key)]);
      expect(valuesBySlot.get(binToHex(slot))).toBe(expected);
    }
  }, 180_000);

  it('settles repeated loop events in source order while mapping keys use the authenticated permutation', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_MAPPING_EVENT_SOURCE, KERNEL);
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.runtimeLoopEvents).toEqual([
      { repeatCount: 1, eventSignatures: ['Before(int256)'] },
      {
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_/),
        eventSignatures: ['Hit(int256)', 'Echo(int256)'],
      },
      { repeatCount: 1, eventSignatures: ['After(int256)'] },
    ]);
    expect(write.emits).toBeUndefined();
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(3 * 64 + 2);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible).toBe(true);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const eventCommitments = (
      builder: Awaited<ReturnType<ReturnType<typeof contract.call.write>['build']>>,
    ): string[] =>
      builder.buildLibauthTransaction().outputs
        .filter((output) => output.token?.nft?.capability === 'none')
        .map((output) => binToHex(output.token!.nft!.commitment));
    const assertEveryInput = (
      builder: Awaited<ReturnType<ReturnType<typeof contract.call.write>['build']>>,
    ): void => {
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `input ${inputIndex}`).toBe(true);
      }
    };

    // Sixteen iterations produce 32 records, which would exceed BCH's per-item size if the journal were one
    // concatenated vector. Keeping records as individual alt-stack items proves the representation scales past
    // that boundary.
    const directCount = 16;
    const direct = contract.call.write(BigInt(directCount));
    const directBuilder = await direct.build();
    expect(eventCommitments(directBuilder)).toHaveLength(directCount * 2 + 2);
    assertEveryInput(directBuilder);
    const directReceipt = await direct.send();
    expect(directReceipt).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(directReceipt.events?.map((event) => [event.event, event.args.i])).toEqual([
      ['Before', BigInt(directCount)],
      ...Array.from({ length: directCount }, (_unused, index) => [
        ['Hit', BigInt(index)], ['Echo', BigInt(index)],
      ]).flat(),
      ['After', BigInt(directCount)],
    ]);

    const zero = contract.batch([{ function: 'write', args: [0n] }]);
    const zeroBuilder = await zero.build();
    expect(eventCommitments(zeroBuilder)).toEqual(['00', '00']);
    assertEveryInput(zeroBuilder);

    const batch = contract.batch([{ function: 'write', args: [3n] }]);
    const batchBuilder = await batch.build();
    expect(eventCommitments(batchBuilder)).toEqual(['53', '00', '00', '51', '51', '52', '52', '53']);
    assertEveryInput(batchBuilder);

    const routeInputIndex = batchBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const hostileEvents = batchBuilder.outputs
      .map((output, index) => ({ output, index }))
      .filter(({ output }) => output.token?.nft?.capability === 'none');
    expect(hostileEvents).toHaveLength(8);
    [hostileEvents[1].output.token!.nft!.commitment, hostileEvents[3].output.token!.nft!.commitment] = [
      hostileEvents[3].output.token!.nft!.commitment,
      hostileEvents[1].output.token!.nft!.commitment,
    ];
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    const hostileTransaction = batchBuilder.buildLibauthTransaction();
    const hostileSources = generateLibauthSourceOutputs(batchBuilder.inputs);
    expect(hostileVm.stateSuccess(hostileVm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: hostileSources,
      transaction: hostileTransaction,
    }))).not.toBe(true);

    await expect(contract.batch([
      { function: 'write', args: [1n] },
      { function: 'write', args: [1n] },
    ]).build()).rejects.toThrow(/read-your-writes transition/);
  }, 180_000);

  it('plans conditional event paths for direct and routed counter rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(CONDITIONAL_COUNTER_EVENT_SOURCE, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(handler.runtimeLoopEvents).toHaveLength(3);
    expect(handler.runtimeLoopEvents?.every((segment) => segment.conditions?.[0])).toBe(true);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const direct = await contract.call.write(4n, true, true).send();
    expect(direct.events?.map((event) => event.args.i)).toEqual([-1n, 1n, 3n]);

    const routed = contract.batch([{ function: 'write', args: [2n, false, false] }]);
    const builder = await routed.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    const receipt = await routed.send();
    expect(receipt.events?.map((event) => event.args.i)).toEqual([-2n]);
  }, 180_000);

  it('settles independent mapping journals and event streams in physical row order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(INDEPENDENT_ROW_LOOP_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.filter((handler) =>
      handler.name === 'writeA' || handler.name === 'writeB'))
      .toEqual([expect.objectContaining({ eligible: true }), expect.objectContaining({ eligible: true })]);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([
      { function: 'writeB', args: [2n] },
      { function: 'writeA', args: [3n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `independent-row input ${inputIndex}`).toBe(true);
    }
    const receipt = await call.send();
    expect(receipt.events?.map((event) => [event.event, event.args.n ?? event.args.i])).toEqual([
      ['BBefore', 2n], ['BHit', 0n], ['BHit', 1n], ['BAfter', 2n],
      ['ABefore', 3n], ['AHit', 0n], ['AHit', 1n], ['AHit', 2n], ['AAfter', 3n],
    ]);
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkB(1n, 21n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(inner, categoryId).call.checkA(2n, 12n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('settles repeated and zero-trip rows in one physical collection with a shared cardinality witness', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DISJOINT_SAME_COLLECTION_ROWS_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.filter((handler) => handler.name === 'writeA' || handler.name === 'writeB'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'writeA', eligible: true }),
        expect.objectContaining({ name: 'writeB', eligible: true }),
      ]));
    const cardinalityInputs = [
      '__internal__vmapRuntimeInputCount_values',
      '__internal__vmapRuntimeOutputCount_values',
    ];
    for (const name of ['writeA', 'writeB']) {
      const handler = artifact.abi.find((candidate) => candidate.name === name)!;
      expect(handler.inputs.map((input) => input.name)).toEqual(expect.arrayContaining(cardinalityInputs));
    }
    expect(artifact.messageBus!.route.inputs.map((input) => input.name))
      .toEqual(expect.arrayContaining(cardinalityInputs));
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (const group of [1n, 2n, 3n, 4n, 5n, 6n, 7n]) {
      const keys = group === 3n ? [0n, 1n, 10n, 11n] : [0n, 1n];
      if (group === 5n) keys.push(2n, 3n);
      for (const key of keys) {
        await contract.call.seed(group, key, 1n).send();
      }
    }
    const call = contract.batch([
      { function: 'writeB', args: [2n, 20n] },
      { function: 'writeA', args: [0n, 99n] },
      { function: 'writeA', args: [2n, 10n] },
    ]);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const updated = StatefulContract.withCategory(inner, categoryId);
    await expect(updated.call.check(2n, 1n, 20n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(1n, 0n, 10n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.writeSequential(2n, 12n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(3n, 1n, 30n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(3n, 11n, 31n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.writeOverlap(2n).build()).rejects.toThrow(/read-your-writes transition/);
    await expect(updated.call.writeDescending(-1n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(5n, 0n, 50n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(5n, 3n, 53n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.writeAlias(2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(6n, 0n, 60n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(6n, 1n, 61n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.transform(7n, 2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(7n, 0n, 6n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(7n, 1n, 7n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const repeated = updated.batch([{ function: 'transform', args: [7n, 2n] }]);
    const hostileBuilder = await repeated.build();
    const routeInputIndex = hostileBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = hostileBuilder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const oldValueInput = artifact.abi.find((candidate) => candidate.name === 'transform')!.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterOld_'))!;
    const oldValueRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === oldValueInput.name);
    expect(oldValueRouteIndex).toBeGreaterThanOrEqual(0);
    const transformAbi = artifact.abi.find((candidate) => candidate.name === 'transform')!;
    const permutationName = transformAbi.sortedUpsertLoopInfo?.[0].varyingArrayParam;
    const permutationRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationName);
    expect(permutationRouteIndex).toBeGreaterThanOrEqual(0);
    const rowPermutations = routeUnlocker.params[permutationRouteIndex] as bigint[][];
    // Old-value witnesses use the same physical settlement order as the authenticated key permutation.
    expect(routeUnlocker.params[oldValueRouteIndex]).toEqual([
      rowPermutations[0].map((key) => key + 6n),
    ]);
    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[oldValueRouteIndex] = [[999n, ...(routeUnlocker.params[oldValueRouteIndex] as bigint[][])[0]
      .slice(1)]];
    hostileBuilder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    const hostileTransaction = hostileBuilder.buildLibauthTransaction();
    const hostileSourceOutputs = generateLibauthSourceOutputs(hostileBuilder.inputs);
    expect(hostileVm.stateSuccess(hostileVm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs: hostileSourceOutputs, transaction: hostileTransaction,
    }))).not.toBe(true);
    hostileBuilder.inputs[routeInputIndex].unlocker = routeUnlocker;

    await expect(repeated.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(7n, 0n, 12n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(7n, 1n, 14n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    await expect(updated.batch([{ function: 'transform', args: [8n, 2n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(8n, 0n, 5n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(updated.call.check(8n, 1n, 6n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('settles source-order typed calls beside a permuted mapping loop', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sinkArtifact = compileString(COUNTER_MAPPING_TYPED_CALLEE_SOURCE, KERNEL);
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sinkInner = sinkBase.withCategory(hexToBin(sinkSetup.categoryId));
    const sink = StatefulContract.withCategory(sinkInner, sinkSetup.categoryId);

    const callerArtifact = compileString(COUNTER_MAPPING_TYPED_CALLER_SOURCE, KERNEL);
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'invoke')?.eligible).toBe(true);
    expect(callerArtifact.abi.find((entry) => entry.name === 'invoke')?.externalCalls?.[0])
      .toMatchObject({ occurrence: 'loop' });
    const callerBase = new Contract(callerArtifact, [sinkInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(6n), sink.call.ping(1n), sink.call.ping(3n), sink.call.ping(5n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const entryValues = transaction.outputs
      .map((output) => output.token?.nft?.commitment)
      .filter((commitment): commitment is Uint8Array => commitment?.length === 65)
      .map((commitment) => commitment.at(-1))
      .sort((left, right) => (left ?? 0) - (right ?? 0));
    expect(entryValues).toEqual([11, 13, 15]);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `input ${inputIndex}`).toBe(true);
    }

    const wrongOrder = messageBus.compose({
      calls: [caller.call.invoke(6n), sink.call.ping(3n), sink.call.ping(1n), sink.call.ping(5n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(wrongOrder.build()).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const updateFee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const update = messageBus.compose({
      calls: [caller.call.invoke(6n), sink.call.ping(1n), sink.call.ping(3n), sink.call.ping(5n)],
      funder: updateFee,
      changeAddress: updateFee.unlocker.generateLockingBytecode(),
    });
    const updateBuilder = await update.build();
    const updateTransaction = updateBuilder.buildLibauthTransaction();
    const updateSourceOutputs = generateLibauthSourceOutputs(updateBuilder.inputs);
    for (let inputIndex = 0; inputIndex < updateTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: updateSourceOutputs, transaction: updateTransaction,
      })), `update input ${inputIndex}`).toBe(true);
    }
    await expect(update.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('settles the mandatory first iteration of a do-while row at n=0', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sinkArtifact = compileString(COUNTER_MAPPING_TYPED_CALLEE_SOURCE, KERNEL);
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sinkInner = sinkBase.withCategory(hexToBin(sinkSetup.categoryId));
    const sink = StatefulContract.withCategory(sinkInner, sinkSetup.categoryId);

    const callerArtifact = compileString(COUNTER_MAPPING_DO_TYPED_CALLER_SOURCE, KERNEL);
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'invoke')?.eligible).toBe(true);
    expect(callerArtifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_') && input.name.endsWith('_post'))).toBe(true);
    const callerBase = new Contract(callerArtifact, [sinkInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const evaluateAndSend = async (n: bigint): Promise<void> => {
      const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
      const calls = Array.from({ length: Number(n > 0n ? n : 1n) }, (_unused, index) =>
        sink.call.ping(BigInt(index)));
      const composition = messageBus.compose({
        calls: [caller.call.invoke(n), ...calls],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
      });
      const builder = await composition.build();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `n=${n}, input ${inputIndex}`).toBe(true);
      }
      await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    };

    await evaluateAndSend(0n);
    await expect(caller.call.check(0n, 10n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await evaluateAndSend(3n);
    for (let key = 0; key < 3; key += 1) {
      await expect(caller.call.check(BigInt(key), BigInt(key + 10)).send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    }
  }, 180_000);

  it('settles a descending ranged do-while domain', async () => {
    const provider = createTestProvider();
    const artifact = compileString(RANGED_DO_COUNTER_SOURCE, KERNEL);
    const write = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(write.inputs.some((input) => /_from_p5_step_n2_post$/.test(input.name))).toBe(true);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'write', args: [0n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const valuesBySlot = new Map((await contract.getEntries('m')).map((entry) => [
      binToHex(entry.slot), entry.value,
    ]));
    for (const [key, expected] of [[5n, 25n], [3n, 23n], [1n, 21n]]) {
      expect(valuesBySlot.get(binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))).toBe(expected);
    }
  }, 180_000);

  it('authenticates old structs and persists counter-keyed row updates', async () => {
    const provider = createTestProvider();
    const artifact = compileString(COUNTER_STRUCT_RMW_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'update'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(0n, 10n, 20n).send();
    await contract.call.seed(1n, 30n, 40n).send();

    const call = contract.batch([{ function: 'update', args: [3n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      expect(vm.stateSuccess(state), `input ${inputIndex}`).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(0n, 11n, 20n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 31n, 40n).send()).resolves.toBeDefined();
    await expect(contract.call.check(2n, 1n, 0n).send()).resolves.toBeDefined();
  }, 180_000);
});
