import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { keyToSlotValue } from '../../../src/stateful/SortedList.js';
import { PerCallProxyDeployError } from '../../../src/per-call/proxy/index.js';
import {
  USER_LOCK, compilePerCall, deployProxied, enterProxied, newWorld, refusedVerdicts, type ProxiedDeployment,
  type World,
} from './composition-world.js';

/**
 * Walls ahead: an entry that checks the caller's own entry of a mapping and inserts another key into the same
 * mapping, the hand-written allowlist / admin-set pattern (`require(members[msg.sender]); members[account] = true`).
 * The read is a kept node; the insert spends the new key's bracketing predecessor. When the caller's own node IS
 * that predecessor, the hop refuses: one transaction cannot spend the node it also declares as a read
 * (`proxy/deploy.ts`, `entryWritesFor`). Whether a given insert meets it depends only on where the new key's slot
 * falls, so the replica picks one key below the caller's slot (its predecessor is the head: the control settles)
 * and one above it (its predecessor is the caller's node). This is a read-beside-insert variant of the two-reads-
 * on-one-bracketing-node wall. The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Club {',
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
].join('\n');

/** Two P2PKH locks whose slots fall below and above the caller's: the first such of a fixed candidate list. */
function locksAroundCaller(): { readonly below: Uint8Array; readonly above: Uint8Array } {
  const caller = keyToSlotValue(USER_LOCK);
  const candidates = Array.from({ length: 32 }, (_unused, index) =>
    encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(index + 1)));
  const below = candidates.find((lock) => keyToSlotValue(lock) < caller)!;
  const above = candidates.find((lock) => keyToSlotValue(lock) > caller)!;
  return { below, above };
}

interface Chain { readonly world: World; readonly club: ProxiedDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x56);
    const club = await deployProxied(world, compilePerCall(SOURCE).Club!, [USER_LOCK]);
    return { world, club };
  })();
  return chainRun;
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a read of the caller\'s node beside an insert', () => {
  it('settles an insert whose predecessor is the head (control)', async () => {
    const { world, club } = await chain();
    const outcome = await enterProxied(world, club, 'add', [locksAroundCaller().below]);
    expect(outcome.error).toBeUndefined();
    expect(refusedVerdicts(outcome.result!)).toBeUndefined();
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 600_000);

  it('refuses an insert whose predecessor is the caller\'s own node (should settle once served)', async () => {
    const { world, club } = await chain();
    const outcome = await enterProxied(world, club, 'add', [locksAroundCaller().above]);
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toBe('the implementation\'s "add" entry reads mapping "members" at a node its '
      + 'batch also spends, which one transaction cannot spend twice');
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);
});
