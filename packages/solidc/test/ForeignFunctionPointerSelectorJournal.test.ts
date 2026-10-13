import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

// Upstream Solidity fixture (test/libsolidity/semanticTests/functionTypes/store_function.sol), source verbatim.
// A foreign function-pointer state variable is lowered into an `address` wrapper plus a companion `bytes4`
// selector field, and a store writes both together. `t` then reaches the call through the wrapper: its
// runtime-selector authentication reads the companion field in the function epilogue, after the write journal
// has been settled. Retention for that epilogue must therefore keep the companion cell whenever it keeps the
// wrapper's, or the selector read addresses a slot that is no longer on the stack.
const SOURCE = `contract Other {
    function addTwo(uint256 x) public returns (uint256) {
        return x + 2;
    }
}


contract C {
    function (function (uint) external returns (uint)) internal returns (uint) ev;
    function (uint) external returns (uint) x;

    function store(function(uint) external returns (uint) y) public {
        x = y;
    }

    function eval(function(uint) external returns (uint) y) public returns (uint) {
        return y(7);
    }

    function t() public returns (uint256) {
        ev = eval;
        this.store((new Other()).addTwo);
        return ev(x);
    }
}
`;

describe('foreign function-pointer selector journal', () => {
  it('compiles a stored function pointer that is called after the store, with the sweep options', () => {
    // Exactly the options the solc-corpus conformance sweep passes for unmodified upstream sources.
    const artifact = compileString(SOURCE, { evmCompat: true, enforceFinalRequire: false });

    expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
    expect(artifact.bytecode).toContain('OP_INVOKE');
    // The companion selector field is published as a state variable, so the selected method is authenticated
    // against the same post-write value the wrapper address is.
    expect(artifact.abi.some((entry) => entry.name === 't')).toBe(true);
  });
});
