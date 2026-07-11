import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// Two callable methods on the callee (same signature) - a foreign dispatch chooses between them at runtime.
const CALLEE = `pragma solidcash >=0.8.0;
interface IHandler { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
contract Handler() is IHandler {
  bigint counter;
  function inc(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter + 1; }
  function dec(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter - 1; }
}`;

// A FOREIGN function pointer whose ADDRESS is a state var and whose METHOD is chosen by a state var - a
// dispatch table. Compiles via the same-address varying-method (runtime selector) machinery; the covenant
// co-spends the callee at the state address and binds the co-spent method to the state discriminant.
const CALLER = `pragma solidcash >=0.8.0;
interface IHandler { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
contract Caller() {
  address handler;
  bool useInc;
  function run(pubkey pk, sig s) {
    function(pubkey, sig) external f = useInc ? IHandler(handler).inc : IHandler(handler).dec;
    f(pk, s);
  }
}`;

describe('foreign function-pointer dispatch table (state address + state-selected method)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  const run = async (useInc: boolean, method: 'inc' | 'dec', expected: bigint): Promise<void> => {
    const calleeArt = compileString(CALLEE);
    const callerArt = compileString(CALLER);

    const callee = new Contract(calleeArt, [], { provider });
    const { categoryId: calleeCat } = await setupStatefulUtxos(
      provider, callee, calleeArt.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const calleeAddr = callee.withCategory(hexToBin(calleeCat)).lockingBytecode;

    const caller = new Contract(callerArt, [], { provider });
    const { categoryId: callerCat } = await setupStatefulUtxos(
      provider, caller, callerArt.stateLayout!, { handler: hexToBin(calleeAddr), useInc }, { saltContract: true },
    );

    const callerSc = StatefulContract.withCategory(caller, callerCat);
    const calleeSc = StatefulContract.withCategory(callee, calleeCat);

    const tx = await callerSc.run(alicePub, sig())
      .withExternalCall(calleeSc, method, [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await calleeSc.getState()).counter).toBe(expected);
  };

  it('dispatches inc when the discriminant selects it (5 -> 6)', async () => {
    await run(true, 'inc', 6n);
  });

  it('dispatches dec when the discriminant selects it (5 -> 4)', async () => {
    await run(false, 'dec', 4n);
  });
});
