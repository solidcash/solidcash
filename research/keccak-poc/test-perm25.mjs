import { run, asm, binToHex } from './vm.mjs';
import { keccakF } from './keccak.mjs';
import { genPermute25, be } from './gen25.mjs';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';

const rnd = () => { let v=0n; for (let i=0;i<8;i++) v=(v<<8n)|BigInt(Math.floor(Math.random()*256)); return v; };
const A = Array.from({ length: 25 }, rnd);
const exp = keccakF(A.slice(), 24);
// push lanes so lane0 ends on top: push lane24..lane0
const pushes = [];
for (let i = 24; i >= 0; i--) pushes.push(`<0x${be(A[i])}>`);
const pad = '00'.repeat(3200);
const script = genPermute25((s)=>binToHex(asm(s)));
const unlock = `<0x${pad}> ` + pushes.join(' ');
const res = run(unlock, script);
// top 25 stack items = lanes, lane0 on top (last). stack[last]=lane0.
const n = res.stack.length;
let match = true;
for (let i = 0; i < 25; i++) { const got = res.stack[n-1-i]; if (got !== be(exp[i])) { match=false; console.log(`lane ${i}: got ${got} exp ${be(exp[i])}`);} }
console.log('locking size:', asm(script).length, 'bytes; error:', res.error||'none', '; stack items:', n, '; MATCH:', match);

// measure op cost
const vm = createVirtualMachineBch2026();
const tx={version:2,locktime:0,inputs:[{outpointIndex:0,outpointTransactionHash:new Uint8Array(32),sequenceNumber:0xffffffff,unlockingBytecode:asm(unlock)}],outputs:[{lockingBytecode:new Uint8Array(0),valueSatoshis:1000n}]};
const st=vm.evaluate({inputIndex:0,sourceOutputs:[{lockingBytecode:asm(script),valueSatoshis:1000n}],transaction:tx});
console.log('metrics:', JSON.stringify({opCost:st.metrics.operationCost, instrs:st.metrics.evaluatedInstructionCount, pushedBytes:st.metrics.stackPushedBytes}));
