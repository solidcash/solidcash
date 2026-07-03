import { describe, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// Writing multiple entries in an order different from their slot order. The covenant verifies written entries
// in write order and skips absent read-only slots, so the derivation must map each extracted commitment to ITS
// slot by output index (not positionally, i-th commitment -> slot i) - otherwise an out-of-slot-order write
// desyncs on the first failing probe. Here f() reads `ins` (slot 0) then writes `a` (slot 1) BEFORE `ins`.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  mapping(address => uint256) a;
  mapping(address => uint256) ins;
  function f(address k, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    uint256 d = this.ins[k];   // read ins first -> ins is slot 0
    this.a[k] = v;             // write a (slot 1) first
    this.ins[k] = d + 1;       // then write ins (slot 0) - writes out of slot order
  }
  function chkA(address k, uint256 ea) { require(this.a[k] == ea); }
  function chkIns(address k, uint256 e) { require(this.ins[k] == e); }
}`;

describe('multiple entry writes out of slot order', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const k1 = hexToBin(`aa20${'11'.repeat(32)}87`);

  it('new keys: both entries created with correct values', async () => {
    const artifact = compileString(SRC, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.f(k1, 100n, alicePub, sig()).send();     // a=100, ins=1
    await sc.chkA(k1, 100n).send();
    await sc.chkIns(k1, 1n).send();

    await sc.f(k1, 200n, alicePub, sig()).send();      // a=200, ins=2
    await sc.chkA(k1, 200n).send();
    await sc.chkIns(k1, 2n).send();
  });
});
