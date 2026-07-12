import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// Pass a foreign fn-ptr MEMBER `IOther(t).bump` as an argument to an INTERNAL function that stores it to state
// (the arg splits to address + selector to match the callee's lowered param). A later tx fires the stored
// pointer, co-spending the target. This is the arg-passing building block of the corpus store_function.
const SRC = `
interface IOther { public bigint counter; function bump(pubkey o, sig s) external; }
contract Other is IOther { bigint counter;
  function bump(pubkey o, sig s) external { require(checkSig(s, o)); this.counter = this.counter + 1; } }
contract C {
  function(pubkey,sig) external stored;
  bigint n;
  function save(function(pubkey,sig) external cb) internal { this.stored = cb; }
  function install(address t, pubkey pk, sig s) public { require(checkSig(s, pk)); save(IOther(t).bump); this.n = this.n + 1; }
  function fire(pubkey pk, sig s) public { require(checkSig(s, pk)); stored(pk, s); this.n = this.n + 1; }
}`;

describe('pass a fn-ptr member to an internal function that stores it', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('install stores the passed member; fire co-spends the target through it', async () => {
    const other = new Contract(arts.Other, [], { provider });
    const { categoryId: tc } = await setupStatefulUtxos(
      provider, other, arts.Other.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const tAddr = other.withCategory(hexToBin(tc)).lockingBytecode;

    const c = new Contract(arts.C, [], { provider });
    const { categoryId: cc } = await setupStatefulUtxos(
      provider, c, arts.C.stateLayout!, { stored: new Uint8Array(), n: 0n }, { saltContract: true },
    );

    const cSc = StatefulContract.withCategory(c, cc);
    const otherSc = StatefulContract.withCategory(other, tc);

    // tx1: install() passes IOther(t).bump to the internal save(), which stores it.
    await cSc.install(hexToBin(tAddr), alicePub, sig()).send();
    expect((await cSc.getState()).n).toBe(1n);
    expect(Buffer.from((await cSc.getState()).stored as Uint8Array).toString('hex')).toBe(tAddr);

    // tx2: fire() co-spends Other through the stored pointer.
    await cSc.fire(alicePub, sig()).withExternalCall(otherSc, 'bump', [alicePub, sig()]).send();
    expect((await otherSc.getState()).counter).toBe(6n);
    expect((await cSc.getState()).n).toBe(2n);
  });
});
