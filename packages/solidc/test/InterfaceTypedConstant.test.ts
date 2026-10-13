import { describe, it, expect } from 'vitest';
import { compileString as compileStringRaw } from '../src/index.js';

const nonEmpty = (source: string): void => {
  const artifact = compileStringRaw(source, { evmCompat: true, enforceFinalRequire: false });
  expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
};

// `test/libsolidity/syntaxTests/operators/userDefined/calling_operator_that_makes_pure_external_call.sol`: a
// FILE-LEVEL constant of interface type initialized with an interface cast, then used as an external-call
// receiver. File-level constants are resolved before the pass registers the file's interfaces, so the cast
// `IAdder(address(0))` was an unknown type and the compile-time gate refused it
// (`NonCompileTimeExpressionError`), then the type check rejected it (`AssignTypeError: Type 'undefined' ...`).
const CORPUS_FIXTURE = `type Int is int16;
using {add as +, unsub as -} for Int global;

IAdder constant ADDER = IAdder(address(0));

function add(Int x, Int y) pure returns (Int) {
    return ADDER.mul(x, y);
}

function unsub(Int x) pure returns (Int) {
    return ADDER.inc(x);
}

interface IAdder {
    function mul(Int, Int) external pure returns (Int);
    function inc(Int) external pure returns (Int);
}
`;

describe('file-level interface-typed constant with an interface cast', () => {
  it('compiles the corpus fixture with the conformance sweep options', () => {
    // The fixture declares no contract (a UDVT, a `using`, a constant and two free functions), so the accepted
    // artifact is a declaration-only one with empty bytecode - exactly what solc emits for such a file. The
    // regression was the refusal, so the assertion is that the compile succeeds.
    expect(() => compileStringRaw(CORPUS_FIXTURE, { evmCompat: true, enforceFinalRequire: false })).not.toThrow();
  });

  it('accepts the cast and an external call through the constant', () => {
    nonEmpty('interface I { function m(uint x) external; }\n'
      + 'I constant X = I(address(0));\n'
      + 'contract C { function f() public { X.m(1); } }\n');
  });

  it('keeps a contract-level interface-typed constant working (the already-supported path)', () => {
    nonEmpty('interface I { function m(uint x) external; }\n'
      + 'contract C { I constant X = I(address(0)); function f() public { X.m(1); } }\n');
  });

  it('still rejects a constant initialized from a non-compile-time expression', () => {
    const source = 'interface I { function m(uint x) external; }\n'
      + 'contract C { function f() public returns (I) { I y = I(address(0)); I constant X = y; return X; } }\n';
    expect(() => compileStringRaw(source, { evmCompat: true, enforceFinalRequire: false })).toThrow();
  });
});
