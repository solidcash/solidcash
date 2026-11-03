import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  blockhashOracleLockingBytecode, decodeBlockhashSlotCommitment, hash160, type BlockhashSlotFields,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { SignatureTemplate } from '../../src/index.js';
import { BlockOracleUpdater } from '../../src/oracle/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { randomUtxo } from '../../src/utils.js';
import { aliceAddress, alicePriv, alicePub } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';

const SOURCE = 'contract Reader(){ function check(int n, bytes32 expected) { require(blockhash(n) == expected); } }';
const HASH = new Uint8Array(32).fill(0xb7);

async function ring(provider: MockNetworkProvider, categoryId: string): Promise<Utxo[]> {
  return provider.getUtxosForLockingBytecode(blockhashOracleLockingBytecode(hexToBin(categoryId)));
}

const fieldsOf = (utxo: Utxo): BlockhashSlotFields | undefined => (
  decodeBlockhashSlotCommitment(hexToBin(utxo.token!.nft!.commitment))
);

describe('SDK genesis blockhash ring owner', () => {
  it('names blockhashKeeperPublicKey as the slot owner, and that keeper writes the ring', async () => {
    const provider = new MockNetworkProvider();
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
    // A reader of any n gets the whole 256-slot ring, every slot naming the key.
    const deployed = await StatefulContract.deploy(compileString(SOURCE), [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
      blockhashKeeperPublicKey: alicePub,
    });
    const owners = (await ring(provider, deployed.categoryId)).map((utxo) => binToHex(fieldsOf(utxo)!.ownerPkh));
    expect(owners).toHaveLength(256);
    expect(new Set(owners)).toEqual(new Set([binToHex(hash160(alicePub))]));
    const updater = (keeperKey: Uint8Array): BlockOracleUpdater => new BlockOracleUpdater({
      contract: deployed.contract.inner, categoryId: deployed.categoryId, keeperKey,
      rpc: { request: async (): Promise<never> => { throw new Error('unused'); } },
    });
    const n = BigInt(await provider.getBlockHeight()) - 1n;
    // The provider's own block oracle key owns no slot of this ring. Alice's change pays her update's fee.
    await expect(updater(provider.blockOracleOwnerKey).writeBlockhashSlot(n, HASH))
      .rejects.toThrow(/no blockhash slot/);
    expect(await updater(alicePriv).writeBlockhashSlot(n, HASH)).toMatch(/^[0-9a-f]{64}$/);
    await expect(deployed.contract.call.check(n, HASH).send()).resolves.toHaveProperty('txid');
  }, 120_000);

  it('mints the ring in a framed genesis', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await fundShippedFacets(provider);
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 5_000_000n }));
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract FramedReader {
        function check(bytes32 expected) external view { require(blockhash(block.number - 3) == expected); }
      }`, { evmCompat: true, composition: 'framed' });
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
      blockhashKeeperPublicKey: alicePub, blockhashDepth: 3,
    });
    const slots = await ring(provider, deployed.categoryId);
    expect(slots.map((utxo) => fieldsOf(utxo)!.n).sort()).toEqual([0n, 1n, 2n]);
    for (const utxo of slots) {
      expect(utxo).toMatchObject({
        satoshis: 1_200n, token: { category: deployed.categoryId, amount: 0n, nft: { capability: 'mutable' } },
      });
      expect(fieldsOf(utxo)).toMatchObject({ hash: new Uint8Array(32), ownerPkh: hash160(alicePub), depth: 3 });
    }
  }, 120_000);
});
