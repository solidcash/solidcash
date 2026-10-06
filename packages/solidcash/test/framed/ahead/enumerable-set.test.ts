import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bobPkh } from '../../fixture/vars.js';
import {
  USER_LOCK, compileFramed, deployProxied, enterProxied, newWorld, refusedVerdicts,
} from './composition-world.js';

/**
 * Walls ahead: removing a member of an enumerable set held as the contract's own state, the swap and pop of
 * OpenZeppelin's `EnumerableSet`. The member's position (one-based, zero for absent) names its index; the last member
 * is moved into that index and its position rewritten, the array is popped and the removed member's position
 * deleted: `values[i] = last; positions[last] = i + 1; values.pop(); delete positions[v];`. Adding members and
 * reading them back settle in both forms, and so does removal from the set per group id
 * (`call/enumerable-set.test.ts`): a framed master admits the swap-remove pair, the moved member's write a target
 * its frame declares skipped where its key meets the delete's.
 *
 * The state form's removal is refused at its key, the array's last element, which lives in the frame's chunk run
 * rather than where the master derives a target slot, whichever order the write and the `delete` come in. The set
 * per group id, whose key is read out of the node its own batch writes, settles through the shipped proxy in
 * `call/enumerable-set.test.ts`. The remaining wall is in `docs/framed/WALLS_BEYOND_LADDER.md` (2.11).
 *
 * The file runs only under `FRAMED_AHEAD=1`.
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

const BOB = encodeLockingBytecodeP2pkh(bobPkh);

/** The compiler's refusal of the state form's removal, at the key it reads out of its own array. */
const keyRefusal = (slot: number): string => `the body writes a mapping at slot ${slot} whose key 0 `
  + '\'map:_values(binop:-(unop:.length(state:_values),lit:1))\' reads the state value \'_values\', and a master '
  + 'derives a target slot only from a bare parameter, the frame\'s sender, a value of its own record, or a '
  + 'compile-time value the body holds at its start';

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead: removing a member of an enumerable set', () => {
  it('through the hop: refuses to remove a member of the contract\'s set at its key (should derive the last member '
    + 'out of the chunk run and settle once served)', async () => {
    const world = await newWorld(0x63);
    const artifact = compileFramed(STATE_SET(SWAP_AND_POP)).MemberSet!;
    const reason = artifact.composition?.refusedEntries?.find((entry) => entry.functionName === 'MemberSet.remove()')
      ?.reason;
    expect(reason).toMatch(/^the body writes a mapping at slot \d+ whose key 0 /);
    expect(reason).toBe(keyRefusal(Number(/slot (\d+)/.exec(reason!)![1])));
    const set = await deployProxied(world, artifact, []);
    for (const member of [USER_LOCK, BOB]) {
      const added = await enterProxied(world, set, 'add', [member]);
      expect(added.error).toBeUndefined();
      expect(refusedVerdicts(added.result!)).toBeUndefined();
    }
    const removed = await enterProxied(world, set, 'remove', [USER_LOCK]);
    expect(removed.error?.message).toBe('the implementation\'s "remove" entry is refused by the compiler '
      + `(MemberSet.remove()): ${reason}`);
    expect(removed.coinSpent).toBe(false);
  }, 600_000);

  it('with the delete first: refuses the contract\'s set the key it reads out of its own array (should derive the '
    + 'last member once served)', () => {
    expect(compileFramed(STATE_SET(DELETE_FIRST)).MemberSet!.composition?.refusedEntries).toStrictEqual([{
      functionName: 'MemberSet.remove()',
      reason: 'the body writes a mapping at slot 1 whose key 0 \'map:_values(binop:-(unop:.length(state:_values),'
        + 'lit:1))\' reads the state value \'_values\', and a master derives a target slot only from a bare '
        + 'parameter, the frame\'s sender, a value of its own record, or a compile-time value the body holds at its '
        + 'start',
    }]);
  }, 300_000);
});
