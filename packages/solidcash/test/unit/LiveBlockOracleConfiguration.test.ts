import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { blockOracleLockingBytecode, blockOracleOwnerPkh, hash160 } from '@solidcash/utils';
import { ElectrumNetworkProvider } from '../../src/network/electrum/index.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { Contract } from '../../src/index.js';
import { Network } from '../../src/interfaces.js';
import { blockOracleGenesisOutput } from '../../src/oracle/block-oracle-deployment.js';
import { compileString } from '../direct-compile.js';
import { alicePub } from '../fixture/vars.js';

// A client supplied to the provider avoids creating a websocket or making network requests.
const electrum = {} as never;
const READER = 'contract Clock() { function at(int t) { require(block.timestamp == t); } }';
const categoryId = 'a7'.repeat(31) + '58';

describe('live block oracle configuration', () => {
  it('keeps no shared oracle on a live provider: a reader\'s lock follows its own category', () => {
    const provider: NetworkProvider = new ElectrumNetworkProvider(Network.MAINNET, { electrum });
    for (const shared of ['blockOracleLock', 'blockOracleCategory']) expect(shared in provider).toBe(false);
    expect(provider.blockOracleOwnerPublicKey).toBeUndefined();
    expect(provider.blockOracleFields).toBeUndefined();
    const artifact = compileString(READER);
    const reader = new Contract(artifact, [], { provider, category: hexToBin(categoryId) });
    expect(reader.blockOracleLock).toEqual(blockOracleLockingBytecode(hexToBin(categoryId)));
    const other = hexToBin('a7'.repeat(31) + '59');
    expect(reader.withCategory(other).blockOracleLock).toEqual(blockOracleLockingBytecode(other));
    expect(new Contract(artifact, [], { provider }).blockOracleLock).toBeUndefined();
  });

  it('mints a reader\'s oracle at its own lock, naming the owner its deployer chose', () => {
    const provider: NetworkProvider = new ElectrumNetworkProvider(Network.MAINNET, { electrum });
    const artifact = compileString(READER);
    // A live provider owns no oracles, so the deployer must name a valid owner key.
    expect(() => blockOracleGenesisOutput(artifact, categoryId, provider, undefined, 1_000n))
      .toThrow('needs blockOracleOwnerPublicKey');
    expect(() => blockOracleGenesisOutput(artifact, categoryId, provider, new Uint8Array(33), 1_000n))
      .toThrow('valid compressed public key');
    const oracle = blockOracleGenesisOutput(artifact, categoryId, provider, alicePub, 1_000n);
    expect(oracle?.to).toEqual(blockOracleLockingBytecode(hexToBin(categoryId)));
    expect(oracle?.token).toMatchObject({ category: categoryId, amount: 0n, nft: { capability: 'mutable' } });
    expect(blockOracleOwnerPkh(hexToBin(oracle!.token!.nft!.commitment))).toEqual(hash160(alicePub));
  });
});
