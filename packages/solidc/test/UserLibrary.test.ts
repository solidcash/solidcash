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
      name: 'inc', branded: false, inline: false, code: '8b',
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
