import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Functions, modifiers, and visibility: receive/fallback, named returns, modifier interleaving.

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
  it('still rejects an empty-body returning function in native mode (footgun guard)', () => {
    expect(() => compileString(
      'contract X() { int n; function ok() { this.n = 1; } function f(uint256 x) returns (uint256) {} }',
    )).toThrow(/contains no statements/);
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

describe('empty void functions synthesize a no-op body (Solidity porting: receive/fallback/payable)', () => {
  it('compiles empty receive(), payable, and plain void functions under solidityImportCompat', () => {
    for (const body of [
      'function inc() public { n++; } receive() external payable {}',
      'function deposit() public payable {} function inc() public { n++; }',
      'function f() public {} function inc() public { n++; }',
      'function inc() public { n++; } fallback() external payable {}',
    ]) {
      const src = `pragma solidity ^0.8.0; contract C { int n; ${body} }`;
      expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
    }
  });

  it('still rejects an empty function in native mode (the guard is preserved)', () => {
    expect(() => compileString('contract C() { int n; function f() {} }'))
      .toThrow(/contains no statements/);
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

// The modifier placeholder `_;` may live inside an if/else branch (or loop body), not only at the modifier
// body top level - the OZ `ifAdmin` proxy pattern. Grammar allows it anywhere a statement is; modifier
// expansion counts + replaces it recursively.
describe('`_;` modifier placeholder inside a conditional', () => {
  it('expands `_;` nested in an if/else branch', () => {
    const a = compileString(
      'contract C { int x; modifier ifZero() { if (this.x == 0) { _; } else { require(false); } }'
      + ' function f() ifZero { this.x = 1; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
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
});

describe('function modifier / custom-modifier interleaving (Solidity allows any order)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a custom modifier invocation BEFORE visibility (function f() M(1) public {})', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { modifier M(uint i){_;}'
      + ' function f() M(1) public { require(true); } }')).toBe('C');
  });
  it('accepts multiple custom modifiers interleaved with visibility/mutability', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { modifier A{_;} modifier B{_;}'
      + ' function f() A public B view { require(true); } }')).toBe('C');
  });
  it('still accepts the visibility-first order', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { modifier M(uint i){_;}'
      + ' function f() public M(1) { require(true); } }')).toBe('C');
  });
});

// A receive() must stay external + payable, but Solidity allows virtual/override interleaved in any order.
describe('receive(): virtual/override interleaved with external payable', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts `receive() external virtual payable`', () => {
    expect(cc('contract C { uint bal; receive() external virtual payable { bal = 1; }'
      + ' function f() public { require(true); } }')).toBe('C');
  });
  it('still rejects a receive() missing payable', () => {
    expect(() => compileString('contract C { receive() external { } function f() public { require(true); } }',
      { solidityImportCompat: true })).toThrow();
  });
});

// A Solidity forwarding-proxy fallback declares a return type: `fallback(bytes) external payable returns (bytes)`.
// Lowers like the already-supported fallback-with-params plus a returns clause; the body forwards via the same
// opaque-data low-level call model as MultiSigWallet (`target.call{value}(data)`), which is covenant-sound.
describe('fallback with input + return type (forwarding proxy)', () => {
  const SRC = 'contract C { address immutable target; constructor(address _t) { target = _t; }'
    + ' fallback(bytes calldata data) external payable returns (bytes memory) {'
    + ' (bool ok, bytes memory res) = target.call{value: msg.value}(data); require(ok); return res; } }';
  it('parses and compiles a fallback with a bytes return type', () => {
    expect(compileString(SRC, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('captures the forward as a low-level call (sound forwarding covenant)', () => {
    const fb = compileString(SRC, { solidityImportCompat: true }).abi.find((f) => f.name === '__fallback');
    expect(fb?.isFallback).toBe(true);
    expect(fb?.lowLevelCalls?.[0]?.callMode).toBe('call');
  });
  it('still accepts a fallback with params but no return type (no regression)', () => {
    expect(compileString('contract C { int n; fallback(bytes calldata data) external payable {'
      + ' (bool ok, bytes memory res) = msg.sender.call{value: msg.value}(data); require(ok); this.n = res.length; } }',
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
