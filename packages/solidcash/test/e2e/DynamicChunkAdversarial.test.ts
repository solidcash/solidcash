import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';

const SOURCE = `contract DynamicState() {
  string text;
  function set(string value) { this.text = value; require(value.length > 0); }
}`;

describe('dynamic state-chunk adversarial soundness', () => {
  it('rejects missing, duplicated, reordered, redirected, and forged chunk elements', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { text: '' }, { saltContract: true },
    );
    const connected = StatefulContract.withCategory(contract, categoryId);

    // Materialize three old chunks, then capture a same-size rewrite so both input consumption and output
    // reconstruction are exercised. No signature guard can mask a covenant failure.
    await connected.getFunction('set')('A'.repeat(250)).send();
    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      return binToHex(hash256(hexToBin(hex)).reverse());
    };
    try {
      await connected.getFunction('set')('B'.repeat(250)).send();
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');

    const base = decodeTransactionUnsafe(hexToBin(captured));
    // Master, data NFT, three old chunks (and possibly SDK bookkeeping after the authenticated block).
    expect(base.inputs.length).toBeGreaterThanOrEqual(5);
    // Master, data NFT, three replacement chunks (and possibly a trailing fee/bookkeeping output).
    expect(base.outputs.length).toBeGreaterThanOrEqual(5);
    for (const index of [2, 3, 4]) {
      expect(base.outputs[index].token?.nft?.capability).toBe('mutable');
    }

    const rejectMutation = async (
      mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      mutate(tx);
      await send(binToHex(encodeTransaction(tx)));
    };
    const rejection = /mandatory-script-verify-flag-failed|duplicate|bad-txns|Program failed/;

    await expect(rejectMutation((tx) => {
      tx.inputs.splice(2, 1);
      tx.outputs.splice(2, 1);
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      tx.inputs.push({
        ...tx.inputs[2],
        outpointTransactionHash: tx.inputs[2].outpointTransactionHash.slice(),
        unlockingBytecode: tx.inputs[2].unlockingBytecode.slice(),
      });
    })).rejects.toThrow(rejection);
    // Old chunks form an identity-authenticated unordered set, but moving one across the positional data-NFT
    // boundary must fail.
    await expect(rejectMutation((tx) => {
      [tx.inputs[1], tx.inputs[2]] = [tx.inputs[2], tx.inputs[1]];
    })).rejects.toThrow(rejection);

    await expect(rejectMutation((tx) => { tx.outputs.splice(2, 1); })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      const chunk = tx.outputs[2];
      tx.outputs.push({
        ...chunk,
        lockingBytecode: chunk.lockingBytecode.slice(),
        token: { ...chunk.token!, nft: { ...chunk.token!.nft! } },
      });
      tx.outputs[0].valueSatoshis -= chunk.valueSatoshis + 1_000n;
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      [tx.outputs[2], tx.outputs[3]] = [tx.outputs[3], tx.outputs[2]];
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => { tx.outputs[2].lockingBytecode = hexToBin('51'); }))
      .rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      const commitment = tx.outputs[2].token!.nft!.commitment.slice();
      commitment[commitment.length - 1] ^= 1;
      tx.outputs[2].token!.nft!.commitment = commitment;
    })).rejects.toThrow(rejection);

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });
});
