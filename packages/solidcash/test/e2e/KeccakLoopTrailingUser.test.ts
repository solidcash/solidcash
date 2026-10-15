import { describe, it, expect } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { keccakComputeLockingBytecode } from '@solidcash/utils';

/**
 * Fail-closed edge (a): a dynamic keccak loop in the SAME function that also runs a sorted-insert mapping loop.
 * Both families index the trailing band [blockSize, ..) from counter 0, so a direct (non-route) function has no
 * disjoint-band allocator yet. The covenant must still fail closed (never settle a wrong digest): the keccak
 * side-car preimage bind and the sorted-insert predecessor bytecode check collide and abort the master.
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
  it('fails closed rather than settling a wrong digest', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { forceStateful: true, suppressWarnings: true });
    expect(artifact.abi.find((fn) => fn.name === 'f')?.keccakLoopReads).toBe(true);
    const contract = new Contract(artifact, [], { provider });
    const seed = hexToBin('56'.repeat(32));
    const rounds = 3;
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
    // The two counter-indexed trailing families collide; the master covenant aborts (never a wrong digest).
    await expect((sc as any).f(seed, BigInt(rounds), [1n, 2n]).send())
      .rejects.toThrow(/messageBus|OP_VERIFY/);
  }, 300_000);
});
