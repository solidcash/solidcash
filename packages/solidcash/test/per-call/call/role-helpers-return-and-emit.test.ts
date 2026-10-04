import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, encodeEventCommitment, sha256 } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { eventLockingBytecode } from '../../../src/per-call/deploy/index.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Role helpers in the shape of an EVM access-control library's current release, behind a generated proxy: each
 * returns whether it changed the role and emits when it does (`_grantRole(...) internal returns (bool)`).
 *
 * A helper that returns and emits cannot run behind OP_INVOKE, where its event would be dropped at its exit
 * (X118), so it is inlined into each entry that calls it, its two returns first made one. The entry then emits the
 * helper's event where the helper's branch does. A grant to an account and a revocation settle with their event
 * read back from the broadcast, whether the entry discards the helper's result or returns it.
 *
 * A grant to an account that already holds the role takes the helper's other branch: it neither writes nor emits,
 * and returns false. The frame keeps the member's node and lists the event's output with the empty commitment, both
 * decided from the frame's facts (`call/guarded-mapping-write`, `call/guarded-event`).
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Roles {',
  '  struct RoleData { mapping(address => bool) members; bytes32 adminRole; }',
  '  bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;',
  '  address public implementation;',
  '  mapping(bytes32 => RoleData) private _roles;',
  '  error UnauthorizedAccount(address account, bytes32 neededRole);',
  '  event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);',
  '  event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);',
  '  modifier onlyRole(bytes32 role) {',
  '    if (!hasRole(role, msg.sender)) { revert UnauthorizedAccount(msg.sender, role); }',
  '    _;',
  '  }',
  '  function initialize(address admin) public { _grantRole(DEFAULT_ADMIN_ROLE, admin); }',
  '  function hasRole(bytes32 role, address account) public view returns (bool) {',
  '    return _roles[role].members[account];',
  '  }',
  '  function getRoleAdmin(bytes32 role) public view returns (bytes32) { return _roles[role].adminRole; }',
  '  function grantRole(bytes32 role, address account) public onlyRole(getRoleAdmin(role)) {',
  '    _grantRole(role, account);',
  '  }',
  '  function grantIfNew(bytes32 role, address account) public onlyRole(getRoleAdmin(role)) returns (bool) {',
  '    return _grantRole(role, account);',
  '  }',
  '  function revokeRole(bytes32 role, address account) public onlyRole(getRoleAdmin(role)) {',
  '    _revokeRole(role, account);',
  '  }',
  '  function _grantRole(bytes32 role, address account) internal returns (bool) {',
  '    if (!hasRole(role, account)) {',
  '      _roles[role].members[account] = true;',
  '      emit RoleGranted(role, account, msg.sender);',
  '      return true;',
  '    } else {',
  '      return false;',
  '    }',
  '  }',
  '  function _revokeRole(bytes32 role, address account) internal returns (bool) {',
  '    if (hasRole(role, account)) {',
  '      _roles[role].members[account] = false;',
  '      emit RoleRevoked(role, account, msg.sender);',
  '      return true;',
  '    }',
  '    return false;',
  '  }',
  '}',
].join('\n');

const roles = compileStringMulti(SOURCE, { solidityImportCompat: true, composition: 'per-call' } as never).Roles!;
const eventOf = (name: string): NonNullable<typeof roles.events>[number] =>
  roles.events!.find((definition) => definition.name === name)!;
const GRANTED = eventOf('RoleGranted');
const REVOKED = eventOf('RoleRevoked');

/** The deployer, granted the default admin role by `initialize`, and the caller of every entry. */
const ADMIN = encodeLockingBytecodeP2pkh(alicePkh);
const ADMIN_FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();
const DEFAULT_ADMIN_ROLE = new Uint8Array(32);
const ROLE = new Uint8Array(32).fill(0x01);
const OTHER_ROLE = new Uint8Array(32).fill(0x02);

/** Where a member node sits in the members list, which is ordered by slot. */
const memberAt = (role: Uint8Array, account: Uint8Array): bigint => bytesToSlotValue(keyToSlotMulti([role, account]));
/** The admin's own member node, which every frame's admin check reads. */
const ADMIN_NODE = memberAt(DEFAULT_ADMIN_ROLE, ADMIN);
/**
 * The first of a fixed list of accounts whose `role` member node sits below the admin's, so a grant of it splices
 * after the head rather than after a node its own frame reads (`call/read-node-spent-by-insert`).
 */
