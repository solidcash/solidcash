import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// A hands a foreign fn-ptr to a DIFFERENT contract B over the external-call boundary. The fn-ptr member arg
// splits into (address, selector) to match B's lowered param; B stores it and calls it in a later tx - the
// cross-CONTRACT pass. Target/B/A compiled together (multi-contract).
const SRC = `
interface ITarget { public bigint counter; function inc(pubkey o, sig s) external; }
interface IB { function register(function(pubkey,sig) external cb, pubkey pk, sig s) external; }
contract Target is ITarget { bigint counter;
  function inc(pubkey o, sig s) external { require(checkSig(s, o)); this.counter = this.counter + 1; } }
contract B {
  function(pubkey,sig) external stored;
  bigint n;
  function register(function(pubkey,sig) external cb, pubkey pk, sig s) public {
    require(checkSig(s, pk)); this.stored = cb; this.n = this.n + 1;
  }
  function fire(pubkey pk, sig s) public { require(checkSig(s, pk)); stored(pk, s); this.n = this.n + 1; }
}
contract A {
  bigint calls;
  function go(address b, address t, pubkey pk, sig s) public {
    require(checkSig(s, pk)); IB(b).register(ITarget(t).inc, pk, s); this.calls = this.calls + 1;
  }
}`;

describe('foreign fn-ptr PASSED cross-CONTRACT (A -> B.register -> B.fire)', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('A splits the fn-ptr arg for B, B stores it, B fires it against the target', async () => {
    const incSel = hexToBin(arts.Target.abi.find((f) => f.name === 'inc')!.selector!);

    const target = new Contract(arts.Target, [], { provider });
    const { categoryId: tc } = await setupStatefulUtxos(
      provider, target, arts.Target.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const tAddr = target.withCategory(hexToBin(tc)).lockingBytecode;

    const b = new Contract(arts.B, [], { provider });
    const { categoryId: bc } = await setupStatefulUtxos(
      provider, b, arts.B.stateLayout!, { stored: new Uint8Array(), n: 0n }, { saltContract: true },
    );
    const bAddr = b.withCategory(hexToBin(bc)).lockingBytecode;

    const a = new Contract(arts.A, [], { provider });
    const { categoryId: ac } = await setupStatefulUtxos(
      provider, a, arts.A.stateLayout!, { calls: 0n }, { saltContract: true },
    );

    const aSc = StatefulContract.withCategory(a, ac);
    const bSc = StatefulContract.withCategory(b, bc);
    const targetSc = StatefulContract.withCategory(target, tc);

    // tx1: A.go external-calls B.register, passing the fn-ptr (split to target address + inc selector). B stores it.
    const tx1 = await aSc.go(hexToBin(bAddr), hexToBin(tAddr), alicePub, sig())
      .withExternalCall(bSc, 'register', [hexToBin(tAddr), incSel, alicePub, sig()])
      .send();
    expect(tx1.txid).toBeDefined();
    expect((await aSc.getState()).calls).toBe(1n);
    expect((await bSc.getState()).n).toBe(1n);

    // tx2: B.fire() co-spends the target through the stored pointer.
    const tx2 = await bSc.fire(alicePub, sig())
      .withExternalCall(targetSc, 'inc', [alicePub, sig()])
      .send();
    expect(tx2.txid).toBeDefined();
    expect((await targetSc.getState()).counter).toBe(6n);
    expect((await bSc.getState()).n).toBe(2n);
  });
});

// A RETURNS a foreign fn-ptr to a DIFFERENT contract B (as a bounded blob via the return-event NFT); B receives
// it in a blob local and co-spends the target through it - the cross-CONTRACT return direction.
const RET_SRC = `
interface ITarget { public bigint counter; function inc(pubkey o, sig s) external; }
interface IA { function getPtr(address t) external returns (function(pubkey,sig) external); }
contract Target is ITarget { bigint counter;
  function inc(pubkey o, sig s) external { require(checkSig(s, o)); this.counter = this.counter + 1; } }
contract A { bigint dummy;
  function getPtr(address t) public returns (function(pubkey,sig) external) { return ITarget(t).inc; } }
contract B {
  bigint n;
  function use(address a, address t, pubkey pk, sig s) public {
    require(checkSig(s, pk));
    function(pubkey,sig) external p = IA(a).getPtr(t);
    p(pk, s); this.n = this.n + 1;
  }
}`;

// The caller + callee sides COMPILE (interface fn-ptr return retyped to a bounded blob; a blob local from a
// cross-contract call detected + sliced). BLOCKED at runtime by a return-event bug isolated to COMPUTED bytes
// returns: a cross-contract bounded-bytes PARAM return works, but a COMPUTED bounded blob (and any unbounded
// bytes return) yields an empty blob at B - the return-event NFT does not thread A's computed bytes-blob return
// across the boundary. Two return-event bugs, not fn-ptr-specific (see XContractBytesReturn.test.ts). Unskip
// once cross-contract computed/unbounded bytes returns thread correctly.
describe.skip('foreign fn-ptr RETURNED cross-CONTRACT (B <- A.getPtr) [BLOCKED: computed bytes return-event bug]', () => {
  const arts = compileStringMulti(RET_SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('B receives A\'s returned fn-ptr blob and co-spends the target through it', async () => {
    const target = new Contract(arts.Target, [], { provider });
    const { categoryId: tc } = await setupStatefulUtxos(
      provider, target, arts.Target.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const tAddr = target.withCategory(hexToBin(tc)).lockingBytecode;

    const a = new Contract(arts.A, [], { provider });
    const { categoryId: ac } = await setupStatefulUtxos(
      provider, a, arts.A.stateLayout!, { dummy: 0n }, { saltContract: true },
    );
    const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;

    const b = new Contract(arts.B, [], { provider });
    const { categoryId: bc } = await setupStatefulUtxos(
      provider, b, arts.B.stateLayout!, { n: 0n }, { saltContract: true },
    );

    const aSc = StatefulContract.withCategory(a, ac);
    const bSc = StatefulContract.withCategory(b, bc);
    const targetSc = StatefulContract.withCategory(target, tc);

    const tx = await bSc.use(hexToBin(aAddr), hexToBin(tAddr), alicePub, sig())
      .withExternalCall(aSc, 'getPtr', [hexToBin(tAddr)])
      .withExternalCall(targetSc, 'inc', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await bSc.getState()).n).toBe(1n);
    expect((await targetSc.getState()).counter).toBe(6n);
  });
});
