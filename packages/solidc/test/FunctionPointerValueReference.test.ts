import { describe, it, expect } from 'vitest';
import { compileString as compileStringRaw } from '../src/index.js';

// A side-effect-free single-return helper whose signature carries an EXTERNAL function type is a beta-reduction
// candidate for `InlineForeignFunctionPointerReturns`: its body is inlined at each call site and the helper is
// then dropped. But when the helper is only ever referenced as a function-pointer VALUE (`... p = m;`) and never
// CALLED, there is no call site to inline at - the pass still dropped it and the value reference then failed to
// resolve (`UndefinedReferenceError: Undefined reference to symbol m`). The helper's declaration must survive a
// bare value reference.
const CORPUS_FIXTURE = `contract C {
    function m(
        function() external returns (uint) a,
        function() external returns (uint) b
    ) internal returns (function() external returns (uint)) {
        return a;
    }

    function s(uint a, uint b) internal returns (uint) {
        return a + b;
    }

    function foo() external returns (uint) {
        return 6;
    }

    function test() public returns (uint) {
        function(uint, uint) internal returns (uint) single_slot_function = s;

        function(
            function() external returns (uint),
            function() external returns (uint)
        ) internal returns (function() external returns (uint)) multi_slot_function = m;

        return multi_slot_function(this.foo, this.foo)() + single_slot_function(5, 1);
    }
}
`;

// The same value reference reduced to one parameter, so the class is pinned independently of the fixture's arity.
const SINGLE_PARAM_VALUE_REFERENCE = `contract C {
    function m(function() external returns (uint) a) internal returns (function() external returns (uint)) { return a; }
    function foo() external returns (uint) { return 6; }
    function test() public returns (uint) {
        function(function() external returns (uint)) internal returns (function() external returns (uint)) q = m;
        return q(this.foo)();
    }
}
`;

describe('function-pointer value reference to a fn-ptr helper', () => {
  it('compiles the corpus fixture with the conformance sweep options', () => {
    const artifact = compileStringRaw(CORPUS_FIXTURE, { evmCompat: true, enforceFinalRequire: false });
    expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
  });

  it('keeps a value-referenced helper that a single argument distinguishes', () => {
    const artifact = compileStringRaw(SINGLE_PARAM_VALUE_REFERENCE, { evmCompat: true, enforceFinalRequire: false });
    expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
  });

  it('still inlines and compiles a CALLED fn-ptr helper (the path the drop was written for)', () => {
    // The helper is invoked directly with a beta-reducible foreign member, so the reducer inlines it and the
    // helper is dropped - the behaviour the drop was meant to cover, unchanged by the value-reference guard.
    const called = 'contract C {\n'
      + '  function m(function() external returns (uint) a) internal returns (uint) { return a(); }\n'
      + '  function test(address t) public returns (uint) { return m(IFoo(t).foo); }\n'
      + '}\n'
      + 'interface IFoo { function foo() external returns (uint); }\n';
    const artifact = compileStringRaw(called, { evmCompat: true, enforceFinalRequire: false });
    expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
  });
});
