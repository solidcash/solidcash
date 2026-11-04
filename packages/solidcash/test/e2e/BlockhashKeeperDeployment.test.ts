import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { blockhashKeeperBatonLockingBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { SignatureTemplate } from '../../src/index.js';
import { selectPoolSlot } from '../../src/oracle/pool/index.js';
import { randomUtxo } from '../../src/utils.js';
import { aliceAddress, alicePriv, alicePub } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';

const SOURCE = 'contract Reader(){ function check(int n, bytes32 expected) { require(blockhash(n) == expected); } }';

// A blockhash reader reads the ring slots of its oracle pool, so no genesis mints the per-contract keeper baton any
// more, even when its options are passed.
describe('SDK genesis and the blockhash keeper baton', () => {
  it('mints no keeper baton, and the reader reads blockhash through its oracle pool', async () => {
    const provider = new MockNetworkProvider();
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
    const deployed = await StatefulContract.deploy(compileString(SOURCE), [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
      blockhashKeeperPublicKey: alicePub, blockhashKeeperAmount: 20_000n,
    });
    const lock = blockhashKeeperBatonLockingBytecode(hexToBin(deployed.categoryId), alicePub);
    expect(await provider.getUtxosForLockingBytecode(lock)).toEqual([]);

    const pool = deployed.contract.inner.oraclePool;
    expect(pool).toBe(provider.oraclePoolCategory);
    const n = BigInt(await provider.getBlockHeight()) - 1n;
    expect((await selectPoolSlot(provider, pool!, n))?.exact).toBe(true);
    const hash = hexToBin(await provider.getBlockHash(Number(n)));
    await expect(deployed.contract.call.check(n, hash).send()).resolves.toHaveProperty('txid');
    await expect(deployed.contract.call.check(n, new Uint8Array(32).fill(0xb7)).send()).rejects.toThrow();
  }, 120_000);

  it('mints no keeper baton in a framed genesis either', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await fundShippedFacets(provider);
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 5_000_000n }));
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract FramedReader {
        function check(uint256 n, bytes32 expected) external view { require(blockhash(n) == expected); }
      }`, { evmCompat: true, composition: 'framed' });
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
      blockhashKeeperPublicKey: alicePub, blockhashKeeperAmount: 20_000n,
    });
    const lock = blockhashKeeperBatonLockingBytecode(hexToBin(deployed.categoryId), alicePub);
    expect(await provider.getUtxosForLockingBytecode(lock)).toEqual([]);
  }, 120_000);
});
