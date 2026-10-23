import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../../src/index.js';
import {
  getContractFactory,
  upgrades,
  SortedList,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
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

describe('kernel proxy-owned vmap RMW compose', () => {
  it('UPDATE: deployProxy credit updates proxy-category bal', async () => {
    // Pattern from UpgradesDeployProxy MAP_IMPL: direct proxy call after deployProxy.
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        int count;
        mapping(int => int) bal;
        function initialize() public { this.count = 0; }
        function seed(int k, int v) public { bal[k] = v; this.count = this.count + 1; }
        function credit(int k, int v) public { bal[k] = bal[k] + v; }
      }`, KERNEL);
    expect(artifact.delegateArtifact).toBeDefined();

    const provider = createMessageBusCapstoneTestProvider();
    const privateKey = new Uint8Array(32).fill(0x43);
    const signer = new Signer(privateKey, provider);
    for (let index = 0; index < 24; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }
    const proxy = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    await (proxy as any).seed(30n, 100n).send();

    const builder = await (proxy as any).credit(30n, 25n).build() as TransactionBuilder;
    expect(vmAccepts(builder)).toBe(true);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker && 'params' in input.unlocker))
      .toBe(true);
    const executorInput = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === proxy.implementation.inner.address);
    expect(executorInput).toBeGreaterThanOrEqual(0);
    const proxyForward = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === '__forward');
    expect(proxyForward).toBeGreaterThanOrEqual(0);

    const tx = await (proxy as any).credit(30n, 25n).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);

    const categoryId = proxy.proxy.categoryId;
    const ea = getEntryNftAddress(proxy.proxy.inner, categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(30n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(125n);
  }, 300_000);
});
