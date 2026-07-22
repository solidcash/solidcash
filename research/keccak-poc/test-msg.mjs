import { run, asm, binToHex } from './vm.mjs';
import { genKeccak256x32 } from './gen.mjs';
import { keccak_256 } from '@noble/hashes/sha3';

const asmToHex = (s) => binToHex(asm(s));
const script = 'OP_NIP ' + genKeccak256x32(asmToHex);
console.log('locking size:', asm(script).length, 'bytes');

function evm(hex) { return Buffer.from(keccak_256(Buffer.from(hex, 'hex'))).toString('hex'); }

let allMatch = true;
for (const msg of ['00'.repeat(32), '11'.repeat(32),
  '0000000000000000000000000000000000000000000000000000000000000001',
  'deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718']) {
  const pad = '00'.repeat(8000);
  const res = run(`<0x${pad}> <0x${msg}>`, script);
  const got = res.stack[res.stack.length - 1];
  const exp = evm(msg);
  const ok = got === exp;
  allMatch = allMatch && ok;
  console.log(`msg ${msg.slice(0,16)}..: ${ok ? 'MATCH' : 'FAIL'}${res.error?(' err='+res.error.slice(0,40)):''}`);
  if (!ok) { console.log('  got', got); console.log('  exp', exp); }
}
console.log('ALL MATCH:', allMatch);
