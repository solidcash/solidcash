import { describe, it, expect } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { keccakComputeLockingBytecodeShifted } from '@solidcash/utils';

/**
 * Fail-closed edge (a), REVERSED source order: the sorted-insert mapping loop precedes the dynamic keccak loop.
 * The mapping loop's bracketing predecessors occupy the front of the shared trailing band, so the keccak
 * side-cars must start after them; the SDK probe co-spends the predecessors ahead of the side-cars.
 */
const SOURCE = `
contract C {
    mapping(int => int) values;
    bytes32 acc;

    function f(bytes32 seed, int rounds, int[] keys) public {
        for (int j = 0; j < keys.length; j++) { this.values[keys[j]] = 1; }
        bytes32 h = seed;
        for (int i = 0; i < rounds; i++) { h = keccak256(h); }
        this.acc = h;
    }

    function check(bytes32 expected) public view {
        require(this.acc == expected);
    }
}`;

const KC = 'dd'.repeat(32);

describe('keccak loop beside a sorted-insert mapping loop (reversed source order)', () => {
  it('settles with the correct digest when the mapping loop precedes the keccak loop', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { forceStateful: true, suppressWarnings: true });
    const entry = artifact.abi.find((fn) => fn.name === 'f');
    expect(entry?.keccakLoopReads).toBe(true);
    expect(entry?.keccakLoopPrecedesTrailingUser).toBeUndefined();
    const contract = new Contract(artifact, [], { provider });
    const seed = hexToBin('56'.repeat(32));
    const rounds = 3;
    let target = seed;
    for (let i = 0; i < rounds; i++) target = keccak_256(target);
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, { acc: seed }, {
      saltContract: true,
    });
    const scLock = binToHex(keccakComputeLockingBytecodeShifted(hexToBin(categoryId).slice().reverse()));
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
