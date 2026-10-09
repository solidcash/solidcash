import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  bytesEqual, bytesToHex, concatBytes, encodeEventCommitment, encodeWitnessBlock, sha256, splitFirstPush,
  validatorAddress, type Artifact, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine, compositionProvider } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { ConstructorArgument, FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { tryParseEventCommitment } from '../../../src/stateful/StateReader.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { deriveFramedGenesis, eventLockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * An event emitted on a branch the body skips.
 *
 * A framed frame lists one output per emit its body holds, and the body closes each one against what it computed:
 * the payload of an emit it reaches, the empty commitment of one it skips. The compiler publishes the condition an
 * emit a branch guards runs under (`abi[].emits[].activation`), in the language a guarded write's condition uses, and
 * a builder decides it from the frame's facts, as it decides the write: a skipped emit's output carries the empty
 * commitment, and no log is read back from it. An emit whose condition those facts do not decide starts from a
 * sentinel, and the frame's own close says which it was.
 *
 * - A role contract in the shape of an EVM access-control library, behind a generated proxy and as a plain
 *   deployment: a grant, a revocation and a renunciation each emit where the role changes and skip where it does not.
 * - A callee whose guarded write emits, reached from a gateway, plain and behind proxies.
 * - Two emits after the body's own write, which no frame fact decides, learned from the frame's own stops.
 * - A constructor that emits on an argument, learned by its genesis either way.
 *
 * The master refuses a reached emit listed with the empty commitment, a skipped one listed with a payload, a wrong
 * payload, and a skipped emit left unlisted.
 */

const OPTIONS = { evmCompat: true, composition: 'framed' } as never;

/** The role whose holders may grant and revoke `role`: its admin role, or the default admin role. */
const adminOf = (constructor: boolean): string => (constructor ? 'DEFAULT_ADMIN_ROLE' : 'getRoleAdmin(role)');

/**
 * Role-based access in the shape of an EVM access-control library, with helpers that emit where the role changes. The
 * plain deployment checks the caller against the default admin role, since the plain call path does not resolve a key
 * the body reads out of another mapping (the hop does: `call/role-admin-read-key`).
 */
const ROLES = (constructor: boolean): string => [
  'pragma solidity ^0.8.20;',
  'contract Roles {',
  '  struct RoleData { mapping(address => bool) members; bytes32 adminRole; }',
  '  bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;',
  ...(constructor ? [] : ['  address public implementation;']),
  '  mapping(bytes32 => RoleData) private _roles;',
  '  error UnauthorizedAccount(address account, bytes32 neededRole);',
  '  error BadConfirmation();',
  '  event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);',
  '  event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);',
  '  modifier onlyRole(bytes32 role) {',
  '    if (!hasRole(role, msg.sender)) { revert UnauthorizedAccount(msg.sender, role); }',
  '    _;',
  '  }',
  constructor
    ? '  constructor(address admin) { _roles[DEFAULT_ADMIN_ROLE].members[admin] = true; }'
    : '  function initialize(address admin) public { _grantRole(DEFAULT_ADMIN_ROLE, admin); }',
  '  function hasRole(bytes32 role, address account) public view returns (bool) {',
  '    return _roles[role].members[account];',
  '  }',
  '  function getRoleAdmin(bytes32 role) public view returns (bytes32) { return _roles[role].adminRole; }',
  `  function grantRole(bytes32 role, address account) public onlyRole(${adminOf(constructor)}) {`,
  '    _grantRole(role, account);',
  '  }',
  `  function revokeRole(bytes32 role, address account) public onlyRole(${adminOf(constructor)}) {`,
  '    _revokeRole(role, account);',
  '  }',
  '  function renounceRole(bytes32 role, address callerConfirmation) public {',
  '    if (callerConfirmation != msg.sender) { revert BadConfirmation(); }',
  '    _revokeRole(role, callerConfirmation);',
  '  }',
  '  function _grantRole(bytes32 role, address account) internal {',
  '    if (!hasRole(role, account)) {',
  '      _roles[role].members[account] = true;',
  '      emit RoleGranted(role, account, msg.sender);',
  '    }',
  '  }',
  '  function _revokeRole(bytes32 role, address account) internal {',
  '    if (hasRole(role, account)) {',
  '      _roles[role].members[account] = false;',
  '      emit RoleRevoked(role, account, msg.sender);',
  '    }',
  '  }',
  '}',
].join('\n');

/** A counter whose emits read the count the body has just written, which no fact the frame starts with decides. */
const COUNTER = (constructor: boolean): string => [
  'pragma solidity ^0.8.20;',
  'contract Counter {',
  ...(constructor ? [] : ['  address public implementation;']),
  '  uint256 public bumps;',
  '  event Reached(uint256 count);',
  '  event Even();',
  constructor ? '  constructor() { bumps = 0; }' : '  function initialize() public { bumps = 0; }',
  '  function bump() external {',
  '    bumps += 1;',
  '    if (bumps > 2) { emit Reached(bumps); }',
  '    if (bumps % 2 == 0) { emit Even(); }',
  '  }',
  '}',
].join('\n');

const ADMIN = encodeLockingBytecodeP2pkh(alicePkh);
const ADMIN_FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();
const ROLE = new Uint8Array(32).fill(0x01);
const OTHER_ROLE = new Uint8Array(32).fill(0x02);
const memberAt = (role: Uint8Array, account: Uint8Array): bigint => bytesToSlotValue(keyToSlotMulti([role, account]));
/** An account whose ROLE member node sits below the admin's node, so a grant to it splices after the head. */
const GRANTEE = Array.from({ length: 32 }, (_unused, index) =>
  encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(index + 1)))
  .find((lock) => memberAt(ROLE, lock) < memberAt(new Uint8Array(32), ADMIN))!;

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`guarded event ${label}`)));
}

