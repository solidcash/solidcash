import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ContractFactory, HDSigner } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';

const SRC = `pragma solidcash >=0.8.0;
contract DomainBoxEvt() {
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  address public owner;
  address public weth;
  bytes32 public domain;
  constructor(address w) {
    owner = msg.sender;
    emit OwnershipTransferred(address(0), msg.sender);
    weth = w;
    domain = keccak256(abi.encode(bytes32(0x1234), uint256(1), address(this)));
  }
  function touch() public { require(msg.sender == owner); }
}`;

describe('constructor keccak + OwnershipTransferred event', () => {
  it('deploys', async () => {
    const provider = createTestProvider();
    const signer = HDSigner.fromPhrase(
      'test test test test test test test test test test test junk',
      provider,
    );
    for (let i = 0; i < 8; i++) {
      await provider.addUtxo(signer.getAddress(), {
        txid: Buffer.alloc(32, i + 1).toString('hex'),
        vout: 0,
        satoshis: 100_000_000n,
      });
    }
    const artifact = compileString(SRC, { forceStateful: true });
    console.log('construct layout', artifact.abi.find(f => f.name === '__construct')?.blockLayout);
    const factory = new ContractFactory(artifact, signer);
    const c = await factory.deploy(signer.getAddress());
    await c.deployed();
    expect(await c.owner()).toBeTruthy();
  });
});
