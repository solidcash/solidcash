import { describe, it, expect } from 'vitest';
import { compileString, compileStringMulti } from './helpers.js';

// Focused regression guards derived from the Solidity compiler corpus.
describe('inline-only library declaration validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('infers locations on reference-type parameters and returns before the declaration-artifact return', () => {
    expect(cc('library L { function f(uint[] values) internal pure {} }')).toBe('L');
    expect(cc('library L { function f() private pure returns(uint[]) {} }')).toBe('L');
  });

  it('retains explicit library parameter and return locations', () => {
    expect(cc(
      'library L { function f(uint[] memory values) internal pure returns(uint[] memory out) { return values; } }',
    )).toBe('L');
  });
});

describe('Solidity free-function contract context', () => {
  it("rejects 'this' outside a contract", () => {
    expect(() => compileString(
      'contract C {} function f() { this; }',
      { solidityImportCompat: true },
    )).toThrow(/'this'.*not available.*free function/i);
  });

  it("retains 'this' inside a contract function", () => {
    expect(compileString(
      'contract C { function f() public { address a = address(this); require(a == address(this)); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity free-function duplicate signatures', () => {
  it('rejects two or more identical file-level function declarations', () => {
    expect(() => compileString(
      'function f() pure returns (uint) { return 1; }'
      + ' function f() pure returns (uint) { return 2; }',
      { solidityImportCompat: true },
    )).toThrow(/Redefinition of function 'f\(\)'/i);
    expect(() => compileString(
      'function f(uint x) pure returns (uint) { return x; }'
      + ' function f(uint x) pure returns (uint) { return x + 1; }'
      + ' function f(uint x) pure returns (uint) { return x + 2; }',
      { solidityImportCompat: true },
    )).toThrow(/Redefinition of function 'f\(uint256\)'/i);
  });

  it('retains file-level overloads with distinct parameter types', () => {
    expect(compileString(
      'function f(uint x) pure returns (uint) { return x; }'
      + ' function f(bytes32 x) pure returns (bytes32) { return x; }'
      + ' contract C { function g(uint x) public pure returns (uint) { return f(x); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity free-function call options', () => {
  it('rejects gas and value options on direct free-function calls', () => {
    for (const option of ['gas: 1', 'value: 1']) {
      expect(() => compileString(
        `function f() { f{${option}}(); }`,
        { solidityImportCompat: true },
      )).toThrow(/call options.*external function calls or contract creations/i);
    }
  });

  it('retains call options on an external interface call from a free function', () => {
    expect(compileString(
      'interface I { function f() external payable; }'
      + ' function call(I target) { target.f{gas: 1, value: 1}(); }'
      + ' contract C { function run(I target) public { call(target); require(true); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity pure free-function storage mutation', () => {
  it('rejects writes through a storage reference parameter', () => {
    expect(() => compileString(
      'function g(uint[] storage x) pure { x[0] = 1; }',
      { solidityImportCompat: true },
    )).toThrow(/pure function 'g'.*cannot modify storage parameter 'x'/i);
  });

  it('retains the same storage mutation in a non-pure free function', () => {
    expect(compileString(
      'function g(uint[] storage x) { x[0] = 1; }',
      { solidityImportCompat: true },
    ).contractName).toBe('definitions');
  });
});

describe('Solidity free-function literal overload ambiguity', () => {
  it('rejects an integer literal accepted by multiple bounded overloads', () => {
    expect(() => compileString(
      'function g(uint8) {} function g(uint16) {} function t() { g(2); }',
      { solidityImportCompat: true },
    )).toThrow(/No unique declaration.*overloaded function 'g'/i);
  });

  it('retains an explicit cast which uniquely selects an overload', () => {
    expect(compileString(
      'function g(uint8) {} function g(uint16) {}'
      + ' contract C { function t() public { g(uint8(2)); require(true); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('using-for method named length', () => {
  it('distinguishes a callable library method from the built-in .length property', () => {
    const artifact = compileString(
      'library D { function length(string memory self) public returns (uint) { return bytes(self).length; } }'
      + ' contract C { using D for string; string x;'
      + ' function f() public returns (uint) { x = "abc"; return x.length(); }'
      + ' function g() public returns (uint) { string memory s = "abc"; return s.length(); } }',
      { solidityImportCompat: true },
    );
    expect(artifact.contractName).toBe('C');
  });
});

describe('library-namespaced member access', () => {
  // A library enum is registered under its bare name, so `L.E.Member` (member access) and `L.E` (as a type)
  // strip the `L.` and behave like the unqualified enum - byte-identical to the bare form.
  const lib = 'library L { enum Dir { Left, Right } }\n';

  it('L.E.Member compiles and matches the bare enum member bytecode', () => {
    const qualified = compileString(`${lib}contract C() {
      function f(int e) { L.Dir d = L.Dir.Right; require(int(d) == e); }
    }`, { solidityImportCompat: true }).bytecode;
    const bare = compileString(`contract C() { enum Dir { Left, Right }
      function f(int e) { Dir d = Dir.Right; require(int(d) == e); }
    }`, { solidityImportCompat: true }).bytecode;
    expect(qualified).toBe(bare);
  });

  // `L.f({named})` parses as a named method call on `L`; when L is a library it routes to the namespaced library
  // function call `L.f(...)`, reordered against the callee's params - byte-identical to the positional form.
  const mathLib = 'library M { function sub(uint256 x, uint256 y) internal pure returns (uint256) { return x - y; } }\n';

  it('L.f({named}) matches the positional call and reorders args', () => {
    const named = compileString(`${mathLib}contract C() {
      function f(uint256 e) { require(M.sub({y: 2, x: 9}) == e); }
    }`, { solidityImportCompat: true }).bytecode;
    const positional = compileString(`${mathLib}contract C() {
      function f(uint256 e) { require(M.sub(9, 2) == e); }
    }`, { solidityImportCompat: true }).bytecode;
    expect(named).toBe(positional);
  });
});

describe('contract-qualified constant access (C.X / Base.X)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves a self-qualified constant C.X', () => {
    expect(cc('contract C { uint256 constant X = 5;'
      + ' function f() external pure returns (uint256) { return C.X; } }')).toBe('C');
  });
  it('resolves a base-qualified inherited constant Base.X', () => {
    expect(cc('contract A { uint256 constant X = 5; }'
      + ' contract B is A { function f() external pure returns (uint256) { return A.X; } }')).toBe('B');
  });
  it('rejects an unrelated contract Other.X (different X, not in scope)', () => {
    expect(() => cc('contract A { uint256 constant X = 5; }'
      + ' contract B { uint256 constant X = 9; function f() external pure returns (uint256) { return A.X; } }'))
      .toThrow(/Undefined reference/);
  });
});

describe('contract/interface-qualified type access (C.T / I.Enum)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves an interface-qualified enum member (I.Dir.Right)', () => {
    expect(cc('interface I { enum Dir { Left, Right } }'
      + ' contract C is I { function f() external pure returns (uint256) { return uint256(I.Dir.Right); } }')).toBe('C');
  });
  it('resolves a contract-qualified enum member on a base', () => {
    expect(cc('contract A { enum E { X, Y } }'
      + ' contract B is A { function f() external pure returns (uint256) { return uint256(A.E.Y); } }')).toBe('B');
  });
  it('leaves the bare enum member working', () => {
    expect(cc('interface I { enum Dir { Left, Right } }'
      + ' contract C is I { function f() external pure returns (uint256) { return uint256(Dir.Right); } }')).toBe('C');
  });
});

describe('contract-qualified UDVT wrap/unwrap (C.T.wrap / C.T.unwrap)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves C.T.unwrap(C.T.wrap(x)) as identity casts', () => {
    expect(cc('contract C { type T is bool;'
      + ' function f() external pure returns (bool) { return C.T.unwrap(C.T.wrap(true)); } }')).toBe('C');
  });
  it('leaves the bare T.unwrap(x) working', () => {
    expect(cc('contract C { type T is uint256;'
      + ' function f(T x) external pure returns (uint256) { return T.unwrap(x); } }')).toBe('C');
  });
  it('does not misread a 2-arg library method named wrap as a UDVT cast', () => {
    expect(cc('library L { function wrap(uint256 a, uint256 b) internal pure returns (uint256) { return a + b; } }'
      + ' contract C { using L for uint256;'
      + ' function f() external pure returns (uint256) { return L.wrap(1, 2); } }')).toBe('C');
  });
});

describe('prune an UNREACHABLE storage-pointer library (OZ EnumerableSet imported but unused)', () => {
  // OZ EnumerableSet has `_add(Set storage) { .. _contains(set, ..) .. }` + public wrappers. Imported but unused,
  // InlineStoragePointerCalls marks the inner `_contains` inlined and drops it, but `_add`'s call is never inlined
  // (free-fn bodies are not visited there) -> "Undefined reference to symbol ES._contains". A storage-pointer helper
  // cannot stand alone, so an unreachable one is pruned (like the dead assembly / low-level-call helpers).
  it('compiles a contract that imports but never uses an EnumerableSet-shaped library', () => {
    const es = 'library ES { struct Set { uint256 x; } struct AddressSet { Set _inner; }'
      + ' function _contains(Set storage s, uint256 v) private view returns (bool) { return s.x == v; }'
      + ' function _add(Set storage s, uint256 v) private returns (bool) {'
      + ' if (!_contains(s, v)) { s.x = v; return true; } return false; }'
      + ' function contains(AddressSet storage s, uint256 v) internal view returns (bool) { return _contains(s._inner, v); }'
      + ' function add(AddressSet storage s, uint256 v) internal returns (bool) { return _add(s._inner, v); } }';
    const resolver = (p: string): { source: string; id: string } | undefined => (
      p === './ES.sol' ? { source: `pragma solidity ^0.8.0;${es}`, id: '/ES.sol' } : undefined);
    expect(() => compileString('import "./ES.sol"; contract C { uint256 x; function f() public { x = 1; } }',
      { importResolver: resolver, rootFileId: '/main.sol', solidityImportCompat: true })).not.toThrow();
  });
});

describe('using-for directive inside an interface body (SushiSwap IRewarder, valid Solidity 0.6.x)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts `using L for T;` inside an interface (a no-op there - no bodies to bind)', () => {
    expect(cc('library L { function f(uint256 a) internal pure returns (uint256) { return a; } }'
      + ' interface IFoo { using L for uint256; function g() external; }'
      + ' contract C is IFoo { function g() external override {} }')).toBe('C');
  });
});

describe('using-for on a NESTED mapping element receiver (SushiSwap/OZ ERC20 allowances)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const lib = 'library SM { function sub(uint256 a, uint256 b) internal pure returns (uint256) { return a - b; }'
    + ' function add(uint256 a, uint256 b) internal pure returns (uint256) { return a + b; } }';
  it('resolves `allo[x][y].sub(v)` (a 2-key mapping element) through `using SM for uint256`', () => {
    expect(cc(`${lib} contract C { using SM for uint256;`
      + ' mapping(address => mapping(address => uint256)) allo;'
      + ' function f(address x, address y, uint256 v) public { allo[x][y] = allo[x][y].sub(v); } }')).toBe('C');
  });
  it('resolves a read-after-write across two nested elements', () => {
    expect(cc(`${lib} contract C { using SM for uint256;`
      + ' mapping(address => mapping(address => uint256)) allo;'
      + ' function f(address x, address y, uint256 v) public { allo[x][y] = allo[x][y].add(allo[y][x].sub(v)); } }'))
      .toBe('C');
  });
  it('still resolves a SINGLE-key mapping element (regression guard)', () => {
    expect(cc(`${lib} contract C { using SM for uint256; mapping(address => uint256) bal;`
      + ' function f(address x, uint256 v) public { bal[x] = bal[x].sub(v); } }')).toBe('C');
  });
});

describe('using-for on non-struct receiver types (address / string / contract)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves x.method() for `using L for address`', () => {
    expect(cc('library L { function foo(address a) internal pure returns (address) { return a; } }'
      + ' contract C { using L for address;'
      + ' function f(address a) external pure returns (address) { return a.foo(); } }')).toBe('C');
  });
  it('resolves s.method() for `using L for string`', () => {
    expect(cc('library L { function len(string memory s) internal pure returns (uint256) { return bytes(s).length; } }'
      + ' contract C { using L for string;'
      + ' function f(string memory s) external pure returns (uint256) { return s.len(); } }')).toBe('C');
  });

  it('resolves memory and storage helpers attached to a string state variable', () => {
    expect(cc('library L { function copied(string memory s) internal pure returns (string memory) { return s; }'
      + ' function stored(string storage s) internal pure returns (string memory) { return s; } }'
      + ' contract C { using L for string; string value;'
      + ' function f(string calldata x) external returns (string memory, string memory) {'
      + ' value = x; return (value.copied(), value.stored()); } }')).toBe('C');
  });

  it('tracks a named return receiver under a wildcard using-for directive', () => {
    expect(cc('library L { function add(int a, int b) internal pure returns (int) { return a + b; } }'
      + ' contract C { using L for *; function f() public pure returns (int result) {'
      + ' result = 1; result = result.add(2); } }')).toBe('C');
  });
});

describe('free function shadowed by a same-name contract function (compat)', () => {
  it('allows a contract function to shadow a free function of the same signature', () => {
    expect(compileString('function f() pure returns (uint256) { return 1; }'
      + ' contract C { function f() public pure returns (uint256) { return 2; }'
      + ' function g() external pure returns (uint256) { return f(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('still rejects two free functions with the same signature', () => {
    expect(() => compileString('function f() pure returns (uint256) { return 1; }'
      + ' function f() pure returns (uint256) { return 2; } contract C { function g() external pure {} }',
    { solidityImportCompat: true })).toThrow(/Redefinition of function/);
  });
});

describe('library/contract-qualified enum cast (L.E(x) / Contract.E(x))', () => {
  it('resolves L.E(x) as an int -> enum cast', () => {
    expect(compileString('library L { enum E { A, B } }'
      + ' contract C { function f(uint256 c) external pure returns (uint256) { return uint256(L.E(c)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('library-namespaced constant in a constant initializer (D = L.INT)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves L.CONST in a plain and arithmetic constant initializer', () => {
    expect(cc('library L2 { uint256 constant INT = 5; }'
      + ' contract C { uint256 constant D = L2.INT; function f() external pure returns (uint256) { return D; } }')).toBe('C');
    expect(cc('library L2 { uint256 constant INT = 5; }'
      + ' contract C { uint256 constant D = 20 + L2.INT; function f() external pure returns (uint256) { return D; } }')).toBe('C');
  });
});

describe('state and library declaration capabilities', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects external visibility on scalar, mapping, and array state variables', () => {
    for (const declaration of ['uint external x', 'mapping(uint => uint) external x', 'uint[] external x']) {
      expect(() => cc(`contract C { ${declaration}; }`)).toThrow(/State variables cannot have external visibility/);
    }
  });

  it('retains public, internal, and private state visibility', () => {
    expect(cc('contract C { uint public x; uint internal y; uint private z; }')).toBe('C');
  });

  it('rejects payable library functions while retaining nonpayable functions', () => {
    expect(() => cc('library L { function f() public payable {} } contract C {}'))
      .toThrow(/library functions cannot be payable/);
    expect(cc('library L { function f() public pure returns (uint) { return 1; } } contract C {}')).toBe('C');
  });
});

describe('chained getter returning a contract + using-for on computed receivers', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const MATH = 'library Math { function mul(uint a, uint b) internal pure returns (uint) { return a * b; }'
    + ' function add(uint a, uint b) internal pure returns (uint) { return a + b; }'
    + ' function mul(int a, int b) internal pure returns (int) { return a * b; } }\n';

  it('calls a method on the contract a public-var getter returns (A.g().m())', () => {
    expect(cc('contract Token { function balanceOf(address a) public returns (uint) { return 0; } }'
      + ' contract Event { Token public collateralToken; }'
      + ' contract C { Event ev; function f() public returns (uint)'
      + ' { return ev.collateralToken().balanceOf(address(this)); } }')).toBe('C');
  });

  it('resolves a chained getter on a contract-typed LOCAL (market = markets[i])', () => {
    expect(cc('contract Token { function approve(address a, uint v) public returns (bool) { return true; } }'
      + ' contract Event { Token public collateralToken; }'
      + ' contract C { Event[] markets; function f(uint i) public returns (bool)'
      + ' { Event m = markets[i]; return m.collateralToken().approve(address(this), 1); } }')).toBe('C');
  });

  it('resolves using-for on an arithmetic-expression receiver ((a-b).mul(c))', () => {
    expect(cc(`${MATH}contract C { using Math for *;`
      + ' function f(uint a, uint b, uint c) public pure returns (uint) { return (a - b).mul(c); } }')).toBe('C');
  });

  it('resolves an overloaded chained using-for call (x.mul(a).add(b))', () => {
    expect(cc(`${MATH}contract C { using Math for *;`
      + ' function f(uint x, uint a, uint b) public pure returns (uint) { return x.mul(a).add(b); } }')).toBe('C');
  });
});

describe('qualified interface enum references', () => {
  it('resolves I.Enum.Member alongside inherited bare and library-qualified enum members', () => {
    expect(compileString('interface I { enum Direction { A, B } } library L {'
      + ' function f() public pure returns (I.Direction) { return I.Direction.B; } }'
      + ' contract C is I { function f() public pure returns (Direction) { return Direction.B; }'
      + ' function g() public pure returns (I.Direction) { return I.Direction.B; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('resolves an interface-qualified enum inside a reachable library helper', () => {
    expect(compileString('interface I { enum Direction { A, B } } library L {'
      + ' function g() public pure returns (I.Direction) { return I.Direction.B; } }'
      + ' contract C { function f() public pure returns (I.Direction) { return L.g(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('inline deploy receiver in a file-level free function', () => {
  it('hoists and folds (new C()).x() before the free function is inlined', () => {
    const src = 'contract Child { uint public x = 2; }'
      + ' function readFresh() returns (uint) { return (new Child()).x(); }'
      + ' contract C { function f() public returns (uint) { return readFresh(); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('early return inside an `unchecked` block in a LIBRARY function (OZ Math.tryAdd)', () => {
  // `unchecked { uint c = a + b; if (c < a) return (false, 0); return (true, c); }` as a library function: the
  // early return inside the unchecked block must be nested into if/else (EarlyReturnTransformation now recurses into
  // unchecked, and no longer skips a single-statement body), else codegen's visitBranch desyncs the fall-through
  // stack and throws "Expected variable 'c' does not exist on the stack".
  const src = 'library Math { function tryAdd(uint256 a, uint256 b) internal pure returns (bool, uint256) {'
    + ' unchecked { uint256 c = a + b; if (c < a) return (false, 0); return (true, c); } } }'
    + ' contract C { using Math for uint256; function f(uint256 x, uint256 y) public pure returns (uint256) {'
    + ' (bool ok, uint256 r) = Math.tryAdd(x, y); require(ok); return r; } }';
  it('compiles a called library tryAdd with an unchecked early return', () => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('compiles when tryAdd is DEAD (uncalled) too', () => {
    const dead = 'library Math { function tryAdd(uint256 a, uint256 b) internal pure returns (bool, uint256) {'
      + ' unchecked { uint256 c = a + b; if (c < a) return (false, 0); return (true, c); } } }'
      + ' contract C { function f(uint256 x) public pure returns (uint256) { return x; } }';
    expect(() => compileString(dead, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('interface-cast using-for + resolved-back-edge recursion robustness (OZ SafeERC20 shape)', () => {
  const ok = (src: string): void => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  };
  const lib = 'interface IERC20 { function transfer(address to, uint256 v) external returns (bool); }'
    + ' library SafeERC20 { function safeTransfer(IERC20 token, address to, uint256 v) internal {'
    + ' require(token.transfer(to, v), "fail"); } }';
  it('rewrites IERC20(x).safeTransfer(to,v) -> SafeERC20.safeTransfer(IERC20(x),to,v)', () => {
    ok(`pragma solidity ^0.8.0; ${lib} contract C { using SafeERC20 for IERC20;`
      + ' function f(address x, address to, uint256 v) public { IERC20(x).safeTransfer(to, v); } }');
  });
  it('handles the cast rewrite nested in a block and mixed with a genuine interface method', () => {
    ok(`pragma solidity ^0.8.0; ${lib} contract C { using SafeERC20 for IERC20;`
      + ' function f(address x, address to, uint256 v, bool c) public {'
      + ' if (c) { IERC20(x).safeTransfer(to, v); } require(IERC20(x).transfer(to, v)); } }');
  });
  it('does not stack-overflow the SymbolTable analysis walks on the OZ SafeERC20 _callOptionalReturn chain', () => {
    // The ad-hoc analysis walks (collectLoopWrittenSlotKeys, keccakCallInLoop, bodyContainsStateWrites,
    // addLoopVaryingVars) must not follow resolved back-edges (FunctionCall.resolvedFunction etc.) - the deep OZ
    // SafeERC20 -> _callOptionalReturn -> low-level-call chain re-traversed them into a stack overflow. The
    // extcall-target-sourcing limit is a separate, expected wall; the point here is NO "Maximum call stack size".
    const src = 'pragma solidity ^0.8.0;'
      + ' interface IERC20 { function transfer(address to, uint256 v) external returns (bool); }'
      + ' library SafeERC20 {'
      + ' function safeTransfer(IERC20 token, address to, uint256 v) internal {'
      + ' _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, v)); }'
      + ' function _callOptionalReturn(IERC20 token, bytes memory data) private {'
      + ' (bool okk, bytes memory ret) = address(token).call(data); require(okk, "fail"); } }'
      + ' contract C { using SafeERC20 for IERC20;'
      + ' function f(address x, address to, uint256 v, uint256 n) public {'
      + ' for (uint256 i = 0; i < n; i++) { IERC20(x).safeTransfer(to, v); } } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow(/Maximum call stack/);
  });
});

describe('using-for on an interface-typed struct-field / state-var receiver (not hoisted as an external call)', () => {
  // A `using L for IERC20` library method on an interface-typed struct FIELD (`pool.lpToken.tag()`) is a using-for
  // call, NOT an external call: SynthesizeExternalAddressLocals must not hoist it into an __extaddr_ address local
  // (which drops the interface and breaks dispatch), and tryResolveUsingFor must match the binding by interface NAME
  // (an interface-typed receiver's toString() is the bare 'address', but the binding is keyed by the interface).
  const lib = 'interface IERC20 { function balanceOf(address a) external view returns (uint256); }'
    + ' library L { function tag(IERC20 t) internal pure returns (uint256) { return 7; } }';
  const ok = (src: string): void => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${lib} ${src}`, { solidityImportCompat: true })).not.toThrow();
  };
  it('resolves a pure library method on an interface-typed struct field', () => {
    ok('contract C { struct Pool { IERC20 lpToken; uint256 x; } Pool[] poolInfo; using L for IERC20; uint256 s;'
      + ' function f(uint256 pid) public { Pool storage pool = poolInfo[pid]; s = pool.lpToken.tag(); } }');
  });
  it('still hoists a genuine interface method on the same struct field (external call, param index)', () => {
    ok('contract C { struct Pool { IERC20 lpToken; uint256 x; } Pool[] poolInfo; uint256 s;'
      + ' function g(uint256 pid) public { Pool storage pool = poolInfo[pid]; s = pool.lpToken.balanceOf(address(this)); } }');
  });
});

describe('chained overloaded using-for + interface-local-var dispatch (MistSwap SafeMath/SafeERC20)', () => {
  const opts = { solidityImportCompat: true };
  const ok = (src: string): void => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${src}`, opts)).not.toThrow();
  };

  // `t.sub(x).add(y)` where SafeMath OVERLOADS sub(a,b)/sub(a,b,msg) (OZ). The inner `.sub` lowers to a namespaced
  // library call whose overload (hence return type) is not yet resolved; the outer `.add` must still infer uint256
  // from it (by the unique arg-count) or it fell through to MethodCallNotSupported. MasterChef `set()` line 136.
  const SM = 'library SafeMath { function add(uint256 a, uint256 b) internal pure returns (uint256){ return a+b; }'
    + ' function sub(uint256 a, uint256 b) internal pure returns (uint256){ return sub(a,b,"s"); }'
    + ' function sub(uint256 a, uint256 b, string memory m) internal pure returns (uint256){'
    + ' require(b<=a,m); return a-b; } }';
  it('resolves a chained call through an overloaded library method', () => {
    ok(`${SM} contract C { using SafeMath for uint256; uint256 t;`
      + ' function f(uint256 x, uint256 y) public { t = t.sub(x).add(y); } }');
  });

  // `using SafeERC20 for IERC20` on a LOCAL interface var: a library method (safeApprove) rewrites to
  // SafeERC20.safeApprove, but an INTERFACE method (balanceOf, NOT declared by SafeERC20) must stay an external
  // call - the AstBuilder must not blindly rewrite it to a non-existent SafeERC20.balanceOf. MasterChef migrate().
  const SE = 'interface IERC20 { function balanceOf(address a) external view returns (uint256);'
    + ' function approve(address s, uint256 v) external returns (bool); }'
    + ' library SafeERC20 { function safeApprove(IERC20 tok, address s, uint256 v) internal { tok.approve(s,v); } }';
  it('keeps an interface method external while rewriting the library method on a local interface var', () => {
    ok(`${SE} contract C { using SafeERC20 for IERC20;`
      + ' function f(IERC20 tok) public view returns (uint256) { return tok.balanceOf(address(this)); }'
      + ' function g(IERC20 tok, uint256 v) public { tok.safeApprove(address(this), v); } }');
  });

  // A using-for method on a COMPUTED (binary-op) receiver `(a - b).add(c)` (UniswapV2Library.quote): the operator
  // preserves the operand type, so the `.add` binds to `using SafeMath for uint256` even though the receiver has no
  // .type yet. Was MethodCallNotSupported (resolveLowLevelReceiverType returned undefined for a BinaryOpNode).
  it('resolves a using-for method on a computed binary-op receiver', () => {
    ok('library SafeMath { function add(uint256 a, uint256 b) internal pure returns (uint256){ return a+b; } }'
      + ' contract C { using SafeMath for uint256; uint256 s;'
      + ' function f(uint256 a, uint256 b, uint256 c) public { s = (a - b).add(c); } }');
  });

  // A returning library helper that makes an external call (`getReservesFor -> pair.getReserves()`) reached only
  // THROUGH another inlined helper (`_mid`) must inline transitively - else the external-call covenant param surfaces
  // as phantom params at the call site (`Found parameters (..) where (.., bigint, bytes4, bigint) were expected`).
  // SushiRoll `_addLiquidity -> UniswapV2Library.getReserves`. The target is a param here, so it fully compiles.
  const PAIR = 'interface IPair { function getReserves() external view returns (uint112, uint112, uint32); }'
    + ' library Lib { function getReservesFor(IPair pair) internal view returns (uint rA, uint rB){'
    + ' (uint r0, uint r1,) = pair.getReserves(); (rA, rB) = (r0, r1); } }';
  it('inlines a returning external-call library helper reached transitively through another helper', () => {
    ok(`${PAIR} contract C {`
      + ' function _mid(IPair pair) internal view returns (uint x, uint y){ (x, y) = Lib.getReservesFor(pair); }'
      + ' function f(IPair pair) public view returns (uint x, uint y){ (x, y) = _mid(pair); } }');
  });

  // A COMPUTED external-call target `IFoo(pairFor(factory, a, b)).m()` (MistSwap `IUniswapV2Pair(pairFor(..))`):
  // the address is an author-written pure computation over params/state, hoisted into an __extaddr_ local so the
  // co-spend pins the runtime-computed target - was "external call target address must be a param". A pure computed
  // target (params only) compiles; a target embedding an external call (`pairFor(router.factory())`) stays a clean
  // "must be a param" error (the transitive case). VM-proven sound in ComputedExtcallTarget.test.ts.
  const COMP = 'interface IPair { function getReserves() external view returns (uint112, uint112, uint32); }'
    + ' library Lib { function pairFor(address f, address a, address b) internal pure returns (address){ return a; }'
    + ' function getReserves(address factory, address a, address b) internal view returns (uint rA, uint rB){'
    + ' (uint r0, uint r1,) = IPair(pairFor(factory, a, b)).getReserves(); (rA, rB) = (r0, r1); } }';
  it('hoists a computed external-call target IFoo(pairFor(..)) rooted in params', () => {
    ok(`${COMP} contract C { function f(address factory, address a, address b) public view returns (uint x, uint y){`
      + ' (x, y) = Lib.getReserves(factory, a, b); } }');
  });

  // The create2 address form wraps the computed call in numeric/address casts: `IPair(address(uint(keccak256(..))))`.
  // castComputedTarget / hasComputedCastTarget unwrap the cast chain so the wrapped call still hoists into an
  // __extaddr_ local. The allLeavesBodyTop gate and the co-spend identity pin are unchanged, so a target whose leaves
  // are not all params/self-pinned state still fails closed (never a caller-substitutable witness).
  it('hoists a cast-WRAPPED computed external-call target IFoo(address(comp(a)))', () => {
    ok('interface IFoo { function m(uint256 x) external; }'
      + ' contract C { function comp(address a) internal pure returns (address){ return a; }'
      + ' function f(address a) public { IFoo(address(comp(a))).m(5); } }');
  });
  it('fails closed on a cast-wrapped computed target with a non-param/state (mutable local) leaf', () => {
    expect(() => compileString('pragma solidity ^0.8.0;'
      + ' interface IFoo { function m(uint256 x) external; }'
      + ' contract C { function comp(address a) internal pure returns (address){ return a; }'
      + ' function f(address a) public { address b = a; b = address(0); IFoo(address(comp(b))).m(5); } }', opts))
      .toThrow(/target address must be a constructor\/function parameter/);
  });

  // A computed target whose leaves are TUPLE-DESTRUCTURED locals (`(a, b) = (x, y)` swap-loop / `(t0, t1) =
  // sortTokens(x, y)` pairFor) resolves each element to its per-slot RHS / the i-th call return, so allLeavesBodyTop
  // sees param/state leaves and hoists. localInits is pre-populated whole-body (order-independent) and the alias
  // resolver follows a bare-identifier chain (`__rh5_x = __rh3_x = x`) across inline levels. UniswapV2Library.
  it('hoists a computed target whose leaves are tuple-destructured locals', () => {
    ok('interface IPair { function m(uint256 x) external; } contract C { address factory;'
      + ' function comp(address f, address u, address v) internal pure returns (address){ return f; }'
      + ' function g(address x, address y) public { (address a, address b) = (x, y); IPair(comp(factory, a, b)).m(5); } }');
  });
  it('hoists a computed target whose leaves are a tuple destructured from a call', () => {
    ok('interface IPair { function m(uint256 x) external; } contract C {'
      + ' function sortT(address u, address v) internal pure returns (address, address){ return u < v ? (u, v) : (v, u); }'
      + ' function comp(address u, address v) internal pure returns (address){ return u; }'
      + ' function g(address x, address y) public { (address a, address b) = sortT(x, y); IPair(comp(a, b)).m(5); } }');
  });

  // A TRANSITIVE computed target: a leaf is a single-assign local that is a pinned EXTERNAL-CALL RETURN
  // (`factory = router.factory()`), which only exists mid-body. castTransitiveTarget keeps it as a live materialised
  // leaf (substituteAliasesInPlace inlineOnly + containsExternalCall) and places the __extaddr_ decl right before the
  // use (visitBlock), where it is live. SOUND: at-most-param-permissive; a mutable-local leaf still fails closed.
  // SushiRoll `IUniswapV2Pair(pairFor(IUniswapV2Factory(router.factory()), a, b)).getReserves()`.
  it('hoists a transitive computed target rooted in a pinned call-return local', () => {
    ok('interface IPair { function m(uint256 x) external; }'
      + ' interface IRouter { function factory() external view returns (address); }'
      + ' contract C { IRouter router;'
      + ' function comp(address f, address a, address b) internal pure returns (address){ return f; }'
      + ' function g(address a, address b) public {'
      + ' address factory = router.factory(); IPair(comp(factory, a, b)).m(5); } }');
  });
  it('fails closed on a transitive target rooted in a reassignable local', () => {
    expect(() => compileString('pragma solidity ^0.8.0;'
      + ' interface IPair { function m(uint256 x) external; }'
      + ' contract C { function comp(address f) internal pure returns (address){ return f; }'
      + ' function g(address a) public { address x = a; x = address(0); IPair(comp(x)).m(5); } }', opts))
      .toThrow(/target address must be a constructor\/function parameter/);
  });

  // A BRANCH-LOCAL external-call target (declared inside an `if`, used by a cast/low-level call in that branch) is
  // hoisted to the function-body top so the co-spend reads it at the epilogue - UniswapV2Pair.mint's `migrator`
  // (nested-branch), was "Expected variable 'migrator' does not exist on the stack". The external call stays
  // conditional; VM-proven sound in BranchLocalExtcallTarget.test.ts.
  it('hoists a doubly-nested branch-local external-call target to the body top', () => {
    ok('interface IFactory { function migrator() external view returns (address); }'
      + ' interface IMigrator { function desiredLiquidity() external view returns (uint256); }'
      + ' contract C { address factory; function f(address sender, uint256 ts) public view returns (uint256 liq){'
      + ' liq = 0; if (ts == 0) { address migrator = IFactory(factory).migrator();'
      + ' if (sender == migrator) { liq = IMigrator(migrator).desiredLiquidity(); } } } }');
  });
});

describe('using-for external-call library method on an interface-typed state var (OZ SafeERC20 pattern)', () => {
  // `IERC20 public token; using SafeERC20 for IERC20; token.safeTransfer(..)` - safeTransfer is a using-for LIBRARY
  // method (whose body does a low-level/external call), NOT an IERC20 method. It must be rewritten to
  // `SafeERC20.safeTransfer(token, ..)` PRE-inlining (in RedesugarImportedUsingForCalls) so the external-call helper
  // reaches its inliner; a SymbolTable-time resolution is too late (the helper's covenant param then surfaces).
  const lib = 'interface IERC20 { function transfer(address to, uint256 v) external returns (bool); }'
    + ' library SafeERC20 { function safeTransfer(IERC20 token, address to, uint256 v) internal {'
    + ' require(token.transfer(to, v), "f"); } }';
  const ok = (src: string): void => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${lib} ${src}`, { solidityImportCompat: true })).not.toThrow();
  };
  it('compiles token.safeTransfer(..) on an interface state var', () => {
    ok('contract C { IERC20 tok; using SafeERC20 for IERC20;'
      + ' function f(address to, uint256 v) public { tok.safeTransfer(to, v); } }');
  });
  it('leaves a genuine interface method (tok.transfer) as an external call', () => {
    ok('contract C { IERC20 tok; using SafeERC20 for IERC20;'
      + ' function f(address to, uint256 v) public { require(tok.transfer(to, v)); } }');
  });
});

describe('using-for external-call library method on an interface-typed struct FIELD (MasterChef pattern)', () => {
  // `Pool storage pool = poolInfo[pid]; pool.lpToken.safeTransfer(..)` (MasterChef deposit/withdraw): the receiver is
  // an interface-typed struct field. Rewrite pre-inlining via the receiver-type chain (poolInfo -> Pool -> lpToken =
  // IERC20 bound by `using SafeERC20 for IERC20`), so the external-call helper inlines and its target is self-pinned.
  const lib = 'interface IERC20 { function transfer(address to, uint256 v) external returns (bool);'
    + ' function balanceOf(address a) external view returns (uint256); }'
    + ' library SafeERC20 { function safeTransfer(IERC20 token, address to, uint256 v) internal {'
    + ' require(token.transfer(to, v), "f"); } }';
  const ok = (body: string): void => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${lib} contract C { struct Pool { IERC20 lpToken; uint256 x; }`
      + ' Pool[] poolInfo; using SafeERC20 for IERC20; uint256 s; function f(uint256 pid, address to, uint256 v)'
      + ` public { Pool storage pool = poolInfo[pid]; ${body} } }`, { solidityImportCompat: true })).not.toThrow();
  };
  it('compiles safeTransfer on an interface-typed struct field', () => ok('pool.lpToken.safeTransfer(to, v);'));
  it('mixes a using-for external-call method and a genuine interface method on the same field', () => {
    ok('pool.lpToken.safeTransfer(to, v); s = pool.lpToken.balanceOf(address(this));');
  });
});

describe('library sibling constant inside an inlined low-level call (BoringERC20 SIG_TRANSFER_FROM)', () => {
  // A library's own `bytes4 private constant SIG` referenced unqualified inside a low-level-call helper
  // (`t.call(abi.encodeWithSelector(SIG, ..))`) is registered qualified (`L.SIG`). The helper is inlined into the
  // consumer before semantic analysis, losing the library context - so the ref must be qualified up front (mirrors
  // the sibling-call qualification). Direct use / encodeWithSelector-only already worked; the low-level call did not.
  const opts = { solidityImportCompat: true };
  const lib = 'library L { bytes4 private constant SIG = 0x23b872dd;'
    + ' function f(address t) internal returns (bytes memory) {'
    + ' (bool ok, bytes memory d) = t.call(abi.encodeWithSelector(SIG, t)); return d; } }';
  it('resolves a library sibling constant used in an inlined low-level call', () => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${lib}`
      + ' contract C { function g(address t) public { L.f(t); } }', opts)).not.toThrow();
  });
  it('still resolves a param that shadows a sibling constant name', () => {
    const lib2 = 'library L { bytes4 private constant SIG = 0x23b872dd;'
      + ' function f(address t, bytes4 SIG) internal returns (bytes memory) {'
      + ' (bool ok, bytes memory d) = t.call(abi.encodeWithSelector(SIG, t)); return d; } }';
    expect(() => compileString(`pragma solidity ^0.8.0; ${lib2}`
      + ' contract C { function g(address t) public { L.f(t, 0x11223344); } }', opts)).not.toThrow();
  });
});

describe('MasterChefV2 semantic walls (struct scoping + using-for receiver resolution)', () => {
  const opts = { solidityImportCompat: true };
  it('a contract struct shadows a same-named interface struct (distinct contract-scoped types)', () => {
    // IMasterChef.UserInfo{uint256 rewardDebt} vs MasterChefV2.UserInfo{int256 rewardDebt} - distinct types that
    // must not collide in the global structMap. The contract's wins the bare name; the interface's stays qualified.
    expect(() => compileString('pragma solidity ^0.8.0;'
      + ' interface IMC { struct UserInfo { uint256 amount; uint256 rewardDebt; } function d(uint256 p) external; }'
      + ' contract C { struct UserInfo { uint256 amount; int256 rewardDebt; }'
      + ' mapping(uint256 => UserInfo) userInfo;'
      + ' function f(uint256 p) public view returns (int256) { return userInfo[p].rewardDebt; } }', opts)).not.toThrow();
  });
  const bm = 'library BoringMath { function sub(uint256 a, uint256 b) internal pure returns (uint256) { return a - b; } }';
  it('using-for method binds on an array .length receiver (lpToken.length.sub(1))', () => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${bm} contract C { using BoringMath for uint256;`
      + ' address[] lpToken;'
      + ' function f() public view returns (uint256) { return lpToken.length.sub(1); } }', opts)).not.toThrow();
  });
  it('using-for method binds on block.number via the integer-width fallback (block.number.sub(x))', () => {
    // block.number is modeled uint32 (block oracle) but the BoringMath binding is uint256 - the widening is safe.
    expect(() => compileString(`pragma solidity ^0.8.0; ${bm} contract C { using BoringMath for uint256;`
      + ' function f(uint256 x) public view returns (uint256) { return block.number.sub(x); } }', opts)).not.toThrow();
  });
});

describe('RETURNING storage-pointer library fn on a mapping element (BentoBox addElastic, stmt + expr position)', () => {
  // A struct-storage-pointer fn that RETURNS a value AND mutates the pointer (BoringRebase `addElastic(Rebase
  // storage,..) returns(uint)`). InlineReturningStateHelpers now read-modify-writes the element inside its hoisting
  // machinery, so the mutation persists AND the return value is captured - in statement position (discarded) and
  // expression position (return used). Was: "Undefined reference to symbol <param>" (grabbed by the read-oriented
  // eligibleStructPtr inline that left the write's param dangling).
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true, forceStateful: true }).contractName;
  const LIB = 'struct T { int base; int elastic; }'
    + ' library L { function addElastic(T storage t, int e) returns (int newElastic) { newElastic = t.elastic = t.elastic + e; } }';
  it('statement position: L.addElastic(this.m[k], e) - return discarded', () => {
    expect(ok(`${LIB} contract C() { mapping(int => T) m;`
      + ' function f(int k, int e) { L.addElastic(this.m[k], e); require(true); } }')).toBe('C');
  });
  it('expression position: this.last = L.addElastic(this.m[k], e) - return assigned', () => {
    expect(ok(`${LIB} contract C() { mapping(int => T) m; int last;`
      + ' function f(int k, int e) { this.last = L.addElastic(this.m[k], e); require(true); } }')).toBe('C');
  });
  it('expression position in a require comparison (BentoBox shape): require(max >= addElastic(..))', () => {
    expect(ok(`${LIB} contract C() { mapping(int => T) m;`
      + ' function f(int k, int e, int max) { require(max >= L.addElastic(this.m[k], e)); } }')).toBe('C');
  });
  it('using-for method spelling this.m[k].addElastic(e), both positions', () => {
    expect(ok(`${LIB} contract C() { using L for T; mapping(int => T) m; int last;`
      + ' function f(int k, int e) { this.m[k].addElastic(e); this.last = this.m[k].addElastic(e); require(true); } }')).toBe('C');
  });
});

describe('overloaded returning-helper inline disambiguated by return arity (Kashi RebaseLibrary.add)', () => {
  // Two same-arity overloads differing by return count (`add(R,x,bool) returns (R,base)` vs `add(R,x,base) returns R`).
  // A using-for method call in the bodies marks them for inline; the ambiguous inline is disambiguated by RETURN
  // ARITY at the call site (a 1-value assign -> the 1-return overload, a tuple -> the K-return one) rather than
  // failing "Cannot inline call ... multiple N-argument overloads". Advances KashiPairMediumRiskV1 past this wall.
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true, forceStateful: true }).contractName;
  const LIB = 'struct R { int e; int b; }'
    + ' library M { function id(int a) internal pure returns (int) { return a; } }'
    + ' library L { using M for int;'
    + ' function add(R memory total, int x, bool up) internal pure returns (R memory, int base) {'
    + ' base = up ? x.id()+1 : x.id(); total.e = total.e+x; total.b = total.b+base; return (total, base); }'
    + ' function add(R memory total, int x, int base) internal pure returns (R memory) {'
    + ' total.e = total.e+x.id(); total.b = total.b+base; return total; } }';
  it('compiles both call contexts (1-value assign and tuple destructure) of the ambiguous overload', () => {
    expect(ok(`${LIB} contract C() { using L for R; R rr;`
      + ' function one(int x, int b) { R t = R(0,0); t = t.add(x, b); this.rr = t; require(true); }'
      + ' function two(int x) { R t = R(0,0); int bb; (t, bb) = t.add(x, true); this.rr = t; require(bb >= 0); } }')).toBe('C');
  });
});

describe('nested library helpers that perform external calls', () => {
  const iface = 'interface I { function ping() external; }';
  const consumer = ' contract C { function run(I target) public { L.outer(target); require(true); } }';

  it('inlines a same-library external-call helper in the retained wrapper body', () => {
    expect(compileString(iface
      + ' library L { function inner(I t) internal { t.ping(); }'
      + ' function outer(I t) internal { inner(t); } }'
      + consumer, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('inlines a cross-library external-call helper in the retained wrapper body', () => {
    expect(compileString(iface
      + ' library M { function inner(I t) internal { t.ping(); } }'
      + ' library L { function outer(I t) internal { M.inner(t); } }'
      + consumer, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized using-for calls with named arguments', () => {
  it('unwraps (receiver.method)({name: value}) like the direct method-call form', () => {
    expect(compileString('library D { struct S { uint a; }'
      + ' function mul(S storage self, uint x) public returns (uint) { return self.a *= x; } }'
      + ' contract C { using D for D.S; D.S public x;'
      + ' function f(uint a) public returns (uint) { x.a = 6; return (x.mul)({x: a}); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('experimental standard-library imports', () => {
  it('accepts direct, aliased, and namespace std.module imports as compiler-provided no-ops', () => {
    for (const directive of [
      'import std.stub;',
      'import std.stub as stub;',
      'import * as stub from std.stub;',
      'import { identity } from std.stub;',
      'import { identity as id, other } from std.stub;',
    ]) {
      expect(() => compileString(`pragma experimental solidity; ${directive}`,
        { solidityImportCompat: true })).not.toThrow();
    }
  });
});

describe('statement-form using-for library calls', () => {
  it('resolves external, public, and internal library members through the same binding', () => {
    expect(compileString('library L { function e(uint x) external pure {}'
      + ' function p(uint x) public pure {} function i(uint x) internal pure {} }'
      + ' using L for uint; contract C { function f() public pure { uint x; x.e(); x.p(); x.i(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('using-for method named selector on function values', () => {
  it('prefers the declared library method over selector metadata syntax', () => {
    expect(compileString('library L { function selector(function(uint256) internal pure returns (uint256) fn,'
      + ' uint256 x) internal pure returns (uint256) { return fn(x) * 2; } }'
      + ' contract C { using L for function(uint256) internal pure returns (uint256);'
      + ' function identity(uint256 x) internal pure returns (uint256) { return x; }'
      + ' function test(uint256 x) public pure returns (uint256) { return identity.selector(x); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('using-for on an external self-function value', () => {
  it('reconstructs the complete receiver signature for this.identity.double(value)', () => {
    const src = 'library L { function double(function(uint256) external pure returns (uint256) fn,'
      + ' uint256 x) internal pure returns (uint256) { return fn(x) * 2; } }'
      + ' contract C { using L for function(uint256) external pure returns (uint256);'
      + ' function identity(uint256 x) external pure returns (uint256) { return x; }'
      + ' function test(uint256 x) public returns (uint256) { return this.identity.double(x); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('does not guess an overloaded function receiver', () => {
    const src = 'library L { function tag(function(uint256) external fn) internal pure {} }'
      + ' contract C { using L for function(uint256) external;'
      + ' function f(uint256) external {} function f(bytes32) external {}'
      + ' function test() public { this.f.tag(); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).toThrow();
  });
});

describe('discarded contract-qualified function references', () => {
  it('accepts an external function literally named selector with and without metadata access', () => {
    expect(compileString('contract C { constructor() { C.selector.selector; C.selector; }'
      + ' function selector() external pure returns (uint256) { return 3; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contract-qualified internal function-pointer state variables', () => {
  it('keeps a pointer assigned in one entry point and called from another', () => {
    expect(compileString('contract C { function() returns (uint256) internal x;'
      + ' function set() public { C.x = g; } function g() public pure returns (uint256) { return 2; }'
      + ' function get() public returns (uint256) { return C.x(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('library names as array element types', () => {
  it('rejects library arrays and metatype indexing while retaining contract arrays', () => {
    const compat = { solidityImportCompat: true };
    expect(() => compileString('library L {} contract C { function f() public { L[] memory x; } }', compat))
      .toThrow(/Invalid use of library name/);
    expect(() => compileString('library L {} contract C { function f() public { new L[](2); } }', compat))
      .toThrow(/Invalid use of library name/);
    expect(() => compileString('library L { function f() public { L[0]; } }', compat))
      .toThrow(/Index access.*library/);
    expect(compileString('contract A {} contract C { function f() public { A[] memory x; } }',
      compat).contractName).toBe('C');
  });
});

describe('discarded using-for function values', () => {
  it('accepts a uniquely attached library member without calling it', () => {
    expect(compileString('library L { function twice(uint x) public pure returns (uint) { return x * 2; } }'
      + ' contract C { using L for uint; function f(uint x) public pure { x.twice; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('does not guess among overloaded attached members', () => {
    expect(() => compileString('library L {'
      + ' function f(uint x) public pure returns (uint) { return x; }'
      + ' function f(uint x, uint y) public pure returns (uint) { return x + y; } }'
      + ' contract C { using L for uint; function g(uint x) public pure { x.f; } }',
    { solidityImportCompat: true })).toThrow();
  });
});

describe('fixed-array using-for methods named like array builtins', () => {
  it('dispatches attached push and pop methods instead of dynamic-array operations', () => {
    expect(compileString(
      'library L { function push(uint[2] memory a) internal {}'
      + ' function pop(uint[2] memory a) internal {} }'
      + ' contract C { using L for uint[2]; function f() public {'
      + ' uint[2] memory input; input.push(); input.pop(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('imported enum declaration types', () => {
  it('re-resolves an imported enum placeholder before typing a local initializer', () => {
    expect(compileString(
      'import "./Enums.sol"; contract C { function f(Color c) public pure returns (Color) {'
      + ' Color local = Color.Red; return c == local ? Color.Green : c; } }',
      {
        solidityImportCompat: true,
        importResolver: (path) => path === './Enums.sol'
          ? { source: 'enum Color { Red, Green }', id: '/Enums.sol' }
          : undefined,
        rootFileId: '/main.sol',
      },
    ).contractName).toBe('C');
  });
});

describe('discarded library values', () => {
  it('accepts a library namespace and unique member as no-effect statements', () => {
    expect(compileString('library L { function f(uint x) public pure returns (uint) { return x; } }'
      + ' contract C { function g() public pure { L; L.f; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('does not discard an unknown library member', () => {
    expect(() => compileString('library L { function f() public pure {} }'
      + ' contract C { function g() public pure { L.missing; } }',
    { solidityImportCompat: true })).toThrow();
  });
});

describe('own-contract-qualified state arrays', () => {
  it('treats C.a push/pop/index/length exactly like bare state access', () => {
    const qualified = compileString('contract C { uint[] a; function f() public {'
      + ' C.a.push(2); require(C.a[C.a.length - 1] == 2); C.a.pop(); require(C.a.length == 0); } }',
    { solidityImportCompat: true });
    const bare = compileString('contract C { uint[] a; function f() public {'
      + ' a.push(2); require(a[a.length - 1] == 2); a.pop(); require(a.length == 0); } }',
    { solidityImportCompat: true });
    expect(qualified.bytecode).toBe(bare.bytecode);
  });
});

describe('using-for attachment declaration validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('requires explicit file-level and specific-function target types', () => {
    expect(() => cc('library L {} using L for *; contract C {}'))
      .toThrow(/type has to be specified explicitly at file level/i);
    expect(() => cc('function id(uint x) pure returns (uint) { return x; }'
      + ' using { id } for *; contract C {}'))
      .toThrow(/type has to be specified explicitly when attaching specific functions/i);
    expect(() => cc('function id(uint x) pure returns (uint) { return x; }'
      + ' contract C { using { id } for *; }'))
      .toThrow(/type has to be specified explicitly when attaching specific functions/i);
  });

  it('requires an attached free function to have a receiver parameter', () => {
    expect(() => cc('function one() pure returns (uint) { return 1; }'
      + ' using { one } for uint; contract C {}'))
      .toThrow(/does not have any parameters/);
  });

  it('retains explicitly typed attachments and contract-level library wildcards', () => {
    expect(cc('function id(uint x) pure returns (uint) { return x; }'
      + ' library L { function f(uint x) internal pure returns (uint) { return x; } }'
      + ' using { id } for uint; contract C { using L for *; }')).toBe('C');
  });

  it('preserves native specific-function wildcards', () => {
    expect(compileString('function id(uint x) pure returns (uint) { return x; }'
      + ' using { id } for *; contract C {}').contractName).toBe('C');
  });
});

describe('Solidity using-for declaration eligibility', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('requires a source-local using name to denote a declared library', () => {
    expect(() => cc('using Missing for uint; contract C {}'))
      .toThrow(/not a library name/);
    expect(cc('using L for uint; library L {'
      + ' function f(uint x) internal pure returns (uint) { return x; } } contract C {}')).toBe('C');
  });

  it('rejects library types as using-for targets while retaining imports and native syntax', () => {
    expect(() => cc('library L {} library M {} contract C { using L for M; }'))
      .toThrow(/Invalid use of a library name/);
    expect(() => cc('library L {} contract C { using L for L; }'))
      .toThrow(/Invalid use of a library name/);
    expect(compileString('library L {} interface I { using L for uint; function g(); }', {
      solidityImportCompat: false,
    }).contractName).toBeTruthy();
  });

  it('requires specifically attached functions to accept the target as their first argument', () => {
    expect(() => cc('function id(uint16 x) pure returns (uint16) { return x; }'
      + ' contract C { using {id} for uint256; }'))
      .toThrow(/cannot be attached.*cannot be implicitly converted/);
    expect(() => cc('struct S { uint8 x; }'
      + ' function id(uint16 x) pure returns (uint16) { return x; }'
      + ' contract C { using {id} for S; }'))
      .toThrow(/cannot be attached.*cannot be implicitly converted/);
    expect(cc('function id(uint256 x) pure returns (uint256) { return x; }'
      + ' contract C { using {id} for uint16; }')).toBe('C');
  });

  it('only attaches private library functions inside their declaring library', () => {
    expect(() => cc('library L { function f(uint x) private pure returns (uint) { return x; } }'
      + ' using {L.f} for uint; contract C {}'))
      .toThrow(/private.*outside its declaring library/);
    expect(() => cc('library L { function f(uint x) private pure returns (uint) { return x; } }'
      + ' contract C { using {L.f} for uint; }'))
      .toThrow(/private.*outside its declaring library/);
    expect(cc('library L { using {L.f} for uint;'
      + ' function f(uint x) private pure returns (uint) { return x; }'
      + ' function g(uint x) internal pure returns (uint) { return x.f(); } } contract C {}')).toBe('C');
  });
});

describe('sibling-contract-qualified enums', () => {
  it('resolves the qualified enum type and member from another contract in the source unit', () => {
    const artifacts = compileStringMulti('contract Types { enum Status { One, Two } }'
      + ' contract C { function f() public pure returns (Types.Status) { return Types.Status.Two; } }',
    { solidityImportCompat: true });
    expect(artifacts.C.contractName).toBe('C');
  });
});

describe('current-contract-qualified state deletion', () => {
  it('routes delete C.x through the same state reset as delete this.x', () => {
    const bc = (statement: string): string => compileString(
      `contract C { uint x; function f() public { ${statement} } }`,
      { solidityImportCompat: true },
    ).bytecode;
    expect(bc('delete C.x;')).toBe(bc('delete this.x;'));
  });
});

describe('library storage pointers to mappings with typed keys', () => {
  it('inlines void writes and value-returning reads for contract and enum keys', () => {
    expect(compileString(
      'interface I {} enum E { A, B }'
      + ' library L {'
      + ' function setI(mapping(I => uint8) storage m, I k, uint8 v) external { m[k] = v; }'
      + ' function getI(mapping(I => uint8) storage m, I k) external returns (uint8) { return m[k]; }'
      + ' function setE(mapping(E => uint8) storage m, E k, uint8 v) external { m[k] = v; }'
      + ' function getE(mapping(E => uint8) storage m, E k) external returns (uint8) { return m[k]; } }'
      + ' contract C { mapping(I => uint8) im; mapping(E => uint8) em;'
      + ' function f(I ik, E ek, uint8 v) public { L.setI(im, ik, v); L.setE(em, ek, v);'
      + ' require(L.getI(im, ik) == v && L.getE(em, ek) == v); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('flattened library struct pointers bound to mapping entries', () => {
  it('propagates the entry key through scalar and dynamic-array fields', () => {
    expect(compileString(
      'library L { struct S { uint a; uint[] b; } function set(S storage s) public {'
      + ' s.a = 7; while (s.b.length < 4) s.b.push(); s.b[3] = 8; } }'
      + ' contract C { mapping(string => L.S) data; function f() public { L.set(data["abc"]);'
      + ' require(data["abc"].a == 7 && data["abc"].b[3] == 8); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('global using-for target types', () => {
  it('accepts a file-level user-defined value type target', () => {
    expect(compileString(
      'type T is uint; function f(T x) pure returns (T) { return x; } using {f} for T global;'
      + ' contract C { function g(T x) public pure returns (T) { return x.f(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('rejects built-in, aggregate, contract, interface, and wildcard global targets', () => {
    const sources = [
      'using {f} for uint global; function f(uint x) pure returns (uint) { return x; } contract C {}',
      'using L for uint[] global; library L {} contract C {}',
      'using {f} for C global; function f(C x) pure returns (C) { return x; } contract C {}',
      'using {f} for I global; function f(I x) pure returns (I) { return x; } interface I {} contract C {}',
      'using {f} for * global; function f(uint x) pure returns (uint) { return x; } contract C {}',
    ];
    for (const source of sources) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Can only use ["']global["'] with user-defined value types/);
    }
  });
});

describe('calldata locations on attached library functions', () => {
  it('rejects a memory receiver passed to a calldata first parameter', () => {
    expect(() => compileString(
      'library D { function f(bytes calldata) internal pure {} }'
        + ' contract C { using D for bytes; function f(bytes memory x) public pure { x.f(); } }',
      { solidityImportCompat: true },
    )).toThrow(/cannot pass memory reference to calldata parameter/);
  });

  it('accepts a calldata receiver and memory-taking attachment', () => {
    expect(compileString(
      'library D { function f(bytes calldata) internal pure {}'
        + ' function g(bytes memory) internal pure {} }'
        + ' contract C { using D for bytes; function f(bytes calldata x) external pure { x.f(); x.g(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('source-unit declaration namespace', () => {
  it('rejects duplicate and cross-kind source declarations', () => {
    const invalid = [
      'enum E { A } contract E {}',
      'enum E { A } enum E { B }',
      'contract C {} function C() {}',
      'uint constant c = 7; function c() returns (uint) {}',
      'contract X {} contract X {}',
      'contract S {} struct S { uint a; }',
      'struct S { uint a; } contract S {}',
      'struct S { uint a; } struct S { uint b; }',
      'type T is uint; type T is int;',
      'event E(uint); error E(uint);',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Identifier .* is already declared/);
    }
  });

  it('retains valid free-function and event overload sets', () => {
    expect(compileString(
      'event E(uint); event E(bytes32);'
      + ' function f(uint x) pure returns (uint) { return x; }'
      + ' function f(bytes32 x) pure returns (bytes32) { return x; } contract C {}',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('contract-local declaration namespace', () => {
  it('rejects value/function/event conflicts and duplicate aggregate members', () => {
    const invalid = [
      'contract C { event f(); function f() public {} }',
      'contract C { uint f; function f() public {} }',
      'contract C { function f(uint) public pure {} uint public f; }',
      'contract C { uint constant f = 1; function f() public pure {} }',
      'contract C { modifier f() { _; } function f() public {} }',
      'contract C { struct S { uint x; bool x; } }',
      'contract C { enum E { A, B, A } }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Identifier .* is already declared/);
    }
  });

  it('retains function and event overload sets', () => {
    expect(compileString(
      'contract C { event E(uint); event E(bytes32);'
      + ' function f(uint) public {} function f(bytes32) public {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('explicit using-for function references', () => {
  it('rejects non-functions, builtins, and ambiguous overload sets', () => {
    const invalid = [
      'event E(); type T is uint; using {E} for T;',
      'type T is uint; using {keccak256 as +} for T global;',
      'type T is uint; using {Err as +} for T global; error Err(T a, T b);',
      'type T is uint; library L {} using {L as +} for T global;',
      'function f(uint x) pure returns (uint) { return x; }'
      + ' function f(bytes32 x) pure returns (bytes32) { return x; } using {f} for uint;',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/not a function name or not unique/);
    }
  });

  it('accepts one unique free or qualified library function', () => {
    expect(compileString(
      'function twice(uint x) pure returns (uint) { return x * 2; }'
      + ' library L { function inc(uint x) internal pure returns (uint) { return x + 1; } }'
      + ' using {twice, L.inc} for uint; contract C {'
      + ' function f(uint x) public pure returns (uint) { return x.twice().inc(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('function declarations shadow contract namespaces', () => {
  it('rejects a base-qualified call when the qualifier resolves to a function', () => {
    expect(() => compileString(
      'contract A { function f() public {} }'
      + ' contract B is A { function A() public pure returns (uint8) {}'
      + ' function g() public { A.f(); } }',
      { solidityImportCompat: true },
    )).toThrow(/Undefined reference to symbol A\.f/);
  });

  it('retains an ordinary explicit base-qualified call', () => {
    expect(compileString(
      'contract A { function f() public {} }'
      + ' contract B is A { function g() public { A.f(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('B');
  });
});

describe('library self-external calls through using-for', () => {
  it('rejects a public attached function called from its own library', () => {
    expect(() => compileString(
      'library L1 { using L1 for *;'
        + ' function f() public pure returns (uint r) { return r.g(); }'
        + ' function g(uint) public pure returns (uint) { return 2; } }'
        + ' library L2 { using L1 for *;'
        + ' function f() public pure returns (uint r) { return r.g(); }'
        + ' function g(uint) public pure returns (uint) { return 2; } }',
      { solidityImportCompat: true },
    )).toThrow(/Library cannot call its own function 'L1\.g' externally/);
  });

  it('accepts an internal self-call and a public attachment called from another library', () => {
    expect(compileString(
      'library L1 { using L1 for *;'
        + ' function f() public pure returns (uint r) { return r.g(); }'
        + ' function g(uint) internal pure returns (uint) { return 2; } }'
        + ' library L2 { using L1 for *;'
        + ' function f() public pure returns (uint r) { return r.g(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('L2');
  });
});