type Entered = FramedProxyCallResult | FramedCallResult;

/** One deployment, entered through its proxy or as a plain contract, and the chain as it stood once deployed. */
interface World {
  readonly network: MockNetworkProvider;
  readonly artifact: Artifact;
  /** The category its records sit at, which its events are emitted under: the proxy's, or its own. */
  readonly records: string;
  /** The master whose frame lists the entry's events. */
  readonly frame: string;
  readonly enter: (functionName: string, args: readonly FunctionArgument[]) => Promise<Entered>;
  readonly snapshot: SnapshotRestorer;
}

let coins = 0;

async function coinAt(network: MockNetworkProvider, lock: string, label: string): Promise<Utxo> {
  coins += 1;
  const coin = { txid: idOf(`${label} ${coins}`), vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(lock, coin);
  return coin;
}

/** A chain with a funded wallet and the shipped validator facets. */
async function newChain(): Promise<{
  readonly network: MockNetworkProvider;
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly changeAddress: string;
}> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  await fundShippedFacets(network);
  return {
    network, funder: wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv)), changeAddress: wallet.address,
  };
}

/** Deploys `artifact` behind a generated proxy, initialized with `args`, and enters it through the hop. */
async function deployBehindProxy(artifact: Artifact, args: readonly FunctionArgument[]): Promise<World> {
  const { network, funder, changeAddress } = await newChain();
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: artifact,
    proxyArtifact: buildProxyArtifact(artifact),
    implementationDeploy: { fundingUtxo: await coinAt(network, changeAddress, 'implementation'), funder, changeAddress },
    proxyDeploy: { fundingUtxo: await coinAt(network, changeAddress, 'proxy'), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [...args] },
    callerLockingBytecode: ADMIN,
    callerFunding: { utxo: await coinAt(network, binToHex(ADMIN), 'initialize'), funder: ADMIN_FUNDER, changeAddress },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  const enter = async (functionName: string, entryArgs: readonly FunctionArgument[]): Promise<Entered> =>
    callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName,
      args: [...entryArgs],
      callerUtxo: await coinAt(network, binToHex(ADMIN), functionName),
      callerLockingBytecode: ADMIN,
      funder: ADMIN_FUNDER,
      changeAddress,
      vm: compositionMachine(),
    });
  return {
    network, artifact, records: deployment.proxy.categoryId, frame: 'implementation-master', enter,
    snapshot: await network.takeSnapshot(),
  };
}

