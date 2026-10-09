import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesEqual, bytesToHex, sha256, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../../src/network/NetworkProvider.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import {
  FramedProxyDeployError, buildProxyArtifact, callFramedProxyEntry, deployFramedProxy,
  type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti,
} from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, carolPkh, carolPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied entry that checks one key of a mapping and inserts another into it: the hand-written allowlist
 * (`require(members[msg.sender]); members[account] = true;`), and an access-control grant whose admin check reads
 * the admin's own member node.
 *
 * The frame reads the checked key from the node its segment declares kept ahead of the batch's groups, and the
 * insert spends the new key's predecessor to relink it. When the node the read proves its key by is that
 * predecessor, the two are one node: the hop places it once, as the batch's input, and declares it at both
 * positions, at the read kept at the view the segment began with and in the batch from that view to the relinked
 * one. The frame proves the read's key, held or bracketed, against the node's first declaration in its segment and
 * the insert's bracket against the same view, and the validator chains the read into the batch's transition. Beside
 * a call, the read keeps the spent view up to the write's segment and the relinked one after it. A read under the
 * very key the batch writes is refused by name, since the frame reads it as the segment began whichever comes first
 * in the source; and a node the hop is made to declare wrongly is refused, by the frame when it does not prove the
 * read's key and by the validator when its declared view is not the node spent.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`read node spent by insert ${label}`)));
}

/**
 * An allowlist, the same list beside a call after its insert (`Roster`) and before it (`Guild`), and an
 * access-control role table. Each allowlist is its own contract so its master stays under the input-script limit.
 */
const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IRegistry { function check(address account) external view; }',
  'contract Registry {',
  '  uint256 public checks;',
  '  function check(address account) external view { require(account != address(0), "no account"); }',
  '}',
  'contract Members {',
  '  address public implementation;',
  '  uint256 public size;',
  '  mapping(address => bool) public members;',
  '  function initialize(address admin) public { members[admin] = true; size = 1; }',
  '  function add(address account) external {',
  '    require(members[msg.sender], "not a member");',
  '    members[account] = true;',
  '    size += 1;',
  '  }',
  '}',
  'contract Roster {',
  '  address public implementation;',
  '  address public registry;',
  '  mapping(address => bool) public members;',
  '  function initialize(address admin, address registry_) public { members[admin] = true; registry = registry_; }',
  '  function addThenCheck(address account) external {',
  '    require(members[msg.sender], "not a member");',
  '    members[account] = true;',
  '    IRegistry(registry).check(account);',
  '  }',
  '}',
  'contract Guild {',
  '  address public implementation;',
  '  address public registry;',
  '  mapping(address => bool) public members;',
  '  function initialize(address admin, address registry_) public { members[admin] = true; registry = registry_; }',
  '  function checkThenAdd(address account) external {',
  '    require(members[msg.sender], "not a member");',
  '    IRegistry(registry).check(account);',
  '    members[account] = true;',
  '  }',
  '}',
  'contract Gate {',
  '  struct RoleData { mapping(address => bool) members; bytes32 adminRole; }',
  '  bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;',
  '  address public implementation;',
  '  mapping(bytes32 => RoleData) private _roles;',
  '  function initialize(address admin) public { _grantRole(DEFAULT_ADMIN_ROLE, admin); }',
  '  function hasRole(bytes32 role, address account) public view returns (bool) {',
  '    return _roles[role].members[account];',
  '  }',
  '  function getRoleAdmin(bytes32 role) public view returns (bytes32) { return _roles[role].adminRole; }',
  '  function grantRole(bytes32 role, address account) external {',
  '    require(hasRole(getRoleAdmin(role), msg.sender), "grant needs the admin role");',
  '    _grantRole(role, account);',
  '  }',
  '  function _grantRole(bytes32 role, address account) internal { _roles[role].members[account] = true; }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { evmCompat: true, composition: 'framed' } as never);
