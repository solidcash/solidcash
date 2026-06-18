import { run } from './vm.mjs';
import { keccakF } from './keccak.mjs';
import { genKeccakF, be } from './gen.mjs';

const rnd = () => { let v=0n; for (let i=0;i<8;i++) v=(v<<8n)|BigInt(Math.floor(Math.random()*256)); return v; };
const A = Array.from({ length: 25 }, rnd);
const blobHex = A.map(be).join('');
const rounds = Number(process.argv[2] || 1);
const padBytes = Number(process.argv[3] || (rounds * 260 + 400));
const pad = '00'.repeat(padBytes);
const script = 'OP_NIP ' + genKeccakF(rounds);                 // OP_NIP drops the budget-pad
const res = run(`<0x${pad}> <0x${blobHex}>`, script);
const got = res.stack[res.stack.length - 1];
const exp = keccakF(A.slice(), rounds).map(be).join('');
console.log(`rounds=${rounds} pad=${padBytes}B: error =`, res.error || 'none');
console.log('stack items:', res.stack.length, ' top bytes:', got ? got.length/2 : 0, ' match:', got === exp);
if (got !== exp && got && got.length === 400) {
  for (let i=0;i<25;i++){ const g=got.slice(i*16,i*16+16), x=exp.slice(i*16,i*16+16); if (g!==x) console.log(`lane ${i}: got ${g} exp ${x}`); }
}
