import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const inputZeroVerifyFailure = /^messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;

// A named-return function with a revert guard before an emit. EarlyReturnTransformation nests the
// post-revert statements (the emit + state write + implicit return) into the else branch; codegen
// must then take the else branch's stack as the post-branch representative, not the reverting
// if-block's - otherwise the emit blob the function-end event covenant needs is missing
// ("__internal__emit_0 does not exist on the stack"). VM-verifies the emit is produced on the
// fall-through path and the guard still aborts.
const SRC = `pragma solidcash >=0.8.0;
contract EmitAfterGuard() {
  event Queued(bigint indexed id, bigint amount);
  bigint counter;
  function record(bigint id, bigint amount, bigint bad) returns (bigint outId) {
    outId = id;
    if (bad == 1) { revert(); }
    emit Queued(id, amount);
    this.counter = this.counter + 1;
  }
}`;

describe('emit after a revert guard with a named return', () => {
  const art = compileString(SRC);

  async function deploy(): Promise<StatefulContract> {
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    return new StatefulContract(categoryId, art, provider);
  }

  it('produces the event on the fall-through path (guard not taken)', async () => {
    const sc = await deploy();
    await sc.record(7n, 100n, 0n).send();
    const logs = await sc.queryFilter('Queued');
    expect(logs).toHaveLength(1);
    expect(logs[0].args).toEqual({ id: 7n, amount: 100n });
  });

  it('aborts when the revert guard is taken', async () => {
    const sc = await deploy();
    await expect(sc.record(7n, 100n, 1n).send()).rejects.toThrow(inputZeroVerifyFailure);
  });
});
