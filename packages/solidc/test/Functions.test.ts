import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from '../src/index.js';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, { sortedMappingsAll: false, ...o } as any);

// Functions: visibility, unused params, named returns, mutability, internal-helper inlining.

describe('internal helpers that read a state entry (inlined, not subroutined)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('inlines a void private helper with a compound mapping write (_mint pattern)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal; uint256 totalSupply;'
      + ' function _mint(address to, uint256 amt) private { bal[to] += amt; totalSupply += amt; }'
      + ' function mint(address to, uint256 amt) external { _mint(to, amt); require(true); } }')).toBe('C');
  });

  it('inlines a void private helper that reads a mapping then writes', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal;'
      + ' function _m(address k, uint256 v) private { uint256 old = bal[k]; bal[k] = old + v; }'
      + ' function f(address k, uint256 v) external { _m(k, v); require(true); } }')).toBe('C');
  });

  it('leaves a simple-write private helper (no entry read) compiling as before', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal;'
      + ' function _set(address k, uint256 v) private { bal[k] = v; }'
      + ' function f(address k, uint256 v) external { _set(k, v); require(true); } }')).toBe('C');
  });

  it('inlines an entry-reading helper called from the CONSTRUCTOR (the _mint-in-ctor pattern)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal; uint256 total;'
      + ' function _mint(address to, uint256 amt) private { bal[to] += amt; total += amt; }'
      + ' constructor() { _mint(msg.sender, 100); } function f() external { require(true); } }')).toBe('C');
  });

  it('inlines an inherited entry-reading helper called from a child constructor', () => {
    expect(cc('pragma solidity ^0.8.0; contract Base { mapping(address => uint256) bal;'
      + ' constructor(uint256 x) {} function _mint(address to, uint256 amt) internal { bal[to] += amt; } }'
      + ' contract C is Base { constructor() Base(1) { _mint(msg.sender, 100); } function f() external { require(true); } }')).toBe('C');
  });
});

describe('Visibility on free / library functions', () => {
  it('accepts visibility/mutability on a free function (ignored)', () => {
    const a = compileString(`
      function helper(int x) internal pure returns (int) { return x * 2; }
      contract C() { int n; function go() { this.n = helper(3); } }`);
    expect(a.contractName).toBe('C');
  });

  it('accepts visibility/mutability on a library function (ignored)', () => {
    const a = compileString(`
      library Math { function dbl(int x) internal pure returns (int) { return x * 2; } }
      contract C() { int n; function go() { this.n = 1; } }`);
    expect(a.contractName).toBe('C');
  });
});

