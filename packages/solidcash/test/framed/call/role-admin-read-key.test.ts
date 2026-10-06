import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, utf8ToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, sha256, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import {
  PerCallProxyDeployError, buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy,
  type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv, carolPkh, carolPriv } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Role-based access in the shape of an EVM access-control contract (Solidity-compatible), behind a proxy.
 *
 * A role's members live in a mapping inside a struct inside a mapping, so each field is its own collection: the
 * members keyed by role and account, and the role's admin role keyed by role. Roles are `bytes32` constants
 * (`DEFAULT_ADMIN_ROLE = 0x00`, `MINTER = keccak256("MINTER")`) or the literals `bytes32(0)` and
 * `bytes32(uint256(1))`, which the compiler publishes as the bytes the body hashes for them: the hop plans the node
 * the body's own key names, and a caller naming the role by its bytes reads it. The master derives a write keyed by
 * a constant from the constant's value. `grantRole` and `revokeRole` check the caller against the role's ADMIN role,
 * a value the body first reads out of the admin collection: the hop resolves that key from the admin node the
 * deployment holds, or the type's default where it holds none, which is `DEFAULT_ADMIN_ROLE`. Every write settles
 * and is read back through the views; a caller without the admin role is refused by the body's own check.
 *
 * The roles and accounts are chosen so that no insert's predecessor is a node its own frame reads: a read of a
 * node the batch also spends is served apart (`call/read-node-spent-by-insert`). A read beside a batch whose key
 * the hop cannot resolve at all is refused by that read's own reason.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`role admin read key ${label}`)));
}

/**
 * Two contracts, each with its own role table: the admin-checked grants and the constant-keyed ones; and a third
 * whose read key divides an argument.
 */
const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Roles {',
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
  '  function revokeRole(bytes32 role, address account) external {',
  '    require(hasRole(getRoleAdmin(role), msg.sender), "revoke needs the admin role");',
  '    _roles[role].members[account] = false;',
  '  }',
  '  function setRoleAdmin(bytes32 role, bytes32 adminRole) external {',
  '    require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "needs the default admin role");',
  '    _roles[role].adminRole = adminRole;',
  '  }',
  '  function _grantRole(bytes32 role, address account) internal { _roles[role].members[account] = true; }',
  '}',
  'contract Vault {',
  '  struct RoleData { mapping(address => bool) members; bytes32 adminRole; }',
  '  bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;',
  '  bytes32 constant MINTER = keccak256("MINTER");',
  '  address public implementation;',
  '  mapping(bytes32 => RoleData) private _roles;',
  '  function initialize(address admin) public { _roles[DEFAULT_ADMIN_ROLE].members[admin] = true; }',
  '  function hasRole(bytes32 role, address account) public view returns (bool) {',
  '    return _roles[role].members[account];',
  '  }',
  '  function isAdmin(address account) external view returns (bool) {',
  '    return _roles[DEFAULT_ADMIN_ROLE].members[account];',
  '  }',
  '  function grantMinter(address account) external {',
  '    require(_roles[DEFAULT_ADMIN_ROLE].members[msg.sender], "minting needs the default admin role");',
  '    _roles[MINTER].members[account] = true;',
  '  }',
  '  function grantZero(address account) external {',
  '    require(_roles[DEFAULT_ADMIN_ROLE].members[msg.sender], "zero needs the default admin role");',
  '    _roles[bytes32(0)].members[account] = true;',
  '  }',
  '  function grantFirst(address account) external {',
  '    require(_roles[DEFAULT_ADMIN_ROLE].members[msg.sender], "first needs the default admin role");',
  '    _roles[bytes32(uint256(1))].members[account] = true;',
  '  }',
  '}',
  'contract Halves {',
  '  address public implementation;',
  '  mapping(uint256 => bool) used;',
  '  mapping(uint256 => uint256) counts;',
  '  function initialize() public {}',
  '  function count(uint256 id) external { require(!used[id / 2], "used"); counts[id] = 1; }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { solidityImportCompat: true, composition: 'per-call' } as never);
const roles = artifacts.Roles!;
const vault = artifacts.Vault!;
const halves = artifacts.Halves!;

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
/** The deployer, granted the default admin role by `initialize`. */
const ADMIN = signer(alicePkh, alicePriv);
const BOB = signer(bobPkh, bobPriv);
const CAROL = signer(carolPkh, carolPriv);

const DEFAULT_ADMIN_ROLE = new Uint8Array(32);
const MINTER = keccak_256(utf8ToBin('MINTER'));
/** `bytes32(uint256(1))`: under Solidity compatibility the number is widened big-endian, as the EVM's is. */
const FIRST = Uint8Array.from([...new Uint8Array(31), 1]);
const ROLE = new Uint8Array(32).fill(0x01);
const OTHER_ROLE = new Uint8Array(32).fill(0x02);

/** Where a member node of `role` and `account` sits in the members list, which is ordered by slot. */
const memberAt = (role: Uint8Array, account: Uint8Array): bigint => bytesToSlotValue(keyToSlotMulti([role, account]));
/** The admin's own member node, which every frame of an admin check reads. */
const ADMIN_NODE = memberAt(DEFAULT_ADMIN_ROLE, ADMIN.lock);
/** The first of a fixed list of accounts whose `role` member node sits below the admin's, so the head precedes it. */
const accountBelowAdmin = (role: Uint8Array): Uint8Array => Array.from({ length: 32 }, (_unused, index) =>
  encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(index + 1)))
  .find((lock) => memberAt(role, lock) < ADMIN_NODE)!;

