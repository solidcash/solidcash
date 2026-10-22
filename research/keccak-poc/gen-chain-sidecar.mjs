// Chained keccak256 compute side-cars: a preimage of 136 bytes or more is absorbed one 136-byte block per co-spent
// side-car input. Every step runs ONE covenant (one lock per salt); the unlocking <pad> <data> <mode> <redeem> picks:
//   mode 2 START: data = the first block; seed the zero state and an empty block chain X.
//   mode 3 CONT:  data = the next block; pad[0..200) reveals the previous state S.
//   mode 1 FINAL: data = the FULL argument (the contract binds it); pad[0..200) reveals S if it has a full block.
// START/CONT commit X' || sha256(S') (64 bytes), X' = sha256(X || block). CONT and FINAL take S only when the
// previous input carries this same lock and its output commits X || sha256(S). FINAL recomputes X from the
// argument's full blocks (binding every absorbed block to its slice), pads the remainder, absorbs, squeezes and
// commits the 32-byte digest. A FINAL-mode output is 32 bytes, so no link accepts it as a step. The contract reads
// its FINAL slot as [pad][arg][1][redeem]; the covenant requires exactly 3 items, so that slot runs FINAL mode.
//
// node research/keccak-poc/gen-chain-sidecar.mjs --write   bakes the covenants into @solidcash/utils.
import { readFileSync, writeFileSync } from 'node:fs';
import { RC } from './keccak.mjs';
import { asm, binToHex, p2sh32, hash256 } from './sidecar.mjs';
import { genRoundDefine } from './genvar.mjs';

