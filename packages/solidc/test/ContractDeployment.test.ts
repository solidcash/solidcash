import { describe, it, expect, vi } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '../src/index.js';

// Contract deployment: new C(...), create/create2 options, type(C).creationCode, selfdestruct, parent ctor.

// A stateful `new C(...)` deploy registers its child output at a fixed transaction-layout slot resolved at the
// function epilogue, so a deploy inside a conditional branch or loop (whose master-LBC/category are pushed only on
// the taken path) used to crash the codegen stack tracker with an internal "does not exist on the stack" error.
// It is now rejected cleanly with an actionable message; unconditional / bare-block / unchecked deploys are
// unaffected (they compile as before).
describe('conditional deploy (new C() inside a branch/loop)', () => {
  const CHILD = 'contract Child { int x; constructor() { x = 1; } }';
  const cc = (body: string): string => `${CHILD} contract C { ${body} }`;
  const compat = { solidityImportCompat: true };

  it('a SINGLE deploy inside an if-branch now COMPILES (verified inline at the deploy site)', () => {
    expect(compileString(cc('function f(uint c) external { if (c==1) { Child ch = new Child(); } require(true); }'),
      compat).contractName).toBe('C');
  });
  it('a SINGLE deploy inside a for-loop now COMPILES (verified inline with a runtime deploy counter)', () => {
    expect(compileString(cc('function f() external { for (uint i=0;i<2;i++) { Child ch = new Child(); } require(true); }'),
      compat).contractName).toBe('C');
  });
  it('MULTIPLE deploy sites with a conditional one still throw (needs a runtime counter to keep slots stable)', () => {
    expect(() => compileString(cc('function f(uint c) external { Child a = new Child(); if (c==1) { Child b = new Child(); }'
      + ' require(true); }'), compat)).toThrow(/inside a conditional branch or loop is not yet implemented/);
  });
  it('an unconditional deploy still compiles', () => {
    expect(compileString(cc('function f() external { Child ch = new Child(); require(true); }'), compat).contractName)
      .toBe('C');
  });
  it('a deploy in a bare block (not a branch) still compiles', () => {
    expect(compileString(cc('function f() external { { Child ch = new Child(); } require(true); }'), compat).contractName)
      .toBe('C');
  });
});

// The `deploy` modifier has been REMOVED from the grammar - it is always inferred from the deploy form: `new C()` /
// `new C{salt}()` (which mint the child's genesis), or a create3/deployFrom factory reading a genesis input's
// outpoint txhash. Writing `deploy` explicitly is now a parse-time "undefined modifier" error.
describe('deploy modifier is inferred from the deploy form (the `deploy` keyword was removed from the grammar)', () => {
  const CHILD = 'contract Child { int x; constructor(int v) { x = v; }'
    + ' function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); } }';
  const factory = (): string => `${CHILD} contract F(pubkey a) { int c;`
    + ' function make(sig s, int v) { require(checkSig(s, a)); Child ch = new Child(v); this.c = this.c + 1; }'
    + ' function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); } }';

  it('a stateful new C() infers the deploy modifier - no keyword needed', () => {
    expect(compileString(factory()).abi.find((f) => f.name === 'make')?.modifiers).toEqual(['deploy']);
  });

  it('the inferred-deploy function carries a real deploy block-layout slot (not just a label)', () => {
    const make = compileString(factory()).abi.find((f) => f.name === 'make');
    expect(make?.blockLayout?.slots.some((s) => s.kind === 'deploy')).toBe(true);
  });

  it('writing an explicit `deploy` modifier is now rejected (keyword removed from the grammar)', () => {
    expect(() => compileString(`${CHILD} contract F(pubkey a) { int c;`
      + ' function make(sig s, int v) deploy { Child ch = new Child(v); this.c = this.c + 1; }'
      + ' function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); } }'))
      .toThrow(/[Uu]ndefined modifier/);
  });
});

