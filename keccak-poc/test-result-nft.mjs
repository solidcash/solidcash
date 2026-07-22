// Phase 0 PoC: single-hash "compute-and-commit" branded keccak side-car.
//
// side-car input (branded P2SH, salt=C, mutable NFT of its own category K):
//   unlocking [pad, P] -> redeem drops pad, computes R=keccak(P) in ITS OWN op budget,
//   enforces its recreated output commits R (EVM byte order), preserves its locking+category+capability,
//   and enforces an input of category C is co-spent (branded: only the stateful contract of category C).
// contract input (carries category C):
//   verifies the co-spent side-car is the branded genuine covenant, reads R from its output commitment,
//   and binds P by decoding the side-car's unlocking (OP_INPUTBYTECODE) == its own P.
//
// Proves the new spine on the BCH-2026 VM + the negatives (wrong commit, wrong preimage, missing C).
import { keccak_256 } from '@noble/hashes/sha3.js';
import { asm, binToHex, hexToBin, p2sh32, evalInput } from './sidecar.mjs';
import { genKeccak256var } from './genvar.mjs';

const aTo = (s) => binToHex(asm(s));
const evm = (b) => keccak_256(b);                       // EVM keccak256, big-endian output
const hx = (h) => hexToBin(h);

// Test categories + preimage (raw bytes; used identically in tokens and in baked constants).
const C = new Uint8Array(32).fill(0xcc);                // contract (stateful) category
const K = new Uint8Array(32).fill(0xbb);                // side-car's own NFT category
const PAD_LEN = 3000, PAD_SKIP = 3 + PAD_LEN;           // PUSHDATA2 pad (3-byte prefix) in side-car unlocking

// --- side-car branded computing redeem ---
const keccak = genKeccak256var(aTo);                    // [msg] -> [hash], EVM-endian; defines round id 2
const redeemAsm =
  `OP_NIP ${keccak} ` +                                 // [pad,P] -> [P] -> [R]
  `OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ` +               // out[k].commitment == R
  `OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY ` + // preserve locking
  `OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY ` + // preserve cat+cap
  `<0x${binToHex(C)}> OP_0 OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_DROP OP_EQUALVERIFY ` + // branded: in[0] cat==C
  `OP_1`;
const redeem = asm(redeemAsm);
const sidecarLock = p2sh32(redeem);

// --- contract locking (bare script; input carries category C) ---
const contractAsm =
  `OP_DROP ` +                                          // drop contract pad -> [my_P]
  `<0x${binToHex(sidecarLock)}> <1> OP_UTXOBYTECODE OP_EQUALVERIFY ` +     // integrity: in[1] IS branded side-car
  `<1> OP_OUTPUTTOKENCOMMITMENT ` +                     // read R from side-car output commitment -> [my_P, R]
  `<1> OP_INPUTBYTECODE ` +                             // [my_P, R, sidecarUnlock]
  `<${PAD_SKIP}> OP_SPLIT OP_NIP ` +                    // drop pad push -> [.., Ppush||redeem]
  `<1> OP_SPLIT OP_NIP ` +                              // drop P push prefix (0x20) -> [.., 32P||redeem]
  `<32> OP_SPLIT OP_DROP ` +                            // take P -> [my_P, R, P_extracted]
  `OP_ROT OP_EQUALVERIFY ` +                            // bind: my_P == P_extracted -> [R]
  `OP_SIZE <32> OP_NUMEQUAL OP_NIP`;                    // assert R is a 32-byte hash -> [bool]
const contractLock = asm(contractAsm);

const tok = (category, capability, commitment) => ({ category, amount: 0n, nft: { capability, commitment } });

function build({ P, commitR, in0Category = C, capOut = 'mutable' }) {
  const sidecarUnlock = asm(`<0x${'00'.repeat(PAD_LEN)}> <0x${binToHex(P)}> <0x${binToHex(redeem)}>`);
  const contractUnlock = asm(`<0x${binToHex(P)}> <0x${'00'.repeat(700)}>`); // [my_P, pad]; redeem OP_DROPs pad
  const inputs = [
    { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32),         sequenceNumber: 0xffffffff, unlockingBytecode: contractUnlock },
    { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: sidecarUnlock },
  ];
  const sourceOutputs = [
    { lockingBytecode: contractLock, valueSatoshis: 100000n, token: in0Category ? tok(in0Category, 'mutable', new Uint8Array(0)) : undefined },
    { lockingBytecode: sidecarLock,  valueSatoshis: 100000n, token: tok(K, 'mutable', new Uint8Array(0)) },
  ];
  const outputs = [
    { lockingBytecode: new Uint8Array(25), valueSatoshis: 1000n },                          // contract out (bare)
    { lockingBytecode: sidecarLock, valueSatoshis: 100000n, token: tok(K, capOut, commitR) }, // side-car recreation + R
  ];
  return {
    contract: evalInput(inputs, sourceOutputs, outputs, 0),
    sidecar:  evalInput(inputs, sourceOutputs, outputs, 1),
  };
}

