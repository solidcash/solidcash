// Function-pointer ARRAY dispatch tables: fixed-method, state-selected, varying-method, received-value;
// broadcast (loop spelling) + Solidity single-element call semantics.
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

const WRONG_DISPATCH_PREFLIGHT = /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;

describe('fixed-method table', () => {
  // A permissionless callee (no checkSig) so it can be co-spent by the table covenant.
  const COUNTER = `pragma solidcash >=0.8.0;
  interface ICounter { public bigint counter; function increment(uint256 v); }
  contract Counter() is ICounter {
    bigint counter;
    function increment(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
  }`;

  // A DISPATCH TABLE of foreign fn-ptrs (fixed method increment, varying address). The fn-ptr array lowers to a
  // plain `address[]` + the shipped array-element co-spend `ICounter(fns[i]).increment(..)`, which BROADCASTS:
  // the covenant co-spends + verifies + calls the method on EVERY registered callee (the notify-subscribers model).
  const TABLE = `pragma solidcash >=0.8.0;
  interface ICounter { public bigint counter; function increment(uint256 v); }
  contract Table() {
    function(uint256) external[] fns;
    bigint bumps;
    function register(address a, pubkey pk, sig s) {
      require(checkSig(s, pk)); this.fns.push(ICounter(a).increment); this.bumps = this.bumps + 1;
    }
    function fireAll(uint256 v, pubkey pk, sig s) {
      require(checkSig(s, pk)); for (int i = 0; i < 2; i++) { fns[i](v); } this.bumps = this.bumps + 1;
    }
  }`;

  describe('foreign fn-ptr ARRAY dispatch table (fixed method on runtime addresses)', () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    it('builds the table via push then co-spends every callee through fns[i]()', async () => {
      const ca = compileString(COUNTER); const ta = compileString(TABLE);

      const c0 = new Contract(ca, [], { provider });
      const { categoryId: cc0 } = await setupStatefulUtxos(
        provider, c0, ca.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const c0Addr = c0.withCategory(hexToBin(cc0)).lockingBytecode;
      const c1 = new Contract(ca, [], { provider });
      const { categoryId: cc1 } = await setupStatefulUtxos(
        provider, c1, ca.stateLayout!, { counter: 20n }, { saltContract: true },
      );
      const c1Addr = c1.withCategory(hexToBin(cc1)).lockingBytecode;

      const table = new Contract(ta, [], { provider });
      const { categoryId: tc } = await setupStatefulUtxos(
        provider, table, ta.stateLayout!, { fns: [], bumps: 0n }, { saltContract: true },
      );
      const tableSc = StatefulContract.withCategory(table, tc);
      const c0Sc = StatefulContract.withCategory(c0, cc0);
      const c1Sc = StatefulContract.withCategory(c1, cc1);

      await tableSc.register(hexToBin(c0Addr), alicePub, sig()).send();
      await tableSc.register(hexToBin(c1Addr), alicePub, sig()).send();

      tableSc.registerExternalArray('ICounter', [c0Sc, c1Sc]);
      const tx = await tableSc.fireAll(3n, alicePub, sig()).send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      // The array call broadcasts: EVERY registered callee is co-spent + increment(3) is called on each.
      expect((await c0Sc.getState()).counter).toBe(8n);   // 5 + 3
      expect((await c1Sc.getState()).counter).toBe(23n);  // 20 + 3
    });
  });
});

