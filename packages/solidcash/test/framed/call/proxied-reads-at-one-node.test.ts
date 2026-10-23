import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesEqual, bytesToHex, sha256, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../../src/network/NetworkProvider.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import {
  FramedProxyDeployError, buildProxyArtifact, callFramedProxyEntry, deployFramedProxy,
  type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { sharedNodeId } from '../../../src/framed/proxy/entry-writes.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti,
} from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied root entry that reads two keys of one mapping whose proofs land on one node.
 *
 * The frame reads each key the entry only reads from the record its segment declares at that key's own position,
 * and the record names the input its node sits at: a held key is proved by its node's slot, an absent one by the
 * node below it, whose successor brackets the key. Two absent keys between the same two nodes, or a held key and an
 * absent key just above it, are proved by one node, which one transaction spends once: the hop places the node once
 * and declares it at both positions. Read-only and beside a batch, the call settles with the value the reads return
 * and the count the batch writes, read back from the chain; a pair proved by two nodes settles as before, and so
 * does a callee whose entry reads a pair at one node, which the hop already named by its node. A shared node the hop
 * is made to declare wrongly is refused: by the frame when the node does not bracket a key it proves, and by the
 * validator when the node's declared view is not the one the transaction spends.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`proxied reads at one node ${label}`)));
}

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface IMarks { function check(uint a, uint b, uint expected); }',
  'contract Marks {',
  '  address public implementation;',
  '  mapping(uint => uint) marks;',
  '  mapping(uint => uint) counts;',
  '  function put(uint k, uint v) { this.marks[k] = v; }',
  '  function look(uint a, uint b) view returns (uint) { return this.marks[a] * 1000 + this.marks[b]; }',
  '  function tally(uint a, uint b, uint id) {',
  '    this.counts[id] = this.counts[id] + this.marks[a] * 1000 + this.marks[b] + 1;',
  '  }',
  '  function check(uint a, uint b, uint expected) {',
  '    require(this.marks[a] * 1000 + this.marks[b] == expected, "marks differ");',
  '  }',
  '}',
  'contract Asker {',
  '  address public implementation;',
  '  address public marks;',
  '  function initialize(address target) { this.marks = target; require(true); }',
  '  function ask(uint a, uint b, uint expected) { IMarks(this.marks).check(a, b, expected); require(true); }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const artifact = artifacts.Marks!;
const proxy = buildProxyArtifact(artifact);
const asker = artifacts.Asker!;
const askerProxy = buildProxyArtifact(asker);

