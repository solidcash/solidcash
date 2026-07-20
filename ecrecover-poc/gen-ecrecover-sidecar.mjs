// PRODUCTION recovery covenant pair (deployable). Wraps the PROVEN engine.mjs verification+ladder with the blob-
// structured unlocking the compiler codegen + SDK agree on, the A->B checkpoint-hash commit, and self-preservation.
// A-unlock = <pad><argBlob><sharedBlob><aBlob><redeem> ; B-unlock = <pad><argBlob><sharedBlob><Cblob><Zinv><redeem>.
//   argBlob = hash(32)||v(1)||r(32)||s(32)   (the contract's args; BCH-native LE bytes32; covenant appends 0x00 sign)
//   sharedBlob = masks(128)||tbl(16*66)||start(1)||chunkA(1)     (A and B hash-bind on argBlob||sharedBlob||C)
//   aBlob = rinv(33)||Ry(33)||phiRx(33)||t1a(33)||t2a(33)||t1b(33)||t2b(33)||invb(11*33)   (A-only verification helpers)
// This file proves covenant A parses the blobs, self-verifies, and ladders to the CORRECT checkpoint C (vs the JS
// reference), then generates the covenant hexes + hashes for packages/utils/src/ecrecover-compute-library.ts.
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, bigIntToVmNumber, hash256 as sha256d } from '@bitauth/libauth';
import {
  asm, num, N, P, BETA, mod, invP, invN, splitScalar, recTerm, jDbl, jAdd, to33, accBlob,
  DEFS, covABody, covBBody, GX, GY, PHIGX,
} from './engine.mjs';

const vm = createVirtualMachineBch2026();
const Nhex = num(N);
// P2SH redeem = 0x20||salt||covenant, so the covenant runs with the 32-byte salt on TOP. Brand check: drop it when
// SHARED (all-zero), else verify the consuming contract (input 0) carries that category (branded stateful co-spend).
const SALT_CHECK = `OP_DUP <0x${'00'.repeat(32)}> OP_EQUAL OP_IF OP_DROP OP_ELSE OP_0 OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_DROP OP_EQUALVERIFY OP_ENDIF `;
// PROD_A_BASE = the order the blob-parse produces on the stack (V() references by name, so order is free).
const PROD_A_BASE = ['negZ', 'recPar', 'r', 's', 'masks', 'tbl', 'start', 'chunkA', 'rinv', 'Ry', 'phiRx', 't1a', 't2a', 't1b', 't2b', 'invb'];

// on-chain parse of the A unlocking (stack when the P2SH redeem runs = [pad, argBlob, sharedBlob, aBlob]).
const PARSE_A =
  '<3> OP_ROLL OP_DROP ' +                                          // drop pad -> [argBlob sharedBlob aBlob]
  'OP_2 OP_PICK OP_TOALTSTACK OP_1 OP_PICK OP_TOALTSTACK ' +        // stash argBlob+sharedBlob copies (for H_A)
  'OP_TOALTSTACK OP_TOALTSTACK ' +                                 // aBlob, sharedBlob -> alt ; [argBlob]
  // parse argBlob = hash(32) v(1) r(32) s(32) -> negZ recPar r s  (append 0x00 sign byte before BIN2NUM)
  '<32> OP_SPLIT OP_SWAP <0x00> OP_CAT OP_BIN2NUM ' + Nhex + ' OP_MOD ' + Nhex + ' OP_SWAP OP_SUB OP_SWAP ' + // negZ
  '<1> OP_SPLIT OP_SWAP OP_BIN2NUM <0x1b> OP_SUB OP_SWAP ' +        // recPar = v - 27
  '<32> OP_SPLIT <0x00> OP_CAT OP_BIN2NUM OP_SWAP <0x00> OP_CAT OP_BIN2NUM OP_SWAP ' + // r s
  // parse sharedBlob = masks(128) tbl(1056) start(1) chunkA(1)
  'OP_FROMALTSTACK ' +
  `${num(128n)} OP_SPLIT ${num(1056n)} OP_SPLIT ` +                 // masks(128) tbl(1056)
  '<1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP <1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP ' + // start chunkA
  'OP_DROP ' +                                                     // drop the empty sharedBlob remainder
  // parse aBlob = rinv Ry phiRx t1a t2a t1b t2b (each 33) then invb(remainder)
  'OP_FROMALTSTACK ' +
  '<33> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP '.repeat(7);           // rinv..t2b ; remainder = invb

