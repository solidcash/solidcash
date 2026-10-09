import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

/**
 * A sorted (vmap) mapping entry is written through one entry upsert, and a later read of the same entry in the
 * same handler must observe that write - Solidity's `job.flag = true; require(job.flag);` cannot read the
 * pre-handler value. `CacheMappingEntryInLoop` provides this with a read-once/mutate-local/write-once cache.
 *
 * Two shapes used to escape that cache and read the stale on-chain input commitment instead:
 *
 * 1. `m[<numeric literal>]` is a `TupleIndexOpNode` before symbol resolution lowers it to a mapping access, so the
 *    pass never recognised the read and never marked the entry read-after-write.
 * 2. A key declared by a body statement (`uint256 id = jobs.length - 1; jobs[id]...`) is in scope only after that
 *    statement, and the cache read used to be hoisted to the function entry unconditionally, so such entries were
 *    refused outright. They are now anchored at the entry's first use, where the key is already in scope.
 *
 * Marketplace impact this guards: `MarketplaceV1.publishJobPost` writes `jobPost.whitelistWorkers` and then packs
 * it into the Created `JobEventData.data_` payload. Reading the pre-write value published `whitelistWorkers: false`
 * for a job posted with a whitelist, which is what `should whitelist worker` compares through `getEvents`.
 *
 * The SDK evaluates a computed key against the state the call starts from, so a key read from state the handler
 * assigned earlier (`counter = counter + 1; uint256 id = counter - 1;`) is published as the assigned value. Naming
 * it `state:counter` proved the entry at the pre-increment key, and two writes keyed by `counter` on either side of
 * its increment shared one slot.
 */
const SRC = `contract W() {
  struct Job { bool whitelistWorkers; bytes data; }
  uint256 counter;
  bytes plain;
  mapping(uint256 => bool) flags;
  mapping(uint256 => Job) jobs;

  function requireLiteralKey(int[] list) public {
    flags[4] = list.length > 0;
    require(flags[4]);
  }

  function packLiteralKey(int[] list) public {
    flags[5] = list.length > 0;
    plain = abi.encodePacked(flags[5]);
  }

  // Marketplace shape: the key is computed on-chain and the written field is packed immediately afterwards.
  function post(bool whitelisted) public {
    counter = counter + 1;
    uint256 id = counter - 1;
    Job storage job = jobs[id];
    job.whitelistWorkers = whitelisted;
    plain = abi.encodePacked(job.whitelistWorkers);
  }

  function postThenRequire(bool whitelisted) public {
    counter = counter + 1;
    uint256 id = counter - 1;
    Job storage job = jobs[id];
    job.whitelistWorkers = whitelisted;
    require(job.whitelistWorkers);
  }
}`;

const PAIR_SRC = `contract P() {
  uint256 counter;
  mapping(uint256 => uint256) seq;

  function pair(uint256 v) public {
    seq[counter] = v;
    counter = counter + 1;
    seq[counter] = v + 1;
  }

  function seqIs(uint256 k, uint256 v) public {
    require(seq[k] == v);
  }
}`;

interface Fixture {
  call: (name: string, args: unknown[]) => Promise<void>;
  packed: () => Promise<string>;
}

/** Fresh provider + deployment per case: each function writes its own entry and is asserted independently. */
const fixture = async (source: string = SRC): Promise<Fixture> => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x4200;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const art = compileString(source, { forceStateful: true, suppressWarnings: true });
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
  return {
    call: async (name, args) => {
      const fn = (contract as unknown as Record<string, (...a: unknown[]) => { send(): Promise<unknown> }>)[name];
      await fn(...args).send();
    },
    packed: async () => binToHex((await contract.getState()).plain as Uint8Array),
  };
};

describe('sorted mapping read after write in one handler', () => {
  it('sees a literal-key write in the same handler', async () => {
    const { call } = await fixture();
    await expect(call('requireLiteralKey', [[1n]])).resolves.toBeUndefined();
  }, 60_000);

  it('packs the value it just wrote for a literal-key entry', async () => {
    const { call, packed } = await fixture();
    await call('packLiteralKey', [[1n]]);
    expect(await packed()).toBe('01');
  }, 60_000);

  it('packs the field it just wrote through an on-chain computed key', async () => {
    const { call, packed } = await fixture();
    await call('post', [true]);
    expect(await packed()).toBe('01');
  }, 60_000);

  it('requires the field it just wrote through an on-chain computed key', async () => {
    const { call } = await fixture();
    await expect(call('postThenRequire', [true])).resolves.toBeUndefined();
  }, 60_000);

  it('writes the two entries a counter keys on either side of its increment', async () => {
    const { call } = await fixture(PAIR_SRC);
    await call('pair', [5n]);
    await expect(call('seqIs', [0n, 5n])).resolves.toBeUndefined();
    await expect(call('seqIs', [1n, 6n])).resolves.toBeUndefined();
    // The second write lands under the incremented key, never over the first entry.
    await expect(call('seqIs', [0n, 6n])).rejects.toThrow(/OP_VERIFY/);
  }, 90_000);
});
