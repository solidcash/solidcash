import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, SignatureTemplate } from '../src/index.js';
import { StatefulContract } from '../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';
import { alicePub, alicePriv } from './fixture/vars.js';

/**
 * Criterion 3: a PLAIN bytes push loop auto-derives its state through the SDK. `b.push(x)` desugars to
 * `b = b + <byte>`; repeated in a loop the value grows across iterations. After the transaction settles,
 * `getState().b` must be the exact bytes the loop built - no assembly, no `sload` cross-check - so the SDK's
 * state-derivation path itself is what is under test. Both a counter-bounded `for` loop and a length-bounded
 * `while` loop are driven; the `for` shape previously miscompiled the length header (the pending-value write
 * was emitted once but ran N times), which the loop cache now desugars to read-once / mutate-local / write-once.
 */
const SOURCE = `pragma solidcash >=0.8.0;
contract C() {
  bytes b;
  function pushFor(uint n, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.b = "";
    for (uint i = 0; i < n; i = i + 1) {
      this.b.push(0x41);
    }
  }
  function pushWhile(uint n, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.b = "";
    while (this.b.length < n) {
      this.b.push(0x42);
    }
  }
}`;

async function deploy(): Promise<StatefulContract> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { evmCompat: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { b: new Uint8Array(0) }, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId);
}

type Sc = StatefulContract & {
  pushFor: (n: bigint, pk: Uint8Array, s: SignatureTemplate) => { send: () => Promise<unknown> };
  pushWhile: (n: bigint, pk: Uint8Array, s: SignatureTemplate) => { send: () => Promise<unknown> };
  getState: () => Promise<{ b: Uint8Array }>;
};

describe('a plain bytes push loop auto-derives its state through the SDK', () => {
  it('a counter-bounded for loop derives the exact pushed bytes', async () => {
    const sc = await deploy() as unknown as Sc;
    await sc.pushFor(5n, alicePub, new SignatureTemplate(alicePriv)).send();
    expect((await sc.getState()).b).toEqual(new Uint8Array([0x41, 0x41, 0x41, 0x41, 0x41]));
  });

  it('a length-bounded while loop derives the exact pushed bytes', async () => {
    const sc = await deploy() as unknown as Sc;
    await sc.pushWhile(5n, alicePub, new SignatureTemplate(alicePriv)).send();
    expect((await sc.getState()).b).toEqual(new Uint8Array([0x42, 0x42, 0x42, 0x42, 0x42]));
  });
});
