import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// A SINGLE-method callee: its dispatcher is elided, so its co-spend unlocking has NO 4-byte selector prefix. The
// fn-ptr covenant now verifies the runtime selector only when the unlocking begins with a 0x04 push, so a
// single-method callee is co-spent + verified by identity alone (the wrong method can never be co-spent - a
// multi-method callee always carries the 0x04 selector prefix).
const HANDLER = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(pubkey o, sig s); }
contract Handler() is IH { bigint counter;
  function inc(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter + 1; } }`;

const CALLER = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(pubkey o, sig s); }
contract Caller() {
  bigint bumps;
  function relay(function(pubkey, sig) external y, pubkey pk, sig s) {
    require(checkSig(s, pk)); y(pk, s); this.bumps = this.bumps + 1;
  }
}`;

describe('foreign fn-ptr call to a SINGLE-method callee (selector elision)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('co-spends + calls a single-method callee through a fn-ptr param', async () => {
    const ha = compileString(HANDLER); const ca = compileString(CALLER);
    const inc = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);

    const handler = new Contract(ha, [], { provider });
    const { categoryId: hc } = await setupStatefulUtxos(
      provider, handler, ha.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const hAddr = handler.withCategory(hexToBin(hc)).lockingBytecode;

    const caller = new Contract(ca, [], { provider });
    const { categoryId: cc } = await setupStatefulUtxos(
      provider, caller, ca.stateLayout!, { bumps: 0n }, { saltContract: true },
    );
    const cSc = StatefulContract.withCategory(caller, cc);
    const hSc = StatefulContract.withCategory(handler, hc);

    const tx = await cSc.relay(hexToBin(hAddr), inc, alicePub, sig())
      .withExternalCall(hSc, 'inc', [alicePub, sig()]).send();
    expect(tx.txid).toBeDefined();
    expect((await cSc.getState()).bumps).toBe(1n);
    expect((await hSc.getState()).counter).toBe(6n);
  });
});
