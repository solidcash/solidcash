import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract, StatefulContract, MockNetworkProvider, MOCK_CONSENSUS_LIMITS, MOCK_RELAXED_OPERATION_COST,
} from '../../src/index.js';
import {
  createTestProvider, setupStatefulUtxos, expectOverOperationCostBudget,
} from '../test-util.js';


const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// These writes cost far more than the real BCH-2026 operation-cost budget allows at this contract's natural size:
// `w` needs about 11M units and `wConditional` about 15M against a budget of 6.2M, and the 520-byte salt cap buys
// under 0.5M more, so no density reserve covers them. The sibling-preservation rows therefore run on a provider that
// names the relaxed budget, and the over-budget write is pinned on the real budget below.
const relaxed = new MockNetworkProvider({
  consensusLimits: { ...MOCK_CONSENSUS_LIMITS, operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST },
});

async function mk(
  src: string, provider: ReturnType<typeof createTestProvider> = relaxed,
): Promise<StatefulContract> {
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
  struct Post {
    uint8 state;
    bool whitelistWorkers;
    Roles roles;
    string title;
    string[] tags;
    bytes32 contentHash;
    bool multipleApplicants;
    uint256 amount;
    address token;
    uint32 timestamp;
    uint32 maxTime;
    string deliveryMethod;
    uint256 collateralOwed;
    uint256 escrowId;
    bytes32 resultHash;
    uint8 rating;
    bool disputed;
  }
  Post[] jobs;
  function w(address a, address b) public {
    jobs.push();
    jobs[0].amount = 100;
    jobs[0].roles.arbitrator = a;
    jobs[0].roles.creator = b;
  }
  function wConditional(address a, address b) public {
    jobs.push();
    uint256 one = 1;
    uint256 two = 2;
    uint256 three = 3;
    uint256 four = 4;
    if (a != address(0) && one + two + three + four == 10) {
      jobs[0].state = 1;
      jobs[0].roles.worker = b;
      jobs[0].roles.arbitrator = a;
      jobs[0].amount = 100;
    }
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
  function chkConditional(address a, address b) public view {
    require(jobs[0].state == 1);
    require(jobs[0].roles.creator == address(0));
    require(jobs[0].roles.arbitrator == a);
    require(jobs[0].roles.worker == b);
    require(jobs[0].amount == 100);
  }
}`;

describe('nested struct-array element write (runtime, sibling preservation)', () => {
  const A = '0x1111111111111111111111111111111111111111';
  const B = '0x2222222222222222222222222222222222222222';
  it('writes jobs[0].roles.creator and preserves arbitrator/amount/worker', async () => {
    const sc = await mk(SRC);
    await sc.w(A, B).send();
    await expect(sc.chk(A, B).send()).resolves.toBeDefined();
  });
  it('a wrong sibling expectation reverts (arbitrator was NOT overwritten by creator)', async () => {
    const sc = await mk(SRC);
    await sc.w(A, B).send();
    await expect(sc.chkWrong(A, B).send()).rejects.toThrow(verifyFailure);
  });
  // A PIN, not an endorsement: once the write fits again, restore the positive row (`w`, then `chk`, on the real
  // budget) rather than loosening this one.
  it('the same write is over the real operation-cost budget at its natural size', async () => {
    const sc = await mk(SRC, createTestProvider());
    await expectOverOperationCostBudget(sc.w(A, B).send());
  });
  it('preserves a variable-width struct array across sequential conditional field writes', async () => {
    const sc = await mk(SRC);
    await expect(sc.wConditional(A, B).send()).resolves.toBeDefined();
    await expect(sc.chkConditional(A, B).send()).resolves.toBeDefined();
  });
});
