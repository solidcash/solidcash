import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import {
  createTestProvider, setupStatefulUtxos, densityReserve,
} from '../test-util.js';


const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

const provider = createTestProvider();

async function mk(src: string, reserve?: Uint8Array): Promise<StatefulContract> {
  const art = compileString(src, { solidityImportCompat: true, forceStateful: true, chunkedArrays: true });
  const c = new Contract(art, [], { provider, salt: reserve });
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
  // The WRITE `w` exceeds the real BCH-2026 operation-cost budget at this contract's natural size, so both rows
  // reserve density for it. See `densityReserve`.
  it('writes jobs[0].roles.creator and preserves arbitrator/amount/worker', async () => {
    const sc = await mk(SRC, densityReserve());
    await sc.w(A, B).send();
    await expect(sc.chk(A, B).send()).resolves.toBeDefined();
  });
  it('a wrong sibling expectation reverts (arbitrator was NOT overwritten by creator)', async () => {
    const sc = await mk(SRC, densityReserve());
    await sc.w(A, B).send();
    await expect(sc.chkWrong(A, B).send()).rejects.toThrow(verifyFailure);
  });
  it('the same write now fits without a density reserve', async () => {
    const sc = await mk(SRC);
    await expect(sc.w(A, B).send()).resolves.toBeDefined();
    await expect(sc.chk(A, B).send()).resolves.toBeDefined();
  });
});
