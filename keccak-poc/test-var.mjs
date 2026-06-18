// Validate variable-length keccak256 vs EVM for many input lengths (pad edges + multi-block).
import createKeccak from 'keccak';
import { run, asm, binToHex } from './vm.mjs';
import { genKeccak256var } from './genvar.mjs';

const aTo = (s) => binToHex(asm(s));
const evm = (h) => createKeccak('keccak256').update(Buffer.from(h, 'hex')).digest('hex');
const script = genKeccak256var(aTo);

let fails = 0;
for (const L of [0, 1, 32, 100, 135, 136, 137, 200, 272, 300]) {
  const msg = 'ab'.repeat(L);                    // L bytes
  const exp = evm(msg);
  const nblocks = Math.floor(L / 136) + 1;
  const pad = '00'.repeat(3200 * nblocks);
  const msgPush = L === 0 ? 'OP_0' : `<0x${msg}>`;
  const res = run(`<0x${pad}> <0x${exp}> ${msgPush}`, `${script} OP_EQUAL OP_NIP`);
  const ok = res.ok && !res.error;
  if (!ok) fails++;
  console.log(`L=${String(L).padStart(3)} blocks=${nblocks}  ${ok ? 'OK' : 'FAIL'}  ${res.error ? '['+res.error.slice(0,48)+']' : 'stack='+res.stack}`);
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
