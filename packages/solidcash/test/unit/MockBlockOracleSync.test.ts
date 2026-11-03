import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { blockOracleFieldValue, blockOracleLockingBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { SignatureTemplate } from '../../src/index.js';
import { syncMockBlockOracles } from '../../src/oracle/index.js';
import { randomUtxo } from '../../src/utils.js';
import { aliceAddress, alicePriv } from '../fixture/vars.js';

const TIMED = `
contract Timed() {
  function gated(int started) {
    require(block.timestamp >= started + 86400, "24 hours have not passed yet");
    require(true);
  }
}
`;

/** Deploy a reader, whose genesis mints its own oracle, and return its category. */
async function deployReader(provider: MockNetworkProvider): Promise<string> {
  const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
  const deployed = await StatefulContract.deploy(compileString(TIMED), [], {
    provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
  });
  return deployed.categoryId;
}

/** Timestamp of the one oracle of `categoryId`: a mutable NFT of that category at the lock it gives. */
async function oracleTimestamp(provider: MockNetworkProvider, categoryId: string): Promise<bigint> {
  const oracles = (await provider.getUtxosForLockingBytecode(blockOracleLockingBytecode(hexToBin(categoryId))))
    .filter((utxo) => utxo.token?.nft?.capability === 'mutable');
  expect(oracles).toHaveLength(1);
  expect(oracles[0]!.token!.category).toBe(categoryId);
  return blockOracleFieldValue(hexToBin(oracles[0]!.token!.nft!.commitment), 'timestamp');
}

describe('mock evm_increaseTime writes each reader\'s block oracle commitment', () => {
  it('advances the reader\'s own oracle commitment, not a reader register', async () => {
    const artifact = compileString(TIMED);
    expect(artifact.abi.map((fn) => fn.name)).not.toContain('__updateBlockOracle');
    expect(artifact.stateLayout?.variables.map((v) => v.name) ?? []).not.toContain('__block_timestamp');
    const provider = new MockNetworkProvider();
    const categoryId = await deployReader(provider);
    const before = await oracleTimestamp(provider, categoryId);
    await provider.send('evm_increaseTime', [86400]);
    const after = await oracleTimestamp(provider, categoryId);
    expect(after).toBe(BigInt(provider.getBlockTime()));
    expect(after).toBe(before + 86_400n);
  });

  it('advances every reader\'s own oracle with the one mock clock', async () => {
    const provider = new MockNetworkProvider();
    const readers = [await deployReader(provider), await deployReader(provider)];
    expect(readers[0]).not.toBe(readers[1]);
    const now = BigInt(provider.getBlockTime());
    provider.increaseTime(5);
    await syncMockBlockOracles(provider);
    for (const categoryId of readers) expect(await oracleTimestamp(provider, categoryId)).toBe(now + 5n);
  });
});
