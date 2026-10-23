import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
import type { StatefulFunctionCall } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `contract JournalOwnership() {
  struct Pair { int left; int right; }
  mapping(int => int) source;
  mapping(int => int) destination;
  mapping(int => Pair) pairs;
  mapping(int => int) first;
  mapping(int => int) second;
  mapping(int => int) left;
  mapping(int => int) right;

  function seed(int key) public {
    this.source[key] = key + 10;
    this.destination[key] = 0;
    this.pairs[key] = Pair(key, key + 100);
    this.first[key] = 0;
    this.second[key] = 0;
    this.left[key] = 0;
    this.right[key] = 0;
    require(true);
  }
  function runtimeCopy(int count) public {
    for (int i = 0; i < count; i = i + 1) {
      this.destination[i] = this.source[i];
    }
    require(true);
  }
  function updatePairs(int count) public {
    for (int i = 0; i < count; i = i + 1) {
      Pair pair = this.pairs[i];
      pair.left = pair.left + 1;
      this.pairs[i] = pair;
    }
    require(true);
  }
  function writeTwo(int count) public {
    for (int i = 0; i < count; i = i + 1) {
      this.first[i] = i + 1;
      this.second[i] = i + 20;
    }
    require(true);
  }
  function fanout(int count) public {
    for (int i = 0; i < count; i = i + 1) {
      this.left[i] = this.source[i];
      this.right[i] = this.source[i];
    }
    require(true);
  }
  function check(int key, int expectedDestination, int expectedLeft, int expectedRight,
    int expectedFirst, int expectedSecond) public {
    require(this.destination[key] == expectedDestination
      && this.pairs[key].left == expectedLeft && this.pairs[key].right == expectedRight
      && this.first[key] == expectedFirst && this.second[key] == expectedSecond);
  }
  function checkFanout(int key, int expected) public {
    require(this.left[key] == expected && this.right[key] == expected);
  }
}`;

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs, transaction,
  })) === true);
};

