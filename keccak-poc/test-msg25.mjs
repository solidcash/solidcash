import { run, asm, binToHex } from './vm.mjs';
import { genKeccak256x32v2 } from './gen25.mjs';
import createKeccak from 'keccak';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
const evm = (h) => createKeccak('keccak256').update(Buffer.from(h,'hex')).digest('hex');
const script = 'OP_NIP ' + genKeccak256x32v2((s)=>binToHex(asm(s)));
console.log('full keccak256 locking size:', asm(script).length, 'bytes');
let all = true;
for (const msg of ['00'.repeat(32),'11'.repeat(32),'deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718']) {
  const res = run(`<0x${'00'.repeat(3500)}> <0x${msg}>`, script);
  const ok = res.stack[res.stack.length-1] === evm(msg);
  all = all && ok; console.log(`msg ${msg.slice(0,12)}..: ${ok?'MATCH':'FAIL '+(res.error||'')}`);
}
console.log('ALL MATCH:', all);
const vm=createVirtualMachineBch2026();
const tx={version:2,locktime:0,inputs:[{outpointIndex:0,outpointTransactionHash:new Uint8Array(32),sequenceNumber:0xffffffff,unlockingBytecode:asm('<0x'+'00'.repeat(3500)+'> <0x'+'11'.repeat(32)+'>')}],outputs:[{lockingBytecode:new Uint8Array(0),valueSatoshis:1000n}]};
const st=vm.evaluate({inputIndex:0,sourceOutputs:[{lockingBytecode:asm(script),valueSatoshis:1000n}],transaction:tx});
console.log('full keccak256 metrics:', JSON.stringify({opCost:st.metrics.operationCost,instrs:st.metrics.evaluatedInstructionCount,pushedBytes:st.metrics.stackPushedBytes}));
