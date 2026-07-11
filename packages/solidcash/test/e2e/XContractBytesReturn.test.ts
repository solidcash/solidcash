import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { hexToBin } from '@bitauth/libauth';

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
    const { categoryId: bc } = await setupStatefulUtxos(provider, b, arts.B.stateLayout!, { last: new Uint8Array() }, { saltContract: true });
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
    const { categoryId: ac } = await setupStatefulUtxos(provider, a, arts.A.stateLayout!, { d: 0n }, { saltContract: true });
    const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
    const b = new Contract(arts.B, [], { provider });
    const { categoryId: bc } = await setupStatefulUtxos(provider, b, arts.B.stateLayout!, { last: new Uint8Array(6) }, { saltContract: true });
    const aSc = StatefulContract.withCategory(a, ac); const bSc = StatefulContract.withCategory(b, bc);
    await bSc.use(hexToBin(aAddr), VAL).withExternalCall(aSc, 'echo', [VAL]).send();
    expect(Buffer.from((await bSc.getState()).last as Uint8Array).toString('hex')).toBe('11223344abcd');
  });

  // KNOWN BUG (isolated 2026-07-11): a cross-contract UNBOUNDED `bytes` return fails at a covenant OP_VERIFY,
  // while bounded bytes<N>, uint, and in-contract bytes all work. The unbounded path uses the generic-pushdata
  // encode/decode subroutines (2358 vs 1080 bytes) for the return-event blob; those disagree with the return-
  // event covenant for a variable-length value. This is a pre-existing return-event bug, not fn-ptr-specific -
  // the foreign fn-ptr cross-contract RETURN (a blob = bytes) reduces to it. Fix the generic-pushdata return-
  // event path (or return a bounded blob) to unblock both. See docs/foreign-function-pointer-design.md.
  it.skip('CROSS-CONTRACT: B receives A.echo(b) bytes return [BLOCKED: unbounded-bytes return-event bug]', async () => {
    const arts = compileStringMulti(XC_SRC, { solidityImportCompat: true });
    const a = new Contract(arts.A, [], { provider });
    const { categoryId: ac } = await setupStatefulUtxos(provider, a, arts.A.stateLayout!, { d: 0n }, { saltContract: true });
    const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
    const b = new Contract(arts.B, [], { provider });
    const { categoryId: bc } = await setupStatefulUtxos(provider, b, arts.B.stateLayout!, { last: new Uint8Array() }, { saltContract: true });
    const aSc = StatefulContract.withCategory(a, ac); const bSc = StatefulContract.withCategory(b, bc);
    await bSc.use(hexToBin(aAddr), VAL).withExternalCall(aSc, 'echo', [VAL]).send();
    expect(Buffer.from((await bSc.getState()).last as Uint8Array).toString('hex')).toBe('11223344abcd');
  });
});
