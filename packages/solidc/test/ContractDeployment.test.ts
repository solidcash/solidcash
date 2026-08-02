import { describe, it, expect, vi } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

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
  it('a SINGLE deploy inside a while-loop COMPILES', () => {
    expect(compileString(cc('function f(uint n) external { uint i=0; while (i<n) { Child ch = new Child(); i=i+1; } require(true); }'),
      compat).contractName).toBe('C');
  });
  it('a SINGLE deploy inside a do-while-loop COMPILES', () => {
    expect(compileString(cc('function f(uint n) external { uint i=0; do { Child ch = new Child(); i=i+1; } while (i<n); require(true); }'),
      compat).contractName).toBe('C');
  });
  it('MULTIPLE same-contract deploy sites with a conditional one COMPILE (function-level runtime counter)', () => {
    expect(compileString(cc('function f(uint c) external { Child a = new Child(); if (c==1) { Child b = new Child(); }'
      + ' require(true); }'), compat).contractName).toBe('C');
  });
  it('two conditional same-contract deploy sites COMPILE', () => {
    expect(compileString(cc('function f(uint c) external { if (c==1) { Child a = new Child(); } if (c==2) { Child b = new Child(); }'
      + ' require(true); }'), compat).contractName).toBe('C');
  });
  it('multi-site with DIFFERENT child contracts still throws (heterogeneous stride not SDK-derivable)', () => {
    const two = 'contract Child { int x; constructor() { x = 1; } } contract Other { int y; constructor() { y = 2; } }';
    expect(() => compileString(`${two} contract C { function f(uint c) external { Child a = new Child();`
      + ' if (c==1) { Other b = new Other(); } require(true); } }', compat))
      .toThrow(/inside a conditional branch or loop is not yet implemented/);
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

  it('does not warn when authenticated against a key the caller cannot choose (constructor key)', () => {
    expect(warns('contract C(pubkey admin) { int n;'
      + ' function kill(sig s, address to) { require(checkSig(s, admin)); selfdestruct(to); } }')).toBe(false);
  });

  it('does not warn when the destination comes from contract state', () => {
    expect(warns('contract C(pubkey admin) { address beneficiary; int n;'
      + ' function kill() { require(true); selfdestruct(this.beneficiary); } }')).toBe(false);
  });

  // SEC-16: "there is a checkSig somewhere in this body" is the wrong question. A signature check authenticates
  // only the holder of the KEY it checks, so `require(checkSig(s, pk))` with a CALLER-SUPPLIED pk proves the
  // spender signed with a key they chose - it authorizes nobody and must not silence the diagnostic. Measured on
  // dbb15944: all three hostile rows below compiled silent. The pairs share every incidental feature (a `sig`
  // param, a `pubkey` param, an `address` param) and differ only in where the checked key comes from, so the
  // warning is credited to the key rather than to "this function has a pubkey parameter".
  describe('SEC-16: the signature check must authorize a key the caller cannot choose', () => {
    it('WARNS on checkSig against a caller-supplied pubkey', () => {
      expect(warns('contract C(pubkey admin) { int n;'
        + ' function kill(sig s, pubkey pk, address to) external {'
        + ' require(checkSig(s, pk)); selfdestruct(to); } }')).toBe(true);
    });

    it('stays silent on the same shape when the key is the constructor key', () => {
      expect(warns('contract C(pubkey admin) { int n;'
        + ' function kill(sig s, pubkey pk, address to) external {'
        + ' require(checkSig(s, admin)); selfdestruct(to); } }')).toBe(false);
    });

    it('stays silent on the same shape when the key is a state variable', () => {
      expect(warns('contract C(pubkey admin) { pubkey owner; int n;'
        + ' function kill(sig s, pubkey pk, address to) external {'
        + ' require(checkSig(s, this.owner)); selfdestruct(to); } }')).toBe(false);
    });

    it('WARNS when an alias is rebound to a caller key after being declared from the constructor key', () => {
      expect(warns('contract C(pubkey admin) { int n;'
        + ' function kill(sig s, pubkey pk, address to) external {'
        + ' pubkey k = admin; k = pk; require(checkSig(s, k)); selfdestruct(to); } }')).toBe(true);
    });

    it('WARNS on checkDataSig, whose key is argument 2', () => {
      expect(warns('contract C(pubkey admin) { int n;'
        + ' function kill(datasig ds, bytes m, pubkey pk, address to) external {'
        + ' require(checkDataSig(ds, m, pk)); selfdestruct(to); } }')).toBe(true);
    });

    it('stays silent on checkDataSig against the constructor key', () => {
      expect(warns('contract C(pubkey admin) { int n;'
        + ' function kill(datasig ds, bytes m, pubkey pk, address to) external {'
        + ' require(checkDataSig(ds, m, admin)); selfdestruct(to); } }')).toBe(false);
    });

    it('WARNS on checkMultiSig against a caller-supplied key list', () => {
      expect(warns('contract C(pubkey admin) { int n;'
        + ' function kill(sig[2] ss, pubkey[2] pks, address to) external {'
        + ' require(checkMultiSig(ss, pks)); selfdestruct(to); } }')).toBe(true);
    });

    it('WARNS when the caller key is only reached through a cast', () => {
      expect(warns('contract C(pubkey admin) { int n;'
        + ' function kill(sig s, bytes33 raw, address to) external {'
        + ' require(checkSig(s, pubkey(raw))); selfdestruct(to); } }')).toBe(true);
    });

    // An index only SELECTS among stored keys, so the CONTAINER decides the bytes: the ordinary multi-owner
    // shape must not start warning just because the caller picks `i`.
    it('stays silent when a caller-chosen index selects among keys held in state', () => {
      expect(warns('contract C(pubkey admin) { pubkey[3] owners; int n;'
        + ' function kill(sig s, pubkey pk, int i, address to) external {'
        + ' require(checkSig(s, this.owners[i])); selfdestruct(to); } }')).toBe(false);
    });

    // One genuine guard is enough; the hostile check alongside it neither adds nor removes authority.
    it('stays silent when a hostile check sits beside a genuine one', () => {
      expect(warns('contract C(pubkey admin) { int n;'
        + ' function kill(sig s, sig s2, pubkey pk, address to) external {'
        + ' require(checkSig(s, pk)); require(checkSig(s2, admin)); selfdestruct(to); } }')).toBe(false);
    });

    it('WARNS when the caller-supplied destination is wrapped and the key is caller-supplied', () => {
      expect(warns('contract C(pubkey admin) { int n;'
        + ' function kill(sig s, pubkey pk, bytes20 to) external {'
        + ' require(checkSig(s, pk)); selfdestruct(new LockingBytecodeP2PKH(to)); } }')).toBe(true);
    });
  });

  /**
   * SEC-17. Reading the key's provenance alone makes the standard BCH admin-upgrade idiom look self-authorizing:
   * the caller passes `pk` in and commits it in the same breath with `require(hash160(pk) == this.pkh)`, so the
   * only key they may supply is the one whose hash is already stored. Measured: 7 spellings warned here and the
   * same 7 at the delegatecall site, 14 false positives. Every row below keeps the parameter list of the
   * warning cases above, so a silence is attributable to the commitment rather than to the signature's shape.
   */
  describe('SEC-17: a key committed by a sibling require is not caller-chosen', () => {
    const sd = (decls: string, guard: string): string => 'contract C(pubkey admin, bytes20 adminPkh) {'
      + ` ${decls} int n; function kill(sig s, pubkey pk, address to, bytes20 otherPkh) external {`
      + ` ${guard} selfdestruct(to); } }`;

    it('stays silent when hash160(key) is committed to a state variable', () => {
      expect(warns(sd('bytes20 pkh;', 'require(hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(false);
    });

    it('stays silent with the operands reversed', () => {
      expect(warns(sd('bytes20 pkh;', 'require(this.pkh == hash160(pk)); require(checkSig(s, pk));'))).toBe(false);
    });

    it('stays silent when committed to a constructor argument', () => {
      expect(warns(sd('', 'require(hash160(pk) == adminPkh); require(checkSig(s, pk));'))).toBe(false);
    });

    it('stays silent through a bytes20 cast and inside an && conjunction', () => {
      expect(warns(sd('bytes20 pkh;',
        'require(bytes20(hash160(pk)) == this.pkh); require(checkSig(s, pk));'))).toBe(false);
      expect(warns(sd('bytes20 pkh;',
        'require(n > 0 && hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(false);
    });

    it('stays silent when the commitment or the check goes through an alias', () => {
      expect(warns(sd('bytes20 pkh;',
        'pubkey k = pk; require(hash160(k) == this.pkh); require(checkSig(s, pk));'))).toBe(false);
      expect(warns(sd('bytes20 pkh;',
        'pubkey k = pk; require(hash160(pk) == this.pkh); require(checkSig(s, k));'))).toBe(false);
    });

    // Negative controls: each has a hash160 call inside an equality inside a require, exactly like the silent
    // rows, and differs only in what the hash is committed TO or in whether the commitment always runs.
    it('WARNS when the hash is committed to another caller parameter', () => {
      expect(warns(sd('bytes20 pkh;', 'require(hash160(pk) == otherPkh); require(checkSig(s, pk));'))).toBe(true);
    });

    it('WARNS when the commitment is conditional (an if-arm or an || branch)', () => {
      expect(warns(sd('bytes20 pkh;',
        'if (n > 0) { require(hash160(pk) == this.pkh); } require(checkSig(s, pk));'))).toBe(true);
      expect(warns(sd('bytes20 pkh;',
        'require(n > 0 || hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(true);
    });

    it('WARNS on an inequality and on a self-referential commitment', () => {
      expect(warns(sd('bytes20 pkh;', 'require(hash160(pk) != this.pkh); require(checkSig(s, pk));'))).toBe(true);
      expect(warns(sd('bytes20 pkh;',
        'require(hash160(pk) == hash160(pk)); require(checkSig(s, pk));'))).toBe(true);
    });

    // The commitment decision is memoized per name. Before that, the cycle marker set on the first visit made
    // the SECOND occurrence of the same committed key resolve the other way, so one key expression answered
    // twice and the idiom warned regardless - measured on the first version of this fix.
    it('resolves a committed key the same way each time it appears in one key expression', () => {
      expect(warns('contract C(pubkey admin) { bytes20 pkh; int n;'
        + ' function kill(sig[2] ss, pubkey pk, address to) external {'
        + ' require(hash160(pk) == this.pkh); require(checkMultiSig(ss, [pk, pk])); selfdestruct(to); } }'))
        .toBe(false);
    });
  });

  /**
   * X46. SEC-17 read the key's BINDING and stopped there: `this.pkh` is a state variable, and a state variable
   * is not caller-chosen, so the commitment was credited however that variable came to hold its value. Scalar
   * state is read after write - measured on the BCH-2026 VM, `this.pkh = a; require(this.pkh == a)` settles for
   * an arbitrary `a` while the same require without the write rejects at input 0 - so writing the key hash from
   * a caller parameter one statement earlier makes the commitment compare `pk` against bytes the caller just
   * supplied. That is not a theoretical gap: `packages/solidcash/test/e2e/X46CommitmentWriter.test.ts` drains an
   * alice-owned contract to bob through exactly this shape, and this diagnostic was silent on it.
   *
   * Only writes BEFORE the commitment count. The key-ROTATION idiom (commit, authenticate, then store the new
   * hash) writes after, and must stay silent or the fix trades one false positive for another.
   */
  describe('X46: the commitment reads the WRITER of what the key is bound to', () => {
    const sd = (decls: string, guard: string): string => 'contract C(pubkey admin, bytes20 adminPkh) {'
      + ` ${decls} int n; function kill(sig s, pubkey pk, address to, bytes20 otherPkh) external {`
      + ` ${guard} selfdestruct(to); } }`;

    it('WARNS when the committed state variable is written from a caller parameter first', () => {
      expect(warns(sd('bytes20 pkh;',
        'this.pkh = otherPkh; require(hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(true);
    });

    it('WARNS when the write is hash160 of the caller key itself', () => {
      expect(warns(sd('bytes20 pkh;',
        'this.pkh = hash160(pk); require(hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(true);
    });

    it('WARNS when the tainted read reaches the commitment through a local alias', () => {
      expect(warns(sd('bytes20 pkh;',
        'this.pkh = otherPkh; bytes20 z = this.pkh; require(hash160(pk) == z); require(checkSig(s, pk));')))
        .toBe(true);
    });

    it('WARNS when the write sits in an if-arm that may run', () => {
      expect(warns(sd('bytes20 pkh;',
        'if (n > 0) { this.pkh = otherPkh; } require(hash160(pk) == this.pkh); require(checkSig(s, pk));')))
        .toBe(true);
    });

    it('WARNS for a mapping entry written from a caller parameter and then committed against', () => {
      expect(warns(sd('mapping(int => bytes20) admins;',
        'this.admins[1] = otherPkh; require(hash160(pk) == this.admins[1]); require(checkSig(s, pk));')))
        .toBe(true);
    });

    // Controls. Each has a state write and the same commitment; they differ only in WHEN the write happens or
    // in whether its value is caller-chosen, so a silence is attributable to the writer and not to "any state
    // write in the body silences/fires this".
    it('stays silent for the key-ROTATION idiom, which writes AFTER the commitment', () => {
      expect(warns(sd('bytes20 pkh;',
        'require(hash160(pk) == this.pkh); require(checkSig(s, pk)); this.pkh = otherPkh;'))).toBe(false);
    });

    it('stays silent when the preceding write takes its value from a constructor argument', () => {
      expect(warns(sd('bytes20 pkh;',
        'this.pkh = adminPkh; require(hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(false);
    });

    it('stays silent when the preceding write is to an unrelated state variable', () => {
      expect(warns(sd('bytes20 pkh; bytes20 spare;',
        'this.spare = otherPkh; require(hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(false);
      expect(warns(sd('bytes20 pkh;',
        'this.n = this.n + 1; require(hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(false);
    });
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
    compileString(child('constructor(uint _x) { x = _x; }') + use, {
      solidityImportCompat: true, hiddenBatch: false,
    });
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
