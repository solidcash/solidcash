// Cost of reading another input's unlocking bytecode (OP_INPUTBYTECODE) + splitting a preimage prefix
// off the front and verifying it. This is what the CONTRACT input pays to bind preimage<->hash in the
// proposed model. Measured against the contract's own multi-million budget.
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { asm, binToHex } from './vm.mjs';
const vm = createVirtualMachineBch2026();

function measure(unlockBytes, lockingAsm) {
  const unlock = asm(`<0x${'00'.repeat(unlockBytes)}>`);
  const lock = asm(lockingAsm);
  const tx = { version: 2, locktime: 0,
    inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: unlock }],
    outputs: [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }] };
  const st = vm.evaluate({ inputIndex: 0, sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: 1000n }], transaction: tx });
  return { err: st.error && String(st.error).slice(0,45), op: st.metrics.operationCost };
}
const budgetAt = (u) => 41 + 800 * (u + 2); // +2 for the pushdata2 prefix bytes of the unlock

// Baseline: just drop the pad (OP_DROP), no introspection.
// Read: pull input-0 unlocking, split first 34 bytes (a pushdata-wrapped 32B preimage), verify prefix, drop rest.
for (const u of [420, 3000, 9700]) {
  const base = measure(u, 'OP_DROP OP_1');
  const read = measure(u, 'OP_DROP OP_0 OP_INPUTBYTECODE <34> OP_SPLIT OP_DROP OP_HASH256 OP_DROP OP_1');
  console.log(`unlk ${String(u).padStart(5)}B  budget ~${String(budgetAt(u)).padStart(8)}  baseOp ${String(base.op).padStart(6)}  readOp ${String(read.op).padStart(7)}  delta ${String(read.op-base.op).padStart(7)}  ${read.err||'ok'}`);
}
