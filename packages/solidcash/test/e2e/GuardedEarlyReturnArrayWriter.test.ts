import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// `append` is a returning dynamic-array writer with a guarded early exit. The guarded-early-return
// normalization folds it into one result temp so it can be inlined into the caller; both exits must still
// perform the same writes and return the same length as the source.
const SRC = `pragma solidcash >=0.8.0;
contract GuardedArrayWriter() {
  bigint[] scores;
  function append(bigint value, bool once) internal returns (bigint) {
    this.scores.push(value);
    if (once) { return this.scores.length; }
    this.scores.push(value + 1);
    return this.scores.length;
  }
  function apply(bigint value, bool once) returns (bigint) {
    return append(value, once);
  }
}`;

describe('guarded early return in a chunk-array writer', () => {
  const provider = createTestProvider();
  async function deploy(): Promise<any> {
    const artifact = compileString(SRC);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    return StatefulContract.withCategory(contract, categoryId);
  }

  it('runs the early and the fall-through exit with their own writes and lengths', async () => {
    const sc = await deploy();
    // once = true: push 5, return length 1, and never push 6.
    await sc.apply(5n, true).send();
    expect((await sc.getState()).scores).toEqual([5n]);
    // Once = false: push 7 and 8, return length 3. The static call reads the value without moving state.
    expect(await sc.call.apply(7n, false).staticCall()).toBe(3n);
    await sc.apply(7n, false).send();
    expect((await sc.getState()).scores).toEqual([5n, 7n, 8n]);
  });
});
