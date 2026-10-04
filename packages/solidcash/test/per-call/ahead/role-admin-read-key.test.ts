import { describe, expect, it } from 'vitest';
import {
  USER_LOCK, compilePerCall, deployProxied, enterProxied, newWorld, recordMet, refusedVerdicts,
  type ArtifactMap, type Outcome, type ProxiedDeployment, type World,
} from './composition-world.js';
import type { PerCallProxyCallResult } from '../../../src/per-call/proxy/index.js';

/**
 * Walls ahead: role-based access in the shape of OpenZeppelin `AccessControl`: a role's members live in a mapping
 * inside a struct inside a mapping, roles are `bytes32` constants (`DEFAULT_ADMIN_ROLE = 0x00`,
 * `MINTER = keccak256("MINTER")`), and `grantRole` checks the caller against the role's ADMIN role, a value it first
 * reads out of the same mapping (`hasRole(getRoleAdmin(role), msg.sender)`).
 *
 * - A member write keyed by a role the caller passes settles, at genesis and after it (controls).
 * - A write keyed by a contract constant (`DEFAULT_ADMIN_ROLE`, `MINTER`) is refused by the compiler: a key that is a
 *   bare identifier is followed only to a local's declaration (`support.ts`, `resolveBatchKey` ->
 *   `resolveKeyIdentifier`), so the constant check in `keyOperandUnavailable` is never reached for it.
 * - A write keyed by the literal `bytes32(0)` compiles and fails in the frame: the hop's key evaluator reads
 *   `cast:bytes32(lit:0)` as the script number 0, the empty string (`stateful/route-expression-key.ts`,
 *   `evalComputedKey`), while the body hashes 32 zero bytes, so the planned slot is not the body's.
 * - `grantRole`: the admin check's key is a stored value the hop's read planner cannot resolve;
 *   `calleeReadNodesOrNone` then drops every read node of the entry, and the batch planner refuses the read it finds
 *   undeclared (`proxy/entry-writes.ts`, `planHopMappingBatches`).
 *
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Guarded {',
  '  struct RoleData { mapping(address => bool) members; bytes32 adminRole; }',
  '  bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;',
  '  bytes32 public constant MINTER = keccak256("MINTER");',
  '  address public implementation;',
  '  address public owner;',
  '  uint256 public grants;',
  '  mapping(bytes32 => RoleData) private _roles;',
  '  function initialize(address admin, bytes32 adminRole) public {',
  '    owner = admin;',
  '    _roles[adminRole].members[admin] = true;',
  '  }',
  '  function hasRole(bytes32 role, address account) public view returns (bool) {',
  '    return _roles[role].members[account];',
  '  }',
  '  function getRoleAdmin(bytes32 role) public view returns (bytes32) { return _roles[role].adminRole; }',
  '  function grantByOwner(bytes32 role, address account) external {',
  '    require(msg.sender == owner, "not owner");',
  '    _roles[role].members[account] = true;',
  '    grants += 1;',
  '  }',
  '  function grantDefaultAdmin(address account) external {',
  '    require(msg.sender == owner, "not owner");',
  '    _roles[DEFAULT_ADMIN_ROLE].members[account] = true;',
  '    grants += 1;',
  '  }',
  '  function grantMinter(address account) external {',
  '    require(msg.sender == owner, "not owner");',
  '    _roles[MINTER].members[account] = true;',
  '    grants += 1;',
  '  }',
  '  function grantZero(address account) external {',
  '    require(msg.sender == owner, "not owner");',
  '    _roles[bytes32(0)].members[account] = true;',
  '    grants += 1;',
  '  }',
  '  function grantRole(bytes32 role, address account) external {',
  '    require(hasRole(getRoleAdmin(role), msg.sender), "missing role");',
  '    _roles[role].members[account] = true;',
  '    grants += 1;',
  '  }',
  '}',
].join('\n');

const ADMIN_ROLE = new Uint8Array(32).fill(0x0a);
const ROLE = new Uint8Array(32).fill(0x11);
const member = (fill: number): Uint8Array =>
  new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(fill), 0x88, 0xac]);

let compiled: ArtifactMap | undefined;
function artifacts(): ArtifactMap {
  if (compiled === undefined) {
    try {
      compiled = compilePerCall(SOURCE);
    } catch (error) {
      recordMet('role-admin-read-key/compile', (error as Error).message);
      throw error;
    }
  }
  return compiled;
}

interface Chain { readonly world: World; readonly guarded: ProxiedDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x5a);
    const guarded = await deployProxied(world, artifacts().Guarded!, [USER_LOCK, ADMIN_ROLE]);
    return { world, guarded };
  })();
  return chainRun;
}

/** What a hop met, as one line: its error, its refused verdicts, or its broadcast. */
function metOf(outcome: Outcome<PerCallProxyCallResult>): string | undefined {
  return outcome.error?.message ?? (outcome.result === undefined ? undefined
    : refusedVerdicts(outcome.result) ?? `accepted broadcast=${outcome.result.broadcast?.txid ?? 'none'}`);
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: AccessControl-shaped role writes and checks', () => {
  it('grants under an owner check, keyed by a role the caller passes (control)', async () => {
    const { world, guarded } = await chain();
    const outcome = await enterProxied(world, guarded, 'grantByOwner', [ROLE, member(0x33)]);
    recordMet('role-admin-read-key/grantByOwner', metOf(outcome));
    expect(outcome.error).toBeUndefined();
    expect(refusedVerdicts(outcome.result!)).toBeUndefined();
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 600_000);

  it('refuses writes keyed by a contract constant at compile time (should settle once served)', async () => {
    const { world, guarded } = await chain();
    const constantKey = (entry: string, name: string): { functionName: string; reason: string } => ({
      functionName: `Guarded.${entry}()`,
      reason: `the body writes a mapping at slot 0 whose key 0 'id:${name}' is the local '${name}', which is not `
        + 'bound to a single compile-time value',
    });
    expect(guarded.artifact.composition?.refusedEntries ?? []).toStrictEqual([
      constantKey('grantDefaultAdmin', 'DEFAULT_ADMIN_ROLE'), constantKey('grantMinter', 'MINTER'),
    ]);
    const outcome = await enterProxied(world, guarded, 'grantDefaultAdmin', [member(0x34)]);
    expect(outcome.error?.message).toBe('the implementation\'s "grantDefaultAdmin" entry is refused by the compiler '
      + `(Guarded.grantDefaultAdmin()): ${constantKey('grantDefaultAdmin', 'DEFAULT_ADMIN_ROLE').reason}`);
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);

  it('does not settle a write keyed by the literal bytes32(0) (should settle once served)', async () => {
    const { world, guarded } = await chain();
    const outcome = await enterProxied(world, guarded, 'grantZero', [member(0x35)]);
    recordMet('role-admin-read-key/grantZero', metOf(outcome));
    expect(outcome.result?.broadcast).toBeUndefined();
    expect(outcome.error?.message).toMatch(new RegExp('^the implementation\'s "grantZero" entry did not settle through '
      + 'the proxy: frame "implementation-master" of Guarded\\.grantZero\\(\\) at line \\d+: no source message '
      + '\\(Program failed an OP_VERIFY operation\\.\\)'));
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);

  it('refuses grantRole, whose admin check reads a key it read from storage (should settle once served)', async () => {
    const { world, guarded } = await chain();
    const outcome = await enterProxied(world, guarded, 'grantRole', [ROLE, member(0x36)]);
    recordMet('role-admin-read-key/grantRole', metOf(outcome));
    expect(outcome.result?.broadcast).toBeUndefined();
    expect(outcome.error?.message).toMatch(new RegExp('^the implementation\'s "grantRole" entry reads mapping "[^"]+" '
      + 'beside the batch it writes, which this hop does not declare$'));
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);
});
