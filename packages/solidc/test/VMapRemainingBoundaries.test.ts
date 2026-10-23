import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

/**
 * Pin the two vmap value-kind boundaries that deferrals.md §6 still listed as fail-closed but which now compile
 * and settle: the different-key sorted insert loop and the 2D array-value element write. The existing e2e suites
 * `SortedArrayValueLoop.test.ts` and `MappingArray2dWrite.test.ts` prove the settling half; this compiler pin
 * keeps the compile half honest for the exact shapes the doc named.
 */
describe('vmap resolved value-kind boundaries', () => {
  it('compiles a 2D array-value element write m[k][i][j] = v', () => {
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract C() { mapping(int => int[][]) grid;
        function setCell(int k, int i, int j, int v) public { this.grid[k][i][j] = v; require(true); } }`,
    { forceStateful: true });
    expect(artifact.contractName).toBe('C');
  });

  it('compiles a different-key sorted insert loop for(i) m[ks[i]] = v', () => {
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract C() { mapping(int => int) m;
        function fill(int[] ks, int v) public {
          for (int i = 0; i < ks.length; i = i + 1) { this.m[ks[i]] = v; }
          require(true);
        } }`, { forceStateful: true });
    expect(artifact.contractName).toBe('C');
  });

  it('compiles a function-pointer element value mapping (functionId on the wire)', () => {
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract C() { mapping(bytes4 => function(int) returns (int)) routes;
        function double(int x) internal returns (int) { return x * 2; }
        function register(bytes4 sel) public { this.routes[sel] = double; require(true); }
        function invoke(bytes4 sel, int v, int expected) public {
          function(int) returns (int) h = this.routes[sel];
          require(h(v) == expected);
        } }`, { forceStateful: true });
    expect(artifact.contractName).toBe('C');
  });
});
