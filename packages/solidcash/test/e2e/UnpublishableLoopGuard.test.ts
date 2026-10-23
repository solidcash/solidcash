import { describe, expect, it } from 'vitest';
import { binToHex, sha256, utf8ToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// A varying-key upsert loop's published recipe tells iterations apart only by an `array[i] == literal` predicate.
// A write under any other guard refuses its function by name; the contract's other functions compile and settle.
const SOURCE = `contract C() {
  mapping(int => int) part; mapping(int => int) share;
  function seed(int k, int p, int s, pubkey pk, sig sg) { require(checkSig(sg, pk)); part[k] = p; share[k] = s; }
  function applyLiteral(int[] keys, int[] amounts, int[] actions, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (int i = 0; i < keys.length; i++) {
      if (actions[i] == 1) { part[keys[i]] = part[keys[i]] + amounts[i]; }
    }
  }
  function applyAbove(int[] keys, int[] amounts, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (int i = 0; i < keys.length; i++) {
      if (amounts[i] > 5) { part[keys[i]] = part[keys[i]] + amounts[i]; }
    }
  }
  function applyCovered(int[] keys, int[] amounts, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (int i = 0; i < keys.length; i++) {
      if (share[keys[i]] > amounts[i]) {
        part[keys[i]] = part[keys[i]] - amounts[i]; share[keys[i]] = share[keys[i]] - amounts[i];
      }
    }
  }
  function check(int k, int p, int s, pubkey pk, sig sg) {
    require(checkSig(sg, pk)); require(part[k] == p); require(share[k] == s);
  }
}`;

describe('varying-key upsert loop under a guard its recipe cannot carry', () => {
  it('refuses that function by name while the literal-guarded loop settles a skipped iteration', async () => {
    const artifact = compileString(SOURCE, { suppressWarnings: true });
    expect(artifact.refusedFunctions?.map((entry) => entry.functionName)).toEqual(['C.applyAbove()', 'C.applyCovered()']);
    expect(artifact.refusedFunctions?.[0].reason).toMatch(/^KERNEL_UNBOUNDED_KEY: the loop writes 'part' under the guard/);
    expect(artifact.refusedFunctions?.[1].reason)
      .toMatch(/^KERNEL_LAYOUT: the guard at Line 19, Column \d+ selects writes to 'part', 'share' in one loop/);

    const provider = createTestProvider();
    const sig = new SignatureTemplate(alicePriv);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0;
    const txid = (): string => binToHex(sha256.hash(utf8ToBin(`loop-guard-${nonce++}`)));
    const deploy = async (deployed: Artifact): Promise<any> => {
      const fundingUtxo = { txid: txid(), vout: 0, satoshis: 500_000n };
      await provider.addUtxo(p2pkh.address, fundingUtxo);
      const { contract } = await StatefulContract.deploy(deployed, [], {
        provider, fundingUtxo, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {},
        changeAddress: p2pkh.address,
      });
      return contract;
    };
    const fund = async (contract: { address: string }): Promise<void> => {
      await provider.addUtxo(contract.address, { txid: txid(), vout: 0, satoshis: 100_000n });
    };
    const contract = await deploy(artifact);
    await fund(contract); await contract.seed(3n, 10n, 50n, alicePub, sig).send();
    await fund(contract); await contract.seed(7n, 20n, 60n, alicePub, sig).send();
    // The second iteration skips the literal guard: the published predicate tells it apart.
    await fund(contract); await contract.applyLiteral([3n, 7n], [5n, 6n], [1n, 0n], alicePub, sig).send();
    await fund(contract); await expect(contract.check(3n, 15n, 50n, alicePub, sig).send()).resolves.toBeDefined();
    await fund(contract); await expect(contract.check(7n, 20n, 60n, alicePub, sig).send()).resolves.toBeDefined();

    await fund(contract);
    await expect(contract.applyAbove([3n, 7n], [6n, 2n], alicePub, sig).send())
      .rejects.toThrow(/C\.applyAbove\(\) is refused by the compiler: KERNEL_UNBOUNDED_KEY/);
    await expect(contract.applyCovered([3n, 7n], [5n, 6n], alicePub, sig).send())
      .rejects.toThrow(/C\.applyCovered\(\) is refused by the compiler: KERNEL_LAYOUT/);

    // The refused body fails in the program itself, so a builder that ignores the published refusal settles nothing.
    const unread = await deploy({ ...artifact, refusedFunctions: undefined });
    await fund(unread); await unread.seed(3n, 10n, 50n, alicePub, sig).send();
    await fund(unread);
    await expect(unread.applyAbove([3n], [6n], alicePub, sig).send())
      .rejects.toThrow(/input 0: Program failed an OP_VERIFY operation/);
    await fund(unread); await expect(unread.check(3n, 10n, 50n, alicePub, sig).send()).resolves.toBeDefined();
  }, 600_000);
});