/** Deploys `artifact` as a plain contract with `args` and enters it through the plain call path. */
async function deployPlainly(artifact: Artifact, args: readonly ConstructorArgument[]): Promise<World> {
  const { network, funder, changeAddress } = await newChain();
  const deployment = await deployStatefulContract(artifact, [...args], {
    provider: network, fundingUtxo: await coinAt(network, changeAddress, 'genesis'), funder, changeAddress,
  });
  const enter = async (functionName: string, entryArgs: readonly FunctionArgument[]): Promise<Entered> =>
    callFramedEntry({
      provider: network,
      artifact,
      categoryId: deployment.categoryId,
      functionName,
      args: [...entryArgs],
      callerUtxo: await coinAt(network, binToHex(ADMIN), functionName),
      callerLockingBytecode: ADMIN,
      funder: ADMIN_FUNDER,
      vm: compositionMachine(),
    });
  return {
    network, artifact, records: deployment.categoryId, frame: 'master', enter, snapshot: await network.takeSnapshot(),
  };
}

const worlds = new Map<string, Promise<World>>();
/** One deployment per shape and path serves its cases, each rewinding the chain to it first. */
async function world(key: string, deploy: () => Promise<World>): Promise<World> {
  if (!worlds.has(key)) worlds.set(key, deploy());
  const shared = await worlds.get(key)!;
  await shared.snapshot.restore();
  return shared;
}

/** Enters a call and requires it to settle: every participant accepted and the transaction broadcast. */
async function settle(shared: World, functionName: string, args: readonly FunctionArgument[]): Promise<Entered> {
  const result = await shared.enter(functionName, args);
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** A view's value, read from a deployment's records through the read path. */
async function view(
  network: MockNetworkProvider, artifact: Artifact, records: string, functionName: string,
  args: readonly FunctionArgument[] = [],
): Promise<unknown> {
  const read = await readFramedEntry({ provider: network, artifact, categoryId: records, functionName, args });
  expect(read.accepted).toBe(true);
  return read.value;
}

/** A decoded field, as a line reads it: bytes in hex, numbers and booleans as written. */
const shown = (value: unknown): string => (value instanceof Uint8Array ? bytesToHex(value) : String(value));

/**
 * The event outputs every frame of a broadcast lists, in output order, read back from the broadcast's own outputs:
 * `Name(fields)` for a reached emit and `Name skipped` for the empty commitment a skipped one lists. Each is matched
 * to its declared event by the covenant its token's category and the event's signature rebuild.
 */
function eventsRead(result: Entered, artifacts: readonly Artifact[]): readonly string[] {
  const outputs = result.broadcast!.outputs;
  return result.draft.layout.participants.filter((placed) => placed.kind === 'master')
    .flatMap((placed) => result.draft.blockOf(placed.id).events)
    .sort((left, right) => left - right)
    .map((index) => {
      const output = outputs[index]!;
      const token = output.token!;
      expect(token.nft?.capability).toBe('none');
      const commitment = token.nft!.commitment;
      for (const artifact of artifacts) {
        for (const event of artifact.events ?? []) {
          const lock = eventLockingBytecode(token.category, event.signature, event.anonymous === true);
          if (!bytesEqual(lock, output.lockingBytecode)) continue;
          if (commitment.length === 0) return `${event.name} skipped`;
          // A zero-parameter event carries the one marker byte a reached emit writes, and no field.
          if (event.parameters.length === 0) return commitment.length === 1 ? `${event.name}()` : 'malformed';
          const fields = tryParseEventCommitment(binToHex(commitment), event, artifact.structs);
          expect(fields).not.toBeNull();
          return `${event.name}(${event.parameters.map((parameter) => shown(fields![parameter.name])).join(', ')})`;
        }
      }
      return `unknown output ${index}`;
    });
}

/** The logs the shipped receipt reads back from a plain broadcast, as `Name(fields)`. */
function logsRead(result: Entered, artifacts: readonly Artifact[]): readonly string[] {
  return compositionEventLogs(result.draft, artifacts, { outputs: result.broadcast!.outputs })
    .map((log) => `${log.eventName}(${log.values.map(shown).join(', ')})`);
}

type Transaction = Entered['transaction'];

/** The verdict of the frame that lists the entry's events on a spend: undefined when it accepts, its error else. */
function frameVerdict(shared: World, result: Entered, transaction: Transaction): string | undefined {
  const frame = result.verdicts.find((verdict) => verdict.id === shared.frame)!;
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: frame.index, sourceOutputs: result.sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? undefined : String((state as { readonly error?: unknown }).error);
}

/** The settled spend with the frame's `position`-th listed event output carrying `commitment` instead. */
function withEventCommitment(shared: World, result: Entered, position: number, commitment: Uint8Array): Transaction {
  const index = result.draft.blockOf(shared.frame).events[position]!;
  return {
    ...result.transaction,
    outputs: result.transaction.outputs.map((output, at) => (at === index
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } } }
      : output)),
  };
}

