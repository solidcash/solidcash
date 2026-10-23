import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, sha256 } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployMaster, stateRecordLockingBytecode } from '../../../src/framed/deploy/index.js';
import { planHopExternalCalls } from '../../../src/framed/proxy/external-calls.js';
import { VALIDATOR_PROGRAM } from '../shapes/harness.js';

/**
 * A frame that rebuilds an array element and guards a call on a field it leaves unchanged.
 *
 * The entry writes `jobs[id].state` and only then calls out when `jobs[id].timestamp == 0`. The element write is a
 * whole-element construction that copies `timestamp` back out of the element, so the published write fact names it
 * as preserved and the call's condition stays settled by the incoming state. A planner that read the write as
 * touching every field would state a record for an arm the run does not take, and the frame's own call-site check
 * would then bind the wrong record. The shape is planned through the shipped entry point.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IPing { function ping(int n); }'
  + ' contract Ping { int public seen; function ping(int n) { require(n >= this.seen); require(true); } }'
  + ' contract Ledger {'
  + '   struct Job { int state; int timestamp; int amount; }'
  + '   Job[] jobs;'
  + '   address public target;'
  + '   function preserved(int jobId) {'
  + '     this.jobs[jobId].state = 1;'
  + '     if (this.jobs[jobId].timestamp == 0) { IPing(this.target).ping(jobId); }'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const ledger = artifacts.Ledger!;
const ping = artifacts.Ping!;

/** A 32-byte category that is neither constant nor palindromic, taken from its label. */
function categoryFor(label: string): string {
  return bytesToHex(sha256(utf8ToBin(label)));
}

describe('a guarded call site whose condition reads a field the element write leaves unchanged', () => {
  it('states no record for the arm the incoming state closes', async () => {
    const network = new MockNetworkProvider();
    const pingCategoryId = categoryFor('guarded-element-ping');
    const pingMaster = deployMaster(ping, hexToBin(pingCategoryId), VALIDATOR_PROGRAM).address;
    await network.addUtxo(binToHex(pingMaster), {
      txid: pingCategoryId, vout: 0, satoshis: 500_000n,
      token: { category: pingCategoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    const pingLayout = ping.stateLayout!;
    for (let nftIndex = 0; nftIndex < pingLayout.dataNftCount; nftIndex += 1) {
      await network.addUtxo(binToHex(stateRecordLockingBytecode(pingCategoryId)), {
        txid: `${pingCategoryId.slice(0, 62)}${(nftIndex + 1).toString(16).padStart(2, '0')}`,
        vout: nftIndex, satoshis: 1200n,
        token: { category: pingCategoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: buildPushdataCommitment(pingLayout, {}, nftIndex) } },
      });
    }

    // The live element holds `timestamp = 5`, so the guarded arm is closed and its call is the run the frame skips.
    const plan = await planHopExternalCalls({
      provider: network,
      artifact: ledger,
      functionName: 'preserved',
      args: [0n],
      externals: { IPing: { artifact: ping, categoryId: pingCategoryId } },
      stateValues: { target: pingMaster, jobs: [{ state: 0, timestamp: 5, amount: 0 }] },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    expect(plan.calls).toHaveLength(0);
    expect(plan.callBases).toStrictEqual([-1]);
  });
});
