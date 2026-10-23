// Cross-contract call infrastructure: unbounded-bytes returns, return-event extraction order,
// per-slot master index for under-declared interfaces.
import { describe, it, expect } from 'vitest';
import { compileStringMulti } from '@solidcash/solidc';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { hexToBin, binToHex } from '@bitauth/libauth';

describe('unbounded bytes return', () => {
  const DIRECT_SRC = 'contract B { bytes last; function use(bytes b) public { this.last = b; } }';
  const XC_SRC = `
  interface IA { function echo(bytes b) external returns (bytes); }
  contract A { bigint d; function echo(bytes b) public returns (bytes) { return b; } }
  contract B { bytes32 last; function use(address a, bytes b) public { this.last = sha256(IA(a).echo(b)); } }`;
  const XC_DYNAMIC_SRC = `
  interface IA { function echo(bytes b) external returns (bytes); }
  contract A { bigint d; function echo(bytes b) public returns (bytes) { return b; } }
  contract B { bytes last; function use(address a, bytes b) public { this.last = IA(a).echo(b); } }`;

  const VAL = hexToBin('11223344abcd');

  describe('cross-contract bytes return (isolation, clean values)', () => {
    const provider = createTestProvider();

    it('CONTROL: B stores a bytes param directly', async () => {
      const arts = compileStringMulti(DIRECT_SRC, { evmCompat: true });
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
      const arts = compileStringMulti(src, { evmCompat: true });
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

    it('CROSS-CONTRACT: B receives and hashes A.echo(b) unbounded bytes return', async () => {
      const arts = compileStringMulti(XC_SRC, { evmCompat: true });
      const a = new Contract(arts.A, [], { provider });
      const { categoryId: ac } = await setupStatefulUtxos(
        provider, a, arts.A.stateLayout!, { d: 0n }, { saltContract: true },
      );
      const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
      const b = new Contract(arts.B, [], { provider });
      const { categoryId: bc } = await setupStatefulUtxos(
        provider, b, arts.B.stateLayout!, { last: new Uint8Array(32) }, { saltContract: true },
      );
      const aSc = StatefulContract.withCategory(a, ac); const bSc = StatefulContract.withCategory(b, bc);
      await bSc.use(hexToBin(aAddr), VAL).withExternalCall(aSc, 'echo', [VAL]).send();
      expect(Buffer.from((await bSc.getState()).last as Uint8Array).toString('hex')).toBe(
        '8f33bbbe76e4f01dd1b24499fc6ab72e92f704f9444722cd3805ba8cc18fd2c6',
      );
    });

    // Regression: the interface under-declares A's data-NFT footprint. The dynamic chunk must follow the
    // authenticated runtime return event, not an offset inferred from the narrower interface layout.
    it('CROSS-CONTRACT: B stores A.echo(b) bytes return in dynamic state', async () => {
      const arts = compileStringMulti(XC_DYNAMIC_SRC, { evmCompat: true });
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

    it('CROSS-CONTRACT: decodes a forwarded mixed dynamic return tuple', async () => {
      const src = `
        interface IA { function echo(bytes b, uint n) external returns (bytes, uint); }
        contract A { bigint d;
          function pair(bytes b, uint n) internal pure returns (bytes, uint) { return (b, n); }
          function echo(bytes b, uint n) public returns (bytes, uint) { return pair(b, n); }
        }
        contract B { bytes32 digest; uint seen;
          function use(address a, bytes b, uint n) public {
            (bytes returned, uint value) = IA(a).echo(b, n);
            this.digest = sha256(returned); this.seen = value;
          }
        }`;
      const arts = compileStringMulti(src, { evmCompat: true });
      const a = new Contract(arts.A, [], { provider });
      const { categoryId: ac } = await setupStatefulUtxos(
        provider, a, arts.A.stateLayout!, { d: 0n }, { saltContract: true },
      );
      const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
      const b = new Contract(arts.B, [], { provider });
      const { categoryId: bc } = await setupStatefulUtxos(
        provider, b, arts.B.stateLayout!, { digest: new Uint8Array(32), seen: 0n }, { saltContract: true },
      );
      const aSc = StatefulContract.withCategory(a, ac); const bSc = StatefulContract.withCategory(b, bc);
      await bSc.use(hexToBin(aAddr), VAL, 73n).withExternalCall(aSc, 'echo', [VAL, 73n]).send();
      const state = await bSc.getState();
      expect(binToHex(state.digest as Uint8Array)).toBe(
        '8f33bbbe76e4f01dd1b24499fc6ab72e92f704f9444722cd3805ba8cc18fd2c6',
      );
      expect(state.seen).toBe(73n);
    });

    // Two distinct returning methods cannot both execute from the callee's one master input without an
    // authenticated batch route: the second return output would only be a placeholder. Refused by name;
    // messageBus.compose authenticates both logical invocations.
    it('CROSS-CONTRACT: refuses two returning calls to one participant without a batch route', async () => {
      const src = `
        interface IA {
          function echo(bytes b) external returns (bytes);
          function wide(uint n, bytes39 value) external returns (uint, bytes39);
        }
        contract A { bigint marker;
          function echo(bytes b) public returns (bytes) { return b; }
          function pair(uint n, bytes39 value) internal pure returns (uint, bytes39) { return (n, value); }
          function wide(uint n, bytes39 value) public returns (uint, bytes39) { return pair(n, value); }
        }
        contract B { bytes32 digest; bytes39 saved; uint seen;
          function use(address a, bytes b, uint n, bytes39 wideValue) public {
            this.digest = sha256(IA(a).echo(b));
            (uint returned, bytes39 value) = IA(a).wide(n, wideValue);
            this.seen = returned; this.saved = value;
          }
        }`;
      const arts = compileStringMulti(src, {
        evmCompat: true, messageBus: true, messageBusGraphContext: true,
      });
      const a = new Contract(arts.A, [], { provider });
      const { categoryId: ac } = await setupStatefulUtxos(
        provider, a, arts.A.stateLayout!, { marker: 0n }, { saltContract: true },
      );
      const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
      const b = new Contract(arts.B, [], { provider });
      const wide = hexToBin(`11223344aa20${'55'.repeat(32)}87`);
      const { categoryId: bc } = await setupStatefulUtxos(
        provider, b, arts.B.stateLayout!,
        { digest: new Uint8Array(32), saved: new Uint8Array(39), seen: 0n },
        { saltContract: true },
      );
      const aSc = StatefulContract.withCategory(a, ac);
      const bSc = StatefulContract.withCategory(b, bc);
      await expect(bSc.use(hexToBin(aAddr), VAL, 73n, wide)
        .withExternalCall(aSc, 'echo', [VAL])
        .withExternalCall(aSc, 'wide', [73n, wide])
        .send()).rejects.toThrow(/calls to echo and wide share one state owner but both return values.*compose/);
      const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
      await messageBus.compose({
        calls: [
          bSc.call.use(hexToBin(aAddr), VAL, 73n, wide),
          aSc.call.echo(VAL),
          aSc.call.wide(73n, wide),
        ],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
      }).send();
      const state = await bSc.getState();
      expect(binToHex(state.digest as Uint8Array)).toBe(
        '8f33bbbe76e4f01dd1b24499fc6ab72e92f704f9444722cd3805ba8cc18fd2c6',
      );
      expect(state.seen).toBe(73n);
      expect(binToHex(state.saved as Uint8Array)).toBe(binToHex(wide));
    });

    it('CROSS-CONTRACT: settles two non-returning calls to one participant as one batch', async () => {
      const src = `
        interface IA { function note(uint n) external; }
        contract A { bigint marker; function note(uint n) public { this.marker = this.marker + n; } }
        contract B { uint seen;
          function use(address a, uint n) public { IA(a).note(n); IA(a).note(n + 1); this.seen = n; }
        }`;
      const arts = compileStringMulti(src, { evmCompat: true, messageBus: true });
      const a = new Contract(arts.A, [], { provider });
      const { categoryId: ac } = await setupStatefulUtxos(
        provider, a, arts.A.stateLayout!, { marker: 0n }, { saltContract: true },
      );
      const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
      const b = new Contract(arts.B, [], { provider });
      const { categoryId: bc } = await setupStatefulUtxos(
        provider, b, arts.B.stateLayout!, { seen: 0n }, { saltContract: true },
      );
      const aSc = StatefulContract.withCategory(a, ac);
      const bSc = StatefulContract.withCategory(b, bc);
      await bSc.use(hexToBin(aAddr), 5n)
        .withExternalCall(aSc, 'note', [5n])
        .withExternalCall(aSc, 'note', [6n])
        .send();
      expect((await aSc.getState()).marker).toBe(11n);
      expect((await bSc.getState()).seen).toBe(5n);
    });

  });
});

// The multi-call B fixture below compiles to 12,157 bytes. It deliberately stresses return-event ordering in
// one unsplit script, so it cannot be spent under BCH's 10,000-byte input-script limit and remains mock-only.
describe.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('return-event order', () => {
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
    const arts = compileStringMulti(SRC, { evmCompat: true });
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

// This variant has the same consensus-impossible 12,157-byte B shape; the live-compatible single-call return
// coverage remains in the suite above.
describe.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('under-declared interface offset', () => {
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
    const arts = compileStringMulti(SRC, { evmCompat: true });
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