describe('Constructor payable + interface body ordering', () => {
  it('accepts payable on a constructor (ignored)', () => {
    expect(compileString('contract C() { int n; constructor() payable { this.n = 1; } function f() { this.n = this.n + 1; } }').contractName).toBe('C');
  });

  it('accepts events/errors interleaved with functions in an interface body', () => {
    const a = compileString('interface I { function f() external; event E(int v); error Bad(int x); } contract C() is I { int n; function f() { this.n = 1; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-3: unused vars/params warn but never fail (Solidity-style)', () => {
  it('compiles imported Solidity with unused vars/params', () => {
    const a = compileString(`pragma solidity ^0.8.26;
      contract C {
        function f(uint256 used, uint256 unusedParam) public pure returns (uint256) {
          uint256 unusedLocal = 7;
          return used;
        }
      }`, { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
  it('also accepts an unused param in a native SolidCash contract (no flag, warn-only)', () => {
    const a = compileString('contract C() { function f(sig s, pubkey pk, int unused) { require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-15: empty-body returning function + named-arg call to a returning function', () => {
  it('an empty-body function with return types compiles (Solidity returns defaults) under compat', () => {
    const a = compileString(
      'contract X() { function f(uint256 x) public pure returns (uint256) {} function g() external pure returns (uint256) { return f(1); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('X');
  });
  it('synthesizes a default return for an empty-body returning function (default; was compat-gated)', () => {
    const a = compileString(
      'contract X() { int n; function ok() { this.n = 1; } function f(uint256 x) returns (uint256) {} }',
    );
    expect(a.contractName).toBe('X');
  });
  it('forwards the synthetic returnOutputIdx for a named-arg call to a public returning function', () => {
    const a = compileString(
      'contract X() { function f(uint256 x, uint256 y) public pure returns (uint256) { return x + y; }'
      + ' function g() external pure returns (uint256) { return f({y: 2, x: 1}); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('X');
  });
});

describe('SBE-24: named returns of address/pubkey/sig zero-init correctly', () => {
  // A named return desugars to a local pre-initialized to the type's default. address/pubkey/sig/datasig have
  // no int-0 default, so the prior explicit-0 init tripped AssignTypeError. Uninitialized declarations zero-init
  // via the delete path for every type, so the desugar now uses that.
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('compiles a named address return assigned from a mapping read (ERC721 ownerOf shape)', () => {
    expect(cc('contract C { mapping(uint256 => address) _ownerOf;'
      + ' function ownerOf(uint256 id) external view returns (address owner) {'
      + ' owner = _ownerOf[id]; require(owner != address(0)); } }')).toBe('C');
  });

  it('compiles a named address return from a parameter', () => {
    expect(cc('contract C { int n; function f(address a) external returns (address owner) { owner = a; this.n = 1; } }'))
      .toBe('C');
  });

  it('compiles a named pubkey return', () => {
    expect(cc('contract C { int n; function f(pubkey p) external returns (pubkey k) { k = p; this.n = 1; } }'))
      .toBe('C');
  });
});

// Function-type params may carry pure/view mutability (`function(uint256) pure returns (uint256)`); and
// `new bytes(n)` with a constant length folds to an n-zero-byte buffer (dynamic length has no BCH analogue).
describe('function-type mutability + new bytes(constant)', () => {
  it('parses a pure/view function-type parameter', () => {
    const a = compileString(
      'contract C { function h(function(uint256) view returns (uint256) g) internal pure {}'
      + ' function f() public pure returns (uint256) { return 1; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });

  it('folds new bytes(3) to a 3-zero-byte buffer', () => {
    const a = compileString(
      'contract C { function f() public pure returns (uint256) { bytes memory b = new bytes(3); return b.length; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });

  it('folds new string(constant) to an n-zero-byte string', () => {
    expect(compileString('contract C { function f() public pure returns (string memory) { return new string(5); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

// An unnamed-return function that already returns on every path (a terminal if/else whose branches both
// return) must NOT get a synthesized fall-through `return <defaults>` - that default is dead code and, for
// address/enum returns, was typed (int, int), producing a spurious return-type mismatch (OZ ECDSA pattern).
describe('unnamed-return fall-through: no dead default when all paths return', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles an (address, enum) return ending in if/else where both branches return', () => {
    expect(cc('contract C { enum E { A, B }'
      + ' function f(uint x) internal pure returns (address, E) {'
      + ' if (x == 0) { return (address(0), E.B); } else { return (address(0), E.A); } }'
      + ' function g() public pure { (address a, E e) = f(1); require(a == address(0)); } }')).toBe('C');
  });
  it('still synthesizes a default for a genuine fall-through (no return on some path)', () => {
    // A body that does not return on all paths still gets the fall-through default (uint defaults to 0).
    expect(cc('contract C { function f(uint x) internal pure returns (uint r) { if (x > 0) { r = x; } }'
      + ' function g() public pure { require(f(0) == 0); } }')).toBe('C');
  });
  it('synthesizes a type-correct default for a genuine fall-through returning address', () => {
    // The unnamed-return default for address is address(0) (a cast), not int 0 (which does not type-check).
    expect(cc('contract C { function f(uint x) internal pure returns (address) { if (x > 0) { return address(uint160(1)); } }'
      + ' function g() public pure { require(f(0) == address(0)); } }')).toBe('C');
  });
  it('synthesizes a type-correct default for a genuine fall-through returning an enum', () => {
    expect(cc('contract C { enum E { A, B } function f(uint x) internal pure returns (E) { if (x > 0) { return E.B; } }'
      + ' function g() public pure { require(f(0) == E.A); } }')).toBe('C');
  });
});

// A named return may share the name of its own function - `function max(..) returns (int max)` - which is
// legal Solidity (the named return shadows the function name within the body). A local may shadow an outer
// function or state variable in general (both are contract/library-level, never a same-scope collision).
describe('local / named return may shadow an outer function or state var', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a named return with the same name as its function', () => {
    expect(cc('contract C { function max(int x) public pure returns (int max) { max = x; }'
      + ' function f() public pure returns (int) { return max(3); } }')).toBe('C');
  });
  it('accepts a local shadowing a function name', () => {
    expect(cc('contract C { function helper() internal pure returns (uint) { return 1; }'
      + ' function f() public pure returns (uint) { uint helper = 5; return helper; } }')).toBe('C');
  });
});

// Regression: an `external` entry point that reads a constructor parameter must not be forced through the
// param-less internal-subroutine path. `definedFunctions` keyed on `visibility !== 'public'`, which also caught
// external functions and crashed codegen ("Expected variable 'x' does not exist on the stack"); it now keys on
// `!isEntryPoint`. A subroutine is emitted only when the function is actually invoked internally.
describe('external entry points may read constructor parameters', () => {
  const cc = (src: string): string => compileString(src, { forceStateful: true }).contractName;
  it('compiles a single external function reading a constructor arg', () => {
    expect(cc('contract Owned(int magic) { function check(int m) external { require(m == magic); } }')).toBe('Owned');
  });
  it('compiles multiple external functions reading a constructor arg', () => {
    expect(cc('contract P(int x) { function f(int m) external { require(m == x); }'
      + ' function g(int n) external { require(n > x); } }')).toBe('P');
  });
  it('compiles an address constructor arg used as a delegatecall target in an external function', () => {
    expect(cc('pragma solidcash >=0.8.0; contract Pr(address impl) { bigint s;'
      + ' function up(bytes input) external { impl.delegatecall(input); require(input.length > 0); } }')).toBe('Pr');
  });
});
