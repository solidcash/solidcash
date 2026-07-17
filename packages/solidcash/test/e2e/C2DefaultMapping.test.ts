import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { getEntryNftAddress, SortedList, bytesToSlotValue } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Locks the FLIP: a plain mapping compiled with NO storage options is C2 by DEFAULT (exclusion-proof reads =
// Solidity storage parity). Exercises the full lifecycle under the default: deploy (HEAD auto-minted) -> write ->
// RMW -> present read -> absent bracket-proven default -> omission claim reverts -> delete (nullify).
const SRC = `contract C() {
  mapping(int => bigint) bal;
  function set(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); bal[k] = v; }
  function add(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); bal[k] = bal[k] + v; }
  function del(int k, pubkey pk, sig s) { require(checkSig(s, pk)); delete bal[k]; }
  function check(int k, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(bal[k] == exp); }
}`;

describe('C2 is the default for a plain mapping (no options)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xc00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => { await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n }); };

  it('a plain mapping is C2 by default: deploy, write, RMW, exclusion-proof reads, delete', async () => {
    const art = compileString(SRC, { forceStateful: true }); // NO sortedMappings / sortedMappingsAll
    expect(art.stateLayout?.collections?.find((c) => c.name === 'bal')?.sorted).toBe(true); // C2 by default

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const categoryId = contract.categoryId!;
    const ea = getEntryNftAddress(new Contract(art, [], { provider }).withCategory(hexToBin(categoryId)), categoryId, 'bal');
    expect(SortedList.fromUtxos(await provider.getUtxos(ea)).all.some((e) => bytesToSlotValue(e.slot) === 0n)).toBe(true); // HEAD

    await fund(contract.address);
    expect((await contract.set(5n, 10n, alicePub, sig).send()).txid).toBeDefined(); // bal[5] = 10
    await fund(contract.address);
    expect((await contract.add(5n, 7n, alicePub, sig).send()).txid).toBeDefined(); // RMW -> 17

    await fund(contract.address);
    expect((await contract.check(5n, 17n, alicePub, sig).send()).txid).toBeDefined(); // present read
    await fund(contract.address);
    expect((await contract.check(3n, 0n, alicePub, sig).send()).txid).toBeDefined(); // absent -> proven default 0
    await fund(contract.address);
    await expect(contract.check(3n, 1n, alicePub, sig).send()).rejects.toThrow(); // absent claimed nonzero -> revert

    await fund(contract.address);
    expect((await contract.del(5n, alicePub, sig).send()).txid).toBeDefined(); // delete -> nullify
    await fund(contract.address);
    expect((await contract.check(5n, 0n, alicePub, sig).send()).txid).toBeDefined(); // deleted reads as default 0
  });
});