const registry = artifacts.Registry!;
const members = artifacts.Members!;
const roster = artifacts.Roster!;
const guild = artifacts.Guild!;
const gate = artifacts.Gate!;

/** The 1-based line of the first source line containing `needle` at or after the one containing `after`. */
function lineOf(needle: string, after = ''): number {
  const lines = SOURCE.split('\n');
  const from = lines.findIndex((line) => line.includes(after));
  return lines.findIndex((line, index) => index >= from && line.includes(needle)) + 1;
}

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const signer = (pkh: Uint8Array, priv: Uint8Array): Caller => ({
  lock: encodeLockingBytecodeP2pkh(pkh), funder: new SignatureTemplate(priv).unlockP2PKH(),
});
/** The deployer: the one member `initialize` enrolls, and the holder of the default admin role. */
const ADMIN = signer(alicePkh, alicePriv);
/** A caller no list holds. */
const CAROL = signer(carolPkh, carolPriv);

const slotOf = (...keys: Uint8Array[]): Uint8Array => keyToSlotMulti(keys);
const slotHex = (...keys: Uint8Array[]): string => bytesToHex(slotOf(...keys));
/** Where the node of `keys` sits in its list, which is ordered by slot. */
const at = (...keys: Uint8Array[]): bigint => bytesToSlotValue(slotOf(...keys));

/** Accounts no signer holds, in the order their member slots sort. */
const ACCOUNTS = Array.from({ length: 64 }, (_unused, index) =>
  encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(index + 1)))
  .sort((left, right) => (at(left) < at(right) ? -1 : 1));
const ADMIN_AT = at(ADMIN.lock);
const ABOVE_ADMIN = ACCOUNTS.filter((account) => at(account) > ADMIN_AT);
/** An account whose node the head precedes. */
const BELOW = ACCOUNTS.find((account) => at(account) < ADMIN_AT)!;
/** The highest account: its node's predecessor is the admin's own. */
const ABOVE = ABOVE_ADMIN[ABOVE_ADMIN.length - 1]!;
/** An account between the admin and ABOVE: once ABOVE is in, its predecessor is the admin's node again. */
const BETWEEN = ABOVE_ADMIN[0]!;
/** An account above CAROL's slot, which a node claimed for CAROL would precede. */
const ABOVE_CAROL = ACCOUNTS.filter((account) => at(account) > at(CAROL.lock)).pop()!;

const DEFAULT_ADMIN_ROLE = new Uint8Array(32);
const ROLE = new Uint8Array(32).fill(0x01);
/** The admin's own member node, which every admin check reads. */
const ADMIN_NODE = at(DEFAULT_ADMIN_ROLE, ADMIN.lock);
const ABOVE_ADMIN_NODE = ACCOUNTS.filter((account) => at(ROLE, account) > ADMIN_NODE)
  .sort((left, right) => (at(ROLE, left) < at(ROLE, right) ? -1 : 1));
/** Two grantees of ROLE whose member nodes the admin's node precedes, the higher first. */
const GRANTEE = ABOVE_ADMIN_NODE[ABOVE_ADMIN_NODE.length - 1]!;
const SECOND_GRANTEE = ABOVE_ADMIN_NODE[0]!;

/** One deployment behind its generated proxy. */
interface Deployed { readonly proxy: string; readonly implementation: string }

