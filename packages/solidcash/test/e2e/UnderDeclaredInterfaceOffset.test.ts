import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { hexToBin, binToHex } from '@bitauth/libauth';

// #17 regression: a cross-contract call whose interface UNDER-declares the callee's state (IA omits A's `d`),
// FOLLOWED by another external call. The callee's real co-spend includes A's data NFT, shifting the second
// call's block offset. A per-slot runtime master index (SDK-filled) makes the covenant read the right co-spent
// callee regardless, so this compiles+runs WITHOUT declaring A's state in the interface.
const SRC = `
interface IA { function gv(bytes4 s, bytes35 addr) external returns (bytes39); }
interface ITarget { public bigint counter; function bump() external; }
contract A { bigint d;
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

describe('under-declared interface + multi-call: runtime master index keeps offsets correct', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const S = hexToBin('11223344');
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
    const call = (bSc as any)[fn](hexToBin(aAddr), hexToBin(tAddr), S, ADDR);
    if (fn === 'returningFirst') {
      await call.withExternalCall(aSc, 'gv', [S, ADDR]).withExternalCall(targetSc, 'bump', []).send();
    } else {
      await call.withExternalCall(targetSc, 'bump', []).withExternalCall(aSc, 'gv', [S, ADDR]).send();
    }
    return { last: binToHex((await bSc.getState()).last as Uint8Array), counter: (await targetSc.getState()).counter };
  }

  it('threads with the returning (under-declared) call FIRST, followed by a void call', async () => {
    const { last, counter } = await run('returningFirst');
    expect(last).toBe(EXPECT);
    expect(counter).toBe(6n);
  });

  it('threads with a void call first, then the returning (under-declared) call', async () => {
    const { last, counter } = await run('returningLast');
    expect(last).toBe(EXPECT);
    expect(counter).toBe(6n);
  });
});