/** The settled spend with the frame's block listing its events without the `position`-th. */
function withoutListedEvent(shared: World, result: Entered, position: number): Transaction {
  const frame = result.verdicts.find((verdict) => verdict.id === shared.frame)!;
  const block = structuredClone(result.draft.blockOf(shared.frame)) as WitnessBlock;
  block.events = block.events.filter((_index, at) => at !== position);
  const { rest } = splitFirstPush(result.transaction.inputs[frame.index]!.unlockingBytecode);
  return {
    ...result.transaction,
    inputs: result.transaction.inputs.map((input, at) => (at === frame.index
      ? { ...input, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]) }
      : input)),
  };
}

const proxiedRoles = compileStringMulti(ROLES(false), OPTIONS).Roles!;
const plainRoles = compileStringMulti(ROLES(true), OPTIONS).Roles!;

describe('an event a role helper emits only where the role changes', () => {
  it('publishes the condition each emit a branch guards runs under, the write\'s own', () => {
    const emitOf = (entry: string): unknown => proxiedRoles.abi.find((row) => row.name === entry)?.emits?.[0]?.activation;
    const writeOf = (entry: string): unknown => proxiedRoles.abi.find((row) => row.name === entry)?.entryAccesses
      ?.find((access) => access.operations.includes('write'))?.activation;
    const member = {
      kind: 'stateAccess', name: '_roles__members', type: 'bool',
      args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
        { kind: 'source', source: { kind: 'forward', paramIndex: 1 } }],
    };
    expect(emitOf('grantRole')).toStrictEqual({ kind: 'unary', operator: '!', expression: member });
    expect(emitOf('revokeRole')).toStrictEqual(member);
    expect(emitOf('renounceRole')).toStrictEqual(member);
    for (const entry of ['grantRole', 'revokeRole', 'renounceRole']) expect(emitOf(entry)).toStrictEqual(writeOf(entry));
  });

  for (const behindProxy of [true, false]) {
    const path = behindProxy ? 'behind a generated proxy' : 'as a plain deployment';
    const deploy = (): Promise<World> => (behindProxy
      ? deployBehindProxy(proxiedRoles, [ADMIN]) : deployPlainly(plainRoles, [ADMIN]));
    const shared = (): Promise<World> => world(`roles ${path}`, deploy);
    const holds = async (on: World, role: Uint8Array, account: Uint8Array): Promise<unknown> =>
      view(on.network, on.artifact, on.records, 'hasRole', [role, account]);
    const granted = (role: Uint8Array, account: Uint8Array): string =>
      `RoleGranted(${bytesToHex(role)}, ${bytesToHex(account)}, ${bytesToHex(ADMIN)})`;
    const revoked = (role: Uint8Array, account: Uint8Array): string =>
      `RoleRevoked(${bytesToHex(role)}, ${bytesToHex(account)}, ${bytesToHex(ADMIN)})`;

    it(`grants a role once, and lists a second grant's event skipped, ${path}`, async () => {
      const on = await shared();
      const taken = await settle(on, 'grantRole', [ROLE, GRANTEE]);
      expect(eventsRead(taken, [on.artifact])).toStrictEqual([granted(ROLE, GRANTEE)]);
      const skipped = await settle(on, 'grantRole', [ROLE, GRANTEE]);
      expect(eventsRead(skipped, [on.artifact])).toStrictEqual(['RoleGranted skipped']);
      expect(await holds(on, ROLE, GRANTEE)).toBe(true);
      if (!behindProxy) {
        expect(logsRead(taken, [on.artifact])).toStrictEqual([granted(ROLE, GRANTEE)]);
        expect(logsRead(skipped, [on.artifact])).toStrictEqual([]);
      }
    }, 600_000);

    it(`revokes a held role and renounces one, and skips both where the role is not held, ${path}`, async () => {
      const on = await shared();
      await settle(on, 'grantRole', [ROLE, GRANTEE]);
      expect(eventsRead(await settle(on, 'revokeRole', [ROLE, GRANTEE]), [on.artifact]))
        .toStrictEqual([revoked(ROLE, GRANTEE)]);
      expect(eventsRead(await settle(on, 'revokeRole', [ROLE, GRANTEE]), [on.artifact]))
        .toStrictEqual(['RoleRevoked skipped']);
      expect(await holds(on, ROLE, GRANTEE)).toBe(false);
      // Renouncing a role the caller never held skips the write of an absent key and its event.
      expect(eventsRead(await settle(on, 'renounceRole', [OTHER_ROLE, ADMIN]), [on.artifact]))
        .toStrictEqual(['RoleRevoked skipped']);
      await settle(on, 'grantRole', [OTHER_ROLE, ADMIN]);
      const renounced = await settle(on, 'renounceRole', [OTHER_ROLE, ADMIN]);
      expect(eventsRead(renounced, [on.artifact])).toStrictEqual([revoked(OTHER_ROLE, ADMIN)]);
      expect(eventsRead(await settle(on, 'renounceRole', [OTHER_ROLE, ADMIN]), [on.artifact]))
        .toStrictEqual(['RoleRevoked skipped']);
      expect(await holds(on, OTHER_ROLE, ADMIN)).toBe(false);
      if (!behindProxy) expect(logsRead(renounced, [on.artifact])).toStrictEqual([revoked(OTHER_ROLE, ADMIN)]);
    }, 600_000);

    it(`refuses an event declared on the side the body does not take, or with a wrong payload, ${path}`, async () => {
      const on = await shared();
      const taken = await settle(on, 'grantRole', [ROLE, GRANTEE]);
      const skipped = await settle(on, 'grantRole', [ROLE, GRANTEE]);
      const definition = on.artifact.events!.find((event) => event.name === 'RoleGranted')!;
      const payload = (account: Uint8Array): Uint8Array =>
        encodeEventCommitment(definition.parameters, [ROLE, account, ADMIN]);
      // The settled spends, and the faithful payload restated, are accepted.
      expect(frameVerdict(on, taken, taken.transaction)).toBeUndefined();
      expect(frameVerdict(on, skipped, skipped.transaction)).toBeUndefined();
      expect(frameVerdict(on, taken, withEventCommitment(on, taken, 0, payload(GRANTEE)))).toBeUndefined();
      // An emit the body reaches, listed as skipped.
      expect(frameVerdict(on, taken, withEventCommitment(on, taken, 0, new Uint8Array(0)))).toBeDefined();
      // An emit the body skips, listed with the payload a grant carries.
      expect(frameVerdict(on, skipped, withEventCommitment(on, skipped, 0, payload(GRANTEE)))).toBeDefined();
      // A payload the body did not compute.
      expect(frameVerdict(on, taken, withEventCommitment(on, taken, 0, payload(ADMIN)))).toBeDefined();
      // A skipped emit's output left unlisted: the body pins every emit's position.
      expect(frameVerdict(on, skipped, withoutListedEvent(on, skipped, 0))).toBeDefined();
    }, 600_000);
  }
});

