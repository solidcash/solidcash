import { describe, expect, it } from 'vitest';
import { ContractFactory } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getSigners } from '../test-util.js';

// A Solidity-compat `call{value: 0}` to a stateful callee whose function writes mapping entries, emits and returns
// needs the callee's whole block, not only its master and data records. The callee runs as a direct external group,
// so its entries, event and record are co-spent and derived as a typed call's are, while the caller's compat pin reads
// it at its call-input witness and attests its edge. Its msg.sender is the caller a typed call presents.
const OPTIONS = { evmCompat: true, forceStateful: true } as any;
const limits = { maximumInputBytes: 100_000, maximumTransactionBytes: 10_000_000, maximumNftCommitmentBytes: 128 };

const COIN = `
pragma solidity ^0.8.0;
contract Coin {
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  event Transfer(address indexed from, address indexed to, uint256 value);
  function mint(address to, uint256 value) external { balanceOf[to] += value; }
  function approve(address spender, uint256 value) external returns (bool) {
    allowance[msg.sender][spender] = value;
    return true;
  }
  function transferFrom(address from, address to, uint256 value) external returns (bool) {
    allowance[from][msg.sender] -= value;
    balanceOf[from] -= value;
    balanceOf[to] += value;
    emit Transfer(from, to, value);
    return true;
  }
}`;

const VAULT = `
pragma solidity ^0.8.0;
interface ICoin { function transferFrom(address from, address to, uint256 value) external returns (bool); }
contract Vault {
  ICoin coin;
  uint256 public pulled;
  function setCoin(ICoin c) external { coin = c; }
  function pull(uint256 amount) external {
    (bool ok, ) = address(coin).call{value: 0}(
      abi.encodeWithSelector(ICoin.transferFrom.selector, msg.sender, address(this), amount));
    require(ok);
    pulled = pulled + amount;
  }
}`;

describe('Solidity-compat call to a callee that writes entries, emits and returns', () => {
  it('co-spends the callee block: balances, allowance, event and record settle beside the caller', async () => {
    const provider = createTestProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 20 });
    const coin: any = await new ContractFactory(compileString(COIN, OPTIONS), alice).deploy();
    const vault: any = await new ContractFactory(compileString(VAULT, OPTIONS), alice).deploy();
    await vault.setCoin(coin.address).send();
    const holder = addressToLockScript(bob.getAddress());
    const vaultAddress = await vault.getAddress();
    await coin.mint(holder, 1000n).send();
    // The address string resolves to the value the vault presents as a caller: a direct contract's execution lock.
    await coin.connect(bob).approve(vaultAddress, 1000n).send();

    await vault.connect(bob).pull(100n).send();

    expect((await vault.getState()).pulled).toBe(100n);
    expect(await coin.state.balanceOf(holder)).toBe(900n);
    expect(await coin.state.allowance(holder, addressToLockScript(vault.address))).toBe(900n);
    // The payload's `address(this)` is the vault's authenticated CREATE lock.
    expect(await coin.state.balanceOf(addressToLockScript(vaultAddress))).toBe(100n);
  }, 300_000);
});
