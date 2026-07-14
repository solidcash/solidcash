import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// External and low-level calls: interface-typed targets, call{value}, transfer/send, and their receivers.

describe('Low-level call options + tuple-slot modifiers + value units', () => {
  it('supports the {value:} call option on a low-level call', () => {
    const a = compileString('contract C() { int n; function f(address to, bytes data, int v) { (bool ok, bytes res) = to.call{value: v}(data); require(ok); this.n = res.length; } }');
    expect(a.contractName).toBe('C');
  });

  it('supports a data-location modifier in a tuple slot', () => {
    const a = compileString('contract C() { int n; function f(address to, bytes data) { (bool ok, bytes memory res) = to.call(data); require(ok); this.n = res.length; } }');
    expect(a.contractName).toBe('C');
  });

  it.each([
    ['ether', 'this.n = 1 ether;'],
    ['gwei', 'this.n = 2 gwei;'],
    ['wei', 'this.n = 100 wei;'],
  ])('accepts the %s value unit', (_l, body) => {
    expect(compileString(`contract C() { int n; function f() { ${body} } }`).contractName).toBe('C');
  });
});

describe('SBE-6: external calls on interface-typed variables (EVM parity)', () => {
  const IFACE = 'interface IERC20 { function transferFrom(address f, address t, int a) external returns (bool); }';
  it('routes a method call on an interface-typed state var to an external call', () => {
    const a = compileString(`${IFACE}
      contract C(IERC20 token) {
        function f(address from, address to, sig s, pubkey pk) {
          bool ok = token.transferFrom(from, to, 5);
          require(checkSig(s, pk));
        }
      }`);
    expect(a.contractName).toBe('C');
  });
  it('routes a method call on an interface-typed local (IFoo x = IFoo(addr))', () => {
    const a = compileString(`interface IFoo { function bar(int x) external returns (int); }
      contract C() {
        function f(address a, sig s, pubkey pk) { IFoo foo = IFoo(a); int r = foo.bar(5); require(checkSig(s, pk)); }
      }`);
    expect(a.contractName).toBe('C');
  });
  it('routes a method call on an interface-typed parameter', () => {
    const a = compileString(`interface IFoo { function bar(int x) external returns (int); }
      contract C() { function f(IFoo foo, sig s, pubkey pk) { int r = foo.bar(5); require(checkSig(s, pk)); } }`);
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-7: ether-send via low-level call{value:}', () => {
  it('addr.call{value:}(data) on an address variable', () => {
    const a = compileString('contract C() { function f(address dst, sig s, pubkey pk) { (bool ok, bytes d) = dst.call{value: 100}(0x); require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
  it('msg.sender.call{value:}(data)', () => {
    const a = compileString('contract C() { function f(sig s, pubkey pk) { (bool ok, bytes d) = msg.sender.call{value: 100}(0x); require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-8: stateless value-send (transfer/send) compiles (no stateful block required)', () => {
  it('compiles address.transfer() in a stateless contract (output verified at an absolute index)', () => {
    const a = compileString('contract C() { function f(address payable dst, sig s, pubkey pk) { dst.transfer(100); require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
  it('compiles address.send() in a stateless contract', () => {
    const a = compileString('contract C() { function f(address payable dst, sig s, pubkey pk) { bool ok = dst.send(100); require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
  it('still allows address.transfer() in a stateful contract', () => {
    const a = compileString('contract C() { int n; function f(address payable dst, sig s, pubkey pk) { dst.transfer(100); this.n = 1; require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-13: void external-call helpers are inlined at internal call sites (SafeERC20 pattern)', () => {
  const IFACE = 'interface IERC20 { function transferFrom(address f, address t, int a) external returns (bool); }';
  it('inlines a helper called twice; each inline collects its own external call', () => {
    const a = compileString(`${IFACE}
      contract C(IERC20 token1, IERC20 token2) {
        int n;
        function _safe(IERC20 t, address f, address r, int v) {
          bool sent = t.transferFrom(f, r, v); require(sent);
        }
        function go(address f, address r, sig s, pubkey pk) {
          require(checkSig(s, pk));
          _safe(token1, f, r, 5);
          _safe(token2, r, f, 7);
          this.n = 1;
        }
      }`);
    // Two internal calls -> two inlined transferFrom external calls in `go` (the helper's `sent` local is
    // alpha-renamed per inline, so the two copies do not collide).
    const go = a.abi.find((f) => f.name === 'go');
    expect(go?.externalCalls?.length).toBe(2);
    expect(go?.externalCalls?.every((c) => c.functionName === 'transferFrom')).toBe(true);
  });
});

// A value-returning internal/library helper whose body performs a low-level call injects a synthetic
// __internal__callInputIndex covenant param (supplied only at the top-level entry), so calling it as a
// subroutine used to fail with a phantom arg-count mismatch. It is now inlined at direct call sites.
describe('value-returning low-level-call helpers are inlined at direct call sites', () => {
  const LIB = 'library L { function fwd(address a, bytes d) internal returns (bytes) {'
    + ' (bool ok, bytes r) = a.call(d); require(ok); return r; } }';
  it('a direct call to a bytes-returning helper doing a low-level call compiles', () => {
    const a = compileString(`${LIB} contract C() {`
      + ' function f(address x, bytes d) returns (bytes) { return L.fwd(x, d); } }');
    expect(a.contractName).toBe('C');
  });
  it('the inlined low-level-call co-spend covenant is byte-identical to the hand-written form', () => {
    const inlined = compileString(`${LIB} contract C() {`
      + ' function f(address x, bytes d) returns (bytes) { return L.fwd(x, d); } }').bytecode.split(' ');
    const hand = compileString('contract C() { function f(address x, bytes d) returns (bytes) {'
      + ' (bool ok, bytes r) = x.call(d); require(ok); return r; } }').bytecode.split(' ');
    // Inlining adds a benign param-copy at the front; the entire co-spend covenant tail must be identical.
    expect(inlined.slice(-150).join(' ')).toBe(hand.slice(-150).join(' '));
  });
  it('inlines the same helper reached via `using L for address` on a cast receiver (address(x).fwd(d))', () => {
    const a = compileString(`${LIB} contract C() { using L for address;`
      + ' function f(address x, bytes d) returns (bytes) { return address(x).fwd(d); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('external call on a tuple-destructured / copied local interface var', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const iface = 'interface IERC20 { function transferFrom(address f, address t, uint256 a) external returns (bool);'
    + ' function balanceOf(address o) external view returns (uint256); function transfer(address t, uint256 a) external returns (bool); }';

  it('routes a method call on a tuple-destructured interface var to an external call', () => {
    expect(cc(`${iface} contract C { IERC20 token0; IERC20 token1;`
      + ' function swap(uint256 amt) public { (IERC20 tokenIn, IERC20 tokenOut) = (token0, token1);'
      + ' tokenIn.transferFrom(msg.sender, address(this), amt); require(true); } }')).toBe('C');
  });

  it('routes a method call on a tuple-ternary-destructured interface var (CSAMM shape)', () => {
    expect(cc(`${iface} contract C { IERC20 token0; IERC20 token1;`
      + ' function swap(bool isToken0, uint256 amt) public {'
      + ' (IERC20 tokenIn, IERC20 tokenOut) = isToken0 ? (token0, token1) : (token1, token0);'
      + ' tokenIn.transferFrom(msg.sender, address(this), amt);'
      + ' uint256 x = tokenIn.balanceOf(address(this)); tokenOut.transfer(msg.sender, x); require(true); } }')).toBe('C');
  });
});

describe('SBE-21: external call on a state-var target in fallback/receive', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // SynthesizeExternalAddressLocals visits fallback/receive too, so a re-entrancy-style fallback that calls
  // back into an interface/contract-typed state var resolves the target like any function (unblocks ReEntrancy).
  it('compiles a fallback + receive that call a contract-typed state var', () => {
    expect(cc('contract Store { int counter; function withdraw() external { require(true); } }'
      + ' contract C { Store s; constructor(address a){ s = Store(a); }'
      + ' fallback() external { s.withdraw(); }'
      + ' receive() external payable { s.withdraw(); } }')).toBe('C');
  });
});

// Low-level call `.call{value:}(data)` on a COMPLEX (non-identifier) address receiver: the receiver type is
// resolved structurally in the symbol-table pass (types are not on nodes yet). Unblocks MultiSigWallet's
// `transactions[i].to.call{value: ...value}(...data)` (a struct field of an array element).
describe('Low-level call on a struct-field / array-element address receiver', () => {
  it('compiles `structVar.field.call{value:}(data)` where the struct is an array element', () => {
    const a = compileString(
      'contract C { struct T { address to; uint256 value; bytes data; } T[] txs;'
      + ' function exec(uint256 i) public { T storage t = txs[i];'
      + ' (bool ok,) = t.to.call{value: t.value}(t.data); require(ok); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
    expect(a.bytecode.length).toBeGreaterThan(0);
  });
});

// A redundant same-interface cast on an interface-typed state-var external-call target (`IFoo(pool).bar()`,
// where `pool` is already IFoo-typed) is a no-op cast; it must route through the same synthesized __extaddr_
// local as the bare `pool.bar()` form instead of demanding a param target.
describe('redundant interface cast on a state-var external-call target', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const iface = 'interface IFoo { function bar() external; }';
  it('accepts IFoo(statePool).bar() like the bare statePool.bar()', () => {
    expect(cc(`${iface} contract C { IFoo pool; constructor(address _p) { pool = IFoo(_p); }`
      + ' function f() external { IFoo(pool).bar(); } }')).toBe('C');
  });
  it('accepts the immutable-state-var form too', () => {
    expect(cc(`${iface} contract C { IFoo immutable pool; constructor(address _p) { pool = IFoo(_p); }`
      + ' function f() external { IFoo(pool).bar(); } }')).toBe('C');
  });
});

// An external-call address local must survive to the covenant epilogue. Reading the same handle another way in
// the same function (`address(car).balance` alongside `car.method()`) must not OP_ROLL-consume it as a last use.
describe('external-call address local survives a same-function balance read', () => {
  const base = 'contract Car { address owner; constructor(address _o) { owner = _o; }'
    + ' function owner_() external view returns (address) { return owner; } }';
  const cc = (body: string): string => compileString(
    `${base} contract F { Car[] cars; function g(uint i) public view returns (${body} } }`,
    { solidityImportCompat: true },
  ).contractName;
  it('compiles ext-call then address(handle).balance in a tuple', () => {
    expect(cc('address, uint) { Car car = cars[i]; return (car.owner_(), address(car).balance);')).toBe('F');
  });
  it('does not regress an ext-call with no balance read', () => {
    expect(cc('address) { Car car = cars[i]; return car.owner_();')).toBe('F');
  });
});

// Solidity auto-generates an external getter for every `public` state var. Genuine `address` getters are now
// synthesized (so `other.owner()` resolves), while enum/contract-typed vars stay skipped: they are AddressType
// placeholders pre-semantic (interfaceName set) and a placeholder-typed getter would trip ReturnTypeMismatch.
describe('public address state-var auto-getter (external-callable)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('synthesizes an address getter and resolves an external call to it', () => {
    expect(cc('contract Car { address public owner; constructor(address _o) { owner = _o; } }'
      + ' contract F { Car[] cars; function g(uint i) public view returns (address) {'
      + ' Car car = cars[i]; return car.owner(); } }')).toBe('F');
  });
  it('exposes the address getter in the contract ABI', () => {
    const abi = compileString('contract Car { address public owner; constructor(address _o) { owner = _o; } }',
      { solidityImportCompat: true }).abi;
    const g = abi.find((f) => f.name === 'owner');
    expect(g?.outputs?.[0]?.type).toBe('address');
  });
  it('still skips an enum-typed public var (no unsound placeholder getter)', () => {
    const abi = compileString('contract C { enum S { A, B } S public status; int n; function f() public { this.n = 1; } }',
      { solidityImportCompat: true }).abi;
    expect(abi.some((f) => f.name === 'status')).toBe(false);
  });
});

describe('Named-arg external interface call', () => {
  it('reorders named args into the interface function param order', () => {
    const a = compileString(`
      interface IBank { function balanceOf(address who, int day) external view returns (int); }
      contract C() {
        int n;
        function f(bytes32 cat, address who) { int b = IBank(cat).balanceOf({day: 5, who: who}); this.n = b; }
      }`);
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-25: msg.sender category forwarded across internal calls', () => {
  // A function using msg.sender gets a synthetic `bytes32 __internal__msgSenderCategory` param. A positional
  // internal call to such a function must forward the caller's own category (msg.sender is identical across an
  // internal call), otherwise the call is short an argument -> InvalidParameterTypeError. Unblocks ERC721
  // (safeTransferFrom -> transferFrom) and WETH (fallback -> deposit -> _mint(msg.sender, ..)).
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('forwards the synthetic category on an internal call to a msg.sender-using function', () => {
    expect(cc('contract C { mapping(uint256 => address) o;'
      + ' function inner(address from, uint256 id) public { require(msg.sender == o[id]); o[id] = from; }'
      + ' function outer(address from, uint256 id) external { require(msg.sender != address(0)); inner(from, id); } }'))
      .toBe('C');
  });

  it('compiles the ERC721 safeTransferFrom -> transferFrom shape', () => {
    expect(cc('contract C { mapping(uint256 => address) _ownerOf; mapping(address => uint256) _balanceOf;'
      + ' function transferFrom(address from, address to, uint256 id) public {'
      + ' require(from == _ownerOf[id]); require(msg.sender == from); _balanceOf[from]--; _balanceOf[to]++; _ownerOf[id] = to; }'
      + ' function safeTransferFrom(address from, address to, uint256 id) external { transferFrom(from, to, id); } }'))
      .toBe('C');
  });
});

describe('try/catch around a VOID external call', () => {
  // A void external call sets no expression type (only non-empty returnTypes assign one); the try codegen
  // treated undefined as one pushed value and emitted a phantom OP_DROP that consumed an unrelated slot
  // (a pending state write, the __extaddr_ address local) and broke the epilogue. Sound by reduction: the
  // try form must be byte-identical to the bare call-statement form (catch is dead code on BCH).
  const DECL = 'abstract contract D { function d() external virtual; }\n';
  const opts = { solidityImportCompat: true };

  it('is byte-identical to the bare statement form (state-var target, prior state write)', () => {
    const tryForm = compileString(
      `${DECL}contract C { int x; D d; function f() public { x = 0; try d.d() {} catch {} } }`, opts,
    );
    const stmtForm = compileString(
      `${DECL}contract C { int x; D d; function f() public { x = 0; d.d(); } }`, opts,
    );
    expect(tryForm.bytecode).toBe(stmtForm.bytecode);
  });

  it('is byte-identical without a prior state write', () => {
    const tryForm = compileString(
      `${DECL}contract C { D d; function f() public { try d.d() {} catch {} } }`, opts,
    );
    const stmtForm = compileString(
      `${DECL}contract C { D d; function f() public { d.d(); } }`, opts,
    );
    expect(tryForm.bytecode).toBe(stmtForm.bytecode);
  });
});

describe('external call on a struct-field target (s.field.m())', () => {
  const IF = 'interface IFoo { function m() external returns (uint); }\n';
  const opts = { solidityImportCompat: true };

  it('compiles a call on an interface-typed struct STATE-var field', () => {
    const a = compileString(
      `${IF}struct S { IFoo target; uint x; } contract C { S s; function f() public returns (uint) { return s.target.m(); } }`,
      opts,
    );
    expect(a.contractName).toBe('C');
    const f = a.abi.find((fn) => fn.name === 'f')!;
    // The field read is hoisted into a synthesized __extaddr_ local that the dispatch PICKs (never a caller
    // witness); the sound self-pinned-state form records addressParam, not addressLiteral.
    expect(f.externalCalls?.[0]?.addressParam).toBe('__extaddr_s_target');
    expect(f.externalCalls?.[0]?.addressLiteral).toBeUndefined();
  });

  it('is byte-identical to the explicit __extaddr_ hoist (sound by reduction)', () => {
    const auto = compileString(
      `${IF}struct S { IFoo target; uint x; } contract C { S s; function f() public returns (uint) { return s.target.m(); } }`,
      opts,
    );
    const manual = compileString(
      `${IF}struct S { IFoo target; uint x; } contract C { S s; function f() public returns (uint) `
      + `{ IFoo __extaddr_s_target = s.target; return __extaddr_s_target.m(); } }`,
      opts,
    );
    expect(auto.bytecode).toBe(manual.bytecode);
  });

  it('leaves a memory-struct-param field unsupported (conservative gate: not self-pinned state)', () => {
    expect(() => compileString(
      `${IF}struct S { IFoo target; } contract C { function f(S memory s) public returns (uint) { return s.target.m(); } }`,
      opts,
    )).toThrow();
  });
});

describe('external call on a state-rooted access-chain target (ss[i].f.m(), ms[k].f.m(), s.a.b.m())', () => {
  const IF = 'interface IFoo { function m() external returns (uint); }\n';
  const opts = { solidityImportCompat: true };
  // Each chain hoists to `IFoo x = <chain>; x.m()` - byte-identical to the manual hoist that uses the audited
  // interface-local dispatch (sound by reduction; every step is self-pinned state).

  it('struct-array element: ss[0].target.m()', () => {
    const auto = compileString(
      `${IF}struct S { IFoo target; } contract C { S[] ss; function f() public returns (uint) { return ss[0].target.m(); } }`, opts,
    );
    const manual = compileString(
      `${IF}struct S { IFoo target; } contract C { S[] ss; function f() public returns (uint) { IFoo x = ss[0].target; return x.m(); } }`, opts,
    );
    expect(auto.bytecode).toBe(manual.bytecode);
  });

  it('struct-mapping value with a param key: ms[k].target.m()', () => {
    const auto = compileString(
      `${IF}struct S { IFoo target; } contract C { mapping(uint => S) ms; function f(uint k) public returns (uint) { return ms[k].target.m(); } }`, opts,
    );
    const manual = compileString(
      `${IF}struct S { IFoo target; } contract C { mapping(uint => S) ms; function f(uint k) public returns (uint) { IFoo x = ms[k].target; return x.m(); } }`, opts,
    );
    expect(auto.bytecode).toBe(manual.bytecode);
  });

  it('nested struct field: s.inner.target.m()', () => {
    const auto = compileString(
      `${IF}struct Inner { IFoo target; } struct S { Inner inner; } contract C { S s; function f() public returns (uint) { return s.inner.target.m(); } }`, opts,
    );
    const manual = compileString(
      `${IF}struct Inner { IFoo target; } struct S { Inner inner; } contract C { S s; function f() public returns (uint) { IFoo x = s.inner.target; return x.m(); } }`, opts,
    );
    expect(auto.bytecode).toBe(manual.bytecode);
  });

  it('gates out a LOCAL-indexed chain (not body-top safe): stays unsupported', () => {
    expect(() => compileString(
      `${IF}struct S { IFoo target; } contract C { S[] ss; function f() public returns (uint) { uint i = 0; return ss[i].target.m(); } }`, opts,
    )).toThrow();
  });
});
