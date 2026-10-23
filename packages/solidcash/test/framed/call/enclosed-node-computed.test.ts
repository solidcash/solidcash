import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin,
} from '@bitauth/libauth';
import { bytesEqual, bytesToHex, parsePushdataCommitment, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, encodeEntryCommitment } from '../../../src/stateful/SortedList.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import { readComputedDeclaration } from '../../../src/framed/deploy/declaration.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping node whose value a frame computes before the call that leads to a frame of its contract reading it back.
 *
 * `Counter.bump` raises `counts[k]` from its own value and then calls `Reader.look`, which reads the count back through
 * the counter's getter: a re-entered read of a node the outer frame wrote. The count is an integer the node keeps
 * inline and the artifact publishes no value for it, so no plan states it before the writer settles and no chunk pin
 * exposes it. The hop derives the writer up to the call that leads to the reader, reads the node the writer's own
 * close rebuilt, and plans again from it, so the reader starts from the count the writer computed. `bumpLate` makes a
 * call before the write, `bumpRaise` has the frame inside rewrite the count again, `mark` sets a guard computed from
 * the count in a node it creates before the frame inside reads it, and `Root.siblings` raises the count in two sibling
 * reaches before a third reads it. The counter sits behind its own proxy, whose initialize seeds the count, and the
 * count the writer's close binds is the only one the transaction can declare.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`enclosed node computed ${label}`)));
}

const COUNTER_IMPL_CATEGORY = idOf('counter implementation');
const COUNTER_PROXY_CATEGORY = idOf('counter proxy');
const READER_CATEGORY = idOf('reader');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');

const addressOf = (categoryId: string): string =>
  binToHex(validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM));
const READER = `0x${addressOf(READER_CATEGORY)}`;
const COUNTER = `0x${addressOf(COUNTER_PROXY_CATEGORY)}`;

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface IReader {',
  '  function look(address counter, int k) returns (int); function raise(address counter, int k) returns (int);',
  '  function ping() returns (int); function marked(address counter, int k) returns (bool);',
  '}',
  'interface ICounter {',
  '  function count(int k) returns (int); function add(int k); function lift(int k) returns (int);',
  '  function bump(int k) returns (int); function bumpLate(int k) returns (int); function bumpRaise(int k) returns (int);',
  '  function mark(int k) returns (bool); function marked(int k) returns (bool);',
  '}',
  'contract Counter {',
  '  address public implementation;',
  '  mapping(int => int) counts;',
  '  mapping(int => bool) marks;',
  '  function initialize() { this.counts[1] = 4; require(true); }',
  '  function bump(int k) returns (int) {',
  '    int before = this.counts[k];',
  '    this.counts[k] = before + 1;',
  `    int seen = IReader(${READER}).look(${COUNTER}, k);`,
  '    require(seen == before + 1, "stale count");',
  '    return seen;',
  '  }',
  '  function bumpLate(int k) returns (int) {',
  `    int step = IReader(${READER}).ping();`,
  '    this.counts[k] = this.counts[k] + step;',
  `    int seen = IReader(${READER}).look(${COUNTER}, k);`,
  '    require(seen == 6, "stale count");',
  '    return seen;',
  '  }',
  '  function bumpRaise(int k) returns (int) {',
  '    this.counts[k] = this.counts[k] + 1;',
  `    int raised = IReader(${READER}).raise(${COUNTER}, k);`,
  '    require(raised == 15, "stale count");',
  '    return raised;',
  '  }',
  '  function lift(int k) returns (int) { this.counts[k] = this.counts[k] + 10; return this.counts[k]; }',
  '  function add(int k) { this.counts[k] = this.counts[k] + 3; }',
  '  function count(int k) returns (int) { return this.counts[k]; }',
  '  function mark(int k) returns (bool) {',
  '    this.marks[k] = this.counts[k] > 3;',
  `    bool seen = IReader(${READER}).marked(${COUNTER}, k);`,
  '    require(seen, "stale mark");',
  '    return seen;',
  '  }',
  '  function marked(int k) returns (bool) { return this.marks[k]; }',
  '}',
  'contract Reader {',
  '  int public step;',
  '  constructor() { this.step = 2; }',
  '  function look(address counter, int k) returns (int) { return ICounter(counter).count(k); }',
  '  function raise(address counter, int k) returns (int) { return ICounter(counter).lift(k); }',
  '  function ping() returns (int) { return this.step; }',
  '  function marked(address counter, int k) returns (bool) { return ICounter(counter).marked(k); }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public counter;',
  '  int public last;',
  '  bool public flagged;',
  '  function initialize(address c) { this.counter = c; require(true); }',
  '  function run() { this.last = ICounter(this.counter).bump(1); }',
  '  function runLate() { this.last = ICounter(this.counter).bumpLate(1); }',
  '  function runRaise() { this.last = ICounter(this.counter).bumpRaise(1); }',
  '  function runMark() { this.flagged = ICounter(this.counter).mark(1); }',
  '  function siblings() {',
  '    ICounter(this.counter).add(1);',
  '    ICounter(this.counter).add(1);',
  '    this.last = ICounter(this.counter).count(1);',
  '  }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const counter = artifacts.Counter!;
const reader = artifacts.Reader!;
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
  readonly counterImplementationCategoryId: string;
  readonly callerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoins: readonly { txid: string; vout: number; satoshis: bigint }[];
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly snapshot: SnapshotRestorer;
}

