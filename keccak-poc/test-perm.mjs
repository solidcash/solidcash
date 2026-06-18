import { run, asm, binToHex } from './vm.mjs';
import { keccakF } from './keccak.mjs';
import { genKeccakFDefined, be } from './gen.mjs';

const asmToHex = (s) => binToHex(asm(s));
const rnd = () => { let v=0n; for (let i=0;i<8;i++) v=(v<<8n)|BigInt(Math.floor(Math.random()*256)); return v; };
const A = Array.from({ length: 25 }, rnd);
const blobHex = A.map(be).join('');
const exp = keccakF(A.slice(), 24).map(be).join('');

const inner = genKeccakFDefined(asmToHex, 24);
const script = 'OP_NIP ' + inner;
const lockBytes = asm(script).length;
console.log('locking bytecode size:', lockBytes, 'bytes (limit 10000)');

const pad = '00'.repeat(8000);                                  // budget padding (dropped by OP_NIP)
const res = run(`<0x${pad}> <0x${blobHex}>`, script);
const got = res.stack[res.stack.length - 1];
console.log('24-round permutation: error =', res.error || 'none');
console.log('stack items:', res.stack.length, ' top bytes:', got ? got.length/2 : 0, ' match:', got === exp);
if (got !== exp && got && got.length===400) for (let i=0;i<25;i++){const g=got.slice(i*16,i*16+16),x=exp.slice(i*16,i*16+16); if(g!==x)console.log('lane',i,'got',g,'exp',x);}
