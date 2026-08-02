import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract, SignatureTemplate,
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

// EVM-parity low-level call: `(bool, bytes) = addr.call(payload)` returns the callee's real integrity-bound
// return. `payload` is built with abi.encodeWithSignature/Selector off-chain. The opaque return is used in a
// covenant decision (the require) and a fixed-size derivation of it is committed to state.
const CALLER = `pragma solidcash >=0.8.0;
contract Caller() {
  bytes32 digest;
  function go(address t, bytes payload, pubkey pk, sig s) {
    require(checkSig(s, pk));
    (bool ok, bytes result) = t.call(payload);
    require(ok);
    require(result.length > 0);
    this.digest = sha256(result);
  }
}`;

describe('low-level call with integrity-bound return ((bool,bytes) = addr.call(payload))', () => {
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

  // payload stands in for abi.encodeWithSignature(`${fn}(...)`, ...args); not enforced on-chain in this MVP.
  function payloadFor(art: typeof echoArt, fn: string): Uint8Array {
    return hexToBin(art.abi.find((f) => f.name === fn)!.selector!);
  }

  it('reads the callee\'s real return via addr.call(payload)', async () => {
    const echo = await genCallee(echoArt, { stored: 0n });
    const caller = await genCaller();

    const tx = await caller.sc.go(echo.addr, payloadFor(echoArt, 'setAndReturn'), alicePub, sig())
      .withExternalCall(echo.sc, 'setAndReturn', [42n, alicePub, sig()])
      .send();

    expect(tx.txid).toBeDefined();
    expect((await echo.sc.getState()).stored).toBe(42n);
    expect(((await caller.sc.getState()).digest as Uint8Array).some((b) => b !== 0)).toBe(true);
  });

  it('dispatches the same caller generically to an unrelated callee type', async () => {
    const adder = await genCallee(adderArt, { last: 0n });
    const caller = await genCaller();

    const tx = await caller.sc.go(adder.addr, payloadFor(adderArt, 'add'), alicePub, sig())
      .withExternalCall(adder.sc, 'add', [3n, 4n, alicePub, sig()])
      .send();

    expect(tx.txid).toBeDefined();
    expect((await adder.sc.getState()).last).toBe(7n);
    expect(((await caller.sc.getState()).digest as Uint8Array).some((b) => b !== 0)).toBe(true);
  });

  it('rejects a wrong target address (co-spent callee is not the claimed addr)', async () => {
    const echo = await genCallee(echoArt, { stored: 0n });
    const caller = await genCaller();

    await expect(
      caller.sc.go(caller.addr, payloadFor(echoArt, 'setAndReturn'), alicePub, sig())
        .withExternalCall(echo.sc, 'setAndReturn', [42n, alicePub, sig()])
        .send(),
    ).rejects.toThrow(
      /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
  });
});

describe('abi.encodeWithSignature payload (parity surface)', () => {
  it('compiles addr.call(abi.encodeWithSignature(...)) into an integrity-bound external call', () => {
    const src = `pragma solidcash >=0.8.0;
contract C() {
  bytes32 d;
  function f(address t, bigint v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    (bool ok, bytes r) = t.call(abi.encodeWithSignature("setAndReturn(uint256)", v));
    require(ok);
    this.d = sha256(r);
  }
}`;
    const art = compileString(src);
    const fn = art.abi.find((f) => f.name === 'f');
    expect(fn!.externalCalls?.some((e) => e.opaqueReturn)).toBe(true);
  });
});