describe('state-selected method', () => {
  // Two callable methods on the callee (same signature) - a foreign dispatch chooses between them at runtime.
  const CALLEE = `pragma solidcash >=0.8.0;
  interface IHandler { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
  contract Handler() is IHandler {
    bigint counter;
    function inc(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter + 1; }
    function dec(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter - 1; }
  }`;

  // A FOREIGN function pointer whose ADDRESS is a state var and whose METHOD is chosen by a state var - a
  // dispatch table. Compiles via the same-address varying-method (runtime selector) machinery; the covenant
  // co-spends the callee at the state address and binds the co-spent method to the state discriminant.
  const CALLER = `pragma solidcash >=0.8.0;
  interface IHandler { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
  contract Caller() {
    address handler;
    bool useInc;
    function run(pubkey pk, sig s) {
      function(pubkey, sig) external f = useInc ? IHandler(handler).inc : IHandler(handler).dec;
      f(pk, s);
    }
  }`;

  describe('foreign function-pointer dispatch table (state address + state-selected method)', () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    const run = async (useInc: boolean, method: 'inc' | 'dec', expected: bigint): Promise<void> => {
      const calleeArt = compileString(CALLEE);
      const callerArt = compileString(CALLER);

      const callee = new Contract(calleeArt, [], { provider });
      const { categoryId: calleeCat } = await setupStatefulUtxos(
        provider, callee, calleeArt.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const calleeAddr = callee.withCategory(hexToBin(calleeCat)).lockingBytecode;

      const caller = new Contract(callerArt, [], { provider });
      const { categoryId: callerCat } = await setupStatefulUtxos(
        provider, caller, callerArt.stateLayout!, { handler: hexToBin(calleeAddr), useInc }, { saltContract: true },
      );

      const callerSc = StatefulContract.withCategory(caller, callerCat);
      const calleeSc = StatefulContract.withCategory(callee, calleeCat);

      const tx = await callerSc.run(alicePub, sig())
        .withExternalCall(calleeSc, method, [alicePub, sig()])
        .send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await calleeSc.getState()).counter).toBe(expected);
    };

    it('dispatches inc when the discriminant selects it (5 -> 6)', async () => {
      await run(true, 'inc', 6n);
    });

    it('dispatches dec when the discriminant selects it (5 -> 4)', async () => {
      await run(false, 'dec', 4n);
    });
  });
});

describe('varying-method table', () => {
  // A permissionless callee (no checkSig) so the table covenant can co-spend it.
  const HANDLER = `pragma solidcash >=0.8.0;
  interface IH { public bigint counter; function inc(uint256 v); function dec(uint256 v); }
  contract Handler() is IH {
    bigint counter;
    function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
    function dec(uint256 v) { this.counter = this.counter - int(v); require(int(v) >= 0); }
  }`;

  // Varying-method table: address[] + parallel __fnsel_ selector array; the broadcast verifies each
  // co-spent callee's method against its own on-chain selector.
  const TABLE = `pragma solidcash >=0.8.0;
  interface IH { public bigint counter; function inc(uint256 v); function dec(uint256 v); }
  contract Table() {
    function(uint256) external[] fns;
    bigint bumps;
    function registerInc(address a, pubkey pk, sig s) {
      require(checkSig(s, pk)); this.fns.push(IH(a).inc); this.bumps = this.bumps + 1;
    }
    function registerDec(address a, pubkey pk, sig s) {
      require(checkSig(s, pk)); this.fns.push(IH(a).dec); this.bumps = this.bumps + 1;
    }
    function fireAll(uint256 v, pubkey pk, sig s) {
      require(checkSig(s, pk)); for (int i = 0; i < 2; i++) { fns[i](v); } this.bumps = this.bumps + 1;
    }
  }`;

  describe('foreign fn-ptr ARRAY dispatch table (varying method per element)', () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
    const ha = compileString(HANDLER);
    const ta = compileString(TABLE);

    const deployHandler = async (counter: bigint): Promise<{ sc: any; addr: Uint8Array }> => {
      const c = new Contract(ha, [], { provider });
      const { categoryId } = await setupStatefulUtxos(provider, c, ha.stateLayout!, { counter }, { saltContract: true });
      return {
        sc: StatefulContract.withCategory(c, categoryId),
        addr: c.withCategory(hexToBin(categoryId)).lockingBytecode,
      };
    };

    it('co-spends every callee with its OWN registered method (inc vs dec)', async () => {
      const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
      const { sc: c1Sc, addr: c1Addr } = await deployHandler(20n);

      const table = new Contract(ta, [], { provider });
      const { categoryId: tc } = await setupStatefulUtxos(
        provider, table, ta.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
      );
      const tableSc = StatefulContract.withCategory(table, tc);

      await tableSc.registerInc(hexToBin(c0Addr), alicePub, sig()).send();  // fns[0] = (c0, inc)
      await tableSc.registerDec(hexToBin(c1Addr), alicePub, sig()).send();  // fns[1] = (c1, dec)

      tableSc.registerExternalArray('IH', [c0Sc, c1Sc], ['inc', 'dec']);
      const tx = await tableSc.fireAll(3n, alicePub, sig()).send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });

      // Broadcast: c0's OWN method inc(3) -> 5 + 3; c1's OWN method dec(3) -> 20 - 3.
      expect((await c0Sc.getState()).counter).toBe(8n);
      expect((await c1Sc.getState()).counter).toBe(17n);
    });

    it('rejects co-spending an element with the WRONG method (covenant binds each to its on-chain selector)', async () => {
      const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
      const table = new Contract(ta, [], { provider });
      const { categoryId: tc } = await setupStatefulUtxos(
        provider, table, ta.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
      );
      const tableSc = StatefulContract.withCategory(table, tc);
      await tableSc.registerInc(hexToBin(c0Addr), alicePub, sig()).send();  // fns[0] pushed as (c0, inc)

      // Provision c0 with dec (wrong): the on-chain selector for element 0 is inc's, so the co-spent dec method
      // fails the covenant's per-element selector check.
      tableSc.registerExternalArray('IH', [c0Sc], ['dec']);
      await expect(tableSc.fireAll(3n, alicePub, sig()).send()).rejects.toThrow(WRONG_DISPATCH_PREFLIGHT);
    });
  });
});

