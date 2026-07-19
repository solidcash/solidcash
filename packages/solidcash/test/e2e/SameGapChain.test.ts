import { describe, it, expect } from 'vitest';
import { vmNumberToBigInt, bigIntToVmNumber } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList, bytesToSlotValue } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// SAME-GAP CHAIN: 2+ NEW recipients landing in ONE gap (a forward reference the single re-point can't express).
// Handled by chain-defer: each new node is DEFERRED after re-pointing its predecessor, so the next new key folds into
// it. Uses int keys so the test can pick a predecessor + two larger keys that share its (+inf) gap.
const SRC = `contract Token() {
  mapping(int => int) bal;
  function setBal(int a, int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.bal[a] = v; }
  function multiTransfer(int[] recipients, int[] amounts, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (int i = 0; i < recipients.length; i++) {
      this.bal[recipients[i]] += amounts[i];
    }
  }
  function chk(int a, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.bal[a] == exp); }
}`;

describe('SAME-GAP CHAIN: 2+ new recipients in one gap (chain-defer)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xc000;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  // pick K0 (smallest slot) as the credited predecessor, K1 < K2 as two NEW keys in K0's (+inf) gap.
  const slotOf = (k: bigint): bigint => bytesToSlotValue(keyToSlot(bigIntToVmNumber(k)));
  const ranked = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n].map((k) => ({ k, v: slotOf(k) })).sort((a, b) => (a.v < b.v ? -1 : 1));
  const K0 = ranked[0].k; const K1 = ranked[1].k; const K2 = ranked[2].k; // K0 < K1 < K2 by slot

  it('inserts two NEW keys that both land in one credited entry\'s gap (K0 -> K1 -> K2)', async () => {
    const art = compileString(SRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract, categoryId } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const ea = getEntryNftAddress(contract.inner, categoryId, 'bal');
    const valOf = async (k: bigint): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(bigIntToVmNumber(k)));
      return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    };
    const call = (fn: string, ...a: unknown[]): { send: () => Promise<unknown> } =>
      (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)[fn](...a);
    // seed ONLY K0 so its successor is +inf; K1 and K2 both fall in (K0, +inf).
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await call('setBal', K0, 100n, alicePub, sig).send();

    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await call('multiTransfer', [K0, K1, K2], [10n, 20n, 30n], alicePub, sig).send();
    expect(await valOf(K0)).toBe(110n); // updated 100 + 10, re-pointed to K1
    expect(await valOf(K1)).toBe(20n);  // NEW, chained after K0
    expect(await valOf(K2)).toBe(30n);  // NEW, chained after K1

    // CHAIN VALIDITY: a read walks HEAD -> K0 -> K1 -> K2. chk reverts if any link is broken.
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(call('chk', K2, 30n, alicePub, sig).send()).resolves.toBeDefined(); // K2 reachable through the chain
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(call('chk', K1, 20n, alicePub, sig).send()).resolves.toBeDefined();
  });
});
