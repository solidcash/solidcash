import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ContractFactory } from '../../src/index.js';
import { addressToLockScript, lockingBytecodeToSolidityAddressPayload } from '../../src/utils.js';
import { createTestProvider, getSigners } from '../test-util.js';

// Before Solidity 0.7 an `internal` constructor marked a contract abstract. Compiled on its own, that constructor is
// still the deploy's entry point, and needs the hidden msg.sender inputs and the block layout a public one gets. It
// got neither: "Logical msg.sender context is unavailable while compiling '__construct'" (MistSwap's Ownable).
const SOURCE = `pragma solidity 0.6.12;
contract Owned {
  address public owner;
  uint256 public x;
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  constructor () internal {
    owner = msg.sender;
    emit OwnershipTransferred(address(0), msg.sender);
  }
  modifier onlyOwner() {
    require(msg.sender == owner, "Ownable: caller is not the owner");
    _;
  }
  function set(uint256 v) public onlyOwner {
    x = v;
  }
}`;

describe('an internal constructor reading msg.sender', () => {
  it('records the deployer as the owner, and only the owner passes the owner check', async () => {
    const artifact = compileString(SOURCE, { evmCompat: true, forceStateful: true });
    const provider = createTestProvider();
    const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 4 });
    const owned: any = await new ContractFactory(artifact, alice).deploy();
    // A public address getter returns the 20-byte payload. The covenant stores the P2PKH lock.
    const owner = lockingBytecodeToSolidityAddressPayload(addressToLockScript(alice.getAddress()));
    expect(owner).toBeDefined();
    expect(await owned.state.owner()).toEqual(owner);

    await owned.set(7n).send();
    expect(await owned.state.x()).toBe(7n);
    await expect(owned.connect(bob).set(8n).send()).rejects.toThrow(/OP_VERIFY|caller is not the owner/);
    expect(await owned.state.x()).toBe(7n);
  });
});
