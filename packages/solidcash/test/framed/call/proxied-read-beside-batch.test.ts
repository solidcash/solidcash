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
} from '../../../src/framed/proxy/index.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti,
} from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied root entry that reads one mapping while it writes another, as an EVM body does
 * (`require(allowed[msg.sender]); counts[id] += 1;`).
 *
 * The entry's write is a sorted batch, and the key it only reads has no group in that batch: the frame reads it from
 * the node its own segment declares past its data records and ahead of the batch's groups, the key's own node when
 * the list holds it and otherwise the node below it, whose successor brackets the key. The hop plans that node from
 * the deployment and names its slot to the batch planner, so the read is declared rather than refused; a value too
 * long for the node's tail is witnessed from the chunks the deployment holds. The values the writes leave are read
 * back from the chain's nodes.
 *
 * A read of the written mapping settles at a node the batch does not spend and at one it does, which is the batch's
 * own input, and is refused by name under the very key the batch writes, which the frame reads as its segment began
 * whichever comes first in the source. A read the hop is made to declare against the wrong node, by a
 * provider whose listing leaves a node of the read mapping out or misreports one, is refused: by the frame when the
 * node does not bracket the key, and by the validator when the node's declared view is not the one the transaction
 * spends.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`proxied read beside batch ${label}`)));
}

/** Three contracts, so each stays under the input-script limit. */
const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'contract Tally {',
  '  address public implementation;',
  '  mapping(address => uint) bonus;',
  '  mapping(uint => uint) counts;',
  '  function initialize(address who, uint amount) { this.bonus[who] = amount; }',
  '  function bump(address who, uint id) { this.counts[id] = this.counts[id] + 1 + this.bonus[who]; }',
  '  function tick(uint id) {',
  '    require(this.bonus[msg.sender] > 0, "no bonus");',
  '    this.counts[id] = this.counts[id] + 1;',
  '  }',
  '}',
  'contract Board {',
  '  address public implementation;',
  '  mapping(address => string) names;',
  '  mapping(uint => uint) visits;',
  '  function initialize(address who, string name) { this.names[who] = name; }',
  '  function visit(address who, uint id) {',
  '    require(bytes(this.names[who]).length > 0, "unnamed");',
  '    this.visits[id] = this.visits[id] + 1;',
  '  }',
  '}',
  'contract Ledger {',
  '  address public implementation;',
  '  mapping(address => uint) bonus;',
  '  function initialize(address who, uint amount) { this.bonus[who] = amount; }',
  '  function shift(address from, address to) { this.bonus[to] = this.bonus[to] + this.bonus[from]; }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });

/** The 1-based line of the first source line containing `needle`. */
function lineOf(needle: string): number {
  return SOURCE.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

/** The caller, who holds a bonus of 5 and a name past the node's inline limit. */
const USER = encodeLockingBytecodeP2pkh(alicePkh);
const BONUS = 5n;
const NAME = 'n'.repeat(150);

const slotOf = (key: Uint8Array): string => bytesToHex(keyToSlotMulti([key]));
const idSlot = (id: bigint): string => slotOf(bigIntToVmNumber(id));
const number = (value: bigint): string => bytesToHex(bigIntToVmNumber(value));

/** A holder no list holds, whose slot lies below the caller's (`below`) or above it. */
function stranger(below: boolean): Uint8Array {
  const caller = bytesToSlotValue(keyToSlotMulti([USER]));
  for (let seed = 1; seed < 64; seed += 1) {
    const lock = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(seed));
    if ((bytesToSlotValue(keyToSlotMulti([lock])) < caller) === below) return lock;
  }
  throw new Error('no holder on that side of the caller');
}
const BELOW = stranger(true);
const ABOVE = stranger(false);

/** The bonus list as an initialize leaves it, the head aside: the caller's node. */
const INITIAL_BONUS = new Map([[slotOf(USER), number(BONUS)]]);

/** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** One contract deployed behind its generated proxy. */
interface Deployed {
  readonly artifact: Artifact;
  readonly proxy: Artifact;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
}

/** The deployments the cases share, and the chain as it stood once every initialize was broadcast. */
interface World {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
  readonly tally: Deployed;
  readonly board: Deployed;
  readonly ledger: Deployed;
  readonly snapshot: SnapshotRestorer;
}

async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  await fundShippedFacets(network);
  const deploy = async (name: string, args: readonly FunctionArgument[]): Promise<Deployed> => {
    const artifact = artifacts[name]!;
    const proxy = buildProxyArtifact(artifact);
    const implementationFunding = funding(idOf(`${name} implementation`));
    const proxyFunding = funding(idOf(`${name} proxy`));
    const initializeCoin = funding(idOf(`${name} initialize coin`));
    for (const coin of [implementationFunding, proxyFunding]) await network.addUtxo(wallet.address, coin);
    await network.addUtxo(binToHex(USER), initializeCoin);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifact,
      proxyArtifact: proxy,
      implementationDeploy: { fundingUtxo: implementationFunding, funder, changeAddress: wallet.address },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: wallet.address },
      initialize: { functionName: 'initialize', args: [...args] },
      callerLockingBytecode: USER,
      callerFunding: { utxo: initializeCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    return {
      artifact, proxy,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
    };
  };
  const tally = await deploy('Tally', [USER, BONUS]);
  const board = await deploy('Board', [USER, NAME]);
  const ledger = await deploy('Ledger', [USER, BONUS]);
  return { network, changeAddress: wallet.address, tally, board, ledger, snapshot: await network.takeSnapshot() };
}

let worldRun: Promise<World> | undefined;

