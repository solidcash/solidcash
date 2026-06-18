import { run, asm, binToHex } from './vm.mjs';
import { genHashFromState } from './gen.mjs';

const asmToHex = (s) => binToHex(asm(s));
// absorbed state for keccak256(""): lane0=0x..01 (BE), lane16=0x80..00 (BE), rest 0.
const lanes = new Array(25).fill('0000000000000000');
lanes[0]  = '0000000000000001';
lanes[16] = '8000000000000000';
const stateBlob = lanes.join('');

const script = 'OP_NIP ' + genHashFromState(asmToHex);
console.log('locking size:', asm(script).length, 'bytes');
const pad = '00'.repeat(8000);
const res = run(`<0x${pad}> <0x${stateBlob}>`, script);
const got = res.stack[res.stack.length - 1];
console.log('error:', res.error || 'none');
console.log('keccak256(\"\") script :', got);
console.log('expected EVM hash    : c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
console.log('MATCH:', got === 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
