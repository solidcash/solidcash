import { describe, it } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, { sortedMappingsAll: false, ...o } as any);
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// The IterableMapping (enumerable mapping) core: a value mapping plus a chunk-backed key-tracking array,
// mutated together in one function. Exercises entry-write + chunk-array-op coexistence (shared trailing
// input/output layout) and the first push onto an initially-empty variable-width array.
describe('IterableMapping pattern: value mapping + key-tracking array coexist', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const a1 = hexToBin(`aa20${'11'.repeat(32)}87`);
  const a2 = hexToBin(`aa20${'22'.repeat(32)}87`);
  const a3 = hexToBin(`aa20${'33'.repeat(32)}87`);

  it('unconditional: each set() pushes the key and stores the value', async () => {
    const src = `pragma solidcash >=0.8.0;
contract C() {
  mapping(address => uint256) values;
  address[] keys;
  function set(address k, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.keys.push(k);
    this.values[k] = v;
  }
  function count(int n) { require(this.keys.length == n); }
  function keyAt(int i, address e) { require(this.keys[i] == e); }
  function valOf(address k, uint256 ev) { require(this.values[k] == ev); }
}`;
    const artifact = compileString(src, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { keys: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.set(a1, 100n, alicePub, sig()).send();
    await sc.count(1n).send();
    await sc.keyAt(0n, a1).send();
    await sc.valOf(a1, 100n).send();

    await sc.set(a2, 200n, alicePub, sig()).send();
    await sc.count(2n).send();
    await sc.keyAt(1n, a2).send();
    await sc.valOf(a2, 200n).send();
    await sc.valOf(a1, 100n).send();
  });

  it('conditional (real set): tracks each new key once, updates existing without re-tracking', async () => {
    const src = `pragma solidcash >=0.8.0;
contract C() {
  mapping(address => uint256) values;
  address[] keys;
  function set(address k, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    if (this.values[k] == 0) { this.keys.push(k); }
    this.values[k] = v;
  }
  function count(int n) { require(this.keys.length == n); }
  function valOf(address k, uint256 ev) { require(this.values[k] == ev); }
}`;
    const artifact = compileString(src, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { keys: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.set(a1, 100n, alicePub, sig()).send();     // new key -> push
    await sc.count(1n).send();
    await sc.valOf(a1, 100n).send();

    await sc.set(a2, 200n, alicePub, sig()).send();     // new key -> push
    await sc.count(2n).send();
    await sc.valOf(a2, 200n).send();

    await sc.set(a1, 150n, alicePub, sig()).send();     // existing key -> no push, value updated
    await sc.count(2n).send();
    await sc.valOf(a1, 150n).send();

    await sc.set(a3, 300n, alicePub, sig()).send();     // another new key -> push
    await sc.count(3n).send();
    await sc.valOf(a3, 300n).send();
    await sc.valOf(a2, 200n).send();
  });
});
