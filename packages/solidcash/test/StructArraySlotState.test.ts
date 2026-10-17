import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract } from '../src/index.js';
import { StatefulContract } from '../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

/**
 * Stateful round-trips for EVM sub-slot access on a TOP-LEVEL fixed array of structs. `sstore(ps.slot, word)` /
 * `sstore(add(ps.slot, 1), word)` decompose the word into the packed uint64 fields of ps[0] / ps[1] and re-store
 * the whole fixed-array value through the normal framed struct-array path, so `getState()` reads the exact
 * element fields back. This proves the SDK derives the `P[2] ps` state layout the assembly covenant stores.
 */
const SOURCE = `contract StructArraySlotBox {
  struct P { uint64 a; uint64 b; }
  P[2] ps;

  function setSlot0(uint256 word) public {
    assembly { sstore(ps.slot, word) }
  }

  function setSlot1(uint256 word) public {
    assembly { sstore(add(ps.slot, 1), word) }
  }

  function checkSlot0(uint256 word) public returns (uint256 r) {
    assembly { r := sload(ps.slot) }
    require(r == word);
  }
}`;

type P = { a: bigint; b: bigint };

async function setup(ps: [P, P]): Promise<StatefulContract> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { evmCompat: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { ps }, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId);
}

type Sc = StatefulContract & {
  getState: () => Promise<{ ps: [P, P] }>;
  setSlot0: (word: bigint) => { send: () => Promise<unknown> };
  setSlot1: (word: bigint) => { send: () => Promise<unknown> };
  checkSlot0: (word: bigint) => { send: () => Promise<unknown> };
};

describe('EVM sub-slot access on a top-level fixed array of structs', () => {
  it('sstore(ps.slot, word) writes ps[0] fields and getState reads them back', async () => {
    const sc = await setup([{ a: 7n, b: 0n }, { a: 1n, b: 2n }]) as unknown as Sc;
    await sc.setSlot0((5n << 64n) | 9n).send();
    expect((await sc.getState()).ps).toEqual([{ a: 9n, b: 5n }, { a: 1n, b: 2n }]);
  });

  it('sstore(add(ps.slot, 1), word) writes ps[1] and sload(ps.slot) reads ps[0] unchanged', async () => {
    const sc = await setup([{ a: 7n, b: 0n }, { a: 1n, b: 2n }]) as unknown as Sc;
    await sc.setSlot1((3n << 64n) | 4n).send();
    await sc.checkSlot0(7n).send();
    expect((await sc.getState()).ps).toEqual([{ a: 7n, b: 0n }, { a: 4n, b: 3n }]);
  });
});
