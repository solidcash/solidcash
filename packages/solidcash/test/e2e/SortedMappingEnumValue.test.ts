import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// An enum value is its ordinal integer on the wire, so `mapping(K => Enum)` is C2-backed by default (int value kind):
// unforgeable present reads AND exclusion-proof absent reads (an unwritten key proves the default = the 0th member).
describe('sorted enum-valued mapping (C2, int value kind)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('set/read an enum value; absent key proves the default (0th member)', async () => {
    const SRC = `contract C() {
      enum Status { Idle, Active, Done }
      mapping(int => Status) m;
      function set(int k, Status v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k] = v; }
      function chk(int k, Status e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k] == e); }
    }`;
    const art = compileString(SRC);
    expect(art.stateLayout?.collections?.find((c) => c.name === 'm')?.sorted).toBe(true);

    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x3c00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (addr: string): Promise<void> => {
      await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
    };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });

    await fund(contract.address);
    expect((await contract.set(5n, 1n, alicePub, sig).send()).txid).toBeDefined(); // m[5] = Active (ordinal 1)
    await fund(contract.address);
    expect((await contract.chk(5n, 1n, alicePub, sig).send()).txid).toBeDefined(); // reads Active
    await fund(contract.address);
    expect((await contract.chk(9n, 0n, alicePub, sig).send()).txid).toBeDefined(); // absent -> proven default Idle (0)
    await fund(contract.address);
    expect((await contract.set(5n, 2n, alicePub, sig).send()).txid).toBeDefined(); // m[5] = Done
    await fund(contract.address);
    expect((await contract.chk(5n, 2n, alicePub, sig).send()).txid).toBeDefined(); // updated
  });
});
