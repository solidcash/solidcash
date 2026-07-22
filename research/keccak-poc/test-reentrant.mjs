// Validate the re-entrant fix: define the round ONCE, define keccak-main as a function, then INVOKE it
// multiple times (distinct calls + nested) in one input - each result must match EVM.
import { keccak_256 } from '@noble/hashes/sha3';
import { run, asm, binToHex } from './vm.mjs';
import { genRoundDefine, genKeccak256varBody } from './genvar.mjs';

const aTo = (s) => binToHex(asm(s));
const evm = (h) => Buffer.from(keccak_256(Buffer.from(h, 'hex'))).toString('hex');
const ROUND = 2, KECCAK = 3;
// Registrar: define round (once) + define keccak-main (which invokes round) as fn KECCAK.
const setup = `${genRoundDefine(aTo, ROUND)} <0x${aTo(genKeccak256varBody(ROUND))}> <${KECCAK}> OP_DEFINE`;
const PAD = '00'.repeat(9000); // op budget for several keccak invokes

function report(name, res) {
  console.log(`${name.padEnd(34)} ${res.ok && !res.error ? 'OK' : 'FAIL'}  ${res.error ? '['+res.error.slice(0,55)+']' : 'stack='+res.stack}`);
}

// Test 1: two DISTINCT keccak256 calls in one input.
{
  const m1 = 'ab'.repeat(32), m2 = 'cd'.repeat(40);
  const lock = `${setup} <0x${m1}> <${KECCAK}> OP_INVOKE <0x${evm(m1)}> OP_EQUAL `
    + `<0x${m2}> <${KECCAK}> OP_INVOKE <0x${evm(m2)}> OP_EQUAL OP_BOOLAND OP_NIP`;
  report('two distinct keccak256 calls', run(`<0x${PAD}>`, lock));
}
// Test 2: nested keccak256(keccak256(m)).
{
  const m = 'ab'.repeat(32);
  const outer = evm(evm(m));
  const lock = `${setup} <0x${m}> <${KECCAK}> OP_INVOKE <${KECCAK}> OP_INVOKE <0x${outer}> OP_EQUAL OP_NIP`;
  report('nested keccak256(keccak256(m))', run(`<0x${PAD}>`, lock));
}
// Test 3: three distinct calls.
{
  const ms = ['11'.repeat(32), '22'.repeat(10), '33'.repeat(50)];
  let lock = setup;
  for (const m of ms) lock += ` <0x${m}> <${KECCAK}> OP_INVOKE <0x${evm(m)}> OP_EQUAL`;
  lock += ' OP_BOOLAND OP_BOOLAND OP_NIP';
  report('three distinct keccak256 calls', run(`<0x${'00'.repeat(9500)}>`, lock));
}
