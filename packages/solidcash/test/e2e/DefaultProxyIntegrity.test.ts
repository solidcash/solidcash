import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { Signer, getContractFactory, upgrades } from '../../src/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { compileString } from '../direct-compile.js';

const IMPLEMENTATION = `contract ProxyIntegrityImpl() {
  bigint counter;
  function increment() public { this.counter = this.counter + 1; }
  function other() public { this.counter = this.counter + 2; }
}`;

type Decoded = ReturnType<typeof decodeTransactionUnsafe>;

describe('default proxy transaction integrity', () => {
  it('preserves the proxy state block and required implementation co-spend', async () => {
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    await provider.addUtxo(signer.getAddress(), {
      txid: 'a1'.repeat(32), vout: 0, satoshis: 1_000_000n,
    });
    await provider.addUtxo(signer.getAddress(), {
      txid: 'b2'.repeat(32), vout: 0, satoshis: 1_000_000n,
    });
    const artifact = compileString(IMPLEMENTATION);
    const proxy = await upgrades.deployProxy(
      getContractFactory(artifact, signer), { counter: 5n },
    );

    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      return binToHex(hash256(hexToBin(hex)).reverse());
    };
    try {
      await (proxy as any).increment().withoutLogicalNonce().send();
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');

    const base = decodeTransactionUnsafe(hexToBin(captured));
    expect(base.inputs.length).toBeGreaterThanOrEqual(4);
    expect(base.outputs.length).toBeGreaterThanOrEqual(4);
    const proxyMaster = 0;
    const proxyState = 1;
    const implementationMaster = 2;
    const refusal = /mandatory-script-verify-flag-failed|bad-txns|Program failed/;
    const submitChanged = async (change: (tx: Decoded) => void): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      change(tx);
      await send(binToHex(encodeTransaction(tx)));
    };

    await expect(submitChanged((tx) => {
      tx.inputs.splice(implementationMaster, 1);
      tx.outputs.splice(implementationMaster, 1);
    }))
      .rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      const input = tx.inputs[implementationMaster];
      tx.inputs.push({ ...input, unlockingBytecode: input.unlockingBytecode.slice() });
    })).rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      [tx.inputs[proxyMaster], tx.inputs[implementationMaster]] = [
        tx.inputs[implementationMaster], tx.inputs[proxyMaster],
      ];
    })).rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      tx.outputs[proxyMaster].lockingBytecode = hexToBin('51');
    })).rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      const commitment = tx.outputs[proxyState].token!.nft!.commitment.slice();
      commitment[commitment.length - 1] ^= 1;
      tx.outputs[proxyState].token!.nft!.commitment = commitment;
    })).rejects.toThrow(refusal);

    await expect(send(captured)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});
