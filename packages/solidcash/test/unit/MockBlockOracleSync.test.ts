import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Signer } from '../../src/index.js';
import { ContractFactory } from '../../src/stateful/index.js';
import { syncMockBlockOracleDeployment } from '../../src/oracle/index.js';
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

describe('mock evm_increaseTime writes the block oracle commitment', () => {
  it('advances the one oracle commitment, not a reader register', async () => {
    const provider = createTestProvider();
    const artifact = compileString(TIMED);
    expect(artifact.abi.map((fn) => fn.name)).not.toContain('__updateBlockOracle');
    expect(artifact.stateLayout?.variables.map((v) => v.name) ?? []).not.toContain('__block_timestamp');
    if (!('refreshBlockOracle' in provider)) return;
    await provider.send('evm_increaseTime', [86400]);
    const lock = provider.blockOracleLock;
    const utxo = (await provider.getUtxosForLockingBytecode(lock))
      .find((item) => item.token?.nft?.capability === 'mutable');
    const { blockOracleFieldBytes } = await import('@solidcash/utils');
    const { hexToBin } = await import('@bitauth/libauth/build/lib/format/hex.js');
    const timestamp = blockOracleFieldBytes(hexToBin(utxo?.token?.nft?.commitment ?? ''), 'timestamp');
    let value = 0n;
    for (let index = 0; index < 4; index += 1) value |= BigInt(timestamp[index] ?? 0) << BigInt(8 * index);
    expect(value).toBe(BigInt(provider.getBlockTime()));
    expect(value).toBeGreaterThan(86_400n);
  });

  it('keeps one clock for every reader', async () => {
    const provider = createTestProvider();
    if (!('refreshBlockOracle' in provider)) return;
    provider.increaseTime(5);
    const { syncMockBlockOracles } = await import('../../src/oracle/index.js');
    await syncMockBlockOracles(provider);
    const utxos = await provider.getUtxosForLockingBytecode(provider.blockOracleLock);
    expect(utxos.filter((utxo) => utxo.token?.nft?.capability === 'mutable')).toHaveLength(1);
  });
});