function covenantA() {
  // after PARSE_A the stack = PROD_A_BASE (16), alt = [argBlobCopy, sharedBlobCopy]
  const body = covABody(0, true, PROD_A_BASE).asm;                 // verify + ladder -> [PROD_A_BASE entries Cblob]
  const dropBaseEntries = 'OP_2DROP '.repeat(16);                  // drop the 16 base + 16 entries below the result
  return (
    SALT_CHECK + PARSE_A + ' ' + DEFS + ' ' + body + ' ' +
    // H_A = hash256(argBlob || sharedBlob || Cblob); commit to this input's output NFT commitment
    'OP_FROMALTSTACK OP_FROMALTSTACK ' +                           // [.. Cblob sharedBlobCopy argBlobCopy]
    'OP_SWAP OP_CAT OP_SWAP OP_CAT OP_HASH256 ' +                  // [.. base entries H_A]
    'OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' +     // commit H_A
    'OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY ' + // self-preserve locking
    'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY ' + // preserve category
    dropBaseEntries + 'OP_1'
  );
}

// covenant B: verify the A->B hash, pure-ladder from the checkpoint to the pubkey, commit it, self-preserve.
const PROD_B_BASE = ['Cblob', 'Zinv', 'masks', 'tbl', 'start', 'chunkA'];
const PARSE_B =
  '<4> OP_ROLL OP_DROP ' +                                          // drop pad -> [argBlob sharedBlob Cblob Zinv]
  '<3> OP_PICK <3> OP_PICK <3> OP_PICK OP_CAT OP_CAT OP_HASH256 ' + // H_A = hash256(argBlob||sharedBlob||Cblob)
  'OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' + // == side-car A's output commitment (prev index)
  '<3> OP_ROLL OP_DROP ' +                                          // drop argBlob -> [sharedBlob Cblob Zinv]
  '<2> OP_ROLL ' +                                                  // [Cblob Zinv sharedBlob]
  `${num(128n)} OP_SPLIT ${num(1056n)} OP_SPLIT ` +                 // masks tbl
  '<1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP <1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP OP_DROP'; // start chunkA (+drop empty)
function covenantB() {
  const body = covBBody(false, PROD_B_BASE).asm;                   // pure ladder + affine + compress -> compressed Q
  return (
    SALT_CHECK + PARSE_B + ' ' + DEFS + ' ' + body + ' ' +          // [PROD_B_BASE(6) entries(16) compressedQ]
    'OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' +      // commit the recovered pubkey to B's output
    'OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY ' + // self-preserve
    'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY ' +
    'OP_2DROP '.repeat(11) + 'OP_1'                                // drop the 6 base + 16 entries below the result (22)
  );
}

// ---- off-chain witness for a signature (LE bytes32 convention: SDK reverses ethers BE) ----
function witnessFor(digestHex, v, rr, ss) {
  const rec = v - 27, z = mod(BigInt(digestHex), N), Fp = secp256k1.CURVE.Fp;
  const Ry = (() => { const y = Fp.sqrt(mod(mod(rr * rr, P) * rr + 7n, P)); return (y & 1n) === BigInt(rec & 1) ? y : mod(P - y, P); })();
  const rinv = invN(rr), u1 = mod(mod(-z, N) * rinv, N), u2 = mod(ss * rinv, N), phiRx = mod(BETA * rr, P);
  const sp1 = splitScalar(u1), sp2 = splitScalar(u2);
  const t1a = recTerm(sp1.k1neg, sp1.k1), t2a = recTerm(sp1.k2neg, sp1.k2), t1b = recTerm(sp2.k1neg, sp2.k1), t2b = recTerm(sp2.k2neg, sp2.k2);
  const scalars = [sp1.k1, sp1.k2, sp2.k1, sp2.k2];
  const masks = []; for (let i = 127; i >= 0; i--) { let m = 0; for (let j = 0; j < 4; j++) if ((scalars[j] >> BigInt(i)) & 1n) m |= (1 << j); masks.push(m); }
  const neg = (x, ny, isNeg) => secp256k1.ProjectivePoint.fromAffine({ x, y: isNeg ? mod(-ny, P) : ny });
  const bases = [neg(GX, GY, sp1.k1neg), neg(PHIGX, GY, sp1.k2neg), neg(rr, Ry, sp2.k1neg), neg(phiRx, Ry, sp2.k2neg)];
  const ta = []; for (let m = 0; m < 16; m++) { let a = null; for (let i = 0; i < 4; i++) if (m & (1 << i)) a = a ? a.add(bases[i]) : bases[i]; ta.push(a ? a.toAffine() : null); }
  const tbl = new Uint8Array(16 * 66); for (let m = 1; m < 16; m++) { tbl.set(to33(ta[m].x), m * 66); tbl.set(to33(ta[m].y), m * 66 + 33); }
  const basesAff = bases.map((b) => b.toAffine());
  const invb = new Uint8Array(11 * 33);
  [[3, 2, 0], [5, 4, 0], [6, 4, 1], [7, 6, 0], [9, 8, 0], [10, 8, 1], [11, 10, 0], [12, 8, 2], [13, 12, 0], [14, 12, 1], [15, 14, 0]]
    .forEach(([, pred, bi], k) => invb.set(to33(invP(mod(basesAff[bi].x - ta[pred].x, P))), k * 33));
  const start = masks.findIndex((m) => m !== 0), rest = masks.slice(start + 1);
  const accs = [[ta[masks[start]].x, ta[masks[start]].y, 1n]];
  for (let i = 0; i < rest.length; i++) { let a = jDbl(accs[i]); const m = rest[i]; if (m) a = jAdd(a, ta[m].x, ta[m].y); accs.push(a); }
  return { negZ: mod(-z, N), rr, ss, rec, rinv, Ry, phiRx, t1a, t2a, t1b, t2b,
    masks: new Uint8Array(masks), tbl, invb, start, accs, rest };
}
const le32 = (v) => { const b = to33(v); const o = new Uint8Array(32); o.set(b.subarray(0, 32)); return o; }; // 32-byte LE

