import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract, SignatureTemplate, FunctionArgument,
} from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// Two unrelated callee types. The caller knows nothing about either at compile time.
const ECHO = `pragma solidcash >=0.8.0;
contract Echo() {
  bigint stored;
  function setAndReturn(bigint v, pubkey pk, sig s) returns (bigint) {
    require(checkSig(s, pk));
    this.stored = v;
    return v;
  }
}`;

const ADDER = `pragma solidcash >=0.8.0;
contract Adder() {
  bigint last;
  function add(bigint a, bigint b, pubkey pk, sig s) returns (bigint) {
    require(checkSig(s, pk));
    this.last = a + b;
    return a + b;
  }
}`;

// Caller: generic dynamic dispatch. addr is caller-supplied; the return is read as opaque bytes, used in a
// covenant decision (the require), then a fixed-size derivation of it is committed to state.
const CALLER = `pragma solidcash >=0.8.0;
contract Caller() {
  bytes32 digest;
  function go(address t, bytes sel, bytes args, pubkey pk, sig s) {
    require(checkSig(s, pk));
    bytes result = t.rawCall(sel, args);
    require(result.length > 0);
    this.digest = sha256(result);
  }
}`;

describe('rawCall generic dynamic dispatch', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  const echoArt = compileString(ECHO);
  const adderArt = compileString(ADDER);
  const callerArt = compileString(CALLER);

  async function genCallee(
    art: typeof echoArt, init: Record<string, unknown>,
  ): Promise<{ sc: StatefulContract; addr: Uint8Array }> {
    const c = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, c, art.stateLayout!, init, { saltContract: true });
    return {
      sc: StatefulContract.withCategory(c, categoryId),
      addr: hexToBin(c.withCategory(hexToBin(categoryId)).lockingBytecode),
    };
  }

  async function genCaller(): Promise<{ sc: StatefulContract; addr: Uint8Array }> {
    const c = new Contract(callerArt, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, c, callerArt.stateLayout!, { digest: new Uint8Array(32) }, { saltContract: true },
    );
    return {
      sc: StatefulContract.withCategory(c, categoryId),
      addr: hexToBin(c.withCategory(hexToBin(categoryId)).lockingBytecode),
    };
  }

  // Run the caller's rawCall against a co-spent callee and return the caller's resulting digest.
  async function rawCall(
    caller: StatefulContract, target: Uint8Array, callee: StatefulContract, fn: string, args: FunctionArgument[],
  ): Promise<Uint8Array> {
    const sel = new Uint8Array(4); // selector is not enforced on-chain in the MVP
    const tx = await caller.go(target, sel, new Uint8Array(), alicePub, sig())
      .withExternalCall(callee, fn, args)
      .send();
    expect(tx.txid).toBeDefined();
    return (await caller.getState()).digest as Uint8Array;
  }

  it('reads an integrity-bound opaque return from a generic callee', async () => {
    const echo = await genCallee(echoArt, { stored: 0n });
    const caller = await genCaller();

    const digest = await rawCall(caller.sc, echo.addr, echo.sc, 'setAndReturn', [42n, alicePub, sig()]);

    expect((await echo.sc.getState()).stored).toBe(42n);
    expect(digest.some((b) => b !== 0)).toBe(true);
  });

  it('dispatches the same caller generically to an unrelated callee type', async () => {
    const adder = await genCallee(adderArt, { last: 0n });
    const caller = await genCaller();

    const digest = await rawCall(caller.sc, adder.addr, adder.sc, 'add', [3n, 4n, alicePub, sig()]);

    // The same Caller.go reached a different contract+function with its own args.
    expect((await adder.sc.getState()).last).toBe(7n);
    expect(digest.some((b) => b !== 0)).toBe(true);
  });

  it('rejects a wrong target address (co-spent callee is not the claimed addr)', async () => {
    const echo = await genCallee(echoArt, { stored: 0n });
    const caller = await genCaller();

    // Claim the caller's own address as the target while actually co-spending echo: identity check fails.
    await expect(
      caller.sc.go(caller.addr, new Uint8Array(4), new Uint8Array(), alicePub, sig())
        .withExternalCall(echo.sc, 'setAndReturn', [42n, alicePub, sig()])
        .send(),
    ).rejects.toThrow();
  });
});
