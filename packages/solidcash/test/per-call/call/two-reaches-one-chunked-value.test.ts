import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256 } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry, type PerCallProxyCallResult } from '../../../src/per-call/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * One hop reaching the same callee entry twice, each appending to one held key of a dynamic-valued sorted mapping.
 *
 * `Log.events` is a sorted mapping whose value is an `int[]`, so its records chunk. The deployment's own initialize
 * appends 100 to key 1, leaving that key's node live. `Root.run` then reaches `Log.append` twice in one entry body,
 * each appending one element to the same held key: both reaches are planned against the deployment alone and both
 * rewrite the one node in place.
 *
 * A node whose value chunks is not chained across frames: a later frame takes the run's width, and a long value it
 * reads, from the value the deployment holds, not the value the earlier frame wrote. The hop therefore refuses the
 * pair by name before broadcasting. The call below is the positive form of that: once the chain is settled, the
 * composed transaction's callee node holds both appended elements, read back through the shipped read path.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`two reaches one chunked value ${label}`)));
}

const LOG_IMPL_CATEGORY = idOf('log implementation');
const LOG_PROXY_CATEGORY = idOf('log proxy');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');

/** The key both reaches append to, seeded by the deployment's own initialize. */
const KEY = 1n;
const SEED = 100n;

/** A proxied log whose initialize seeds key 1, and a proxied root that reaches its append twice. */
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface ILog { function append(int value); }'
  + ' contract Log {'
  + '   address public implementation;'
  + '   mapping(int => int[]) events;'
  + `   function initialize() { this.events[${KEY}].push(${SEED}); require(true); }`
  + `   function append(int value) { this.events[${KEY}].push(value); }`
  + `   function count() view returns (int) { return this.events[${KEY}].length; }`
  + `   function at(int index) view returns (int) { return this.events[${KEY}][index]; }`
  + ' }'
  + ' contract Root {'
  + '   address public implementation;'
  + '   address public log;'
  + '   function initialize(address l) { this.log = l; require(true); }'
  + '   function run(int first, int second) { ILog(this.log).append(first); ILog(this.log).append(second); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const log = artifacts.Log!;
const root = artifacts.Root!;

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployment the cases share, and the chain as it stood when the deployment was done. */
interface World {
  readonly network: MockNetworkProvider;
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly logProxyCategoryId: string;
  readonly logImplementationCategoryId: string;
  readonly callerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly snapshot: SnapshotRestorer;
}

/** Deploys the log and the root behind their proxies, and runs both initializes. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  for (const categoryId of [LOG_IMPL_CATEGORY, LOG_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const logInitCoin = funding(idOf('log initialize coin'));
  const rootInitCoin = funding(idOf('root initialize coin'));
  const callCoin = funding(idOf('call coin'));
  for (const coin of [logInitCoin, rootInitCoin, callCoin]) await network.addUtxo(binToHex(callerLock), coin);
  await fundShippedFacets(network);

  const logDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: log,
    proxyArtifact: buildProxyArtifact(log),
    implementationDeploy: { fundingUtxo: funding(LOG_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(LOG_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: callerLock,
    callerFunding: { utxo: logInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(logDeployment.initialize.broadcast).toBeDefined();
  const rootDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [logDeployment.proxy.address] },
    callerLockingBytecode: callerLock,
    callerFunding: { utxo: rootInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();
  return {
    network,
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    logProxyCategoryId: logDeployment.proxy.categoryId,
    logImplementationCategoryId: logDeployment.implementation.categoryId,
    callerLock,
    changeAddress: wallet.address,
    callCoin,
    funder: callerFunder,
    snapshot: await network.takeSnapshot(),
  };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** One call of the root's entry through its proxy, the log reached behind its own. */
function callRoot(world: World, functionName: string, args: readonly bigint[]): Promise<PerCallProxyCallResult> {
  return callPerCallProxyEntry({
    provider: world.network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: world.rootProxyCategoryId,
    implementationCategoryId: world.rootImplementationCategoryId,
    functionName,
    args: [...args],
    externals: {
      ILog: {
        artifact: log,
        categoryId: world.logProxyCategoryId,
        proxyArtifact: buildProxyArtifact(log),
        implementationCategoryId: world.logImplementationCategoryId,
      },
    },
    callerUtxo: world.callCoin,
    callerLockingBytecode: world.callerLock,
    funder: world.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
}

/** One view entry of the log, read from the live records its proxy holds. */
async function readLog(world: World, functionName: string, args: readonly bigint[]): Promise<unknown> {
  const answered = await readPerCallEntry({
    provider: world.network,
    artifact: log,
    categoryId: world.logProxyCategoryId,
    functionName,
    args: [...args],
    vm: compositionMachine(),
  });
  expect(answered.accepted, answered.objection).toBe(true);
  return answered.value;
}

describe('one entry reaching the same append entry twice on one held chunked key', () => {
  it('settles both appends on the held key, the node holding both elements', async () => {
    const world = await deployed();
    const first = 5n;
    const second = 6n;

    // The deployment seeded key 1 with one element, so both reaches update the node in place rather than insert.
    expect(await readLog(world, 'count', [])).toBe(1n);
    expect(await readLog(world, 'at', [0n])).toBe(SEED);

    const result = await callRoot(world, 'run', [first, second]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The composed transaction leaves the key's node holding both appended elements, read back through the log's
    // own view entries over the live records.
    expect(await readLog(world, 'count', [])).toBe(3n);
    expect(await readLog(world, 'at', [1n])).toBe(first);
    expect(await readLog(world, 'at', [2n])).toBe(second);
  }, 120_000);
});