async function main() {
  console.log('=== production covenant A: blob-parse + self-verify + ladder -> correct checkpoint C ===');
  const w = ethers.Wallet.createRandom(); const sig = await w.signMessage('prod');
  const digest = ethers.hashMessage('prod'); const { r, s, v } = ethers.Signature.from(sig);
  const rr = BigInt(r), ss = BigInt(s);
  const wit = witnessFor(digest, v, rr, ss);
  const CHUNKA = Number(process.env.CHUNKA || 57);
  // build the blobs (LE): argBlob = hash||v||r||s ; sharedBlob = masks||tbl||start||chunkA ; aBlob = helpers
  const argBlob = Uint8Array.from([...le32(mod(BigInt(digest), N) === 0n ? 0n : BigInt(digest)), v, ...le32(rr), ...le32(ss)]);
  const sharedBlob = Uint8Array.from([...wit.masks, ...wit.tbl, wit.start, CHUNKA]);
  const aBlob = Uint8Array.from([...to33(wit.rinv), ...to33(wit.Ry), ...to33(wit.phiRx), ...to33(wit.t1a), ...to33(wit.t2a), ...to33(wit.t1b), ...to33(wit.t2b), ...wit.invb]);
  const Cexp = accBlob(wit.accs[CHUNKA]);
  // DEBUG: run PARSE_A alone, dump the 16 base values, compare to the witness
  {
    const dbgLock = asm(`${PARSE_A}`);
    const dbgUn = asm(`<0x${binToHex(new Uint8Array(200))}> <0x${binToHex(Uint8Array.from([...le32(BigInt(digest)), v, ...le32(rr), ...le32(ss)]))}> <0x${binToHex(Uint8Array.from([...wit.masks, ...wit.tbl, wit.start, CHUNKA]))}> <0x${binToHex(Uint8Array.from([...to33(wit.rinv), ...to33(wit.Ry), ...to33(wit.phiRx), ...to33(wit.t1a), ...to33(wit.t2a), ...to33(wit.t1b), ...to33(wit.t2b), ...wit.invb]))}>`);
    const d = vm.evaluate({ inputIndex: 0, sourceOutputs: [{ lockingBytecode: dbgLock, valueSatoshis: 1000n }], transaction: { version: 2, locktime: 0, inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: dbgUn }], outputs: [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }] } });
    const { vmNumberToBigInt } = await import('@bitauth/libauth');
    const dec = (b) => vmNumberToBigInt(b, { requireMinimalEncoding: false });
    const st2 = d.stack ?? [];
    console.log(`  DEBUG parse: depth=${st2.length} (want 16) err=${d.error ? d.error.slice(0, 40) : 'none'}`);
    if (st2.length === 16) {
      console.log(`    negZ ok=${dec(st2[0]) === wit.negZ}  recPar ok=${dec(st2[1]) === BigInt(wit.rec)}  r ok=${dec(st2[2]) === rr}  s ok=${dec(st2[3]) === ss}`);
      console.log(`    start ok=${dec(st2[6]) === BigInt(wit.start)}  chunkA ok=${dec(st2[7]) === BigInt(CHUNKA)}  rinv ok=${dec(st2[8]) === wit.rinv}  Ry ok=${dec(st2[9]) === wit.Ry}`);
      console.log(`    masks len=${st2[4].length}(128) tbl len=${st2[5].length}(1056) invb len=${st2[15].length}(363)`);
    }
  }
  const covA = asm(covenantA()), covB = asm(covenantB());
  const padFor = (witBytes) => new Uint8Array(Math.max(0, 9950 - witBytes)); // fill scriptSig to ~10000 for full budget
  const Zinv = invP(wit.accs[wit.accs.length - 1][2]);
  const [Qx, Qy] = (() => { const j = wit.accs[wit.accs.length - 1], zi = invP(j[2]), z2 = mod(zi * zi, P); return [mod(j[0] * z2, P), mod(j[1] * z2 * zi, P)]; })();
  const compQ = new Uint8Array(34); compQ[0] = 2 + Number(Qy & 1n); compQ.set(to33(Qx), 1);
  const expQ = secp256k1.ProjectivePoint.fromHex(ethers.SigningKey.recoverPublicKey(digest, sig).slice(2)).toAffine();
  const CATA = new Uint8Array(32).fill(0xa1), CATB = new Uint8Array(32).fill(0xb2);
  const tok = (cat, commitment) => ({ category: cat, amount: 0n, nft: { capability: 'mutable', commitment } });
  const push = (b) => `<0x${binToHex(b)}>`;
  const Hexp = sha256d(Uint8Array.from([...argBlob, ...sharedBlob, ...Cexp]));
  // bare-covenant mock of P2SH: push a 32-byte SHARED salt on top (the real redeem's 0x20||salt prefix does this)
  const SALT0 = new Uint8Array(32);
  const unlockA = asm(`${push(padFor(argBlob.length + sharedBlob.length + aBlob.length + 32))} ${push(argBlob)} ${push(sharedBlob)} ${push(aBlob)} ${push(SALT0)}`);
  const unlockB = asm(`${push(padFor(argBlob.length + sharedBlob.length + Cexp.length + 34 + 32))} ${push(argBlob)} ${push(sharedBlob)} ${push(Cexp)} ${num(Zinv)} ${push(SALT0)}`);
  const tx = { version: 2, locktime: 0,
    inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: unlockA },
             { outpointIndex: 1, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff, unlockingBytecode: unlockB }],
    outputs: [{ lockingBytecode: covA, valueSatoshis: 1000n, token: tok(CATA, Hexp) },
             { lockingBytecode: covB, valueSatoshis: 1000n, token: tok(CATB, compQ) }] };
  const sourceOutputs = [{ lockingBytecode: covA, valueSatoshis: 1000n, token: tok(CATA, new Uint8Array(32)) },
                        { lockingBytecode: covB, valueSatoshis: 1000n, token: tok(CATB, new Uint8Array(34)) }];
  const rA = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction: tx });
  const rB = vm.evaluate({ inputIndex: 1, sourceOutputs, transaction: tx });
  const qMatch = Qx === expQ.x && Qy === expQ.y;
  console.log(`  covenant A (verify + ladder -> H_A commit + self-preserve): ${!rA.error}  cost=${rA.metrics?.operationCost} ${rA.error ? '(' + rA.error.slice(0, 55) + ')' : ''}`);
  console.log(`  covenant B (verify H_A + ladder -> Q commit + self-preserve): ${!rB.error}  cost=${rB.metrics?.operationCost} ${rB.error ? '(' + rB.error.slice(0, 55) + ')' : ''}`);
  console.log(`  recovered pubkey Q == ethers: ${qMatch}`);
  console.log(`  covA=${covA.length}B covB=${covB.length}B`);
  console.log(`\n  PRODUCTION RECOVERY COVENANT PAIR: ${!rA.error && !rB.error && qMatch ? 'WORKS (deploy + spend + Q correct + self-preserving)' : 'FAIL'}`);
  if (!rA.error && !rB.error && qMatch && process.env.GEN) {
    console.log('\n--- covenant hexes for packages/utils/src/ecrecover-compute-library.ts ---');
    console.log('A_COVENANT =', binToHex(covA));
    console.log('A_COVENANT_HASH =', binToHex(sha256d(covA)));
    console.log('B_COVENANT =', binToHex(covB));
    console.log('B_COVENANT_HASH =', binToHex(sha256d(covB)));
  }
}
main().catch((e) => { console.error('ERR', e.stack || e.message); process.exit(1); });
