import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// File structure and imports: pragma, declaration order, multiple top-level defs, interface/declaration-only files.

describe('solidityImportCompat', () => {
  const SRC = 'pragma solidity =0.5.17;\ncontract C() { int n; function f() { this.n = 1; } }';

  it('accepts `pragma solidity` and skips the version check under the option', () => {
    expect(compileString(SRC, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rejects `pragma solidity` without the option (clean error)', () => {
    expect(() => compileString(SRC)).toThrow(/solidityImportCompat/);
  });

  it('tolerates no-op EVM pragmas (`abicoder`, `experimental`) as no-ops', () => {
    const abicoder = 'pragma solidity ^0.8.0;\npragma abicoder v2;\ncontract C() { function f() { require(true); } }';
    expect(compileString(abicoder, { solidityImportCompat: true }).contractName).toBe('C');
    const experimental = 'pragma experimental ABIEncoderV2;\npragma solidity ^0.8.0;\n'
      + 'contract C() { function f() { require(true); } }';
    expect(compileString(experimental, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('parses an imported source whose own `pragma solidity` would otherwise fail', () => {
    const resolver = (p: string): { source: string; id: string } | undefined => (p.includes('Dep')
      ? { source: 'pragma solidity ^0.5.0;\nlibrary L { function two() returns (int) { return 2; } }', id: 'Dep' }
      : undefined);
    const a = compileString(
      'pragma solidity ^0.5.0;\nimport "./Dep.sol";\ncontract C() { int n; function f() { this.n = 1; } }',
      { solidityImportCompat: true, importResolver: resolver },
    );
    expect(a.contractName).toBe('C');
  });
});

describe('Solidity-compat features (OpenZeppelin imports)', () => {
  it('accepts visibility modifiers on interface functions (ignored)', () => {
    const a = compileString(`
      interface I { function bal(int x) external view returns (int); function poke() external; }
      contract C() is I {
        int n;
        function bal(int x) returns (int) { return x; }
        function poke() { this.n = this.n + 1; }
      }`);
    expect(a.contractName).toBe('C');
  });

  it('accepts `using ... for ...` inside a library body', () => {
    const a = compileString(`
      library Math { using Math for int; function dbl(int x) returns (int) { return x * 2; } }
      contract C() { int n; function go() { this.n = 1; } }`);
    expect(a.contractName).toBe('C');
  });
});

describe('Solidity-compat features (from the minimal Sablier port)', () => {
  it('accepts `uint` as an alias for uint256', () => {
    const a = compileString('contract C() { bigint n; function f(uint x) { this.n = x; } }');
    expect(a.contractName).toBe('C');
  });

  it('accepts constructor visibility (public/internal), ignoring it', () => {
    for (const vis of ['public', 'internal']) {
      const a = compileString(`contract C() { int n; constructor() ${vis} { this.n = 1; } function f() { this.n = this.n + 1; } }`);
      expect(a.contractName).toBe('C');
    }
  });

  it('resolves a library-qualified type (Library.Type) in a type position', () => {
    const a = compileString(`
      library Types { struct Stream { int a; } }
      contract C() {
        mapping(int => Types.Stream) m;
        function f(int k) { Types.Stream s = this.m[k]; require(s.a >= 0); }
      }`);
    expect(a.contractName).toBe('C');
  });

  it('compiles address(this) to OP_INPUTINDEX OP_UTXOBYTECODE (the spent UTXO locking script)', () => {
    const a = compileString('contract C() { int n; function f(address r) { require(r != address(this)); this.n = 1; } }');
    expect(a.bytecode).toContain('OP_INPUTINDEX');
    expect(a.bytecode).toContain('OP_UTXOBYTECODE');
  });
});

describe('A1: declaration order is not enforced', () => {
  it('allows a file-level free function before the struct it uses', () => {
    const artifact = compileString(`
      function area(Rect r) returns (int) { return r.w * r.h; }
      struct Rect { int w; int h; }
      contract C() { function go() { require(area(Rect(2, 3)) == 6); } }`);
    expect(artifact.contractName).toBe('C');
  });

  it('allows contract-body members (state var, event) after a function', () => {
    const artifact = compileString(`
      contract C() {
        function bump(pubkey pk, sig s) { require(checkSig(s, pk)); emit E(this.n); this.n = this.n + 1; }
        int n;
        event E(int v);
      }`);
    expect(artifact.contractName).toBe('C');
  });

  it('allows a function to reference a constant defined later', () => {
    const artifact = compileString(`
      contract C() {
        int n;
        function f() { this.n = LIMIT; }
        int constant LIMIT = 42;
      }`);
    expect(artifact.contractName).toBe('C');
  });

  it('still rejects more than one constructor', () => {
    expect(() => compileString(`
      contract C() { int n; constructor() { this.n = 1; } constructor(int x) { this.n = x; } }`))
      .toThrow(/at most one constructor/);
  });
});

describe('Interface-only / type-only files', () => {
  it('parses an interface-only file (no trailing contract) and reports it as not directly compilable', () => {
    expect(() => compileString('interface I { function f(int x) external returns (int); }'))
      .toThrow(/do not produce artifacts|Cannot compile/);
  });

  it('parses a type-only file (UDVT + free function, no trailing contract)', () => {
    expect(() => compileString('type UD is int;\nfunction unwrap(UD x) returns (int) { return UD.unwrap(x); }'))
      .toThrow(/do not produce artifacts|Cannot compile/);
  });

  it('imports an interface-only file under solidityImportCompat', () => {
    const resolver = (p: string): { source: string; id: string } | undefined => (p.includes('IBank')
      ? { source: 'interface IBank { function bal(address who) external view returns (int); }', id: 'IBank' }
      : undefined);
    const a = compileString(
      'import { IBank } from "./IBank.sol";\ncontract C() { int n; function f(bytes32 c, address w) { this.n = IBank(c).bal(w); } }',
      { solidityImportCompat: true, importResolver: resolver },
    );
    expect(a.contractName).toBe('C');
  });
});

describe('Multiple top-level definitions per file', () => {
  it('compiles the last contract as primary, earlier ones available', () => {
    const a = compileString('contract A() { function f() returns (int) { return 1; } } contract C() { int n; function g() { this.n = 1; } }');
    expect(a.contractName).toBe('C');
  });

  it('the primary may inherit an earlier contract in the same file', () => {
    const a = compileString('contract Base() { int n; function base() { this.n = 1; } } contract C() is Base { function g() { this.n = 2; } }');
    expect(a.contractName).toBe('C');
  });

  it('interface + contract in one file', () => {
    const a = compileString('interface I { function f() external; } contract C() is I { int n; function f() { this.n = 1; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-4: function-less contracts compile (state-publishing, unspendable)', () => {
  it('a truly-empty contract compiles to an unspendable OP_RETURN script', () => {
    const a = compileString('contract Foo() {}');
    expect(a.bytecode).toBe('OP_0 OP_VERIFY');
  });

  it('a modifier-only contract compiles to OP_RETURN', () => {
    const a = compileString('contract Guard() { modifier noReentrant() { _; } }');
    expect(a.bytecode).toBe('OP_0 OP_VERIFY');
  });

  it('a storage-only Solidity contract compiles under solidityImportCompat', () => {
    const a = compileString(`pragma solidity ^0.8.26;
      contract HelloWorld { string public greet = "Hello World!"; }`, { solidityImportCompat: true });
    expect(a.contractName).toBe('HelloWorld');
  });
});

describe('SBE-22: declaration-only files compile under solidityImportCompat (solc parity)', () => {
  // solc emits an ABI + empty bytecode for a file with no executable contract (a standalone interface, a
  // file-level enum/struct, or an inline-only library). Mirror that under the flag; native solidcash keeps the
  // LibraryNotCompilableError guard.
  it('compiles a standalone interface to its ABI with empty bytecode', () => {
    const a = compileString(
      'interface IERC20 { function transfer(address to, uint256 amt) external returns (bool);'
      + ' function balanceOf(address who) external view returns (uint256); }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('IERC20');
    expect(a.bytecode).toBe('');
    expect(a.abi.map((f) => f.name).sort()).toEqual(['balanceOf', 'transfer']);
    expect(a.isLibrary).toBe(true);
  });

  it('compiles a file-level enum declaration (carries the enum)', () => {
    const a = compileString('enum Status { Pending, Shipped, Accepted }', { solidityImportCompat: true });
    expect(a.bytecode).toBe('');
    expect(a.enums?.[0]?.name).toBe('Status');
    expect(a.enums?.[0]?.members.map((m) => m.name)).toEqual(['Pending', 'Shipped', 'Accepted']);
  });

  it('compiles a file-level struct declaration', () => {
    const a = compileString('struct Todo { string text; bool done; }', { solidityImportCompat: true });
    expect(a.bytecode).toBe('');
    expect(a.abi).toHaveLength(0);
  });

  it('still throws LibraryNotCompilableError without the flag (native guard preserved)', () => {
    expect(() => compileString('interface IERC20 { function transfer(address to, uint256 amt) external; }'))
      .toThrow('libraries do not produce artifacts');
  });
});
