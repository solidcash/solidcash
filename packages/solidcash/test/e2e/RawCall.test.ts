import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// Callee: a generic stateful contract with a returning function. The caller knows nothing about its type.
const ECHO = `pragma solidcash >=0.8.0;
contract Echo() {
  bigint stored;
  function setAndReturn(bigint v, pubkey pk, sig s) returns (bigint) {
    require(checkSig(s, pk));
    this.stored = v;
    return v;
  }
}`;

// Caller: generic dynamic dispatch. addr/selector are caller-supplied; the return is read as opaque bytes.
// The digest of the opaque return is stored, which exercises the full integrity-bound blob (every byte
// affects the hash) while keeping a fixed-size, cleanly-derivable state field.
const CALLER = `pragma solidcash >=0.8.0;
contract Caller() {
  bytes32 digest;
  function go(address t, bytes sel, bytes args, pubkey pk, sig s) {
    require(checkSig(s, pk));
    bytes result = t.rawCall(sel, args);
    this.digest = sha256(result);
  }
}`;

describe('rawCall generic dynamic dispatch', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  const echoArt = compileString(ECHO);
  const callerArt = compileString(CALLER);
  const sel = hexToBin(echoArt.abi.find((f) => f.name === 'setAndReturn')!.selector!);

  // Genesis a fresh echo + caller pair; returns the bound stateful contracts and echo's address.
  async function setup(): Promise<{
    callerSc: StatefulContract; echoSc: StatefulContract; echoAddr: Uint8Array; callerAddr: Uint8Array;
  }> {
    const echo = new Contract(echoArt, [], { provider });
    const { categoryId: echoCat } = await setupStatefulUtxos(
      provider, echo, echoArt.stateLayout!, { stored: 0n }, { saltContract: true },
    );
    const echoAddr = hexToBin(echo.withCategory(hexToBin(echoCat)).lockingBytecode);

    const caller = new Contract(callerArt, [], { provider });
    const { categoryId: callerCat } = await setupStatefulUtxos(
      provider, caller, callerArt.stateLayout!, { digest: new Uint8Array(32) }, { saltContract: true },
    );
    const callerAddr = hexToBin(caller.withCategory(hexToBin(callerCat)).lockingBytecode);

    return {
      callerSc: StatefulContract.withCategory(caller, callerCat),
      echoSc: StatefulContract.withCategory(echo, echoCat),
      echoAddr,
      callerAddr,
    };
  }

  it('reads an integrity-bound opaque return from a generic callee', async () => {
    const { callerSc, echoSc, echoAddr } = await setup();

    const tx = await callerSc.go(echoAddr, sel, new Uint8Array(), alicePub, sig())
      .withExternalCall(echoSc, 'setAndReturn', [42n, alicePub, sig()])
      .send();

    expect(tx.txid).toBeDefined();
    expect((await echoSc.getState()).stored).toBe(42n);
    // digest = sha256(opaque return blob); non-zero proves the blob was read and hashed.
    const digest = (await callerSc.getState()).digest as Uint8Array;
    expect(digest.some((b) => b !== 0)).toBe(true);
  });

  it('rejects a wrong target address (co-spent callee is not the claimed addr)', async () => {
    const { callerSc, echoSc, callerAddr } = await setup();

    // Claim the caller's own address as the target while actually co-spending echo: identity check fails.
    await expect(
      callerSc.go(callerAddr, sel, new Uint8Array(), alicePub, sig())
        .withExternalCall(echoSc, 'setAndReturn', [42n, alicePub, sig()])
        .send(),
    ).rejects.toThrow();
  });
});
