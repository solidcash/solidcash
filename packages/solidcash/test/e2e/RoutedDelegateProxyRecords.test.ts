import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract, Signer } from '../../src/index.js';
import {
  ProxyContract, StatefulContract, getContractFactory, getEntryNftAddress, upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { addProvenUtxo, createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

/**
 * A proxy function reached through its implementation's message-bus route writes the proxy's mapping entry and a
 * chunked value. The proxy master holds the minting baton of those records, so the route binds them to the proxy's
 * lock, as a direct delegate does: a routed insert settles and reads back at the proxy's lock.
 */

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const IMPL = `pragma solidcash >=0.8.0;
  interface IRoutedProbe { function touch() external; }
  contract RoutedLedger() {
    int counter;
    mapping(int => int) balances;
    mapping(int => bytes) notes;
    function seed(int key, int amount, bytes note) public {
      balances[key] = amount;
      notes[key] = note;
      require(true);
    }
    function record(address probe, int key, int amount, bytes note) public {
      balances[key] = amount;
      notes[key] = note;
      this.counter = this.counter + 1;
      IRoutedProbe(probe).touch();
      require(true);
    }
  }`;

const PROBE = `pragma solidcash >=0.8.0;
  contract RoutedProbe() { function touch() public { require(true); } }`;

const FIRST = new Uint8Array(96).fill(0x41);
const SECOND = new Uint8Array(140).fill(0x42);

type Provider = ReturnType<typeof createMessageBusCapstoneTestProvider>;

interface Fixture {
  provider: Provider;
  deployed: ProxyContract;
  proxy: StatefulContract;
  implementation: StatefulContract;
  probe: StatefulContract;
  callsiteId: number;
}

async function setup(): Promise<Fixture> {
  const provider = createMessageBusCapstoneTestProvider();
  const signer = new Signer(new Uint8Array(32).fill(0x5a), provider);
  for (let index = 0; index < 16; index += 1) await addProvenUtxo(provider, signer.getAddress());
  const probeArtifact = compileString(PROBE, { ...KERNEL, messageBusGraphContext: true });
  const probeBase = new Contract(probeArtifact, [], { provider });
  const probeSetup = await setupStatefulUtxos(
    provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
  );
  const probe = StatefulContract.withCategory(
    probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
  );

  const artifact = compileString(IMPL, KERNEL);
  const delegate = artifact.delegateArtifact!;
  expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'record'))
    .toMatchObject({ eligible: true });
  const deployed = await upgrades.deployProxy(
    getContractFactory(artifact, signer), { counter: 0n }, { initializer: false },
  );
  deployed.implementation._registerResolvedExternal('IRoutedProbe', probe);
  const callsite = delegate.abi.find((entry) => entry.name === 'record')
    ?.externalCalls?.find((call) => call.functionName === 'touch');
  expect(callsite?.callsiteId).toBeDefined();
  return {
    provider,
    deployed,
    proxy: deployed.proxy,
    implementation: deployed.implementation,
    probe,
    callsiteId: callsite!.callsiteId!,
  };
}

const routedRecord = async (f: Fixture, key: bigint, amount: bigint, note: Uint8Array): Promise<void> => {
  const fee = await createBareP2pkhFeeFunder(f.provider, 500_000n);
  const composition = messageBus.compose({
    preparedCalls: [{
      contract: f.proxy,
      functionName: 'record',
      args: [f.probe.inner.lockingBytecode, key, amount, note],
      executionArtifact: f.implementation.inner.artifact,
      executor: f.implementation,
    }, {
      contract: f.probe,
      functionName: 'touch',
      args: [],
      callsiteId: f.callsiteId,
    }],
    funder: fee,
    changeAddress: fee.unlocker.generateLockingBytecode(),
  });
  const builder = await composition.build();
  // The implementation executes the message-bus route, not a direct delegate entry.
  const executor = builder.inputs.find((input) => isContractUnlocker(input.unlocker)
    && input.unlocker.contract.address === f.implementation.inner.address);
  expect(executor && isContractUnlocker(executor.unlocker) && executor.unlocker.abiFunction.name)
    .toBe('__message_bus1');
  await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
};

/** The proxy's records as read at the proxy's lock, and the count of its entries at the executor's lock. */
const records = async (f: Fixture): Promise<Record<string, unknown>> => {
  const [balance] = await f.proxy.getEntries('balances');
  const [note] = await f.proxy.getEntries('notes');
  const atExecutorLock = (await Promise.all(['balances', 'notes'].map((collection) => f.provider.getUtxos(
    getEntryNftAddress(f.implementation.inner, f.proxy.categoryId, collection),
  )))).flat().length;
  return {
    amount: balance?.value,
    note: note === undefined ? undefined : binToHex(note.value as Uint8Array),
    atExecutorLock,
  };
};

describe('a routed delegate binds the proxy records to the proxy master lock', () => {
  it('settles a routed insert of a mapping entry and a chunked value', async () => {
    const f = await setup();
    await routedRecord(f, 1n, 10n, FIRST);
    expect(await records(f)).toEqual({ amount: 10n, note: binToHex(FIRST), atExecutorLock: 0 });
  }, 300_000);

  // A first routed insert writes the records, so the second composition also re-spends the proxy's identity anchor.
  it('settles a routed update that spends a delegate-written entry and its value chunks', async () => {
    const f = await setup();
    await routedRecord(f, 1n, 10n, FIRST);
    expect(await records(f)).toEqual({ amount: 10n, note: binToHex(FIRST), atExecutorLock: 0 });
    await routedRecord(f, 1n, 20n, SECOND);
    expect(await records(f)).toEqual({ amount: 20n, note: binToHex(SECOND), atExecutorLock: 0 });
    expect((await f.proxy.getState()).counter).toBe(2n);
  }, 300_000);

  // The direct (non-routed) delegate path: `forward('seed')` writes the proxy's mapping entry and a chunked
  // value, and the records must land at the proxy master's lock, not the executor's. The SDK derives the
  // chunk's state-owner CATEGORY as the proxy's (see prepareDeriveFullValueChunkWrites), and appendValueChunks
  // now places the staged run into the reserved band slot the covenant's value-chunk output base names instead
  // of trailing after the delegate's predecessor outputs, so the entry census matches.
  it('settles a DIRECT delegate seed that writes a mapping entry and a chunked value', async () => {
    const f = await setup();
    await f.deployed.forward('seed', [1n, 10n, FIRST]).send();
    expect(await records(f)).toEqual({ amount: 10n, note: binToHex(FIRST), atExecutorLock: 0 });
  }, 300_000);
});
