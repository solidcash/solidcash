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

const asHex = (value: unknown): string => {
  if (value instanceof Uint8Array) return binToHex(value);
  if (typeof value === 'string') return value.startsWith('0x') ? value.slice(2) : value;
  throw new Error(`unexpected bytes state: ${typeof value}`);
};

describe('kernel adjacent dynamic chunk resources', () => {
  it('settles two independently indexed chunk-0 writes in one compose block', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        bytes left;
        bytes right;
        function write(bytes a, bytes b) public {
          this.left = a;
          this.right = b;
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'write')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['left', 'right']));

    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!,
      { left: new Uint8Array(), right: new Uint8Array() }, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function write(bytes a, bytes b) external; }
      contract Caller() {
        function poke(address store, bytes a, bytes b) public {
          IStore(store).write(a, b);
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
    const callsiteId = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'write')?.callsiteId;
    expect(callsiteId).toBeDefined();
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'poke', args: [store.inner.lockingBytecode, hexToBin('aa'), hexToBin('bb')] },
        { contract: store, functionName: 'write', args: [hexToBin('aa'), hexToBin('bb')], callsiteId: callsiteId! },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const state = await store.getState();
    expect(asHex(state.left)).toBe('aa');
    expect(asHex(state.right)).toBe('bb');
  }, 300_000);
});
