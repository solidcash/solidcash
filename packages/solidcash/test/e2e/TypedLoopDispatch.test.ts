import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';
import { standInToken, standInVoidRecord, trivialCallee } from '../trivial-callee.js';

// Typed per-iteration external dispatch over a PARAM array: `IFoo(targets[i]).m(x)` in a loop. The covenant
// co-spends each targets[i] at input base+i and verifies its master UTXO bytecode == targets[i] (identity) +
// input==output preservation, and reads each target's void record, `digest || 01`, at the return base plus i: the
// digest of m, the reader (the caller's input) and x. Sound by the same caller-permissive argument as Multicall2: the
// caller chooses targets and co-spends them; a mismatching claim is rejected by the identity binding. This is the
// codegen Router02's swap loop reuses once its computed pairFor target is rewritten to a witness array element.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
    function run(address[] targets, int x) {
        for (uint i = 0; i < targets.length; i++) { IFoo(targets[i]).m(x); }
    }
}
interface IFoo { function m(int x) external; }`;

const OP_TRUE = hexToBin('51');
// Each co-spent target runs `m(7)`, a stand-in that settles no record: the spend lays out the record m(7) would.
const CALLEE = trivialCallee([7n]);
const M = hexToBin(compileString(`pragma solidcash >=0.8.0;
  contract D() { bigint c; function m(int x) { this.c = this.c + x; } function n() { this.c = this.c + 1; } }`)
  .abi.find((entry) => entry.name === 'm')!.selector!);

/** The loop over `targetsArg`, each target recorded as running m on `ran[i]`. */
async function buildTypedLoopTx(targetsArg: Uint8Array[], callee = CALLEE, ran = [7n, 7n]): Promise<TransactionBuilder> {
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

  // output 0: preserved caller; outputs 1,2: preserved targets; output 3: change; outputs 4,5: the records
  tb.addOutput({ to: contract.address, amount: 100000n });
  tb.addOutput({ to: CALLEE.lock, amount: 1500n, token: standInToken() });
  tb.addOutput({ to: callee.lock, amount: 1500n, token: standInToken() });
  tb.addOutput({ to: OP_TRUE, amount: 5000n });
  for (const x of ran) tb.addOutput(standInVoidRecord(M, [x]));
  return tb;
}

describe('typed per-iteration external dispatch over a param array (IFoo(targets[i]).m(x))', () => {
  it('co-spends N witness targets + verifies identity and each void record', async () => {
    const tb = await buildTypedLoopTx([CALLEE.lock, CALLEE.lock]);
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });

  it('rejects a co-spent input whose bytecode != the claimed target[i] (identity binding)', async () => {
    const wrong = hexToBin('5152'); // OP_1 OP_2 - not the co-spent callee
    const tb = await buildTypedLoopTx([wrong, CALLEE.lock]);
    expect(() => verifyTransaction(tb)).toThrow();
  });

  it('rejects a co-spent target that runs m on another argument than the loop passes', async () => {
    // The second target runs m(8) where the caller calls m(7), so its record digests 8; its lock is the same stand-in.
    const tb = await buildTypedLoopTx([CALLEE.lock, CALLEE.lock], trivialCallee([8n]), [7n, 8n]);
    expect(() => verifyTransaction(tb)).toThrow();
  });
});
