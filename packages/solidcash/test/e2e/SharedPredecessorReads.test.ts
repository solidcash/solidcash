import { hexToBin } from '@bitauth/libauth';
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../src/stateful/SortedList.js';
import { fundedSigner } from '../test-util.js';

// Two slots of one sorted mapping in a direct call may need the same entry UTXO: two absent keys proven by one
// predecessor, or an absent key whose predecessor is the other slot's entry. One input must serve both slots.
const SRC = `pragma solidity ^0.8.20;
contract Gate {
  mapping(address => bool) blocked;
  uint256 count;
  function bothClear(address a, address b) public { require(!blocked[a] && !blocked[b]); count += 1; }
  function clearAndBlock(address a, address b) public { require(!blocked[a]); blocked[b] = true; count += 1; }
  function setAndClear(address a, address b) public { require(blocked[a] && !blocked[b]); count += 1; }
}`;

interface Call { send: () => Promise<unknown> }
type Handle = Record<'bothClear' | 'clearAndBlock' | 'setAndClear', (a: Uint8Array, b: Uint8Array) => Call> & {
  state: { count: () => Promise<bigint> };
  getEntries: (name: string) => Promise<{ value: unknown }[]>;
};

describe('direct calls whose sorted reads share one predecessor proof', () => {
  it('spend absent reads, an absent read beside an insert, and a present plus absent read', async () => {
    const artifact = compileString(SRC, { evmCompat: true, forceStateful: true });
    const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'blocked')!;
    const slot = (key: Uint8Array): bigint => bytesToSlotValue(keyToSlotMulti([key], collection));
    // k0 < k1 < k2 < k3 in slot order.
    const [k0, k1, k2, k3] = ['11', '22', '33', '44', '55', '66']
      .map((byte) => hexToBin(`76a914${byte.repeat(20)}88ac`))
      .sort((left, right) => (slot(left) < slot(right) ? -1 : 1));
    const sc = await getContractFactory(artifact, await fundedSigner(16)).deploy() as unknown as Handle;

    // Empty map: the head proves both absences.
    await sc.bothClear(k0, k3).send();
    // Empty map: the head proves the absent read and is the insert's predecessor.
    await sc.clearAndBlock(k2, k1).send();
    expect((await sc.getEntries('blocked')).map((entry) => entry.value)).toEqual([true]);
    // {k1}: k1's entry is the present read and proves k2 absent.
    await sc.setAndClear(k1, k2).send();
    // {k1}: k1's entry proves both absences; k0 and k3 use distinct proofs.
    await sc.bothClear(k2, k3).send();
    await sc.bothClear(k0, k3).send();
    expect(await sc.state.count()).toBe(5n);

    // The shared input does not turn a present key into an absent one.
    await expect(sc.bothClear(k3, k1).send()).rejects.toThrow();
    await expect(sc.bothClear(k1, k2).send()).rejects.toThrow();
    await expect(sc.clearAndBlock(k1, k2).send()).rejects.toThrow();
    await expect(sc.setAndClear(k2, k3).send()).rejects.toThrow();
    expect(await sc.state.count()).toBe(5n);
  });
});
