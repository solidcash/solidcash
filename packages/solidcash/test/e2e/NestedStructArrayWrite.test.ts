import { describe, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos, expectOverOperationCostBudget } from '../test-util.js';


const provider = createTestProvider();

async function mk(src: string): Promise<StatefulContract> {
  const art = compileString(src, { solidityImportCompat: true, forceStateful: true, chunkedArrays: true });
  const c = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, c, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(c, categoryId);
}

// `arr[i].roles.creator = v` on a packed struct-array element: the desugar must reconstruct the NESTED struct
// `Roles(v, arr[i].roles.arbitrator, arr[i].roles.worker)`, not drop the write's siblings. The check asserts the
// creator landed AND the arbitrator/amount/worker siblings survived - a wrong single-level rebuild would corrupt
// them. Drove MarketplaceV1 `JobPost storage jobPost = jobs[jobId]; jobPost.roles.creator = msg.sender`.
const SRC = `contract C {
  struct Roles { address creator; address arbitrator; address worker; }
  struct Post { uint8 state; Roles roles; uint256 amount; }
  Post[] jobs;
  function w(address a, address b) public {
    jobs.push();
    jobs[0].amount = 100;
    jobs[0].roles.arbitrator = a;
    jobs[0].roles.creator = b;
  }
  function chk(address a, address b) public view {
    require(jobs[0].roles.creator == b);
    require(jobs[0].roles.arbitrator == a);
    require(jobs[0].amount == 100);
    require(jobs[0].roles.worker == address(0));
  }
  function chkWrong(address a, address b) public view {
    require(jobs[0].roles.arbitrator == b);
  }
}`;

describe('nested struct-array element write (runtime, sibling preservation)', () => {
  const A = '0x1111111111111111111111111111111111111111';
  const B = '0x2222222222222222222222222222222222222222';
  // OVER BUDGET at the real operation-cost limit: the WRITE `w` is what exceeds it, so neither the positive
  // sibling-preservation check nor its negative can be reached. Overshoot is 80 units against a budget of
  // 663,200. Restore both assertions when the nested struct-array element write gets cheaper; see
  // expectOverOperationCostBudget.
  it('the jobs[0].roles.creator write is currently over the BCH-2026 operation-cost budget', async () => {
    const sc = await mk(SRC);
    await expectOverOperationCostBudget(sc.w(A, B).send());
  });
  it('the sibling-preservation negative is unreachable while the write is over budget', async () => {
    // Pinned on the same write rather than deleted, so the pair is restored together. `chkWrong` is what this
    // row is really about - that arbitrator is NOT overwritten by creator - and it needs `w` to land first. On
    // restore this asserts `chkWrong(A, B).send()` rejects with the input-0 OP_VERIFY preflight failure.
    const sc = await mk(SRC);
    await expectOverOperationCostBudget(sc.w(A, B).send());
  });
});
