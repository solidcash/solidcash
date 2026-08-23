import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ContractFactory, Signer, syncMockBlockOracleDeployment } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';

function freshKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  key[0] = (key[0] & 0x7f) | 0x01;
  return key;
}

const TIMED = `
contract Timed() {
  function gated(int started) {
    require(block.timestamp >= started + 86400, "24 hours have not passed yet");
    require(true);
  }
}
`;

describe('mock evm_increaseTime writes __block_timestamp', () => {
  it('advances the covenant oracle register on the live data NFT', async () => {
    const provider = createTestProvider();
    const signer = new Signer(freshKey(), provider);
    const funding: Utxo = { txid: 'b1'.repeat(32), vout: 0, satoshis: 5_000_000n };
    await provider.addUtxo(signer.getAddress(), funding);
    const timed = await new ContractFactory(compileString(TIMED), signer).deploy();
    expect(await timed.getState()).toMatchObject({ __block_timestamp: 0n });

    await provider.send('evm_increaseTime', [86400]);
    const after = await timed.getState();
    expect(after.__block_timestamp).toBe(BigInt(provider.getBlockTime()));
    expect(after.__block_timestamp).toBeGreaterThan(86_400n);
  });

  it('synchronizes every registered participant before building a call', async () => {
    const provider = createTestProvider();
    const signer = new Signer(freshKey(), provider);
    await provider.addUtxo(signer.getAddress(), {
      txid: 'b2'.repeat(32), vout: 0, satoshis: 10_000_000n,
    });
    const factory = new ContractFactory(compileString(TIMED), signer);
    const first = await factory.deploy();
    const second = await factory.deploy();

    await syncMockBlockOracleDeployment(provider, { contract: first });
    provider.increaseTime(5);
    await syncMockBlockOracleDeployment(provider, { contract: second });
    expect((await first.getState()).__block_timestamp)
      .not.toBe((await second.getState()).__block_timestamp);

    await provider.addUtxo(signer.getAddress(), {
      txid: 'b3'.repeat(32), vout: 0, satoshis: 1_000_000n,
    });
    await first.gated(0n).send();
    expect((await first.getState()).__block_timestamp)
      .toBe((await second.getState()).__block_timestamp);
  });
});
