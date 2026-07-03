import { describe, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// The Solidity IterableMapping remove(): early-return guard, delete the entry's mappings, then swap-remove from
// the key array - `indexOf[lastKey] = index` updates the moved key's index via a COMPUTED key (lastKey =
// keys[keys.length-1]). The SDK resolves that `arr[arr.length-1]` key from on-chain state (keySource
// 'stateArrayLast') so it co-spends and UPDATES the existing indexOf[lastKey] entry instead of creating a
// duplicate. Verifies keys[], values, and the updated indexOf after removes.
const IM = `pragma solidcash >=0.8.0;
contract C() {
  address[] keys;
  mapping(address => uint256) values;
  mapping(address => uint256) indexOf;
  mapping(address => bool) inserted;
  function set(address key, uint256 val, pubkey pk, sig s) {
    require(checkSig(s, pk));
    if (this.inserted[key]) { this.values[key] = val; }
    else { this.inserted[key] = true; this.values[key] = val; this.indexOf[key] = this.keys.length; this.keys.push(key); }
  }
  function remove(address key, pubkey pk, sig s) {
    require(checkSig(s, pk));
    if (!this.inserted[key]) { return; }
    delete this.inserted[key];
    delete this.values[key];
    uint256 index = this.indexOf[key];
    address lastKey = this.keys[this.keys.length - 1];
    this.indexOf[lastKey] = index;
    delete this.indexOf[key];
    this.keys[index] = lastKey;
    this.keys.pop();
  }
  function size(int n) { require(this.keys.length == n); }
  function keyAt(int i, address e) { require(this.keys[i] == e); }
  function valOf(address k, uint256 ev) { require(this.values[k] == ev); }
  function idxOf(address k, uint256 ei) { require(this.indexOf[k] == ei); }
}`;

describe('IterableMapping remove() - swap-remove with computed-key index update', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const a1 = hexToBin(`aa20${'11'.repeat(32)}87`);
  const a2 = hexToBin(`aa20${'22'.repeat(32)}87`);
  const a3 = hexToBin(`aa20${'33'.repeat(32)}87`);

  async function seed3(): Promise<StatefulContract> {
    const artifact = compileString(IM, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { keys: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.set(a1, 100n, alicePub, sig()).send();
    await sc.set(a2, 200n, alicePub, sig()).send();
    await sc.set(a3, 300n, alicePub, sig()).send();
    return sc;
  }

  it('remove a middle key: last swaps in, its index is updated (no stale duplicate)', async () => {
    const sc = await seed3();                              // keys=[a1,a2,a3], indexOf a3=2
    await sc.remove(a1, alicePub, sig()).send();           // swap a3 into slot 0, pop -> [a3,a2]
    await sc.size(2n).send();
    await sc.keyAt(0n, a3).send();
    await sc.keyAt(1n, a2).send();
    await sc.idxOf(a3, 0n).send();                          // a3's index UPDATED to 0 (was 2)
    await sc.idxOf(a2, 1n).send();                          // a2 unchanged
    await sc.valOf(a1, 0n).send();                          // a1 cleared
    await sc.valOf(a2, 200n).send();
    await sc.valOf(a3, 300n).send();
  });

  it('remove the LAST key (key == lastKey): the write aliases the delete, gated off; just pop', async () => {
    const sc = await seed3();                              // keys=[a1,a2,a3]
    await sc.remove(a3, alicePub, sig()).send();           // a3 is last -> no swap, pop -> [a1,a2]
    await sc.size(2n).send();
    await sc.keyAt(0n, a1).send();
    await sc.keyAt(1n, a2).send();
    await sc.valOf(a3, 0n).send();                          // a3 deleted
    await sc.idxOf(a1, 0n).send();                          // untouched keys keep their indices
    await sc.idxOf(a2, 1n).send();
  });

  it('remove then re-add gets a fresh index', async () => {
    const sc = await seed3();
    await sc.remove(a1, alicePub, sig()).send();           // [a3,a2]
    await sc.set(a1, 500n, alicePub, sig()).send();        // re-add -> [a3,a2,a1]
    await sc.size(3n).send();
    await sc.valOf(a1, 500n).send();
    await sc.idxOf(a1, 2n).send();
  });

  it('remove all keys one by one (mixes middle and last removes)', async () => {
    const sc = await seed3();                              // keys=[a1,a2,a3]
    await sc.remove(a2, alicePub, sig()).send();           // middle: swap a3->1 -> [a1,a3]
    await sc.size(2n).send();
    await sc.remove(a3, alicePub, sig()).send();           // last -> [a1]
    await sc.size(1n).send();
    await sc.keyAt(0n, a1).send();
    await sc.remove(a1, alicePub, sig()).send();           // last -> []
    await sc.size(0n).send();
    await sc.valOf(a1, 0n).send();
  });

  it('remove a non-existent key is a safe no-op (early return preserves state)', async () => {
    const artifact = compileString(IM, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { keys: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.set(a1, 100n, alicePub, sig()).send();        // keys=[a1]
    await sc.remove(a2, alicePub, sig()).send();           // a2 not inserted -> guard returns, no-op
    await sc.size(1n).send();                               // unchanged
    await sc.keyAt(0n, a1).send();
    await sc.valOf(a1, 100n).send();                        // preserved
    await sc.idxOf(a1, 0n).send();
  });
});
