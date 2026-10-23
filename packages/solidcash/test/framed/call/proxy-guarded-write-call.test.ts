import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
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
 * A frame that rewrites a field and then guards a call on it.
 *
 * The entry sets `this.hits = 7` and only then calls out when `this.hits == 7`. The published call site's condition
 * reads `hits`, so a planner that evaluates it against the state the frame *starts* with sees a false arm and drops
 * the call the body actually takes. The shape is driven through the shipped deployment, composer, derivation and
 * machine: the callee's frame has to be planned, derived and settled, and the transaction has to broadcast.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IPing { function ping(int n); }'
  + ' contract Ping { int public seen; function ping(int n) { require(n >= this.seen); require(true); } }'
  + ' contract Caller {'
  + '   address public implementation;'
  + '   address public target;'
  + '   int public hits;'
  + '   function initialize(address t) { this.target = t; this.hits = 0; require(true); }'
  + '   function run(int n) {'
  + '     this.hits = 7;'
  + '     if (this.hits == 7) { IPing(this.target).ping(n); }'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const callerArtifact = artifacts.Caller!;
const pingArtifact = artifacts.Ping!;

/** A 32-byte category that is neither constant nor palindromic, taken from its label. */
function categoryFor(label: string): string {
  return bytesToHex(sha256(utf8ToBin(label)));
}

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/** Deploys the callee and the caller behind its proxy, and runs the caller's initialize. */
async function deployShape(network: MockNetworkProvider): Promise<{
  readonly pingCategoryId: string;
  readonly callerProxyCategoryId: string;
  readonly callerImplementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  const pingCategoryId = categoryFor('guarded-write-ping');
  const callerProxyCategoryId = categoryFor('guarded-write-caller-proxy');
  const callerImplementationCategoryId = categoryFor('guarded-write-caller-implementation');

  // The callee is a plain framed contract reached at the address the caller's own record holds.
  const pingFunding = funding(pingCategoryId);
  await network.addUtxo(source.address, pingFunding);
  await deployStatefulContract(pingArtifact, [], {
    fundingUtxo: pingFunding, funder, changeAddress: source.address, provider: network, threadCount: 4,
  });

  for (const txid of [callerProxyCategoryId, callerImplementationCategoryId]) {
    await network.addUtxo(source.address, funding(txid));
  }
  const initCoin = funding(categoryFor('guarded-write-init-coin'));
  const callCoin = funding(categoryFor('guarded-write-call-coin'));
  for (const coin of [initCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
  await fundShippedFacets(network);

  const pingMaster = deployMaster(pingArtifact, hexToBin(pingCategoryId), VALIDATOR_PROGRAM);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: callerArtifact,
    proxyArtifact: buildProxyArtifact(callerArtifact),
    implementationDeploy: {
      fundingUtxo: funding(callerImplementationCategoryId), funder, changeAddress: source.address,
    },
    proxyDeploy: {
      fundingUtxo: funding(callerProxyCategoryId), funder, changeAddress: source.address,
    },
    initialize: { functionName: 'initialize', args: [pingMaster.address] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: initCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();

  return {
    pingCategoryId,
    callerProxyCategoryId: deployment.proxy.categoryId,
    callerImplementationCategoryId: deployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, callCoin, funder: callerFunder,
  };
}

describe('a frame that rewrites a field and then guards a call on it', () => {
  it('plans one call for the guarded site the frame itself makes true', async () => {
    const network = new MockNetworkProvider();
    const pingCategoryId = categoryFor('guarded-write-plan-ping');
    const pingMaster = deployMaster(pingArtifact, hexToBin(pingCategoryId), VALIDATOR_PROGRAM).address;
    await network.addUtxo(binToHex(pingMaster), {
      txid: pingCategoryId, vout: 0, satoshis: 500_000n,
      token: { category: pingCategoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    // The callee's live records, one per data NFT, as its own body reads them.
    const pingLayout = pingArtifact.stateLayout!;
    for (let nftIndex = 0; nftIndex < pingLayout.dataNftCount; nftIndex += 1) {
      await network.addUtxo(binToHex(stateRecordLockingBytecode(pingCategoryId)), {
        txid: `${pingCategoryId.slice(0, 62)}${(nftIndex + 1).toString(16).padStart(2, '0')}`,
        vout: nftIndex, satoshis: 1200n,
        token: { category: pingCategoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: buildPushdataCommitment(pingLayout, {}, nftIndex) } },
      });
    }

    // The caller's incoming state holds `hits = 0`, so the published condition is false before the entry writes.
    const plan = await planHopExternalCalls({
      provider: network,
      artifact: callerArtifact,
      functionName: 'run',
      args: [5n],
      externals: { IPing: { artifact: pingArtifact, categoryId: pingCategoryId } },
      stateValues: { target: pingMaster, hits: 0n },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    expect(plan.calls).toHaveLength(1);
    expect(plan.callBases).toStrictEqual([0]);
    expect(plan.callees.map((callee) => callee.entry)).toStrictEqual(['ping']);
  });

  it('settles the guarded call through the shipped hop and broadcasts', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployShape(network);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: callerArtifact,
      proxyArtifact: buildProxyArtifact(callerArtifact),
      proxyCategoryId: funded.callerProxyCategoryId,
      implementationCategoryId: funded.callerImplementationCategoryId,
      functionName: 'run',
      args: [5n],
      externals: { IPing: { artifact: pingArtifact, categoryId: funded.pingCategoryId } },
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The callee's frame completes before the caller's entry and its own fallback, and every participant accepts.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${pingArtifact.contractName}.ping()`,
      `${callerArtifact.contractName}.run()`,
      `${callerArtifact.contractName}Proxy.__fallback()`,
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
