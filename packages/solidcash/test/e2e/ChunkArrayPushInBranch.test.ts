import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A chunk-backed (dynamic) state array mutated inside an if/else branch. The codegen pending-value write model
// emits the write once at the function epilogue, so a conditionally-taken push desyncs the on-stack value and
// fails codegen ("Expected variable __internal__dynwrite_value... does not exist"). CacheDynamicArrayInLoop now
// treats a branch like a loop: read-once into a local, mutate the local, write-once back after. VM-verifies the
// taken branch grows the array and the not-taken branch leaves it unchanged.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] nums;
  function setNums(uint256 a, uint256 b) { this.nums = [a, b]; require(true); }
  function addIf(uint256 x, bool d) { if (d) { this.nums.push(x); } require(true); }
  function lenChk(int n) { require(this.nums.length == n); }
}`;

describe('chunk-array push inside a branch', () => {
  const provider = createTestProvider();

  it('taken branch grows the array; not-taken leaves it unchanged', async () => {
    const artifact = compileString(SRC, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setNums(7n, 8n).send();
    await sc.lenChk(2n).send();
    await sc.addIf(9n, false).send();            // guard not taken: no push
    await sc.lenChk(2n).send();                   // still 2
    await sc.addIf(9n, true).send();             // taken: push
    await expect(sc.lenChk(3n).send()).resolves.toBeDefined();  // grew to 3
  });
});
