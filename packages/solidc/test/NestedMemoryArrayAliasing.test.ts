import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A nested memory array whose alias group falls back to value copies keeps compiling unless a write after an alias
// edge would tell its copied rows apart from shared ones (EVM rows are references).
const contract = (body: string): string => `contract C() { function f(uint256 v, uint256 n) { ${body} } }`;
const REFUSED = /cannot yet preserve Solidity aliasing/;
// Reassigning the outer array is not a pointer-lowered use, so the whole group falls back.
const FALL_BACK = 'g = new uint256[][](1); require(g.length == 1);';

describe('nested memory array aliasing on the value-copy fallback', () => {
  it('refuses a stored row written afterwards', () => {
    expect(() => compileString(contract('uint256[][] memory g = new uint256[][](2); '
      + `uint256[] memory row = new uint256[](2); g[0] = row; row[0] = v; require(g[0][0] == v); ${FALL_BACK}`)))
      .toThrow(REFUSED);
  });

  it('refuses a shared row written in the loop that stores it', () => {
    expect(() => compileString(contract('uint256[][] memory g = new uint256[][](n); '
      + 'uint256[] memory row = new uint256[](2); for (uint256 i = 0; i < n; i++) { row[0] = i; g[i] = row; } '
      + `require(g[0][0] == v); ${FALL_BACK}`))).toThrow(REFUSED);
  });

  it('refuses a row read out of the outer array and written', () => {
    expect(() => compileString(contract('uint256[][] memory g = new uint256[][](2); g[0] = new uint256[](2); '
      + `uint256[] memory r = g[0]; r[0] = v; require(g[0][0] == v); ${FALL_BACK}`))).toThrow(REFUSED);
  });

  it('compiles when no write follows an alias', () => {
    expect(compileString(contract('uint256[] memory row = new uint256[](2); row[0] = v; '
      + 'uint256[][] memory g = new uint256[][](2); g[0] = row; g[1] = row; uint256[] memory r = g[1]; '
      + `require(r[0] == v && g[0][0] == v); ${FALL_BACK}`)).contractName).toBe('C');
  });

  it('compiles rows allocated fresh in each loop turn', () => {
    expect(compileString(contract('uint256[][] memory g = new uint256[][](n); for (uint256 i = 0; i < n; i++) { '
      + 'uint256[] memory row = new uint256[](2); row[0] = i; row[1] = v; g[i] = row; } '
      + `require(g[0][1] == v); ${FALL_BACK}`)).contractName).toBe('C');
  });
});