describe('emits whose condition reads the count the body has just written', () => {
  const proxiedCounter = compileStringMulti(COUNTER(false), OPTIONS).Counter!;
  const plainCounter = compileStringMulti(COUNTER(true), OPTIONS).Counter!;

  it('publishes them as conditions the frame\'s facts do not decide', () => {
    expect(proxiedCounter.abi.find((row) => row.name === 'bump')?.emits?.map((emit) => emit.activation))
      .toStrictEqual([{ kind: 'unsupported' }, { kind: 'unsupported' }]);
  });

  for (const behindProxy of [true, false]) {
    const path = behindProxy ? 'behind a generated proxy' : 'as a plain deployment';
    it(`learns each skip and each payload from the frame's own close, ${path}`, async () => {
      const on = await world(`counter ${path}`, () => (behindProxy
        ? deployBehindProxy(proxiedCounter, []) : deployPlainly(plainCounter, [])));
      const read: (readonly string[])[] = [];
      const logs: (readonly string[])[] = [];
      for (let turn = 0; turn < 4; turn += 1) {
        const result = await settle(on, 'bump', []);
        read.push(eventsRead(result, [on.artifact]));
        if (!behindProxy) logs.push(logsRead(result, [on.artifact]));
      }
      expect(read).toStrictEqual([
        ['Reached skipped', 'Even skipped'],
        ['Reached skipped', 'Even()'],
        ['Reached(3)', 'Even skipped'],
        ['Reached(4)', 'Even()'],
      ]);
      // A skipped zero-parameter event lists the empty commitment, which the receipt reads as no log.
      if (!behindProxy) expect(logs).toStrictEqual([[], ['Even()'], ['Reached(3)'], ['Reached(4)', 'Even()']]);
      expect(await view(on.network, on.artifact, on.records, 'bumps')).toBe(4n);
    }, 600_000);
  }
});

