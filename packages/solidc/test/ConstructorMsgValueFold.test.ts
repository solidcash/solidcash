import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// `test/libsolidity/semanticTests/arithmetics/check_var_init.sol`: a state initializer derived from the
// constructor's `msg.value`, read back through a getter on the freshly deployed child. Folding it needs the
// child's `msg.value` = the value the deploy funds it with (`new C{value: v}` in EVM). The corpus harness
// compiles with `evmCompat: true`, which is the mode whose `(new C()).x()` form reaches the deploy-result path.
describe('constructor msg.value fold', () => {
  const OPTS = { evmCompat: true };

  const source = (value: number): string => 'contract C {\n'
    + '    uint public x = msg.value - 10;\n'
    + '    constructor() payable {}\n'
    + '}\n'
    + 'contract D {\n'
    + `    function g() public payable returns (uint) { return (new C{value: ${value}}()).x(); }\n`
    + '}';

  it('compiles a getter read of a constructor-owned msg.value initializer', () => {
    const artifact = compileString(source(11), OPTS);
    expect(artifact.contractName).toBe('D');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('folds the deploying value into the genesis, so a different value is different bytecode', () => {
    // If `msg.value` were ignored (the previous behaviour: the constructor fold failed and the getter read was
    // refused, or a default was folded), the two deploys would emit identical bytecode.
    const eleven = compileString(source(11), OPTS);
    const twelve = compileString(source(12), OPTS);
    expect(eleven.bytecode).not.toBe(twelve.bytecode);
    expect(eleven.bytecode).not.toBe(''); // the fold must not silently produce an empty script
  });

  it('still gates a value on a non-payable constructor', () => {
    expect(() => compileString(
      'contract C { constructor() {} }\n'
      + 'contract D { function g() public payable { new C{value: 1}(); } }', OPTS,
    )).toThrow(/payable/);
  });
});
