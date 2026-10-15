import { describe, it, expect } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { keccakComputeLockingBytecode } from '@solidcash/utils';

/**
 * Fail-closed edge (a): a dynamic keccak loop in the SAME function that also runs a sorted-insert mapping loop.
 * Both families share the trailing band [blockSize, ..); the compiler now assigns disjoint counter bands via the
 * runtime-loop input/output cursors, so the keccak loop preceding the mapping loop settles with the correct digest.
 */
const SOURCE = `
contract C {
    mapping(int => int) values;
    bytes32 acc;

    function f(bytes32 seed, int rounds, int[] keys) public {
        bytes32 h = seed;
        for (int i = 0; i < rounds; i++) { h = keccak256(h); }
        for (int j = 0; j < keys.length; j++) { this.values[keys[j]] = 1; }
        this.acc = h;
    }

    function check(bytes32 expected) public view {
        require(this.acc == expected);
    }
}`;

const KC = 'dd'.repeat(32);

describe('keccak loop beside a sorted-insert mapping loop (fail-closed edge a)', () => {
  it('settles with the correct digest when the keccak loop precedes the mapping loop', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { forceStateful: true, suppressWarnings: true });
    const entry = artifact.abi.find((fn) => fn.name === 'f');
    expect(entry?.keccakLoopReads).toBe(true);
    expect(entry?.keccakLoopPrecedesTrailingUser).toBe(true);
    const contract = new Contract(artifact, [], { provider });
    const seed = hexToBin('56'.repeat(32));
    const rounds = 3;
    let target = seed;
    for (let i = 0; i < rounds; i++) target = keccak_256(target);
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, { acc: seed }, {
      saltContract: true,
    });
    const scLock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
    for (let i = 0; i < 5; i++) {
      await provider.addUtxo(scLock, {
        txid: (0xd0 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: KC, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const sc = StatefulContract.withCategory(contract, categoryId);
    await (sc as any).f(seed, BigInt(rounds), [1n, 2n]).send();
    await expect((sc as any).check(target).send()).resolves.toBeDefined();
  }, 300_000);
});