/** The registry, every deployment initialized by the admin, and the chain as it stood then. */
interface World {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
  readonly registryCategoryId: string;
  readonly deployments: ReadonlyMap<Artifact, Deployed>;
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
  const registryDeployment = await deployStatefulContract(registry, [], {
    provider: network, fundingUtxo: await coinAt(network, wallet.address, 'registry'), funder,
    changeAddress: wallet.address,
  });
  const registryAddress = validatorAddress(hexToBin(registryDeployment.categoryId), VALIDATOR_PROGRAM);
  const deployments = new Map<Artifact, Deployed>();
  const initialized: readonly (readonly [Artifact, readonly FunctionArgument[]])[] = [
    [members, [ADMIN.lock]], [roster, [ADMIN.lock, registryAddress]], [guild, [ADMIN.lock, registryAddress]],
    [gate, [ADMIN.lock]],
  ];
  for (const [artifact, args] of initialized) {
    const name = artifact.contractName;
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      implementationDeploy: {
        fundingUtxo: await coinAt(network, wallet.address, `${name} implementation`), funder,
        changeAddress: wallet.address,
      },
      proxyDeploy: {
        fundingUtxo: await coinAt(network, wallet.address, `${name} proxy`), funder, changeAddress: wallet.address,
      },
      initialize: { functionName: 'initialize', args: [...args] },
      callerLockingBytecode: ADMIN.lock,
      callerFunding: {
        utxo: await coinAt(network, binToHex(ADMIN.lock), `${name} initialize`), funder: ADMIN.funder,
        changeAddress: wallet.address,
      },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    deployments.set(artifact, {
      proxy: deployment.proxy.categoryId, implementation: deployment.implementation.categoryId,
    });
  }
  return {
    network, changeAddress: wallet.address, registryCategoryId: registryDeployment.categoryId, deployments,
    snapshot: await network.takeSnapshot(),
  };
}

let worldRun: Promise<World> | undefined;

/** One set of deployments serves every case, each rewinding the chain to them first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** One call through a deployment's proxy, from a fresh coin of the caller's, planned over `provider`. */
async function enter(
  world: World, artifact: Artifact, functionName: string, args: readonly FunctionArgument[], caller: Caller,
  provider: NetworkProvider = world.network,
): Promise<{ readonly coin: Utxo; readonly call: Promise<FramedProxyCallResult> }> {
  const target = world.deployments.get(artifact)!;
  const coin = await coinAt(world.network, binToHex(caller.lock), functionName);
  const call = callFramedProxyEntry({
    provider,
    implementationArtifact: artifact,
    proxyArtifact: buildProxyArtifact(artifact),
    proxyCategoryId: target.proxy,
    implementationCategoryId: target.implementation,
    functionName,
    args: [...args],
    externals: { IRegistry: { artifact: registry, categoryId: world.registryCategoryId } },
    callerUtxo: coin,
    callerLockingBytecode: caller.lock,
    funder: caller.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
  return { coin, call };
}

/** Enters one call and requires it to settle: every participant accepted and the transaction broadcast. */
async function settle(
  world: World, artifact: Artifact, functionName: string, args: readonly FunctionArgument[], caller = ADMIN,
): Promise<FramedProxyCallResult> {
  const result = await (await enter(world, artifact, functionName, args, caller)).call;
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** The mapping node a UTXO's commitment carries, read whether or not the UTXO is one. */
function nodeOf(utxo: Utxo): ReturnType<typeof decodeEntryCommitment> {
  return decodeEntryCommitment(hexToBin(utxo.token?.nft?.commitment ?? ''));
}

/** Every live node of one of a deployment's collections, the head included. */
async function nodes(world: World, artifact: Artifact, collection: string): Promise<readonly Utxo[]> {
  const layout = { ...buildProxyArtifact(artifact).stateLayout!, collections: artifact.stateLayout!.collections };
  const deployment = await readFramedDeployment(world.network, world.deployments.get(artifact)!.proxy, layout);
  return deployment.nodesByCollection.get(collection) ?? [];
}

/** The live node of `collection` at the slot of `keys`. */
async function nodeAt(world: World, artifact: Artifact, collection: string, ...keys: Uint8Array[]): Promise<Utxo> {
  return (await nodes(world, artifact, collection)).find((utxo) => bytesEqual(nodeOf(utxo).slot, slotOf(...keys)))!;
}

/** The successor each live node of an allowlist's `members` links to, by slot, the head left out. */
async function links(world: World, artifact: Artifact): Promise<ReadonlyMap<string, string>> {
  const linked = new Map<string, string>();
  for (const node of (await nodes(world, artifact, 'members')).map(nodeOf)) {
    if (!node.slot.every((byte) => byte === 0)) linked.set(bytesToHex(node.slot), bytesToHex(node.nextKey));
  }
  return linked;
}

/** A view's value, read from the proxy's records through the read path. */
async function view(
  world: World, artifact: Artifact, functionName: string, args: readonly FunctionArgument[],
): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact, categoryId: world.deployments.get(artifact)!.proxy, functionName, args,
  });
  expect(read.accepted).toBe(true);
  return read.value;
}

