import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const TOKEN = `
pragma solidity ^0.8.0;
contract MiniToken {
    mapping(address => mapping(address => uint256)) public allowance;
    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        return true;
    }
}
`;

const CALLER = `
pragma solidity ^0.8.0;
interface IMiniToken {
    function approve(address spender, uint256 value) external returns (bool);
}
contract Approver {
    int public ok;
    function forceApprove(address token) public {
        require(IMiniToken(token).approve(address(this), 100));
        this.ok = this.ok + 1;
    }
}
`;

describe('nested approve insert', () => {
  it('inserts _allowances[caller][caller] when the caller force-approves itself', async () => {
    const provider = createTestProvider();
    const tokenArt = compileString(TOKEN, { solidityImportCompat: true });
    const callerArt = compileString(CALLER, { solidityImportCompat: true });
    const tokenInner = new Contract(tokenArt, [], { provider });
    const { categoryId: tokenCat } = await setupStatefulUtxos(
      provider, tokenInner, tokenArt.stateLayout!, {}, { saltContract: true },
    );
    const token = StatefulContract.withCategory(tokenInner.withCategory(hexToBin(tokenCat)), tokenCat);
    const callerInner = new Contract(callerArt, [], { provider });
    const { categoryId: callerCat } = await setupStatefulUtxos(
      provider, callerInner, callerArt.stateLayout!, { ok: 0n }, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(callerInner.withCategory(hexToBin(callerCat)), callerCat, {
      externals: { IMiniToken: token },
    });
    const tx = await caller.forceApprove(token.inner.lockingBytecode).send();
    expect(tx.txid).toBeDefined();
    expect((await caller.getState()).ok).toBe(1n);
    expect(await token.state.allowance(caller.inner.lockingBytecode, caller.inner.lockingBytecode)).toBe(100n);
  }, 180_000);
});
