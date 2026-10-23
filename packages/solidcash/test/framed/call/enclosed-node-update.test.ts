import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, parsePushdataCommitment, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping node a frame updates from its own value before the call that leads to a frame of its contract reading
 * it back.
 *
 * `Judge.enter` raises `rows[id].count` from its own value and then calls `Claimer.claim`, which reads the count back
 * through the judge's own getter. The update is lowered through a cache the body reads once and writes back once; the
 * write-back lands in the segment the source makes the update in, not past the call after it, so the reading frame
 * runs inside the writer and reads the view the update left, and the judge's own check that the claimer saw the
 * raised count holds. `enterLate` makes a call before the update, so the update lands between the writer's two
 * calls. The row is a struct the plan states from the node's own fields, so the read is judged against the value
 * before the writer settles; the judge sits behind its own proxy, whose initialize seeds the row.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`enclosed node update ${label}`)));
}

const JUDGE_IMPL_CATEGORY = idOf('judge implementation');
const JUDGE_PROXY_CATEGORY = idOf('judge proxy');
const CLAIMER_CATEGORY = idOf('claimer');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');

const addressOf = (categoryId: string): string =>
  binToHex(validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM));
const CLAIMER = `0x${addressOf(CLAIMER_CATEGORY)}`;
const JUDGE = `0x${addressOf(JUDGE_PROXY_CATEGORY)}`;

// The judge reaches the claimer through an interface-typed local, which leaves its body graph-free, so the message-bus
// lowering does not rewrite the field update in place first and the update reaches the entry cache.
const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface IClaimer { function claim(address judge, int id) returns (int); function ping() returns (int); }',
  'interface IJudge {',
  '  function count(int id) returns (int); function enter(int id) returns (int);',
  '  function enterLate(int id) returns (int);',
  '}',
  'contract Judge {',
  '  struct Row { int count; int tag; }',
  '  address public implementation;',
  '  mapping(int => Row) rows;',
  '  function initialize(int id) { this.rows[id] = Row(1, 7); require(true); }',
  '  function enter(int id) returns (int) {',
  '    this.rows[id].count = this.rows[id].count + 1;',
  `    IClaimer claimer = IClaimer(${CLAIMER});`,
  `    int seen = claimer.claim(${JUDGE}, id);`,
  '    require(seen == 2, "stale row");',
  '    return seen;',
  '  }',
  '  function enterLate(int id) returns (int) {',
  `    IClaimer claimer = IClaimer(${CLAIMER});`,
  '    int step = claimer.ping();',
  '    this.rows[id].count = this.rows[id].count + 2;',
  `    int seen = claimer.claim(${JUDGE}, id);`,
  '    require(seen == 3, "stale row");',
  '    return seen + step;',
  '  }',
  '  function count(int id) returns (int) { return this.rows[id].count; }',
  '}',
  'contract Claimer {',
  '  int public step;',
  '  constructor() { this.step = 2; }',
  '  function claim(address judge, int id) returns (int) { return IJudge(judge).count(id); }',
  '  function ping() returns (int) { return this.step; }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public judge;',
  '  int public last;',
  '  function initialize(address j) { this.judge = j; require(true); }',
  '  function run() { this.last = IJudge(this.judge).enter(1); }',
  '  function runLate() { this.last = IJudge(this.judge).enterLate(1); }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const judge = artifacts.Judge!;
const claimer = artifacts.Claimer!;
const root = artifacts.Root!;

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployment the cases share, and the chain as it stood when it was done. */
interface World {
  readonly network: MockNetworkProvider;
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly judgeImplementationCategoryId: string;
  readonly callerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly snapshot: SnapshotRestorer;
}

/** Deploys the claimer plain, then the judge and the root behind their proxies; the judge's initialize seeds a row. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const claimerCoin = funding(CLAIMER_CATEGORY);
  await network.addUtxo(wallet.address, claimerCoin);
  await deployStatefulContract(claimer, [], {
    fundingUtxo: claimerCoin, funder, changeAddress: wallet.address, provider: network, threadCount: 4,
  });
  for (const categoryId of [JUDGE_IMPL_CATEGORY, JUDGE_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const judgeInitCoin = funding(idOf('judge initialize coin'));
  const rootInitCoin = funding(idOf('root initialize coin'));
  const callCoin = funding(idOf('call coin'));
  for (const coin of [judgeInitCoin, rootInitCoin, callCoin]) await network.addUtxo(binToHex(callerLock), coin);
  await fundShippedFacets(network);
  const judgeDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: judge,
    proxyArtifact: buildProxyArtifact(judge),
    implementationDeploy: { fundingUtxo: funding(JUDGE_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(JUDGE_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [1n] },
    callerLockingBytecode: callerLock,
    callerFunding: { utxo: judgeInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(judgeDeployment.initialize.broadcast).toBeDefined();
  expect(binToHex(judgeDeployment.proxy.address)).toBe(addressOf(JUDGE_PROXY_CATEGORY));
  const rootDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [judgeDeployment.proxy.address] },
    callerLockingBytecode: callerLock,
    callerFunding: { utxo: rootInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();
  return {
    network,
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    judgeImplementationCategoryId: judgeDeployment.implementation.categoryId,
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

/** One call of the root's entry through its proxy, the judge reached behind its own. */
function callRoot(world: World, functionName: string): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: world.network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: world.rootProxyCategoryId,
    implementationCategoryId: world.rootImplementationCategoryId,
    functionName,
    args: [],
    externals: {
      IJudge: {
        artifact: judge,
        categoryId: JUDGE_PROXY_CATEGORY,
        proxyArtifact: buildProxyArtifact(judge),
        implementationCategoryId: world.judgeImplementationCategoryId,
      },
      IClaimer: { artifact: claimer, categoryId: CLAIMER_CATEGORY },
    },
    callerUtxo: world.callCoin,
    callerLockingBytecode: world.callerLock,
    funder: world.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
}

/** The value the root left in its `last` field, read from the record the hop wrote. */
function lastOf(result: FramedProxyCallResult): unknown {
  const layout = buildProxyArtifact(root).stateLayout!;
  const field = layout.variables.find((variable) => variable.name === 'last')!;
  return parsePushdataCommitment(binToHex(result.writtenCommitments[field.nftIndex]!), layout, field.nftIndex).last;
}

/** The segment the judge's entry publishes its write of the rows in. */
function rowWriteSegment(functionName: string): unknown {
  const entry = judge.composition?.stopSites?.entries
    .find((candidate) => candidate.functionName === `Judge.${functionName}()`);
  return entry?.writeSegments?.find((write) => write.collection === 'rows')?.segment;
}

describe('a node a frame updates from its own value before the call that leads to a frame reading it', () => {
  it('publishes the update in the segment the source makes it in', () => {
    // Before the entry's only call, and between its two: neither lands past the call that follows it.
    expect([rowWriteSegment('enter'), rowWriteSegment('enterLate')]).toStrictEqual([0, 1]);
  });

  it('chains the read to the view the update left, and broadcasts', async () => {
    const result = await callRoot(await deployed(), 'run');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(lastOf(result)).toBe(2n);
  }, 300_000);

  it('chains it when the update lands between two calls of the enclosing frame', async () => {
    const result = await callRoot(await deployed(), 'runLate');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The claimer saw the count the update raised to 3, and the judge adds the 2 its first call returned.
    expect(lastOf(result)).toBe(5n);
  }, 300_000);
});