/** The ids a hop places its participants under that start with `prefix`. */
function placed(result: FramedProxyCallResult, prefix: string): readonly string[] {
  return result.draft.layout.participants.map((participant) => participant.id).filter((id) => id.startsWith(prefix));
}

/** The views, as `in>out` hex, each record of the implementation frame's segment declares at a participant. */
function declared(result: FramedProxyCallResult, segment: number, id: string): readonly string[] {
  const index = result.draft.layout.participants.find((participant) => participant.id === id)!.index;
  return result.draft.blockOf('implementation-master').segments[segment]!
    .filter((record) => record.in === index)
    .map((record) => `${bytesToHex(record.viewIn)}>${bytesToHex(record.viewOut)}`);
}

/** Every outpoint a deployment's category holds. */
async function outpoints(world: World, artifact: Artifact): Promise<readonly string[]> {
  return (await world.network.getUtxosByTokenCategory(world.deployments.get(artifact)!.proxy))
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

/** Enters a call that must be refused with `reason`, and checks the caller's coin and the deployment are untouched. */
async function expectRefused(
  world: World, artifact: Artifact, functionName: string, args: readonly FunctionArgument[], caller: Caller,
  reason: string, provider: NetworkProvider = world.network,
): Promise<unknown> {
  const before = await outpoints(world, artifact);
  const entry = await enter(world, artifact, functionName, args, caller, provider);
  const error = await entry.call.then(() => undefined, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(reason);
  expect((await world.network.getUtxosForLockingBytecode(caller.lock))
    .some((utxo) => utxo.txid === entry.coin.txid && utxo.vout === entry.coin.vout)).toBe(true);
  expect(await outpoints(world, artifact)).toStrictEqual(before);
  return error;
}

/** The hop's words for a frame of `entry` that refused at `line` with `message`. */
function unsettled(entry: string, contract: string, line: number, message: string): string {
  return `the implementation's "${entry}" entry did not settle through the proxy: frame "implementation-master" of `
    + `${contract}.${entry}() at line ${line}: ${message} (Program failed an OP_VERIFY operation.)`;
}

const MEMBER = `mapping-node-${slotHex(ADMIN.lock)}`;

describe('a proxied entry that reads a node its own insert splices through', () => {
  it('places the accounts around the admin\'s node', () => {
    expect(at(BELOW)).toBeLessThan(ADMIN_AT);
    expect(at(BETWEEN)).toBeGreaterThan(ADMIN_AT);
    expect(at(BETWEEN)).toBeLessThan(at(ABOVE));
    expect(at(ABOVE_CAROL)).toBeGreaterThan(at(CAROL.lock));
    expect(at(ROLE, SECOND_GRANTEE)).toBeGreaterThan(ADMIN_NODE);
    expect(at(ROLE, SECOND_GRANTEE)).toBeLessThan(at(ROLE, GRANTEE));
  });

  it('inserts below the caller\'s node through the head, reading the caller\'s node apart (control)', async () => {
    const world = await deployed();
    const result = await settle(world, members, 'add', [BELOW]);
    expect(placed(result, 'mapping-')).toStrictEqual([`mapping-read-members-${slotHex(ADMIN.lock)}`,
      `mapping-node-${'00'.repeat(32)}`]);
    expect(await view(world, members, 'members', [BELOW])).toBe(true);
    expect(await view(world, members, 'size', [])).toBe(2n);
  }, 600_000);

  it('inserts through the caller\'s own node, the read declared at the batch\'s input', async () => {
    const world = await deployed();
    const spent = (await nodeAt(world, members, 'members', ADMIN.lock)).token!.nft!.commitment;
    const value = nodeOf(await nodeAt(world, members, 'members', ADMIN.lock)).value;
    const relinked = bytesToHex(encodeEntryCommitment(slotOf(ADMIN.lock), slotOf(ABOVE), value));

    // One input for the caller's node: the batch's, which the read is declared at, kept at the view the segment
    // began with, ahead of the batch's own transition from that view to the relinked one.
    const result = await settle(world, members, 'add', [ABOVE]);
    expect(placed(result, 'mapping-')).toStrictEqual([MEMBER]);
    expect(declared(result, 0, MEMBER)).toStrictEqual([`${spent}>${spent}`, `${spent}>${relinked}`]);
    expect(await view(world, members, 'members', [ABOVE])).toBe(true);
    expect(await view(world, members, 'members', [ADMIN.lock])).toBe(true);
    expect(await view(world, members, 'size', [])).toBe(2n);
    expect(await links(world, members)).toStrictEqual(new Map([
      [slotHex(ADMIN.lock), slotHex(ABOVE)], [slotHex(ABOVE), '00'.repeat(32)],
    ]));

    // The caller's node, relinked, is read and spent again by an insert into the gap the first one left.
    await settle(world, members, 'add', [BETWEEN]);
    expect(await view(world, members, 'members', [BETWEEN])).toBe(true);
    expect(await view(world, members, 'size', [])).toBe(3n);
    expect(await links(world, members)).toStrictEqual(new Map([
      [slotHex(ADMIN.lock), slotHex(BETWEEN)], [slotHex(BETWEEN), slotHex(ABOVE)], [slotHex(ABOVE), '00'.repeat(32)],
    ]));
  }, 600_000);

  it('reads the node at the relinked view past a call after the insert, and at the spent view before one', async () => {
    const world = await deployed();
    for (const [artifact, entry, writeSegment] of [[roster, 'addThenCheck', 0], [guild, 'checkThenAdd', 1]] as const) {
      const node = await nodeAt(world, artifact, 'members', ADMIN.lock);
      const spent = node.token!.nft!.commitment;
      const relinked = bytesToHex(encodeEntryCommitment(slotOf(ADMIN.lock), slotOf(ABOVE), nodeOf(node).value));

      // The read is declared ahead of the batch in both segments: at the spent view up to the segment the insert
      // lands in, the transition's own, and at the relinked view past it.
      const result = await settle(world, artifact, entry, [ABOVE]);
      expect(placed(result, 'mapping-')).toStrictEqual([MEMBER]);
      const kept = (commitment: string): string => `${commitment}>${commitment}`;
      expect(declared(result, 0, MEMBER)).toStrictEqual(writeSegment === 0
        ? [kept(spent), `${spent}>${relinked}`] : [kept(spent), kept(spent)]);
      expect(declared(result, 1, MEMBER)).toStrictEqual(writeSegment === 0
        ? [kept(relinked), kept(relinked)] : [kept(spent), `${spent}>${relinked}`]);
      expect(await view(world, artifact, 'members', [ABOVE])).toBe(true);
      expect(await links(world, artifact)).toStrictEqual(new Map([
        [slotHex(ADMIN.lock), slotHex(ABOVE)], [slotHex(ABOVE), '00'.repeat(32)],
      ]));
    }
  }, 600_000);

  it('grants a role whose new member\'s predecessor is the node the admin check reads', async () => {
    const world = await deployed();
    const result = await settle(world, gate, 'grantRole', [ROLE, GRANTEE]);
    expect(placed(result, 'mapping-node-')).toStrictEqual([`mapping-node-${slotHex(DEFAULT_ADMIN_ROLE, ADMIN.lock)}`]);
    expect(placed(result, 'mapping-read-_roles__members-')).toStrictEqual([]);
    expect(await view(world, gate, 'hasRole', [ROLE, GRANTEE])).toBe(true);

    // The admin's node, relinked by that grant, is read and spent again by a grant into the gap it left.
    await settle(world, gate, 'grantRole', [ROLE, SECOND_GRANTEE]);
    expect(await view(world, gate, 'hasRole', [ROLE, SECOND_GRANTEE])).toBe(true);
    expect(await view(world, gate, 'hasRole', [DEFAULT_ADMIN_ROLE, ADMIN.lock])).toBe(true);
    expect(await view(world, gate, 'hasRole', [ROLE, ADMIN.lock])).toBe(false);
  }, 600_000);

  it('refuses a caller without the admin role by the body\'s check, at the node the grant splices through', async () => {
    const world = await deployed();
    // CAROL's own default-admin node is absent, so her check is bracketed by the admin's node, which her grant's
    // insert splices through: one input, proving her key absent and the new key's gap.
    expect(at(DEFAULT_ADMIN_ROLE, CAROL.lock)).toBeGreaterThan(ADMIN_NODE);
    expect(await expectRefused(world, gate, 'grantRole', [ROLE, GRANTEE], CAROL,
      unsettled('grantRole', 'Gate', lineOf('"grant needs the admin role"'), 'grant needs the admin role')))
      .toBeInstanceOf(FramedProxyDeployError);
    expect(await view(world, gate, 'hasRole', [ROLE, GRANTEE])).toBe(false);
  }, 600_000);

  it('refuses by name a read under the key its batch writes', async () => {
    const world = await deployed();
    const reason = (entry: string, collection: string): string => `the implementation's "${entry}" entry reads `
      + `mapping "${collection}" under a key its batch also writes, which its frame reads as the segment began, `
      + 'before the write, whichever comes first in the source';
    expect(await expectRefused(world, members, 'add', [ADMIN.lock], ADMIN, reason('add', 'members')))
      .toBeInstanceOf(FramedProxyDeployError);
    expect(await expectRefused(world, gate, 'grantRole', [DEFAULT_ADMIN_ROLE, ADMIN.lock], ADMIN,
      reason('grantRole', '_roles__members'))).toBeInstanceOf(FramedProxyDeployError);
  }, 600_000);

  it('is refused by the frame when the shared node does not prove the read\'s key', async () => {
    const world = await deployed();
    // Without the admin's node, the hop proves the admin's key absent by the head, whose successor is that key, and
    // splices the insert through the same head.
    const hiding = relisting(world.network,
      (utxo) => (bytesEqual(nodeOf(utxo).slot, slotOf(ADMIN.lock)) ? undefined : utxo));
    expect(await expectRefused(world, members, 'add', [ABOVE], ADMIN,
      unsettled('add', 'Members', lineOf('require(members[msg.sender]', 'function add'),
        'no source message'), hiding))
      .toBeInstanceOf(FramedProxyDeployError);
  }, 600_000);

  it('is refused by the validator when the shared node is declared at a view other than the one spent', async () => {
    const world = await deployed();
    // The listing reports the admin's node as CAROL's, holding the admin's value, so the hop declares CAROL a member
    // at the admin's outpoint and splices the insert through it, and every frame accepts what it declares. The
    // transaction spends the admin's node as it is, and the validator, input 1, holds the declared view to it.
    const claiming = relisting(world.network, (utxo) => {
      const node = nodeOf(utxo);
      if (!bytesEqual(node.slot, slotOf(ADMIN.lock))) return utxo;
      const commitment = encodeEntryCommitment(slotOf(CAROL.lock), node.nextKey, node.value);
      return { ...utxo, token: { ...utxo.token!, nft: { ...utxo.token!.nft!, commitment: binToHex(commitment) } } };
    });
    await expectRefused(world, members, 'add', [ABOVE_CAROL], CAROL,
      'mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 1: '
      + 'Program failed an OP_VERIFY operation.)', claiming);
    expect(await view(world, members, 'members', [CAROL.lock])).toBe(false);
    expect(await view(world, members, 'members', [ABOVE_CAROL])).toBe(false);
  }, 600_000);
});
