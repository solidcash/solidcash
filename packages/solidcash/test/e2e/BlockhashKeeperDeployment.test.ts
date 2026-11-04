import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { SignatureTemplate } from '../../src/index.js';
import { selectPoolSlot } from '../../src/oracle/pool/index.js';
import { randomUtxo } from '../../src/utils.js';
import { aliceAddress, alicePriv } from '../fixture/vars.js';

const SOURCE = 'contract Reader(){ function check(int n, bytes32 expected) { require(blockhash(n) == expected); } }';

// A blockhash reader reads the ring slots of its oracle pool: its genesis binds the provider's pool and mints no
// oracle of its own.
describe('SDK genesis of a blockhash reader', () => {
  it('binds the provider pool, and the reader reads blockhash through it', async () => {
    const provider = new MockNetworkProvider();
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
    const deployed = await StatefulContract.deploy(compileString(SOURCE), [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
    });
    // The genesis holds one minting NFT of the reader's category: its master.
    const minting = (await provider.getUtxosByTokenCategory(deployed.categoryId))
      .filter((utxo) => utxo.token?.nft?.capability === 'minting');
    expect(minting).toHaveLength(1);

    const pool = deployed.contract.inner.oraclePool;
    expect(pool).toBe(provider.oraclePoolCategory);
    const n = BigInt(await provider.getBlockHeight()) - 1n;
    expect((await selectPoolSlot(provider, pool!, n))?.exact).toBe(true);
    const hash = hexToBin(await provider.getBlockHash(Number(n)));
    await expect(deployed.contract.call.check(n, hash).send()).resolves.toHaveProperty('txid');
    await expect(deployed.contract.call.check(n, new Uint8Array(32).fill(0xb7)).send()).rejects.toThrow();
  }, 120_000);
});
