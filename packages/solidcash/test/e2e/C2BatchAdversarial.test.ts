import { describe, expect, it } from 'vitest';
import { compileString as compile } from 'solidc';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const SOURCE = `contract C {
  mapping(int => int) m;
  function batch(int a, int b) external { m[a] = 11; m[b] = 22; require(true); }
}`;

describe('C2 atomic batch adversarial soundness', () => {
  const deploy = async (): Promise<StatefulContract> => {
    const provider = createTestProvider();
    const artifact = compile(SOURCE, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    return StatefulContract.withCategory(contract, categoryId);
  };

  it('rejects forged proof, successor, and predecessor-output witnesses', async () => {
    const wrongProof = await deploy();
    wrongProof._setRawC2BatchWitness(0, { proof: 2n }); // points at the other logical/funder block slot
    await expect(wrongProof.getFunction('batch')(1n, 2n).send()).rejects.toThrow();

    const wrongNext = await deploy();
    wrongNext._setRawC2BatchWitness(1, { next: new Uint8Array(32) });
    await expect(wrongNext.getFunction('batch')(1n, 2n).send()).rejects.toThrow();

    const wrongPredOut = await deploy();
    wrongPredOut._setRawC2BatchWitness(0, { predOut: 1n }); // collides with a target output
    await expect(wrongPredOut.getFunction('batch')(1n, 2n).send()).rejects.toThrow();
  });

  it('rejects link, value, capability, and orphan-output tampering', async () => {
    const provider = createTestProvider();
    const artifact = compile(SOURCE, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    // Capture the fully derived transaction without broadcasting: all adversarial variants therefore execute
    // against unspent inputs, and rejection is evidence from covenant validation rather than replay detection.
    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      throw new Error('capture-only');
    };
    await expect(sc.getFunction('batch')(1n, 2n).send()).rejects.toThrow('capture-only');
    (provider as any).sendRawTransaction = send;
    expect(captured).not.toBe('');

    const base = decodeTransactionUnsafe(hexToBin(captured));
    const entryIndices = base.outputs.map((o, i) => ({ o, i })).filter(({ o }) =>
      o.token?.nft?.capability === 'mutable' && (o.token.nft.commitment?.length ?? 0) >= 64).map(({ i }) => i);
    expect(entryIndices.length).toBe(3); // two targets plus one shared HEAD predecessor

    const rejectMutation = async (mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      mutate(tx);
      await expect(send(binToHex(encodeTransaction(tx)))).rejects.toThrow();
    };

    // Target value/commitment pin.
    await rejectMutation((tx) => { tx.outputs[entryIndices[0]].token!.nft!.commitment = hexToBin('00'.repeat(65)); });

    // Shared predecessor link pin: change next while preserving slot/value framing.
    await rejectMutation((tx) => {
      const c = tx.outputs[entryIndices[2]].token!.nft!.commitment.slice();
      c[32] ^= 1;
      tx.outputs[entryIndices[2]].token!.nft!.commitment = c;
    });

    // Mutable capability and master-category checks.
    await rejectMutation((tx) => { tx.outputs[entryIndices[2]].token!.nft!.capability = 'none'; });

    // Exact address cardinality: a duplicate C2 node is an orphan/fork even if otherwise byte-identical.
    await rejectMutation((tx) => {
      const o = tx.outputs[entryIndices[2]];
      tx.outputs.push({ ...o, lockingBytecode: o.lockingBytecode.slice(),
        token: { ...o.token!, nft: { ...o.token!.nft!, commitment: o.token!.nft!.commitment.slice() } } });
    });

    // The untouched transaction is accepted against the same still-unspent UTXOs.
    await expect(send(captured)).resolves.toBeTypeOf('string');
  });
});