/** Deploys the reader plain, then the counter and the root behind their proxies; the counter's initialize seeds 4. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const readerCoin = funding(READER_CATEGORY);
  await network.addUtxo(wallet.address, readerCoin);
  await deployStatefulContract(reader, [], {
    fundingUtxo: readerCoin, funder, changeAddress: wallet.address, provider: network, threadCount: 4,
  });
  for (const categoryId of [COUNTER_IMPL_CATEGORY, COUNTER_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const counterInitCoin = funding(idOf('counter initialize coin'));
  const rootInitCoin = funding(idOf('root initialize coin'));
  const callCoins = [funding(idOf('first call coin')), funding(idOf('second call coin'))];
  for (const coin of [counterInitCoin, rootInitCoin, ...callCoins]) await network.addUtxo(binToHex(callerLock), coin);
  await fundShippedFacets(network);
  const counterDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: counter,
    proxyArtifact: buildProxyArtifact(counter),
    implementationDeploy: { fundingUtxo: funding(COUNTER_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(COUNTER_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: callerLock,
    callerFunding: { utxo: counterInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(counterDeployment.initialize.broadcast).toBeDefined();
  expect(binToHex(counterDeployment.proxy.address)).toBe(addressOf(COUNTER_PROXY_CATEGORY));
  const rootDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [counterDeployment.proxy.address] },
    callerLockingBytecode: callerLock,
    callerFunding: { utxo: rootInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();
  return {
    network,
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    counterImplementationCategoryId: counterDeployment.implementation.categoryId,
    callerLock,
    changeAddress: wallet.address,
    callCoins,
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

/** One call of the root's entry through its proxy, the counter reached behind its own, paid from coin `coin`. */
function callRoot(world: World, functionName: string, coin = 0): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: world.network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: world.rootProxyCategoryId,
    implementationCategoryId: world.rootImplementationCategoryId,
    functionName,
    args: [],
    externals: {
      ICounter: {
        artifact: counter,
        categoryId: COUNTER_PROXY_CATEGORY,
        proxyArtifact: buildProxyArtifact(counter),
        implementationCategoryId: world.counterImplementationCategoryId,
      },
      IReader: { artifact: reader, categoryId: READER_CATEGORY },
    },
    callerUtxo: world.callCoins[coin]!,
    callerLockingBytecode: world.callerLock,
    funder: world.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
}

/** The value the root left in its field `name`, read from the record the hop wrote. */
function fieldOf(result: FramedProxyCallResult, name: string): unknown {
  const layout = buildProxyArtifact(root).stateLayout!;
  const field = layout.variables.find((variable) => variable.name === name)!;
  return parsePushdataCommitment(binToHex(result.writtenCommitments[field.nftIndex]!), layout, field.nftIndex)[name];
}

