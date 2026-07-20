import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// ethers-style `contract.fn.staticCall()`: read a view function's return value(s) via a read-only VM probe (no
// send), decoded against the ABI output type(s). This is the value-returning read pattern (EA getJob/getUsers).
const SRC = `pragma solidcash >=0.8.0;
contract V() {
  struct Pt { bigint x; bigint y; }
  Pt p;
  function set(bigint a, bigint b) { this.p = Pt(a, b); }
  function getPt() view returns (Pt) { return this.p; }
  function sum() view returns (bigint) { return this.p.x + this.p.y; }
  function both() view returns (bigint, bigint) { return (this.p.x, this.p.y); }
  function bump() { this.p = Pt(this.p.x + 1, this.p.y); }
}`;

async function deploy(): Promise<StatefulContract> {
  const art = compileString(SRC);
  const provider = createTestProvider();
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, art.stateLayout!, { p: { x: 0n, y: 0n } }, { saltContract: true },
  );
  return new StatefulContract(categoryId, art, provider);
}

describe('StatefulFunctionCall.staticCall() - value-returning reads', () => {
  it('reads a scalar view return', async () => {
    const sc = await deploy() as unknown as { set: Function; sum: Function };
    await (sc.set(3n, 4n) as { send: () => Promise<unknown> }).send();
    expect(await (sc.sum() as { staticCall: () => Promise<bigint> }).staticCall()).toBe(7n);
  });

  it('reads a struct view return with .toObject()', async () => {
    const sc = await deploy() as unknown as { set: Function; getPt: Function };
    await (sc.set(3n, 4n) as { send: () => Promise<unknown> }).send();
    const pt = await (sc.getPt() as { staticCall: () => Promise<{ toObject: () => unknown; x: bigint }> }).staticCall();
    expect(pt.toObject()).toEqual({ x: 3n, y: 4n });
    expect(pt.x).toBe(3n); // named field access
    expect(Object.keys(pt as object)).toEqual(['x', 'y']); // accessor non-enumerable
  });

  it('multi-value (tuple) reads fail closed with a clear message (not yet supported)', async () => {
    const sc = await deploy() as unknown as { set: Function; both: Function };
    await (sc.set(5n, 9n) as { send: () => Promise<unknown> }).send();
    await expect((sc.both() as { staticCall: () => Promise<unknown> }).staticCall())
      .rejects.toThrow(/multi-value \(tuple\) reads are not yet supported/);
  });

  it('a read does not consume state (repeatable, no mutation)', async () => {
    const sc = await deploy() as unknown as { set: Function; sum: Function };
    await (sc.set(3n, 4n) as { send: () => Promise<unknown> }).send();
    expect(await (sc.sum() as { staticCall: () => Promise<bigint> }).staticCall()).toBe(7n);
    expect(await (sc.sum() as { staticCall: () => Promise<bigint> }).staticCall()).toBe(7n);
  });
});

// A view that takes arguments (the getJob(id) / balanceOf(addr) shape).
const ARG_SRC = `pragma solidcash >=0.8.0;
contract A() {
  bigint base;
  function set(bigint b) { this.base = b; }
  function plus(bigint k) view returns (bigint) { return this.base + k; }
}`;

describe('StatefulFunctionCall.staticCall() - with arguments', () => {
  it('passes call args into the read (getJob(id) shape)', async () => {
    const art = compileString(ARG_SRC);
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, { base: 0n }, { saltContract: true },
    );
    const sc = new StatefulContract(categoryId, art, provider) as unknown as {
      set: (b: bigint) => { send: () => Promise<unknown> };
      plus: (k: bigint) => { staticCall: () => Promise<bigint> };
    };
    await sc.set(10n).send();
    expect(await sc.plus(5n).staticCall()).toBe(15n);
    expect(await sc.plus(0n).staticCall()).toBe(10n);
  });
});
