import { describe, it, expect } from 'vitest';
import { compileStringMulti, DeployedChildCallError } from '@solidcash/solidc';

// A function that creates a stateful child and returns one of its public getters (`(new Child()).stored()`) calls the
// child in the transaction that deploys it, which a deployer `new` cannot bind, so the compile refuses it. Shapes of
// the solc semantic tests smoke/alignment.sol, functionCall/creation_function_call_no_args.sol and
// freeFunctions/new_operator.sol, compiled the way the corpus runner compiles them (packages/solidc/docs/deferrals.md,
// "Shapes only the message bus compiled").
const OPTIONS = { evmCompat: true, enforceFinalRequire: false, forceStateful: true };
const REFUSAL = 'a call on the child returned by `new Child` cannot be bound at its creation';

const CHECK = 'function check(uint256 expected) public { require(make() == expected); }';

const SHAPES: Array<[string, string]> = [
  ['a state initializer', `contract Child { uint256 public stored = 0x20; }
contract Parent {
    function make() public returns (uint256) { return (new Child()).stored(); }
    ${CHECK}
}`],
  ['a constructor write', `contract Child {
    uint public stored;
    constructor() { stored = 2; }
}
contract Parent {
    function make() public returns (uint r) { return new Child().stored(); }
    ${CHECK}
}`],
  ['a free function', `contract Child { uint public stored = 2; }
function build() returns (uint) { return (new Child()).stored(); }
contract Parent {
    function make() public returns (uint) { return build(); }
    ${CHECK}
}`],
];

describe('deploy-then-getter on a fresh child', () => {
  it.each(SHAPES)('refuses the getter of a child set by %s', (_, source) => {
    // Only the removed message bus compiled it, folding the getter into the deploy.
    expect(() => compileStringMulti(source, OPTIONS)).toThrow(expect.objectContaining({
      name: DeployedChildCallError.name, message: expect.stringContaining(REFUSAL),
    }));
  });
});
