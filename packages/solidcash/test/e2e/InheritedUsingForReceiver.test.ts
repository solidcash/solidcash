import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { bobAddress } from '../fixture/vars.js';
import { fundedSigner } from '../test-util.js';

// An inherited helper called with `msg.sender` is inlined with the sender substituted for its parameter. A using-for
// call on a mapping read keyed by that parameter (`_balances[account].add(amount)`, OZ ERC20 and UniswapV2ERC20) is
// still a method call at that point, and the substitution has to reach its receiver: it used to leave `account`
// dangling ("Undefined reference to symbol account").
const SOURCE = `pragma solidity ^0.8.0;
library SafeMath {
  function add(uint256 a, uint256 b) internal pure returns (uint256) { uint256 c = a + b; require(c >= a); return c; }
  function sub(uint256 a, uint256 b) internal pure returns (uint256) { require(b <= a); return a - b; }
}
contract Ledger {
  using SafeMath for uint256;
  mapping(address => uint256) private _balances;
  function _mint(address account, uint256 amount) internal {
    _balances[account] = _balances[account].add(amount);
  }
  function _transfer(address from, address to, uint256 value) internal {
    _balances[from] = _balances[from].sub(value);
    _balances[to] = _balances[to].add(value);
  }
}
contract Token is Ledger {
  function mint(uint256 amount) public { _mint(msg.sender, amount); }
  function transfer(address to, uint256 value) public { _transfer(msg.sender, to, value); }
}`;

describe('inherited using-for receiver keyed by a substituted msg.sender', () => {
  it('mints to and transfers from the caller', async () => {
    const artifact = compileString(SOURCE, { solidityImportCompat: true, forceStateful: true });
    const signer = await fundedSigner();
    const token = await getContractFactory(artifact, signer).deploy();
    const caller = addressToLockScript(signer.getAddress());
    const bob = addressToLockScript(bobAddress);

    await token.mint(5n);
    expect(await token.state._balances(caller)).toBe(5n);

    await token.transfer(bob, 2n);
    expect(await token.state._balances(caller)).toBe(3n);
    expect(await token.state._balances(bob)).toBe(2n);
  });
});