/** A registry whose guarded writes emit, and a gateway that reaches it. */
const REGISTRY_SOURCE = (plainGateway: boolean): string => [
  'pragma solidity ^0.8.20;',
  'interface IRegistry {',
  '  function join(address who) external;',
  '  function leave(address who) external;',
  '}',
  'contract Registry {',
  '  address public implementation;',
  '  uint256 public joined;',
  '  mapping(address => bool) private members;',
  '  event Joined(address who);',
  '  event Left(address who);',
  '  function initialize() public { joined = 0; }',
  '  function isMember(address who) public view returns (bool) { return members[who]; }',
  '  function join(address who) external {',
  '    if (!members[who]) { members[who] = true; joined += 1; emit Joined(who); }',
  '  }',
  '  function leave(address who) external {',
  '    if (members[who]) { members[who] = false; joined -= 1; emit Left(who); }',
  '  }',
  '}',
  'contract Gateway {',
  ...(plainGateway ? [] : ['  address public implementation;']),
  '  address public registry;',
  '  uint256 public calls;',
  plainGateway
    ? '  constructor(address registry_) { registry = registry_; }'
    : '  function initialize(address registry_) public { registry = registry_; }',
  '  function enroll(address who) external { IRegistry(registry).join(who); calls += 1; }',
  '  function retire(address who) external { IRegistry(registry).leave(who); calls += 1; }',
  '}',
].join('\n');

