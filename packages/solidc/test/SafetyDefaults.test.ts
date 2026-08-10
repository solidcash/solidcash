import { describe, it, expect, vi } from 'vitest';
import { compileString as compileStringRaw } from '../src/index.js';
import { compileString } from './direct-compile.js';
import * as Errors from '../src/Errors.js';

// Behaviours that used to be gated behind solidityImportCompat but are now plain SolidCash defaults.
// See packages/solidc/docs/solidity-import-compat.md ("SolidCash defaults" section).

// Spending paths that perform no require()/verification and change no state compile to an
// unconditionally-spendable script. This is rejected by default; the unsafe opt-out retains a warning.
describe('FinalRequire: error by default, warning only under explicit opt-out', () => {
  const unverifiedPaths: [string, string][] = [
    ['do-while with no require', 'contract Loopy() { function doLoop() { int i = 0;'
      + ' do { i = i + 1; } while (i < tx.inputs.length); } }'],
    ['final local array push', 'contract Test() { function test() { int[] arr = [1, 2, 3]; arr.push(4); } }'],
    ['final array push after a console.log', 'contract Test() { function test() { int[] arr = [1, 2, 3];'
      + ' int x = 5; console.log(x); arr.push(1); } }'],
    ['do-while loop no require', 'pragma solidcash >=0.8.0; contract BadLoop() { function doLoop() { int i = 0;'
      + ' do { i = i + 1; } while (i < 3); } }'],
    ['for loop no require', 'contract ForLoopNoRequire() { function doLoop() { int total = 0;'
      + ' for (int i = 0; i < 3; i = i + 1) { total = total + 1; } } }'],
    ['if-branch local with no verification', 'contract Test() { function hello(sig s, pubkey pk) {'
      + ' if (checkSig(s, pk)) { string x = "Hello"; } } }'],
  ];

  it.each(unverifiedPaths)('throws FinalRequireStatementError by default: %s', (_label, src) => {
    expect(() => compileStringRaw(src, { messageBus: false })).toThrow(Errors.FinalRequireStatementError);
  });

  it.each(unverifiedPaths)('compiles only with enforceFinalRequire false (warning): %s', (_label, src) => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(compileStringRaw(src, { messageBus: false, enforceFinalRequire: false }).contractName).toBeTruthy();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unconditionally-spendable'));
    warn.mockRestore();
  });

  it('emits the unconditionally-spendable warning under the explicit opt-out', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileStringRaw('contract C() { function f(int i) pure { if (i <= 100) { revert("x"); } } }', {
      messageBus: false, enforceFinalRequire: false,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unconditionally-spendable'));
    warn.mockRestore();
  });

  it('allows a non-final require to gate the path (require not last)', () => {
    const a = compileString('contract C() { mapping(int=>int) m; function f(int k) { require(k > 0); delete m[k]; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('Caller-controlled destructive authority is rejected by default', () => {
  it('rejects a directly caller-selected delegate implementation', () => {
    expect(() => compileStringRaw(`contract P() { bigint counter;
      function up(bytes input, address impl) external {
        impl.delegatecall(input); require(input.length > 0);
      } }`, { messageBus: false })).toThrow(Errors.UntrustedDelegatecallTargetError);
  });

  it('does not mistake a length check for an implementation identity binding', () => {
    expect(() => compileStringRaw(`contract P() { bigint counter;
      function up(bytes input, bytes target) external {
        require(target.length == 35); address impl = address(target);
        impl.delegatecall(input); require(input.length > 0);
      } }`, { messageBus: false })).toThrow(Errors.UntrustedDelegatecallTargetError);
  });

  it('allows an unconditional equality binding to stored implementation identity', () => {
    expect(compileStringRaw(`contract P(address trusted) { bigint counter;
      function up(bytes input, address impl) external {
        require(impl == trusted); impl.delegatecall(input); require(input.length > 0);
      } }`, { messageBus: false }).contractName).toBe('P');
  });

  it('rejects permissionless selfdestruct to a caller-selected recipient', () => {
    expect(() => compileStringRaw(`contract C() { int n;
      function kill(address to) { require(true); selfdestruct(to); }
    }`, { messageBus: false })).toThrow(Errors.UnauthenticatedSelfdestructError);
  });

  it('follows aliases and casts to a caller-selected selfdestruct recipient', () => {
    expect(() => compileStringRaw(`contract C() { int n;
      function kill(bytes target) { address to = address(target); require(true); selfdestruct(to); }
    }`, { messageBus: false })).toThrow(Errors.UnauthenticatedSelfdestructError);
  });

  it('allows selfdestruct to a recipient fixed in state', () => {
    expect(compileStringRaw(`contract C() { address beneficiary; int n;
      function kill() { require(true); selfdestruct(this.beneficiary); }
    }`, { messageBus: false }).contractName).toBe('C');
  });

  it('retains a loud, explicit migration escape hatch', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(compileStringRaw(`contract C() { int n;
      function kill(address to) { require(true); selfdestruct(to); }
    }`, { messageBus: false, allowUnsafeOperations: true }).contractName).toBe('C');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('caller-supplied address'));
    warn.mockRestore();
  });

  it.each([
    ['discarded', 'checkSig(s, owner); impl.delegatecall(input); require(input.length > 0);'],
    ['conditional', 'if (ok) { require(checkSig(s, owner)); } impl.delegatecall(input); require(input.length > 0);'],
    ['after', 'impl.delegatecall(input); require(checkSig(s, owner));'],
  ])('does not accept a %s signature check before caller-selected delegation', (_label, body) => {
    expect(() => compileStringRaw(`contract P(pubkey owner) { bigint counter;
      function up(bytes input, address impl, sig s, bool ok) external { ${body} }
    }`, { messageBus: false })).toThrow(Errors.UntrustedDelegatecallTargetError);
  });

  it.each([
    ['discarded', 'checkSig(s, owner); selfdestruct(to);'],
    ['conditional', 'if (ok) { require(checkSig(s, owner)); } selfdestruct(to);'],
    ['after', 'selfdestruct(to); require(checkSig(s, owner));'],
  ])('does not accept a %s signature check for caller-directed destruction', (_label, body) => {
    expect(() => compileStringRaw(`contract C(pubkey owner) { int n;
      function kill(address to, sig s, bool ok) { ${body} }
    }`, { messageBus: false })).toThrow(Errors.UnauthenticatedSelfdestructError);
  });

  it('allows a required trusted signature that dominates the operation', () => {
    expect(compileStringRaw(`contract C(pubkey owner) { int n;
      function kill(address to, sig s) { require(checkSig(s, owner)); selfdestruct(to); }
    }`, { messageBus: false }).contractName).toBe('C');
  });

  it.each([
    'if (ok) { selfdestruct(to); } require(ok);',
    'unchecked { selfdestruct(to); } require(ok);',
    'while (ok) { selfdestruct(to); ok = false; } require(!ok);',
  ])('rejects nested selfdestruct lifecycle placement: %s', (body) => {
    expect(() => compileStringRaw(`contract C { int n;
      function kill(address to, bool ok) { ${body} }
    }`, { messageBus: false })).toThrow(Errors.NestedSelfdestructError);
  });

  it('records disabled checks in compiler metadata', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const artifact = compileStringRaw(`contract C { int n;
      function kill(address to) { require(true); selfdestruct(to); }
    }`, { messageBus: false, allowUnsafeOperations: true, enforceFinalRequire: false });
    expect(artifact.compiler?.options?.allowUnsafeOperations).toBe(true);
    expect(artifact.compiler?.options?.enforceFinalRequire).toBe(false);
    warn.mockRestore();
  });
});

