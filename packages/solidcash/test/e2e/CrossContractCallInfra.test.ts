// Cross-contract call infrastructure: unbounded-bytes returns, return-event extraction order,
// per-slot master index for under-declared interfaces.
import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { hexToBin, binToHex } from '@bitauth/libauth';

describe('unbounded bytes return', () => {
  const DIRECT_SRC = 'contract B { bytes last; function use(bytes b) public { this.last = b; } }';
  const XC_SRC = `
  interface IA { function echo(bytes b) external returns (bytes); }
  contract A { bigint d; function echo(bytes b) public returns (bytes) { return b; } }
  contract B { bytes last; function use(address a, bytes b) public { this.last = IA(a).echo(b); } }`;

  const VAL = hexToBin('11223344abcd');

  describe('cross-contract bytes return (isolation, clean values)', () => {
    const provider = createTestProvider();

    it('CONTROL: B stores a bytes param directly', async () => {
      const arts = compileStringMulti(DIRECT_SRC, { solidityImportCompat: true });
      const b = new Contract(arts.B, [], { provider });
      const { categoryId: bc } = await setupStatefulUtxos(
        provider, b, arts.B.stateLayout!, { last: new Uint8Array() }, { saltContract: true },
      );
      const bSc = StatefulContract.withCategory(b, bc);
      await bSc.use(VAL).send();
      expect(Buffer.from((await bSc.getState()).last as Uint8Array).toString('hex')).toBe('11223344abcd');
    });

    it('CROSS-CONTRACT BOUNDED: B receives A.echo(b) bytes6 return', async () => {
      const src = `
        interface IA { function echo(bytes6 b) external returns (bytes6); }
        contract A { bigint d; function echo(bytes6 b) public returns (bytes6) { return b; } }
        contract B { bytes6 last; function use(address a, bytes6 b) public { this.last = IA(a).echo(b); } }`;
      const arts = compileStringMulti(src, { solidityImportCompat: true });
      const a = new Contract(arts.A, [], { provider });
      const { categoryId: ac } = await setupStatefulUtxos(
        provider, a, arts.A.stateLayout!, { d: 0n }, { saltContract: true },
      );
      const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
      const b = new Contract(arts.B, [], { provider });
      const { categoryId: bc } = await setupStatefulUtxos(
        provider, b, arts.B.stateLayout!, { last: new Uint8Array(6) }, { saltContract: true },
      );
      const aSc = StatefulContract.withCategory(a, ac); const bSc = StatefulContract.withCategory(b, bc);
      await bSc.use(hexToBin(aAddr), VAL).withExternalCall(aSc, 'echo', [VAL]).send();
      expect(Buffer.from((await bSc.getState()).last as Uint8Array).toString('hex')).toBe('11223344abcd');
    });

    // Known pre-existing bug: an UNBOUNDED cross-contract `bytes` return fails at a covenant OP_VERIFY
    // (generic-pushdata return-event path); bounded bytes<N>/uint returns work, blob returns use bounded.
    it.skip('CROSS-CONTRACT: B receives A.echo(b) bytes return [BLOCKED: unbounded-bytes return-event bug]', async () => {
      const arts = compileStringMulti(XC_SRC, { solidityImportCompat: true });
      const a = new Contract(arts.A, [], { provider });
      const { categoryId: ac } = await setupStatefulUtxos(
        provider, a, arts.A.stateLayout!, { d: 0n }, { saltContract: true },
      );
      const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
      const b = new Contract(arts.B, [], { provider });
      const { categoryId: bc } = await setupStatefulUtxos(
        provider, b, arts.B.stateLayout!, { last: new Uint8Array() }, { saltContract: true },
      );
      const aSc = StatefulContract.withCategory(a, ac); const bSc = StatefulContract.withCategory(b, bc);
      await bSc.use(hexToBin(aAddr), VAL).withExternalCall(aSc, 'echo', [VAL]).send();
      expect(Buffer.from((await bSc.getState()).last as Uint8Array).toString('hex')).toBe('11223344abcd');
    });
  });
});

describe('return-event order', () => {
  // Regression: a returning call FOLLOWED by another external call. The return-event commitment is
  // extracted from the dedicated return-event section (order-independent), so both orders thread the value.
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
});

describe('under-declared interface offset', () => {
  // #17: an interface that UNDER-declares the callee's state shifts the next call's block offset; the
  // per-slot runtime master index keeps the co-spend correct without declaring the state.
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
});
