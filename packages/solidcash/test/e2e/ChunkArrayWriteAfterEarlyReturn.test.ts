/* eslint-disable max-len -- contract source fixtures remain readable as complete declarations */
import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A chunk-backed (dynamic) state array mutated AFTER an early-return guard. Unlike an explicit-branch mutation
// (CacheDynamicArrayInLoop hoists the read/flush out of the branch), these writes are top-level at cache time
// and only become conditional when EarlyReturnTransformation nests the post-guard statements into the else. That
// left a direct chunk write inside a branch, which failed codegen ("__internal__dynwrite_value_... not on stack").
// visitBranch now pre-allocates the dynamic value + A$len blob before the branch (current value), so a taken
// branch replaces it in place and a not-taken branch writes it back unchanged. VM-verifies both paths.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] nums;
  function setNums(uint256 a, uint256 b, uint256 c) { this.nums = [a, b, c]; require(true); }
  function popIf(bool d) { if (!d) return; this.nums.pop(); require(true); }
  function writeIf(uint256 x, bool d) { if (!d) return; this.nums[0] = x; require(true); }
  function popSw(int s) { switch (s) { case 1: this.nums.pop(); } require(true); }
  function lenChk(int n) { require(this.nums.length == n); }
  function valChk(int i, uint256 v) { require(this.nums[i] == v); }
}`;

describe('chunk-array write after an early-return guard', () => {
  const provider = createTestProvider();

  it('pop: not-taken preserves, taken shrinks', async () => {
    const artifact = compileString(SRC, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setNums(7n, 8n, 9n).send();
    await sc.lenChk(3n).send();
    await sc.popIf(false).send();          // guard not taken: no pop
    await sc.lenChk(3n).send();             // still 3
    await sc.valChk(2n, 9n).send();         // last element intact
    await sc.popIf(true).send();           // taken: pop
    await sc.lenChk(2n).send();             // shrank to 2
    expect(await sc.valChk(1n, 8n).send()).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
    await expect(sc.lenChk(3n).send()).rejects.toThrow(/BCH-2026 preflight failed at input 0/);
  });

  it('element write: not-taken preserves, taken updates', async () => {
    const artifact = compileString(SRC, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setNums(7n, 8n, 9n).send();
    await sc.writeIf(99n, false).send();   // not taken: unchanged
    await sc.valChk(0n, 7n).send();
    await sc.writeIf(99n, true).send();    // taken: nums[0] = 99
    await sc.lenChk(3n).send();             // length unchanged
    expect(await sc.valChk(0n, 99n).send()).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });

  it('switch case: unmatched preserves, matched shrinks', async () => {
    const artifact = compileString(SRC, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setNums(7n, 8n, 9n).send();
    await sc.popSw(2n).send();             // no case matches: unchanged
    await sc.lenChk(3n).send();
    await sc.popSw(1n).send();             // case 1: pop
    expect(await sc.lenChk(2n).send()).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
});
