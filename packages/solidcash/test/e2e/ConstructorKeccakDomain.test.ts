import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ContractFactory, HDSigner } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';

const SRC = `pragma solidcash >=0.8.0;
contract DomainBox() {
  address public owner;
  address public weth;
  bytes32 public domain;
  constructor(address w) {
    owner = msg.sender;
    weth = w;
    domain = keccak256(abi.encode(bytes32(0x1234), uint256(1), address(this)));
  }
}`;

describe('constructor keccak256 (domain-style)', () => {
  it('deploys with DOMAIN-like keccak in constructor', async () => {
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
    const factory = new ContractFactory(artifact, signer);
    const w = signer.getAddress(); // cashaddr as address arg
    // encode as locking bytecode via factory by passing string cashaddr
    const c = await factory.deploy(w);
    await c.deployed();
    expect(await c.owner()).toBeTruthy();
    expect(await c.weth()).toBeTruthy();
    expect(await c.domain()).toBeTruthy();
  });
});
