/**
 * A block.* reader owns its block-info oracle (block oracle hardening, 2026-11-03): the reader is stateful, its
 * genesis mints the oracle as a mutable NFT of its own category at the lock that category gives, and its calls
 * co-spend that oracle and no other. The owner the oracle names updates it; another key cannot.
 */
import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { blockOracleFieldValue, blockOracleLockingBytecode, blockOracleOwnerPkh, hash160 } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { SignatureTemplate } from '../../src/index.js';
import { BlockOracleUpdater } from '../../src/oracle/index.js';
import { randomUtxo } from '../../src/utils.js';
import { aliceAddress, alicePriv, alicePub } from '../fixture/vars.js';

const SOURCE = 'contract Clock() { function at(int t) { require(block.timestamp == t); } }';

async function deploy(provider: MockNetworkProvider, options: { blockOracleOwnerPublicKey?: Uint8Array } = {}):
Promise<Awaited<ReturnType<typeof StatefulContract.deploy>>> {
  const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
  return StatefulContract.deploy(compileString(SOURCE), [], {
    provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
    ...options,
  });
}

async function oracleOf(provider: MockNetworkProvider, categoryId: string): Promise<Uint8Array> {
  const [oracle] = await provider.getUtxosForLockingBytecode(blockOracleLockingBytecode(hexToBin(categoryId)));
  expect(oracle?.token).toMatchObject({ category: categoryId, amount: 0n, nft: { capability: 'mutable' } });
  return hexToBin(oracle!.token!.nft!.commitment);
}

describe('a block.* reader owns its block-info oracle', () => {
  it('is stateful, and its genesis mints its own oracle naming the provider owner key', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider);
    expect(deployed.contract.inner.artifact.stateLayout).toBeDefined();
    const commitment = await oracleOf(provider, deployed.categoryId);
    expect(blockOracleOwnerPkh(commitment)).toEqual(hash160(provider.blockOracleOwnerPublicKey));
  });

  it('reads its own oracle, which the mock keeps current, and refuses a wrong value', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider);
    const now = blockOracleFieldValue(await oracleOf(provider, deployed.categoryId), 'timestamp');
    expect(now).toBe(BigInt(provider.getBlockTime()));
    await expect(deployed.contract.call.at(now).send()).resolves.toHaveProperty('txid');
    const later = blockOracleFieldValue(await oracleOf(provider, deployed.categoryId), 'timestamp');
    await expect(deployed.contract.call.at(later + 1n).send()).rejects.toThrow();
  });

  it('keeps two readers apart: each co-spends its own oracle', async () => {
    const provider = new MockNetworkProvider();
    const first = await deploy(provider);
    const second = await deploy(provider);
    expect(first.categoryId).not.toBe(second.categoryId);
    provider.setBlockOracleFields({
      number: 1n, timestamp: 1_111n, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: new Uint8Array(),
    }, first.categoryId);
    await expect(first.contract.call.at(1_111n).send()).resolves.toHaveProperty('txid');
    await expect(second.contract.call.at(1_111n).send()).rejects.toThrow();
  });

  it('names the deployer-chosen owner, whose keeper updates it, and no other key', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider, { blockOracleOwnerPublicKey: alicePub });
    expect(blockOracleOwnerPkh(await oracleOf(provider, deployed.categoryId))).toEqual(hash160(alicePub));
    const rpc = { request: async (): Promise<never> => { throw new Error('unused'); } };
    await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 100_000n }));
    const keeper = new BlockOracleUpdater({
      contract: deployed.contract.inner, categoryId: deployed.categoryId, keeperKey: alicePriv, rpc,
    });
    // A height update keeps the stored timestamp and does not rewind the number.
    const height = BigInt(await provider.getBlockHeight());
    const timestamp = await keeper.oracleTimestamp();
    const fields = { number: height, timestamp, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: new Uint8Array() };
    await expect(keeper.pushUpdate(fields)).resolves.toMatch(/^[0-9a-f]{64}$/);
    expect(await keeper.oracleHeight()).toBe(height);
    const stranger = new BlockOracleUpdater({
      contract: deployed.contract.inner, categoryId: deployed.categoryId, keeperKey: provider.blockOracleOwnerKey, rpc,
    });
    await expect(stranger.pushUpdate(fields)).rejects.toThrow();
  });
});
