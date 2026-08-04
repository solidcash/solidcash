import { describe, it, expect, vi } from 'vitest';
import { formatArtifact } from '@solidcash/utils';
import { compileString } from '../src/index.js';

// Compiler-side rules for inferring the proxy-implementation (delegate) build. Source never writes `delegate`;
// the SDK-facing behaviour is covered in solidcash/test/e2e/DelegateInferred.test.ts.
// See docs/delegatecall.md and docs/delegate-modifier-drop-evaluation.md.

const markedNames = (src: string): string[] => {
  const variant = compileString(src).delegateArtifact;
  if (!variant) return [];
  return variant.abi.filter((f) => f.modifiers?.includes('delegate')).map((f) => f.name);
};

describe('delegate inference', () => {
  it('marks a state-writing entry point', () => {
    expect(markedNames(`contract C() {
      bigint counter;
      function f() public { this.counter = this.counter + 1; }
    }`)).toEqual(['f']);
  });

  it('sees a state write that is only reachable through an internal helper', () => {
    expect(markedNames(`contract C() {
      bigint counter;
      function helper(bigint x) internal { this.counter = x; }
      function f(bigint x) public { this.helper(x); }
    }`)).toEqual(['f']);
  });

  it('excludes a transfer reached through a helper chain', () => {
    expect(markedNames(`contract C() {
      bigint counter;
      function inner(address r) internal { payable(r).transfer(1000); }
      function outer(address r) internal { this.inner(r); }
      function f(address r) public { this.counter = this.counter + 1; this.outer(r); }
    }`)).toEqual([]);
  });

  it('excludes a function that issues a delegatecall itself', () => {
    // delegate + delegatecall skips every state covenant and emitDelegateSelfPreservation.
    expect(markedNames(`contract C() {
      event E(int v);
      bigint counter;
      function f(address t) public { emit E(1); t.delegatecall(0x1234); }
    }`)).toEqual([]);
  });

  it('terminates on mutually recursive helpers', () => {
    expect(markedNames(`contract C() {
      bigint counter;
      function ping(bigint x) internal returns (bigint) { if (x > 0) { return this.pong(x - 1); } return 0; }
      function pong(bigint x) internal returns (bigint) { if (x > 0) { return this.ping(x - 1); } return 1; }
      function f(bigint x) public { this.counter = this.ping(x); }
    }`)).toEqual(['f']);
  });

  it('emits no variant for a contract that cannot be an implementation', () => {
    expect(compileString(`contract R() {
      bigint v;
      function get() public view returns (bigint) { return this.v; }
    }`).delegateArtifact).toBeUndefined();
  });

  it('rejects the removed source-level delegate modifier', () => {
    expect(() => compileString(`contract C() {
      bigint counter;
      function f() delegate { this.counter = this.counter + 1; }
    }`)).toThrow();
  });

  it('never fails a valid standalone compile, and reports why the variant was skipped', () => {
    // The variant compile is best-effort. Whatever happens, the standalone artifact must still be produced -
    // and if the variant is dropped for an unexpected reason, that reason must not vanish silently.
    const logged: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { logged.push(a.join(' ')); });
    try {
      const artifact = compileString(`contract C() {
        bigint counter;
        function f() public { this.counter = this.counter + 1; }
      }`);
      expect(artifact.bytecode).toBeTruthy();
      expect(logged.filter((l) => l.includes('could not build the delegate'))).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });

  // The variant is a second full compile, and most contracts are never used behind a proxy, so it is built on
  // first read rather than on every compile. Emitted artifacts must still carry it: serialization reads the
  // property like any other, which is what these two assertions pin down.
  it('survives serialization, so written artifacts carry the variant', () => {
    const src = `contract C() {
      bigint counter;
      function f() public { this.counter = this.counter + 1; }
    }`;
    const roundTripped = JSON.parse(JSON.stringify(compileString(src)));
    expect(roundTripped.delegateArtifact).toBeDefined();
    expect(roundTripped.delegateArtifact.abi.find((f: { name: string }) => f.name === 'f').modifiers)
      .toContain('delegate');

    expect(formatArtifact(compileString(src), 'json')).toContain('delegateArtifact');
    expect(formatArtifact(compileString(src), 'ts')).toContain('delegateArtifact');
  });

  it('reads back the same variant every time', () => {
    const artifact = compileString(`contract C() {
      bigint counter;
      function f() public { this.counter = this.counter + 1; }
    }`);
    expect(artifact.delegateArtifact).toBe(artifact.delegateArtifact);
  });

  it('keeps the nested artifact complete, including source', () => {
    const artifact = compileString(`contract C() {
      bigint counter;
      function f() public { this.counter = this.counter + 1; }
    }`);
    expect(artifact.source).toContain('contract C()');
    expect(artifact.delegateArtifact!.source).toBe(artifact.source);
  });

  it('stays lazy when the compile cache clones the artifact', () => {
    const previous = process.env.SOLIDC_COMPILE_CACHE;
    process.env.SOLIDC_COMPILE_CACHE = '1';
    try {
      const artifact = compileString(`contract CachedDelegate() {
        bigint counter;
        function f() public { this.counter = this.counter + 1; }
      }`);
      const descriptor = Object.getOwnPropertyDescriptor(artifact, 'delegateArtifact');
      expect(descriptor?.get).toBeTypeOf('function');
      expect(artifact.delegateArtifact).toBeDefined();
    } finally {
      if (previous === undefined) delete process.env.SOLIDC_COMPILE_CACHE;
      else process.env.SOLIDC_COMPILE_CACHE = previous;
    }
  });
});
