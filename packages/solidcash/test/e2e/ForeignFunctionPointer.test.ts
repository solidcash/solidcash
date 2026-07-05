import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider, StatefulContract,
} from '../../src/index.js';
import type { ConnectedStatefulContract } from '../../src/stateful/StatefulContract.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A straight-line FOREIGN external function pointer desugars to the existing external call:
//   function(int) external f = IPool(poolAddr).deposit;  f(val);   ==   IPool(poolAddr).deposit(val);
// This VM-verifies the desugar end-to-end: A co-spends B and B's covenant runs, exactly as a direct call.
const POOL_INTERFACE = `
interface IPool {
    public int balance;
    function deposit(int amount);
}
`;

const POOL_B = `
pragma solidcash >=0.8.0;

${POOL_INTERFACE}

contract Pool() is IPool {
    int balance;

    function deposit(int amount) {
        require(amount > 0);
        this.balance = this.balance + amount;
    }
}
`;

// A calls B through a foreign function pointer (statement-form call).
const DEPOSITOR_PTR = `
pragma solidcash >=0.8.0;

${POOL_INTERFACE}

contract Depositor(bytes poolAddr) {
    int totalDeposited;

    function addToPool(int val) {
        function(int) external f = IPool(poolAddr).deposit;
        f(val);
        this.totalDeposited = this.totalDeposited + val;
    }
}
`;

async function setup(): Promise<{ scA: ConnectedStatefulContract; scB: ConnectedStatefulContract }> {
  const provider: MockNetworkProvider = createTestProvider();
  const artA = compileString(DEPOSITOR_PTR);
  const artB = compileString(POOL_B);

  // Genesis B first: A's constructor embeds B's real master locking bytecode.
  const contractB = new Contract(artB, [], { provider });
  const { categoryId: catB } = await setupStatefulUtxos(
    provider, contractB, artB.stateLayout!, { balance: 0n }, { saltContract: true },
  );
  const poolAddr = contractB.withCategory(hexToBin(catB)).lockingBytecode;
  const contractA = new Contract(artA, [poolAddr], { provider });
  const { categoryId: catA } = await setupStatefulUtxos(
    provider, contractA, artA.stateLayout!, { totalDeposited: 0n }, { saltContract: true },
  );

  const scB = StatefulContract.withCategory(contractB, catB);
  const scA = StatefulContract.withCategory(contractA, catA);
  return { scA, scB };
}

describe('foreign external function pointer (straight-line desugar)', () => {
  it('co-spends the target and runs its covenant via the pointer call, on the VM', async () => {
    const { scA, scB } = await setup();
    const tx = await scA.addToPool(10n)
      .withExternalCall(scB, 'deposit', [10n])
      .send();
    expect(tx.txid).toBeDefined();
  });
});
