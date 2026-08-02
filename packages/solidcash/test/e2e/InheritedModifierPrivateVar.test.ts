import { describe, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A base contract's modifier touches its OWN contract's PRIVATE state (the ReentrancyGuard pattern). When the
// modifier is inherited and inlined into a derived contract, the private-var visibility check used to reject the
// access ("Cannot access private state variable 'locked' inherited from 'Guard'"). The access is legal in
// Solidity - the code was written in Guard - so the modifier body's accesses now carry their defining contract.
const SRC = `pragma solidcash >=0.8.0;
contract Guard {
  bool private locked;
  modifier noReentrant() { require(!locked); locked = true; _; locked = false; }
}
contract C() is Guard {
  int count;
  function bump(int n) noReentrant { this.count = this.count + n; require(true); }
  function chk(int e) { require(this.count == e); }
}`;

describe('inherited modifier accessing its own contract private state', () => {
  const provider = createTestProvider();

  it('compiles (was: PrivateStateVariableAccessError) and runs', async () => {
    const artifact = compileString(SRC, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { count: 0n, locked: false }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.bump(5n).send();
    await sc.chk(5n).send();
  });
});
