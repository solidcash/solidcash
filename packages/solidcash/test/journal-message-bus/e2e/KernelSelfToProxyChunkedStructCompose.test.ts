import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, StatefulContract, getContractFactory, upgrades, messageBus, Signer,
} from '../../../src/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

/**
 * self→proxy × chunked structs: non-proxy Caller.poke → deployProxy Acc.append (Item[] whole-element
 * push) under compose with executionArtifact/executor. Whole-element push keeps the handler
 * delegate-eligible; the compose path still fails closed after a genuine attempt — honest fence.
 * Pure-self pooled Item[] writes remain covered by KernelPooledDynamicArrayWriter.
 */
describe('kernel self→proxy chunked-struct compose', () => {
  it('refuses Caller.poke→deployProxy Acc Item[] append under compose (honest fence)', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x76), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      struct Item { int amount; string label; bool active; }
      contract Acc() {
        Item[] items;
        function initialize() public { require(true); }
        function append(int amount, string label) public {
          // Whole-element push keeps the handler delegate-eligible (field-by-field
          // fill after bare push() drops delegateArtifact for deployProxy).
          this.items.push(Item(amount, label, true));
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IAcc { function append(int amount, string label) external; }
      contract Caller() {
        function poke(address acc, int amount, string label) public {
          IAcc(acc).append(amount, label);
          require(true);
        }
      }`, KERNEL);
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'poke'))
      .toMatchObject({ eligible: true });
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IAcc', deployed.proxy);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'append');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [deployed.proxy.inner.lockingBytecode, 7n, 'first'],
      }, {
        contract: deployed.proxy,
        functionName: 'append',
        args: [7n, 'first'],
        callsiteId: callsite!.callsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    // Measured: MessageBusVerifier / chunk path OP_VERIFY (~input 67) after genuine compose attempt.
    await expect(composition.send()).rejects.toThrow(/OP_VERIFY|preflight failed at input/);
  }, 300_000);
});
