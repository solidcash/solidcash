import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { Utxo } from '../../src/interfaces.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';

const SOURCE = `contract Lifecycle() {
  int counter;
  function fork(bigint n) split(n) { require(n >= 1); }
  function consolidate(bigint n) merge(n) { require(n >= 1); }
}`;

const OP_TRUE = hexToBin('51');
const anyoneCanSpend = {
  generateLockingBytecode: (): Uint8Array => OP_TRUE,
  generateUnlockingBytecode: (): Uint8Array => new Uint8Array(),
};

describe('lifecycle auxiliary-input adversarial soundness', () => {
  it('split rejects missing, duplicated, redirected, and reordered lifecycle outputs', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const connected = StatefulContract.withCategory(contract, categoryId);
    const funding: Utxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 50_000n };
    await provider.addUtxo('51', funding);

    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      return binToHex(hash256(hexToBin(hex)).reverse());
    };
    try {
      await StatefulContract.split({
        provider,
        contract: connected,
        splitFunctionName: 'fork',
        splitFunctionArgs: [2n],
        funder: anyoneCanSpend,
        fundingUtxos: [funding],
        changeAddress: contract.address,
      });
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');

    const rejectMutation = async (
      mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      mutate(tx);
      await send(binToHex(encodeTransaction(tx)));
    };
    const covenantFailure = /mandatory-script-verify-flag-failed[\s\S]*evaluating input index 0/;

    // Output 0 is the preserved master; outputs 1 and 2 are the newly minted masters; output 3 is change.
    await expect(rejectMutation((tx) => { tx.outputs.splice(2, 1); })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => {
      const minted = tx.outputs[2];
      tx.outputs.splice(3, 0, {
        ...minted,
        lockingBytecode: minted.lockingBytecode.slice(),
        token: { ...minted.token!, nft: { ...minted.token!.nft! } },
      });
      // Preserve value balance and add ample fee for the larger serialized transaction, so relay policy cannot
      // mask the lifecycle covenant's exact-output-count rejection.
      tx.outputs.at(-1)!.valueSatoshis -= minted.valueSatoshis + 1_000n;
    })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => {
      tx.outputs[1].lockingBytecode = OP_TRUE;
    })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => {
      [tx.outputs[0], tx.outputs[3]] = [tx.outputs[3], tx.outputs[0]];
    })).rejects.toThrow(covenantFailure);

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });

  it('merge rejects missing, duplicated, reordered, and redirected lifecycle inputs/outputs', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const connected = StatefulContract.withCategory(contract, categoryId);

    const splitFunding: Utxo = { txid: 'f2'.repeat(32), vout: 0, satoshis: 50_000n };
    await provider.addUtxo('51', splitFunding);
    await StatefulContract.split({
      provider,
      contract: connected,
      splitFunctionName: 'fork',
      splitFunctionArgs: [2n],
      funder: anyoneCanSpend,
      fundingUtxos: [splitFunding],
      changeAddress: contract.address,
    });

    const masters = (await provider.getUtxos(connected.inner.tokenAddress)).filter(
      (utxo) => utxo.token?.category === categoryId && utxo.token.nft?.capability === 'minting',
    );
    expect(masters).toHaveLength(3);
    const mergeFunding: Utxo = { txid: 'f3'.repeat(32), vout: 0, satoshis: 10_000n };
    await provider.addUtxo('51', mergeFunding);

    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      return binToHex(hash256(hexToBin(hex)).reverse());
    };
    try {
      await StatefulContract.merge({
        provider,
        contract: connected,
        mergeFunctionName: 'consolidate',
        mergeFunctionArgs: [2n],
        funder: anyoneCanSpend,
        consumedMasterUtxos: masters.slice(1),
        fundingUtxos: [mergeFunding],
        changeAddress: contract.address,
      });
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');

    const rejectMutation = async (
      mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      mutate(tx);
      await send(binToHex(encodeTransaction(tx)));
    };
    const rejection = /mandatory-script-verify-flag-failed|duplicate|bad-txns|Program failed/;

    // Inputs 0..2 are the surviving + two consumed masters; input 3 is ordinary OP_TRUE funding.
    await expect(rejectMutation((tx) => {
      tx.inputs.splice(2, 1);
      tx.outputs.at(-1)!.valueSatoshis -= 1_200n;
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      tx.inputs.splice(2, 0, {
        ...tx.inputs[1],
        outpointTransactionHash: tx.inputs[1].outpointTransactionHash.slice(),
        unlockingBytecode: tx.inputs[1].unlockingBytecode.slice(),
      });
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      [tx.inputs[1], tx.inputs[3]] = [tx.inputs[3], tx.inputs[1]];
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      tx.outputs[0].lockingBytecode = OP_TRUE;
    })).rejects.toThrow(rejection);

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });
});
