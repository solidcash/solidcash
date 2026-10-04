import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { alicePkh, bobPkh, carolPkh } from '../../fixture/vars.js';
import {
  USER_LOCK, compilePerCall, deployProxied, enterProxied, newWorld, refusedVerdicts,
  type ProxiedDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * An enumerable member set, the shape of OpenZeppelin's `EnumerableSet`: an array of the members and a mapping of
 * each member's position in it, one-based so that zero means absent. `add` pushes the member and records the length
 * the push produced as its position; `contains`, `at` and `length` read the mapping and the array. It underlies
 * AccessControlEnumerable, ERC721Enumerable and many allowlist and staking sets.
 *
 * Both forms settle behind the generated proxy: the set as the contract's own state (a dynamic array beside a
 * mapping, one sorted batch beside one dynamic run) and the same set per group id (an array per key beside a
 * two-key mapping, two sorted batches). Three members are added through the hop, each add a broadcast, and the
 * views read them back through the read path. Removing a member, which swaps the last one into its place and pops,
 * is still refused (`ahead/enumerable-set.test.ts`).
 */

const STATE_SET = [
  'pragma solidity ^0.8.20;',
  'contract MemberSet {',
  '  address public implementation;',
  '  address[] private _values;',
  '  mapping(address => uint256) private _positions;',
  '  function initialize() public {}',
  '  function contains(address value) public view returns (bool) { return _positions[value] != 0; }',
  '  function length() external view returns (uint256) { return _values.length; }',
  '  function at(uint256 index) external view returns (address) { return _values[index]; }',
  '  function add(address value) external {',
  '    require(!contains(value), "member");',
  '    _values.push(value);',
  '    _positions[value] = _values.length;',
  '  }',
  '  function remove(address value) external {',
  '    uint256 position = _positions[value];',
  '    require(position != 0, "not a member");',
  '    uint256 valueIndex = position - 1;',
  '    uint256 lastIndex = _values.length - 1;',
  '    if (valueIndex != lastIndex) {',
  '      address lastValue = _values[lastIndex];',
  '      _values[valueIndex] = lastValue;',
  '      _positions[lastValue] = position;',
  '    }',
  '    _values.pop();',
  '    delete _positions[value];',
  '  }',
  '}',
].join('\n');

const GROUP_SETS = [
  'pragma solidity ^0.8.20;',
  'contract GroupSets {',
  '  address public implementation;',
  '  mapping(uint256 => address[]) private _values;',
  '  mapping(uint256 => mapping(address => uint256)) private _positions;',
  '  function initialize() public {}',
  '  function contains(uint256 group, address value) public view returns (bool) {',
  '    return _positions[group][value] != 0;',
  '  }',
  '  function length(uint256 group) external view returns (uint256) { return _values[group].length; }',
  '  function at(uint256 group, uint256 index) external view returns (address) { return _values[group][index]; }',
  '  function add(uint256 group, address value) external {',
  '    require(!contains(group, value), "member");',
  '    _values[group].push(value);',
  '    _positions[group][value] = _values[group].length;',
  '  }',
  '  function remove(uint256 group, address value) external {',
  '    uint256 position = _positions[group][value];',
  '    require(position != 0, "not a member");',
  '    uint256 valueIndex = position - 1;',
  '    uint256 lastIndex = _values[group].length - 1;',
  '    if (valueIndex != lastIndex) {',
  '      address lastValue = _values[group][lastIndex];',
  '      _values[group][valueIndex] = lastValue;',
  '      _positions[group][lastValue] = position;',
  '    }',
  '    _values[group].pop();',
  '    delete _positions[group][value];',
  '  }',
  '}',
].join('\n');

const BOB = encodeLockingBytecodeP2pkh(bobPkh);
const CAROL = encodeLockingBytecodeP2pkh(carolPkh);

/** One call through the hop; it has to settle and broadcast. */
async function settle(
  world: World, root: ProxiedDeployment, fn: string, args: readonly FunctionArgument[],
): Promise<void> {
  const outcome = await enterProxied(world, root, fn, args);
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinSpent).toBe(true);
}

/** A view's value, read from the proxy's records through the read path. */
async function view(
  world: World, root: ProxiedDeployment, fn: string, args: readonly FunctionArgument[],
): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: world.network, artifact: root.artifact, categoryId: root.proxyCategoryId, functionName: fn,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

describe('an enumerable member set behind the generated proxy', () => {
  it('adds three members to the set the contract holds, and reads them back', async () => {
    const world = await newWorld(0x61);
    const set = await deployProxied(world, compilePerCall(STATE_SET).MemberSet!, []);
    for (const member of [USER_LOCK, BOB, CAROL]) await settle(world, set, 'add', [member]);
    expect(await view(world, set, 'length', [])).toBe(3n);
    expect(binToHex(await view(world, set, 'at', [0n]) as Uint8Array)).toBe(binToHex(alicePkh));
    expect(await view(world, set, 'contains', [BOB])).toBe(true);
  }, 600_000);

  it('adds three members to one group\'s set, and reads them back', async () => {
    const world = await newWorld(0x62);
    const sets = await deployProxied(world, compilePerCall(GROUP_SETS).GroupSets!, []);
    for (const member of [USER_LOCK, BOB, CAROL]) await settle(world, sets, 'add', [1n, member]);
    expect(await view(world, sets, 'length', [1n])).toBe(3n);
    expect(binToHex(await view(world, sets, 'at', [1n, 0n]) as Uint8Array)).toBe(binToHex(alicePkh));
    expect(await view(world, sets, 'contains', [1n, BOB])).toBe(true);
  }, 600_000);
});