/** One deployment behind its generated proxy. */
interface Deployed { readonly proxy: string; readonly implementation: string }

/** Both deployments, each initialized by the admin, and the chain as it stood then. */
interface World {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
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
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  await fundShippedFacets(network);
  const deployments = new Map<Artifact, Deployed>();
  for (const artifact of [roles, vault, halves]) {
    const name = artifact.contractName;
    const deployment = await deployPerCallProxy({
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
      initialize: { functionName: 'initialize', args: artifact === halves ? [] : [ADMIN.lock] },
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
  return { network, changeAddress: wallet.address, deployments, snapshot: await network.takeSnapshot() };
}

let worldRun: Promise<World> | undefined;

/** One pair of deployments serves every case, each rewinding the chain to them first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** One call through a deployment's proxy, from a fresh coin of the caller's. */
async function enter(
  world: World, artifact: Artifact, functionName: string, args: readonly FunctionArgument[], caller: Caller,
): Promise<{ readonly coin: Utxo; readonly call: Promise<PerCallProxyCallResult> }> {
  const target = world.deployments.get(artifact)!;
  const coin = await coinAt(world.network, binToHex(caller.lock), functionName);
  const call = callPerCallProxyEntry({
    provider: world.network,
    implementationArtifact: artifact,
    proxyArtifact: buildProxyArtifact(artifact),
    proxyCategoryId: target.proxy,
    implementationCategoryId: target.implementation,
    functionName,
    args: [...args],
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
  world: World, artifact: Artifact, functionName: string, args: readonly FunctionArgument[], caller: Caller,
): Promise<void> {
  const result = await (await enter(world, artifact, functionName, args, caller)).call;
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

/** Every outpoint a deployment's category holds. */
async function outpoints(world: World, artifact: Artifact): Promise<readonly string[]> {
  return (await world.network.getUtxosByTokenCategory(world.deployments.get(artifact)!.proxy))
    .map((utxo) => `${utxo.txid}:${utxo.vout}`).sort();
}

/** Enters a call the body's own check refuses, and checks the caller's coin and the deployment are untouched. */
async function expectRefused(
  world: World, artifact: Artifact, functionName: string, args: readonly FunctionArgument[], caller: Caller,
  check: string,
): Promise<void> {
  const before = await outpoints(world, artifact);
  const entry = await enter(world, artifact, functionName, args, caller);
  const error = await entry.call.then(() => undefined, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(PerCallProxyDeployError);
  expect((error as Error).message).toBe(`the implementation's "${functionName}" entry did not settle through the `
    + `proxy: frame "implementation-master" of ${artifact.contractName}.${functionName}() at line `
    + `${lineOf(`"${check}"`, `function ${functionName}(`)}: ${check} (Program failed an OP_VERIFY operation.)`);
  expect((await world.network.getUtxosForLockingBytecode(caller.lock))
    .some((utxo) => utxo.txid === entry.coin.txid && utxo.vout === entry.coin.vout)).toBe(true);
  expect(await outpoints(world, artifact)).toStrictEqual(before);
}

/** A view's value, read from the proxy's records through the read path. */
async function view(
  world: World, artifact: Artifact, functionName: string, args: readonly FunctionArgument[],
): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: world.network, artifact, categoryId: world.deployments.get(artifact)!.proxy, functionName, args,
  });
  expect(read.accepted).toBe(true);
  return read.value;
}

/** The label the artifact publishes for key `index` of the members write `entry` makes. */
function memberKeyLabel(artifact: Artifact, entry: string, index: number): string | undefined {
  const access = artifact.abi.find((candidate) => candidate.name === entry)?.entryAccesses
    ?.find((candidate) => candidate.collection === '_roles__members' && candidate.operations.includes('write'));
  return access?.keySources?.[index]?.expressionLabel ?? access?.keyParams[index];
}

describe('access-control roles keyed by constants and checked against a stored admin role', () => {
  it('publishes constant and cast keys as the bytes the body hashes, and refuses no entry', () => {
    const zero = `lit:0x${'00'.repeat(32)}`;
    expect(roles.composition?.refusedEntries ?? []).toStrictEqual([]);
    expect(vault.composition?.refusedEntries ?? []).toStrictEqual([]);
    // `_grantRole(DEFAULT_ADMIN_ROLE, admin)` binds the constant to the helper's parameter, which is followed to it.
    expect(memberKeyLabel(roles, 'initialize', 0)).toBe(zero);
    expect(memberKeyLabel(vault, 'initialize', 0)).toBe(zero);
    expect(memberKeyLabel(vault, 'grantZero', 0)).toBe(zero);
    expect(memberKeyLabel(vault, 'grantMinter', 0)).toBe(`lit:0x${binToHex(MINTER)}`);
    expect(memberKeyLabel(vault, 'grantFirst', 0)).toBe(`lit:0x${binToHex(FIRST)}`);
    // The admin check's key is the admin role the body reads out of the role's own admin node.
    const check = roles.abi.find((candidate) => candidate.name === 'grantRole')?.entryAccesses
      ?.find((candidate) => candidate.operations.every((operation) => operation === 'read')
        && candidate.collection === '_roles__members');
    expect(check?.keySources?.map((source) => source.expressionLabel))
      .toStrictEqual(['map:_roles__adminRole(id:role)', 'nullop:msg.sender']);
  });

  it('places every insert after a node its own frame does not read', () => {
    // ADMIN's grant of ROLE to BOB splices after the head, below the admin's node his check reads.
    expect(memberAt(ROLE, BOB.lock)).toBeLessThan(ADMIN_NODE);
    // CAROL's absent admin node is bracketed by the admin's node, not by the head her refused grant splices after.
    expect(memberAt(DEFAULT_ADMIN_ROLE, CAROL.lock)).toBeGreaterThan(ADMIN_NODE);
    // BOB's grant of OTHER_ROLE splices after the admin's node, above his own node his check reads.
    expect(memberAt(OTHER_ROLE, CAROL.lock)).toBeGreaterThan(ADMIN_NODE);
    // ADMIN's refused grant of OTHER_ROLE splices after the head; his absent ROLE node is bracketed above it.
    expect(memberAt(OTHER_ROLE, ADMIN.lock)).toBeLessThan(memberAt(ROLE, BOB.lock));
    expect(memberAt(ROLE, ADMIN.lock)).toBeGreaterThan(ADMIN_NODE);
    // BOB's absent admin node is bracketed by the admin's node, not by the nodes his refused writes rewrite.
    expect(memberAt(DEFAULT_ADMIN_ROLE, BOB.lock)).toBeGreaterThan(ADMIN_NODE);
  });

  it('grants the default admin role at initialization, keyed by the constant', async () => {
    const world = await deployed();
    expect(await view(world, roles, 'hasRole', [DEFAULT_ADMIN_ROLE, ADMIN.lock])).toBe(true);
    expect(await view(world, roles, 'hasRole', [DEFAULT_ADMIN_ROLE, BOB.lock])).toBe(false);
    expect(await view(world, vault, 'isAdmin', [ADMIN.lock])).toBe(true);
    expect(await view(world, vault, 'isAdmin', [BOB.lock])).toBe(false);
  }, 600_000);

  it('grants and revokes a role whose admin role is the default one, its admin node being absent', async () => {
    const world = await deployed();
    expect(await view(world, roles, 'getRoleAdmin', [ROLE])).toStrictEqual(DEFAULT_ADMIN_ROLE);

    await settle(world, roles, 'grantRole', [ROLE, BOB.lock], ADMIN);
    expect(await view(world, roles, 'hasRole', [ROLE, BOB.lock])).toBe(true);
    expect(await view(world, roles, 'hasRole', [ROLE, CAROL.lock])).toBe(false);

    await settle(world, roles, 'revokeRole', [ROLE, BOB.lock], ADMIN);
    expect(await view(world, roles, 'hasRole', [ROLE, BOB.lock])).toBe(false);
    expect(await view(world, roles, 'hasRole', [DEFAULT_ADMIN_ROLE, ADMIN.lock])).toBe(true);
  }, 600_000);

  it('refuses a caller without the role\'s admin role by the body\'s own check', async () => {
    const world = await deployed();
    // CAROL's own default-admin node is absent, so her frame reads the node that brackets it and the body refuses.
    await expectRefused(world, roles, 'grantRole', [ROLE, BOB.lock], CAROL, 'grant needs the admin role');
    expect(await view(world, roles, 'hasRole', [ROLE, BOB.lock])).toBe(false);
    await settle(world, roles, 'grantRole', [ROLE, BOB.lock], ADMIN);
    await expectRefused(world, roles, 'revokeRole', [ROLE, BOB.lock], CAROL, 'revoke needs the admin role');
    expect(await view(world, roles, 'hasRole', [ROLE, BOB.lock])).toBe(true);
  }, 600_000);

  it('checks a role against the admin role its own admin node holds', async () => {
    const world = await deployed();
    await settle(world, roles, 'setRoleAdmin', [OTHER_ROLE, ROLE], ADMIN);
    expect(await view(world, roles, 'getRoleAdmin', [OTHER_ROLE])).toStrictEqual(ROLE);
    await settle(world, roles, 'grantRole', [ROLE, BOB.lock], ADMIN);

    // BOB holds ROLE, the admin role OTHER_ROLE's node holds, so he grants it.
    await settle(world, roles, 'grantRole', [OTHER_ROLE, CAROL.lock], BOB);
    expect(await view(world, roles, 'hasRole', [OTHER_ROLE, CAROL.lock])).toBe(true);
    // ADMIN holds the default admin role but not ROLE, which the check reads out of OTHER_ROLE's node.
    await expectRefused(world, roles, 'grantRole', [OTHER_ROLE, ADMIN.lock], ADMIN, 'grant needs the admin role');
    expect(await view(world, roles, 'hasRole', [OTHER_ROLE, ADMIN.lock])).toBe(false);
    // Only the default admin role sets an admin role.
    await expectRefused(world, roles, 'setRoleAdmin', [ROLE, OTHER_ROLE], BOB, 'needs the default admin role');
    expect(await view(world, roles, 'getRoleAdmin', [ROLE])).toStrictEqual(DEFAULT_ADMIN_ROLE);
  }, 600_000);

  it('grants roles keyed by the literals bytes32(0) and bytes32(uint256(1)), and by a keccak256 constant', async () => {
    const world = await deployed();
    const zeroed = accountBelowAdmin(DEFAULT_ADMIN_ROLE);
    const minter = accountBelowAdmin(MINTER);
    const first = accountBelowAdmin(FIRST);

    // `bytes32(0)` is the default admin role's own key: the account it grants reads as an admin through the
    // constant.
    await settle(world, vault, 'grantZero', [zeroed], ADMIN);
    expect(await view(world, vault, 'isAdmin', [zeroed])).toBe(true);
    expect(await view(world, vault, 'hasRole', [DEFAULT_ADMIN_ROLE, zeroed])).toBe(true);
    // Each key is the role a caller names by its bytes.
    await settle(world, vault, 'grantMinter', [minter], ADMIN);
    expect(await view(world, vault, 'hasRole', [MINTER, minter])).toBe(true);
    await settle(world, vault, 'grantFirst', [first], ADMIN);
    expect(await view(world, vault, 'hasRole', [FIRST, first])).toBe(true);
    expect(await view(world, vault, 'hasRole', [MINTER, first])).toBe(false);
    expect(await view(world, vault, 'isAdmin', [minter])).toBe(false);

    // A caller the default admin role does not hold is refused by the body's own check.
    await expectRefused(world, vault, 'grantZero', [zeroed], BOB, 'zero needs the default admin role');
    await expectRefused(world, vault, 'grantMinter', [minter], BOB, 'minting needs the default admin role');
  }, 600_000);
});

describe('a read beside a batch whose key the hop cannot resolve', () => {
  it('is refused by the read\'s own reason', async () => {
    const world = await deployed();
    const before = await outpoints(world, halves);
    const entry = await enter(world, halves, 'count', [7n], ADMIN);
    const error = await entry.call.then(() => undefined, (caught: unknown) => caught);
    // The read's key divides an argument, which the hop's key evaluator does not; the refusal names that read rather
    // than leaving the batch planner to report the read as undeclared.
    expect(error).toBeInstanceOf(PerCallProxyDeployError);
    expect((error as Error).message).toBe('the implementation\'s "count" entry reads a mapping node this hop cannot '
      + 'declare: entry "count" touches mapping "used" at a key the frame\'s arguments do not determine '
      + '(binop:/(id:id,lit:2))');
    expect(await outpoints(world, halves)).toStrictEqual(before);
  }, 600_000);
});
