import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import {
  Contract, StatefulContract, Signer, SortedList, getEntryNftAddress, keyToSlot,
} from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

// =============================================================================
// Sorted-mapping (C2) writes through a delegate LIBRARY facet: what settles.
//
// This probe was written when NO delegated mapping write settled at all, because
// the consumer's `L.f()` forwarder publishes entryAccesses = null, so the SDK
// provisioned no entry UTXOs and `hasNothingToDerive` skipped derivation
// outright. X11 (837c8b8d) fixed that by reading the ROUTED accesses, and the
// picture is now split cleanly in two:
//
//   UPDATE (key already exists) - SETTLES, and the value lands.
//   INSERT (new key)            - REFUSED, at the PROXY's own input.
//
// The INSERT refusal is a covenant fact, not a gap. An insert mints one new
// entry node, so the transaction's own-category mutable (0x01) NFT count rises
// by one, and a delegatecall master carries emitOwnCategoryMutableNftConservation
// (C1 full-state authority - GenerateTargetTraversal, emitted unconditionally on
// the delegatecall path) which pins that count input == output. It is the same
// defence that refuses an appended fabricated entry node, so the proxy cannot
// admit one without admitting the other.
//
// The consequence for facet-splitting: a facet may UPDATE any mapping, but the
// KEY has to be created by a direct (non-delegated) function on the master. A
// zero-value `register(k)` is enough and is cheap - see the last test.
// =============================================================================
const LIB = `library M {
  mapping(address => int) bal;
  int counter;
  function setBal(address k, int v) public { this.bal[k] = v; }
  function bump() public { this.counter = this.counter + 1; }
}`;
// `seed` and `register` are DIRECT (non-delegated) master writes, so they may create the key.
const CONS = `import { M } from "./m.scash";
contract C() {
  mapping(address => int) bal;
  int counter;
  function setBal(address k, int v) { M.setBal(k, v); }
  function bump() { M.bump(); }
  function seed(address k, int v) { this.bal[k] = v; }
  function register(address k) { this.bal[k] = 0; }
}`;

const KEY = hexToBin('aa'.repeat(20));

describe('delegate facet: mapping write vs scalar write', () => {
  const resolver = (p: string): { source: string; id: string } | undefined =>
    (p.includes('m.scash') ? { source: LIB, id: 'm' } : undefined);

  const setup = async (): Promise<{
    c: StatefulContract; signer: Signer; read: () => Promise<bigint | undefined>;
  }> => {
    const provider = createTestProvider();
    const libArt = compileString(LIB, { brandLibrary: true });
    const consArt = compileString(CONS, { importResolver: resolver });
    const consCat = `${'11'.repeat(31)}aa`;
    const libCat = `${'22'.repeat(31)}bb`;
    const libContract = StatefulContract.brandedLibrary(libArt, consCat, { provider });
    const libAddr = hexToBin(libContract.withCategory(hexToBin(libCat)).lockingBytecode);
    const cons = new Contract(consArt, [libAddr], { provider });
    await setupStatefulUtxos(provider, libContract, libArt.stateLayout!, { counter: 0n },
      { saltContract: true, categoryOverride: libCat });
    await setupStatefulUtxos(provider, cons, consArt.stateLayout!, { counter: 0n },
      { saltContract: true, categoryOverride: consCat });
    const c = StatefulContract.withCategory(cons, consCat);
    c.registerLibrary('M', StatefulContract.withCategory(libContract, libCat));
    const signer = new Signer(alicePriv, provider);
    await provider.addUtxo(signer.getAddress(), { txid: 'ab'.repeat(32), vout: 0, satoshis: 300000n });
    const ea = getEntryNftAddress(cons.withCategory(hexToBin(consCat)), consCat, 'bal');
    const read = async (): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(KEY));
      return e ? vmNumberToBigInt(e.value) : undefined;
    };
    return { c, signer, read };
  };

  it('scalar write through a facet works (control)', async () => {
    const { c, signer } = await setup();
    await c.connect(signer).call.bump().send();
    expect((await c.getState()).counter).toBe(1n);
  });

  // The proxy conserves its own-category mutable NFT count, and an INSERT mints one.
  // It fails at input 0 - the master - not at the library's own input.
  it('a delegated mapping INSERT is refused by the proxy', async () => {
    const { c, signer, read } = await setup();
    await expect(
      c.connect(signer).call.setBal(KEY, 42n).send(),
    ).rejects.toThrow(/input 0|OP_VERIFY/);
    expect(await read(), 'nothing was written').toBeUndefined();
  });

  it('a delegated mapping UPDATE settles and lands the value', async () => {
    const { c, signer, read } = await setup();
    await c.connect(signer).call.seed(KEY, 7n).send(); // direct master write creates the key
    expect(await read()).toBe(7n);
    await c.connect(signer).call.setBal(KEY, 42n).send(); // delegated write updates it
    expect(await read()).toBe(42n);
  });

  // The cheap general unblock for a facet-split contract: the master opens the
  // account at zero, and every facet write from then on is an UPDATE.
  it('a direct zero-value register is enough to make later delegated writes settle', async () => {
    const { c, signer, read } = await setup();
    await c.connect(signer).call.register(KEY).send();
    expect(await read(), 'the key exists at zero').toBe(0n);
    await c.connect(signer).call.setBal(KEY, 42n).send();
    expect(await read()).toBe(42n);
  });

  // The forwarder still publishes no entryAccesses of its own - X11 did not change
  // the ABI, it made the SDK read the routed (implementation) accesses instead.
  it('the forwarder publishes no entryAccesses; the library does', () => {
    const libArt = compileString(LIB, { brandLibrary: true });
    const consArt = compileString(CONS, { importResolver: resolver });
    const libFn = libArt.abi.find((f) => f.name === 'setBal');
    const consFn = consArt.abi.find((f) => f.name === 'setBal');
    expect(libFn?.entryAccesses, 'library should report the mapping write').toBeDefined();
    expect(libFn!.entryAccesses![0].collection).toBe('bal');
    expect(consFn?.entryAccesses).toBeUndefined();
  });
});
