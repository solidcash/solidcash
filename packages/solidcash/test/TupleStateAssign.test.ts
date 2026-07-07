import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../src/index.js';
import { fundedSigner } from './test-util.js';

// Tuple assignment where a target is a STATE variable (mixed with transient-lowered locals). The tuple
// codegen writes stack slots, which state vars do not have; SymbolTable now desugars to temp captures +
// sequential assigns (state targets route through StateAssign). Mirrors solc's
// transient_state_variable_tuple_assignment.sol: after (x, y, w) = (y, w, z), expect (2, 3, 4).
const MIXED_SOURCE = `
contract TupleStateAssign {
    int transient x;
    int y;
    int transient w;
    int z;

    function f() {
        x = 1;
        y = 2;
        w = 3;
        z = 4;
        (x, y, w) = (y, w, z);
        require(x == 2);
        require(y == 3);
        require(w == 4);
        require(z == 4);
    }

    function g() {
        require(y == 3);
        require(z == 4);
    }
}
`;

// Immutable state vars initialized by a tuple assignment from a multi-return call in the constructor
// (mirrors solc's ctor_initialization_tuple.sol).
const CTOR_SOURCE = `
contract ImmutableTupleInit {
    int immutable x;
    int immutable y;

    constructor() {
        (x, y) = f();
    }

    function f() private pure returns (int, int) {
        return (3, 4);
    }

    function check() {
        require(x == 3);
        require(y == 4);
    }
}
`;

describe('tuple assignment onto state variables (VM-verified)', () => {
  it('swaps through mixed transient/state targets clobber-safely', async () => {
    const sc = await getContractFactory(compileString(MIXED_SOURCE), await fundedSigner()).deploy();
    await expect(sc.f()).resolves.toBeDefined();
  });

  it('persists the state-var writes across calls', async () => {
    const sc = await getContractFactory(compileString(MIXED_SOURCE), await fundedSigner()).deploy();
    await expect(sc.g()).rejects.toThrow(); // pre-f state: y == 0
    await sc.f();
    await expect(sc.g()).resolves.toBeDefined(); // y == 3, z == 4 persisted
  });

  it('initializes immutables from a tuple of a multi-return call in the constructor', async () => {
    const sc = await getContractFactory(compileString(CTOR_SOURCE), await fundedSigner()).deploy();
    await expect(sc.check()).resolves.toBeDefined();
  });
});
