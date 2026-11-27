import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';
import { standInToken, standInVoidRecord, trivialCallee } from '../trivial-callee.js';

// An array-element loop `IFoo(targets[i]).m(x)` over a parameter array is bound per iteration INLINE in the entry
// body (every reached targets[i] is co-spent and identity-checked), so a direct spend settles. The eleventh review
// found the removed message bus's route-only call-site guard over-firing on this shape, making an honest direct spend
// fail at the VM. Each iteration reads its target's void record at the record base plus its index, which the spends
// lay out for the stand-in targets (standInVoidRecord).
const SRC = `pragma solidcash >=0.8.0;
contract C() {
    function run(address[] targets, int x) {
        for (uint i = 0; i < targets.length; i++) { IFoo(targets[i]).m(x); }
    }
}
interface IFoo { function m(int x) external; }`;

const OP_TRUE = hexToBin('51');
const CALLEE = trivialCallee([7n]);
const M = hexToBin(compileString(`pragma solidcash >=0.8.0;
  contract D() { bigint c; function m(int x) { this.c = this.c + x; } function n() { this.c = this.c + 1; } }`)
  .abi.find((entry) => entry.name === 'm')!.selector!);

/** The loop's spend over `targetsArg`, each target's record naming the reader `readers[i]`. */
async function buildLoopTx(targetsArg: Uint8Array[], callee = CALLEE, readers = [0, 0]): Promise<TransactionBuilder> {
  const art = compileString(SRC);
  const provider = createTestProvider();
  const contract = new Contract(art, [], { provider });

  const contractUtxo = { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n };
  const t0 = { txid: '01'.repeat(32), vout: 0, satoshis: 1500n, token: standInToken() };
  const t1 = { txid: '02'.repeat(32), vout: 0, satoshis: 1500n, token: standInToken() };
  const targets = encodePushdataValue(targetsArg, 'address[]');
  const feeFunder = await createFeeFunder(provider, 10000n);

  // base=1 -> the two co-spent targets are inputs 1 and 2; their records are outputs 4 and 5
  const tb = new TransactionBuilder({ provider });
  tb.addInput(contractUtxo, contract.unlock.run(targets, 7n, 1n, 4n) as never);
  tb.addInput(t0, CALLEE.unlocker);
  tb.addInput(t1, callee.unlocker);
  tb.addInput(feeFunder.utxo, feeFunder.unlocker);

  tb.addOutput({ to: contract.address, amount: 100000n });
  tb.addOutput({ to: CALLEE.lock, amount: 1500n, token: standInToken() });
  tb.addOutput({ to: callee.lock, amount: 1500n, token: standInToken() });
  tb.addOutput({ to: OP_TRUE, amount: 5000n });
  for (const reader of readers) tb.addOutput(standInVoidRecord(M, [7n], reader));
  return tb;
}

describe('an array-element loop binds each target per iteration in the entry body', () => {
  it('co-spends N witness targets + every input passes the VM on an honest direct spend', async () => {
    const tb = await buildLoopTx([CALLEE.lock, CALLEE.lock]);
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });

  it('rejects a co-spent input whose bytecode != the claimed target[i] (identity bound per iteration)', async () => {
    const wrong = hexToBin('5152'); // OP_1 OP_2 - not the co-spent callee
    const tb = await buildLoopTx([wrong, CALLEE.lock]);
    expect(() => verifyTransaction(tb)).toThrow();
  });

  it('rejects a target whose record names another reader (one run answers one caller)', async () => {
    // The second target's run answered input 1, so this caller, at input 0, takes no record of it.
    const tb = await buildLoopTx([CALLEE.lock, CALLEE.lock], CALLEE, [0, 1]);
    expect(() => verifyTransaction(tb)).toThrow();
  });
});
