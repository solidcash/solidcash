import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, { sortedMappingsAll: false, ...o } as any);
import { hexToBin, binToHex, decodeTransactionUnsafe, encodeTransaction } from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Adversarial soundness: a loop mapping write mints one new entry NFT per iteration at a runtime-counter-indexed
// trailing output. The per-iteration covenant verify (commitment + address + category) plus the output-count pin
// must reject any tampering: wrong commitment, redirected address, or an extra (orphan) entry output. We capture
// the honest funded+signed raw tx at the provider boundary, then re-submit tampered copies and require rejection.
const SRC = `contract C() {
  mapping(int => int) bal;
  function setAll(int[] ks, int[] vs, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (uint i = 0; i < ks.length; i = i + 1) { bal[ks[i]] = vs[i]; }
  }
}`;

describe('dynamic loop mapping write - adversarial soundness', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('honest tx broadcasts; tampered commitment / address / orphan output are rejected', async () => {
    const art = compileString(SRC);
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);

    // Capture the fully-funded, signed raw tx at the provider boundary during a real send().
    let capturedHex = '';
    const origSend = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      capturedHex = hex;
      return origSend(hex);
    };
    let honestTxid: string;
    try {
      honestTxid = (await sc.setAll([10n, 20n], [111n, 222n], alicePub, sig).send()).txid;
    } finally {
      (provider as any).sendRawTransaction = origSend;
    }
    expect(honestTxid).toBeDefined();
    expect(capturedHex).not.toBe('');

    // The honest tx has master output [0] plus two entry outputs [1],[2] at the collection address.
    const honest = decodeTransactionUnsafe(hexToBin(capturedHex));
    expect(honest.outputs.length).toBeGreaterThanOrEqual(3);

    const submitTampered = async (mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(capturedHex));
      mutate(tx);
      await origSend(binToHex(encodeTransaction(tx)));
    };

    // (1) Wrong commitment on an entry output -> per-iteration OP_OUTPUTTOKENCOMMITMENT verify rejects.
    await expect(submitTampered((tx) => {
      tx.outputs[1].token!.nft!.commitment = hexToBin('deadbeef');
    })).rejects.toThrow();

    // (2) Redirect an entry output to a p2pkh address -> OP_OUTPUTBYTECODE verify rejects.
    await expect(submitTampered((tx) => {
      tx.outputs[1].lockingBytecode = hexToBin(`76a914${'00'.repeat(20)}88ac`);
    })).rejects.toThrow();

    // (3) Orphan: append a duplicate entry output so the tx has N+1 entry outputs while the counter is N ->
    // the output-count pin rejects. (Also unbalances the tx, which is itself a rejection - either way, refused.)
    await expect(submitTampered((tx) => {
      tx.outputs.push({
        ...tx.outputs[2],
        token: { ...tx.outputs[2].token!, nft: { ...tx.outputs[2].token!.nft! } },
      });
    })).rejects.toThrow();
  });
});
