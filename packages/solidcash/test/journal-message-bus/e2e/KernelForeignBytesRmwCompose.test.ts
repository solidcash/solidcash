import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const asBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return hexToBin(value.startsWith('0x') ? value.slice(2) : value);
  throw new Error(`unexpected bytes state: ${typeof value}`);
};

/**
 * self→foreign × chunks: Caller.poke → Store.append under messageBus.compose.
 * Empty→first-write and nonempty RMW (seeded aa→aabb) both settle; compose restages the
 * top-level dynamic chunk commitment from the route's concat-derived replacement.
 */
describe('kernel foreign bytes RMW under composition', () => {
  it('settles Caller→Store empty→append first write under messageBus.compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        bytes payload;
        function seed(bytes value) public { this.payload = value; require(true); }
        function append(bytes suffix) public {
          this.payload = bytes.concat(this.payload, suffix);
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(storeArtifact.abi.find((entry) => entry.name === 'append')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['payload']));

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, { payload: new Uint8Array() }, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function append(bytes suffix) external; }
      contract Caller() {
        function poke(address store, bytes suffix) public {
          IStore(store).append(suffix);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'append');
    expect(callsite?.callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const suffix = hexToBin('bb');
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, suffix],
      }, {
        contract: store,
        functionName: 'append',
        args: [suffix],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(binToHex(asBytes((await store.getState()).payload))).toBe('bb');
  }, 300_000);

  it('settles Caller→Store append onto seeded non-empty chunks under compose (RMW)', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        bytes payload;
        function seed(bytes value) public { this.payload = value; require(true); }
        function append(bytes suffix) public {
          this.payload = bytes.concat(this.payload, suffix);
          require(true);
        }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, { payload: new Uint8Array() }, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    await store.call.seed(hexToBin('aa')).send();
    expect(binToHex(asBytes((await store.getState()).payload))).toBe('aa');

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function append(bytes suffix) external; }
      contract Caller() {
        function poke(address store, bytes suffix) public {
          IStore(store).append(suffix);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);
    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'append');
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const suffix = hexToBin('bb');
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, suffix],
      }, {
        contract: store,
        functionName: 'append',
        args: [suffix],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(binToHex(asBytes((await store.getState()).payload))).toBe('aabb');
  }, 300_000);
});
