import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract Analysis() {
  int x;
  mapping(int => int) balances;
  function leaf(int k) internal { this.x = this.x + k; }
  function left(int k) internal { leaf(k); right(k); }
  function right(int k) internal { if (k > 0) left(k - 1); }
  function run(int k) { left(k); require(k >= 0); }
  function readBalance(int k) view { require(balances[k] >= 0); }
  function flat() { this.x = 1; require(this.x == 1); }
}`;

describe('Release 0 shared invocation analysis', () => {
  it('emits deterministic closures, SCCs, and state footprints without changing bytecode', () => {
    const first = compileString(SOURCE, { forceStateful: true });
    const second = compileString(SOURCE, { forceStateful: true });
    expect(first.bytecode).toBe(second.bytecode);
    expect(first.invocationAnalysis).toEqual(second.invocationAnalysis);

    const analysis = first.invocationAnalysis!;
    expect(analysis.version).toBe(1);
    const run = analysis.functions.find((fn) => fn.name === 'run')!;
    const flat = analysis.functions.find((fn) => fn.name === 'flat')!;
    expect(run.recursive).toBe(true);
    expect(run.closure.length).toBeGreaterThan(2);
    expect(run.reads).toContain('state:x');
    expect(run.writes).toContain('state:x');
    expect(analysis.functions.find((fn) => fn.name === 'readBalance')?.reads)
      .toContain('collection:balances:*');
    expect(flat.recursive).toBe(false);
    expect(analysis.components.some((component) => component.recursive
      && component.functions.length === 2)).toBe(true);
  });
});
