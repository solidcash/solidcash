import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

/**
 * A `mapping(K => V)` compiles to a SORTED (vmap linked-list) collection: the compiled artifact publishes
 * `stateLayout.collections[].sorted === true` for a plain `mapping(uint256 => bool)`.
 *
 * Writing `m[k] = v` stages an entry upsert, but a later read of `m[k]` in the SAME handler lowers through
 * `GenerateTargetTraversal.emitSortedSetRead`, which reads the on-chain input commitment. The non-sorted read
 * path consults `pendingEntryWrites` for exactly this reason (read-after-write decodes the pending encoded value,
 * so `m[k] = m[k] + 1; m[k] = m[k] + 1` adds 2); the sorted path never does. The read therefore returns the
 * PRE-write value.
 *
 * MARKETPLACE IMPACT. `MarketplaceV1.publishJobPost` writes `jobPost.whitelistWorkers = allowedWorkers_.length > 0`
 * and then packs `jobPost.whitelistWorkers` into the Created `JobEventData.data_` payload. On chain the job struct
 * holds `true` while the emitted payload carries `false`, so `marketplaceData.getEvents` reconstructs a job with
 * `whitelistWorkers === false` and `should whitelist worker` fails its `checkJobFromStateDiffs`. That is the
 * remaining cause of that title, independently of the value-chunk selection fixes.
 *
 * SKIPPED: the defect is not fixed yet. Un-skip this file together with the `emitSortedSetRead` fix.
 */
const SRC = `contract W() {
  struct Item { bool flag; bytes data; }
  Item plain;
  mapping(uint256 => bool) flags;
  mapping(uint256 => Item) items;

  function requireAfterWrite(int[] list) public {
    flags[0] = list.length > 0;
    require(flags[0]);
  }

  function packAfterWrite(int[] list) public {
    flags[1] = list.length > 0;
    plain.data = abi.encodePacked(flags[1]);
  }

  function packFieldAfterWrite(int[] list) public {
    items[0].flag = list.length > 0;
    items[0].data = abi.encodePacked(items[0].flag);
  }
}`;

describe.skip('sorted mapping read after write in one handler', () => {
  const connect = async (): Promise<{ contract: StatefulContract; provider: ReturnType<typeof createTestProvider> }> => {
    const provider = createTestProvider();
    const sig = new SignatureTemplate(alicePriv);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x1200;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const art = compileString(SRC, { forceStateful: true });
    const funding = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, funding);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, sig),
      initialState: {},
      changeAddress: p2pkh.address,
    });
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100000n });
    return { contract, provider };
  };

  it('sees the value it just wrote in a require', async () => {
    const { contract } = await connect();
    await contract.requireAfterWrite([1n]).send();
    expect(await contract.getEntries('flags')).toHaveLength(1);
  }, 60_000);

  it('packs the value it just wrote into a data blob', async () => {
    const { contract } = await connect();
    await contract.packAfterWrite([1n]).send();
    const entries = await contract.getEntries('flags');
    expect(entries).toHaveLength(1);
    expect(binToHex((await contract.getState()).plain as unknown as Uint8Array)).not.toBe('');
  }, 60_000);

  it('reads the struct field it just wrote through a mapping entry', async () => {
    const { contract } = await connect();
    await contract.packFieldAfterWrite([1n]).send();
    const entries = await contract.getEntries('items');
    expect(entries).toHaveLength(1);
  }, 60_000);
});