const be = (v) => v.toString(16).padStart(16, '0');
const ALLONES = 'ffffffffffffffff';
const ZERO = '0000000000000000';
const ROT = [[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
const piSrc = [];
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) piSrc[y + 5 * ((2 * x + 3 * y) % 5)] = { x, y, rot: ROT[x][y] };

class Emit {
  constructor() { this.ops = []; this.size = 0; }
  raw(s, d) { this.ops.push(s); this.size += d; }
  pickAbs(ai) { this.raw(`<${this.size - 1 - ai}> OP_PICK`, 1); }
  word(i) { if (i > 0) this.raw(`<${8 * i}> OP_SPLIT OP_NIP`, 0); this.raw('<8> OP_SPLIT OP_DROP', 0); }
  xor() { this.raw('OP_XOR', -1); }
  and() { this.raw('OP_AND', -1); }
  not() { this.raw(`<0x${ALLONES}> OP_XOR`, 0); }
  rotl(k) { if (k % 64 === 0) return; this.raw(`OP_DUP <${k}> OP_LSHIFTBIN OP_SWAP <${64 - k}> OP_RSHIFTBIN OP_OR`, 0); }
}
function reverseEachLane(e, n) {
  e.raw('<8> OP_SPLIT OP_SWAP OP_REVERSEBYTES OP_SWAP', 1);
  for (let i = 1; i < n; i++) { e.raw('<8> OP_SPLIT OP_SWAP OP_REVERSEBYTES', 1); e.raw('OP_ROT OP_SWAP OP_CAT OP_SWAP', -1); }
  e.raw('OP_DROP', -1);
}
function emitAbsorbBlock25(e) {
  reverseEachLane(e, 17);
  const base = e.size - 26, L = (i) => base + (24 - i), blk = base + 25;
  for (let i = 24; i >= 0; i--) {
    e.pickAbs(L(i));
    if (i < 17) { e.pickAbs(blk); e.word(i); e.xor(); }
  }
  for (let k = 0; k < 26; k++) e.raw('<25> OP_ROLL OP_DROP', -1);
}

const aTo = (s) => binToHex(asm(s));
const ROUND_DEFINE_ASM = genRoundDefine(aTo, 2);

// [25 lanes, 136-byte block] -> [25 lanes].
function genChainStepAsm() {
  const e = new Emit(); e.size = 26;
  emitAbsorbBlock25(e);
  for (let r = 0; r < 24; r++) { e.raw('<2> OP_INVOKE', 0); e.raw(`<0x${be(RC[r])}> OP_XOR`, 0); }
  return e.ops.join(' ');
}
const CHAIN_STEP_ASM = genChainStepAsm();
const CHAIN_STEP_ID = 3;
const CHAIN_STEP_HEX = aTo(CHAIN_STEP_ASM);

const ZERO32 = '00'.repeat(32);
const ZERO_STATE_ASM = `<0x${ZERO}>${' OP_DUP'.repeat(24)}`;
const SPLIT_STATE_ASM = '<8> OP_SPLIT '.repeat(24).trim();      // lane24||...||lane0 -> [lane24..lane0]
const COMBINE_STATE_ASM = 'OP_TOALTSTACK '.repeat(25).trim() + ' OP_FROMALTSTACK'
  + ' OP_FROMALTSTACK OP_CAT'.repeat(24);
const PAD_BLOCK_ASM =
  '<0x01> OP_CAT '
  + 'OP_SIZE <136> OP_MOD <136> OP_SWAP OP_SUB <136> OP_MOD '
  + '<0> OP_SWAP OP_NUM2BIN OP_CAT '
  + 'OP_SIZE <1> OP_SUB OP_SPLIT <0x80> OP_OR OP_CAT';
const SQUEEZE_ASM =
  'OP_REVERSEBYTES '
  + 'OP_SWAP OP_REVERSEBYTES OP_CAT OP_SWAP OP_REVERSEBYTES OP_CAT OP_SWAP OP_REVERSEBYTES OP_CAT'
  + ' OP_NIP'.repeat(21);

const BRAND_ASM =
  `OP_DUP <0x${ZERO32}> OP_EQUAL `
  + 'OP_IF OP_DROP '
  + 'OP_ELSE OP_0 OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_DROP OP_EQUALVERIFY OP_ENDIF ';

// Stateless self-pres tail (input/output counts balanced) is replaced with OP_INPUTINDEX for the
// stateful block-layout slot, exactly like the single-block compute side-car.
const STATELESS_TAIL =
  'OP_INPUTINDEX OP_TXOUTPUTCOUNT OP_ADD OP_TXINPUTCOUNT OP_SUB '
  + 'OP_DUP OP_OUTPUTTOKENCOMMITMENT OP_ROT OP_EQUALVERIFY '
  + 'OP_INPUTINDEX OP_UTXOBYTECODE OP_OVER OP_OUTPUTBYTECODE OP_EQUALVERIFY '
  + 'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_OVER OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY '
  + 'OP_DROP OP_1';
const STATEFUL_TAIL = STATELESS_TAIL.replace(
  'OP_INPUTINDEX OP_TXOUTPUTCOUNT OP_ADD OP_TXINPUTCOUNT OP_SUB', 'OP_INPUTINDEX');
// The previous input's recreated output, by the same index rule as each tail.
const STATEFUL_PREV_OUT = 'OP_INPUTINDEX OP_1SUB';
const STATELESS_PREV_OUT = 'OP_INPUTINDEX OP_1SUB OP_TXOUTPUTCOUNT OP_ADD OP_TXINPUTCOUNT OP_SUB';

const MODE = { final: 1, start: 2, cont: 3 };
const PREV_STATE_ASM = '<200> OP_SPLIT OP_DROP';                 // pad -> S
// [S] -> [X, S]: the previous input carries this lock and its output commits X || sha256(S).
const linkAsm = (prevOut) =>
  'OP_INPUTINDEX OP_1SUB OP_UTXOBYTECODE OP_INPUTINDEX OP_UTXOBYTECODE OP_EQUALVERIFY '
  + `${prevOut} OP_OUTPUTTOKENCOMMITMENT <32> OP_SPLIT `
  + 'OP_2 OP_PICK OP_SHA256 OP_EQUALVERIFY OP_SWAP';
// [prefix] -> [X]: X = sha256(X || block) over the 136-byte blocks, from an empty X.
const BLOCK_CHAIN_ASM = 'OP_0 OP_SWAP OP_BEGIN <136> OP_SPLIT OP_TOALTSTACK OP_CAT OP_SHA256 '
  + 'OP_FROMALTSTACK OP_SIZE OP_NOT OP_UNTIL OP_DROP';

function chainCovenant(prevOut, tail) {
  const link = linkAsm(prevOut);
  return asm(`${BRAND_ASM}`                                       // [pad, data, mode]
    + 'OP_DEPTH <3> OP_NUMEQUALVERIFY '
    + `${ROUND_DEFINE_ASM} `
    + `<0x${CHAIN_STEP_HEX}> <${CHAIN_STEP_ID}> OP_DEFINE `
    + `OP_DUP <${MODE.final}> OP_NUMEQUAL OP_IF `
    // FINAL [pad, arg, 1]: stash the remainder; with a full-block prefix, bind it to the linked chain X.
    + 'OP_DROP OP_SIZE OP_DUP <136> OP_MOD OP_SUB OP_SPLIT OP_TOALTSTACK '
    + `OP_SIZE OP_0NOTEQUAL OP_IF ${BLOCK_CHAIN_ASM} OP_SWAP ${PREV_STATE_ASM} ${link} `   // [X(arg), X, S]
    + `OP_ROT OP_ROT OP_EQUALVERIFY ${SPLIT_STATE_ASM} `
    + `OP_ELSE OP_2DROP ${ZERO_STATE_ASM} OP_ENDIF `
    + `OP_FROMALTSTACK ${PAD_BLOCK_ASM} <${CHAIN_STEP_ID}> OP_INVOKE ${SQUEEZE_ASM} `   // [digest]
    + 'OP_ELSE '
    // START/CONT [pad, block, mode] -> [block, X, 25 lanes] -> [X' || sha256(S')]
    + `OP_DUP <${MODE.cont}> OP_NUMEQUAL OP_IF OP_DROP OP_SWAP ${PREV_STATE_ASM} ${link} ${SPLIT_STATE_ASM} `
    + `OP_ELSE <${MODE.start}> OP_NUMEQUALVERIFY OP_NIP OP_0 ${ZERO_STATE_ASM} OP_ENDIF `
    + `<26> OP_PICK OP_SIZE <136> OP_NUMEQUALVERIFY <${CHAIN_STEP_ID}> OP_INVOKE ${COMBINE_STATE_ASM} OP_SHA256 `
    + 'OP_ROT OP_ROT OP_SWAP OP_CAT OP_SHA256 OP_SWAP OP_CAT '
    + 'OP_ENDIF '
    + `${tail}`);
}

const CHAIN_COVENANT = chainCovenant(STATEFUL_PREV_OUT, STATEFUL_TAIL);
const CHAIN_COVENANT_STATELESS = chainCovenant(STATELESS_PREV_OUT, STATELESS_TAIL);

const buildRedeem = (salt, covenant) => Uint8Array.from([0x20, ...salt, ...covenant]);
const lockOf = (salt, covenant) => p2sh32(buildRedeem(salt, covenant));

console.log('chain step', binToHex(asm(CHAIN_STEP_ASM)).length / 2, 'B');
console.log('chain covenant (stateful)', CHAIN_COVENANT.length, 'B hash', binToHex(hash256(CHAIN_COVENANT)));
console.log('chain covenant (stateless)', CHAIN_COVENANT_STATELESS.length, 'B hash',
  binToHex(hash256(CHAIN_COVENANT_STATELESS)));

if (process.argv.includes('--write')) {
  const path = new URL('../../packages/utils/src/keccak-compute-library.ts', import.meta.url);
  let src = readFileSync(path, 'utf8');
  for (const [name, covenant] of [
    ['KECCAK_CHAIN_COVENANT', CHAIN_COVENANT], ['KECCAK_CHAIN_COVENANT_STATELESS', CHAIN_COVENANT_STATELESS],
  ]) {
    for (const [key, value] of [[name, binToHex(covenant)], [`${name}_HASH`, binToHex(hash256(covenant))]]) {
      const pattern = new RegExp(`(export const ${key} =\\s*')[0-9a-f]*(';)`);
      if (!pattern.test(src)) throw new Error(`keccak-compute-library.ts has no ${key}`);
      src = src.replace(pattern, `$1${value}$2`);
    }
  }
  writeFileSync(path, src);
  console.log('updated keccak-compute-library.ts');
}

export { CHAIN_COVENANT, CHAIN_COVENANT_STATELESS, MODE, buildRedeem, lockOf, CHAIN_STEP_ASM };
