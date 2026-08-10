import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

describe('vmap runtime struct read-modify-write loop', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('authenticates each old struct once and persists each rebuilt value', async () => {
    const artifact = compileString(`contract C() {
      struct P { int a; int b; int c; }
      mapping(int => P) pools;
      function seed(int k, int a, int b, int c, pubkey pk, sig s) {
        require(checkSig(s, pk)); pools[k] = P(a, b, c);
      }
      function update(int k) public returns (P pool) {
        pool = pools[k]; pool.a += 1; pool.b += 2; pools[k] = pool;
      }
      function mass(int[] keys, pubkey pk, sig s) external {
        require(checkSig(s, pk));
        for (int i = 0; i < keys.length; i++) { update(keys[i]); }
      }
      function check(int k, int a, int b, int c, pubkey pk, sig s) {
        require(checkSig(s, pk));
        require(pools[k].a == a); require(pools[k].b == b); require(pools[k].c == c);
      }
    }`);
    const info = artifact.abi.find((fn) => fn.name === 'mass')?.sortedUpsertLoopInfo?.[0];
    expect(info?.valueRuntimeLocal).toBeDefined();

    const fundingContract = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x7d00;
    const uid = (): string => (++nonce).toString(16).padStart(64, '0');
    const fundingUtxo = { txid: uid(), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(fundingContract.address, fundingUtxo);
    const { contract } = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo,
      funder: fundingContract.unlock.spend(alicePub, sig),
      initialState: {},
      changeAddress: fundingContract.address,
    });
    const fund = async (): Promise<void> => {
      await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100_000n });
    };

    await fund(); await contract.seed(3n, 10n, 20n, 30n, alicePub, sig).send();
    await fund(); await contract.seed(7n, 40n, 50n, 60n, alicePub, sig).send();
    await fund(); expect((await contract.mass([3n, 7n], alicePub, sig).send()).txid).toBeDefined();
    await fund(); await expect(contract.check(3n, 11n, 22n, 30n, alicePub, sig).send()).resolves.toBeDefined();
    await fund(); await expect(contract.check(7n, 41n, 52n, 60n, alicePub, sig).send()).resolves.toBeDefined();
  });
});