describe('kernel journal ownership characterization', () => {
  it('pins kernel and legacy bus boundaries while preserving exact stream topology', () => {
    const artifact = compileString(SOURCE, { ...OPTIONS, messageBusKernel: true });
    for (const name of ['updatePairs']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    }
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeTwo'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'runtimeCopy'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fanout'))
      .toMatchObject({ eligible: true });
    const runtime = artifact.abi.find((fn) => fn.name === 'runtimeCopy')!.sortedUpsertLoopInfo!;
    expect(runtime).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'source', op: 'read', journalAccessStreamIndex: expect.any(Number) }),
      expect.objectContaining({
        collection: 'destination', op: 'set', journalAccessStreamIndex: expect.any(Number),
      }),
    ]));
    expect(new Set(runtime.map((stream) => stream.journalAccessStreamIndex)).size).toBe(2);
    const readStream = runtime.find((stream) => stream.op === 'read')!;
    const mutationStream = runtime.find((stream) => stream.op !== 'read')!;
    expect(readStream.settlementIdentity).toEqual({
      accessStreamIndex: readStream.journalAccessStreamIndex,
      accessOrdinalSource: 'access-program-order',
      recordOrdinalScope: 'global-journal',
      recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
      settlementRole: 'carrier-only',
      settlementOwnership: 'none',
      recordDispositionSource: 'authenticated-carrier',
    });
    expect(mutationStream.settlementIdentity).toEqual({
      accessStreamIndex: mutationStream.journalAccessStreamIndex,
      accessOrdinalSource: 'access-program-order',
      recordOrdinalScope: 'global-journal',
      recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
      settlementRole: 'mutation-settlement',
      settlementOwnership: 'last-mutating-access',
      recordDispositionSource: 'mutation-settlement',
    });

    const local = artifact.abi.find((fn) => fn.name === 'updatePairs')!.sortedUpsertLoopInfo!;
    expect(local).toEqual([expect.objectContaining({
      collection: 'pairs', op: 'set', valueRuntimeLocal: 'pair',
      oldValuesWitnessParam: expect.stringMatching(/^__internal__vmapCounterOld_/),
      journalAccessStreamIndex: expect.any(Number),
      settlementIdentity: {
        accessStreamIndex: local[0].journalAccessStreamIndex,
        accessOrdinalSource: 'access-program-order',
        recordOrdinalScope: 'global-journal',
        recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
        settlementRole: 'mutation-settlement',
        settlementOwnership: 'last-mutating-access',
        recordDispositionSource: 'mutation-settlement',
      },
    })]);

    const two = artifact.abi.find((fn) => fn.name === 'writeTwo')!.sortedUpsertLoopInfo!;
    expect(two).toHaveLength(2);
    expect(new Set(two.map((stream) => stream.journalExecutionGroup)).size).toBe(1);
    expect(new Set(two.map((stream) => stream.journalAccessStreamIndex)).size).toBe(2);
    expect(two.map((stream) => stream.collection)).toEqual(['first', 'second']);
    expect(two.map((stream) => stream.settlementIdentity)).toEqual(two.map((stream) => ({
      accessStreamIndex: stream.journalAccessStreamIndex,
      accessOrdinalSource: 'access-program-order',
      recordOrdinalScope: 'global-journal',
      recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
      settlementRole: 'mutation-settlement',
      settlementOwnership: 'last-mutating-access',
      recordDispositionSource: 'mutation-settlement',
    })));

    const legacy = compileString(SOURCE, { ...OPTIONS, messageBusKernel: false });
    expect(legacy.messageBus?.convention).toBe('legacy-unroll');
    expect(legacy.messageBus?.handlers.find((handler) => handler.name === 'runtimeCopy'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'collection-route-requires-one-parameter-keyed-entry-per-collection',
      });
    expect(legacy.messageBus?.handlers.find((handler) => handler.name === 'updatePairs'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'collection-route-requires-one-parameter-keyed-entry-per-collection',
      });
    expect(legacy.messageBus?.handlers.find((handler) => handler.name === 'writeTwo'))
      .toMatchObject({ eligible: false, rejectionReason: 'handler-route-generation-unsupported' });
  });

  it('preserves authenticated route semantics for a same-key read-to-set transfer', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { ...OPTIONS, messageBusKernel: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'runtimeCopy'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(0n).send();
    await contract.call.seed(1n).send();
    const call = contract.batch([{ function: 'runtimeCopy', args: [2n] }]);
    const builder = await call.build();
    expect(vmAccepts(builder)).toBe(true);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const ownerInput = builder.inputs.findIndex((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(ownerInput).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (const collection of ['source', 'destination']) {
      const address = binToHex(addressToLockScript(getEntryNftAddress(contract.inner, categoryId, collection)));
      const outputs = transaction.outputs.map((output, index) => ({ output, index }))
        .filter(({ output }) => binToHex(output.lockingBytecode) === address);
      expect(outputs).toHaveLength(2);
      const hostile = structuredClone(transaction);
      [hostile.outputs[outputs[0]!.index].token, hostile.outputs[outputs[1]!.index].token] =
        [hostile.outputs[outputs[1]!.index].token, hostile.outputs[outputs[0]!.index].token];
      expect(vm.stateSuccess(vm.evaluate({ inputIndex: ownerInput, sourceOutputs, transaction: hostile }))).not.toBe(true);
    }
  }, 180_000);

  // Released carrier protocol: keep the physical carrier band and final-settlement cursor covered together.
  it('settles one read carrier into two same-row result collections in canonical order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { ...OPTIONS, messageBusKernel: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fanout'))
      .toMatchObject({ eligible: true });
    const fanoutStreams = artifact.abi.find((fn) => fn.name === 'fanout')?.sortedUpsertLoopInfo ?? [];
    expect(fanoutStreams.filter((stream) => stream.op === 'read')).toHaveLength(1);
    expect(fanoutStreams.filter((stream) => stream.op === 'set')).toHaveLength(2);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
    const contract = StatefulContract.withCategory(inner, categoryId);
    // The kernel's physical order is slot order, not source counter order. Seed in the opposite source order so
    // count=2 exercises the shared carrier/output plan independently of insertion order.
    await contract.call.seed(1n).send();
    await contract.call.seed(0n).send();
    const call = contract.batch([{ function: 'fanout', args: [2n] }]);
    const builder = await call.build();
    expect(vmAccepts(builder)).toBe(true);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const routeInput = builder.inputs.findIndex((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInput).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (const collection of ['source', 'left', 'right']) {
      const address = binToHex(addressToLockScript(getEntryNftAddress(contract.inner, categoryId, collection)));
      const outputs = transaction.outputs.map((output, index) => ({ output, index }))
        .filter(({ output }) => binToHex(output.lockingBytecode) === address);
      expect(outputs).toHaveLength(2);
      const hostile = structuredClone(transaction);
      [hostile.outputs[outputs[0]!.index].token, hostile.outputs[outputs[1]!.index].token] =
        [hostile.outputs[outputs[1]!.index].token, hostile.outputs[outputs[0]!.index].token];
      expect(vm.stateSuccess(vm.evaluate({ inputIndex: routeInput, sourceOutputs, transaction: hostile }))).not.toBe(true);
    }
    const routeBuilderInput = builder.inputs[routeInput]!;
    if (!('params' in routeBuilderInput.unlocker)) throw new Error('kernel route has no parameterized unlocker');
    const originalUnlocker = routeBuilderInput.unlocker;
    const journalIndex = originalUnlocker.abiFunction.inputs.findIndex((input) =>
      input.name === '__internal__kernelJournalAccessStreams');
    expect(journalIndex).toBeGreaterThanOrEqual(0);
    const hostileStreams = (originalUnlocker.params[journalIndex] as Uint8Array[][])
      .map((row) => row.map((stream) => new Uint8Array(stream)));
    hostileStreams[0]![0]![0] ^= 0x01;
    const hostileParams = [...originalUnlocker.params];
    hostileParams[journalIndex] = hostileStreams;
    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('kernel route has no selector');
    routeBuilderInput.unlocker = originalUnlocker.contract.createCompilerRouteUnlocker(
      originalUnlocker.abiFunction, hexToBin(routeSelector),
    )(...hostileParams);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInput, sourceOutputs, transaction: builder.buildLibauthTransaction(),
    }))).not.toBe(true);
    routeBuilderInput.unlocker = originalUnlocker;
    await expect(call.send()).resolves.toBeDefined();
    await expect(contract.call.checkFanout(0n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.checkFanout(1n, 11n).send()).resolves.toBeDefined();
  }, 180_000);

  // The released carrier protocol must also authenticate a cold destination entry.
  it('inserts destination entries from authenticated source-only carriers', async () => {
    const source = `contract ReadToSetCarrier() {
      mapping(int => int) source;
      mapping(int => int) destination;
      function seed(int key, int value) public { this.source[key] = value; require(true); }
      function copy(int count) public {
        for (int i = 0; i < count; i = i + 1) this.destination[i] = this.source[i];
        require(true);
      }
      function check(int key, int expected) public { require(this.destination[key] == expected); }
    }`;
    const provider = createTestProvider();
    const artifact = compileString(source, { ...OPTIONS, messageBusKernel: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(0n, 10n).send();
    await contract.call.seed(1n, 11n).send();
    const call = contract.batch([{ function: 'copy', args: [2n] }]);
    const builder = await call.build();
    expect(vmAccepts(builder)).toBe(true);
    // 0x11 is a reserved internal carrier header, never an ingress witness. Changing one authenticated input
    // record to that header must fail before the row loop can consume it.
    const routeInput = builder.inputs.findIndex((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInput).toBeGreaterThanOrEqual(0);
    const routeBuilderInput = builder.inputs[routeInput]!;
    if (!('params' in routeBuilderInput.unlocker)) throw new Error('kernel route has no parameterized unlocker');
    const originalUnlocker = routeBuilderInput.unlocker;
    const hostileParams = [...originalUnlocker.params];
    let changed = false;
    originalUnlocker.abiFunction.inputs.forEach((input, inputIndex) => {
      if (!input.name.startsWith('__internal__kernelJournalRecordSegment_') || changed) return;
      const segment = new Uint8Array(originalUnlocker.params[inputIndex] as Uint8Array);
      for (let index = 0; index + 1 < segment.length; index += 1) {
        if (segment[index] !== 0x05 || segment[index + 1] !== 0x01) continue;
        segment[index + 1] = 0x11;
        hostileParams[inputIndex] = segment;
        changed = true;
        break;
      }
    });
    expect(changed).toBe(true);
    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('kernel route has no selector');
    routeBuilderInput.unlocker = originalUnlocker.contract.createCompilerRouteUnlocker(
      originalUnlocker.abiFunction, hexToBin(routeSelector),
    )(...hostileParams);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: routeInput, sourceOutputs, transaction }))).not.toBe(true);
    routeBuilderInput.unlocker = originalUnlocker;
    await expect(call.send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 11n).send()).resolves.toBeDefined();
  }, 180_000);

  it('preserves fixed-width bytes semantics through direct-entry fallback when its carrier is fenced', async () => {
    const source = `contract BytesCarrier() {
      mapping(int => bytes20) source;
      mapping(int => bytes20) destination;
      function seed(int key, bytes20 value) public { this.source[key] = value; require(true); }
      function copy(int count) public {
        for (int i = 0; i < count; i = i + 1) this.destination[i] = this.source[i];
        require(true);
      }
      function check(int key, bytes20 expected) public { require(this.destination[key] == expected); }
    }`;
    const provider = createTestProvider();
    const artifact = compileString(source, { ...OPTIONS, messageBusKernel: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const first = hexToBin('11'.repeat(20));
    const second = hexToBin('22'.repeat(20));
    await contract.call.seed(0n, first).send();
    await contract.call.seed(1n, second).send();
    const call = contract.call.copy(2n);
    const builder = await call.build();
    expect(vmAccepts(builder)).toBe(true);
    await expect(call.send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, first).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, second).send()).resolves.toBeDefined();
  }, 180_000);

  it('proves legacy-compiled direct-entry semantics and rejects swapped settlement identities', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { ...OPTIONS, messageBusKernel: false });
    expect(artifact.messageBus?.convention).toBe('legacy-unroll');
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {},
      { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(0n).send();
    await contract.call.seed(1n).send();

    const invoke = (functionName: string): StatefulFunctionCall => contract.call[functionName](2n);
    const cases = [
      { functionName: 'runtimeCopy', collections: ['destination'] },
      { functionName: 'updatePairs', collections: ['pairs'] },
      { functionName: 'writeTwo', collections: ['first', 'second'] },
    ];
    for (const testCase of cases) {
      const call = invoke(testCase.functionName);
      const builder = await call.build();
      expect(vmAccepts(builder)).toBe(true);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const targetOutputGroups = testCase.collections.map((collection) => {
        const lockingBytecode = binToHex(addressToLockScript(
          getEntryNftAddress(contract.inner, categoryId, collection),
        ));
        return transaction.outputs.map((output, index) => ({ output, index }))
          .filter(({ output }) => binToHex(output.lockingBytecode) === lockingBytecode)
          .map(({ index }) => index);
      });
      expect(targetOutputGroups.every((indices) => indices.length === 2)).toBe(true);
      const swap = targetOutputGroups.length === 1
        ? targetOutputGroups[0].slice(0, 2)
        : [targetOutputGroups[0][0], targetOutputGroups[1][0]];
      expect(swap).toHaveLength(2);
      expect(swap.every((index) => index !== undefined && index >= 0)).toBe(true);
      const hostile = structuredClone(transaction);
      [hostile.outputs[swap[0]!].token, hostile.outputs[swap[1]!].token] =
        [hostile.outputs[swap[1]!].token, hostile.outputs[swap[0]!].token];
      const ownerInput = builder.inputs.findIndex((input) => 'abiFunction' in input.unlocker
        && input.unlocker.abiFunction.name === testCase.functionName);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      expect(vm.stateSuccess(vm.evaluate({ inputIndex: ownerInput, sourceOutputs, transaction: hostile })))
        .not.toBe(true);
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    await expect(contract.call.check(0n, 10n, 1n, 100n, 1n, 20n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 11n, 2n, 101n, 2n, 21n).send()).resolves.toBeDefined();
  }, 180_000);

});