// Empty functions (receive()/fallback() and any regular void function) synthesize a state-preserving no-op spend
// path (require(true)) with a warning - a plain default now (was gated behind solidityImportCompat).
describe('Empty receive/fallback synthesized by default', () => {
  it('compiles an empty receive() natively and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(compileString('contract C() { receive() external payable {} }').contractName).toBe('C');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('receive()'));
    warn.mockRestore();
  });

  it('compiles an empty fallback() natively and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(compileString('contract C() { fallback() external {} }').contractName).toBe('C');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('fallback()'));
    warn.mockRestore();
  });

  it('synthesizes a no-op body for a regular empty function (default; was compat-gated)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(compileString('contract C() { function f() {} }').contractName).toBe('C');
    warn.mockRestore();
  });

  it('synthesizes a regular empty function under solidityImportCompat', () => {
    expect(compileString('contract C() { function f() {} }', { solidityImportCompat: true }).contractName).toBe('C');
  });
});

// A synthesized empty body must be a state-preserving no-op, not a hole in the covenant. It compiles to the
// EXACT same bytecode as an explicit require(true) - i.e. the full Guarded self-preservation (master + value
// + commitment) a stateful contract gives any non-state-accessing function - so spending it cannot drain or
// corrupt state.
describe('Synthesized empty bodies are self-preserving no-ops', () => {
  it('empty regular function (compat) compiles identically to explicit require(true)', () => {
    const empty = compileString('contract C() { int n; function f() {} }', { solidityImportCompat: true });
    const explicit = compileString('contract C() { int n; function f() { require(true); } }', { solidityImportCompat: true });
    expect(empty.bytecode).toBe(explicit.bytecode);
  });

  it('empty receive() (native) compiles identically to explicit require(true)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const empty = compileString('contract C() { int n; receive() external payable {} }');
    const explicit = compileString('contract C() { int n; receive() external payable { require(true); } }');
    warn.mockRestore();
    expect(empty.bytecode).toBe(explicit.bytecode);
  });

  it('the synthesized no-op carries the state self-preservation covenant', () => {
    // private state var: a public one synthesizes a getter that pushes the contract over the subroutine-extraction
    // threshold, hex-encoding these opcodes (still present, just not as names). Visibility is irrelevant here.
    const empty = compileString('contract C() { int private n; function f() {} }', {
      solidityImportCompat: true, messageBus: false,
    });
    expect(empty.bytecode).toContain('OP_UTXOBYTECODE');
    expect(empty.bytecode).toContain('OP_OUTPUTBYTECODE');
  });
});
