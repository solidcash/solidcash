import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A deploy-then-call whose callee cannot complete - its body ends in a `revert` on every path - has no genesis to
// fold, and the reverted call leaves nothing on chain in EVM either. The statement lowers to that same failure
// instead of refusing (`test/libsolidity/semanticTests/errors/small_error_optimization.sol` is this shape: a callee
// that pushes into a state array in a loop and then reverts). The code generator records every failure it emits
// against its own source line in `debug.requires`, so the closed behaviour is asserted on that shipped signal
// rather than on an opcode pattern the optimiser may rewrite.
describe('deploy-time callee that cannot complete', () => {
  const OPTS = { evmCompat: true };

  const deployer = (callee: string): string => 'contract A {\n'
    + callee
    + '}\n'
    + 'contract B {\n'
    + '    function f() public {\n'
    + '        (new A()).f();\n'
    + '    }\n'
    + '}';

  // The source line the deploy-then-call sits on, so the assertion names an exact line rather than a range.
  const callLine = (source: string): number =>
    source.split('\n').findIndex((line) => line.includes('(new A()).f();')) + 1;

  const failingLines = (artifact: { debug?: { requires?: readonly { line: number }[] } }): number[] =>
    (artifact.debug?.requires ?? []).map((entry) => entry.line);

  it('lowers the deploy-then-call to the failure it can only be', () => {
    const source = deployer(
      '    uint8[] x;\n'
      + '    function f() public {\n'
      + '        for (uint i = 0; i < 100; ++i) x.push(uint8(i));\n'
      + '        revert();\n'
      + '    }\n',
    );
    const artifact = compileString(source, OPTS);
    expect(artifact.contractName).toBe('B');
    expect(failingLines(artifact)).toContain(callLine(source));
  });

  it('lowers an unconditional require(false) the same way', () => {
    const source = deployer('    uint v;\n    function f() public { v = 1; require(false); }\n');
    const artifact = compileString(source, OPTS);
    expect(failingLines(artifact)).toContain(callLine(source));
  });

  it('does not record a failure when the same call folds normally', () => {
    // The control for the assertion above: a foldable callee is deployed through the genesis, so nothing fails
    // at the call's line.
    const source = deployer('    uint v;\n    function f() public { v = 1; }\n');
    const artifact = compileString(source, OPTS);
    expect(failingLines(artifact)).not.toContain(callLine(source));
  });

  it('still refuses a callee whose revert is only on one path', () => {
    // `if (a > 0) revert(); v = a;` completes for a == 0, so it is a fold problem, not a guaranteed failure.
    expect(() => compileString('contract A {\n'
      + '    uint v;\n'
      + '    function f(uint a) public { if (a > 0) { revert(); } v = a; }\n'
      + '}\n'
      + 'contract B { function f() public { (new A()).f(1); } }', OPTS,
    )).toThrow(/DeployThenCallError|co-spend/);
  });

  it('still refuses a callee that can return before its trailing revert', () => {
    expect(() => compileString('contract A {\n'
      + '    uint v;\n'
      + '    function f(uint a) public { if (a > 0) { return; } v = a; revert(); }\n'
      + '}\n'
      + 'contract B { function f() public { (new A()).f(1); } }', OPTS,
    )).toThrow(/DeployThenCallError|co-spend/);
  });
});
