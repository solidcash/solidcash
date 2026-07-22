// Generate + VM-verify the "computing side-car" constants for @solidcash/utils.
// Redeem = <C:32> || COVENANT. COVENANT consumes C (brand check) FIRST, then runs keccak on a CLEAN [P]
// (keccak's round cleanup needs nothing below its working set / empty altstack). COVENANT is C-independent
// so hash256(COVENANT) is a compile-time constant the contract bakes for integrity. Prints the hex constants.
import { keccak_256 } from '@noble/hashes/sha3.js';
import { asm, binToHex, hexToBin, p2sh32, evalInput, hash256 } from './sidecar.mjs';
import { genKeccak256var } from './genvar.mjs';

const aTo = (s) => binToHex(asm(s));
const evm = (b) => keccak_256(b);

// Inline single-shot keccak [msg]->[hash] (round-define + body), EVM byte order. Source: genvar.mjs.
// MUST be inlined as CODE (assembled in the ASM string), not pushed as data.
const INLINE_KECCAK_ASM = genKeccak256var(aTo);
const INLINE_KECCAK_HEX = binToHex(asm(INLINE_KECCAK_ASM));

// COVENANT (stack in [pad, P, salt], salt on top): CONDITIONAL brand check - if salt is zero (SHARED, for a
// stateless contract with no category) skip it; else (BRANDED) verify input-0's category == salt (the user's
// "spendable only by the contract of that category" rule). Then drop pad, R = keccak(P) on a CLEAN stack,
// commit R at the last output, preserve locking + category/capability. Salt-independent -> one covenant hash.
const ZERO32 = '00'.repeat(32);
const COVENANT_ASM =
  `OP_DUP <0x${ZERO32}> OP_EQUAL ` +                                         // [pad,P,salt, isShared]
  'OP_IF OP_DROP ' +                                                         // shared: drop salt -> [pad,P]
  'OP_ELSE OP_0 OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_DROP OP_EQUALVERIFY OP_ENDIF ' + // branded: in0 cat==salt
  'OP_NIP ' +                                                                // drop pad -> [P]
  `${INLINE_KECCAK_ASM} ` +                                                  // [R]  (inline keccak CODE)
  // outIdx = INPUTINDEX + TXOUTPUTCOUNT - TXINPUTCOUNT: this side-car's recreation output (for N side-cars in
  // the last-N inputs recreated as the last-N outputs; N=1 -> the last output, byte-compatible semantics).
  'OP_INPUTINDEX OP_TXOUTPUTCOUNT OP_ADD OP_TXINPUTCOUNT OP_SUB ' +                           // [R, outIdx]
  'OP_DUP OP_OUTPUTTOKENCOMMITMENT OP_ROT OP_EQUALVERIFY ' +                                  // out[outIdx].commit == R
  'OP_INPUTINDEX OP_UTXOBYTECODE OP_OVER OP_OUTPUTBYTECODE OP_EQUALVERIFY ' +                  // preserve locking
  'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_OVER OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY ' +        // preserve cat+cap
  'OP_DROP OP_1';
const COVENANT = asm(COVENANT_ASM);
const COVENANT_HASH = hash256(COVENANT);

// redeem = OP_PUSHBYTES_32 || C(32) || COVENANT ; salt prefix = 33
const SALT_PREFIX = 33;
const buildRedeem = (C) => Uint8Array.from([0x20, ...C, ...COVENANT]);
const computeLock = (C) => p2sh32(buildRedeem(C));

const PAD_LEN = 3000, PAD_SKIP = 3 + PAD_LEN;   // side-car unlocking pad push = PUSHDATA2 (3-byte prefix)
const REDEEM_PUSH_PREFIX = 3;                   // redeem > 255 bytes -> PUSHDATA2

const C = new Uint8Array(32).fill(0xcc);        // contract category (branded salt)
const K = new Uint8Array(32).fill(0xbb);        // side-car own NFT category
const tok = (category, capability, commitment) => ({ category, amount: 0n, nft: { capability, commitment } });

// Contract-side (input0): read side-car unlocking, extract P + redeem, verify integrity(hash)+brand(C)+bind(P), read R.
function contractLock(myC) {
  return asm(
    'OP_DROP ' +                                          // drop contract pad -> [my_P]
    'OP_TXINPUTCOUNT OP_1SUB OP_INPUTBYTECODE ' +         // [my_P, U=<padpush><Ppush><redeempush>]  (last input)
    `<${PAD_SKIP}> OP_SPLIT OP_NIP ` +                    // drop pad push
    '<1> OP_SPLIT OP_NIP ' +                              // drop P's 0x20 prefix
    '<32> OP_SPLIT ' +                                    // [my_P, P, redeempush]
    `<${REDEEM_PUSH_PREFIX}> OP_SPLIT OP_NIP ` +          // strip PUSHDATA2 prefix -> [my_P, P, redeem]
    '<1> OP_SPLIT OP_NIP ' +                              // drop redeem's 0x20 (salt push op) -> [my_P, P, C++COVENANT]
    '<32> OP_SPLIT ' +                                    // [my_P, P, C, COVENANT]
    `OP_HASH256 <0x${binToHex(COVENANT_HASH)}> OP_EQUALVERIFY ` + // integrity -> [my_P, P, C]
    `<0x${binToHex(myC)}> OP_EQUALVERIFY ` +              // brand: C == myC -> [my_P, P]
    'OP_EQUALVERIFY ' +                                   // bind: P == my_P -> []
    'OP_TXOUTPUTCOUNT OP_1SUB OP_OUTPUTTOKENCOMMITMENT ' + // read R (last output) -> [R]
    'OP_SIZE <32> OP_NUMEQUAL OP_NIP');                   // assert 32-byte R -> [bool]
}

