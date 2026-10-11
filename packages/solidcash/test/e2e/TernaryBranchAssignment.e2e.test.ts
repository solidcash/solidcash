import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// `flag ? w = a : (w = a + 1);` in statement position. The statement lowering built each arm only from that
// branch's assignment TAIL, so the GROUPED false branch produced an empty arm and its assignment was dropped:
// the write landed as `w`'s declaration default on the not-taken path. The compiler-side pin is
// packages/solidc/test/TernaryBranchAssignment.test.ts; this runs the emitted covenant on the mock VM and reads
// the state both branches produce.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  uint256 v;
  function pick(uint256 a, bool flag) public {
    uint256 w = 0;
    flag ? w = a : (w = a + 1);
    this.v = w;
    require(true);
  }
  function chk(uint256 expected) public { require(this.v == expected); }
}`;

describe('ternary branch assignment in statement position (e2e)', () => {
  const provider = createTestProvider();

  it('runs the grouped branch assignment: the not-taken path writes a + 1, not the local default', async () => {
    const artifact = compileString(SRC);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { v: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.pick(5n, true).send();
    await expect(sc.chk(5n).send()).resolves.toBeDefined();
    await sc.pick(5n, false).send();
    // The grouped `(w = a + 1)` branch must have run; a dropped arm would leave v at 5 (or the default 0).
    await expect(sc.chk(6n).send()).resolves.toBeDefined();
  });
});
