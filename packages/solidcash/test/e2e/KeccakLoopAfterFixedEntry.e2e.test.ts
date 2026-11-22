/**
 * A keccak256 loop after a fixed mapping write or read in the same function. The loop's side-cars are found by a VM
 * probe of the master's run, which must reach the loop past the entry the write or read checks first: the probe
 * co-spends that entry's real coin at its slot (an insert's slot holds a funder) and plans the write's output there.
 * Each row settles on the VM as the mock chain accepts it, and a check function reads back what was stored.
 */
import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const SOURCE = `
contract C {
    mapping(int => int) values;
    bytes32 acc;
    int seen;

    function writeThenHash(int key, int value, bytes32 seed, int rounds) public {
        this.values[key] = value;
        bytes32 h = seed;
        for (int i = 0; i < rounds; i++) { h = keccak256(h); }
        this.acc = h;
    }

    function readThenHash(int key, bytes32 seed, int rounds) public {
        this.seen = this.values[key];
        bytes32 h = seed;
        for (int i = 0; i < rounds; i++) { h = keccak256(h); }
        this.acc = h;
    }

    function check(bytes32 expected, int expectedSeen) public view {
        require(this.acc == expected);
        require(this.seen == expectedSeen);
    }
}`;

const KC = 'dd'.repeat(32);

const hashed = (seed: Uint8Array, rounds: number): Uint8Array => {
  let value = seed;
  for (let round = 0; round < rounds; round++) value = keccak_256(value);
  return value;
};

async function deploy(): Promise<any> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true, suppressWarnings: true });
  for (const name of ['writeThenHash', 'readThenHash']) {
    expect(artifact.abi.find((fn) => fn.name === name)?.keccakLoopReads).toBe(true);
  }
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {
    acc: new Uint8Array(32), seen: 0n,
  }, { saltContract: true });
  const sideCarLock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
  for (let index = 0; index < 6; index++) {
    await provider.addUtxo(sideCarLock, {
      txid: (0xd0 + index).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
      token: { category: KC, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
  }
  return StatefulContract.withCategory(contract, categoryId);
}

describe('a keccak256 loop after a fixed mapping entry', () => {
  it('settles a write that inserts, then one that updates, each before the loop', async () => {
    const sc = await deploy();
    const first = hexToBin('11'.repeat(32));
    await sc.writeThenHash(7n, 41n, first, 3n).send();
    await expect(sc.check(hashed(first, 3), 0n).send()).resolves.toBeDefined();

    const second = hexToBin('22'.repeat(32));
    await sc.writeThenHash(7n, 42n, second, 2n).send();
    await expect(sc.check(hashed(second, 2), 0n).send()).resolves.toBeDefined();

    // The read row below sees the updated value.
    const third = hexToBin('33'.repeat(32));
    await sc.readThenHash(7n, third, 1n).send();
    await expect(sc.check(hashed(third, 1), 42n).send()).resolves.toBeDefined();
  }, 300_000);

  it('settles a read before the loop', async () => {
    const sc = await deploy();
    await sc.writeThenHash(5n, 9n, hexToBin('44'.repeat(32)), 1n).send();
    const seed = hexToBin('55'.repeat(32));
    await sc.readThenHash(5n, seed, 4n).send();
    await expect(sc.check(hashed(seed, 4), 9n).send()).resolves.toBeDefined();
  }, 300_000);
});
