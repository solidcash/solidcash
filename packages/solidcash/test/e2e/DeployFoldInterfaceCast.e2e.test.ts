import { describe, it, expect } from 'vitest';
import { compileStringMulti, DeployedChildCallError } from '@solidcash/solidc';

// A call through an interface cast on a fresh deploy (`I(address(new Child())).m()`) calls the child in the
// transaction that deploys it, which a deployer `new` cannot bind, so the compile refuses it whatever the interface
// declares its mutability to be (packages/solidc/docs/deferrals.md, "Shapes only the message bus compiled").
const OPTIONS = { evmCompat: true, enforceFinalRequire: false, forceStateful: true };
const REFUSAL = 'a call on the child returned by `new Counter` cannot be bound at its creation';

const CHILD = `contract Counter {
    uint256 count = 5;
    function bump() public returns (uint256) {
        count = count + 1;
        return count;
    }
    function peek() public view returns (uint256) {
        return count;
    }
}
interface ICounter {
    function bump() external returns (uint256);
}
interface ICounterView {
    function bump() external view returns (uint256);
    function peek() external view returns (uint256);
}`;

const parentCalling = (call: string): string => `${CHILD}
contract Maker {
    function make() public returns (uint256) { return ${call}; }
    function check(uint256 expected) public { require(make() == expected); }
}`;

const BUMP = parentCalling('ICounter(address(new Counter())).bump()');
const BUMP_THROUGH_VIEW = parentCalling('ICounterView(address(new Counter())).bump()');
const PEEK_THROUGH_VIEW = parentCalling('ICounterView(address(new Counter())).peek()');

describe('deploy fold through an interface cast on a fresh deploy', () => {
  it.each([
    ['a state-writing call on the child', BUMP],
    ['a state-writing body called through a view declaration', BUMP_THROUGH_VIEW],
    ['a read-only body called through a view declaration', PEEK_THROUGH_VIEW],
  ])('refuses %s', (_, source) => {
    // Only the removed message bus compiled it, folding the call into the child's genesis.
    expect(() => compileStringMulti(source, OPTIONS)).toThrow(expect.objectContaining({
      name: DeployedChildCallError.name, message: expect.stringContaining(REFUSAL),
    }));
  });
});