describe('a callee frame whose guarded write emits', () => {
  const proxiedUnit = compileStringMulti(REGISTRY_SOURCE(false), OPTIONS);
  const plainUnit = compileStringMulti(REGISTRY_SOURCE(true), OPTIONS);
  const REGISTRY = proxiedUnit.Registry!;
  const A = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x41));
  const B = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x42));

  /** A gateway and the registry it reaches, entered at the gateway. */
  async function deployPair(gatewayBehindProxy: boolean, registryBehindProxy: boolean): Promise<{
    readonly network: MockNetworkProvider;
    readonly registryRecords: string;
    readonly enter: (functionName: string, args: readonly FunctionArgument[]) => Promise<Entered>;
  }> {
    const { network, funder, changeAddress } = await newChain();
    const proxied = async (artifact: Artifact, args: readonly FunctionArgument[]): Promise<{
      readonly proxy: string; readonly implementation: string; readonly address: Uint8Array;
    }> => {
      const deployment = await deployFramedProxy({
        provider: network,
        implementationArtifact: artifact,
        proxyArtifact: buildProxyArtifact(artifact),
        implementationDeploy: {
          fundingUtxo: await coinAt(network, changeAddress, `${artifact.contractName} implementation`), funder,
          changeAddress,
        },
        proxyDeploy: {
          fundingUtxo: await coinAt(network, changeAddress, `${artifact.contractName} proxy`), funder, changeAddress,
        },
        initialize: { functionName: 'initialize', args: [...args] },
        callerLockingBytecode: ADMIN,
        callerFunding: {
          utxo: await coinAt(network, binToHex(ADMIN), `${artifact.contractName} initialize`), funder: ADMIN_FUNDER,
          changeAddress,
        },
        vm: compositionMachine(),
      });
      expect(deployment.initialize.broadcast).toBeDefined();
      return {
        proxy: deployment.proxy.categoryId, implementation: deployment.implementation.categoryId,
        address: deployment.proxy.address,
      };
    };
    let registry: FramedProxyExternal;
    let registryAddress: Uint8Array;
    if (registryBehindProxy) {
      const deployment = await proxied(REGISTRY, []);
      registry = {
        artifact: REGISTRY, categoryId: deployment.proxy, proxyArtifact: buildProxyArtifact(REGISTRY),
        implementationCategoryId: deployment.implementation,
      };
      registryAddress = deployment.address;
    } else {
      const deployment = await deployStatefulContract(REGISTRY, [], {
        provider: network, fundingUtxo: await coinAt(network, changeAddress, 'registry'), funder, changeAddress,
      });
      registry = { artifact: REGISTRY, categoryId: deployment.categoryId };
      registryAddress = validatorAddress(hexToBin(deployment.categoryId), VALIDATOR_PROGRAM);
    }
    const externals = { IRegistry: registry };
    if (gatewayBehindProxy) {
      const gateway = proxiedUnit.Gateway!;
      const deployment = await proxied(gateway, [registryAddress]);
      return {
        network,
        registryRecords: registry.categoryId,
        enter: async (functionName, args) => callFramedProxyEntry({
          provider: network,
          implementationArtifact: gateway,
          proxyArtifact: buildProxyArtifact(gateway),
          proxyCategoryId: deployment.proxy,
          implementationCategoryId: deployment.implementation,
          functionName,
          args: [...args],
          externals,
          callerUtxo: await coinAt(network, binToHex(ADMIN), functionName),
          callerLockingBytecode: ADMIN,
          funder: ADMIN_FUNDER,
          changeAddress,
          vm: compositionMachine(),
        }),
      };
    }
    const gateway = plainUnit.Gateway!;
    const deployment = await deployStatefulContract(gateway, [registryAddress], {
      provider: network, fundingUtxo: await coinAt(network, changeAddress, 'gateway'), funder, changeAddress,
    });
    return {
      network,
      registryRecords: registry.categoryId,
      enter: async (functionName, args) => callFramedEntry({
        provider: network,
        artifact: gateway,
        categoryId: deployment.categoryId,
        functionName,
        args: [...args],
        externals,
        callerUtxo: await coinAt(network, binToHex(ADMIN), functionName),
        callerLockingBytecode: ADMIN,
        funder: ADMIN_FUNDER,
        vm: compositionMachine(),
      }),
    };
  }

  for (const [gatewayBehindProxy, registryBehindProxy] of [[true, false], [true, true], [false, false]] as const) {
    const label = `${gatewayBehindProxy ? 'a proxied' : 'a plain'} gateway reaching `
      + `${registryBehindProxy ? 'a proxied' : 'a plain'} registry`;

    it(`lists the callee's event where its write runs and skipped where not, from ${label}`, async () => {
      const pair = await deployPair(gatewayBehindProxy, registryBehindProxy);
      const enter = async (functionName: string, who: Uint8Array): Promise<readonly string[]> => {
        const result = await pair.enter(functionName, [who]);
        expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
        expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
        return eventsRead(result, [REGISTRY]);
      };
      expect(await enter('enroll', A)).toStrictEqual([`Joined(${bytesToHex(A)})`]);
      expect(await enter('enroll', A)).toStrictEqual(['Joined skipped']);
      expect(await enter('retire', B)).toStrictEqual(['Left skipped']);
      expect(await enter('retire', A)).toStrictEqual([`Left(${bytesToHex(A)})`]);
      expect(await view(pair.network, REGISTRY, pair.registryRecords, 'joined')).toBe(0n);
    }, 600_000);
  }
});

describe('a constructor that emits on an argument', () => {
  const source = [
    'pragma solidity ^0.8.20;',
    'contract Launch {',
    '  uint256 public mode;',
    '  event Loud(uint256 mode);',
    '  constructor(uint256 m) { mode = m; if (m > 1) { emit Loud(m); } }',
    '  function check() external view returns (uint256) { return mode; }',
    '}',
  ].join('\n');
  const artifact = compileStringMulti(source, OPTIONS).Launch!;
  const category = sha256(utf8ToBin('guarded event constructor'));

  it('lists the payload where the constructor emits and the empty commitment where it does not', () => {
    const loud = artifact.events!.find((event) => event.name === 'Loud')!;
    const outcomes = [2n, 1n].map((mode) => {
      const genesis = deriveFramedGenesis({
        artifact, category, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
        constructorArgs: [mode], senderLockingBytecode: ADMIN,
      });
      const vm = compositionMachine();
      expect(vm.stateSuccess(vm.evaluate(genesis.program!))).toBe(true);
      return genesis.events.map((event) => bytesToHex(event.commitment));
    });
    expect(outcomes).toStrictEqual([[bytesToHex(encodeEventCommitment(loud.parameters, [2n]))], ['']]);
  });
});
