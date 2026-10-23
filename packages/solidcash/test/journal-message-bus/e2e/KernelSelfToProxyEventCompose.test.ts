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
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
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
    return transaction.inputs.every((_input, inputIndex) => {
      const result = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as { error?: string };
      return result.error === undefined;
    });
  } catch {
    return false;
  }
};

/**
 * self→proxy × counter+emit under recipe compose+executionArtifact.
 *
 * Complete-graph resource observations derive the implementation's exact state update when
 * local `__forward` derivation leaves the proxy data NFT at its input commitment.
 */
describe('kernel self→proxy event under composition', () => {
  it('settles Caller.poke→deployProxy counter+emit under recipe compose+executionArtifact', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x72), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        int counter;
        event Ping(int value);
        function initialize() public { this.counter = 0; }
        function ping(int value) public {
          emit Ping(value);
          this.counter = this.counter + 1;
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'ping'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IAcc { function ping(int value) external; }
      contract Caller() {
        function poke(address acc, int value) public {
          IAcc(acc).ping(value);
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
    caller._registerResolvedExternal('IAcc', deployed.proxy);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'ping');
    expect(callsite?.callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [deployed.proxy.inner.lockingBytecode, 7n],
      }, {
        contract: deployed.proxy,
        functionName: 'ping',
        args: [7n],
        callsiteId: callsite!.callsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const mutableCommits = builder.outputs
      .filter((output) => output.token?.nft?.capability === 'mutable')
      .map((output) => output.token!.nft!.commitment);
    expect(mutableCommits).toContain('51');
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 300_000);
});
