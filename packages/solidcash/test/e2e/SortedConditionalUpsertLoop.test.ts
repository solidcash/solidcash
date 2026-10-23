import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

describe('conditional vmap runtime-expression upsert loop', () => {
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

  it('uses disjoint grouped regions for two conditional mapping collections', async () => {
    const provider = createTestProvider();
    const sig = new SignatureTemplate(alicePriv);
    const artifact = compileString(`contract C() {
      mapping(int => int) a; mapping(int => int) b;
      function seedA(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); a[k] = v; }
      function seedB(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); b[k] = v; }
      function apply(int[] actions, int[] keys, int[] values, pubkey pk, sig s) {
        require(checkSig(s, pk));
        for (int i = 0; i < actions.length; i++) {
          if (actions[i] == 1) { a[keys[i]] = a[keys[i]] + values[i]; }
          else if (actions[i] == 2) { b[keys[i]] = b[keys[i]] + values[i]; }
        }
      }
      function checkA(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); require(a[k] == v); }
      function checkB(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); require(b[k] == v); }
    }`);
    expect(artifact.abi.find((fn) => fn.name === 'apply')?.sortedUpsertLoopInfo?.map((x) => x.collection))
      .toEqual(['a', 'b']);

    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x7f00;
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
    await fund(); await contract.seedA(3n, 10n, alicePub, sig).send();
    await fund(); await contract.seedB(4n, 20n, alicePub, sig).send();
    await fund();
    await expect(contract.apply([1n, 2n, 1n, 2n], [3n, 4n, 7n, 8n], [2n, 3n, 5n, 6n], alicePub, sig).send())
      .resolves.toBeDefined();
    for (const [method, key, value] of [
      ['checkA', 3n, 12n], ['checkA', 7n, 5n], ['checkB', 4n, 23n], ['checkB', 8n, 6n],
    ] as const) {
      await fund();
      await expect(contract[method](key, value, alicePub, sig).send()).resolves.toBeDefined();
    }
  });
});
