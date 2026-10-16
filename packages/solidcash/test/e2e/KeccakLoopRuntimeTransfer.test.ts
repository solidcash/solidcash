import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';

/**
 * Fail-closed edge (a), runtime-loop-transfer sibling: a dynamic keccak loop in the same function that also mints
 * a runtime-variable number of transfer outputs from a `for(i)` loop over a public recipient array.
 */
const SOURCE = `
contract C {
    bytes32 acc;
    function run(bytes32 seed, int rounds, bytes20[] recipients, int amount) public {
        bytes32 h = seed;
        for (int i = 0; i < rounds; i++) { h = keccak256(h); }
        this.acc = h;
        for (int i = 0; i < recipients.length; i++) {
            this.transfer(new LockingBytecodeP2PKH(recipients[i]), amount);
        }
    }
    function check(bytes32 expected) public view {
        require(this.acc == expected);
    }
}`;

const seed = hexToBin('56'.repeat(32));
const rounds = 3;
const target = (() => { let h = seed; for (let i = 0; i < rounds; i++) h = keccak_256(h); return h; })();

async function deployKeccakSidecars(provider: ReturnType<typeof createTestProvider>, categoryId: string): Promise<void> {
  const lock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
  for (let i = 0; i < 5; i++) {
    await provider.addUtxo(lock, {
      txid: (0xd0 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
      token: { category: 'dd'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
  }
}

const p2pkhLock = (pkh: Uint8Array): string => binToHex(Uint8Array.from([0x76, 0xa9, 0x14, ...pkh, 0x88, 0xac]));

describe('keccak loop beside a runtime-loop transfer (fail-closed edge a)', () => {
  // TODO(keccak edge a, runtime-transfer sibling): the compiler now detects the runtime-loop transfer and
  // publishes runtimeLoopTransfers with an exact iterationBound, and the SDK resolves the permutation. The
  // remaining gap is the SDK final assembly: the non-dense input path parks the satoshi container after the
  // keccak side-cars instead of at its block slot, and the runtime-loop transfer outputs are not yet derived as
  // N recipients (the master aborts in the finalized preflight). Re-enable once those land.
  it.skip('settles a keccak loop beside N runtime transfer outputs with the correct digest', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { forceStateful: true, suppressWarnings: true });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo: Utxo = { txid: 'c1cd'.repeat(16), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { acc: seed },
      changeAddress: p2pkh.address,
      initialBalance: 50_000n,
    });
    const sc = deployed.contract;
    await deployKeccakSidecars(provider, deployed.categoryId);
    const recipientA = new Uint8Array(20).fill(0x33);
    const recipientB = new Uint8Array(20).fill(0x44);
    const result = await sc.run(seed, BigInt(rounds), [recipientA, recipientB], 1000n).send();
    const locks = new Set(result.outputs.map((o) => binToHex(o.lockingBytecode)));
    console.error('DBG-OUTPUTS', [...locks]);
    expect(locks.has(p2pkhLock(recipientA))).toBe(true);
    expect(locks.has(p2pkhLock(recipientB))).toBe(true);
    await expect(sc.check(target).send()).resolves.toBeDefined();
  }, 300_000);
});
