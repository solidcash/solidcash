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
 * A mapping node a frame writes before the call that leads to a frame of its contract reading it back.
 *
 * `Judge.enter` rewrites `notes[1]` and then calls `Claimer.claim`, which reads the note back through the judge's
 * own getter: a re-entered read of a node an outer frame wrote. The reading frame runs inside the writer and reads
 * the view the writer's segment left: the hop chains the two declarations rather than refusing the pair, and the
 * judge's own check that the claimer saw its note holds. `enterLate` makes a call before its write, so the write
 * lands in a later segment of the frame that encloses the read. The notes' collection chunks, so each write's value
 * is the plan's own, stated before the writer settles, and the notes stay inline; the judge sits behind its own
 * proxy, whose initialize seeds the note. A value the writer's body computes is stated by no plan before the read is
 * judged, and a note the node keeps inline passes no chunk pin: the hop derives the writer up to the call that leads
 * to the read, reads the note out of the node the writer's own close rebuilt, and plans again from it.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`enclosed node read ${label}`)));
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

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface IClaimer { function claim(address judge) returns (int); function ping() returns (int); }',
  'interface IJudge {',
  '  function count() returns (int); function enter() returns (int); function enterLate() returns (int);',
  '  function enterOpaque() returns (int);',
  '}',
  'contract Judge {',
  '  address public implementation;',
  '  mapping(int => bytes) notes;',
  '  function initialize() { this.notes[1] = hex"aa"; require(true); }',
  '  function enter() returns (int) {',
  '    this.notes[1] = hex"0102";',
  `    int seen = IClaimer(${CLAIMER}).claim(${JUDGE});`,
  '    require(seen == 2, "stale note");',
  '    return seen;',
  '  }',
  '  function enterLate() returns (int) {',
  `    int step = IClaimer(${CLAIMER}).ping();`,
  '    this.notes[1] = hex"0304";',
  `    int seen = IClaimer(${CLAIMER}).claim(${JUDGE});`,
  '    require(seen == 2, "stale note");',
  '    return seen + step;',
  '  }',
  '  function enterOpaque() returns (int) {',
  `    int step = IClaimer(${CLAIMER}).ping();`,
  '    this.notes[1] = abi.encodePacked(step);',
  `    int seen = IClaimer(${CLAIMER}).claim(${JUDGE});`,
  '    require(seen > 0, "stale note");',
  '    return seen;',
  '  }',
  '  function count() returns (int) { return this.notes[1].length; }',
  '}',
  'contract Claimer {',
  '  int public step;',
  '  constructor() { this.step = 2; }',
  '  function claim(address judge) returns (int) { return IJudge(judge).count(); }',
  '  function ping() returns (int) { return this.step; }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public judge;',
  '  int public last;',
  '  function initialize(address j) { this.judge = j; require(true); }',
  '  function run() { this.last = IJudge(this.judge).enter(); }',
  '  function runLate() { this.last = IJudge(this.judge).enterLate(); }',
  '  function runOpaque() { this.last = IJudge(this.judge).enterOpaque(); }',
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

/** Deploys the claimer plain, then the judge and the root behind their proxies; the judge's initialize seeds a note. */
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
    initialize: { functionName: 'initialize', args: [] },
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

describe('a node a frame writes before the call that leads to a frame of its contract reading it', () => {
  it('chains the read to the view the enclosing write left, and broadcasts', async () => {
    const result = await callRoot(await deployed(), 'run');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(lastOf(result)).toBe(2n);
  }, 300_000);

  it('chains it when the write lands after an earlier call of the enclosing frame', async () => {
    const result = await callRoot(await deployed(), 'runLate');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(lastOf(result)).toBe(4n);
  }, 300_000);

  it('learns the note the enclosing frame computes from its close of the node, and plans again from it', async () => {
    // The note is packed from what the claimer's `ping` returned, so the plan states no value for it: the read is
    // judged against the note the writer's own close rebuilt, not the plan's placeholder. The packed note is 33
    // bytes, which neither the seeded note nor the placeholder is, and still within the node's inline limit.
    const result = await callRoot(await deployed(), 'runOpaque');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(lastOf(result)).toBe(33n);
  }, 300_000);
});
