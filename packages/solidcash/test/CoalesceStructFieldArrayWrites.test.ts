import { describe, it } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// Behavioral proof for the CoalesceStructFieldArrayWrites compiler pass (docs/coalesce-struct-field-array-writes.md).
// A run of element writes to the same fixed-array field of a memory struct is coalesced from N whole-struct rebuilds
// into one. Each `f(...)` below executes the coalesced bytecode on the VM; the requires assert the exact result, so a
// miscompile fails the spend. Values flow through RUNTIME params (not compile-time constants) so the checks cannot be
// constant-folded away - the VM must actually perform the coalesced writes and reads.

async function run(src: string, call: (sc: StatefulContract) => Promise<unknown>): Promise<void> {
  const provider = createTestProvider();
  const artifact = compileString(src);
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const sc = StatefulContract.withCategory(contract, categoryId);
  await call(sc);
}

const STRUCT = 'struct S { uint16[4] split; int16[2] consensus; uint256 amount; }';

describe('CoalesceStructFieldArrayWrites: VM behavioral parity', () => {
  // W2: constant indices tiling the whole array with RUNTIME values -> one array-literal rebuild, no field read.
  it('W2 whole-array constant-index cover places runtime values at the right slots', async () => {
    await run(`contract C() {
      ${STRUCT}
      int counter;
      function f(uint16 x) {
        S memory s = S([uint16(1),1,1,1],[int16(0),0],0);
        s.split[0] = x; s.split[1] = 0; s.split[2] = x + 1; s.split[3] = 0;
        require(s.split[0] == x); require(s.split[1] == 0);
        require(s.split[2] == x + 1); require(s.split[3] == 0);
        require(true);
      }
    }`, (sc) => sc.f(4321n).send());
  });

  // W1 self-read at own index: the Unicrow refund/release consensus pattern `c[i] = f(c[i])`. Each read must observe
  // the ORIGINAL element, which the running temp preserves.
  it('W1 own-index self-read (consensus refund/release shape) reads the original element', async () => {
    await run(`contract C() {
      ${STRUCT}
      int counter;
      function f(int16 c0, int16 c1) {
        S memory s = S([uint16(0),0,0,0],[c0,c1],0);
        s.consensus[0] = s.consensus[0] + 1;
        s.consensus[1] = s.consensus[1];
        require(s.consensus[0] == c0 + 1);
        require(s.consensus[1] == c1);
        require(true);
      }
    }`, (sc) => sc.f(3n, -2n).send());
  });

  // W1 CROSS-index self-read: `a[1] = a[0]` after `a[0] = b` must see the JUST-WRITTEN a[0]. Proves the running-temp
  // rewrite (without it a[1] would read the stale original a[0]).
  it('W1 cross-index self-read observes the just-written element', async () => {
    await run(`contract C() {
      ${STRUCT}
      int counter;
      function f(uint16 a, uint16 b) {
        S memory s = S([a,b,uint16(0),0],[int16(0),0],0);
        s.split[0] = b;
        s.split[1] = s.split[0];
        require(s.split[0] == b);
        require(s.split[1] == b);
        require(true);
      }
    }`, (sc) => sc.f(11n, 77n).send());
  });

  // Partial run (indices 1,2 of a [4] array): NOT a whole-array cover, so untouched slots 0 and 3 must survive.
  it('partial run preserves untouched elements', async () => {
    await run(`contract C() {
      ${STRUCT}
      int counter;
      function f(uint16 x) {
        S memory s = S([uint16(11),22,33,44],[int16(0),0],0);
        s.split[1] = x; s.split[2] = x;
        require(s.split[0] == 11); require(s.split[1] == x);
        require(s.split[2] == x); require(s.split[3] == 44);
        require(true);
      }
    }`, (sc) => sc.f(99n).send());
  });

  // Two consecutive runs on DIFFERENT fields (the exact refund shape): split-run then consensus-run coalesce
  // independently, and the untouched scalar field `amount` survives both whole-struct rebuilds.
  it('adjacent runs on different fields do not corrupt each other or scalar fields', async () => {
    await run(`contract C() {
      ${STRUCT}
      int counter;
      function f(int16 c0, uint256 amt) {
        S memory s = S([uint16(1),2,3,4],[c0,int16(7)],amt);
        s.split[0] = 10000; s.split[1] = 0; s.split[2] = 0; s.split[3] = 0;
        s.consensus[0] = s.consensus[0] + 1;
        s.consensus[1] = s.consensus[1];
        require(s.split[0] == 10000); require(s.split[1] == 0);
        require(s.split[2] == 0); require(s.split[3] == 0);
        require(s.consensus[0] == c0 + 1); require(s.consensus[1] == 7);
        require(s.amount == amt);
        require(true);
      }
    }`, (sc) => sc.f(5n, 123456789n).send());
  });

  // A postfix increment inside a run (`s.split[0]++`): its value reads the unit's OWN temp, the case that first
  // exposed the dangling-temp bug. Coalesced form must still compute base+1.
  it('postfix increment within a run coalesces correctly', async () => {
    await run(`contract C() {
      ${STRUCT}
      int counter;
      function f(uint16 x) {
        S memory s = S([x,uint16(0),0,0],[int16(0),0],0);
        s.split[0] = x;
        s.split[0]++;
        s.split[1] = 5;
        require(s.split[0] == x + 1);
        require(s.split[1] == 5);
        require(true);
      }
    }`, (sc) => sc.f(41n).send());
  });
});
