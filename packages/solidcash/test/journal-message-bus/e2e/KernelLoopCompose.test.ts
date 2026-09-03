import { binToHex, hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, SignatureAlgorithm, SignatureTemplate, StatefulContract, messageBus,
} from '../../../src/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
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
  function write(int prefix, int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.a[prefix][i] = i + 10;
      this.b[prefix][i] = i + 20;
    }
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

const COUNTER_MAPPING_TYPED_CALLER_SOURCE = `pragma solidcash ^0.13.0;
interface IKernelCounterSink { function ping(int value); }
contract KernelCounterCaller(address sink) {
  mapping(int => int) m;
  function invoke(int n) public {
    for (int i = 1; i < n; i = i + 2) {
      this.m[i] = i + 10;
      IKernelCounterSink(sink).ping(i);
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
    const originalPermutation = routeUnlocker.params[routePermutationIndex];
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
      hostileRouteParams[routePermutationIndex] = hostilePermutation;
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
    expect(() => contract.batch([
      { function: 'write', args: [2n, 10n] },
      { function: 'write', args: [3n, 10n] },
    ])).toThrow(/row-scoped journal settlement/);
    expect(() => contract.batch([
      { function: 'write', args: [3n, 10n] },
      { function: 'write', args: [3n, 11n] },
    ])).toThrow(/row-scoped journal settlement/);
    const repeatedCall = contract.batch([
      { function: 'write', args: [3n, 10n] },
      { function: 'write', args: [3n, 10n] },
    ]);
    const repeatedBuilder = await repeatedCall.build();
    const repeatedVm = createVirtualMachineBch2026ForProvider(provider);
    const repeatedTransaction = repeatedBuilder.buildLibauthTransaction();
    const repeatedSourceOutputs = generateLibauthSourceOutputs(repeatedBuilder.inputs);
    for (let inputIndex = 0; inputIndex < repeatedTransaction.inputs.length; inputIndex += 1) {
      expect(repeatedVm.stateSuccess(repeatedVm.evaluate({
        inputIndex, sourceOutputs: repeatedSourceOutputs, transaction: repeatedTransaction,
      })), `repeated-row input ${inputIndex}`).toBe(true);
    }
    await expect(repeatedCall.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

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
    const originalPermutation = routeUnlocker.params[routePermutationIndex];
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
      hostileRouteParams[routePermutationIndex] = hostilePermutation;
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
    await expect(repeatedClear.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (let key = 0; key < 3; key += 1) {
      await expect(
        StatefulContract.withCategory(inner, categoryId).check(BigInt(key), 0n).send(),
      ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
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
    expect(write.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(1);
    expect(write.sortedUpsertLoopInfo).toHaveLength(2);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (let pass = 0; pass < 2; pass += 1) {
      const call = contract.batch([{ function: 'write', args: [41n, 3n] }]);
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

    expect(() => contract.batch([
      { function: 'write', args: [1n] },
      { function: 'write', args: [1n] },
    ])).toThrow(/row-scoped journal settlement/);
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
});
