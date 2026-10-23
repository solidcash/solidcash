import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose entry reaches one callee contract from several sites of one entry.
 *
 * The entry calls the callee from two unconditional sites with different arguments, from a loop whose turn count
 * one of the caller's own arguments fixes, and from a guarded site the caller's argument leaves untaken. Each
 * reach carries its own call data, so each runs on a master of its own: the four reaches take four masters of the
 * callee, all of them in the callee contract's one block, and the untaken site places neither a master nor a
 * record. The hop is driven only through the shipped deployment, composer, derivation and machine.
 */

const STORE_CATEGORY = '11'.repeat(31) + 'ee';
const IMPL_CATEGORY = '22'.repeat(31) + 'dd';
const PROXY_CATEGORY = '33'.repeat(31) + 'cc';
const STORE_ADDRESS = validatorAddress(hexToBin(STORE_CATEGORY), VALIDATOR_PROGRAM);
const hexOf = (bytes: Uint8Array): string => binToHex(bytes);

// The callee reads its own record beside every call, so each of its masters declares the record it shares with the
// contract's other masters. The last site is guarded by a forwarded boolean, so the plan resolves the guard against
// the caller's own argument rather than filling it.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IStore { function note(int a, int b); function tick(int n); }'
  + ' contract Store {'
  + '   int public floor;'
  + '   function note(int a, int b) { require(a >= this.floor); require(b >= this.floor); require(true); }'
  + '   function tick(int n) { require(n >= this.floor); require(true); }'
  + ' }'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   int public marker;'
  + '   function initialize() { this.marker = 1; require(this.marker == 1); }'
  + '   function run(bool takeExtra, int times) {'
  + `     IStore(0x${hexOf(STORE_ADDRESS)}).note(1, 2);`
  + `     IStore(0x${hexOf(STORE_ADDRESS)}).note(3, 4);`
  + `     for (int i = 0; i < times; i = i + 1) { IStore(0x${hexOf(STORE_ADDRESS)}).tick(i); }`
  + `     if (takeExtra) { IStore(0x${hexOf(STORE_ADDRESS)}).note(9, 9); }`
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const impl = artifacts.Impl!;
const store = artifacts.Store!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string, satoshis = 5_000_000n): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis };
}

/** Deploys the callee with a pool sized for every reach the entry makes. */
async function deployCallee(
  network: MockNetworkProvider, source: Contract, funder: ReturnType<Contract['unlock']['spend']>,
  changeAddress: string, threadCount: number,
): Promise<void> {
  const coin = funding(STORE_CATEGORY);
  await network.addUtxo(source.address, coin);
  await deployStatefulContract(store, [], {
    fundingUtxo: coin, funder, changeAddress, provider: network, threadCount,
  });
}

/** Deploys the implementation behind its proxy, runs `initialize`, and returns what a later call needs. */
async function deployBoth(network: MockNetworkProvider, threadCount: number): Promise<{
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
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

  await deployCallee(network, source, funder, source.address, threadCount);
  const implCoin = funding(IMPL_CATEGORY);
  const proxyCoin = funding(PROXY_CATEGORY);
  for (const coin of [implCoin, proxyCoin]) await network.addUtxo(source.address, coin);
  const initCoin = funding('55'.repeat(32));
  const callCoin = funding('77'.repeat(32));
  for (const coin of [initCoin, callCoin]) await network.addUtxo(hexOf(deployerLock), coin);
  await fundShippedFacets(network);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: impl,
    proxyArtifact: buildProxyArtifact(impl),
    implementationDeploy: { fundingUtxo: implCoin, funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: proxyCoin, funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: initCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();

  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    deployerLock,
    changeAddress: source.address,
    callCoin,
    funder: callerFunder,
  };
}

/** A deployment of both contracts, on the network that holds it. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly funded: Awaited<ReturnType<typeof deployBoth>>;
}

let deployedRun: Promise<Deployed> | undefined;

/**
 * The one deployment both cases share, its callee's pool holding a master for each of the five reaches the second
 * case makes: the first call enters with the coin it funded, a later one with a fresh coin at `txid`.
 */
async function sharedDeployment(txid?: string): Promise<Deployed> {
  deployedRun ??= (async (): Promise<Deployed> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    return { network, funded: await deployBoth(network, 5) };
  })();
  const deployed = await deployedRun;
  if (txid === undefined) return deployed;
  const callCoin = funding(txid);
  await deployed.network.addUtxo(hexOf(deployed.funded.deployerLock), callCoin);
  return { network: deployed.network, funded: { ...deployed.funded, callCoin } };
}

describe('a hop whose entry reaches one contract from several sites', () => {
  it('gives each reach its own master, skips the untaken site, and broadcasts', async () => {
    const { network, funded } = await sharedDeployment();

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'run',
      args: [false, 2n],
      externals: { IStore: { artifact: store, categoryId: STORE_CATEGORY } },
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // Every reach completes before the entry that made it, which completes before the fallback that entered it:
    // the two unconditional calls, then the loop's two turns, then the entry and the fallback.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${store.contractName}.note()`,
      `${store.contractName}.note()`,
      `${store.contractName}.tick()`,
      `${store.contractName}.tick()`,
      `${impl.contractName}.run()`,
      'ImplProxy.__fallback()',
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The four reaches share the callee's one block, one master each: the guarded site the caller's argument leaves
    // untaken places neither a master nor a record.
    const storeBlock = result.draft.layout.blocks.find((block) => block.contract === store.contractName)!;
    expect(storeBlock.masters).toStrictEqual([
      'callee-master-1', 'callee-master-2', 'callee-master-3', 'callee-master-4',
    ]);
    expect(result.draft.layout.blocks.filter((block) => block.contract === store.contractName)).toHaveLength(1);
    // The entry ran four calls, not five, and stated where each published site's calls begin.
    expect(result.draft.blockOf('implementation-master').calls).toHaveLength(4);
  });

  it('carries each reach\'s own call data, so the loop\'s turns differ from one another', async () => {
    const { network, funded } = await sharedDeployment('77'.repeat(31) + 'c2');

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'run',
      args: [true, 2n],
      externals: { IStore: { artifact: store, categoryId: STORE_CATEGORY } },
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The guarded site is taken now, so it reaches a fifth master of the same contract.
    const storeBlock = result.draft.layout.blocks.find((block) => block.contract === store.contractName)!;
    expect(storeBlock.masters).toHaveLength(5);
    expect(result.accepted).toBe(true);
    // The entry ran five calls, and the arguments each reach carries digests to five distinct call data: the two
    // unconditional calls, the loop's two turns and the guarded call all differ from one another.
    const implCalls = result.draft.blockOf('implementation-master').calls;
    expect(implCalls).toHaveLength(5);
    const hashes = implCalls.map((call) => bytesToHex(call.argsHash));
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
