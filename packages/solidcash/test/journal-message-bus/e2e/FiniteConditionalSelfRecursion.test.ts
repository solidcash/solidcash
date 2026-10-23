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

const SOURCE = `contract NaturalRecursiveKeys() {
  mapping(int => int) slots;

  function fill(int[] memory keys, int base, uint8 remaining) internal pure {
    if (remaining == 0) { return; }
    fill(keys, base, remaining - 1);
    keys[remaining - 1] = base + remaining;
  }

  function write(int count, int seed, int offset, pubkey pk, sig s) public {
    int[] memory keys = new int[](count);
    fill(keys, seed * 2 + offset, uint8(3));
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.slots[keys[cursor]] = cursor + 1;
    }
    require(checkSig(s, pk) && count == 3);
  }

  function check(int key, int value, pubkey pk, sig s) public {
    require(checkSig(s, pk));
    require(this.slots[key] == value);
  }
}`;

describe('finite bounded-integer self-recursion BCH VM', () => {
  it('snapshots a runtime expression, executes exact keys, and rejects a forged settlement', async () => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });

    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x9d00;
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

    // MockNetworkProvider validates every submitted input with the BCH-2026 VM.
    await fund();
    await expect(contract.write(3n, 19n, 2n, alicePub, signature).send()).resolves.toBeDefined();
    for (const [key, value] of [[41n, 1n], [42n, 2n], [43n, 3n]] as const) {
      await fund();
      await expect(contract.check(key, value, alicePub, signature).send()).resolves.toBeDefined();
    }

    await fund();
    const send = provider.sendRawTransaction.bind(provider);
    let captured = '';
    (provider as any).sendRawTransaction = async (transactionHex: string): Promise<string> => {
      captured = transactionHex;
      throw new Error('capture-only');
    };
    try {
      await expect(contract.write(3n, 19n, 2n, alicePub, signature).send()).rejects.toThrow('capture-only');
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
