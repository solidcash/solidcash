// N sequential keccak256(msg) in ONE input on the BCH-2026 VM. Each hash is OP_EQUALVERIFY'd against
// its expected value (mirrors the commitment-check the side-car covenant would do) so the script ends
// clean -> unambiguous within-budget pass/fail. Pad in the SAME input's unlocking drives the op budget.
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { asm, binToHex } from './vm.mjs';
import { genRoundDefine, genKeccak256varBody } from './genvar.mjs';
import { keccak_256 } from '@noble/hashes/sha3';

const vm = createVirtualMachineBch2026();
const aTo = (s) => binToHex(asm(s));
const evm = (h) => Buffer.from(keccak_256(Buffer.from(h, 'hex'))).toString('hex');

// n hashes of msgLen-byte messages; verify each against expected; end with OP_1.
function locking(n, msgLen) {
  let s = genRoundDefine(aTo);
  const body = genKeccak256varBody();
  for (let i = 0; i < n; i++) {
    const m = String(i + 1).padStart(2, '0').repeat(msgLen);
    s += ` <0x${m}> ${body} <0x${evm(m)}> OP_EQUALVERIFY`;
  }
  return s + ' OP_1';
}

function evalN(n, msgLen, padBytes) {
  const lock = asm("OP_DROP " + locking(n, msgLen));
  const unlock = asm(`<0x${"00".repeat(padBytes)}>`);
  const tx = { version: 2, locktime: 0,
    inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: unlock }],
    outputs: [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }] };
  const st = vm.evaluate({ inputIndex: 0, sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: 1000n }], transaction: tx });
  return { err: st.error && String(st.error).slice(0, 50), op: st.metrics.operationCost, lockLen: lock.length, unlockLen: unlock.length };
}
const budget = (u) => 41 + 800 * u;

console.log('== 1-block (32B) messages, pad to near max unlocking ==');
console.log('N  msgB  padB   op(cost)   budget    head%   ok');
for (const [n, ml, pad] of [[1,32,9700],[2,32,9700],[3,32,9700],[4,32,9700]]) {
  const r = evalN(n, ml, pad), b = budget(r.unlockLen), head = (((b-r.op)/b)*100).toFixed(1);
  console.log(`${n}  ${String(ml).padStart(4)}  ${String(pad).padStart(4)}  ${String(r.op).padStart(9)}  ${String(b).padStart(8)}  ${head.padStart(6)}  ${r.err?('FAIL '+r.err):'PASS'}`);
}
console.log('\n== per-block scaling: 1 hash at increasing message size (blocks) ==');
console.log('msgB  ~blocks  op(cost)   ok');
for (const ml of [32, 135, 136, 200, 300]) {
  const r = evalN(1, ml, 9700);
  const blocks = Math.ceil((ml + 1) / 136);
  console.log(`${String(ml).padStart(4)}  ${String(blocks).padStart(7)}  ${String(r.op).padStart(9)}  ${r.err?('FAIL '+r.err):'PASS'}`);
}
