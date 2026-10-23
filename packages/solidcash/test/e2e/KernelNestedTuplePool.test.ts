import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { compileString, compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { registerDeployment } from '../../src/stateful/deployment-registry.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const SOURCE = `contract NestedTuplePool() {
  mapping(uint => mapping(uint => uint)) values;
  function set(uint outer, uint inner, uint value) public {
    this.values[outer][inner] = value;
    require(true);
  }
  function setReversed(uint inner, uint outer, uint value) public {
    this.values[outer][inner] = value;
    require(true);
  }
}`;

const OPTIONS = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

const GRAPH_SOURCE = `pragma solidity ^0.8.0;
  interface ILedger { function set(uint outer, uint inner, uint value) external; }
  contract Ledger {
    mapping(uint => mapping(uint => uint)) values;
    function set(uint outer, uint inner, uint value) public {
      values[outer][inner] = value;
      require(true);
    }
  }
  contract Driver(address target) {
    function run() public {
      for (uint i = 0; i < 3; i = i + 1) ILedger(target).set(1, i, i + 10);
      require(true);
    }
    function runLimited(uint count) public {
      require(count <= 3);
      for (uint i = 0; i < count; i = i + 1) ILedger(target).set(2, i, i + 20);
      require(true);
    }
    function runTargets(address[] targets) public {
      for (uint i = 0; i < targets.length; i = i + 1) ILedger(targets[i]).set(3, i, i + 30);
      require(true);
    }
  }`;

const GRAPH_OPTIONS = {
  ...OPTIONS, messageBusGraphContext: true, messageBusEntryPoolCapacity: 3,
  evmCompat: true, suppressWarnings: true, optimizeForCompilationSpeed: true,
} as const;

type NestedTuple = readonly [bigint, bigint, bigint];

async function settleTuples(
  tuples: readonly NestedTuple[], capacity?: number, expectedTuples: readonly NestedTuple[] = tuples,
): Promise<void> {
  const artifact = compileString(SOURCE, {
    ...OPTIONS, ...(capacity === undefined ? {} : { messageBusEntryPoolCapacity: capacity }),
  });
  expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
    .toMatchObject({ eligible: true });
  const provider = createMessageBusCapstoneTestProvider();
  const inner = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
  const contract = StatefulContract.withCategory(inner, categoryId);
  await expect(contract.batch(tuples.map(([outer, nested, value], index) => ({
    function: index === 1 ? 'setReversed' : 'set',
    args: index === 1 ? [nested, outer, value] : [outer, nested, value],
  }))).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

  const entries = await contract.getEntries('values');
  expect(entries).toHaveLength(expectedTuples.length);
  for (const [outer, nested, value] of expectedTuples) {
    const slot = keyToSlotMulti([bigIntToVmNumber(outer), bigIntToVmNumber(nested)]);
    expect(entries.find((entry) => binToHex(entry.slot) === binToHex(slot))?.value).toBe(value);
  }
}

describe('kernel complete nested-mapping tuple pool', () => {
  it('settles two distinct nested keys with the default complete tuple lanes', async () => {
    await settleTuples([[1n, 2n, 11n], [2n, 1n, 22n]]);
  }, 180_000);

  it('settles three distinct nested keys with three authenticated tuple lanes', async () => {
    await settleTuples([[1n, 2n, 11n], [2n, 1n, 22n], [1n, 3n, 33n]], 3);
  }, 180_000);

  it('reuses the first pending nested tuple after all three lanes are occupied', async () => {
    await settleTuples(
      [[1n, 2n, 11n], [2n, 1n, 22n], [1n, 3n, 33n], [1n, 2n, 44n]],
      3,
      [[1n, 2n, 44n], [2n, 1n, 22n], [1n, 3n, 33n]],
    );
  }, 180_000);

  it('rejects a cross-lane nested key substituted into an authenticated row', async () => {
    const artifact = compileString(SOURCE, { ...OPTIONS, messageBusEntryPoolCapacity: 3 });
    const provider = createMessageBusCapstoneTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, {
      saltContract: true,
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const rows = [
      { function: 'set', args: [1n, 2n, 11n] },
      { function: 'setReversed', args: [1n, 2n, 22n] },
      { function: 'set', args: [1n, 3n, 33n] },
    ];
    const builder = await contract.batch(rows).build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const batchBlobIndex = artifact.messageBus!.route.inputs.findIndex((input) => input.name === 'batchBlob');
    expect(batchBlobIndex).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs, transaction: builder.buildLibauthTransaction(),
    }))).toBe(true);

    // The row asks for (2,3), combining the second lane's outer key with the third lane's inner key.
    // Keep every original witness and physical input unchanged so only the source tuple differs.
    const forged = messageBus.encodeMessageBatch(artifact, [
      rows[0], rows[1], { function: 'set', args: [2n, 3n, 33n] },
    ]);
    const selector = artifact.messageBus!.route.selector;
    if (!selector) throw new Error('message-bus route has no selector');
    const hostileParams = [...routeUnlocker.params];
    hostileParams[batchBlobIndex] = forged.blob;
    builder.inputs[routeInputIndex].unlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(selector),
    )(...hostileParams);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    }))).not.toBe(true);
  }, 180_000);

  it('settles three nested tuple lanes reached through a typed foreign-call loop', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    expect(artifacts.Ledger.messageBus?.handlers.find((handler) => handler.name === 'set')
      ?.physicalEntrySlotAlternatives).toEqual([[0, 1, 2]]);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x62), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const ledgerInner = new Contract(artifacts.Ledger, [], { provider });
    const ledgerSetup = await setupStatefulUtxos(
      provider, ledgerInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const ledger = StatefulContract.withCategory(ledgerInner, ledgerSetup.categoryId).connect(signer);
    const driverInner = new Contract(artifacts.Driver, [ledger.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', ledger);
    const receipt = await driver.call.run().send();
    expect(receipt).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const entries = await ledger.getEntries('values');
    expect(entries).toHaveLength(3);
    for (let inner = 0n; inner < 3n; inner += 1n) {
      const slot = keyToSlotMulti([bigIntToVmNumber(1n), bigIntToVmNumber(inner)]);
      expect(entries.find((entry) => binToHex(entry.slot) === binToHex(slot))?.value).toBe(inner + 10n);
    }
  }, 180_000);

  it('refuses a signerless typed loop before broadcasting a one-call prefix', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const ledgerInner = new Contract(artifacts.Ledger, [], { provider });
    const ledgerSetup = await setupStatefulUtxos(
      provider, ledgerInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const ledger = StatefulContract.withCategory(ledgerInner, ledgerSetup.categoryId);
    const driverInner = new Contract(artifacts.Driver, [ledger.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId);
    driver._registerResolvedExternal('ILedger', ledger);
    await expect(driver.call.run().build()).rejects.toThrow(
      /typed loop callsite 0 requires atomic composition; connect a signer/,
    );
    await expect(driver.call.run().send()).rejects.toThrow(
      /typed loop callsite 0 requires atomic composition; connect a signer/,
    );
    expect(await ledger.getEntries('values')).toHaveLength(0);
    await expect(driver.call.runLimited(0n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(await ledger.getEntries('values')).toHaveLength(0);
  }, 180_000);

  it('promotes a potentially repeated typed loop across zero, one and two rows', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const loopEdge = artifacts.Driver.abi.find((entry) => entry.name === 'runLimited')?.externalCalls?.[0];
    expect(loopEdge).toMatchObject({ occurrence: 'loop', iterationDomain: expect.any(Object) });
    expect(loopEdge?.maximumOccurrences).toBeGreaterThan(1);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x63), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const ledgerInner = new Contract(artifacts.Ledger, [], { provider });
    const ledgerSetup = await setupStatefulUtxos(
      provider, ledgerInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const ledger = StatefulContract.withCategory(ledgerInner, ledgerSetup.categoryId).connect(signer);
    const driverInner = new Contract(artifacts.Driver, [ledger.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', ledger);
    await expect(driver.call.runLimited(1n).build()).rejects.toThrow(/requires atomic composition/);
    await expect(driver.call.runLimited(0n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(await ledger.getEntries('values')).toHaveLength(0);
    await expect(driver.call.runLimited(1n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const entries = await ledger.getEntries('values');
    expect(entries).toHaveLength(1);
    const slot = keyToSlotMulti([bigIntToVmNumber(2n), bigIntToVmNumber(0n)]);
    expect(entries.find((entry) => binToHex(entry.slot) === binToHex(slot))?.value).toBe(20n);
    await expect(driver.call.runLimited(2n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const updatedEntries = await ledger.getEntries('values');
    expect(updatedEntries).toHaveLength(2);
    const secondSlot = keyToSlotMulti([bigIntToVmNumber(2n), bigIntToVmNumber(1n)]);
    expect(updatedEntries.find((entry) => binToHex(entry.slot) === binToHex(secondSlot))?.value).toBe(21n);
  }, 180_000);

  it('routes a typed loop to runtime-deployed bytecode instead of the registered default', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract LedgerAlt {
        mapping(uint => mapping(uint => uint)) values;
        function set(uint outer, uint inner, uint value) public {
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    expect(altArtifact.bytecode).not.toBe(artifacts.Ledger.bytecode);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x64), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const ledgerInner = new Contract(artifacts.Ledger, [], { provider });
    const ledgerSetup = await setupStatefulUtxos(
      provider, ledgerInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const ledger = StatefulContract.withCategory(ledgerInner, ledgerSetup.categoryId).connect(signer);
    const altInner = new Contract(altArtifact, [], { provider });
    const altSetup = await setupStatefulUtxos(
      provider, altInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const alt = StatefulContract.withCategory(altInner, altSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: alt.target,
      lockingBytecode: alt.inner.lockingBytecode,
      contract: alt,
    });
    const driverInner = new Contract(artifacts.Driver, [alt.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', ledger);
    await expect(driver.call.runLimited(2n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(await ledger.getEntries('values')).toHaveLength(0);
    const altEntries = await alt.getEntries('values');
    expect(altEntries).toHaveLength(2);
    for (let inner = 0n; inner < 2n; inner += 1n) {
      const slot = keyToSlotMulti([bigIntToVmNumber(2n), bigIntToVmNumber(inner)]);
      expect(altEntries.find((entry) => binToHex(entry.slot) === binToHex(slot))?.value).toBe(inner + 120n);
    }
  }, 180_000);

  it('settles a mixed-owner typed loop with one repeated callee', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x65), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const createLedger = async (): Promise<StatefulContract> => {
      const inner = new Contract(artifacts.Ledger, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, inner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(inner, setup.categoryId).connect(signer);
    };
    const first = await createLedger();
    const second = await createLedger();
    registerDeployment(provider, {
      contractName: artifacts.Ledger.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(first.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const firstEntries = await first.getEntries('values');
    const secondEntries = await second.getEntries('values');
    expect(firstEntries).toHaveLength(2);
    expect(secondEntries).toHaveLength(1);
    for (const inner of [0n, 2n]) {
      const slot = keyToSlotMulti([bigIntToVmNumber(3n), bigIntToVmNumber(inner)]);
      expect(firstEntries.find((entry) => binToHex(entry.slot) === binToHex(slot))?.value).toBe(inner + 30n);
    }
    const secondSlot = keyToSlotMulti([bigIntToVmNumber(3n), bigIntToVmNumber(1n)]);
    expect(secondEntries.find((entry) => binToHex(entry.slot) === binToHex(secondSlot))?.value).toBe(31n);
  }, 180_000);

  it('settles a mixed-owner loop with a different runtime callee layout', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract AuditedLedger {
        mapping(uint => mapping(uint => uint)) values;
        mapping(uint => uint) audit;
        function set(uint outer, uint inner, uint value) public {
          values[outer][inner] = value + 100;
          audit[inner] = value + 200;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    expect(altArtifact.bytecode).not.toBe(artifacts.Ledger.bytecode);
    expect(altArtifact.messageBus!.route.blockLayout!.blockSize)
      .toBeGreaterThan(artifacts.Ledger.messageBus!.route.blockLayout!.blockSize);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x66), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(first.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await first.getEntries('values')).toHaveLength(2);
    const secondValues = await second.getEntries('values');
    const secondAudit = await second.getEntries('audit');
    expect(secondValues).toHaveLength(1);
    expect(secondAudit).toHaveLength(1);
    const valueSlot = keyToSlotMulti([bigIntToVmNumber(3n), bigIntToVmNumber(1n)]);
    expect(secondValues.find((entry) => binToHex(entry.slot) === binToHex(valueSlot))?.value).toBe(131n);
    expect(secondAudit[0]?.value).toBe(231n);
  }, 180_000);

  it('settles a mixed-owner loop with two distinct singleton insert lanes', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract AuditedLedger {
        mapping(uint => mapping(uint => uint)) values;
        mapping(uint => uint) audit;
        mapping(uint => uint) metrics;
        function set(uint outer, uint inner, uint value) public {
          values[outer][inner] = value + 100;
          audit[inner] = value + 200;
          metrics[inner] = value + 300;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x67), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(first.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const secondValues = await second.getEntries('values');
    expect(secondValues).toHaveLength(1);
    const valueSlot = keyToSlotMulti([bigIntToVmNumber(3n), bigIntToVmNumber(1n)]);
    expect(secondValues.find((entry) => binToHex(entry.slot) === binToHex(valueSlot))?.value).toBe(131n);
    expect((await second.getEntries('audit'))[0]?.value).toBe(231n);
    expect((await second.getEntries('metrics'))[0]?.value).toBe(331n);
  }, 180_000);

  it('settles a repeated mixed-layout callee with a singleton before its complete batch', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract AuditedLedger {
        mapping(uint => uint) audit;
        mapping(uint => mapping(uint => uint)) values;
        function set(uint outer, uint inner, uint value) public {
          audit[inner] = value + 200;
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x68), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(second.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const secondValues = await second.getEntries('values');
    expect(secondValues).toHaveLength(2);
    for (const inner of [1n, 2n]) {
      const valueSlot = keyToSlotMulti([bigIntToVmNumber(3n), bigIntToVmNumber(inner)]);
      expect(secondValues.find((entry) => binToHex(entry.slot) === binToHex(valueSlot))?.value)
        .toBe(inner + 130n);
    }
    const audits = await second.getEntries('audit');
    expect(audits).toHaveLength(2);
    expect(audits.map((entry) => entry.value).sort()).toEqual([231n, 232n]);
  }, 180_000);

  it('selects independent tuple lanes when one collection key repeats', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract AuditedLedger {
        mapping(uint => uint) audit;
        mapping(uint => mapping(uint => uint)) values;
        function set(uint outer, uint inner, uint value) public {
          audit[outer] = value + 200;
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x69), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(second.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const secondValues = await second.getEntries('values');
    expect(secondValues).toHaveLength(2);
    for (const inner of [1n, 2n]) {
      const valueSlot = keyToSlotMulti([bigIntToVmNumber(3n), bigIntToVmNumber(inner)]);
      expect(secondValues.find((entry) => binToHex(entry.slot) === binToHex(valueSlot))?.value)
        .toBe(inner + 130n);
    }
    const audits = await second.getEntries('audit');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.value).toBe(232n);
  }, 180_000);

  it('accumulates a repeated key across all three independent tuple lanes', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract AuditedLedger {
        mapping(uint => uint) audit;
        mapping(uint => mapping(uint => uint)) values;
        function set(uint outer, uint inner, uint value) public {
          audit[outer] = audit[outer] + value;
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6a), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(second.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(second.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const secondValues = await second.getEntries('values');
    expect(secondValues).toHaveLength(3);
    for (const inner of [0n, 1n, 2n]) {
      const valueSlot = keyToSlotMulti([bigIntToVmNumber(3n), bigIntToVmNumber(inner)]);
      expect(secondValues.find((entry) => binToHex(entry.slot) === binToHex(valueSlot))?.value)
        .toBe(inner + 130n);
    }
    const audits = await second.getEntries('audit');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.value).toBe(93n);
  }, 180_000);

  it('settles an inactive collection lane beside an active nested tuple batch', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract AuditedLedger {
        mapping(uint => uint) audit;
        mapping(uint => mapping(uint => uint)) values;
        function set(uint outer, uint inner, uint value) public {
          if (inner == 1) { audit[outer] = value + 200; }
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    expect(altArtifact.abi.find((candidate) => candidate.name === 'set')?.entryAccesses?.[0]?.activation)
      .toMatchObject({ kind: 'binary', operator: '==' });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6b), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(second.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const secondValues = await second.getEntries('values');
    expect(secondValues).toHaveLength(2);
    for (const inner of [1n, 2n]) {
      const valueSlot = keyToSlotMulti([bigIntToVmNumber(3n), bigIntToVmNumber(inner)]);
      expect(secondValues.find((entry) => binToHex(entry.slot) === binToHex(valueSlot))?.value)
        .toBe(inner + 130n);
    }
    const audits = await second.getEntries('audit');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.value).toBe(231n);
  }, 180_000);

  it('rejects a conditional entry driven by a reassigned row parameter', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract AuditedLedger {
        mapping(uint => uint) audit;
        mapping(uint => mapping(uint => uint)) values;
        function set(uint outer, uint inner, uint value) public {
          value = value + 1;
          if (value == 31) { audit[outer] = value + 200; }
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    expect(altArtifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6c), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(second.inner.lockingBytecode),
    ]).send()).rejects.toThrow();
    expect(await second.getEntries('values')).toHaveLength(0);
    expect(await second.getEntries('audit')).toHaveLength(0);
  }, 180_000);

  it('settles an ordered conditional entry driven by an immutable local alias', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract AuditedLedger {
        mapping(uint => uint) audit;
        mapping(uint => mapping(uint => uint)) values;
        function set(uint outer, uint inner, uint value) public {
          uint selected = inner;
          if (selected > 1) { audit[inner] = value + 200; }
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    expect(altArtifact.abi.find((candidate) => candidate.name === 'set')?.entryAccesses?.[0]?.activation)
      .toMatchObject({ kind: 'binary', operator: '>', left: { kind: 'source', source: { paramIndex: 1 } } });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6d), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(second.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await second.getEntries('values')).toHaveLength(2);
    const audits = await second.getEntries('audit');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.value).toBe(232n);
  }, 180_000);

  it('keeps an untaken conditional mapping entry absent on a direct call', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract AuditedLedger {
        mapping(uint => uint) audit;
        mapping(uint => mapping(uint => uint)) values;
        function set(uint outer, uint inner, uint value) public {
          uint selected = inner;
          if (selected > 1) { audit[inner] = value + 200; }
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6e), provider);
    for (let index = 0; index < 8; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const ledger = StatefulContract.withCategory(inner, setup.categoryId).connect(signer);
    await expect(ledger.call.set(3n, 1n, 31n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await ledger.getEntries('values')).toHaveLength(1);
    expect(await ledger.getEntries('audit')).toHaveLength(0);
    await expect(ledger.call.set(3n, 2n, 32n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await ledger.getEntries('values')).toHaveLength(2);
    const audits = await ledger.getEntries('audit');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.value).toBe(232n);
  }, 180_000);

  it('routes exclusive mapping arms without materializing the untaken entry', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract ExclusiveLedger {
        mapping(uint => uint) audit;
        mapping(uint => uint) skipped;
        mapping(uint => mapping(uint => uint)) values;
        function set(uint outer, uint inner, uint value) public {
          uint selected = inner;
          if (selected > 1) { audit[inner] = value + 200; }
          else { skipped[inner] = value + 300; }
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6f), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(second.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await second.getEntries('values')).toHaveLength(2);
    const audits = await second.getEntries('audit');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.value).toBe(232n);
    const skipped = await second.getEntries('skipped');
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.value).toBe(331n);
  }, 180_000);

  it('routes exclusive keys in one mapping without materializing untaken keys', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract ExclusiveKeysLedger {
        mapping(uint => uint) audit;
        mapping(uint => mapping(uint => uint)) values;
        function set(uint outer, uint inner, uint value) public {
          uint selected = inner;
          if (selected > 1) { audit[inner] = value + 200; }
          else { audit[outer] = value + 300; }
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x70), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(second.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await second.getEntries('values')).toHaveLength(2);
    const audits = await second.getEntries('audit');
    expect(audits).toHaveLength(2);
    for (const [key, expected] of [[2n, 232n], [3n, 331n]] as const) {
      const slot = keyToSlotMulti([bigIntToVmNumber(key)]);
      expect(audits.find((entry) => binToHex(entry.slot) === binToHex(slot))?.value).toBe(expected);
    }
  }, 180_000);

  it('routes conditional delete without creating an untaken mapping entry', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract DeletingLedger {
        mapping(uint => uint) audit;
        mapping(uint => uint) trace;
        mapping(uint => mapping(uint => uint)) values;
        function seed(uint inner, uint value) public {
          audit[inner] = value;
          require(true);
        }
        function set(uint outer, uint inner, uint value) public {
          uint selected = inner;
          if (selected > 1) { delete audit[inner]; }
          trace[inner] = value + 50;
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    expect(altArtifact.abi.find((candidate) => candidate.name === 'set')?.entryAccesses
      ?.find((access) => access.collection === 'audit')?.activation)
      .toMatchObject({ kind: 'binary', operator: '>' });
    expect(altArtifact.messageBus?.handlers.find((candidate) => candidate.name === 'set')
      ?.batchKeyWitnesses?.filter((binding) => binding.keyPool && binding.entryTupleGroup === undefined))
      .toHaveLength(2);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x71), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    await second.call.seed(2n, 999n).send();
    expect(await second.getEntries('audit')).toHaveLength(1);
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(second.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await second.getEntries('values')).toHaveLength(2);
    const traces = await second.getEntries('trace');
    expect(traces).toHaveLength(2);
    for (const [key, expected] of [[1n, 81n], [2n, 82n]] as const) {
      const slot = keyToSlotMulti([bigIntToVmNumber(key)]);
      expect(traces.find((entry) => binToHex(entry.slot) === binToHex(slot))?.value).toBe(expected);
    }
    const audits = await second.getEntries('audit');
    expect(audits).toHaveLength(1);
    expect(binToHex(audits[0]!.slot)).toBe(binToHex(keyToSlotMulti([bigIntToVmNumber(2n)])));
    expect(audits[0]!.value).toBe(0n);
  }, 180_000);

  it('keeps an untaken conditional delete absent on a direct call', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract DirectDelete {
        mapping(uint => uint) audit;
        function seed(uint key, uint value) public {
          audit[key] = value;
          require(true);
        }
        function erase(uint key) public {
          uint selected = key;
          if (selected > 1) { delete audit[key]; }
          require(true);
        }
      }`, GRAPH_OPTIONS);
    expect(artifact.abi.find((candidate) => candidate.name === 'erase')?.entryAccesses?.[0]?.activation)
      .toMatchObject({ kind: 'binary', operator: '>' });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x72), provider);
    for (let index = 0; index < 8; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, setup.categoryId).connect(signer);
    await contract.call.seed(2n, 999n).send();
    await expect(contract.call.erase(1n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const afterUntaken = await contract.getEntries('audit');
    expect(afterUntaken).toHaveLength(1);
    expect(binToHex(afterUntaken[0]!.slot)).toBe(binToHex(keyToSlotMulti([bigIntToVmNumber(2n)])));
    expect(afterUntaken[0]!.value).toBe(999n);
    await expect(contract.call.erase(2n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const afterTaken = await contract.getEntries('audit');
    expect(afterTaken).toHaveLength(1);
    expect(afterTaken[0]!.value).toBe(0n);
  }, 180_000);

  it('routes delete-or-write arms without creating untaken mapping entries', async () => {
    const artifacts = compileStringMulti(GRAPH_SOURCE, GRAPH_OPTIONS);
    const altArtifact = compileString(`pragma solidity ^0.8.0;
      contract DeleteOrWriteLedger {
        mapping(uint => uint) audit;
        mapping(uint => uint) skipped;
        mapping(uint => mapping(uint => uint)) values;
        function seed(uint key, uint value) public {
          audit[key] = value;
          require(true);
        }
        function set(uint outer, uint inner, uint value) public {
          uint selected = inner;
          if (selected > 1) { delete audit[inner]; }
          else { skipped[inner] = value + 300; }
          values[outer][inner] = value + 100;
          require(true);
        }
      }`, GRAPH_OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x73), provider);
    for (let index = 0; index < 18; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const firstInner = new Contract(artifacts.Ledger, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstInner, artifacts.Ledger.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(firstInner, firstSetup.categoryId).connect(signer);
    const secondInner = new Contract(altArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondInner, altArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(secondInner, secondSetup.categoryId).connect(signer);
    await second.call.seed(2n, 999n).send();
    registerDeployment(provider, {
      contractName: altArtifact.contractName,
      address: second.target,
      lockingBytecode: second.inner.lockingBytecode,
      contract: second,
    });
    const driverInner = new Contract(artifacts.Driver, [first.inner.lockingBytecode], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverInner, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(driverInner, driverSetup.categoryId).connect(signer);
    driver._registerResolvedExternal('ILedger', first);
    await expect(driver.call.runTargets([
      hexToBin(first.inner.lockingBytecode), hexToBin(second.inner.lockingBytecode),
      hexToBin(second.inner.lockingBytecode),
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await second.getEntries('values')).toHaveLength(2);
    const audits = await second.getEntries('audit');
    expect(audits).toHaveLength(1);
    expect(binToHex(audits[0]!.slot)).toBe(binToHex(keyToSlotMulti([bigIntToVmNumber(2n)])));
    expect(audits[0]!.value).toBe(0n);
    const skipped = await second.getEntries('skipped');
    expect(skipped).toHaveLength(1);
    expect(binToHex(skipped[0]!.slot)).toBe(binToHex(keyToSlotMulti([bigIntToVmNumber(1n)])));
    expect(skipped[0]!.value).toBe(331n);
  }, 180_000);

  it('keeps a bool-guarded mapping write absent in a kernel batch', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract GuardedLedger {
        mapping(uint => uint) values;
        mapping(uint => uint) trace;
        function set(uint key, uint value, bool enabled) public {
          if (enabled) { values[key] = value; }
          trace[key] = value + 100;
          require(true);
        }
      }`, { ...OPTIONS, evmCompat: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'set')?.entryAccesses?.[0]?.activation)
      .toMatchObject({ kind: 'source', source: { paramIndex: 2 } });
    const provider = createMessageBusCapstoneTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, setup.categoryId);
    await expect(contract.batch([
      { function: 'set', args: [1n, 11n, false] },
      { function: 'set', args: [1n, 12n, false] },
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await contract.getEntries('values')).toHaveLength(0);
    expect((await contract.getEntries('trace'))[0]?.value).toBe(112n);
    await expect(contract.batch([{ function: 'set', args: [2n, 22n, true] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const entries = await contract.getEntries('values');
    expect(entries).toHaveLength(1);
    expect(binToHex(entries[0]!.slot)).toBe(binToHex(keyToSlotMulti([bigIntToVmNumber(2n)])));
    expect(entries[0]!.value).toBe(22n);
  }, 180_000);

  it('keeps a compound-guarded mapping write absent in a kernel batch', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract GuardedLedger {
        mapping(uint => uint) values;
        mapping(uint => uint) trace;
        function set(uint key, uint value, bool enabled) public {
          if (enabled && (value > 10 || value == 3)) { values[key] = value; }
          trace[key] = value + 100;
          require(true);
        }
      }`, { ...OPTIONS, evmCompat: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'set')?.entryAccesses?.[0]?.activation)
      .toMatchObject({ kind: 'binary', operator: '&&' });
    const provider = createMessageBusCapstoneTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, setup.categoryId);
    await expect(contract.batch([
      { function: 'set', args: [1n, 11n, false] },
      { function: 'set', args: [1n, 9n, true] },
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await contract.getEntries('values')).toHaveLength(0);
    expect((await contract.getEntries('trace'))[0]?.value).toBe(109n);
    await expect(contract.batch([{ function: 'set', args: [2n, 3n, true] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const entries = await contract.getEntries('values');
    expect(entries).toHaveLength(1);
    expect(binToHex(entries[0]!.slot)).toBe(binToHex(keyToSlotMulti([bigIntToVmNumber(2n)])));
    expect(entries[0]!.value).toBe(3n);
  }, 180_000);

  it('keeps repeated writes in a skipped mapping branch absent', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract GuardedLedger {
        mapping(uint => uint) values;
        mapping(uint => uint) trace;
        function set(uint key, uint value, bool enabled) public {
          if (enabled) {
            values[key] = value;
            values[key] = value + 1;
          }
          trace[key] = value + 100;
          require(true);
        }
      }`, { ...OPTIONS, evmCompat: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'set')?.entryAccesses?.[0]?.activation)
      .toMatchObject({ kind: 'source', source: { paramIndex: 2 } });
    expect(artifact.abi.find((candidate) => candidate.name === 'set')?.entryAccesses?.[0]?.valueSource)
      .toBe('binop:+(id:value,lit:1)');
    const provider = createMessageBusCapstoneTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, setup.categoryId);
    await expect(contract.batch([
      { function: 'set', args: [1n, 11n, false] },
      { function: 'set', args: [1n, 12n, false] },
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await contract.getEntries('values')).toHaveLength(0);
    expect((await contract.getEntries('trace'))[0]?.value).toBe(112n);
    await expect(contract.batch([{ function: 'set', args: [2n, 22n, true] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const entries = await contract.getEntries('values');
    expect(entries).toHaveLength(1);
    expect(binToHex(entries[0]!.slot)).toBe(binToHex(keyToSlotMulti([bigIntToVmNumber(2n)])));
    expect(entries[0]!.value).toBe(23n);
  }, 180_000);

  it('settles separately guarded writes to one cached mapping entry', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract GuardedLedger {
        mapping(uint => uint) values;
        mapping(uint => uint) trace;
        function set(uint key, uint value, bool enabled, bool bumped) public {
          if (enabled && value > 20) { values[key] = value; }
          if (bumped && value > 30) { values[key] = value + 1; }
          trace[key] = value + 100;
          require(true);
        }
      }`, { ...OPTIONS, evmCompat: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'set')?.entryAccesses?.[0]?.valueSource)
      .toMatch(/^ternary\(/);
    const provider = createMessageBusCapstoneTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, setup.categoryId);
    await expect(contract.batch([
      { function: 'set', args: [1n, 11n, false, false] },
      { function: 'set', args: [1n, 12n, false, false] },
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await contract.getEntries('values')).toHaveLength(0);
    for (const [key, value, enabled, bumped, expected] of [
      [2n, 22n, true, false, 22n],
      [3n, 33n, false, true, 34n],
      [4n, 44n, true, true, 45n],
    ] as const) {
      await expect(contract.batch([{ function: 'set', args: [key, value, enabled, bumped] }]).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
      const entries = await contract.getEntries('values');
      expect(entries.find((entry) => binToHex(entry.slot)
        === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value).toBe(expected);
    }
  }, 180_000);
});
