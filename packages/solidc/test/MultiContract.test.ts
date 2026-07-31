import { describe, it, expect } from 'vitest';
import { compileString, compileStringMulti } from '../src/index.js';
import { createMapResolver } from '../src/createMapResolver.js';

// compileStringMulti returns one Artifact per top-level declaration (solc's contracts[name] model), including
// imported contracts and ABI-only interface entries. compileString stays the single-primary form.
// See docs/multi-contract-artifacts.md.
describe('compileStringMulti', () => {
  it('returns an artifact per top-level contract in one file (each compiled as its own primary)', () => {
    const src = `
      contract A(int x) { function fa() { require(x > 0); } }
      contract B(int y) { function fb() { require(y > 0); require(y < 100); } }
    `;
    const map = compileStringMulti(src);
    expect(Object.keys(map).sort()).toEqual(['A', 'B']);
    expect(map.A.abi.map((f) => f.name)).toEqual(['fa']);
    expect(map.B.abi.map((f) => f.name)).toEqual(['fb']);
    // Structurally-distinct contracts -> distinct bytecode (A has one require, B has two).
    expect(map.A.bytecode).not.toBe(map.B.bytecode);
  });

  it('includes imported contracts in the map', () => {
    const child = `
      contract Child(bytes20 owner) {
        int counter;
        function bump() { this.counter = this.counter + 1; require(true); }
      }
    `;
    const main = `
      import "./child.scash";
      contract Factory(pubkey o) {
        int n;
        function make(sig s, bytes20 owner) {
          require(checkSig(s, o));
          Child c = new Child(owner);
          this.n = this.n + 1;
        }
      }
    `;
    const map = compileStringMulti(main, {
      importResolver: createMapResolver({ '/child.scash': child }),
      rootFileId: '/main.scash',
    });
    expect(Object.keys(map).sort()).toEqual(['Child', 'Factory']);
    expect(map.Child.abi.map((f) => f.name)).toEqual(['bump']);
    expect(map.Child.stateLayout).toBeDefined();
    expect(map.Factory.abi.find((f) => f.name === 'make')!.deployTargets![0].contractName).toBe('Child');
  });

  it('emits an ABI-only declaration artifact for an interface (no bytecode)', () => {
    const src = `
      interface IThing { function ping(int x); }
      contract C(int z) { function c() { require(z > 0); } }
    `;
    const map = compileStringMulti(src);
    expect(Object.keys(map).sort()).toEqual(['C', 'IThing']);
    expect(map.IThing.bytecode).toBe('');
    expect(map.IThing.isLibrary).toBe(true);
    expect(map.IThing.abi.map((f) => f.name)).toEqual(['ping']);
    expect(map.C.bytecode).not.toBe('');
  });

  it('a single contract via compileStringMulti matches compileString byte-for-byte', () => {
    const src = 'contract Solo(int x) { function s() { require(x > 0); } }';
    const map = compileStringMulti(src);
    expect(Object.keys(map)).toEqual(['Solo']);
    expect(map.Solo.bytecode).toBe(compileString(src).bytecode);
  });

  it('compileString returns the last contract as the primary (unchanged); the map has both', () => {
    const src = `
      contract First(int x) { function f1() { require(x > 0); } }
      contract Second(int y) { function f2() { require(y > 0); } }
    `;
    expect(compileString(src).contractName).toBe('Second');
    const map = compileStringMulti(src);
    expect(map.Second.bytecode).toBe(compileString(src).bytecode);
  });

  it('compileString can select one named top-level contract without compiling every sibling', () => {
    const src = `
      contract First(int x) { function f1() { require(x > 0); } }
      contract Broken { function bad() { missing(); require(true); } }
    `;
    const first = compileString(src, { primaryContractName: 'First' });
    expect(first.contractName).toBe('First');
    expect(first.abi.map((entry) => entry.name)).toEqual(['f1']);
  });

  it('excludes abstract contracts from the map', () => {
    const src = `
      abstract contract Base { function b() virtual; }
      contract Impl(int x) { function i() { require(x > 0); } }
    `;
    const map = compileStringMulti(src);
    expect(Object.keys(map)).toEqual(['Impl']);
  });
});
