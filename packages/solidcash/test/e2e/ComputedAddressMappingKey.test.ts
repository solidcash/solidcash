import { describe, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

const provider = createTestProvider();
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const a1 = hexToBin(`aa20${'11'.repeat(32)}87`);
const a2 = hexToBin(`aa20${'22'.repeat(32)}87`);

async function run(src: string, init: Record<string, any>): Promise<StatefulContract> {
  const art = compileString(src, { chunkedArrays: true });
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, init, { saltContract: true });
  return StatefulContract.withCategory(contract, categoryId);
}

// A mapping written with a COMPUTED address key read from a chunk array (m[keys[last]] = v). The key is an
// expression (not a param); the SDK seeds an empty-Uint8Array placeholder for the address and the VM probe
// fills the real key from the trace.
const CK = `pragma solidcash >=0.8.0;
contract C() {
  address[] keys;
  mapping(address => uint256) m;
  function seed(address k, pubkey pk, sig s) { require(checkSig(s, pk)); this.keys.push(k); }
  function tagLast(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    address last = this.keys[this.keys.length - 1];
    this.m[last] = v;
  }
  function valOf(address k, uint256 ev) { require(this.m[k] == ev); }
}`;

describe('computed address mapping key from array read', () => {
  it('writes m[keys[last]] with the resolved address', async () => {
    const sc = await run(CK, { keys: [] });
    await sc.seed(a1, alicePub, sig()).send();
    await sc.seed(a2, alicePub, sig()).send();      // keys = [a1, a2]
    await sc.tagLast(77n, alicePub, sig()).send();   // m[a2] = 77 (a2 is last)
    await sc.valOf(a2, 77n).send();
    await sc.valOf(a1, 0n).send();
  });
});
