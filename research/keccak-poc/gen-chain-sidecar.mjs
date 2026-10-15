// Chained keccak256 compute side-cars: split a >3-block preimage across multiple co-spent side-car
// inputs. Each side-car absorbs ONE 136-byte keccak block into the running 25-lane sponge state and
// commits the next running state (200 bytes = lane24 || ... || lane0) to its mutable NFT. The FINAL
// side-car instead pads the remainder, absorbs it, squeezes the 32-byte digest, and commits the digest.
//
// Three covenants (each a separate P2SH32 redeem, one integrity hash each):
//   START: state <- 25 zero lanes, absorb a FULL block, commit state
//   CONT:  state <- prev output commitment, absorb a FULL block, commit state
//   FINAL: state <- prev output commitment, pad the remainder block, absorb, squeeze, commit digest
//
// The SDK never computes the intermediate state; each covenant reads the previous one's commitment via
// OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT (stateful slots are consecutive), so the chain is
// verified on-chain block by block and a tampered/wrong chain fails the contract's digest bind.
import { keccak_256 } from '@noble/hashes/sha3.js';
import { RC } from './keccak.mjs';
import { asm, binToHex, hexToBin, evalInput, p2sh32, hash256 } from './sidecar.mjs';
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
const ZERO_STATE_ASM = Array.from({ length: 25 }, () => `<0x${ZERO}>`).join(' ');
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

function covenantAsm(stateLoad, absorbAndFinish, tail) {
  return `${BRAND_ASM}OP_DROP `          // drop pad -> [block]
    + `${ROUND_DEFINE_ASM} `
    + `<0x${CHAIN_STEP_HEX}> <${CHAIN_STEP_ID}> OP_DEFINE `
    + 'OP_TOALTSTACK '                    // stash the block -> []
    + `${stateLoad} `                     // -> [25 lanes]
    + 'OP_FROMALTSTACK '                  // -> [25 lanes, block]
    + `${absorbAndFinish} `               // -> [commitment]
    + `${tail}`;
}

const START_ASM = `${ZERO_STATE_ASM}`;
const CONT_ASM = `OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT ${SPLIT_STATE_ASM}`;
// FINAL reads [pad, full_arg, width, salt] - the SAME unlocking shape the contract decoder reads - and derives
// its mode from the full argument length: len >= 136 (has a full block) reads the previous committed state,
// else seeds the zero state. It extracts the last (len % 136) bytes as the padded remainder block, so the
// contract-side bind (full_arg == the contract's argument) stays intact.
const FINAL_REMAINDER_ASM =
  'OP_DUP OP_SIZE OP_DUP <136> OP_MOD OP_SUB OP_SPLIT OP_NIP OP_NIP';
const FINAL_STATE_ASM =
  `${FINAL_REMAINDER_ASM} `
  + 'OP_TOALTSTACK '
  + 'OP_IF OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT ' + `${SPLIT_STATE_ASM} `
  + 'OP_ELSE ' + `${ZERO_STATE_ASM} `
  + 'OP_ENDIF '
  + 'OP_FROMALTSTACK ';
const FINAL_ASM = `${PAD_BLOCK_ASM} <${CHAIN_STEP_ID}> OP_INVOKE ${SQUEEZE_ASM}`;
const START_STEP = `<${CHAIN_STEP_ID}> OP_INVOKE ${COMBINE_STATE_ASM}`;
const CONT_STEP = `<${CHAIN_STEP_ID}> OP_INVOKE ${COMBINE_STATE_ASM}`;

function finalCovenant(tail) {
  // [pad, full_arg, width, salt] -> brand -> [pad, full_arg, width] -> verify width 1 -> [pad, full_arg]
  // -> NIP the pad -> [full_arg]; stash remainder, choose state by full_arg length, absorb, squeeze.
  return asm(`${BRAND_ASM}`
    + 'OP_1 OP_NUMEQUALVERIFY OP_NIP '
    + `${ROUND_DEFINE_ASM} `
    + `<0x${CHAIN_STEP_HEX}> <${CHAIN_STEP_ID}> OP_DEFINE `
    + 'OP_DUP OP_SIZE <136> OP_GREATERTHANOREQUAL OP_ROT OP_DROP OP_SWAP '  // [hasFull, full_arg]
    + `${FINAL_STATE_ASM} `
    + `${FINAL_ASM} `
    + `${tail}`);
}

const START_COVENANT = asm(covenantAsm(START_ASM, START_STEP, STATEFUL_TAIL));
const CONT_COVENANT = asm(covenantAsm(CONT_ASM, CONT_STEP, STATEFUL_TAIL));
const FINAL_COVENANT = finalCovenant(STATEFUL_TAIL);
const START_COVENANT_STATELESS = asm(covenantAsm(START_ASM, START_STEP, STATELESS_TAIL));
const CONT_COVENANT_STATELESS = asm(covenantAsm(CONT_ASM, CONT_STEP, STATELESS_TAIL));
const FINAL_COVENANT_STATELESS = finalCovenant(STATELESS_TAIL);

const buildRedeem = (salt, covenant) => Uint8Array.from([0x20, ...salt, ...covenant]);
const lockOf = (salt, covenant) => p2sh32(buildRedeem(salt, covenant));

console.log('chain step', binToHex(asm(CHAIN_STEP_ASM)).length / 2, 'B');
console.log('start covenant (stateful)', START_COVENANT.length, 'B hash', binToHex(hash256(START_COVENANT)));
console.log('cont covenant  (stateful)', CONT_COVENANT.length, 'B hash', binToHex(hash256(CONT_COVENANT)));
console.log('final covenant (stateful)', FINAL_COVENANT.length, 'B hash', binToHex(hash256(FINAL_COVENANT)));
console.log('start covenant (stateless)', START_COVENANT_STATELESS.length, 'B hash', binToHex(hash256(START_COVENANT_STATELESS)));
console.log('cont covenant  (stateless)', CONT_COVENANT_STATELESS.length, 'B hash', binToHex(hash256(CONT_COVENANT_STATELESS)));
console.log('final covenant (stateless)', FINAL_COVENANT_STATELESS.length, 'B hash', binToHex(hash256(FINAL_COVENANT_STATELESS)));
console.log('\nKECCAK_CHAIN_START_COVENANT', binToHex(START_COVENANT));
console.log('\nKECCAK_CHAIN_CONT_COVENANT', binToHex(CONT_COVENANT));
console.log('\nKECCAK_CHAIN_FINAL_COVENANT', binToHex(FINAL_COVENANT));
console.log('\nKECCAK_CHAIN_START_COVENANT_STATELESS', binToHex(START_COVENANT_STATELESS));
console.log('\nKECCAK_CHAIN_CONT_COVENANT_STATELESS', binToHex(CONT_COVENANT_STATELESS));
console.log('\nKECCAK_CHAIN_FINAL_COVENANT_STATELESS', binToHex(FINAL_COVENANT_STATELESS));

export {
  START_COVENANT, CONT_COVENANT, FINAL_COVENANT,
  START_COVENANT_STATELESS, CONT_COVENANT_STATELESS, FINAL_COVENANT_STATELESS,
  buildRedeem, lockOf, CHAIN_STEP_ASM,
};
