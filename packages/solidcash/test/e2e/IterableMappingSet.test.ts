import { describe, it } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, { sortedMappingsAll: false, ...o } as any);
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// The full Solidity-shaped IterableMapping set(): an if/else whose else arm creates several mapping entries and
// pushes the key onto a chunk-backed array. IfConvertConditionalEntryOp hoists the condition and predicates each
// scalar target across both arms (values written in both; inserted/indexOf preserve-or-set); the key push stays
// a conditional local op (CacheDynamicArrayInLoop). All entry writes become unconditional (stable output count),
// and the derivation maps each commitment to its slot by output index (writes happen out of slot order here).
const SET = `pragma solidcash >=0.8.0;
contract C() {
  address[] keys;
  mapping(address => uint256) values;
  mapping(address => uint256) indexOf;
  mapping(address => bool) inserted;
  function set(address key, uint256 val, pubkey pk, sig s) {
    require(checkSig(s, pk));
    if (this.inserted[key]) {
      this.values[key] = val;
    } else {
      this.inserted[key] = true;
      this.values[key] = val;
      this.indexOf[key] = this.keys.length;
      this.keys.push(key);
    }
  }
  function size(int n) { require(this.keys.length == n); }
  function keyAt(int i, address e) { require(this.keys[i] == e); }
  function valOf(address k, uint256 ev) { require(this.values[k] == ev); }
  function idxOf(address k, uint256 ei) { require(this.indexOf[k] == ei); }
}`;

describe('IterableMapping set() - if/else, multi-entry create + key push', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const a1 = hexToBin(`aa20${'11'.repeat(32)}87`);
  const a2 = hexToBin(`aa20${'22'.repeat(32)}87`);
  const a3 = hexToBin(`aa20${'33'.repeat(32)}87`);

  it('tracks each new key once (value + index + inserted + keys[]) and updates existing without re-tracking', async () => {
    const artifact = compileString(SET, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { keys: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.set(a1, 100n, alicePub, sig()).send();       // new key -> else arm
    await sc.size(1n).send();
    await sc.keyAt(0n, a1).send();
    await sc.valOf(a1, 100n).send();
    await sc.idxOf(a1, 0n).send();

    await sc.set(a2, 200n, alicePub, sig()).send();       // second new key
    await sc.size(2n).send();
    await sc.keyAt(1n, a2).send();
    await sc.idxOf(a2, 1n).send();

    await sc.set(a1, 150n, alicePub, sig()).send();       // existing key -> if arm: value only
    await sc.size(2n).send();
    await sc.valOf(a1, 150n).send();
    await sc.idxOf(a1, 0n).send();                          // index unchanged

    await sc.set(a3, 300n, alicePub, sig()).send();       // third new key
    await sc.size(3n).send();
    await sc.valOf(a3, 300n).send();
    await sc.valOf(a2, 200n).send();                       // untouched keys preserved
  });
});
