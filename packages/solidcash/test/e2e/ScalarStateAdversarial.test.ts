import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';

const SOURCE = `contract ScalarState() {
  int left;
  int right;
  function set(int value) {
    this.left = value;
    this.right = value + 1;
    require(value >= 0);
  }
}`;

describe('scalar data-NFT adversarial soundness', () => {
  it('rejects missing, duplicated, reordered, redirected, and forged state elements', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { left: 0n, right: 0n }, { saltContract: true },
    );
    const connected = StatefulContract.withCategory(contract, categoryId);

    // No signature guard is present: every hostile row reaches the covenant directly, independent of sighash.
    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      return binToHex(hash256(hexToBin(hex)).reverse());
    };
    try {
      await connected.getFunction('set')(7n).send();
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');

    const base = decodeTransactionUnsafe(hexToBin(captured));
    expect(base.inputs.length).toBeGreaterThanOrEqual(2);
    expect(base.outputs.length).toBeGreaterThanOrEqual(2);
    expect(base.outputs[0].token?.nft?.capability).toBe('minting');
    expect(base.outputs[1].token?.nft?.capability).toBe('mutable');

    const rejectMutation = async (
      mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      mutate(tx);
      await send(binToHex(encodeTransaction(tx)));
    };
    const rejection = /mandatory-script-verify-flag-failed|duplicate|bad-txns|Program failed/;

    // Remove the data NFT on both sides: the master still requires its authenticated state slot.
    await expect(rejectMutation((tx) => {
      tx.inputs.splice(1, 1);
      tx.outputs.splice(1, 1);
    })).rejects.toThrow(rejection);

    // Duplicate and reorder the auxiliary data-NFT input.
    await expect(rejectMutation((tx) => {
      tx.inputs.push({
        ...tx.inputs[1],
        outpointTransactionHash: tx.inputs[1].outpointTransactionHash.slice(),
        unlockingBytecode: tx.inputs[1].unlockingBytecode.slice(),
      });
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      [tx.inputs[0], tx.inputs[1]] = [tx.inputs[1], tx.inputs[0]];
    })).rejects.toThrow(rejection);

    // Remove, duplicate, reorder, or redirect the data output.
    await expect(rejectMutation((tx) => { tx.outputs.splice(1, 1); })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      const state = tx.outputs[1];
      tx.outputs.push({
        ...state,
        lockingBytecode: state.lockingBytecode.slice(),
        token: { ...state.token!, nft: { ...state.token!.nft! } },
      });
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      [tx.outputs[0], tx.outputs[1]] = [tx.outputs[1], tx.outputs[0]];
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      tx.outputs[1].lockingBytecode = hexToBin('51');
    })).rejects.toThrow(rejection);

    // Preserve topology but forge the committed state.
    await expect(rejectMutation((tx) => {
      const commitment = tx.outputs[1].token!.nft!.commitment.slice();
      commitment[commitment.length - 1] ^= 1;
      tx.outputs[1].token!.nft!.commitment = commitment;
    })).rejects.toThrow(rejection);

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });
});
