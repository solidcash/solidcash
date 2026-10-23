import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { type TransactionDetails } from '../../../src/index.js';
import { HDSigner } from '../../../src/HDSigner.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import type { FramedFunctionCall } from '../../../src/framed/call/index.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Sends a handle makes without awaiting the one before, as a test that fires a transaction and moves on does
 * (spec section 18, title #32). Each send takes its turn in the provider's queue, so the second picks its coin and
 * reads the records only after the first landed, rather than spending the same coin, master and record twice.
 */

const PHRASE = 'test test test test test test test test test test test junk';

// The source `call/handle.test.ts` compiles, so the compile cache serves both.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tally {'
  + '   int public total;'
  + '   function add(int by) { this.total = this.total + by; require(this.total >= 0); }'
  + '   function current() view returns (int) { return this.total; }'
  + ' }';

const tally = compileStringMulti(SOURCE, { composition: 'framed' }).Tally!;

interface TallyCalls {
  readonly add: (by: bigint) => FramedFunctionCall;
}

/** The outpoints a transaction spends, as `txid:vout`. */
function spent(details: TransactionDetails): string[] {
  return details.inputs.map((input) => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
}

describe('sends from one caller made without awaiting', () => {
  it('run in turn: the second spends what the first left, and no coin is spent twice', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signer = HDSigner.fromPhrase(PHRASE, provider);
    const fundingUtxo = { txid: '57'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(signer.getAddress(), fundingUtxo);
    await provider.addUtxo(signer.getAddress(), { txid: '58'.repeat(32), vout: 0, satoshis: 200_000n });
    await fundShippedFacets(provider);
    const deployment = await deployStatefulContract(tally, [], {
      provider, fundingUtxo, funder: signer.unlockP2PKH(), changeAddress: signer.getAddress(),
    });
    const handle = (deployment.contract as StatefulContract).connect(signer);
    const calls = handle.call as unknown as TallyCalls;

    // Both are sent before either is awaited: each would otherwise pick the caller's largest coin and the same live
    // master and record.
    const [first, second] = await Promise.all([calls.add(1n), calls.add(2n)]) as TransactionDetails[];

    expect(second!.txid).not.toBe(first!.txid);
    expect(spent(second!).some((outpoint) => outpoint.startsWith(`${first!.txid}:`))).toBe(true);
    expect(spent(second!).filter((outpoint) => spent(first!).includes(outpoint))).toStrictEqual([]);
    const records = await readFramedDeployment(provider, handle.categoryId, tally.stateLayout!);
    expect(parsePushdataCommitment(records.records[0]!.token!.nft!.commitment, tally.stateLayout!, 0).total).toBe(3n);
  });
});
