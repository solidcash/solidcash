import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// A user-supplied external library: a single-opcode blob (OP_1ADD) callable as inc(int) -> int.
// Proves the generic registry treats user libraries exactly like the built-in precompiles.
const INC_LIBRARY = {
  name: 'inc',
  code: '8b', // OP_1ADD
  abi: { inputs: [{ name: 'x', type: 'int' }], outputs: [{ type: 'int' }] },
};

const SOURCE = `
contract UserLib() {
    function check(int n, int expected) {
        require(inc(n) == expected);
    }
}`;

// Two call sites of inc() across the contract -> not auto-inlined (auto requires exactly one).
const TWO_CALL_SOURCE = `
contract UserLib() {
    function check(int n, int expected) {
        require(inc(n) == expected);
    }
    function twice(int n, int expected) {
        require(inc(n) == expected);
    }
}`;

describe('user external libraries', () => {
  it('rejects a call to an unregistered library function', () => {
    expect(() => compileString(SOURCE)).toThrow();
  });

  it('compiles a contract calling a user-supplied library', () => {
    const artifact = compileString(SOURCE, { userLibraries: [INC_LIBRARY] });
    expect(artifact.bytecode.length).toBeGreaterThan(0);
    expect(artifact.abi.find((f) => f.name === 'check')?.externalLibraries).toEqual(['inc']);
  });

  it('embeds the user library blob + descriptor in the artifact', () => {
    const artifact = compileString(SOURCE, { userLibraries: [INC_LIBRARY] });
    expect(artifact.externalLibraries).toHaveLength(1);
    // 1-byte blob: outerPush(1)+saltPrefix(34)+selfPres(6)+blobPush(1) = 42 .. 43
    expect(artifact.externalLibraries![0]).toMatchObject({
      name: 'inc', branded: false, code: '8b',
      codeBegin: 42, codeEnd: 43, blobHash: expect.any(String),
      abi: { inputs: [{ name: 'x', type: 'int' }], outputs: [{ type: 'int' }] },
    });
  });

  it('does not embed code for a built-in library', () => {
    const keccakSource = `
contract K() {
    function v(bytes m, bytes32 e) {
        require(keccak256(m) == e);
    }
}`;
    const artifact = compileString(keccakSource);
    expect(artifact.externalLibraries![0].name).toBe('keccak256');
    expect(artifact.externalLibraries![0].code).toBeUndefined();
  });

  it('rejects a user library that shadows a built-in name', () => {
    const collide = { ...INC_LIBRARY, name: 'keccak256' };
    expect(() => compileString(SOURCE, { userLibraries: [collide] })).toThrow(/already defined/);
  });
});

describe('external library inlining', () => {
  it('auto-inlines a small single-call library', () => {
    // Pin the direct artifact's one-call heuristic: the default hidden route intentionally adds another
    // executable call site and therefore must not be used to measure direct-route call cardinality.
    const artifact = compileString(SOURCE, { userLibraries: [INC_LIBRARY], hiddenBatch: false });
    expect(artifact.externalLibraries![0].inline).toBe(true);
  });

  it('does not auto-inline a multi-call library', () => {
    const artifact = compileString(TWO_CALL_SOURCE, { userLibraries: [INC_LIBRARY] });
    expect(artifact.externalLibraries![0].inline).toBe(false);
  });

  it('honors inlineLibraries: false to force a side-car', () => {
    const artifact = compileString(SOURCE, { userLibraries: [INC_LIBRARY], inlineLibraries: { inc: false } });
    expect(artifact.externalLibraries![0].inline).toBe(false);
  });

  it('honors disableAutoInline', () => {
    const artifact = compileString(SOURCE, { userLibraries: [INC_LIBRARY], disableAutoInline: true });
    expect(artifact.externalLibraries![0].inline).toBe(false);
  });

  it('keccak256 is always the compute model (no inline blob; force-inline does not apply)', () => {
    const keccakSource = `
contract K() {
    function v(bytes m, bytes32 e) {
        require(keccak256(m) == e);
    }
}`;
    // keccak256 uses the compute (result-NFT) side-car, never a loaded blob (the blob would exceed the contract's
    // own hashing budget), so the descriptor is resultNft with no inline-loader fields regardless of the option.
    const lib = compileString(keccakSource).externalLibraries![0];
    expect(lib.resultNft).toBe(true);
    expect(lib.inline).toBeUndefined();
    const forced = compileString(keccakSource, { inlineLibraries: { keccak256: true } }).externalLibraries![0];
    expect(forced.resultNft).toBe(true);
    expect(forced.inline).toBeUndefined();
  });
});
