/**
 * A2, A12: a C whose live function reads block data, compiled with `deployer: true`, is created through Deploy<C>.
 * Its oracle pool is minted first in transactions of its own, and its category is the contract argument
 * `__oraclePool` in A, so the master lock commits to it; a later call reads the pool's block fields.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Signer } from '../../src/index.js';
import { StatefulContract, getContractFactory } from '../../src/stateful/index.js';
import { verifyBirth } from '../../src/stateful/deployer.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { selectPoolInfoCoin } from '../../src/oracle/pool/index.js';
import { randomUtxo } from '../../src/utils.js';
import { alicePriv } from '../fixture/vars.js';

const CLOCK = `
contract PoolClock() {
    int reads;
    function check(int eTimestamp, int eNumber) {
        require(block.timestamp == eTimestamp);
        require(block.number == eNumber);
        this.reads = this.reads + 1;
    }
}`;

describe('A2: a block reader through Deploy<C>', () => {
  it('binds a new pool in A, is born through its deployer, and a later call reads the pool', async () => {
    const provider = new MockNetworkProvider();
    const signer = new Signer(alicePriv, provider);
    for (let coin = 0; coin < 6; coin += 1) {
      await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 1_000_000n }));
    }
    const artifact = compileString(CLOCK, { deployer: true });
    expect(artifact.deployer?.readsBlockData).toBe(true);
    const sc = await getContractFactory(artifact, signer).deploy({ oraclePool: 'new' }) as unknown as StatefulContract;
    const pool = sc.inner.oraclePool!;
    expect(pool).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyBirth(provider, sc.categoryId, [artifact.deployer!])).toBe(true);
    const { fields } = (await selectPoolInfoCoin(provider, pool))!;
    await (sc as unknown as { check(t: bigint, n: bigint): Promise<unknown> }).check(fields.timestamp, fields.number);
    expect(((await sc.getState()) as { reads?: bigint }).reads).toBe(1n);
  }, 300_000);
});