const P0 = hx('deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718');
const P1 = new Uint8Array(32);
const P2 = new Uint8Array(32).fill(0x11);

console.log(`redeem ${redeem.length}B | side-car lock ${sidecarLock.length}B | contract lock ${contractLock.length}B\n`);
let allOk = true;
for (const P of [P0, P1, P2]) {
  const R = evm(P);
  const r = build({ P, commitR: R });
  const ok = r.contract.ok && r.sidecar.ok;
  allOk = allOk && ok;
  console.log(`P ${binToHex(P).slice(0, 12)}..  side-car=${r.sidecar.ok ? 'OK' : 'FAIL'} (op ${r.sidecar.metrics?.operationCost})  contract=${r.contract.ok ? 'OK' : 'FAIL'}  commitR=${binToHex(R).slice(0, 12)}..` +
    `${r.sidecar.error ? '  [sc:' + r.sidecar.error.slice(0, 34) + ']' : ''}${r.contract.error ? '  [ct:' + r.contract.error.slice(0, 34) + ']' : ''}`);
}
console.log(`\nPOSITIVE ALL OK: ${allOk}\n`);

// Negatives (each must fail the indicated input):
const neg = [
  ['wrong committed hash (side-car rejects)', build({ P: P2, commitR: evm(P0) }), 'sidecar'],
  ['wrong preimage bound (contract rejects)', (() => { const r = build({ P: P2, commitR: evm(P2) }); // contract passes different my_P
      // rebuild with contract unlock carrying a DIFFERENT preimage than the side-car hashed:
      return r; })(), 'contract-mismatch'],
  ['missing category-C input (side-car rejects)', build({ P: P2, commitR: evm(P2), in0Category: null }), 'sidecar'],
];
// wrong-preimage: construct explicitly (contract my_P != side-car P)
function buildMismatch() {
  const Pside = P2, Pcontract = P0;
  const sidecarUnlock = asm(`<0x${'00'.repeat(PAD_LEN)}> <0x${binToHex(Pside)}> <0x${binToHex(redeem)}>`);
  const contractUnlock = asm(`<0x${binToHex(Pcontract)}> <0x${'00'.repeat(700)}>`);
  const inputs = [
    { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32),         sequenceNumber: 0xffffffff, unlockingBytecode: contractUnlock },
    { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: sidecarUnlock },
  ];
  const sourceOutputs = [
    { lockingBytecode: contractLock, valueSatoshis: 100000n, token: tok(C, 'mutable', new Uint8Array(0)) },
    { lockingBytecode: sidecarLock,  valueSatoshis: 100000n, token: tok(K, 'mutable', new Uint8Array(0)) },
  ];
  const outputs = [
    { lockingBytecode: new Uint8Array(25), valueSatoshis: 1000n },
    { lockingBytecode: sidecarLock, valueSatoshis: 100000n, token: tok(K, 'mutable', evm(Pside)) },
  ];
  return { contract: evalInput(inputs, sourceOutputs, outputs, 0), sidecar: evalInput(inputs, sourceOutputs, outputs, 1) };
}

let negOk = true;
{ const r = build({ P: P2, commitR: evm(P0) }); const rejected = !r.sidecar.ok; negOk = negOk && rejected;
  console.log(`NEG wrong committed hash: side-car rejects = ${rejected}`); }
{ const r = buildMismatch(); const rejected = !r.contract.ok; negOk = negOk && rejected;
  console.log(`NEG wrong preimage bound: contract rejects = ${rejected} (side-car ${r.sidecar.ok ? 'OK' : 'also fails'})`); }
{ const r = build({ P: P2, commitR: evm(P2), in0Category: null }); const rejected = !r.sidecar.ok; negOk = negOk && rejected;
  console.log(`NEG missing category-C:   side-car rejects = ${rejected}`); }

console.log(`\nNEGATIVES ALL REJECTED: ${negOk}`);
console.log(`\n=== Phase 0 spine ${allOk && negOk ? 'PROVEN' : 'FAILED'} ===`);
