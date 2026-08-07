import { compileString } from '../direct-compile.js';
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

// Same-address varying-method pointer -> ONE co-spend of the target with a RUNTIME selector bound to cond
// (not two branched co-spends). For up=true the runtime selector resolves to `inc`, which matches the one
// provisioned co-spend, so the covenant's `co-spent selector == (up ? inc.sel : dec.sel)` holds.
const CALC_INTERFACE = `
interface ICalc {
    public int total;
    function inc(int x) returns (int);
    function dec(int x) returns (int);
}
`;

const CALC_B = `
pragma solidcash >=0.8.0;

${CALC_INTERFACE}

contract Calc() is ICalc {
    int total;
    function inc(int x) returns (int) { this.total = this.total + x; return this.total; }
    function dec(int x) returns (int) { this.total = this.total - x; return this.total; }
}
`;

const CHOOSER = `
pragma solidcash >=0.8.0;

${CALC_INTERFACE}

contract Chooser(bytes calcAddr) {
    int last;
    function pick(bool up, int x) {
        function(int) external returns (int) f = up ? ICalc(calcAddr).inc : ICalc(calcAddr).dec;
        this.last = f(x);
    }
}
`;

describe('foreign external function pointer (same-address varying method, runtime selector)', () => {
  async function setupChooser(): Promise<{ scA: ConnectedStatefulContract; scB: ConnectedStatefulContract }> {
    const provider: MockNetworkProvider = createTestProvider();
    const artA = compileString(CHOOSER);
    const artB = compileString(CALC_B);
    const contractB = new Contract(artB, [], { provider });
    const { categoryId: catB } = await setupStatefulUtxos(
      provider, contractB, artB.stateLayout!, { total: 100n }, { saltContract: true },
    );
    const calcAddr = contractB.withCategory(hexToBin(catB)).lockingBytecode;
    const contractA = new Contract(artA, [calcAddr], { provider });
    const { categoryId: catA } = await setupStatefulUtxos(
      provider, contractA, artA.stateLayout!, { last: 0n }, { saltContract: true },
    );
    return {
      scB: StatefulContract.withCategory(contractB, catB),
      scA: StatefulContract.withCategory(contractA, catA),
    };
  }

  it('binds the co-spent method to the runtime selector for the TRUE branch (one co-spend)', async () => {
    const { scA, scB } = await setupChooser();
    // up=true -> runtime selector == inc.selector; one co-spend of Calc for `inc` satisfies it.
    const tx = await scA.pick(true, 5n).withExternalCall(scB, 'inc', [5n]).send();
    expect(tx.txid).toBeDefined();
  });

  it('binds the co-spent method to the runtime selector for the FALSE branch (one co-spend)', async () => {
    const { scA, scB } = await setupChooser();
    // up=false -> runtime selector == dec.selector; the covenant would REJECT a co-spend of `inc`.
    const tx = await scA.pick(false, 5n).withExternalCall(scB, 'dec', [5n]).send();
    expect(tx.txid).toBeDefined();
  });
});