const accountBelowAdmin = (role: Uint8Array): Uint8Array => Array.from({ length: 32 }, (_unused, index) =>
  encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(index + 1)))
  .find((lock) => memberAt(role, lock) < ADMIN_NODE)!;
const GRANTEE = accountBelowAdmin(ROLE);
const OTHER_GRANTEE = accountBelowAdmin(OTHER_ROLE);

/** A 32-byte txid with varied bytes, taken from its label. */
const idOf = (label: string): string => bytesToHex(sha256(utf8ToBin(`role helpers return and emit ${label}`)));

/** The deployment behind its proxy, initialized by the admin, and the chain as it stood then. */
interface World {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
  readonly proxy: string;
  readonly implementation: string;
  readonly initializeEvents: readonly Uint8Array[];
  readonly snapshot: SnapshotRestorer;
}

let coins = 0;
/** A fresh coin at `lock`. */
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
  const deployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: roles,
    proxyArtifact: buildProxyArtifact(roles),
    implementationDeploy: {
      fundingUtxo: await coinAt(network, wallet.address, 'implementation'), funder, changeAddress: wallet.address,
    },
    proxyDeploy: { fundingUtxo: await coinAt(network, wallet.address, 'proxy'), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [ADMIN] },
    callerLockingBytecode: ADMIN,
    callerFunding: {
      utxo: await coinAt(network, binToHex(ADMIN), 'initialize'), funder: ADMIN_FUNDER, changeAddress: wallet.address,
    },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    network,
    changeAddress: wallet.address,
    proxy: deployment.proxy.categoryId,
    implementation: deployment.implementation.categoryId,
    initializeEvents: deployment.initialize.writtenEventCommitments,
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

/** One call through the proxy from a fresh coin of the admin's. */
async function enter(
  world: World, functionName: string, args: readonly FunctionArgument[],
): Promise<{ readonly coin: Utxo; readonly call: Promise<PerCallProxyCallResult> }> {
  const coin = await coinAt(world.network, binToHex(ADMIN), functionName);
  const call = callPerCallProxyEntry({
    provider: world.network,
    implementationArtifact: roles,
    proxyArtifact: buildProxyArtifact(roles),
    proxyCategoryId: world.proxy,
    implementationCategoryId: world.implementation,
    functionName,
    args: [...args],
    callerUtxo: coin,
    callerLockingBytecode: ADMIN,
    funder: ADMIN_FUNDER,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
  return { coin, call };
}

/** Enters one call and requires every participant to accept it and the transaction to broadcast. */
async function settle(
  world: World, functionName: string, args: readonly FunctionArgument[],
): Promise<PerCallProxyCallResult> {
  const result = await (await enter(world, functionName, args)).call;
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** Whether `account` holds `role`, read from the proxy's records through the read path. */
async function holds(world: World, role: Uint8Array, account: Uint8Array): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: world.network, artifact: roles, categoryId: world.proxy, functionName: 'hasRole', args: [role, account],
  });
  expect(read.accepted).toBe(true);
  return read.value;
}

/** The payload an event of `role`, `account` and the admin as its sender carries. */
const payload = (event: typeof GRANTED, role: Uint8Array, account: Uint8Array): string =>
  bytesToHex(encodeEventCommitment(event.parameters, [role, account, ADMIN]));

/** Each event output the implementation frame lists in the broadcast, as `<lock>:<commitment>`. */
function listedEvents(result: PerCallProxyCallResult): readonly string[] {
  return result.draft.blockOf('implementation-master').events.map((index) => {
    const output = result.broadcast!.outputs[index]!;
    return `${bytesToHex(output.lockingBytecode)}:${bytesToHex(output.token!.nft!.commitment)}`;
  });
}

/** The event output an event of the proxy's records carries: its covenant and its payload. */
const eventOutput = (world: World, event: typeof GRANTED, role: Uint8Array, account: Uint8Array): string =>
  `${bytesToHex(eventLockingBytecode(hexToBin(world.proxy), event.signature, false))}:${payload(event, role, account)}`;