describe('received-value table', () => {
  const HANDLER = `pragma solidcash >=0.8.0;
  interface IH { public bigint counter; function inc(uint256 v); function dec(uint256 v); }
  contract Handler() is IH {
    bigint counter;
    function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
    function dec(uint256 v) { this.counter = this.counter - int(v); require(int(v) >= 0); }
  }`;

  // Received-value table: (address, selector) carried in the pushed VALUE. The loop reads each callee's
  // master input index from the extcallIdxList witness (identity-bound, strictly increasing) - spans
  // stateful callees no compile-time stride could.
  const TABLE = `pragma solidcash >=0.8.0;
  contract Table() {
    function(uint256) external[] fns;
    bigint bumps;
    function reg(function(uint256) external p, pubkey pk, sig s) {
      require(checkSig(s, pk)); this.fns.push(p); this.bumps = this.bumps + 1;
    }
    function fire(uint256 v, pubkey pk, sig s) {
      require(checkSig(s, pk)); for (int i = 0; i < 2; i++) { fns[i](v); } this.bumps = this.bumps + 1;
    }
  }`;

  describe('foreign RECEIVED-value fn-ptr array dispatch table', () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
    const ha = compileString(HANDLER);
    const ta = compileString(TABLE);
    const incSel = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);
    const decSel = hexToBin(ha.abi.find((f) => f.name === 'dec')!.selector!);
    const fnPtrIface = ta.abi.find((f) => f.name === 'fire')!.externalCalls![0].interfaceName;

    const deployHandler = async (counter: bigint): Promise<{ sc: any; addr: Uint8Array }> => {
      const c = new Contract(ha, [], { provider });
      const { categoryId } = await setupStatefulUtxos(provider, c, ha.stateLayout!, { counter }, { saltContract: true });
      return {
        sc: StatefulContract.withCategory(c, categoryId),
        addr: c.withCategory(hexToBin(categoryId)).lockingBytecode,
      };
    };

    const deployTable = async (): Promise<any> => {
      const table = new Contract(ta, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, table, ta.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
      );
      return StatefulContract.withCategory(table, categoryId);
    };

    it('dispatches each received pointer to its OWN method (inc vs dec, stateful callees)', async () => {
      const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
      const { sc: c1Sc, addr: c1Addr } = await deployHandler(20n);
      const tableSc = await deployTable();

      // Pass a fn-ptr VALUE (address + selector) to reg; the method rides in the value, not the push site.
      await tableSc.reg(hexToBin(c0Addr), incSel, alicePub, sig()).send();
      await tableSc.reg(hexToBin(c1Addr), decSel, alicePub, sig()).send();

      tableSc.registerExternalArray(fnPtrIface, [c0Sc, c1Sc], ['inc', 'dec']);
      const tx = await tableSc.fire(3n, alicePub, sig()).send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });

      expect((await c0Sc.getState()).counter).toBe(8n);   // c0.inc(3): 5 + 3
      expect((await c1Sc.getState()).counter).toBe(17n);  // c1.dec(3): 20 - 3
    });

    it('dispatches HETEROGENEOUS callees (different data-NFT counts - impossible for any fixed stride)', async () => {
      // A fat-state callee: counter + two bytes70 pads exceed one 128-byte commitment -> 2+ data NFTs, so its
      // co-spend group is wider than Handler's (master + 1). Only per-element witness indices can span both.
      const FAT = `pragma solidcash >=0.8.0;
      contract FatHandler() {
        bigint counter;
        bytes70 pad1;
        bytes70 pad2;
        function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
      }`;
      const fa = compileString(FAT);
      const fatDataNfts = fa.stateLayout!.variables.reduce((m, v) => Math.max(m, v.nftIndex ?? 0), 0) + 1;
      expect(fatDataNfts).toBeGreaterThan(1); // must actually be wider than Handler (else the test proves nothing)

      const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
      const fat = new Contract(fa, [], { provider });
      const { categoryId: fc } = await setupStatefulUtxos(
        provider, fat, fa.stateLayout!,
        { counter: 100n, pad1: new Uint8Array(70), pad2: new Uint8Array(70) }, { saltContract: true },
      );
      const fatSc = StatefulContract.withCategory(fat, fc);
      const fatAddr = fat.withCategory(hexToBin(fc)).lockingBytecode;
      const tableSc = await deployTable();

      await tableSc.reg(hexToBin(c0Addr), incSel, alicePub, sig()).send();
      await tableSc.reg(hexToBin(fatAddr), hexToBin(fa.abi.find((f) => f.name === 'inc')!.selector!), alicePub, sig()).send();

      tableSc.registerExternalArray(fnPtrIface, [c0Sc, fatSc], ['inc', 'inc']);
      const tx = await tableSc.fire(7n, alicePub, sig()).send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });

      expect((await c0Sc.getState()).counter).toBe(12n);    // 5 + 7
      expect((await fatSc.getState()).counter).toBe(107n);  // 100 + 7
    });

    it('rejects provisioning an element with the WRONG method (per-element on-chain selector binding)', async () => {
      const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
      const tableSc = await deployTable();
      await tableSc.reg(hexToBin(c0Addr), incSel, alicePub, sig()).send();  // fns[0] carries inc's selector

      tableSc.registerExternalArray(fnPtrIface, [c0Sc], ['dec']);
      await expect(tableSc.fire(3n, alicePub, sig()).send()).rejects.toThrow(WRONG_DISPATCH_PREFLIGHT);
    });
  });
});

