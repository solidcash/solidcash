import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ContractFactory, HDSigner } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';

/**
 * ethers resolves PROMISE-valued deploy arguments before encoding them (`resolveProperties`), so a suite can
 * pass a contract read straight through without awaiting it. MistSwap's SushiMakerKashi does exactly that:
 *
 *   deploy(this, [["kashiMaker", this.SushiMakerKashi, [..., this.factory.pairCodeHash()]]])
 *
 * Without the same resolution the encoder is handed a Promise and refuses it with
 * "Value for type bytes32 should be a Uint8Array or hex string".
 */
const SRC = `pragma solidcash >=0.8.0;
  contract C(bytes32 codeHash) {
    address owner;
    constructor() { owner = msg.sender; }
    function get() public view returns (bytes32) { return codeHash; }
  }`;

describe('deploy resolves promise-valued arguments (ethers parity)', () => {
  const fundedSigner = async (): Promise<HDSigner> => {
    const provider = createTestProvider();
    const signer = HDSigner.fromPhrase(
      'test test test test test test test test test test test junk', provider,
    );
    for (let i = 0; i < 8; i++) {
      await provider.addUtxo(signer.getAddress(), {
        txid: Buffer.alloc(32, i + 1).toString('hex'), vout: 0, satoshis: 100_000_000n,
      });
    }
    return signer;
  };

  it('accepts a Promise where a bytes32 is expected', async () => {
    const artifact = compileString(SRC, { forceStateful: true });
    const hash = Promise.resolve(`0x${'ab'.repeat(32)}`);
    const contract = await new ContractFactory(artifact, await fundedSigner()).deploy(hash as any);
    expect((contract as any).address).toMatch(/^(?:bchtest|bchreg):/);
  }, 180000);

  it('still accepts the already-resolved value', async () => {
    const artifact = compileString(SRC, { forceStateful: true });
    const contract = await new ContractFactory(artifact, await fundedSigner())
      .deploy(`0x${'ab'.repeat(32)}`);
    expect((contract as any).address).toMatch(/^(?:bchtest|bchreg):/);
  }, 180000);
});
