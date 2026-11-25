import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { createTestProvider, getSigners } from '../test-util.js';
import { addressToLockScript } from '../../src/utils.js';

/**
 * A token writer with THREE entry slots (allowance update + two balance writes) whose recipient balance is a
 * cold INSERT. The compiler puts the insert's NEW node at the entry slot and the relinked predecessor P' at a
 * trailing slot. A mirrored predecessor co-spend also starts with the proof slot, so a repair that keys only on
 * "starts with the proof slot and points at some later entry" swapped the owner UPDATE into the NEW's
 * coordinate. The next probe then saw an update where it expected NEW, never revealed the node, and the final
 * spend failed the entry comparison.
 */

const TOKEN = `
pragma solidity ^0.8.0;
contract MiniToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function mint(address to, uint256 value) public {
        balanceOf[to] += value;
    }
    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        allowance[from][msg.sender] -= value;
        balanceOf[from] -= value;
        balanceOf[to] += value;
        return true;
    }
}
`;

const CALLER = `
pragma solidity ^0.8.0;
interface IMiniToken {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}
contract Puller {
    int public pulls;
    function pull(address token, address from, address to, uint256 value) public {
        IMiniToken(token).transferFrom(from, to, value);
        this.pulls = this.pulls + 1;
    }
}
`;

describe('three-entry transferFrom insert', () => {
  it('installs the recipient NEW node at the entry slot beside the allowance and owner updates', async () => {
    const provider = createTestProvider();
    const [owner, recipient] = await getSigners(2, { provider, fundingUtxos: 8 });
    const options = {
      forceStateful: true,
      evmCompat: true,
    } as const;
    const tokenArtifact = compileString(TOKEN, options);
    const callerArtifact = compileString(CALLER, options);

    const token = await getContractFactory(tokenArtifact, owner).deploy();
    const caller = await getContractFactory(callerArtifact, owner).deploy();
    const ownerIdentity = addressToLockScript(owner.getAddress());
    const recipientIdentity = addressToLockScript(recipient.getAddress());
    const callerIdentity = addressToLockScript(await caller.getAddress());

    await (token as any).mint(ownerIdentity, 100n).send();
    await (token as any).approve(callerIdentity, 100n).send();
    // The recipient holds no entry yet: its balance write is a cold INSERT in the same batch as the allowance
    // and owner-balance UPDATEs.
    await (caller as any).pull(
      token.inner.lockingBytecode, ownerIdentity, recipientIdentity, 40n,
    ).send();

    expect((await caller.getState()).pulls).toBe(1n);
    expect(await token.state.balanceOf(recipientIdentity)).toBe(40n);
    expect(await token.state.balanceOf(ownerIdentity)).toBe(60n);
    expect(await token.state.allowance(ownerIdentity, callerIdentity)).toBe(60n);
  }, 180_000);
});
