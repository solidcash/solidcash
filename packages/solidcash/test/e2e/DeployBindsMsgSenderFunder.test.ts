import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { ContractFactory, HDSigner } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
/**
 * ContractFactory.deploy must bind the deploying Signer as `_signer` on the returned contract.
 *
 * Without that binding, a post-deploy call that reads msg.sender / tx.origin (Ownable.onlyOwner,
 * ERC20.approve, mint, ...) falls back to P2SH32 OP_TRUE dummy funders. emitTxOrigin then sees no
 * native P2PKH input, the origin is empty, and the covenant OP_VERIFYs it. MistSwap's SushiToken
 * mint/approve/renounceOwnership failed exactly that way under the Hardhat drop-in.
 */
const SRC = `pragma solidcash >=0.8.0;
contract Owned() {
  address public owner;
  constructor() { this.owner = msg.sender; }
  modifier onlyOwner() {
    require(this.owner == msg.sender, "Ownable: caller is not the owner");
    _;
  }
  function renounce() public onlyOwner {
    this.owner = address(0);
  }
  function touch() public onlyOwner {
    this.owner = this.owner;
  }
}`;

describe('ContractFactory.deploy binds the signer as the msg.sender funder', () => {
  it('lets the deployer call an onlyOwner function after deploy', async () => {
    const provider = createTestProvider();
    const signer = HDSigner.fromPhrase(
      'test test test test test test test test test test test junk',
      provider,
    );
    // Fund the signer generously so genesis + post-deploy funder inputs are available.
    for (let i = 0; i < 8; i++) {
      await provider.addUtxo(signer.getAddress(), {
        txid: Buffer.alloc(32, i + 1).toString('hex'),
        vout: 0,
        satoshis: 100_000_000n,
      });
    }

    const artifact = compileString(SRC, { forceStateful: true });
    const factory = new ContractFactory(artifact, signer);
    const owned = await factory.deploy();
    await owned.deployed();

    // Bound `_signer` is what forces a native P2PKH funder for emitTxOrigin.
    expect((owned as unknown as { _signer?: { getAddress: () => string } })._signer?.getAddress())
      .toBe(signer.getAddress());

    // View: owner is the deployer's locking bytecode (constructor wrote msg.sender = tx.origin).
    const owner = await owned.owner();
    const ownerHex = typeof owner === 'string' ? owner : binToHex(owner as Uint8Array);
    expect(ownerHex).toBe(binToHex(addressToLockScript(signer.getAddress())));

    // State-mutating onlyOwner call: without `_signer` this OP_VERIFYs an empty tx.origin.
    await owned.touch().send();
    await owned.renounce().send();
  });
});
