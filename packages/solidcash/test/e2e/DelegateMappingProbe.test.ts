import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract, Signer } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

// Does a delegate LIBRARY facet support a sorted-mapping (C2) write against the
// proxy's state? Scalar writes through a facet are known to work.
const LIB = `library M {
  mapping(address => int) bal;
  int counter;
  function setBal(address k, int v) public { this.bal[k] = v; }
  function bump() public { this.counter = this.counter + 1; }
}`;
const CONS = `import { M } from "./m.scash";
contract C() {
  mapping(address => int) bal;
  int counter;
  function setBal(address k, int v) { M.setBal(k, v); }
  function bump() { M.bump(); }
}`;

describe('delegate facet: mapping write vs scalar write', () => {
  const resolver = (p: string): { source: string; id: string } | undefined =>
    (p.includes('m.scash') ? { source: LIB, id: 'm' } : undefined);

  const setup = async (): Promise<{ c: StatefulContract; signer: Signer }> => {
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
    return { c, signer };
  };

  it('scalar write through a facet works (control)', async () => {
    const { c, signer } = await setup();
    await c.connect(signer).call.bump().send();
    expect((await c.getState()).counter).toBe(1n);
  });

  // KNOWN GAP, pinned. The consumer's `L.f()` forwarder reports entryAccesses=null
  // while the library's own setBal reports the entry write, so the SDK never
  // co-spends the mapping entry UTXOs the delegate then writes and the covenant
  // fails. This blocks facet-splitting any contract whose facets touch mappings -
  // see docs/large-contract-splitting-implementation-plan.md ("facet routes ...
  // lay out root state/effect outputs"), which specifies the fix but is not
  // implemented. When it lands, invert this into a positive assertion.
  it('MAPPING write through a facet is currently rejected on-chain', async () => {
    const { c, signer } = await setup();
    await expect(
      c.connect(signer).call.setBal(hexToBin('aa'.repeat(20)), 42n).send(),
    ).rejects.toThrow();
  });

  it('the ABI asymmetry that causes it: library reports the entry write, forwarder does not', () => {
    const libArt = compileString(LIB, { brandLibrary: true });
    const consArt = compileString(CONS, { importResolver: resolver });
    const libFn = libArt.abi.find((f) => f.name === 'setBal');
    const consFn = consArt.abi.find((f) => f.name === 'setBal');
    expect(libFn?.entryAccesses, 'library should report the mapping write').toBeDefined();
    expect(libFn!.entryAccesses![0].collection).toBe('bal');
    // The forwarder loses it, which is why the SDK provisions no entry UTXOs.
    expect(consFn?.entryAccesses).toBeUndefined();
  });
});
