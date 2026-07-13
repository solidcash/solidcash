import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// Solidity call semantics for fn-ptr arrays: a bare `fns[idx](v)` calls ONLY element idx (one co-spend,
// hoisted element address + per-element selector); the broadcast is the explicit loop spelling (covered in
// the *DispatchTable tests). Verified per table kind (fixed / varying / received), for value-returning calls,
// for mutation lockstep (element assign swaps address AND selector), and for mixed + state-var-pushed tables.
const HANDLER = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(uint256 v); function dec(uint256 v); }
contract Handler() is IH {
  bigint counter;
  function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
  function dec(uint256 v) { this.counter = this.counter - int(v); require(int(v) >= 0); }
}`;
const IH = 'interface IH { public bigint counter; function inc(uint256 v); function dec(uint256 v); }';

const RET_HANDLER = `pragma solidcash >=0.8.0;
contract RetHandler() {
  bigint counter;
  function inc(uint256 v) returns (uint256) {
    this.counter = this.counter + int(v); require(int(v) >= 0); return uint256(this.counter);
  }
}`;

describe('single-element fn-ptr array calls (Solidity semantics)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const ha = compileString(HANDLER);
  const incSel = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);
  const decSel = hexToBin(ha.abi.find((f) => f.name === 'dec')!.selector!);

  const deployHandler = async (counter: bigint): Promise<{ sc: any; addr: Uint8Array }> => {
    const c = new Contract(ha, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, c, ha.stateLayout!, { counter }, { saltContract: true });
    return { sc: StatefulContract.withCategory(c, categoryId), addr: c.withCategory(hexToBin(categoryId)).lockingBytecode };
  };

  const deployTable = async (src: string, init: Record<string, unknown>): Promise<{ sc: any; art: any }> => {
    const art = compileString(src);
    const table = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, table, art.stateLayout!, init, { saltContract: true });
    return { sc: StatefulContract.withCategory(table, categoryId), art };
  };

  it('FIXED table: fns[idx](v) calls only element idx; the other element is untouched', async () => {
    const { sc: tableSc } = await deployTable(`pragma solidcash >=0.8.0;\n${IH}
      contract T() { function(uint256) external[] fns; bigint bumps;
        function reg(address a, pubkey pk, sig s) { require(checkSig(s, pk)); this.fns.push(IH(a).inc); this.bumps = this.bumps + 1; }
        function fire(int i, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); fns[i](v); this.bumps = this.bumps + 1; } }`,
    { fns: [], bumps: 0n });
    const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
    const { sc: c1Sc, addr: c1Addr } = await deployHandler(20n);
    await tableSc.reg(hexToBin(c0Addr), alicePub, sig()).send();
    await tableSc.reg(hexToBin(c1Addr), alicePub, sig()).send();

    await tableSc.fire(1n, 3n, alicePub, sig()).withExternalCall(c1Sc, 'inc', [3n]).send();
    expect((await c0Sc.getState()).counter).toBe(5n);   // element 0 untouched
    expect((await c1Sc.getState()).counter).toBe(23n);  // only element 1 called
  });

  it('VARYING table: single call dispatches the element OWN method; wrong method rejected', async () => {
    const { sc: tableSc } = await deployTable(`pragma solidcash >=0.8.0;\n${IH}
      contract T() { function(uint256) external[] fns; bigint bumps;
        function regInc(address a, pubkey pk, sig s) { require(checkSig(s, pk)); this.fns.push(IH(a).inc); this.bumps = this.bumps + 1; }
        function regDec(address a, pubkey pk, sig s) { require(checkSig(s, pk)); this.fns.push(IH(a).dec); this.bumps = this.bumps + 1; }
        function fire(int i, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); fns[i](v); this.bumps = this.bumps + 1; } }`,
    { fns: [], __fnsel_fns: [], bumps: 0n });
    const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
    const { sc: c1Sc, addr: c1Addr } = await deployHandler(20n);
    await tableSc.regInc(hexToBin(c0Addr), alicePub, sig()).send();
    await tableSc.regDec(hexToBin(c1Addr), alicePub, sig()).send();

    await tableSc.fire(1n, 3n, alicePub, sig()).withExternalCall(c1Sc, 'dec', [3n]).send();
    expect((await c0Sc.getState()).counter).toBe(5n);   // untouched
    expect((await c1Sc.getState()).counter).toBe(17n);  // element 1's OWN method (dec)

    // Element 0 carries inc's selector: co-spending dec against it must fail (runtime selector binding).
    await expect(tableSc.fire(0n, 3n, alicePub, sig()).withExternalCall(c0Sc, 'dec', [3n]).send())
      .rejects.toThrow();
  });

  it('RECEIVED table: value-RETURNING single call returns the callee result', async () => {
    const ra = compileString(RET_HANDLER);
    const rIncSel = hexToBin(ra.abi.find((f) => f.name === 'inc')!.selector!);
    const rh = new Contract(ra, [], { provider });
    const { categoryId: rc } = await setupStatefulUtxos(
      provider, rh, ra.stateLayout!, { counter: 40n }, { saltContract: true },
    );
    const rhSc = StatefulContract.withCategory(rh, rc);
    const rhAddr = rh.withCategory(hexToBin(rc)).lockingBytecode;

    const { sc: tableSc } = await deployTable(`pragma solidcash >=0.8.0;
      contract T() { function(uint256) external returns (uint256)[] fns; bigint last;
        function reg(function(uint256) external returns (uint256) p, pubkey pk, sig s) { require(checkSig(s, pk)); this.fns.push(p); }
        function fire(int i, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); this.last = int(fns[i](v)); } }`,
    { fns: [], __fnsel_fns: [], last: 0n });
    await tableSc.reg(hexToBin(rhAddr), rIncSel, alicePub, sig()).send();

    await tableSc.fire(0n, 2n, alicePub, sig()).withExternalCall(rhSc, 'inc', [2n]).send();
    expect((await rhSc.getState()).counter).toBe(42n);
    expect((await tableSc.getState()).last).toBe(42n);  // returned value landed in the caller's state
  });

  it('MUTATION lockstep: element assign swaps address AND selector; single call follows', async () => {
    const { sc: tableSc } = await deployTable(`pragma solidcash >=0.8.0;\n${IH}
      contract T() { function(uint256) external[] fns; bigint bumps;
        function regInc(address a, pubkey pk, sig s) { require(checkSig(s, pk)); this.fns.push(IH(a).inc); this.bumps = this.bumps + 1; }
        function regDec(address a, pubkey pk, sig s) { require(checkSig(s, pk)); this.fns.push(IH(a).dec); this.bumps = this.bumps + 1; }
        function upd(int i, address c, pubkey pk, sig s) { require(checkSig(s, pk)); this.fns[i] = IH(c).dec; this.bumps = this.bumps + 1; }
        function fire(int i, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); fns[i](v); this.bumps = this.bumps + 1; } }`,
    { fns: [], __fnsel_fns: [], bumps: 0n });
    const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
    const { sc: c1Sc, addr: c1Addr } = await deployHandler(20n);
    await tableSc.regInc(hexToBin(c0Addr), alicePub, sig()).send();      // fns[0] = (c0, inc)
    await tableSc.upd(0n, hexToBin(c1Addr), alicePub, sig()).send();     // fns[0] = (c1, dec) - both arrays

    await tableSc.fire(0n, 4n, alicePub, sig()).withExternalCall(c1Sc, 'dec', [4n]).send();
    expect((await c1Sc.getState()).counter).toBe(16n);  // 20 - 4: new address AND new selector
    expect((await c0Sc.getState()).counter).toBe(5n);   // old target untouched

    // The old (address, selector) pair must no longer verify.
    await expect(tableSc.fire(0n, 4n, alicePub, sig()).withExternalCall(c0Sc, 'inc', [4n]).send())
      .rejects.toThrow();
  });

  it('MIXED table (inline + received pushes) + state-var pointer push: single calls dispatch', async () => {
    const { sc: tableSc, art: ta } = await deployTable(`pragma solidcash >=0.8.0;\n${IH}
      contract T() { function(uint256) external stored; function(uint256) external[] fns; bigint bumps;
        function setP(function(uint256) external p, pubkey pk, sig s) { require(checkSig(s, pk)); this.stored = p; this.bumps = this.bumps + 1; }
        function regInline(address a, pubkey pk, sig s) { require(checkSig(s, pk)); this.fns.push(IH(a).inc); this.bumps = this.bumps + 1; }
        function regStored(pubkey pk, sig s) { require(checkSig(s, pk)); this.fns.push(stored); this.bumps = this.bumps + 1; }
        function fire(int i, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); fns[i](v); this.bumps = this.bumps + 1; } }`,
    { fns: [], __fnsel_fns: [], stored: new Uint8Array(35), __fnsel_stored: new Uint8Array(4), bumps: 0n });
    const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
    const { sc: c1Sc, addr: c1Addr } = await deployHandler(20n);

    await tableSc.regInline(hexToBin(c0Addr), alicePub, sig()).send();     // fns[0] inline (c0, inc)
    await tableSc.setP(hexToBin(c1Addr), decSel, alicePub, sig()).send();  // stored = (c1, dec)
    await tableSc.regStored(alicePub, sig()).send();                       // fns[1] from the state pointer

    await tableSc.fire(0n, 3n, alicePub, sig()).withExternalCall(c0Sc, 'inc', [3n]).send();
    expect((await c0Sc.getState()).counter).toBe(8n);
    await tableSc.fire(1n, 3n, alicePub, sig()).withExternalCall(c1Sc, 'dec', [3n]).send();
    expect((await c1Sc.getState()).counter).toBe(17n);
    expect(incSel.length).toBe(4); // silence unused warnings
    expect(ta.stateLayout!.variables.some((v: any) => v.name === '__fnsel_fns')).toBe(true);
  });

  it('POP lockstep: pop then re-push keeps (address, selector) aligned for the new element', async () => {
    const { sc: tableSc } = await deployTable(`pragma solidcash >=0.8.0;\n${IH}
      contract T() { function(uint256) external[] fns; bigint bumps;
        function regInc(address a, pubkey pk, sig s) { require(checkSig(s, pk)); this.fns.push(IH(a).inc); this.bumps = this.bumps + 1; }
        function regDec(address a, pubkey pk, sig s) { require(checkSig(s, pk)); this.fns.push(IH(a).dec); this.bumps = this.bumps + 1; }
        function drop(pubkey pk, sig s) { require(checkSig(s, pk)); fns.pop(); this.bumps = this.bumps + 1; }
        function fire(int i, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); fns[i](v); this.bumps = this.bumps + 1; } }`,
    { fns: [], __fnsel_fns: [], bumps: 0n });
    const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
    const { sc: c1Sc, addr: c1Addr } = await deployHandler(20n);

    await tableSc.regInc(hexToBin(c0Addr), alicePub, sig()).send();  // fns[0] = (c0, inc)
    await tableSc.regInc(hexToBin(c1Addr), alicePub, sig()).send();  // fns[1] = (c1, inc)
    await tableSc.drop(alicePub, sig()).send();                      // pops BOTH arrays
    await tableSc.regDec(hexToBin(c1Sc.inner.lockingBytecode), alicePub, sig()).send(); // fns[1] = (c1, dec)

    // If pop had desynced the selector array, fns[1] would still pair with inc's selector.
    await tableSc.fire(1n, 3n, alicePub, sig()).withExternalCall(c1Sc, 'dec', [3n]).send();
    expect((await c1Sc.getState()).counter).toBe(17n);  // 20 - 3 via the RE-pushed dec
    expect((await c0Sc.getState()).counter).toBe(5n);
  });
});
