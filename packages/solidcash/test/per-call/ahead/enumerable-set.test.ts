import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bobPkh } from '../../fixture/vars.js';
import {
  USER_LOCK, compilePerCall, deployProxied, enterProxied, newWorld, refusedVerdicts,
} from './composition-world.js';

/**
 * Walls ahead: removing a member of an enumerable set, the swap and pop of OpenZeppelin's `EnumerableSet`. The
 * member's position (one-based, zero for absent) names its index; the last member is moved into that index and its
 * position rewritten, the array is popped and the removed member's position deleted:
 * `values[i] = last; positions[last] = i + 1; values.pop(); delete positions[v];`. Adding members and reading them
 * back settle in both forms (`call/enumerable-set.test.ts`); removal is refused.
 *
 * The first wall is the compiler's: a write followed by a `delete` of another key of the same mapping is the direct
 * convention's swap-remove alias (`SymbolTableTraversal.detectAliasConditionalWrites`), which gates the write off
 * where the two keys meet at run time, and a per-call master derives no batch with such a target
 * (`assessPerCallMasterShape` -> `unsupportedBatchWriteShape`). The removal is refused at compile in both forms, so
 * the hop refuses it before anything is signed.
 *
 * Past it, the two forms part: with the `delete` ahead of the write, which no alias marks, the set held as the
 * contract's state is refused at its key, the array's last element, which lives in the frame's chunk run rather
 * than where the master derives a target slot; the set per group id compiles, its key read out of the node its own
 * batch writes. What the hop then meets is the plan in `docs/per-call/WALLS_BEYOND_LADDER.md` (2.11).
 *
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

/** The removal as OpenZeppelin writes it: the moved member's position, then the removed one's delete. */
const SWAP_AND_POP = (values: string, position: (key: string) => string): string => [
  `    uint256 position = ${position('value')};`,
  '    require(position != 0, "not a member");',
  '    uint256 valueIndex = position - 1;',
  `    uint256 lastIndex = ${values}.length - 1;`,
  '    if (valueIndex != lastIndex) {',
  `      address lastValue = ${values}[lastIndex];`,
  `      ${values}[valueIndex] = lastValue;`,
  `      ${position('lastValue')} = position;`,
  '    }',
  `    ${values}.pop();`,
  `    delete ${position('value')};`,
].join('\n');

/** The same removal with the `delete` ahead of the moved member's write, which no alias marks. */
const DELETE_FIRST = (values: string, position: (key: string) => string): string => [
  `    uint256 position = ${position('value')};`,
  '    require(position != 0, "not a member");',
  '    uint256 valueIndex = position - 1;',
  `    uint256 lastIndex = ${values}.length - 1;`,
  `    delete ${position('value')};`,
  '    if (valueIndex != lastIndex) {',
  `      address lastValue = ${values}[lastIndex];`,
  `      ${values}[valueIndex] = lastValue;`,
  `      ${position('lastValue')} = position;`,
  '    }',
  `    ${values}.pop();`,
].join('\n');

type Removal = typeof SWAP_AND_POP;

/** The set as the contract's own state: a dynamic array of members beside a mapping of positions. */
const STATE_SET = (removal: Removal): string => [
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
  removal('_values', (key) => `_positions[${key}]`),
  '  }',
  '}',
].join('\n');

/** The same set per group id: an array of members per key beside a two-key mapping of positions. */
const GROUP_SETS = (removal: Removal): string => [
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
  removal('_values[group]', (key) => `_positions[group][${key}]`),
  '  }',
  '}',
].join('\n');

const BOB = encodeLockingBytecodeP2pkh(bobPkh);

/** The compiler's refusal of a removal whose moved member's write a `delete` of another key follows. */
const aliasRefusal = (slot: number): string => `the body writes a mapping at slot ${slot} that can alias another `
  + 'target at run time, so its record is not fixed';

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: removing a member of an enumerable set', () => {
  it('through the hop: refuses to remove a member of the contract\'s set (should swap the last one in and settle '
    + 'once served)', async () => {
    const world = await newWorld(0x63);
    const set = await deployProxied(world, compilePerCall(STATE_SET(SWAP_AND_POP)).MemberSet!, []);
    for (const member of [USER_LOCK, BOB]) {
      const added = await enterProxied(world, set, 'add', [member]);
      expect(added.error).toBeUndefined();
      expect(refusedVerdicts(added.result!)).toBeUndefined();
    }
    const removed = await enterProxied(world, set, 'remove', [USER_LOCK]);
    expect(removed.error?.message).toBe('the implementation\'s "remove" entry is refused by the compiler '
      + `(MemberSet.remove()): ${aliasRefusal(1)}`);
    expect(removed.coinSpent).toBe(false);
  }, 600_000);

  it('through the hop: refuses to remove a member of one group\'s set (should swap the last one in and settle '
    + 'once served)', async () => {
    const world = await newWorld(0x64);
    const sets = await deployProxied(world, compilePerCall(GROUP_SETS(SWAP_AND_POP)).GroupSets!, []);
    for (const member of [USER_LOCK, BOB]) {
      const added = await enterProxied(world, sets, 'add', [1n, member]);
      expect(added.error).toBeUndefined();
      expect(refusedVerdicts(added.result!)).toBeUndefined();
    }
    const removed = await enterProxied(world, sets, 'remove', [1n, USER_LOCK]);
    expect(removed.error?.message).toBe('the implementation\'s "remove" entry is refused by the compiler '
      + `(GroupSets.remove()): ${aliasRefusal(2)}`);
    expect(removed.coinSpent).toBe(false);
  }, 600_000);

  it('past the alias: refuses the contract\'s set the key it reads out of its own array (should derive the last '
    + 'member once served)', () => {
    expect(compilePerCall(STATE_SET(DELETE_FIRST)).MemberSet!.composition?.refusedEntries).toStrictEqual([{
      functionName: 'MemberSet.remove()',
      reason: 'the body writes a mapping at slot 1 whose key 0 \'map:_values(binop:-(unop:.length(state:_values),'
        + 'lit:1))\' reads the state value \'_values\', and a master derives a target slot only from a bare '
        + 'parameter, the frame\'s sender, a value of its own record, or a compile-time value the body holds at its '
        + 'start',
    }]);
  }, 300_000);

  it('past the alias: compiles the group form, whose key reads the node its own batch writes', () => {
    expect(compilePerCall(GROUP_SETS(DELETE_FIRST)).GroupSets!.composition?.refusedEntries ?? []).toStrictEqual([]);
  }, 300_000);
});
