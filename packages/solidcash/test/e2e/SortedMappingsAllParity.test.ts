import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { getEntryNftAddress, SortedList, bytesToSlotValue } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// C2 parity mode: compiling with { sortedMappingsAll: true } backs EVERY plain mapping with the C2 model, so
// reads are unforgeable (exclusion-proven on absent) = Solidity storage parity, WITHOUT naming each mapping.
// End-to-end: deploy (HEAD auto-minted) -> write -> present read -> absent read (proven default, not omittable).
const SRC = `contract C() {
  mapping(int => bigint) balances;
  function set(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); balances[k] = v; }
  function check(int k, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(balances[k] == exp); }
}`;

describe('C2 parity mode (sortedMappingsAll: every plain mapping is C2)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xa00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => { await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n }); };

  it('a plain mapping compiled with sortedMappingsAll deploys + reads/writes with exclusion proofs', async () => {
    const art = compileString(SRC, { sortedMappingsAll: true, forceStateful: true });
    expect(art.stateLayout?.collections?.find((c) => c.name === 'balances')?.sorted).toBe(true); // C2 without naming it

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const categoryId = contract.categoryId!;
    const ea = getEntryNftAddress(new Contract(art, [], { provider }).withCategory(hexToBin(categoryId)), categoryId, 'balances');
    expect(SortedList.fromUtxos(await provider.getUtxos(ea)).all.some((e) => bytesToSlotValue(e.slot) === 0n)).toBe(true);

    await fund(contract.address);
    expect((await contract.set(5n, 10n, alicePub, sig).send()).txid).toBeDefined(); // write balances[5]=10

    await fund(contract.address);
    expect((await contract.check(5n, 10n, alicePub, sig).send()).txid).toBeDefined(); // present read matches
    await fund(contract.address);
    expect((await contract.check(3n, 0n, alicePub, sig).send()).txid).toBeDefined(); // absent -> proven default 0
    await fund(contract.address);
    await expect(contract.check(3n, 7n, alicePub, sig).send()).rejects.toThrow(); // absent claimed nonzero -> revert
  });
});
