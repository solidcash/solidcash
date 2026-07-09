import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// C3 direction + ctor init chains: bases listed most-base-first, grandparent ctor invocations,
// and super resolution walking the linearization right-to-left.

const GRANDPARENT_CTOR = `
contract B {
    int public a;
    constructor(int x) {
        a = x;
    }
}
abstract contract C is B {
}
contract D is C {
    constructor(int y) B(y + 1) {}
    function check(int expected) public {
        require(a == expected);
    }
}
`;

const SIBLING_CHAIN = `
contract Base {
    int public m_i;
    constructor(int j) {
        m_i = j;
    }
}
contract Base1 is Base {
    constructor(int k) Base(k) {}
}
contract Derived is Base, Base1 {
    constructor(int i) Base1(i) {}
}
contract Final is Derived {
    constructor() Derived(4) {}
    function check(int expected) public {
        require(m_i == expected);
    }
}
`;

const SUPER_ORDER = `
contract A {
    function pick() internal pure virtual returns (int) {
        return 1;
    }
}
contract B {
    function pick() internal pure virtual returns (int) {
        return 2;
    }
}
contract X is A, B {
    function pick() internal pure override(A, B) returns (int) {
        return super.pick();
    }
    function check(int expected) public {
        require(pick() == expected);
    }
}
`;

describe('constructor chains and linearization order (VM)', () => {
  it('grandparent ctor invocation initializes state through an abstract link', async () => {
    const artifact = compileString(GRANDPARENT_CTOR, { forceStateful: true });
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy(5n);
    await expect(sc.check(6n)).resolves.toBeDefined();
  });

  it('grandparent ctor invocation rejects a wrong expectation', async () => {
    const artifact = compileString(GRANDPARENT_CTOR, { forceStateful: true });
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy(5n);
    await expect(sc.check(7n)).rejects.toThrow();
  });

  it('most-base-first sibling lists linearize and run the ctor chain', async () => {
    const artifact = compileString(SIBLING_CHAIN, { forceStateful: true });
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.check(4n)).resolves.toBeDefined();
  });

  it('super in a multi-base contract resolves to the rightmost base first', async () => {
    const artifact = compileString(SUPER_ORDER, { forceStateful: true });
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.check(2n)).resolves.toBeDefined();
    const sc2 = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc2.check(1n)).rejects.toThrow();
  });
});
