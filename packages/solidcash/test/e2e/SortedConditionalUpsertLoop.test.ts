import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

describe('conditional C2 runtime-expression upsert loop', () => {
  it('derives predicated values for a no-op, update, and insert', async () => {
    const provider = createTestProvider();
    const sig = new SignatureTemplate(alicePriv);
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function seed(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k] = v; }
      function apply(int[] actions, int[] keys, int[] values, pubkey pk, sig s) {
        require(checkSig(s, pk));
        for (int i = 0; i < actions.length; i++) {
          if (actions[i] == 1) { m[keys[i]] = m[keys[i]] + values[i]; }
        }
      }
      function check(int k, int v, pubkey pk, sig s) {
        require(checkSig(s, pk)); require(m[k] == v);
      }
    }`);
    expect(artifact.abi.find((fn) => fn.name === 'apply')?.sortedUpsertLoopInfo?.[0]
      ?.valueRuntimeExpression).toBe(true);

    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x7e00;
    const uid = (): string => (++nonce).toString(16).padStart(64, '0');
    const deployment = { txid: uid(), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(p2pkh.address, deployment);
    const { contract } = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: deployment, funder: p2pkh.unlock.spend(alicePub, sig),
      initialState: {}, changeAddress: p2pkh.address,
    });
    const fund = async (): Promise<void> => {
      await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100_000n });
    };

    await fund(); await contract.seed(3n, 10n, alicePub, sig).send();
    await fund(); await contract.seed(7n, 20n, alicePub, sig).send();
    await fund();
    expect((await contract.apply([0n, 1n, 1n], [3n, 7n, 9n], [100n, 5n, 4n], alicePub, sig).send()).txid)
      .toBeDefined();
    await fund(); await expect(contract.check(3n, 10n, alicePub, sig).send()).resolves.toBeDefined();
    await fund(); await expect(contract.check(7n, 25n, alicePub, sig).send()).resolves.toBeDefined();
    await fund(); await expect(contract.check(9n, 4n, alicePub, sig).send()).resolves.toBeDefined();
  });
});
