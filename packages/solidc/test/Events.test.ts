import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Events and emit (parameter types, qualified/named-arg emit). Split out of PortingFixes.test.ts by topic.

describe('A4: address is a valid event parameter type', () => {
  it('compiles an event with an address param and an emit', () => {
    const artifact = compileString(`
      contract C() {
        event Moved(address indexed who, int amount);
        int n;
        function go(address dst, int amount) {
          emit Moved(dst, amount);
          this.n = this.n + 1;
        }
      }`);
    expect(artifact.contractName).toBe('C');
    const ev = artifact.events?.find((e) => e.name === 'Moved');
    expect(ev?.signature).toBe('Moved(address,int256)');
    expect(ev?.parameters?.[0]?.type).toBe('address');
  });
});

describe('Qualified + named-arg event emit', () => {
  it('accepts a qualified emit `emit C.E(...)` (qualifier stripped)', () => {
    const a = compileString(`
      contract C() {
        int n;
        event Moved(address who, int amt);
        function go(address dst, int amt) { emit C.Moved(dst, amt); this.n = this.n + 1; }
      }`);
    expect(a.events?.find((e) => e.name === 'Moved')?.signature).toBe('Moved(address,int256)');
  });

  it('reorders named-arg emit `emit E({b, a})` into the event param order', () => {
    const a = compileString(`
      contract C() {
        int n;
        event Moved(address who, int amt);
        function go(address dst, int amt) { emit Moved({amt: amt, who: dst}); this.n = this.n + 1; }
      }`);
    expect(a.contractName).toBe('C');
  });

  it('rejects a named-arg emit whose names do not match the event', () => {
    expect(() => compileString(`
      contract C() {
        int n;
        event Moved(address who, int amt);
        function go(address dst, int amt) { emit Moved({amt: amt, nope: dst}); this.n = this.n + 1; }
      }`)).toThrow(/named argument|No event/);
  });
});

describe('array event parameters (Solidity parity)', () => {
  const c = (src: string): string => compileString(src).contractName;

  it('compiles a dynamic array event parameter and its emit', () => {
    expect(c('contract C() { event E(int[] xs); function f() { int[] a = [1,2,3]; emit E(a); require(true); } }')).toBe('C');
  });

  it('compiles a fixed array event parameter', () => {
    expect(c('contract C() { event E(int[3] xs); function f() { int[3] a = [1,2,3]; emit E(a); require(true); } }')).toBe('C');
  });

  it('compiles a bytes20[] event parameter', () => {
    expect(c('contract C() { event E(bytes20[] who);'
      + ' function f() { bytes20[] a = [0x0000000000000000000000000000000000000000]; emit E(a); require(true); } }')).toBe('C');
  });

  it('compiles an indexed array and a mixed scalar/array event', () => {
    expect(c('contract C() { event E(int[] indexed xs); function f() { int[] a = [1]; emit E(a); require(true); } }')).toBe('C');
    expect(c('contract C() { event E(int n, int[] xs); function f() { int[] a = [1,2]; emit E(5, a); require(true); } }')).toBe('C');
  });

  it('exposes the array param in the event ABI', () => {
    const art = compileString('contract C() { event E(int[] xs); function f() { require(true); } }');
    expect(art.events![0].parameters[0].type).toMatch(/\[\]/);
  });
});

// Event parameters may be unnamed in Solidity (`event Deploy(address)`); the signature uses types only.
describe('unnamed event parameters', () => {
  it('compiles `event E(address)` and emits it; signature has no names', () => {
    const a = compileString(
      'contract C { event Deploy(address); function f() public { emit Deploy(msg.sender); } }',
      { solidityImportCompat: true },
    );
    expect(a.events?.find((e) => e.name === 'Deploy')?.signature).toBe('Deploy(address)');
  });
});

// A qualified `emit L.e(...)` / `emit C.E(...)` resolves against events declared in a sibling contract or a
// library in the same file (the event's commitment encoding depends only on name+params, not declaring scope).
// Emitting forces the emitter stateful (the commitment rides a state NFT); the emitted event is listed in the ABI.
describe('qualified event emit from a library or sibling contract', () => {
  it('emits a library-declared event `emit L.e1(x)` and lists it in the ABI', () => {
    const a = compileString(
      'library L { event e1(uint b); } contract test { function f() { emit L.e1(1); require(true); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('test');
    expect(a.events?.find((e) => e.name === 'e1')?.signature).toBe('e1(uint256)');
  });

  it('emits a sibling-contract event `emit C.E()` and lists it in the ABI', () => {
    const a = compileString(
      'contract C { event E(); } contract D { function test() { emit C.E(); require(true); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('D');
    expect(a.events?.find((e) => e.name === 'E')?.signature).toBe('E()');
  });

  it('resolves same-signature events from two libraries `emit L1.e(); emit L2.e()`', () => {
    const a = compileString(
      'library L1 { event e(); } library L2 { event e(); } '
      + 'contract C { function f() { emit L1.e(); emit L2.e(); require(true); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
    expect(a.events?.find((e) => e.name === 'e')?.signature).toBe('e()');
  });

  it('emits a library event with a struct argument `emit L.Ev(Item(1))`', () => {
    const a = compileString(
      'library L { event Ev(Item i); } struct Item { int a; } '
      + 'contract C { function o() { emit L.Ev(Item(1)); require(true); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
    expect(a.events?.some((e) => e.name === 'Ev')).toBe(true);
  });
});

// File-level event declarations (Solidity 0.8.22+) - `event E(..);` outside any contract, registered globally so
// `emit E(..)` resolves. A pure scope-lift: byte-identical to the same event declared inside the contract.
describe('file-level event declarations', () => {
  it('resolves `emit E()` for a file-level event, byte-identical to the contract-level form', () => {
    const fileLevel = compileString('event E(uint x); contract C { function f() external { emit E(7); require(true); } }',
      { solidityImportCompat: true, experimentalHiddenBatch: false });
    const contractLevel = compileString('contract C { event E(uint x); function f() external { emit E(7); require(true); } }',
      { solidityImportCompat: true, experimentalHiddenBatch: false });
    expect(fileLevel.bytecode).toBe(contractLevel.bytecode);
    expect(fileLevel.events?.find((e) => e.name === 'E')?.signature).toBe(contractLevel.events?.find((e) => e.name === 'E')?.signature);
  });
  it('accepts a file-level event with indexed params', () => {
    const a = compileString('event Transfer(address indexed from, uint value);'
      + ' contract C { function f(address a) external { emit Transfer(a, 5); require(true); } }',
    { solidityImportCompat: true });
    expect(a.events?.some((e) => e.name === 'Transfer')).toBe(true);
  });
});
