import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A dynamic (chunk-backed) string reassigned inside a loop. Unlike an array push/pop (cached by
// CacheDynamicArrayInLoop), a full `this.s = v` reassignment is not cached, so it reached the loop
// pre-allocation site as a direct dynwrite and failed codegen. The loop pre-allocation now reserves the
// dynwrite value + A$len before OP_BEGIN (preAllocateStateWrite), replaced in place each iteration. VM-verifies
// N=0 (preserve), N>0 (write), and read-modify-write growth in a loop.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  string s;
  function setS(string v) { this.s = v; require(true); }
  function fillLoop(string v, int n) { int i = 0; while (i < n) { this.s = v; i = i + 1; } require(true); }
  function growLoop(string v, int n) { int i = 0; while (i < n) { this.s = this.s + v; i = i + 1; } require(true); }
  function chkS(string ev) { require(this.s == ev); }
}`;

describe('chunk-backed string reassign inside a loop', () => {
  const provider = createTestProvider();

  const setup = async (): Promise<StatefulContract> => {
    const artifact = compileString(SRC, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { s: '' }, { saltContract: true },
    );
    return StatefulContract.withCategory(contract, categoryId);
  };

  it('N=0 preserves, N>0 writes', async () => {
    const sc = await setup();
    await sc.setS('hello').send();
    await sc.fillLoop('world', 0n).send();          // loop body never runs
    await sc.chkS('hello').send();                   // preserved
    await sc.fillLoop('world', 3n).send();          // runs 3x, each sets s = 'world'
    await expect(sc.chkS('world').send()).resolves.toBeDefined();
  });

  it('read-modify-write in a loop accumulates', async () => {
    const sc = await setup();
    await sc.setS('a').send();
    await sc.growLoop('b', 3n).send();               // s = a + b + b + b
    await expect(sc.chkS('abbb').send()).resolves.toBeDefined();
  });
});
