import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A deploy-time call is folded into the child's genesis by REPLAYING its body (`foldPureGenesisHelperCall`).
// Three callee shapes were previously out of reach: a `public` function named by a bare call (an internal call
// in Solidity - only `this.f(..)` dispatches), a function value the caller bound to one of its own functions
// (`new D(this.sixteen)` against the child's `x = g()`), and a non-pure callee returning a dynamic array
// (`arrays_in_constructors.sol` / `bytes_in_constructors_packer.sol`, whose base-constructor argument calls the
// child's own `f(s)`). The replay itself is the guard, so each shape is pinned WITH its fail-closed control: a
// body the replay cannot reproduce must still refuse the folded call rather than fold a wrong value.
//
// The corpus harness compiles with `evmCompat: true`, which is the mode whose `d.x()` form reaches the
// deploy-result-local path pinned here.
describe('deploy-time callee replay', () => {
  const OPTS = { evmCompat: true };

  const childWithCtor = (ctor: string, helper: string, extra = ''): string =>
    `contract D { uint public x; ${extra}constructor() { ${ctor} } ${helper} }\n`
    + 'contract C { function f() public returns (uint) { D d = new D(); return d.x(); } }';

  const FN_VALUE_DEPLOY = 'contract D { uint public x; '
    + 'constructor(function() external pure returns (uint) g) { x = g(); } }\n';

  it('replays a public helper called by its bare name from the constructor', () => {
    const artifact = compileString(childWithCtor(
      'x = helper();', 'function helper() public pure returns (uint) { return 7; }',
    ), OPTS);
    expect(artifact.contractName).toBe('C');
  });

  it('replays a function value the caller bound to its own function', () => {
    const artifact = compileString(FN_VALUE_DEPLOY
      + 'contract C {\n'
      + '    function f() public returns (uint) { D d = new D(this.sixteen); return d.x(); }\n'
      + '    function sixteen() public pure returns (uint) { return 16; }\n'
      + '}', OPTS);
    expect(artifact.contractName).toBe('C');
  });

  it('replays a base-constructor argument that calls the child function returning the array', () => {
    const artifact = compileString(
      'contract Base {\n'
      + '    uint public m_x;\n'
      + '    address[] m_s;\n'
      + '    constructor(uint x, address[] memory s) { m_x = x; m_s = s; }\n'
      + '}\n'
      + 'contract Main is Base {\n'
      + '    constructor(address[] memory s, uint x) Base(x, f(s)) {}\n'
      + '    function f(address[] memory s) public returns (address[] memory) { return s; }\n'
      + '}\n'
      + 'contract Creator {\n'
      + '    function f(uint x, address[] memory s) public returns (uint r) {\n'
      + '        Main c = new Main(s, x);\n'
      + '        r = c.m_x();\n'
      + '    }\n'
      + '}', OPTS);
    expect(artifact.contractName).toBe('Creator');
  });

  it('still refuses when the replayed body reads contract state', () => {
    // A state read must not become a type default: the replay keeps refusing it, so the folded call refuses.
    expect(() => compileString(childWithCtor(
      'x = helper();', 'function helper() public returns (uint) { return y; }', 'uint y; ',
    ), OPTS)).toThrow(/DeployThenCallError|co-spend/);
  });

  it('still refuses when the replayed body has a loop', () => {
    expect(() => compileString(childWithCtor(
      'x = helper();',
      'function helper() public pure returns (uint) { uint t = 0; for (uint i = 0; i < 3; i++) { t = t + 1; } return t; }',
    ), OPTS)).toThrow(/DeployThenCallError|co-spend/);
  });

  it('still refuses a function value bound to a body the replay cannot reproduce', () => {
    expect(() => compileString(FN_VALUE_DEPLOY
      + 'contract C {\n'
      + '    function f() public returns (uint) { D d = new D(this.loop); return d.x(); }\n'
      + '    function loop() public pure returns (uint) { uint t = 0; for (uint i = 0; i < 3; i++) { t = t + 1; } return t; }\n'
      + '}', OPTS)).toThrow(/DeployThenCallError|co-spend/);
  });
});
