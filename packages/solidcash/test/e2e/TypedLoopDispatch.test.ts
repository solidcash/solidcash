import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';

// Typed per-iteration external dispatch over a PARAM array: `IFoo(targets[i]).m(x)` in a loop. The covenant
// co-spends each targets[i] at input base+i and verifies its master UTXO bytecode == targets[i] (identity) +
// input==output preservation. No opaque return-event (the call is void). Sound by the same caller-permissive
// argument as Multicall2: the caller chooses targets and co-spends them; a mismatching claim is rejected by the
// identity binding. This is the codegen Router02's swap loop reuses once its computed pairFor target is rewritten
// to a witness array element.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
    function run(address[] targets, int x) {
        for (uint i = 0; i < targets.length; i++) { IFoo(targets[i]).m(x); }
    }
}
interface IFoo { function m(int x) external; }`;

const OP_TRUE = hexToBin('51');

async function buildTypedLoopTx(targetsArg: Uint8Array[]): Promise<TransactionBuilder> {
  const art = compileString(SRC);
  const provider = createTestProvider();
  const contract = new Contract(art, [], { provider });

  const contractUtxo = { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n };
  const t0 = { txid: '01'.repeat(32), vout: 0, satoshis: 1500n };
  const t1 = { txid: '02'.repeat(32), vout: 0, satoshis: 1500n };
  const targets = encodePushdataValue(targetsArg, 'address[]');
  const feeFunder = await createFeeFunder(provider, 10000n);

  const trueUnlocker = {
    generateLockingBytecode: (): Uint8Array => OP_TRUE,
    generateUnlockingBytecode: (): Uint8Array => new Uint8Array([]),
  };

  // base=1 -> the two co-spent targets are inputs 1 and 2
  const tb = new TransactionBuilder({ provider });
  tb.addInput(contractUtxo, contract.unlock.run(targets, 7n, 1n) as never);
  tb.addInput(t0, trueUnlocker as never);
  tb.addInput(t1, trueUnlocker as never);
  tb.addInput(feeFunder.utxo, feeFunder.unlocker);

  // output 0: preserved caller; outputs 1,2: preserved targets; output 3: change
  tb.addOutput({ to: contract.address, amount: 100000n });
  tb.addOutput({ to: OP_TRUE, amount: 1500n });
  tb.addOutput({ to: OP_TRUE, amount: 1500n });
  tb.addOutput({ to: OP_TRUE, amount: 7000n });
  return tb;
}

describe('typed per-iteration external dispatch over a param array (IFoo(targets[i]).m(x))', () => {
  it('co-spends N witness targets + verifies identity (no return-event, typed void)', async () => {
    const tb = await buildTypedLoopTx([OP_TRUE, OP_TRUE]);
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });

  it('rejects a co-spent input whose bytecode != the claimed target[i] (identity binding)', async () => {
    const wrong = hexToBin('5152'); // OP_1 OP_2 - not the co-spent OP_TRUE input
    const tb = await buildTypedLoopTx([wrong, OP_TRUE]);
    expect(() => verifyTransaction(tb)).toThrow();
  });
});
