import { binToHex, hexToBin, ripemd160, sha256 } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  try {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true);
  } catch {
    return false;
  }
};

describe('kernel constructed-key domain under composition', () => {
  it('settles hash160(pubkey)-keyed UPDATE via Caller→Store compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const pk = hexToBin('02'.padEnd(66, '11'));
    const who = ripemd160.hash(sha256.hash(pk));

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(bytes20 => int) balances;
        function credit(pubkey pk, int n) public {
          bytes20 who = hash160(pk);
          this.balances[who] = this.balances[who] + n;
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'credit'))
      .toMatchObject({ eligible: true });

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function credit(pubkey pk, int n) external; }
      contract Caller() {
        function poke(address store, pubkey pk, int n) public {
          IStore(store).credit(pk, n);
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
      ?.externalCalls?.find((call) => call.functionName === 'credit');
    expect(callsite?.callsiteId).toBeDefined();

    await expect(store.call.credit(pk, 10n).send()).resolves.toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, pk, 5n],
      }, {
        contract: store,
        functionName: 'credit',
        args: [pk, 5n],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const entries = await store.getEntries('balances');
    const slot = binToHex(keyToSlotMulti([who]));
    expect(entries.find((entry) => binToHex(entry.slot) === slot)?.value).toBe(15n);
  }, 300_000);
});
