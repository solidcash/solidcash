import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

/**
 * Audit CRYPTO-5 (docs/security-audit-2026-10/CRYPTO.md): the oracle owner must not rewind block.number or
 * block.timestamp to replay an old window. The updater requires each value to be >= its current register.
 */

const OWNED_ORACLE = `
contract BlockOracleOwned() {
    function readBack(int eNumber, int eTimestamp) {
        require(block.number == eNumber);
        require(block.timestamp == eTimestamp);
    }
}`;

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';
const T0 = 1_700_000_000n;
const TXID = /^[0-9a-f]{64}$/;

interface Owned { provider: ReturnType<typeof createTestProvider>; handle: () => any; n0: bigint }

// Registers start one below the tip, so a rewound height is still final and passes tx.time >= number.
async function deployOwned(): Promise<Owned> {
  const provider = createTestProvider();
  const artifact = compileString(OWNED_ORACLE);
  const contract = new Contract(artifact, [], { provider });
  const n0 = BigInt(await provider.getBlockHeight()) - 1n;
  const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {
    __block_number: n0, __block_timestamp: T0, __blockOracleOwner: alicePub,
  }, { saltContract: true });
  return { provider, handle: () => StatefulContract.withCategory(contract, categoryId), n0 };
}

function update(o: Owned, n: bigint, t: bigint): Promise<{ txid: string }> {
  return o.handle().__updateBlockOracle(new SignatureTemplate(alicePriv), n, t)
    .setState({ __block_number: n, __block_timestamp: t })
    .setLocktime(Number(n))
    .send();
}

describe('CRYPTO-5: the block oracle owner cannot rewind number or timestamp', () => {
  it('refuses a rewound number and a rewound timestamp, leaving both registers', async () => {
    const o = await deployOwned();
    await expect(update(o, o.n0 - 1n, T0)).rejects.toThrow(verifyFailure);
    await expect(update(o, o.n0, T0 - 1n)).rejects.toThrow(verifyFailure);
    expect((await o.handle().readBack(o.n0, T0).send()).txid).toMatch(TXID);
  });

  it('accepts an equal and then a higher number and timestamp', async () => {
    const o = await deployOwned();
    expect((await update(o, o.n0, T0)).txid).toMatch(TXID);
    const tip = BigInt(await o.provider.getBlockHeight());
    expect(tip).toBeGreaterThan(o.n0);
    expect((await update(o, tip, T0 + 600n)).txid).toMatch(TXID);
    expect((await o.handle().readBack(tip, T0 + 600n).send()).txid).toMatch(TXID);
  });
});