/** The 1-based line of the first source line containing `needle`. */
function lineOf(needle: string): number {
  return SOURCE.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

const USER = encodeLockingBytecodeP2pkh(alicePkh);

const slotOf = (key: bigint): Uint8Array => keyToSlotMulti([bigIntToVmNumber(key)]);
const slotHex = (key: bigint): string => bytesToHex(slotOf(key));
const number = (value: bigint): string => bytesToHex(bigIntToVmNumber(value));

/** Small keys in the order their slots sort, which is the order the list holds them in. */
const BY_SLOT = Array.from({ length: 64 }, (_unused, at) => BigInt(at + 1))
  .sort((left, right) => (bytesToSlotValue(slotOf(left)) < bytesToSlotValue(slotOf(right)) ? -1 : 1));
/** The two held keys, and absent keys below the first, between the two and above the second. */
const LOWER = BY_SLOT[4]!;
const LOW = BY_SLOT[8]!;
const FIRST = BY_SLOT[16]!;
const MID = BY_SLOT[24]!;
const MID2 = BY_SLOT[32]!;
const SECOND = BY_SLOT[48]!;
const HIGH = BY_SLOT[56]!;

/** The marks list once both puts have settled, the head aside: it holds no value. */
const MARKS = new Map([[slotHex(FIRST), number(7n)], [slotHex(SECOND), number(9n)]]);

/** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The marks deployment behind its generated proxy, as a call is entered on it. */
interface Marked {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
}

/** Both deployments, and the chain as it stood once both puts and the asker's initialize were broadcast. */
interface World extends Marked {
  readonly askerProxyCategoryId: string;
  readonly askerImplementationCategoryId: string;
  readonly snapshot: SnapshotRestorer;
}

let entered = 0;

/**
 * One call through a proxy, from a fresh coin of the caller's, planned over `provider`: an entry of the marks
 * deployment, or the asker's `ask`, whose callee is the marks proxy.
 */
async function enter(
  world: Marked | World, functionName: string, args: readonly FunctionArgument[],
  provider: NetworkProvider = world.network,
): Promise<{ readonly coin: Utxo; readonly call: Promise<FramedProxyCallResult> }> {
  entered += 1;
  const coin = funding(idOf(`${functionName} coin ${entered}`));
  await world.network.addUtxo(binToHex(USER), coin);
  const common = {
    provider,
    functionName,
    args: [...args],
    callerUtxo: coin,
    callerLockingBytecode: USER,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  };
  const call = 'askerProxyCategoryId' in world && functionName === 'ask'
    ? callFramedProxyEntry({
      ...common,
      implementationArtifact: asker,
      proxyArtifact: askerProxy,
      proxyCategoryId: world.askerProxyCategoryId,
      implementationCategoryId: world.askerImplementationCategoryId,
      externals: {
        IMarks: {
          artifact, proxyArtifact: proxy, categoryId: world.proxyCategoryId,
          implementationCategoryId: world.implementationCategoryId,
        },
      },
    })
    : callFramedProxyEntry({
      ...common,
      implementationArtifact: artifact,
      proxyArtifact: proxy,
      proxyCategoryId: world.proxyCategoryId,
      implementationCategoryId: world.implementationCategoryId,
    });
  return { coin, call };
}

/** Enters one call and requires it to settle: every participant accepted and the transaction broadcast. */
async function settle(
  world: Marked | World, functionName: string, args: readonly FunctionArgument[],
): Promise<FramedProxyCallResult> {
  const result = await (await enter(world, functionName, args)).call;
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  await fundShippedFacets(network);
  const deploy = async (
    target: Artifact, initialize: { readonly functionName: string; readonly args: readonly FunctionArgument[] },
  ): Promise<Awaited<ReturnType<typeof deployFramedProxy>>> => {
    const implementationFunding = funding(idOf(`${target.contractName} implementation`));
    const proxyFunding = funding(idOf(`${target.contractName} proxy`));
    const initializeCoin = funding(idOf(`${target.contractName} initialize coin`));
    for (const coin of [implementationFunding, proxyFunding]) await network.addUtxo(wallet.address, coin);
    await network.addUtxo(binToHex(USER), initializeCoin);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: target,
      proxyArtifact: buildProxyArtifact(target),
      implementationDeploy: { fundingUtxo: implementationFunding, funder, changeAddress: wallet.address },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: wallet.address },
      initialize,
      callerLockingBytecode: USER,
      callerFunding: { utxo: initializeCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    return deployment;
  };
  const marks = await deploy(artifact, { functionName: 'put', args: [FIRST, 7n] });
  const marked: Marked = {
    network,
    changeAddress: wallet.address,
    proxyCategoryId: marks.proxy.categoryId,
    implementationCategoryId: marks.implementation.categoryId,
  };
  await settle(marked, 'put', [SECOND, 9n]);
  const asking = await deploy(asker, { functionName: 'initialize', args: [marks.proxy.address] });
  return {
    ...marked,
    askerProxyCategoryId: asking.proxy.categoryId,
    askerImplementationCategoryId: asking.implementation.categoryId,
    snapshot: await network.takeSnapshot(),
  };
}

let worldRun: Promise<World> | undefined;

/** One pair of deployments serves every case, each rewinding the chain to them first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** The mapping node a UTXO's commitment carries, read whether or not the UTXO is one. */
function nodeOf(utxo: Utxo): ReturnType<typeof decodeEntryCommitment> {
  return decodeEntryCommitment(hexToBin(utxo.token?.nft?.commitment ?? ''));
}

/** Every live node of one of the marks deployment's collections, the head included. */
async function nodes(world: World, collection: string): Promise<readonly Utxo[]> {
  const layout = { ...proxy.stateLayout!, collections: artifact.stateLayout!.collections };
  const deployment = await readFramedDeployment(world.network, world.proxyCategoryId, layout);
  return deployment.nodesByCollection.get(collection) ?? [];
}

/** The value each live node of one collection holds, by slot, the head left out: it holds no value. */
async function held(world: World, collection: string): Promise<ReadonlyMap<string, string>> {
  const values = new Map<string, string>();
  for (const node of (await nodes(world, collection)).map(nodeOf)) {
    if (!node.slot.every((byte) => byte === 0)) values.set(bytesToHex(node.slot), bytesToHex(node.value));
  }
  return values;
}

/** The live node of `marks` at `key`'s slot. */
async function markNode(world: World, key: bigint): Promise<Utxo> {
  return (await nodes(world, 'marks')).find((utxo) => bytesEqual(nodeOf(utxo).slot, slotOf(key)))!;
}

/** The input each record the implementation frame's first segment declares at `node`'s view names. */
function declaredInputs(result: FramedProxyCallResult, node: Utxo): readonly number[] {
  return result.draft.blockOf('implementation-master').segments[0]!
    .filter((record) => bytesToHex(record.viewIn) === node.token!.nft!.commitment)
    .map((record) => record.in);
}

/** The ids a hop places its participants under that start with `prefix`. */
function placed(result: FramedProxyCallResult, prefix: string): readonly string[] {
  return result.draft.layout.participants.map((participant) => participant.id).filter((id) => id.startsWith(prefix));
}

/** Every outpoint the marks deployment's category holds. */
async function outpoints(world: World): Promise<readonly string[]> {
  return (await world.network.getUtxosByTokenCategory(world.proxyCategoryId))
    .map((utxo) => `${utxo.txid}:${utxo.vout}`).sort();
}

/** A provider whose category listing passes each UTXO through `relist`, which drops one or reports it otherwise. */
function relisting(network: MockNetworkProvider, relist: (utxo: Utxo) => Utxo | undefined): NetworkProvider {
  return new Proxy(network, {
    get(target, key): unknown {
      if (key === 'getUtxosByTokenCategory') {
        return async (category: string): Promise<Utxo[]> => (await target.getUtxosByTokenCategory(category))
          .flatMap((utxo) => relist(utxo) ?? []);
      }
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** A listing that leaves out the node of `key`. */
function hiding(network: MockNetworkProvider, key: bigint): NetworkProvider {
  return relisting(network, (utxo) => (bytesEqual(nodeOf(utxo).slot, slotOf(key)) ? undefined : utxo));
}

/** A listing that reports the node of `holder` as a node of `claimed` holding `value`, at the same outpoint. */
function claiming(network: MockNetworkProvider, holder: bigint, claimed: bigint, value: bigint): NetworkProvider {
  return relisting(network, (utxo) => {
    const node = nodeOf(utxo);
    if (!bytesEqual(node.slot, slotOf(holder))) return utxo;
    const commitment = encodeEntryCommitment(slotOf(claimed), node.nextKey, bigIntToVmNumber(value));
    return { ...utxo, token: { ...utxo.token!, nft: { ...utxo.token!.nft!, commitment: binToHex(commitment) } } };
  });
}

/** Enters a call that must be refused with `reason`, and checks the caller's coin and the deployment are untouched. */
async function expectRefused(
  world: World, functionName: string, args: readonly FunctionArgument[], reason: string,
  provider: NetworkProvider = world.network,
): Promise<unknown> {
  const before = await outpoints(world);
  const entry = await enter(world, functionName, args, provider);
  const error = await entry.call.then(() => undefined, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(reason);
  expect((await world.network.getUtxosForLockingBytecode(USER))
    .some((utxo) => utxo.txid === entry.coin.txid && utxo.vout === entry.coin.vout)).toBe(true);
  expect(await outpoints(world)).toStrictEqual(before);
  return error;
}

/** The hop's words for a frame of `entry` that refused at `line` with `message`. */
function unsettled(entry: string, line: number, message: string): string {
  return `the implementation's "${entry}" entry did not settle through the proxy: frame "implementation-master" of `
    + `Marks.${entry}() at line ${line}: ${message} (Program failed an OP_VERIFY operation.)`;
}

describe('a proxied entry that reads two keys of one mapping at one node', () => {
  it('reads two absent keys one node brackets, read-only and beside a batch', async () => {
    const world = await deployed();
    expect(await held(world, 'marks')).toStrictEqual(MARKS);

    // MID and MID2 lie between the two held keys, so the first one's node brackets both: one input, declared at
    // both keys' positions.
    const first = await markNode(world, FIRST);
    const between = await settle(world, 'look', [MID, MID2]);
    expect(between.value).toBe(0n);
    expect(placed(between, 'mapping-')).toStrictEqual([`mapping-read-marks-${slotHex(FIRST)}`]);
    const inputs = declaredInputs(between, first);
    expect(inputs).toHaveLength(2);
    expect(inputs[1]).toBe(inputs[0]);

    // LOWER and LOW lie below the first held key, so the head brackets both.
    const below = await settle(world, 'look', [LOWER, LOW]);
    expect(below.value).toBe(0n);
    expect(placed(below, 'mapping-')).toHaveLength(1);

    // Beside an insert into another mapping, then beside an update of it.
    const inserted = await settle(world, 'tally', [MID2, MID, 3n]);
    expect(placed(inserted, 'mapping-read-')).toStrictEqual([`mapping-read-marks-${slotHex(FIRST)}`]);
    expect(await held(world, 'counts')).toStrictEqual(new Map([[slotHex(3n), number(1n)]]));
    await settle(world, 'tally', [LOW, LOWER, 3n]);
    expect(await held(world, 'counts')).toStrictEqual(new Map([[slotHex(3n), number(2n)]]));
    expect(await held(world, 'marks')).toStrictEqual(MARKS);
  }, 600_000);

  it('reads a held key and an absent key its node brackets, in either order, read-only and beside a batch', async () => {
    const world = await deployed();

    const first = await markNode(world, FIRST);
    const read = await settle(world, 'look', [FIRST, MID]);
    expect(read.value).toBe(7000n);
    expect(placed(read, 'mapping-')).toStrictEqual([`mapping-read-marks-${slotHex(FIRST)}`]);
    const inputs = declaredInputs(read, first);
    expect(inputs).toHaveLength(2);
    expect(inputs[1]).toBe(inputs[0]);
    expect((await settle(world, 'look', [MID, FIRST])).value).toBe(7n);
    // The second held key's node is the last, so it brackets every key above it.
    expect((await settle(world, 'look', [HIGH, SECOND])).value).toBe(9n);

    const inserted = await settle(world, 'tally', [FIRST, MID2, 4n]);
    expect(placed(inserted, 'mapping-read-')).toStrictEqual([`mapping-read-marks-${slotHex(FIRST)}`]);
    expect(await held(world, 'counts')).toStrictEqual(new Map([[slotHex(4n), number(7001n)]]));
    await settle(world, 'tally', [HIGH, SECOND, 4n]);
    expect(await held(world, 'counts')).toStrictEqual(new Map([[slotHex(4n), number(7011n)]]));
    expect(await held(world, 'marks')).toStrictEqual(MARKS);
  }, 600_000);

  it('reads a pair whose proofs land on two nodes', async () => {
    const world = await deployed();

    // The head and the first held key's node, then the two held keys' nodes, as absent keys and as held ones.
    const split = await settle(world, 'look', [LOW, MID]);
    expect(split.value).toBe(0n);
    expect(placed(split, 'mapping-')).toHaveLength(2);
    expect((await settle(world, 'look', [MID, HIGH])).value).toBe(0n);
    expect((await settle(world, 'look', [FIRST, SECOND])).value).toBe(7009n);

    await settle(world, 'tally', [SECOND, LOW, 5n]);
    expect(await held(world, 'counts')).toStrictEqual(new Map([[slotHex(5n), number(9001n)]]));
    expect(await held(world, 'marks')).toStrictEqual(MARKS);
  }, 600_000);

  it('serves a callee that reads two keys at one node the same way', async () => {
    const world = await deployed();

    // The asker's callee is the marks implementation's frame, whose reads the hop names by node as it always has.
    for (const [a, b, expected] of [[MID, MID2, 0n], [FIRST, MID, 7000n], [MID, FIRST, 7n]] as const) {
      const result = await settle(world, 'ask', [a, b, expected]);
      expect(placed(result, 'mapping-')).toStrictEqual([sharedNodeId(world.proxyCategoryId, 'marks', slotOf(FIRST))]);
    }
    // A value the two reads do not make is refused by the callee's own check.
    await expectRefused(world, 'ask', [MID, FIRST, 7000n],
      'the call\'s callee "Marks.check()" did not settle through the proxy: frame "callee-impl-master-2" of '
      + `Marks.check() at line ${lineOf('"marks differ"')}: marks differ (Program failed an OP_VERIFY operation.)`);
    expect(await held(world, 'marks')).toStrictEqual(MARKS);
  }, 600_000);

  it('is refused by the frame when the node both keys are declared at does not bracket them', async () => {
    const world = await deployed();
    const refused = unsettled('look', lineOf('function look'), 'no source message');

    // Without the first held key's node, the hop proves both keys by the head, whose successor is that key: the key
    // itself is held, and a key above it is not the head's to bracket.
    for (const pair of [[FIRST, MID], [MID, MID2]]) {
      expect(await expectRefused(world, 'look', pair, refused, hiding(world.network, FIRST)))
        .toBeInstanceOf(FramedProxyDeployError);
    }
  }, 600_000);

  it('is refused by the validator when the node both keys are declared at is not the one spent', async () => {
    const world = await deployed();

    // The listing reports the first held key's node as MID's, holding 99, so the hop declares MID held there and MID2
    // absent beside it, and the frame's own run accepts what it declares. The transaction spends the node as it is,
    // and the validator, input 1, holds the declared view to the node spent.
    await expectRefused(world, 'look', [MID, MID2],
      'mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 1: '
      + 'Program failed an OP_VERIFY operation.)', claiming(world.network, FIRST, MID, 99n));
  }, 600_000);
});