describe('SBE-18: parent-constructor args (inheritance-list + constructor-level) inline the parent ctor body', () => {
  // Uses int state vars (not string) so the two inlined parent writes don't hit the W5 two-distinct-dynamic-
  // var-write limit (the ERC20 name+symbol pattern), which is orthogonal to the inlining feature under test.
  const BASES = 'contract X { int nm; constructor(int _n) { nm = _n; } }'
    + ' contract Y { int tt; constructor(int _t) { tt = _t; } }';
  it('inheritance-list args: contract B is X(1), Y(2)', () => {
    expect(compileString(`${BASES} contract B is X(1), Y(2) {}`, { solidityImportCompat: true }).contractName)
      .toBe('B');
  });
  it('constructor-level args: constructor() X(1) Y(2)', () => {
    expect(compileString(`${BASES} contract E is X, Y { constructor() X(1) Y(2) {} }`,
      { solidityImportCompat: true }).contractName).toBe('E');
  });
  it('inlines + substitutes the parent ctor body (a wrong-typed arg is a type error)', () => {
    expect(() => compileString(
      'contract Base { int b; constructor(int _x) { b = _x; } } contract C is Base { constructor() Base("oops") {} }',
      { solidityImportCompat: true })).toThrow();
  });
  it('checks the parent ctor arg count against the parent constructor params', () => {
    expect(() => compileString(
      'contract Base { int b; constructor(int _x) { b = _x; } } contract C is Base { constructor() Base(1, 2) {} }',
      { solidityImportCompat: true })).toThrow(/expects 1/);
  });
});

describe('SBE-20: selfdestruct(addr) implies the selfdestruct modifier and pins output 0 to addr', () => {
  const AUTH = 'contract C(pubkey admin) { int counter;'
    + ' function kill(sig s, address to) { require(checkSig(s, admin)); selfdestruct(to); } }';

  it('implies the selfdestruct modifier in the ABI', () => {
    const artifact = compileString(AUTH);
    const kill = artifact.abi.find((f) => f.name === 'kill');
    expect(kill?.modifiers).toContain('selfdestruct');
  });

  it('pins output 0 to addr (OP_OUTPUTBYTECODE) and pins the value (single-output check)', () => {
    const stmt = bytecodeToAsm(hexToBin(compileString(AUTH).debug.bytecode));
    const modOnly = bytecodeToAsm(hexToBin(compileString(
      'contract C(pubkey admin) { int counter;'
      + ' function kill(sig s) selfdestruct { require(checkSig(s, admin)); } }',
    ).debug.bytecode));
    // Address pin: outputs[0].lockingBytecode == addr (statement-specific; absent from the modifier-only form).
    expect(stmt).toContain('OP_OUTPUTBYTECODE');
    expect(modOnly).not.toContain('OP_OUTPUTBYTECODE');
    // Value pin: exactly one output, so the freed value can only land at addr (or miner fee), never siphoned.
    expect(stmt).toContain('OP_TXOUTPUTCOUNT OP_1 OP_NUMEQUALVERIFY');
    // Value floor: sum all input values (loop) then require (inputSum - outputs[0].value) < 2000 (the fee).
    expect(stmt).toContain('OP_TXINPUTCOUNT OP_1SUB OP_BEGIN');
    expect(stmt).toContain('OP_OUTPUTVALUE OP_SUB');
  });

  it('accepts a selfdestruct as a valid terminal statement (no trailing require needed)', () => {
    // selfdestruct halts the contract, so - like Solidity revert/return - it ends a path validly without a
    // forced require. The caller-controlled-destination risk is surfaced separately as a warning (below).
    expect(compileString(
      'contract C() { address beneficiary; function kill() { selfdestruct(this.beneficiary); } }',
    ).contractName).toBe('C');
  });
});

describe('selfdestruct caller-controlled destination warning (no-auth footgun, not an error)', () => {
  const warns = (src: string): boolean => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString(src); // must COMPILE - it is a warning, not an error
    const w = spy.mock.calls.some((c) => String(c[0]).includes('sends the freed balance to a caller-supplied'));
    spy.mockRestore();
    return w;
  };

  it('warns on a no-auth selfdestruct to a caller-supplied address (and still compiles)', () => {
    expect(warns('contract C(pubkey admin) { int n;'
      + ' function kill(address to) { require(true); selfdestruct(to); } }')).toBe(true);
  });

  it('warns when the caller-supplied address is wrapped (new LockingBytecodeP2PKH(to))', () => {
    expect(warns('contract C(pubkey admin) { int n;'
      + ' function kill(bytes20 to) { require(true); selfdestruct(new LockingBytecodeP2PKH(to)); } }')).toBe(true);
  });

  it('does not warn when authenticated with a signature check', () => {
    expect(warns('contract C(pubkey admin) { int n;'
      + ' function kill(sig s, address to) { require(checkSig(s, admin)); selfdestruct(to); } }')).toBe(false);
  });

  it('does not warn when the destination comes from contract state', () => {
    expect(warns('contract C(pubkey admin) { address beneficiary; int n;'
      + ' function kill() { require(true); selfdestruct(this.beneficiary); } }')).toBe(false);
  });
});

