import {
  bigIntToVmNumber, binToHex, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  bytesToSlotValue, decodeEntryCommitment, keyToSlot,
} from '../../../src/stateful/SortedList.js';
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

describe('kernel proxy sorted-insert PredOut under __forward', () => {
  it('INSERT via deployProxy seed: P rewrite and NEW entry on proxy-owned outputs', async () => {
    // compose×proxy×foreign OP_VERIFYs (M1a characterization). Single-handler proxy INSERT settles on
    // the shipped deployProxy __forward path: executor=impl, state/category=proxy, P≠NEW geometry.
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        int count;
        mapping(int => int) bal;
        function initialize() public { this.count = 0; }
        function seed(int k, int v) public { bal[k] = v; this.count = this.count + 1; }
      }`, KERNEL);
    expect(artifact.delegateArtifact).toBeDefined();

    const provider = createMessageBusCapstoneTestProvider();
    const privateKey = new Uint8Array(32).fill(0x45);
    const signer = new Signer(privateKey, provider);
    for (let index = 0; index < 32; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const deployed = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    await (deployed as any).seed(2n, 7n).send();

    const builder = await (deployed as any).seed(9n, 55n).build() as TransactionBuilder;
    expect(vmAccepts(builder)).toBe(true);

    // Implementation co-spent as delegate executor.
    const executorInput = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === deployed.implementation.inner.address);
    expect(executorInput).toBeGreaterThanOrEqual(0);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker && 'params' in input.unlocker))
      .toBe(true);

    const transaction = builder.buildLibauthTransaction();
    const proxyCategory = String(deployed.proxy.categoryId).toLowerCase();
    const seededSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(2n)));
    const insertedSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(9n)));

    const decodeProxyMutable = (output: (typeof transaction.outputs)[number]): {
      slot: bigint; nextKey: bigint;
    } | undefined => {
      if (output.token?.nft?.capability !== 'mutable') return undefined;
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      if (hex !== proxyCategory) return undefined;
      try {
        const decoded = decodeEntryCommitment(
          typeof output.token.nft.commitment === 'string'
            ? hexToBin(output.token.nft.commitment)
            : output.token.nft.commitment,
        );
        return {
          slot: bytesToSlotValue(decoded.slot),
          nextKey: bytesToSlotValue(decoded.nextKey),
        };
      } catch {
        return undefined;
      }
    };

    const predOutAbsolute = transaction.outputs.findIndex((output) => {
      const decoded = decodeProxyMutable(output);
      return decoded !== undefined
        && decoded.slot === seededSlot
        && decoded.nextKey === insertedSlot;
    });
    expect(predOutAbsolute).toBeGreaterThanOrEqual(0);

    const newEntryIndex = transaction.outputs.findIndex((output, index) => {
      if (index === predOutAbsolute) return false;
      const decoded = decodeProxyMutable(output);
      return decoded !== undefined && decoded.slot === insertedSlot;
    });
    expect(newEntryIndex).toBeGreaterThanOrEqual(0);
    expect(newEntryIndex).not.toBe(predOutAbsolute);

    await expect((deployed as any).seed(9n, 55n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 300_000);
});
