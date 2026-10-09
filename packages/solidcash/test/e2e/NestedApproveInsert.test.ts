import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory, upgrades } from '../../src/index.js';
import { createTestProvider, getSigners } from '../test-util.js';
import { addressToLockScript } from '../../src/utils.js';

const TOKEN = `
pragma solidity ^0.8.0;
contract MiniToken {
    mapping(address => mapping(address => uint256)) public allowance;
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
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
    int public completed;
    function initialize() public { this.completed = 0; }
    function forceApprove(address token) public {
        bytes memory payload = abi.encodeCall(
            IMiniToken.approve, (address(this), type(uint256).max)
        );
        (bool success, bytes memory returned) = token.call(payload);
        require(success && abi.decode(returned, (bool)));
        this.completed = this.completed + 1;
    }
}
`;

describe('nested approve insert', () => {
  it('uses the delegated state owner for a returning msg.sender-keyed write', async () => {
    const provider = createTestProvider();
    const [signer] = await getSigners(1, { provider, fundingUtxos: 8 });
    const options = {
      forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      evmCompat: true,
    } as const;
    const tokenArtifact = compileString(TOKEN, options);
    const callerArtifact = compileString(CALLER, options);
    expect(tokenArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(callerArtifact.messageBus?.convention).toBe('kernel-row-loop');

    const token = await getContractFactory(tokenArtifact, signer).deploy();
    const caller = await upgrades.deployProxy(getContractFactory(callerArtifact, signer), []);
    const tx = await (caller as any).forceApprove(token.inner.lockingBytecode).send();

    expect(tx.txid).toBeDefined();
    expect((await caller.proxy.getState()).completed).toBe(1n);
    // A proxy's Solidity-visible identity is its authenticated CREATE address, not its replaceable master
    // locking bytecode. Both msg.sender at MiniToken and address(this) in the delegate use that identity.
    const logicalCaller = addressToLockScript(await caller.getAddress());
    expect(await token.state.allowance(
      logicalCaller,
      logicalCaller,
    )).toBe((1n << 256n) - 1n);
    expect(await token.state.allowance(
      caller.proxy.inner.lockingBytecode,
      caller.proxy.inner.lockingBytecode,
    )).toBe(0n);
  }, 180_000);
});
