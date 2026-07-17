import { describe, it, expect } from 'vitest';
import { hexToBin, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { getEntryNftAddress, SortedList, bytesToSlotValue, keyToSlot } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Deploy-time HEAD init: a freshly deployed contract with a C2 (sorted) mapping now gets its HEAD sentinel (slot 0)
// minted at genesis, so the first read/write works with NO manual seeding. Before this, an empty sorted mapping had
// no HEAD -> "missing HEAD sentinel" on first use. Fundamental for real C2-default contracts.
const SRC = `contract C() {
  mapping(int => bigint) balances;
  function set(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); balances[k] = v; }
}`;

describe('C2 mapping deploy-time HEAD sentinel', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x900;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  it('mints HEAD[0|0] at genesis so a fresh empty sorted mapping is writable', async () => {
    const art = compileString(SRC, { sortedMappings: ['balances'], forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const result = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig),
      initialState: {}, changeAddress: p2pkh.address,
    });
    const contract = result.contract;
    const categoryId = contract.categoryId!;
    const baseC = new Contract(art, [], { provider });
    const ea = getEntryNftAddress(baseC.withCategory(hexToBin(categoryId)), categoryId, 'balances');

    // HEAD sentinel (slot 0) present at genesis - no manual seeding.
    const head = SortedList.fromUtxos(await provider.getUtxos(ea)).all.find((e) => bytesToSlotValue(e.slot) === 0n);
    expect(head).toBeDefined();

    // First write inserts an entry against the genesis HEAD.
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100000n });
    expect((await contract.set(5n, 10n, alicePub, sig).send()).txid).toBeDefined();
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(bigIntToVmNumber(5n)));
    expect(e && vmNumberToBigInt(e.value)).toBe(10n);
  });
});
