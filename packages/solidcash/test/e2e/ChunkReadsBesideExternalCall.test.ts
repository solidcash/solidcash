// Read-only dynamic-storage chunks co-spent beside external-call callees. Dense input placement keeps the
// caller's own block first, appends the callee blocks next, and the chunk run after them; every read-only
// chunk must come back at the output index its own covenant pins (output == input), and no callee output
// may be displaced by a chunk copy. One chunk used to land right by accident, two or more did not.
import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const COUNTER = `pragma solidcash >=0.8.0;
contract Counter() { bigint counter;
  function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); } }`;

const IC = 'interface IC { public bigint counter; function inc(uint256 v); }';

describe('read-only chunk runs beside external-call callees', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const counterArtifact = compileString(COUNTER);

  const deployCounter = async (counter: bigint): Promise<{ sc: any; addr: Uint8Array }> => {
    const contract = new Contract(counterArtifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, counterArtifact.stateLayout!, { counter }, { saltContract: true },
    );
    return {
      sc: StatefulContract.withCategory(contract, categoryId),
      addr: hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
    };
  };

  const deployCaller = async (src: string, init: Record<string, unknown>): Promise<any> => {
    const artifact = compileString(src);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, init, { saltContract: true },
    );
    return StatefulContract.withCategory(contract, categoryId);
  };

  it('one read-only array beside one external call', async () => {
    const { sc: counterSc, addr } = await deployCounter(5n);
    const caller = await deployCaller(`pragma solidcash >=0.8.0;\n${IC}
      contract T() { int[] a; address target; bigint last;
        function seed(pubkey pk, sig s) { require(checkSig(s, pk)); this.a.push(7); }
        function fire(uint256 v, pubkey pk, sig s) {
          require(checkSig(s, pk)); int x = a[0]; IC(target).inc(v); this.last = x + int(v); } }`,
    { a: [], target: addr, last: 0n });
    await caller.seed(alicePub, sig()).send();

    await caller.fire(3n, alicePub, sig()).withExternalCall(counterSc, 'inc', [3n]).send();
    expect((await counterSc.getState()).counter).toBe(8n);
    const state = await caller.getState();
    expect(state.last).toBe(10n);
    expect(state.a).toEqual([7n]);
  });

  it('two read-only arrays beside one external call', async () => {
    const { sc: counterSc, addr } = await deployCounter(5n);
    const caller = await deployCaller(`pragma solidcash >=0.8.0;\n${IC}
      contract T() { int[] a; int[] b; address target; bigint last;
        function seed(pubkey pk, sig s) { require(checkSig(s, pk)); this.a.push(7); this.b.push(9); }
        function fire(uint256 v, pubkey pk, sig s) {
          require(checkSig(s, pk)); int x = a[0]; int y = b[0]; IC(target).inc(v); this.last = x + y; } }`,
    { a: [], b: [], target: addr, last: 0n });
    await caller.seed(alicePub, sig()).send();

    await caller.fire(3n, alicePub, sig()).withExternalCall(counterSc, 'inc', [3n]).send();
    expect((await counterSc.getState()).counter).toBe(8n);
    const state = await caller.getState();
    expect(state.last).toBe(16n);
    expect(state.a).toEqual([7n]);
    expect(state.b).toEqual([9n]);

    // The chunks survived as live, spendable state: a second call reads them again.
    await caller.fire(4n, alicePub, sig()).withExternalCall(counterSc, 'inc', [4n]).send();
    expect((await counterSc.getState()).counter).toBe(12n);
    expect((await caller.getState()).last).toBe(16n);
  });

  it('three read-only arrays beside two external calls to different callees', async () => {
    const { sc: firstSc, addr: firstAddr } = await deployCounter(5n);
    const { sc: secondSc, addr: secondAddr } = await deployCounter(20n);
    const caller = await deployCaller(`pragma solidcash >=0.8.0;\n${IC}
      contract T() { int[] a; int[] b; int[] c; address first; address second; bigint last;
        function seed(pubkey pk, sig s) {
          require(checkSig(s, pk)); this.a.push(7); this.b.push(9); this.c.push(11); }
        function fire(uint256 v, pubkey pk, sig s) {
          require(checkSig(s, pk)); int x = a[0]; int y = b[0]; int z = c[0];
          IC(first).inc(v); IC(second).inc(v); this.last = x + y + z; } }`,
    { a: [], b: [], c: [], first: firstAddr, second: secondAddr, last: 0n });
    await caller.seed(alicePub, sig()).send();

    await caller.fire(2n, alicePub, sig())
      .withExternalCall(firstSc, 'inc', [2n])
      .withExternalCall(secondSc, 'inc', [2n])
      .send();
    expect((await firstSc.getState()).counter).toBe(7n);
    expect((await secondSc.getState()).counter).toBe(22n);
    const state = await caller.getState();
    expect(state.last).toBe(27n);
    expect(state.a).toEqual([7n]);
    expect(state.b).toEqual([9n]);
    expect(state.c).toEqual([11n]);
  });

  // A received-value pointer broadcast reads each callee's master input from its framed index list. The list is
  // planned from band widths; a caller block wider than master + data (here an event slot, funded by an input)
  // moves every callee block past that plan, so only the list rebound from the assembled frame names them.
  it('received fn-ptr broadcast from a block wider than its planned base, beside two read-only arrays', async () => {
    const handler = compileString(`pragma solidcash >=0.8.0;
      contract Handler() { bigint counter;
        function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
        function dec(uint256 v) { this.counter = this.counter - int(v); require(int(v) >= 0); } }`);
    const deployHandler = async (counter: bigint): Promise<{ sc: any; addr: Uint8Array }> => {
      const contract = new Contract(handler, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, contract, handler.stateLayout!, { counter }, { saltContract: true },
      );
      return {
        sc: StatefulContract.withCategory(contract, categoryId),
        addr: hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
      };
    };
    const selector = (name: string): Uint8Array => hexToBin(handler.abi.find((fn) => fn.name === name)!.selector!);
    const tableSource = `pragma solidcash >=0.8.0;
      contract Table() { event Fired(uint256 v);
        function(uint256) external[] fns; bigint bumps;
        function reg(function(uint256) external p, pubkey pk, sig s) {
          require(checkSig(s, pk)); this.fns.push(p); this.bumps = this.bumps + 1; }
        function fire(uint256 v, pubkey pk, sig s) {
          require(checkSig(s, pk)); for (int i = 0; i < 2; i++) { fns[i](v); } emit Fired(v);
          this.bumps = this.bumps + 1; } }`;
    const tableArtifact = compileString(tableSource);
    const fnPtrInterface = tableArtifact.abi.find((fn) => fn.name === 'fire')!.externalCalls![0].interfaceName;
    const table = await deployCaller(tableSource, { fns: [], __fnsel_fns: [], bumps: 0n });
    const { sc: firstSc, addr: firstAddr } = await deployHandler(5n);
    const { sc: secondSc, addr: secondAddr } = await deployHandler(20n);
    await table.reg(firstAddr, selector('inc'), alicePub, sig()).send();
    await table.reg(secondAddr, selector('dec'), alicePub, sig()).send();

    table.registerExternalArray(fnPtrInterface, [firstSc, secondSc], ['inc', 'dec']);
    await table.fire(3n, alicePub, sig()).send();
    expect((await firstSc.getState()).counter).toBe(8n);
    expect((await secondSc.getState()).counter).toBe(17n);
    expect((await table.getState()).bumps).toBe(3n);
  });
});
