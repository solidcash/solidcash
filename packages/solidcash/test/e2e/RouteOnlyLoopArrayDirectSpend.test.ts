import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';
import { trivialCallee } from '../trivial-callee.js';

// A message-bus build only route-binds a looped call to a FIXED target (the route re-derives it row by row and the
// entry body carries a fail-closed guard). An array-element loop `IFoo(targets[i]).m(x)` over a parameter array is
// bound per row INLINE in the entry body instead (every reached targets[i] is co-spent and identity-checked), so it
// must carry NO such guard and a direct spend must settle. The eleventh review found the call-site guard over-firing
// on this shape, making an honest direct spend fail at the VM. The guard is now excluded for loopArrayVar slots, so a
// bus build of this shape is byte-identical to the direct build and the direct spend passes as it does there.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
    function run(address[] targets, int x) {
        for (uint i = 0; i < targets.length; i++) { IFoo(targets[i]).m(x); }
    }
}
interface IFoo { function m(int x) external; }`;

const OP_TRUE = hexToBin('51');
const CALLEE = trivialCallee([7n]);
const hex = (bytecode: unknown): string => (typeof bytecode === 'string' ? bytecode
  : Buffer.from(bytecode as Uint8Array).toString('hex'));

async function buildBusLoopTx(targetsArg: Uint8Array[], callee = CALLEE): Promise<TransactionBuilder> {
  const art = compileString(SRC, { messageBus: true });
  const provider = createTestProvider();
  const contract = new Contract(art, [], { provider });

  const contractUtxo = { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n };
  const t0 = { txid: '01'.repeat(32), vout: 0, satoshis: 1500n };
  const t1 = { txid: '02'.repeat(32), vout: 0, satoshis: 1500n };
  const targets = encodePushdataValue(targetsArg, 'address[]');
  const feeFunder = await createFeeFunder(provider, 10000n);

  // base=1 -> the two co-spent targets are inputs 1 and 2
  const tb = new TransactionBuilder({ provider });
  tb.addInput(contractUtxo, contract.unlock.run(targets, 7n, 1n) as never);
  tb.addInput(t0, CALLEE.unlocker);
  tb.addInput(t1, callee.unlocker);
  tb.addInput(feeFunder.utxo, feeFunder.unlocker);

  tb.addOutput({ to: contract.address, amount: 100000n });
  tb.addOutput({ to: CALLEE.lock, amount: 1500n });
  tb.addOutput({ to: callee.lock, amount: 1500n });
  tb.addOutput({ to: OP_TRUE, amount: 7000n });
  return tb;
}

describe('a bus-build array-element loop binds per row with no route-only guard', () => {
  it('compiles the bus build without the spurious guard', () => {
    const bus = compileString(SRC, { messageBus: true });
    const direct = compileString(SRC, { messageBus: false });
    expect(bus.abi.find((entry) => entry.name === 'run')?.routeOnly).toBeUndefined();
    // The two builds are no longer byte-identical: the direct build reads each iteration's void record at its record
    // base, so one callee run answers one caller, and an explicit message-bus build does not read them yet.
    const inputs = (artifact: typeof bus): string[] => artifact.abi.find((entry) => entry.name === 'run')!.inputs
      .map((input) => input.name);
    expect(inputs(direct)).toContain('__internal__externalReturnOutputIdx');
    expect(inputs(bus)).not.toContain('__internal__externalReturnOutputIdx');
    expect(hex(bus.bytecode)).not.toBe(hex(direct.bytecode));
  });

  it('co-spends N witness targets + every input passes the VM on an honest direct spend', async () => {
    const tb = await buildBusLoopTx([CALLEE.lock, CALLEE.lock]);
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });

  it('rejects a co-spent input whose bytecode != the claimed target[i] (per-row identity binding is live)', async () => {
    const wrong = hexToBin('5152'); // OP_1 OP_2 - not the co-spent callee
    const tb = await buildBusLoopTx([wrong, CALLEE.lock]);
    expect(() => verifyTransaction(tb)).toThrow();
  });
});