/** One set of deployments serves every case, each rewinding the chain to them first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

let entered = 0;

/** One call of an entry through its proxy, from a fresh coin of the caller's, planned over `provider`. */
async function enter(
  world: World, target: Deployed, functionName: string, args: readonly FunctionArgument[],
  provider: NetworkProvider = world.network,
): Promise<{ readonly coin: Utxo; readonly call: ReturnType<typeof callFramedProxyEntry> }> {
  entered += 1;
  const coin = funding(idOf(`${functionName} coin ${entered}`));
  await world.network.addUtxo(binToHex(USER), coin);
  const call = callFramedProxyEntry({
    provider,
    implementationArtifact: target.artifact,
    proxyArtifact: target.proxy,
    proxyCategoryId: target.proxyCategoryId,
    implementationCategoryId: target.implementationCategoryId,
    functionName,
    args: [...args],
    callerUtxo: coin,
    callerLockingBytecode: USER,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
  return { coin, call };
}

/** Enters one call and requires it to settle: every participant accepted and the transaction broadcast. */
async function settle(
  world: World, target: Deployed, functionName: string, args: readonly FunctionArgument[],
): Promise<void> {
  const result = await (await enter(world, target, functionName, args)).call;
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

/** The mapping node a UTXO's commitment carries, read whether or not the UTXO is one. */
function nodeOf(utxo: Utxo): ReturnType<typeof decodeEntryCommitment> {
  return decodeEntryCommitment(hexToBin(utxo.token?.nft?.commitment ?? ''));
}

/** The value each live node of one collection holds, by slot, the head left out: it holds no value. */
async function held(world: World, target: Deployed, collection: string): Promise<ReadonlyMap<string, string>> {
  const layout = { ...target.proxy.stateLayout!, collections: target.artifact.stateLayout!.collections };
  const deployment = await readFramedDeployment(world.network, target.proxyCategoryId, layout);
  const values = new Map<string, string>();
  for (const node of (deployment.nodesByCollection.get(collection) ?? []).map(nodeOf)) {
    if (!node.slot.every((byte) => byte === 0)) values.set(bytesToHex(node.slot), bytesToHex(node.value));
  }
  return values;
}

/** Every outpoint a deployment's category holds. */
async function outpoints(world: World, target: Deployed): Promise<readonly string[]> {
  return (await world.network.getUtxosByTokenCategory(target.proxyCategoryId))
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
function hiding(network: MockNetworkProvider, key: Uint8Array): NetworkProvider {
  return relisting(network, (utxo) => (bytesEqual(nodeOf(utxo).slot, keyToSlotMulti([key])) ? undefined : utxo));
}

/** A listing that reports the node of `holder` as a node of `claimed` holding `value`, at the same outpoint. */
function claiming(
  network: MockNetworkProvider, holder: Uint8Array, claimed: Uint8Array, value: bigint,
): NetworkProvider {
  return relisting(network, (utxo) => {
    const node = nodeOf(utxo);
    if (!bytesEqual(node.slot, keyToSlotMulti([holder]))) return utxo;
    const commitment = encodeEntryCommitment(keyToSlotMulti([claimed]), node.nextKey, bigIntToVmNumber(value));
    return { ...utxo, token: { ...utxo.token!, nft: { ...utxo.token!.nft!, commitment: binToHex(commitment) } } };
  });
}

/** Enters a call that must be refused with `reason`, and checks the caller's coin and the deployment are untouched. */
async function expectRefused(
  world: World, target: Deployed, functionName: string, args: readonly FunctionArgument[], reason: string,
  provider: NetworkProvider = world.network,
): Promise<unknown> {
  const before = await outpoints(world, target);
  const entry = await enter(world, target, functionName, args, provider);
  const error = await entry.call.then(() => undefined, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(reason);
  expect((await world.network.getUtxosForLockingBytecode(USER))
    .some((utxo) => utxo.txid === entry.coin.txid && utxo.vout === entry.coin.vout)).toBe(true);
  expect(await outpoints(world, target)).toStrictEqual(before);
  return error;
}

/** The hop's words for a frame of `entry` that refused at `line` with `message`. */
function unsettled(entry: string, contract: string, line: number, message: string): string {
  return `the implementation's "${entry}" entry did not settle through the proxy: frame "implementation-master" of `
    + `${contract}.${entry}() at line ${line}: ${message} (Program failed an OP_VERIFY operation.)`;
}

describe('a proxied entry that reads one mapping beside the batch it writes', () => {
  it('reads a held key beside an insert into another mapping, then beside an update of it', async () => {
    const world = await deployed();
    expect(await held(world, world.tally, 'bonus')).toStrictEqual(INITIAL_BONUS);

    // counts[7] is not held, so the batch inserts it through the head; the caller's bonus node is read kept.
    await settle(world, world.tally, 'bump', [USER, 7n]);
    expect(await held(world, world.tally, 'counts')).toStrictEqual(new Map([[idSlot(7n), number(6n)]]));
    expect(await held(world, world.tally, 'bonus')).toStrictEqual(INITIAL_BONUS);

    // counts[7] is held now, so the batch updates it in place beside the same read.
    await settle(world, world.tally, 'bump', [USER, 7n]);
    expect(await held(world, world.tally, 'counts')).toStrictEqual(new Map([[idSlot(7n), number(12n)]]));
    expect(await held(world, world.tally, 'bonus')).toStrictEqual(INITIAL_BONUS);
  }, 600_000);

  it('reads a key the list does not hold, proved absent by the node below it', async () => {
    const world = await deployed();

    // A key below the caller's is bracketed by the head and a key above it by the caller's own node; either reads
    // the default, so the count grows by one each time.
    await settle(world, world.tally, 'bump', [BELOW, 9n]);
    expect(await held(world, world.tally, 'counts')).toStrictEqual(new Map([[idSlot(9n), number(1n)]]));
    await settle(world, world.tally, 'bump', [ABOVE, 9n]);
    expect(await held(world, world.tally, 'counts')).toStrictEqual(new Map([[idSlot(9n), number(2n)]]));
    expect(await held(world, world.tally, 'bonus')).toStrictEqual(INITIAL_BONUS);
  }, 600_000);

  it('reads the caller\'s own key as the guard of the write', async () => {
    const world = await deployed();
    await settle(world, world.tally, 'tick', [3n]);
    expect(await held(world, world.tally, 'counts')).toStrictEqual(new Map([[idSlot(3n), number(1n)]]));
    expect(await held(world, world.tally, 'bonus')).toStrictEqual(INITIAL_BONUS);
  }, 600_000);

  it('witnesses a long value it reads from the deployment\'s chunks, and reads an absent one as empty', async () => {
    const world = await deployed();

    // The caller's name is past the node's inline limit, so the frame takes it from its block's value witness.
    await settle(world, world.board, 'visit', [USER, 4n]);
    expect(await held(world, world.board, 'visits')).toStrictEqual(new Map([[idSlot(4n), number(1n)]]));

    // A holder the list does not hold has the empty name, which the entry's own guard refuses.
    const error = await expectRefused(world, world.board, 'visit', [BELOW, 4n],
      unsettled('visit', 'Board', lineOf('"unnamed"'), 'unnamed'));
    expect(error).toBeInstanceOf(FramedProxyDeployError);
  }, 600_000);

  it('reads the written mapping at a node its batch spends or not, and is refused under the key it writes', async () => {
    const world = await deployed();

    // bonus[BELOW] is inserted through the head, so the caller's node the read declares is spent by nothing else.
    await settle(world, world.ledger, 'shift', [USER, BELOW]);
    expect(await held(world, world.ledger, 'bonus'))
      .toStrictEqual(new Map([...INITIAL_BONUS, [slotOf(BELOW), number(BONUS)]]));

    // bonus[ABOVE] is inserted through the caller's node, which the read is declared at as the batch's own input.
    const fresh = await deployed();
    await settle(fresh, fresh.ledger, 'shift', [USER, ABOVE]);
    expect(await held(fresh, fresh.ledger, 'bonus'))
      .toStrictEqual(new Map([...INITIAL_BONUS, [slotOf(ABOVE), number(BONUS)]]));

    // bonus[USER] is the key the batch rewrites, which the frame would read as its segment began.
    const sameKey = 'the implementation\'s "shift" entry reads mapping "bonus" under a key its batch also writes, '
      + 'which its frame reads as the segment began, before the write, whichever comes first in the source';
    const again = await deployed();
    expect(await expectRefused(again, again.ledger, 'shift', [USER, USER], sameKey))
      .toBeInstanceOf(FramedProxyDeployError);
  }, 600_000);

  it('is refused by the frame when the hop declares a node that does not bracket the key', async () => {
    const world = await deployed();
    const refused = unsettled('bump', 'Tally', lineOf('function bump'), 'no source message');

    // Without the caller's node, the hop proves the caller's own key absent by the head, whose successor is that key.
    expect(await expectRefused(world, world.tally, 'bump', [USER, 7n], refused, hiding(world.network, USER)))
      .toBeInstanceOf(FramedProxyDeployError);
    // Without it, the hop brackets a key above the caller's by the head, though the caller's node lies between.
    expect(await expectRefused(world, world.tally, 'bump', [ABOVE, 7n], refused, hiding(world.network, USER)))
      .toBeInstanceOf(FramedProxyDeployError);
  }, 600_000);

  it('is refused by the validator when the hop declares a node the list does not hold', async () => {
    const world = await deployed();

    // The listing reports the caller's node as a node of ABOVE's key, so the hop declares ABOVE held at the caller's
    // outpoint and the frame's own run accepts what it declares. The transaction spends the caller's node as it is,
    // and the validator, input 1, holds every declared view to the node spent.
    await expectRefused(world, world.tally, 'bump', [ABOVE, 7n],
      'mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 1: '
      + 'Program failed an OP_VERIFY operation.)', claiming(world.network, USER, ABOVE, 99n));
  }, 600_000);
});
