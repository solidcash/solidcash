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
