import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import {
  StatefulContract,
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

/**
 * proxy→foreign × structs: deployProxy Acc.poke → foreign Store.writeRecord under compose+executionArtifact.
 * Fixed-layout Record rewrite settles (Detail rebuild; nested fixed-int leaf assigns remain a compile fence).
 */
describe('kernel proxy × foreign struct under composition', () => {
  it('settles deployProxy poke→Store Record write under compose with executionArtifact', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x73), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const storeArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; uint16[2] marks; }
      contract Store {
        Record record;
        function writeRecord(uint256 value, uint16 code, uint8 status, uint16 mark0, uint16 mark1) public {
          record = Record(value, Detail(code, status), [mark0, mark1]);
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'writeRecord'))
      .toMatchObject({ eligible: true });

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(provider, storeBase, storeArtifact.stateLayout!, {
      record: {
        value: 1n,
        detail: { code: 0n, status: 2n },
        marks: [3n, 4n],
      },
    }, { saltContract: true });
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const implArtifact = compileString(`pragma solidity ^0.8.0;
      interface IStore {
        function writeRecord(uint256 value, uint16 code, uint8 status, uint16 mark0, uint16 mark1) external;
      }
      contract Acc {
        int count;
        function initialize() public { this.count = 0; }
        function poke(
          address store, uint256 value, uint16 code, uint8 status, uint16 mark0, uint16 mark1
        ) public {
          IStore(store).writeRecord(value, code, status, mark0, mark1);
          this.count = this.count + 1;
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'poke'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IStore', store);
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'writeRecord');
    expect(callsite?.callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, 9n, 70n, 1n, 5n, 6n],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: store,
        functionName: 'writeRecord',
        args: [9n, 70n, 1n, 5n, 6n],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const state = await store.getState() as {
      record: { value: bigint; detail: { code: bigint; status: bigint }; marks: bigint[] };
    };
    expect(state.record.value).toBe(9n);
    expect(state.record.detail).toEqual({ code: 70n, status: 1n });
    expect(state.record.marks).toEqual([5n, 6n]);
    expect((await deployed.proxy.getState()).count).toBe(1n);
  }, 300_000);
});
