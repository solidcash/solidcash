import { bigIntToVmNumber, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
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
  SortedList,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
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
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

/**
 * Non-proxy Caller under messageBus.compose calls deployProxy Bank.credit (vmap RMW).
 * Proxy callee binds via executionArtifact + executor (inverse of proxy→foreign Bank).
 * Bank address is a poke argument so the graph resolves the proxy participant at callsite time.
 */
describe('kernel self→proxy vmap RMW compose', () => {
  it('settles Caller.poke→deployProxy Bank.credit under compose with executionArtifact', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const privateKey = new Uint8Array(32).fill(0x45);
    const signer = new Signer(privateKey, provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const bankArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Bank() {
        int count;
        mapping(int => int) bal;
        function initialize() public { this.count = 0; }
        function seed(int k, int v) public { bal[k] = v; this.count = this.count + 1; }
        function credit(int k, int v) public { bal[k] = bal[k] + v; }
      }`, KERNEL);
    const delegate = bankArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'credit'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(
      getContractFactory(bankArtifact, signer),
      [],
    );
    await (deployed as any).seed(2n, 10n).send();

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IBank { function credit(int k, int v) external; }
      contract Caller() {
        function poke(address bank, int k, int v) public {
          IBank(bank).credit(k, v);
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
    caller._registerResolvedExternal('IBank', deployed.proxy);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'credit');
    expect(callsite).toMatchObject({
      functionName: 'credit',
      interfaceName: 'IBank',
    });
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [deployed.proxy.inner.lockingBytecode, 2n, 5n],
      }, {
        contract: deployed.proxy,
        functionName: 'credit',
        args: [2n, 5n],
        callsiteId: callsite!.callsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const executorInput = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === deployed.implementation.inner.address);
    expect(executorInput).toBeGreaterThanOrEqual(0);

    const proxyForward = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === '__forward'
      && input.unlocker.contract.address === deployed.proxy.inner.address);
    expect(proxyForward).toBeGreaterThanOrEqual(0);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const categoryId = deployed.proxy.categoryId;
    const ea = getEntryNftAddress(deployed.proxy.inner, categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(15n);
  }, 300_000);
});
