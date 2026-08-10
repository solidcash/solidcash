import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ContractFactory } from '../../src/index.js';
import { createTestProvider, getSigners } from '../test-util.js';

// Regression: vmap batch topology witnesses are snapshotted to the altstack at function start. An emit that
// final-use OP_ROLLs a mapping key param off the tracked stack must not cause restore to re-filter a shorter
// name list and scramble Slot/Proof/Next/PredOut (ERC20.approve shape: nested allowances + Approval event).
const SRC = `
contract Token() {
  mapping(address => mapping(address => uint256)) allowances;
  event Approval(address indexed owner, address indexed spender, uint256 value);
  function approve(address spender, uint256 amount) public returns (bool) {
    allowances[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
  }
}
`;

const limits = {
  maximumInputBytes: 100_000,
  maximumTransactionBytes: 10_000_000,
  maximumNftCommitmentBytes: 128,
};

describe('vmap batch + emit key-param OP_ROLL', () => {
  it('nested mapping write then emit with shared key params settles', async () => {
    const provider = createTestProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    const art = compileString(SRC, { forceStateful: true });
    const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 5 });
    const token = await new ContractFactory(art, alice).deploy();
    const send = token.approve(bob.getAddress(), 1000n).send();
    if (process.env.TESTS_USE_REGTEST) {
      // This intentionally unsplit C2 regression compiles to a 1,201-byte redeem script. Mocknet raises its
      // input limits to exercise the altstack snapshot behavior, but BCH cannot push a stack item over 520 bytes.
      await expect(send).rejects.toThrow(/maximum stack item length.*520 bytes/i);
      return;
    }
    const tx = await send;
    expect(tx.txid).toBeDefined();
  });
});