describe('role helpers that return whether they changed the role and emit when they do', () => {
  it('compiles every entry, each carrying the event of the helper it calls', () => {
    expect(roles.composition?.refusedEntries ?? []).toStrictEqual([]);
    const emitted = (entry: string): readonly string[] | undefined =>
      roles.abi.find((candidate) => candidate.name === entry)?.emits?.map((emit) => emit.eventName);
    expect(emitted('initialize')).toStrictEqual(['RoleGranted']);
    expect(emitted('grantRole')).toStrictEqual(['RoleGranted']);
    expect(emitted('grantIfNew')).toStrictEqual(['RoleGranted']);
    expect(emitted('revokeRole')).toStrictEqual(['RoleRevoked']);
    // Every insert splices after the head, below the admin's node its admin check reads.
    for (const [role, account] of [[ROLE, GRANTEE], [OTHER_ROLE, OTHER_GRANTEE]] as const) {
      expect(memberAt(role, account)).toBeLessThan(ADMIN_NODE);
    }
  });

  it('grants the default admin role at initialization, with its event', async () => {
    const world = await deployed();
    expect(await holds(world, DEFAULT_ADMIN_ROLE, ADMIN)).toBe(true);
    expect(world.initializeEvents.map(bytesToHex)).toStrictEqual([payload(GRANTED, DEFAULT_ADMIN_ROLE, ADMIN)]);
  }, 600_000);

  it('grants a role through an entry that discards the helper\'s result, its event read back', async () => {
    const world = await deployed();
    const result = await settle(world, 'grantRole', [ROLE, GRANTEE]);
    expect(result.writtenEventCommitments.map(bytesToHex)).toStrictEqual([payload(GRANTED, ROLE, GRANTEE)]);
    expect(listedEvents(result)).toStrictEqual([eventOutput(world, GRANTED, ROLE, GRANTEE)]);
    expect(await holds(world, ROLE, GRANTEE)).toBe(true);
    expect(await holds(world, OTHER_ROLE, GRANTEE)).toBe(false);
  }, 600_000);

  it('returns that the grant changed the role, where the entry returns the helper\'s result', async () => {
    const world = await deployed();
    const result = await settle(world, 'grantIfNew', [OTHER_ROLE, OTHER_GRANTEE]);
    expect(result.value).toBe(true);
    expect(listedEvents(result)).toStrictEqual([eventOutput(world, GRANTED, OTHER_ROLE, OTHER_GRANTEE)]);
    expect(await holds(world, OTHER_ROLE, OTHER_GRANTEE)).toBe(true);
  }, 600_000);

  it('revokes a role through a helper that returns early from its branch, its event read back', async () => {
    const world = await deployed();
    await settle(world, 'grantRole', [ROLE, GRANTEE]);
    const result = await settle(world, 'revokeRole', [ROLE, GRANTEE]);
    expect(listedEvents(result)).toStrictEqual([eventOutput(world, REVOKED, ROLE, GRANTEE)]);
    expect(await holds(world, ROLE, GRANTEE)).toBe(false);
    expect(await holds(world, DEFAULT_ADMIN_ROLE, ADMIN)).toBe(true);
  }, 600_000);

  it('settles a grant to a holder, which neither writes nor emits, returning false', async () => {
    const world = await deployed();
    await settle(world, 'grantRole', [ROLE, GRANTEE]);
    const before = (await world.network.getUtxosByTokenCategory(world.proxy)).length;
    const result = await settle(world, 'grantIfNew', [ROLE, GRANTEE]);
    // The helper's other branch makes no write and no event: the member's node is kept, and the event's output is
    // listed with the empty commitment.
    expect(result.value).toBe(false);
    const lock = bytesToHex(eventLockingBytecode(hexToBin(world.proxy), GRANTED.signature, false));
    expect(listedEvents(result)).toStrictEqual([`${lock}:`]);
    // The listed event output is the category's one new UTXO: the kept node creates none.
    expect((await world.network.getUtxosByTokenCategory(world.proxy)).length).toBe(before + 1);
    expect(await holds(world, ROLE, GRANTEE)).toBe(true);
  }, 600_000);
});
