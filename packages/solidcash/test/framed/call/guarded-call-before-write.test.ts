import { describe, expect, it } from 'vitest';
import {
  binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin,
} from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, sha256 } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster, stateRecordLockingBytecode } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import { planHopExternalCalls } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A guarded call whose condition reads a variable the entry writes only on the far side of the call.
 *
 * The `after` entry calls out when `total == 0` and only then sets `total = 5`; the write lies after the call, so
 * no write can precede the guarded site on the path that reaches it and the incoming state fixes the condition. The
 * mirror, a write that does precede the site and makes its condition true, still states the call: that is
 * `call/proxy-guarded-write-call.test.ts` ("plans one call for the guarded site the frame itself makes true"). A
 * planner that treated any write to the variable as preceding the site would state a record for the arm the
 * incoming state closes; one that dropped every write would lose the call the body makes true.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IPing { function ping(int n); }'
  + ' contract Ping { int public seen; function ping(int n) { require(n >= this.seen); require(true); } }'
  + ' contract Ledger {'
  + '   address public implementation;'
  + '   int total;'
  + '   address public target;'
  + '   function initialize(address t) { this.target = t; this.total = 7; require(true); }'
  + '   function after(int n) {'
  + '     if (this.total == 0) { IPing(this.target).ping(n); }'
  + '     this.total = 5;'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const ledger = artifacts.Ledger!;
const ping = artifacts.Ping!;

/** The mirror whose write is a dynamic value's push: its records are rebuilt in the run's last segment. */
const DYNAMIC_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IPing { function ping(int n); }'
  + ' contract Ping { int public seen; function ping(int n) { require(n >= this.seen); require(true); } }'
  + ' contract Queue {'
  + '   int[] items;'
  + '   address public target;'
  + '   function run(int n) {'
  + '     this.items.push();'
  + '     if (this.items.length == 1) { IPing(this.target).ping(n); }'
  + '     require(true);'
  + '   }'
  + ' }';

const dynamicArtifacts = compileStringMulti(DYNAMIC_SOURCE, { composition: 'framed' });
const queue = dynamicArtifacts.Queue!;
const queuePing = dynamicArtifacts.Ping!;

/** A 32-byte category that is neither constant nor palindromic, taken from its label. */
function categoryFor(label: string): string {
  return bytesToHex(sha256(utf8ToBin(label)));
}

/** The live callee master and its records, so the planner can resolve the callee of a stated call. */
async function liveCallee(
  network: MockNetworkProvider, categoryId: string, artifact: typeof ping,
): Promise<Uint8Array> {
  const master = deployMaster(artifact, hexToBin(categoryId), VALIDATOR_PROGRAM).address;
  await network.addUtxo(binToHex(master), {
    txid: categoryId, vout: 0, satoshis: 500_000n,
    token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  const layout = artifact.stateLayout!;
  for (let nftIndex = 0; nftIndex < layout.dataNftCount; nftIndex += 1) {
    await network.addUtxo(binToHex(stateRecordLockingBytecode(categoryId)), {
      txid: `${categoryId.slice(0, 62)}${(nftIndex + 1).toString(16).padStart(2, '0')}`,
      vout: nftIndex, satoshis: 1200n,
      token: { category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: buildPushdataCommitment(layout, {}, nftIndex) } },
    });
  }
  return master;
}

describe('a guarded call whose condition reads a variable the entry writes after it', () => {
  it('states no record for the arm the incoming state closes', async () => {
    const network = new MockNetworkProvider();
    const pingCategoryId = categoryFor('guarded-before-write-ping');
    const pingMaster = await liveCallee(network, pingCategoryId, ping);

    // `total = 7`, so the guarded arm is closed and its call is the run the frame skips.
    const plan = await planHopExternalCalls({
      provider: network,
      artifact: ledger,
      functionName: 'after',
      args: [1n],
      externals: { IPing: { artifact: ping, categoryId: pingCategoryId } },
      stateValues: { target: pingMaster, total: 7n },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    expect(plan.calls).toHaveLength(0);
    expect(plan.callBases).toStrictEqual([-1]);
  });

  it('keeps the conservative reading when a dynamic write precedes the guarded site', async () => {
    const network = new MockNetworkProvider();
    const pingCategoryId = categoryFor('guarded-dynamic-write-ping');
    const pingMaster = await liveCallee(network, pingCategoryId, queuePing);

    // The entry pushes before the guard, and a dynamic value's records are rebuilt in the run's last segment, so
    // its published segment cannot place the write: the site is still stated conservatively.
    const plan = await planHopExternalCalls({
      provider: network,
      artifact: queue,
      functionName: 'run',
      args: [1n],
      externals: { IPing: { artifact: queuePing, categoryId: pingCategoryId } },
      stateValues: { target: pingMaster, items: [] },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    expect(plan.calls).toHaveLength(1);
    expect(plan.callBases).toStrictEqual([0]);
  });

  it('settles the skipped arm through the shipped hop and broadcasts', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = source.unlock.spend(alicePub, signature);
    const callerFunder = signature.unlockP2PKH();
    const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

    const pingCategoryId = categoryFor('guarded-before-write-live-ping');
    const callerProxyCategoryId = categoryFor('guarded-before-write-live-proxy');
    const callerImplementationCategoryId = categoryFor('guarded-before-write-live-impl');
    const pingFunding = { txid: pingCategoryId, vout: 0, satoshis: 500_000n };
    await network.addUtxo(source.address, pingFunding);
    await deployStatefulContract(ping, [], {
      fundingUtxo: pingFunding, funder, changeAddress: source.address, provider: network, threadCount: 4,
    });
    for (const txid of [callerProxyCategoryId, callerImplementationCategoryId]) {
      await network.addUtxo(source.address, { txid, vout: 0, satoshis: 500_000n });
    }
    const initCoin = { txid: categoryFor('guarded-before-write-init-coin'), vout: 0, satoshis: 300_000n };
    const callCoin = { txid: categoryFor('guarded-before-write-call-coin'), vout: 0, satoshis: 300_000n };
    for (const coin of [initCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
    await fundShippedFacets(network);

    const pingMaster = deployMaster(ping, hexToBin(pingCategoryId), VALIDATOR_PROGRAM);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: ledger,
      proxyArtifact: buildProxyArtifact(ledger),
      implementationDeploy: {
        fundingUtxo: { txid: callerImplementationCategoryId, vout: 0, satoshis: 500_000n },
        funder, changeAddress: source.address,
      },
      proxyDeploy: {
        fundingUtxo: { txid: callerProxyCategoryId, vout: 0, satoshis: 500_000n },
        funder, changeAddress: source.address,
      },
      initialize: { functionName: 'initialize', args: [pingMaster.address] },
      callerLockingBytecode: deployerLock,
      callerFunding: { utxo: initCoin, funder: callerFunder, changeAddress: source.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();

    // `initialize` leaves `total = 7`, so `after`'s guard is false and its call is the arm the run skips.
    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: ledger,
      proxyArtifact: buildProxyArtifact(ledger),
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'after',
      args: [5n],
      externals: { IPing: { artifact: ping, categoryId: pingCategoryId } },
      callerUtxo: callCoin,
      callerLockingBytecode: deployerLock,
      funder: callerFunder,
      changeAddress: source.address,
      vm: compositionMachine(),
    });

    // No callee frame is placed: the guarded call is dropped, and the entry's own write still settles.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${ledger.contractName}.after()`,
      `${ledger.contractName}Proxy.__fallback()`,
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
