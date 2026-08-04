import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// A whole dynamic-array copy with a differing element type `d2 = d1` (bytes8[] -> bytes10[]) desugars to
// `delete d2; for (i) d2.push(bytes10(d1[i]));`. VM-verify the round-trip: populate d1, copy to d2 (widening
// each element right-padded with zeros), read d2 back and check the widened values.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  bytes8[] d1;
  bytes10[] d2;
  function setD1(bytes8 x, bytes8 y, pubkey pk, sig s) { require(checkSig(s, pk)); this.d1 = [x, y]; }
  function copy(pubkey pk, sig s) { require(checkSig(s, pk)); d2 = d1; }
}`;

describe('dynamic array copy with per-element bytes widening (bytes10[] = bytes8[]) - VM', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('copies bytes8[] into bytes10[], each element widened (right-padded)', async () => {
    const artifact = compileString(SRC, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { d1: [], d2: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    const x = hexToBin('0102030405060708');
    const y = hexToBin('1112131415161718');
    await sc.setD1(x, y, alicePub, sig()).send();
    await sc.copy(alicePub, sig()).send();

    // bytes8 -> bytes10 widens by right-padding two zero bytes.
    expect((await sc.getState()).d2).toEqual([
      hexToBin('01020304050607080000'),
      hexToBin('11121314151617180000'),
    ]);
  });
});
