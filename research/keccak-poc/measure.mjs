// Measure keccak per-block op cost on the BCH-2026 VM (1-block = 32-byte msg, 2-block = 200-byte).
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { asm, binToHex } from './vm.mjs';
import { genKeccak256var } from './genvar.mjs';
const vm = createVirtualMachineBch2026();
const aTo = (s) => binToHex(asm(s));
const script = genKeccak256var(aTo);
function cost(msgLen) {
  const unlock = asm(`<0x${'00'.repeat(7000)}> <0x${'22'.repeat(msgLen)}>`);
  const lock = asm(`${script} OP_NIP`);
  const tx = { version:2, locktime:0, inputs:[{outpointIndex:0, outpointTransactionHash:new Uint8Array(32), sequenceNumber:0xffffffff, unlockingBytecode: unlock}], outputs:[{lockingBytecode:new Uint8Array(0), valueSatoshis:1000n}] };
  const st = vm.evaluate({ inputIndex:0, sourceOutputs:[{lockingBytecode:lock, valueSatoshis:1000n}], transaction:tx });
  return { err: st.error, op: st.metrics.operationCost, instr: st.metrics.evaluatedInstructionCount };
}
const b1 = cost(32), b2 = cost(200);
console.log('1-block(32B):', b1.op, 'instr', b1.instr, b1.err ? 'ERR '+b1.err.slice(0,40):'');
console.log('2-block(200B):', b2.op, 'instr', b2.instr, b2.err ? 'ERR '+b2.err.slice(0,40):'');
console.log('per-round op ~', Math.round((b2.op-b1.op)/24), 'per-round instr ~', Math.round((b2.instr-b1.instr)/24));
