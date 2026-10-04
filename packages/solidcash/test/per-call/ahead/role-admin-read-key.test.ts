import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import {
  USER_LOCK, compilePerCall, deployProxied, enterProxied, newWorld, recordMet, refusedVerdicts,
  type Outcome, type ProxiedDeployment, type World,
} from './composition-world.js';
import type { PerCallProxyCallResult } from '../../../src/per-call/proxy/index.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../../src/stateful/SortedList.js';

/**
 * Walls ahead: role-based access in the shape of an EVM access-control library, past the role keys
 * `call/role-admin-read-key` serves (a constant or `bytes32(0)` key, and a check against the admin role the body
 * reads out of storage), and past the library's current helpers, which return whether they changed the role and
 * emit (`_grantRole(...) internal returns (bool)`), served in `call/role-helpers-return-and-emit`.
 *
 * With void helpers the grants, revocations and renunciations settle, but a role write on a branch the body does
 * not take (revoking it again, renouncing it again) does not: the hop plans every write the entry's accesses
 * publish (`proxy/entry-writes.ts`, `planHopMappingBatches`), and an access does not say its write is guarded, so
 * the frame that skips the write is refused by the machine.
 *
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

/** The access-control body, with void helpers. */
function source(): string {
  const helper = (name: string, guard: string, value: string, event: string): string[] => [
    `  function ${name}(bytes32 role, address account) internal {`,
    `    if (${guard}hasRole(role, account)) {`,
    `      _roles[role].members[account] = ${value};`,
    `      emit ${event}(role, account, msg.sender);`,
    '    }',
    '  }',
  ];
  return [
    'pragma solidity ^0.8.20;',
    'contract Guarded {',
    '  struct RoleData { mapping(address => bool) members; bytes32 adminRole; }',
    '  bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;',
    '  address public implementation;',
    '  mapping(bytes32 => RoleData) private _roles;',
    '  error UnauthorizedAccount(address account, bytes32 neededRole);',
    '  error BadConfirmation();',
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
    '  function revokeRole(bytes32 role, address account) public onlyRole(getRoleAdmin(role)) {',
    '    _revokeRole(role, account);',
    '  }',
    '  function renounceRole(bytes32 role, address callerConfirmation) public {',
    '    if (callerConfirmation != msg.sender) { revert BadConfirmation(); }',
    '    _revokeRole(role, callerConfirmation);',
    '  }',
    ...helper('_grantRole', '!', 'true', 'RoleGranted'),
    ...helper('_revokeRole', '', 'false', 'RoleRevoked'),
    '}',
  ].join('\n');
}

const ROLE = new Uint8Array(32).fill(0x01);
const OTHER_ROLE = new Uint8Array(32).fill(0x02);
const memberAt = (role: Uint8Array, account: Uint8Array): bigint => bytesToSlotValue(keyToSlotMulti([role, account]));
/** An account whose ROLE member node sits below the deployer's admin node, so a grant to it splices after the head. */
const GRANTEE = Array.from({ length: 32 }, (_unused, index) =>
  encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(index + 1)))
  .find((lock) => memberAt(ROLE, lock) < memberAt(new Uint8Array(32), USER_LOCK))!;

interface Chain { readonly world: World; readonly guarded: ProxiedDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x5d);
    const guarded = await deployProxied(world, compilePerCall(source()).Guarded!, [USER_LOCK]);
    return { world, guarded };
  })();
  return chainRun;
}

/** What a hop met, as one line: its error, its refused verdicts, or its broadcast. */
function metOf(outcome: Outcome<PerCallProxyCallResult>): string | undefined {
  return outcome.error?.message ?? (outcome.result === undefined ? undefined
    : refusedVerdicts(outcome.result) ?? `accepted broadcast=${outcome.result.broadcast?.txid ?? 'none'}`);
}

/** The hop's words for a frame of `entry` the machine refused without a source message. */
const unsettled = (entry: string): RegExp => new RegExp(`^the implementation's "${entry}" entry did not settle `
  + `through the proxy: frame "implementation-master" of Guarded\\.${entry}\\(\\) at line \\d+: no source message `
  + '\\(Program failed an OP_VERIFY operation\\.\\)$');

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: access-control role helpers and guarded role writes', () => {
  it('grants, revokes and renounces a role whose write the body makes (control)', async () => {
    const { world, guarded } = await chain();
    for (const [entry, args] of [
      ['grantRole', [ROLE, GRANTEE]], ['revokeRole', [ROLE, GRANTEE]],
      ['grantRole', [OTHER_ROLE, USER_LOCK]], ['renounceRole', [OTHER_ROLE, USER_LOCK]],
    ] as const) {
      const outcome = await enterProxied(world, guarded, entry, [...args]);
      expect(metOf(outcome)).toMatch(/^accepted broadcast=[0-9a-f]{64}$/);
    }
  }, 600_000);

  it('does not settle a role write on a branch the body does not take (should settle once served)', async () => {
    const { world, guarded } = await chain();
    for (const [entry, args] of [['revokeRole', [ROLE, GRANTEE]], ['renounceRole', [OTHER_ROLE, USER_LOCK]]] as const) {
      const outcome = await enterProxied(world, guarded, entry, [...args]);
      recordMet(`role-admin-read-key/${entry}-not-held`, metOf(outcome));
      expect(outcome.result?.broadcast).toBeUndefined();
      expect(outcome.error?.message).toMatch(unsettled(entry));
      expect(outcome.coinSpent).toBe(false);
    }
  }, 600_000);
});
