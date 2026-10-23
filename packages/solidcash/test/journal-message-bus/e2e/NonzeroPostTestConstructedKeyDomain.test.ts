import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  SignatureTemplate,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { addressToLockScript } from '../../../src/utils.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../../test-util.js';

const SOURCE = `contract C() {
  mapping(int => int) slots;
  function fill(int[] memory keys, int base, int limit) internal pure {
    int cursor = 3;
    do { keys[cursor] = base + cursor; cursor = cursor + 2; } while (cursor < limit);
  }
  function write(int count, int base, int limit) public {
    int[] memory keys = new int[](count);
    fill(keys, base, limit);
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.slots[keys[cursor]] = cursor + 1;
    }
    require(true);
  }
  function check(int key, int value, pubkey pk, sig s) public {
    require(checkSig(s, pk));
    require(this.slots[key] == value);
  }
}`;

describe('non-zero post-test constructed mapping-key domain BCH VM', () => {
  it('preserves the mandatory first index, source OOB, and entry authentication', async () => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(SOURCE, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0xa000;
    const uid = (): string => (++nonce).toString(16).padStart(64, '0');
    const deploymentUtxo = { txid: uid(), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funding.address, deploymentUtxo);
    const { contract } = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: deploymentUtxo,
      funder: funding.unlock.spend(alicePub, signature), initialState: {}, changeAddress: funding.address,
    });
    const fund = async (): Promise<void> => {
      await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100_000n });
    };

    // The first source index is mandatory even when the public continuation bound is non-positive.
    await fund();
    await expect(contract.write(6n, 41n, 0n).send()).resolves.toBeDefined();
    for (const [key, value] of [[0n, 6n], [44n, 4n], [46n, 0n]] as const) {
      await fund();
      await expect(contract.check(key, value, alicePub, signature).send()).resolves.toBeDefined();
    }

    // With a positive bound, only the exact 3,5 progression receives constructed keys.
    await fund();
    await expect(contract.write(6n, 51n, 6n).send()).resolves.toBeDefined();
    for (const [key, value] of [[0n, 5n], [54n, 4n], [56n, 6n]] as const) {
      await fund();
      await expect(contract.check(key, value, alicePub, signature).send()).resolves.toBeDefined();
    }

    // The helper remains executable source: a mandatory write beyond the allocation faults.
    await fund();
    await expect(contract.write(3n, 71n, 0n).send()).rejects.toThrow();

    await fund();
    const send = provider.sendRawTransaction.bind(provider);
    let captured = '';
    (provider as any).sendRawTransaction = async (transactionHex: string): Promise<string> => {
      captured = transactionHex;
      throw new Error('capture-only');
    };
    try {
      await expect(contract.write(6n, 81n, 6n).send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    const forged = decodeTransactionUnsafe(hexToBin(captured));
    const entryLock = addressToLockScript(contract.getEntryNftAddress('slots'));
    const mappingOutput = forged.outputs.find((output) => output.token?.nft?.capability === 'mutable'
      && binToHex(output.lockingBytecode) === binToHex(entryLock));
    expect(mappingOutput?.token?.nft?.commitment.length).toBeGreaterThan(0);
    mappingOutput!.token!.nft!.commitment[0] ^= 1;
    await expect(send(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(send(captured)).resolves.toBeTypeOf('string');
  }, 120_000);
});
