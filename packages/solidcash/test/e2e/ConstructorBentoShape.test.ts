import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ContractFactory, HDSigner } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';

// Closer to BentoBox: immutables + chainid + domain keccak + event
const SRC = `pragma solidcash >=0.8.0;
contract BentoShape() {
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  address public owner;
  address private immutable wethToken;
  bytes32 private immutable _DOMAIN_SEPARATOR;
  uint256 private immutable DOMAIN_SEPARATOR_CHAIN_ID;
  constructor(address wethToken_) {
    owner = msg.sender;
    emit OwnershipTransferred(address(0), msg.sender);
    wethToken = wethToken_;
    uint256 chainId = block.chainid;
    DOMAIN_SEPARATOR_CHAIN_ID = chainId;
    _DOMAIN_SEPARATOR = keccak256(abi.encode(
      keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
      keccak256("Mirror V1"),
      chainId,
      address(this)
    ));
  }
  function getOwner() public view returns (address) { return owner; }
}`;

describe('BentoBox-shaped constructor', () => {
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
    const ctor = artifact.abi.find(f => f.name === '__construct');
    console.log('layout', JSON.stringify(ctor?.blockLayout));
    console.log('keccak', ctor?.keccakCompute, ctor?.externalLibraryCalls);
    console.log('bc', (artifact.bytecode?.length ?? 0) / 2);
    const factory = new ContractFactory(artifact, signer);
    const c = await factory.deploy(signer.getAddress());
    await c.deployed();
    expect(await c.getOwner()).toBeTruthy();
  });
});
