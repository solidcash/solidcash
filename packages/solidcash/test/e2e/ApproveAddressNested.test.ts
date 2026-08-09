import { describe, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ContractFactory } from '../../src/index.js';
import { createTestProvider, getSigners } from '../test-util.js';

const limits = {
  maximumInputBytes: 100_000,
  maximumTransactionBytes: 10_000_000,
  maximumNftCommitmentBytes: 128,
};

async function run(
  // eslint-disable-next-line @typescript-eslint/default-param-last
  label: string, src: string, deployArgs: any[] = [], call: (lp: any, bob: any) => Promise<void>,
): Promise<void> {
  const provider = createTestProvider();
  (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
  const art = compileString(src, { forceStateful: true });
  const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 5 });
  const lp = await new ContractFactory(art, alice).deploy(...deployArgs);
  await call(lp, bob);
  console.log('OK', label);
}

describe('approve after C2 snapshot fix', () => {
  it('nested int + event', async () => {
    await run('nested int + event', `
      contract T() {
        mapping(int => mapping(int => uint256)) a;
        event Approval(int indexed o, int indexed s, uint256 v);
        function approve(int o, int s, uint256 n) public {
          a[o][s]=n; emit Approval(o, s, n);
        }
      }`, [], async (lp) => { await lp.approve(1n, 2n, 1000n).send(); });
  });
  it('nested address + event', async () => {
    await run('nested address + event', `
      contract T() {
        mapping(address => mapping(address => uint256)) a;
        event Approval(address indexed o, address indexed s, uint256 v);
        function approve(address s, uint256 n) public {
          a[msg.sender][s]=n; emit Approval(msg.sender, s, n);
        }
      }`, [], async (lp, bob) => { await lp.approve(bob.getAddress(), 1000n).send(); });
  });
  it('OZ-like full', async () => {
    await run('OZ-like full', `
      contract T() {
        uint256 private _totalSupply;
        mapping(address => uint256) private _balances;
        mapping(address => mapping(address => uint256)) private _allowances;
        event Approval(address indexed owner, address indexed spender, uint256 value);
        event Transfer(address indexed from, address indexed to, uint256 value);
        constructor(uint256 supply) {
          _totalSupply = supply;
          _balances[msg.sender] = supply;
          emit Transfer(address(0), msg.sender, supply);
        }
        function approve(address spender, uint256 amount) public returns (bool) {
          _allowances[msg.sender][spender] = amount;
          emit Approval(msg.sender, spender, amount);
          return true;
        }
      }`, [1000000000n], async (lp, bob) => { await lp.approve(bob.getAddress(), 1000n).send(); });
  });
});
