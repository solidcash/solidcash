import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

describe('constructed-array exhausted finite helper replay', () => {
  it('executes keys built by literal-resolved helper bounds and steps', async () => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, int limit, int step) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + step) {
          keys[cursor / step] = base + cursor;
        }
      }
      function write(int count, int base, pubkey pk, sig s) public {
        int[] memory keys = new int[](count);
        fill(keys, base, 3 * 2, 1 + 1);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(checkSig(s, pk) && count == 3);
      }
      function check(int key, int value, pubkey pk, sig s) public {
        require(checkSig(s, pk));
        require(this.slots[key] == value);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });

    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x8c00;
    const uid = (): string => (++nonce).toString(16).padStart(64, '0');
    const deploymentUtxo = { txid: uid(), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funding.address, deploymentUtxo);
    const { contract } = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: deploymentUtxo,
      funder: funding.unlock.spend(alicePub, signature),
      initialState: {},
      changeAddress: funding.address,
    });
    const fund = async (): Promise<void> => {
      await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100_000n });
    };

    await fund();
    await expect(contract.write(3n, 50n, alicePub, signature).send()).resolves.toBeDefined();
    for (const [key, value] of [[50n, 1n], [52n, 2n], [54n, 3n]] as const) {
      await fund();
      await expect(contract.check(key, value, alicePub, signature).send()).resolves.toBeDefined();
    }
  });
});