/** The value the root left in its `last` field. */
function lastOf(result: FramedProxyCallResult): unknown {
  return fieldOf(result, 'last');
}

/** The hop settled every frame and broadcast. */
function expectBroadcast(result: FramedProxyCallResult): void {
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

/** The count node the hop spends and the one it leaves, read off the transaction's own input and output. */
function countNode(result: FramedProxyCallResult): { readonly before: Uint8Array; readonly after: Uint8Array } {
  const index = result.sourceOutputs.findIndex((output) => {
    const commitment = output.token?.nft?.commitment;
    return commitment !== undefined && commitment.length > 64
      && bytesEqual(decodeEntryCommitment(commitment).value, bigIntToVmNumber(4n));
  });
  expect(index).toBeGreaterThanOrEqual(0);
  return {
    before: result.sourceOutputs[index]!.token!.nft!.commitment,
    after: result.transaction.outputs[index]!.token!.nft!.commitment,
  };
}

describe('a node a frame computes before the call that leads to a frame of its contract reading it', () => {
  it('learns the count the writer\'s close rebuilt, so the frame inside reads it, and broadcasts', async () => {
    const world = await deployed();
    const first = await callRoot(world, 'run');
    expectBroadcast(first);
    expect(lastOf(first)).toBe(5n);
    // The node carries the count onward: the next hop reads it from the chain and raises it again.
    const second = await callRoot(world, 'run', 1);
    expectBroadcast(second);
    expect(lastOf(second)).toBe(6n);
  }, 300_000);

  it('learns it when the write lands after an earlier call of the enclosing frame', async () => {
    const result = await callRoot(await deployed(), 'runLate');
    expectBroadcast(result);
    expect(lastOf(result)).toBe(6n);
  }, 300_000);

  it('chains a rewrite inside the writer from the count it learned', async () => {
    const result = await callRoot(await deployed(), 'runRaise');
    expectBroadcast(result);
    expect(lastOf(result)).toBe(15n);
  }, 300_000);

  it('continues a count two sibling reaches computed, and a third reads it', async () => {
    const result = await callRoot(await deployed(), 'siblings');
    expectBroadcast(result);
    expect(lastOf(result)).toBe(10n);
  }, 300_000);

  it('learns a guard the writer computes into a node it creates, so the frame inside reads it set', async () => {
    const result = await callRoot(await deployed(), 'runMark');
    expectBroadcast(result);
    expect(fieldOf(result, 'flagged')).toBe(true);
  }, 300_000);

  it('refuses a forged count: the writer\'s own close compares the node it rebuilt against the declaration', async () => {
    const result = await callRoot(await deployed(), 'run');
    expectBroadcast(result);
    const { before, after } = countNode(result);
    const { slot, nextKey } = decodeEntryCommitment(after);
    expect(bytesEqual(decodeEntryCommitment(after).value, bigIntToVmNumber(5n))).toBe(true);
    const forged = encodeEntryCommitment(slot, nextKey, bigIntToVmNumber(6n));
    // The writer is the frame that declares the node from the deployment's view to the one it left.
    const draft = result.draft;
    const writer = draft.runs.map((run) => run.master).find((master) => draft.blockOf(master).segments
      .some((segment) => segment.some((entry) => bytesEqual(entry.viewIn, before) && bytesEqual(entry.viewOut, after))));
    expect(writer).toBeDefined();
    // Every declaration of the node, the writer's and the reader's alike, is forged to the same other count.
    for (const run of draft.runs) {
      for (const segment of draft.blockOf(run.master).segments) {
        for (const entry of segment) {
          if (bytesEqual(entry.viewIn, after)) entry.viewIn = forged;
          if (bytesEqual(entry.viewOut, after)) entry.viewOut = forged;
        }
      }
    }
    const vm = compositionMachine();
    const program = draft.programFor(writer!);
    expect(vm.stateSuccess(vm.evaluate(program))).not.toBe(true);
    const reading = readComputedDeclaration({ vm, program, maximumCommitmentBytes: 128 });
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    expect(bytesToHex(reading.declared)).toBe(bytesToHex(forged));
    expect(bytesToHex(reading.computed)).toBe(bytesToHex(after));
  }, 300_000);
});
