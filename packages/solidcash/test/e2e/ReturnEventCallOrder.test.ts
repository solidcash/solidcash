import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { hexToBin, binToHex } from '@bitauth/libauth';

// Regression: a cross-contract call that RETURNS a value, FOLLOWED by another external call. The return-event
// NFT sits in a fixed section at the tx end; the SDK extracts its commitment from that section rather than from
// the inline data-NFT range (which only coincides with the return event when the returning call is the LAST
// external call). Before the fix, ordering the returning call first yielded an empty return (a following call's
// output polluted the inline range). Both orders must thread the same value. IA declares A's state so the
// co-spend's compile-time input offset matches the runtime layout.
const SRC = `
interface IA { public bigint d; function gv(bytes4 s, bytes35 addr) external returns (bytes39); }
interface ITarget { public bigint counter; function bump() external; }
contract A is IA { bigint d;
  function gv(bytes4 s, bytes35 addr) public returns (bytes39) { return bytes39(s + addr); } }
contract Target is ITarget { bigint counter;
  function bump() external { this.counter = this.counter + 1; } }
contract B { bytes39 last; bigint n;
  function returningFirst(address a, address t, bytes4 s, bytes35 addr) public {
    bytes39 p = IA(a).gv(s, addr);
    ITarget(t).bump();
    this.last = p; this.n = this.n + 1;
    require(this.n > 0);
  }
  function returningLast(address a, address t, bytes4 s, bytes35 addr) public {
    ITarget(t).bump();
    bytes39 p = IA(a).gv(s, addr);
    this.last = p; this.n = this.n + 1;
    require(this.n > 0);
  }
}`;

describe('cross-contract return event survives a co-spent second call in any order', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const S = hexToBin('11223344');
  // p2sh32-shaped return value: exercises the encode/decode with real aa20..87 bytes.
  const ADDR = hexToBin('aa20' + '55'.repeat(32) + '87');
  const EXPECT = '11223344aa20' + '55'.repeat(32) + '87';

  async function run(fn: 'returningFirst' | 'returningLast'): Promise<{ last: string; counter: bigint }> {
    const a = new Contract(arts.A, [], { provider });
    const { categoryId: ac } = await setupStatefulUtxos(
      provider, a, arts.A.stateLayout!, { d: 0n }, { saltContract: true },
    );
    const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
    const target = new Contract(arts.Target, [], { provider });
    const { categoryId: tc } = await setupStatefulUtxos(
      provider, target, arts.Target.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const tAddr = target.withCategory(hexToBin(tc)).lockingBytecode;
    const b = new Contract(arts.B, [], { provider });
    const { categoryId: bc } = await setupStatefulUtxos(
      provider, b, arts.B.stateLayout!, { last: new Uint8Array(39), n: 0n }, { saltContract: true },
    );
    const aSc = StatefulContract.withCategory(a, ac);
    const bSc = StatefulContract.withCategory(b, bc);
    const targetSc = StatefulContract.withCategory(target, tc);
    // withExternalCall order matches the source call order for the function under test.
    const call = (bSc as any)[fn](hexToBin(aAddr), hexToBin(tAddr), S, ADDR);
    if (fn === 'returningFirst') {
      await call.withExternalCall(aSc, 'gv', [S, ADDR]).withExternalCall(targetSc, 'bump', []).send();
    } else {
      await call.withExternalCall(targetSc, 'bump', []).withExternalCall(aSc, 'gv', [S, ADDR]).send();
    }
    return { last: binToHex((await bSc.getState()).last as Uint8Array), counter: (await targetSc.getState()).counter };
  }

  it('threads the return when the returning call is FIRST', async () => {
    const { last, counter } = await run('returningFirst');
    expect(last).toBe(EXPECT);
    expect(counter).toBe(6n);
  });

  it('threads the return when the returning call is LAST', async () => {
    const { last, counter } = await run('returningLast');
    expect(last).toBe(EXPECT);
    expect(counter).toBe(6n);
  });
});
