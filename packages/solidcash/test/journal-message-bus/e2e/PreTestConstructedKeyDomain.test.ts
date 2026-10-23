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

const source = (loop: string): string => `contract C() {
  mapping(int => int) slots;

  function fill(int[] memory keys, int base, int limit) internal pure {
    ${loop}
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

describe('pre-test constructed mapping-key domain BCH VM', () => {
  it.each([
    ['non-zero source while', `int cursor = 3;
      while (cursor < limit) { keys[cursor] = base + cursor; cursor = cursor + 2; }`],
    ['non-zero normalized for', `for (int cursor = 3; cursor < limit; cursor = cursor + 2) {
      keys[cursor] = base + cursor;
    }`],
  ])('executes the sparse prefix recipe for a %s and rejects a forged entry commitment', async (_label, loop) => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(source(loop), {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });

    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x9f00;
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

    // A pre-test loop has no first iteration when its public bound is non-positive.
    await fund();
    await expect(contract.write(1n, 41n, 0n).send()).resolves.toBeDefined();
    await fund();
    await expect(contract.check(41n, 0n, alicePub, signature).send()).resolves.toBeDefined();

    // A positive non-unit progression writes only indices three and five; every other key is the array default.
    await fund();
    await expect(contract.write(6n, 51n, 6n).send()).resolves.toBeDefined();
    for (const [key, value] of [[0n, 5n], [54n, 4n], [56n, 6n]] as const) {
      await fund();
      await expect(contract.check(key, value, alicePub, signature).send()).resolves.toBeDefined();
    }

    // A bound below the start executes no helper iteration and preserves every source default.
    await fund();
    await expect(contract.write(3n, 61n, 1n).send()).resolves.toBeDefined();
    for (const [key, value] of [[61n, 0n], [0n, 3n], [63n, 0n]] as const) {
      await fund();
      await expect(contract.check(key, value, alicePub, signature).send()).resolves.toBeDefined();
    }

    // The symbolic recipe never clamps the executable helper to the allocation.
    await fund();
    await expect(contract.write(5n, 71n, 6n).send()).rejects.toThrow();

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
    expect(captured).not.toBe('');
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