function build({ P, commitR, in0Cat = C }) {
  const redeem = buildRedeem(C), scLock = computeLock(C);
  const scUnlock = asm(`<0x${'00'.repeat(PAD_LEN)}> <0x${binToHex(P)}> <0x${binToHex(redeem)}>`);
  const ctUnlock = asm(`<0x${binToHex(P)}> <0x${'00'.repeat(700)}>`);
  const inputs = [
    { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32),         sequenceNumber: 0xffffffff, unlockingBytecode: ctUnlock },
    { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: scUnlock },
  ];
  const sourceOutputs = [
    { lockingBytecode: contractLock(C), valueSatoshis: 100000n, token: in0Cat ? tok(in0Cat, 'mutable', new Uint8Array(0)) : undefined },
    { lockingBytecode: scLock, valueSatoshis: 100000n, token: tok(K, 'mutable', new Uint8Array(0)) },
  ];
  const outputs = [
    { lockingBytecode: new Uint8Array(25), valueSatoshis: 1000n },
    { lockingBytecode: scLock, valueSatoshis: 100000n, token: tok(K, 'mutable', commitR) },
  ];
  return { contract: evalInput(inputs, sourceOutputs, outputs, 0), sidecar: evalInput(inputs, sourceOutputs, outputs, 1) };
}

console.log('INLINE_KECCAK', INLINE_KECCAK_HEX.length/2, 'B | COVENANT', COVENANT.length, 'B | redeem', buildRedeem(C).length, 'B');
let ok = true;
for (const P of [hexToBin('deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718'), new Uint8Array(32), new Uint8Array(32).fill(0x11)]) {
  const r = build({ P, commitR: evm(P) });
  const good = r.contract.ok && r.sidecar.ok; ok = ok && good;
  console.log(`P ${binToHex(P).slice(0,12)}..  sc=${r.sidecar.ok?'OK':'FAIL'}(op ${r.sidecar.metrics?.operationCost}) ct=${r.contract.ok?'OK':'FAIL'}${r.sidecar.error?' [sc:'+r.sidecar.error.slice(0,30)+']':''}${r.contract.error?' [ct:'+r.contract.error.slice(0,30)+']':''}`);
}
const nWrongHash = !build({ P: new Uint8Array(32).fill(0x11), commitR: evm(new Uint8Array(32)) }).sidecar.ok;
const nNoCat = !build({ P: new Uint8Array(32).fill(0x11), commitR: evm(new Uint8Array(32).fill(0x11)), in0Cat: null }).sidecar.ok;
// wrong preimage bound: contract's my_P != side-car's P
function nMismatch() {
  const redeem = buildRedeem(C), scLock = computeLock(C);
  const scUnlock = asm(`<0x${'00'.repeat(PAD_LEN)}> <0x${binToHex(new Uint8Array(32).fill(0x11))}> <0x${binToHex(redeem)}>`);
  const ctUnlock = asm(`<0x${binToHex(new Uint8Array(32).fill(0x22))}> <0x${'00'.repeat(700)}>`); // my_P=0x22.., side-car P=0x11..
  const inputs = [
    { outpointIndex:0, outpointTransactionHash:new Uint8Array(32), sequenceNumber:0xffffffff, unlockingBytecode: ctUnlock },
    { outpointIndex:0, outpointTransactionHash:new Uint8Array(32).fill(1), sequenceNumber:0xffffffff, unlockingBytecode: scUnlock },
  ];
  const so = [
    { lockingBytecode: contractLock(C), valueSatoshis:100000n, token: tok(C,'mutable',new Uint8Array(0)) },
    { lockingBytecode: scLock, valueSatoshis:100000n, token: tok(K,'mutable',new Uint8Array(0)) },
  ];
  const out = [{ lockingBytecode:new Uint8Array(25), valueSatoshis:1000n }, { lockingBytecode: scLock, valueSatoshis:100000n, token: tok(K,'mutable',evm(new Uint8Array(32).fill(0x11))) }];
  return !evalInput(inputs, so, out, 0).ok;
}
const nBind = nMismatch();
console.log(`NEG wrong-commit sc-rejects=${nWrongHash}  no-category sc-rejects=${nNoCat}  wrong-preimage ct-rejects=${nBind}`);
console.log(`\nSPINE ${ok && nWrongHash && nNoCat && nBind ? 'OK' : 'FAIL'}`);
console.log('\n--- utils constants ---');
console.log('KECCAK_COMPUTE_INLINE_HEX_LEN', INLINE_KECCAK_HEX.length/2);
console.log('KECCAK_COMPUTE_COVENANT_HASH', binToHex(COVENANT_HASH));
console.log('SALT_PREFIX', SALT_PREFIX, ' REDEEM_PUSHDATA2_PREFIX 3  COVENANT_LEN', COVENANT.length);
// STATEFUL variant (self-preserves via OP_INPUTINDEX for a block-layout keccakSideCar slot) is DERIVED from
// this covenant in utils/keccak-compute-library.ts by swapping the self-pres tail c0c493c394 -> c0. If this
// covenant changes, KECCAK256_COMPUTE_STATEFUL_COVENANT_HASH must be updated too (the utils test guards it).
const STATEFUL_COVENANT_HEX =
  binToHex(COVENANT).slice(0, -'c0c493c39476d27b88c0c778cd88c0ce78d1887551'.length) + 'c076d27b88c0c778cd88c0ce78d1887551';
console.log('KECCAK_COMPUTE_STATEFUL_COVENANT_HASH', binToHex(hash256(hexToBin(STATEFUL_COVENANT_HEX))), ' STATEFUL_LEN', STATEFUL_COVENANT_HEX.length/2);