describe('single-element calls', () => {
  // Solidity semantics: bare fns[idx](v) calls ONLY element idx; broadcast = the loop spelling. Covers all
  // table kinds, returning calls, mutation lockstep, mixed and state-var-pushed tables.
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
      return {
        sc: StatefulContract.withCategory(c, categoryId),
        addr: c.withCategory(hexToBin(categoryId)).lockingBytecode,
      };
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

      const settled = await tableSc.fire(1n, 3n, alicePub, sig()).withExternalCall(c1Sc, 'inc', [3n]).send();
      expect(settled).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
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

      const settled = await tableSc.fire(1n, 3n, alicePub, sig()).withExternalCall(c1Sc, 'dec', [3n]).send();
      expect(settled).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await c0Sc.getState()).counter).toBe(5n);   // untouched
      expect((await c1Sc.getState()).counter).toBe(17n);  // element 1's OWN method (dec)

      // Element 0 carries inc's selector: co-spending dec against it must fail (runtime selector binding).
      await expect(tableSc.fire(0n, 3n, alicePub, sig()).withExternalCall(c0Sc, 'dec', [3n]).send())
        .rejects.toThrow(WRONG_DISPATCH_PREFLIGHT);
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

      const settled = await tableSc.fire(0n, 2n, alicePub, sig()).withExternalCall(rhSc, 'inc', [2n]).send();
      expect(settled).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
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

      const settled = await tableSc.fire(0n, 4n, alicePub, sig()).withExternalCall(c1Sc, 'dec', [4n]).send();
      expect(settled).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await c1Sc.getState()).counter).toBe(16n);  // 20 - 4: new address AND new selector
      expect((await c0Sc.getState()).counter).toBe(5n);   // old target untouched

      // The old (address, selector) pair must no longer verify.
      await expect(tableSc.fire(0n, 4n, alicePub, sig()).withExternalCall(c0Sc, 'inc', [4n]).send())
        .rejects.toThrow(WRONG_DISPATCH_PREFLIGHT);
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

      const incResult = await tableSc.fire(0n, 3n, alicePub, sig()).withExternalCall(c0Sc, 'inc', [3n]).send();
      expect(incResult).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await c0Sc.getState()).counter).toBe(8n);
      const decResult = await tableSc.fire(1n, 3n, alicePub, sig()).withExternalCall(c1Sc, 'dec', [3n]).send();
      expect(decResult).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
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
      const settled = await tableSc.fire(1n, 3n, alicePub, sig()).withExternalCall(c1Sc, 'dec', [3n]).send();
      expect(settled).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await c1Sc.getState()).counter).toBe(17n);  // 20 - 3 via the RE-pushed dec
      expect((await c0Sc.getState()).counter).toBe(5n);
    });
  });
});