describe('SBE-26: a constructor declaring its own params can pass them to a parent invocation', () => {
  // Solidity pattern `constructor(uint256 _x) Base(_x) {}`: the ctor declares its OWN params (no contract-level
  // equivalent). They must be registered so the parent-invocation args (and body) resolve; previously they were
  // dropped (assuming the native pattern where ctor params mirror contract-level params).
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('resolves the ctor param in the parent invocation', () => {
    expect(cc('abstract contract B { uint256 n; constructor(uint256 _n) { n = _n; } }'
      + ' contract C is B { constructor(uint256 _x) B(_x) {} function f() external { require(true); } }'))
      .toBe('C');
  });
});

// `new C(args)` where C uses a Solidity `constructor(args)` (params on constructorDef, not the solidcash
// contract-level parameter list) - the deploy arg-count + arg-type checks now read the effective params.
describe('new C(args) with a Solidity constructor', () => {
  it('type-checks constructor args from constructorDef', () => {
    const a = compileString(
      'contract Foo { address public owner; constructor(address _owner) { owner = _owner; } }'
      + ' contract Bar { Foo foo; constructor() { foo = new Foo(msg.sender); } function f() public {} }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('Bar');
    expect(() => compileString(
      'contract Foo { constructor(address a) {} } contract Bar { Foo foo; constructor() { foo = new Foo(); } function f() public {} }',
      { solidityImportCompat: true },
    )).toThrow(/constructor argument/i);
  });
});

// Solidity wraps `new C` in parens when passing create/create2 options: `(new C){value:.., salt:..}(args)`.
// Same InstantiationNode as the already-supported `new C{opts}(args)`. `{value}` funds the deploy; `{salt}` is
// inert on BCH (contract addresses are content-addressed P2SH32, so create2 determinism is native).
describe('parenthesized instantiation with options ((new C){value/salt}(args))', () => {
  const base = 'contract Car { address o; constructor(address _o) payable { o = _o; } }';
  const cc = (body: string): string => compileString(
    `${base} contract F { Car[] cars; function c(address o, bytes32 s) public payable { ${body} cars.push(car); } }`,
    { solidityImportCompat: true },
  ).contractName;
  it('accepts {value:} (create with value)', () => {
    expect(cc('Car car = (new Car){value: msg.value}(o);')).toBe('F');
  });
  it('accepts {salt:} (create2)', () => {
    expect(cc('Car car = (new Car){salt: s}(o);')).toBe('F');
  });
  it('accepts {value:, salt:} together', () => {
    expect(cc('Car car = (new Car){value: msg.value, salt: s}(o);')).toBe('F');
  });
  it('matches the non-parenthesized `new C{opts}(args)` form byte-for-byte', () => {
    const paren = compileString(`${base} contract F { Car[] cars; function c(address o) public payable {`
      + ' Car car = (new Car){value: msg.value}(o); cars.push(car); } }', { solidityImportCompat: true });
    const bare = compileString(`${base} contract F { Car[] cars; function c(address o) public payable {`
      + ' Car car = new Car{value: msg.value}(o); cars.push(car); } }', { solidityImportCompat: true });
    expect(paren.bytecode).toBe(bare.bytecode);
  });
});

// A constructor external read (`token0 = IERC20(pool.token0())`) has no on-chain-constructor analogue on BCH;
// it is hoisted to a synthesized deploy-input parameter that the deployer resolves off-chain. This lets a
// read-derived immutable be used as an external-call target (UniswapV3Flash). See docs/deploy-external-reads.md.
describe('constructor external read hoisted to a deploy input', () => {
  const compile = (src: string): ReturnType<typeof compileString> =>
    compileString(src, { solidityImportCompat: true });
  const pre = 'interface IPool { function token0() external view returns (address); }'
    + ' interface IERC20 { function tf(address a, uint v) external; } ';
  const src = `${pre} contract C { IPool immutable pool; IERC20 immutable token0;`
    + ' constructor(address _p) { pool = IPool(_p); token0 = IERC20(pool.token0()); }'
    + ' function f() external { token0.tf(msg.sender, 1); } }';
  it('compiles a call-derived immutable used as an external-call target', () => {
    expect(compile(src).contractName).toBe('C');
  });
  it('surfaces the hoisted read as a constructor input', () => {
    const inputs = compile(src).stateLayout?.constructorInputs ?? [];
    expect(inputs.some((i) => i.name.startsWith('__ctorread_pool_token0'))).toBe(true);
    // The original param stays first; the hoisted read is appended.
    expect(inputs[0]?.name).toBe('_p');
  });
});

// An extracted/`OP_DEFINE`d function body (e.g. a public `pure` returning function) is compiled by a
// sub-traversal that must inherit compiledBytecodes, so `type(Child).creationCode` / `new Child()` inside it can
// embed the child's compiled bytecode. Previously the sub-traversal had an empty map -> "bytecode not available".
describe('type(C).creationCode inside an extracted function body', () => {
  const child = 'contract Child { int x; function f() public { this.x = 1; } }';
  it('resolves type(Child).creationCode from a returning function (the getBytecode idiom)', () => {
    const a = compileString(`${child} contract P {`
      + ' function getBytecode() external pure returns (bytes memory) { return type(Child).creationCode; } }',
    { solidityImportCompat: true });
    expect(a.contractName).toBe('P');
  });
  it('resolves type(Child).creationCode appended with abi.encode args (getBytecode2 idiom)', () => {
    const a = compileString(`${child} contract P {`
      + ' function getBytecode(uint256 v) external pure returns (bytes memory) {'
      + ' return abi.encodePacked(type(Child).creationCode, abi.encode(v)); } }',
    { solidityImportCompat: true });
    expect(a.contractName).toBe('P');
  });
});

// `type(X).creationCode` on BCH is X's redeem script WITHOUT constructor args (args are prepended at deploy).
// The Solidity idiom appends them (`abi.encodePacked(creationCode, abi.encode(args))`), which will not match a
// `new X(args)` address on BCH - so warn for a contract that HAS constructor parameters (only).
describe('type(X).creationCode constructor-args warning', () => {
  const child = (ctor: string): string => `contract Child { uint x; ${ctor} function f() public view returns (uint) { return x; } }`;
  const use = 'contract P { function g(uint v) external pure returns (bytes memory) {'
    + ' return abi.encodePacked(type(Child).creationCode, abi.encode(v)); } }';
  it('warns when the child has constructor parameters', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString(child('constructor(uint _x) { x = _x; }') + use, { solidityImportCompat: true });
    const w = spy.mock.calls.filter((c) => String(c[0]).includes('does not include constructor'));
    spy.mockRestore();
    expect(w.length).toBe(1);
  });
  it('does not warn for a child with no constructor parameters', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract Child { int x; function f() public { this.x = 1; } }'
      + ' contract P { function g() external pure returns (bytes memory) { return type(Child).creationCode; } }',
    { solidityImportCompat: true });
    const w = spy.mock.calls.filter((c) => String(c[0]).includes('does not include constructor'));
    spy.mockRestore();
    expect(w.length).toBe(0);
  });
});

describe('chained sibling deployment (C deploys B, B deploys A)', () => {
  // The reference collection is transitive and topologically ordered (A compiles before B, B before C),
  // the child re-analysis wrapper carries the file's definitions, and a child ctor's synthetic
  // __internal__ params (e.g. a ctor msg.sender read) are excluded from call-site arg checks.
  it('compiles a three-contract deploy chain with a ctor msg.sender read in the leaf', () => {
    const src = `
      contract A {
          uint x;
          address immutable owner;
          constructor() { owner = msg.sender; }
          function getX() public view returns (uint) { return x; }
      }
      contract B {
          A a;
          constructor() { a = new A(); }
          function getX() public view returns (uint) { return a.getX(); }
      }
      contract C {
          B b;
          constructor() { b = new B(); }
          function f() public view { assert(b.getX() == 0); }
      }`;
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});
