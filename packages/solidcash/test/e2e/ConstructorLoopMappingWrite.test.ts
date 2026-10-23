import { describe, expect, it } from 'vitest';
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
 * A direct constructor whose runtime loop writes a verified mapping.
 *
 * The constructor publishes the loop (`sortedUpsertLoopInfo`) rather than an entry access, and the deployment probe
 * plans nodes from entry accesses alone. So a deployment whose loop writes an entry is refused rather than published
 * without the nodes the loop wrote, and one whose loop writes nothing deploys with the empty list's head alone.
 */

const SOURCE = `pragma solidcash ^0.14.0; contract Ledger {
  mapping(uint => uint) values;
  constructor(uint[] memory keys, uint v) { for (uint i = 0; i < keys.length; i++) { this.values[keys[i]] = v; } }
  function check(uint k, uint e) { require(this.values[k] == e); }
}`;

let fundingNonce = 0x5c00;

/** Deploys the ledger with `keys`; the mutable token outputs of its genesis transaction. */
async function deploy(keys: bigint[]): Promise<number> {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  fundingNonce += 1;
  const fundingUtxo = { txid: fundingNonce.toString(16).padStart(64, '0'), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(p2pkh.address, fundingUtxo);
  const result = await StatefulContract.deploy(compileString(SOURCE, { suppressWarnings: true }), [], {
    provider,
    fundingUtxo,
    funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: {},
    initArgs: [keys, 9n] as never,
    changeAddress: p2pkh.address,
  });
  // Output 0 is the category's authhead, whose identity NFT is mutable too.
  return result.tx.outputs.slice(1).filter((output) => output.token?.nft?.capability === 'mutable').length;
}

describe('a direct constructor whose runtime loop writes a verified mapping', () => {
  it('publishes the loop, not an entry access, for its constructor', () => {
    const constructor = compileString(SOURCE).abi.find((candidate) => candidate.name === '__construct');
    expect(constructor?.sortedUpsertLoopInfo?.map((loop) => loop.collection)).toEqual(['values']);
    expect(constructor?.entryAccesses).toBeUndefined();
  });

  it('deploys a loop that writes nothing, with the empty list\'s head alone', async () => {
    expect(await deploy([])).toBe(1);
  });

  it('refuses a loop that writes an entry rather than deploying without its node', async () => {
    for (const keys of [[1n], [1n, 2n], [1n, 1n]]) await expect(deploy(keys)).rejects.toThrow();
  });
});
