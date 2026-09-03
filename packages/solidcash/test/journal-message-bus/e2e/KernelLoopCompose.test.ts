import { hexToBin } from '@bitauth/libauth';
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
  function check(int expected) public { require(this.x == expected); }
}`;

const COUNTER_MAPPING_SOURCE = `pragma solidcash ^0.13.0;
contract KernelCounterMapping() {
  mapping(int => int) m;
  function valueFor(int i) internal pure returns (int) { return i + 10; }
  function write(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = valueFor(i);
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

const COUNTER_MAPPING_EVENT_SOURCE = `pragma solidcash ^0.13.0;
event Hit(int i);
contract KernelCounterMappingEvent() {
  mapping(int => int) m;
  function write(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 10;
      emit Hit(i);
    }
    require(true);
  }
}`;

const COUNTER_MAPPING_TYPED_CALLER_SOURCE = `pragma solidcash ^0.13.0;
interface IKernelCounterSink { function ping(int value); }
contract KernelCounterCaller(address sink) {
  mapping(int => int) m;
  function invoke(int n) public {
    for (int i = 0; i < n; i = i + 1) {
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
});

describe('kernel counter-key mapping loop compose', () => {
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
      { function: 'write', args: [3n] },
      { function: 'write', args: [3n] },
    ])).toThrow(/row-scoped journal settlement/);

    const zeroCall = contract.batch([{ function: 'write', args: [0n] }]);
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

    const call = contract.batch([{ function: 'write', args: [3n] }]);

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
        StatefulContract.withCategory(inner, categoryId).check(BigInt(key), BigInt(key + 10)).send(),
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

  it('fails closed before composing a repeated event in a counter-keyed loop', () => {
    const artifact = compileString(COUNTER_MAPPING_EVENT_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.available).toBe(false);
  });

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
      calls: [caller.call.invoke(3n), sink.call.ping(0n), sink.call.ping(1n), sink.call.ping(2n)],
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
    expect(entryValues).toEqual([10, 11, 12]);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `input ${inputIndex}`).toBe(true);
    }

    const wrongOrder = messageBus.compose({
      calls: [caller.call.invoke(3n), sink.call.ping(1n), sink.call.ping(0n), sink.call.ping(2n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(wrongOrder.build()).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const updateFee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const update = messageBus.compose({
      calls: [caller.call.invoke(3n), sink.call.ping(0n), sink.call.ping(1n), sink.call.ping(2n)],
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
