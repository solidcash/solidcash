import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, utf8ToBin } from '@bitauth/libauth';
import { bytesEqual, bytesToHex, sha256, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv, carolPkh } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping write keyed by one of the contract's own scalar state values.
 *
 * Two shapes ordinary contracts write: the id counter (`items[nextId] = ...; nextId += 1`, the idiom since
 * OpenZeppelin v5 dropped `Counters`, in its post-increment spelling `items[nextId++]` too, and a key read after the
 * increment, `uint256 id = ++nextId`) and the stored recipient (`credit[treasury] += fee`). The framed master
 * derives the write's target slot from the record its frame declares for the value, in the segment the body reads
 * it, and from the value one straight-line assignment ahead of the read left; the hop and the plain call path plan
 * the node at the same key from the deployment's own records, through the label the artifact publishes. Each write
 * settles and is read back through the views. A plan that declares the node at a slot the record does not name is
 * refused by the entry's own derivation.
 *
 * `Registry` sits behind its generated proxy and stores a struct per id; `Tickets` is deployed plain and stores a
 * number per id. A struct record opened on the plain call path is `call/plain-root-writes.test.ts`'s.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`state keyed mapping write ${label}`)));
}

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Registry {',
  '  struct Item { address owner; uint256 price; }',
  '  address public implementation;',
  '  uint256 public nextId;',
  '  address public treasury;',
  '  mapping(uint256 => Item) private items;',
  '  mapping(address => uint256) private credit;',
  '  function initialize(address treasury_) public { treasury = treasury_; nextId = 1; }',
  '  function setTreasury(address treasury_) external { treasury = treasury_; }',
  '  function create(uint256 price) external { items[nextId] = Item(msg.sender, price); nextId += 1; }',
  '  function createNext(uint256 price) external { items[nextId++] = Item(msg.sender, price); }',
  '  function createAfter(uint256 price) external { uint256 id = ++nextId; items[id] = Item(msg.sender, price); }',
  '  function pay(uint256 amount, uint256 fee) external { credit[msg.sender] += amount; credit[treasury] += fee; }',
  '  function ownerOf(uint256 id) external view returns (address) { return items[id].owner; }',
  '  function priceOf(uint256 id) external view returns (uint256) { return items[id].price; }',
  '  function creditOf(address account) external view returns (uint256) { return credit[account]; }',
  '}',
  'contract Tickets {',
  '  uint256 public nextId;',
  '  address public treasury;',
  '  mapping(uint256 => uint256) private prices;',
  '  mapping(address => uint256) private credit;',
  '  constructor(address treasury_) { treasury = treasury_; nextId = 1; }',
  '  function setTreasury(address treasury_) external { treasury = treasury_; }',
  '  function issue(uint256 price) external { prices[nextId] = price; nextId += 1; }',
  '  function pay(uint256 amount, uint256 fee) external { credit[msg.sender] += amount; credit[treasury] += fee; }',
  '  function priceOf(uint256 id) external view returns (uint256) { return prices[id]; }',
  '  function creditOf(address account) external view returns (uint256) { return credit[account]; }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { evmCompat: true, composition: 'framed' } as never);
const registry = artifacts.Registry!;
const tickets = artifacts.Tickets!;

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const signer = (pkh: Uint8Array, priv: Uint8Array): Caller => ({
  lock: encodeLockingBytecodeP2pkh(pkh), funder: new SignatureTemplate(priv).unlockP2PKH(),
});
const ALICE = signer(alicePkh, alicePriv);
const BOB = signer(bobPkh, bobPriv);
/** The treasury `initialize` names, and the one `setTreasury` moves it to. */
const FIRST_TREASURY = encodeLockingBytecodeP2pkh(carolPkh);
const TREASURY = BOB.lock;

/** The slot an `items` node of id `id` sits at. */
const itemSlot = (id: bigint): Uint8Array => keyToSlotMulti([bigIntToVmNumber(id)]);

/** The registry behind its generated proxy, the tickets deployed plain, and the chain as it stood then. */
interface World {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
  readonly proxy: string;
  readonly implementation: string;
  readonly plain: string;
  readonly snapshot: SnapshotRestorer;
}

let coins = 0;

/** A fresh coin at `lock`, which a genesis or a call is funded from. */
async function coinAt(network: MockNetworkProvider, lock: string, label: string): Promise<Utxo> {
  coins += 1;
  const coin = { txid: idOf(`${label} ${coins}`), vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(lock, coin);
  return coin;
}

async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  await fundShippedFacets(network);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: registry,
    proxyArtifact: buildProxyArtifact(registry),
    implementationDeploy: {
      fundingUtxo: await coinAt(network, wallet.address, 'implementation'), funder, changeAddress: wallet.address,
    },
    proxyDeploy: { fundingUtxo: await coinAt(network, wallet.address, 'proxy'), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [FIRST_TREASURY] },
    callerLockingBytecode: ALICE.lock,
    callerFunding: {
      utxo: await coinAt(network, binToHex(ALICE.lock), 'initialize'), funder: ALICE.funder,
      changeAddress: wallet.address,
    },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  const plain = await deployStatefulContract(tickets, [FIRST_TREASURY], {
    provider: network, fundingUtxo: await coinAt(network, wallet.address, 'plain'), changeAddress: wallet.address,
    funder,
  });
  return {
    network, changeAddress: wallet.address, proxy: deployment.proxy.categoryId,
    implementation: deployment.implementation.categoryId, plain: plain.categoryId,
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

/** One call through the proxy, from a fresh coin of the caller's; it has to settle. */
async function settleProxied(
  world: World, functionName: string, args: readonly FunctionArgument[], caller: Caller = ALICE,
): Promise<FramedProxyCallResult> {
  const result = await callFramedProxyEntry({
    provider: world.network,
    implementationArtifact: registry,
    proxyArtifact: buildProxyArtifact(registry),
    proxyCategoryId: world.proxy,
    implementationCategoryId: world.implementation,
    functionName,
    args: [...args],
    callerUtxo: await coinAt(world.network, binToHex(caller.lock), functionName),
    callerLockingBytecode: caller.lock,
    funder: caller.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** One call to the plain deployment through the plain call path; it has to settle. */
async function settlePlain(
  world: World, functionName: string, args: readonly FunctionArgument[], caller: Caller = ALICE,
): Promise<void> {
  const result = await callFramedEntry({
    provider: world.network,
    artifact: tickets,
    categoryId: world.plain,
    functionName,
    args: [...args],
    callerUtxo: await coinAt(world.network, binToHex(caller.lock), functionName),
    callerLockingBytecode: caller.lock,
    funder: caller.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

/** A view's value, read from a deployment's records through the read path: the registry's, or the tickets'. */
async function view(
  world: World, artifact: Artifact, functionName: string, args: readonly FunctionArgument[] = [],
): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact, categoryId: artifact === registry ? world.proxy : world.plain, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** The owner, as the 20-byte identity a view returns an address as, and the price each listed id holds. */
async function itemsOf(world: World, ids: readonly bigint[]): Promise<readonly unknown[]> {
  const read: unknown[] = [];
  for (const id of ids) {
    read.push([binToHex(await view(world, registry, 'ownerOf', [id]) as Uint8Array),
      await view(world, registry, 'priceOf', [id])]);
  }
  return read;
}

describe('a mapping write keyed by a scalar state value', () => {
  it('publishes each key as the state read the body makes, and refuses no entry', () => {
    expect(registry.composition?.refusedEntries ?? []).toStrictEqual([]);
    expect(tickets.composition?.refusedEntries ?? []).toStrictEqual([]);
    const labels = (artifact: Artifact, entry: string): readonly (string | undefined)[] => (artifact.abi
      .find((candidate) => candidate.name === entry)?.entryAccesses ?? [])
      .map((access) => access.keySources?.[0]?.expressionLabel ?? access.keyParams[0]);
    expect(labels(registry, 'create')).toStrictEqual(['state:nextId']);
    expect(labels(registry, 'createNext')).toStrictEqual(['state:nextId']);
    // The key is read after the increment, so it is the value the increment left.
    expect(labels(registry, 'createAfter')).toStrictEqual(['binop:+(state:nextId,lit:1)']);
    expect(labels(registry, 'pay')).toStrictEqual(['state:treasury', 'sender:msg.sender']);
    expect(labels(tickets, 'issue')).toStrictEqual(['state:nextId']);
  });

  it('writes one item per id the counter hands out, through the proxy, each read back', async () => {
    const world = await deployed();
    await settleProxied(world, 'create', [100n]);
    await settleProxied(world, 'create', [250n], BOB);
    await settleProxied(world, 'createNext', [300n]);
    expect(await view(world, registry, 'nextId')).toBe(4n);
    expect(await itemsOf(world, [1n, 2n, 3n])).toStrictEqual([
      [binToHex(alicePkh), 100n], [binToHex(bobPkh), 250n], [binToHex(alicePkh), 300n],
    ]);
    // The key the increment ahead of it leaves: the counter moves to 5 and the item is written there, not at 4.
    await settleProxied(world, 'createAfter', [400n], BOB);
    expect(await view(world, registry, 'nextId')).toBe(5n);
    expect(await itemsOf(world, [4n, 5n])).toStrictEqual([['00'.repeat(20), 0n], [binToHex(bobPkh), 400n]]);
  }, 600_000);

  it('credits the stored recipient through the proxy, after it is moved', async () => {
    const world = await deployed();
    await settleProxied(world, 'setTreasury', [TREASURY]);
    await settleProxied(world, 'pay', [10n, 1n]);
    expect(await view(world, registry, 'creditOf', [ALICE.lock])).toBe(10n);
    expect(await view(world, registry, 'creditOf', [TREASURY])).toBe(1n);
    expect(await view(world, registry, 'creditOf', [FIRST_TREASURY])).toBe(0n);
    // A second payment rewrites both nodes in place.
    await settleProxied(world, 'pay', [5n, 2n]);
    expect(await view(world, registry, 'creditOf', [ALICE.lock])).toBe(15n);
    expect(await view(world, registry, 'creditOf', [TREASURY])).toBe(3n);
  }, 600_000);

  it('issues one ticket per id and credits the stored recipient on the plain call path', async () => {
    const world = await deployed();
    await settlePlain(world, 'issue', [100n]);
    await settlePlain(world, 'issue', [250n], BOB);
    expect(await view(world, tickets, 'nextId')).toBe(3n);
    expect(await view(world, tickets, 'priceOf', [1n])).toBe(100n);
    expect(await view(world, tickets, 'priceOf', [2n])).toBe(250n);
    await settlePlain(world, 'setTreasury', [TREASURY]);
    await settlePlain(world, 'pay', [10n, 1n]);
    expect(await view(world, tickets, 'creditOf', [ALICE.lock])).toBe(10n);
    expect(await view(world, tickets, 'creditOf', [TREASURY])).toBe(1n);
  }, 600_000);

  it('refuses a plan that declares the item at a slot the counter does not name', async () => {
    const world = await deployed();
    const result = await settleProxied(world, 'create', [100n]);
    const draft = result.draft;
    const entry = draft.runs.find((run) => run.functionName === `${registry.contractName}.create()`)!.master;
    const block = draft.blockOf(entry);
    const records = block.segments.flat();
    // The insert's group: the head the item is spliced after, relinked to the item, and the created item at id 1.
    const created = records.find((record) => record.viewIn.length === 0 && record.viewOut.length >= 64
      && bytesEqual(decodeEntryCommitment(record.viewOut).slot, itemSlot(1n)))!;
    const relinked = records.find((record) => record.viewOut.length >= 64
      && bytesEqual(decodeEntryCommitment(record.viewOut).nextKey, itemSlot(1n)))!;
    const vm = compositionMachine();
    expect(vm.stateSuccess(vm.evaluate(draft.programFor(entry)))).toBe(true);

    // The same group moved to id 2, consistently: the record still names id 1, so the derivation's slot is not it.
    const item = decodeEntryCommitment(created.viewOut);
    const head = decodeEntryCommitment(relinked.viewOut);
    created.viewOut = encodeEntryCommitment(itemSlot(2n), item.nextKey, item.value);
    relinked.viewOut = encodeEntryCommitment(head.slot, itemSlot(2n), head.value);
    expect(vm.stateSuccess(vm.evaluate(draft.programFor(entry)))).not.toBe(true);
  }, 600_000);
});
