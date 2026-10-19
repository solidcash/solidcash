// cspell:ignore CATM CHUNKM
// PRODUCTION 3-COVENANT recovery split (A -> middle -> B) for width-0 signatures. Wraps the PROVEN middle.mjs
// ladder math with the blob-structured unlocking, the A->M and M->B checkpoint-hash chain, and self-preservation.
// A-unlock = <pad><argBlob><sharedBlob><aBlob><redeem>  (UNCHANGED from gen-ecrecover-sidecar.mjs)
// M-unlock = <pad><argBlob><sharedBlob><C1blob><redeem>
// B-unlock = <pad><argBlob><sharedBlob><C2blob><Zinv><redeem>
//   argBlob = hash(32)||v(1)||r(32)||s(32)
//   sharedBlob = masks(128)||tbl(16*66)||start(1)||chunkA(1)||chunkM(1)   (A hash-binds the whole blob incl. chunkM)
//   aBlob = rinv(33)||Ry(33)||phiRx(33)||t1a(33)||t2a(33)||t1b(33)||t2b(33)||invb(11*33)
// A verifies sig+mask+table and ladders [start..chunkA] -> C1 (commits H_A). M ladders [chunkA..chunkM] -> C2
// (commits H_M). B ladders [chunkM..] -> recovered pubkey (verifies H_M, commits Q). Soundness: each side-car
// self-verifies on its own budget; the hash chain binds the whole witness; the master body-hashes the covenants.
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, bigIntToVmNumber, hash256 as sha256d } from '@bitauth/libauth';
import {
  asm, num, N, P, BETA, mod, invP, invN, splitScalar, recTerm, jDbl, jAdd, to33, accBlob,
  DEFS, COMBINE3, SHAMIR_PRESPLIT, DECODE3, AFFINE, V, covABody, GX, GY, PHIGX,
} from './engine.mjs';

const vm = createVirtualMachineBch2026();
const SALT_CHECK = `OP_DUP <0x${'00'.repeat(32)}> OP_EQUAL OP_IF OP_DROP OP_ELSE OP_0 OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_DROP OP_EQUALVERIFY OP_ENDIF `;

// ---- covenant A (unchanged from the 2-input pair) ----
const PROD_A_BASE = ['negZ', 'recPar', 'r', 's', 'masks', 'tbl', 'start', 'chunkA', 'rinv', 'Ry', 'phiRx', 't1a', 't2a', 't1b', 't2b', 'invb'];
const PARSE_A =
  '<3> OP_ROLL OP_DROP ' +
  'OP_2 OP_PICK OP_TOALTSTACK OP_1 OP_PICK OP_TOALTSTACK ' +
  'OP_TOALTSTACK OP_TOALTSTACK ' +
  '<32> OP_SPLIT OP_SWAP <0x00> OP_CAT OP_BIN2NUM ' + num(N) + ' OP_MOD ' + num(N) + ' OP_SWAP OP_SUB OP_SWAP ' +
  '<1> OP_SPLIT OP_SWAP OP_BIN2NUM <0x1b> OP_SUB OP_SWAP ' +
  '<32> OP_SPLIT <0x00> OP_CAT OP_BIN2NUM OP_SWAP <0x00> OP_CAT OP_BIN2NUM OP_SWAP ' +
  'OP_FROMALTSTACK ' +
  `${num(128n)} OP_SPLIT ${num(1056n)} OP_SPLIT ` +
  '<1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP <1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP ' +
  'OP_DROP ' +
  'OP_FROMALTSTACK ' +
  '<33> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP '.repeat(7);
function covenantA() {
  const body = covABody(0, true, PROD_A_BASE).asm;
  const dropBaseEntries = 'OP_2DROP '.repeat(16);
  return (
    SALT_CHECK + PARSE_A + ' ' + DEFS + ' ' + body + ' ' +
    'OP_FROMALTSTACK OP_FROMALTSTACK ' +
    'OP_SWAP OP_CAT OP_SWAP OP_CAT OP_HASH256 ' +
    'OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' +
    'OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY ' +
    'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY ' +
    dropBaseEntries + 'OP_1'
  );
}

// ---- covenant M: verify H_A, pure ladder C1 -> C2, commit H_M ----
const PROD_M_BASE = ['Cblob', 'masks', 'tbl', 'start', 'chunkA', 'chunkM'];
function covMBody(base = PROD_M_BASE) {
  const v = V(base);
  v.presplit();
  v.pk('Cblob').raw(DECODE3, -2);
  v.pk('masks').pk('start').raw('OP_1ADD', 0).pk('chunkA').raw('OP_ADD OP_SPLIT OP_NIP', 2);
  v.pk('chunkM').pk('chunkA').raw('OP_SUB OP_SPLIT OP_DROP', 2);
  v.raw(SHAMIR_PRESPLIT, 1);
  v.raw(COMBINE3, 2);
  return { v, asm: v.asm() };
}
const PARSE_M =
  '<3> OP_ROLL OP_DROP ' +
  'OP_2 OP_PICK OP_TOALTSTACK OP_1 OP_PICK OP_TOALTSTACK ' +
  '<2> OP_PICK <2> OP_PICK <2> OP_PICK OP_CAT OP_CAT OP_HASH256 ' +
  'OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' +
  '<2> OP_ROLL OP_DROP ' +
  'OP_SWAP ' +
  `${num(128n)} OP_SPLIT ${num(1056n)} OP_SPLIT ` +
  '<1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP <1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP <1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP OP_DROP';
function covenantM() {
  const body = covMBody().asm;
  const dropBelow = 'OP_2DROP '.repeat(11); // 6 base + 16 entries = 22
  return (
    SALT_CHECK + PARSE_M + ' ' + DEFS + ' ' + body + ' ' +
    'OP_FROMALTSTACK OP_FROMALTSTACK ' +                        // [.. C2blob sharedBlobCopy argBlobCopy]
    'OP_SWAP OP_CAT OP_SWAP OP_CAT OP_HASH256 ' +               // H_M = hash256(argBlob||sharedBlob||C2blob)
    'OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' +  // commit H_M
    'OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY ' +
    'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY ' +
    dropBelow + 'OP_1'
  );
}

// ---- covenant B (3-way): verify H_M, pure ladder C2 -> Q, commit Q ----
const PROD_B2_BASE = ['Cblob', 'Zinv', 'masks', 'tbl', 'start', 'chunkA', 'chunkM'];
function covB2Body(base = PROD_B2_BASE) {
  const v = V(base);
  v.presplit();
  v.pk('Cblob').raw(DECODE3, -2);
  v.pk('masks').pk('start').raw('OP_1ADD', 0).pk('chunkM').raw('OP_ADD OP_SPLIT OP_NIP', 2);
  v.raw(SHAMIR_PRESPLIT, 1);
  v.pk('Zinv');
  v.raw(AFFINE, 1);
  v.raw('OP_1 OP_NUMEQUALVERIFY', 1);
  v.raw('<0x02> OP_MOD <0x02> OP_ADD OP_1 OP_NUM2BIN OP_SWAP <33> OP_NUM2BIN OP_CAT', 1);
  return { v, asm: v.asm() };
}
const PARSE_B2 =
  '<4> OP_ROLL OP_DROP ' +
  '<3> OP_PICK <3> OP_PICK <3> OP_PICK OP_CAT OP_CAT OP_HASH256 ' +
  'OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' +
  '<3> OP_ROLL OP_DROP ' +
  '<2> OP_ROLL ' +
  `${num(128n)} OP_SPLIT ${num(1056n)} OP_SPLIT ` +
  '<1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP <1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP <1> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP OP_DROP';
function covenantB2() {
  const body = covB2Body().asm;
  const dropBelow = 'OP_2DROP '.repeat(11) + 'OP_DROP '; // 7 base + 16 entries = 23
  return (
    SALT_CHECK + PARSE_B2 + ' ' + DEFS + ' ' + body + ' ' +
    'OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' +
    'OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY ' +
    'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY ' +
    dropBelow + 'OP_1'
  );
}

// ---- off-chain witness ----
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
    masks: new Uint8Array(masks), tbl, invb, start, accs, rest, ta };
}
const le32 = (v) => { const b = to33(v); const o = new Uint8Array(32); o.set(b.subarray(0, 32)); return o; };

async function main() {
  console.log('=== production 3-covenant recovery: A -> M -> B, H_A/H_M chain, self-preserving ===');
  const w = ethers.Wallet.createRandom(); const sig = await w.signMessage('middle-prod'); const digest = ethers.hashMessage('middle-prod');
  const { r, s, v } = ethers.Signature.from(sig);
  const wit = witnessFor(digest, v, BigInt(r), BigInt(s));
  const L = wit.rest.length;
  const CHUNKA = Number(process.env.CHUNKA || 57), CHUNKM = Number(process.env.CHUNKM || Math.min(L - 1, 95));
  const C1 = accBlob(wit.accs[CHUNKA]), C2 = accBlob(wit.accs[CHUNKM]);
  const Qjac = wit.accs[L], Zinv = invP(Qjac[2]);
  const [Qx, Qy] = (() => { const zi = invP(Qjac[2]), z2 = mod(zi * zi, P); return [mod(Qjac[0] * z2, P), mod(Qjac[1] * z2 * zi, P)]; })();
  const compQ = new Uint8Array(34); compQ[0] = 2 + Number(Qy & 1n); compQ.set(to33(Qx), 1);
  const expQ = secp256k1.ProjectivePoint.fromHex(ethers.SigningKey.recoverPublicKey(digest, sig).slice(2)).toAffine();
  const argBlob = Uint8Array.from([...le32(mod(BigInt(digest), N) === 0n ? 0n : BigInt(digest)), v, ...le32(BigInt(r)), ...le32(BigInt(s))]);
  const sharedBlob = Uint8Array.from([...wit.masks, ...wit.tbl, wit.start, CHUNKA, CHUNKM]);
  const aBlob = Uint8Array.from([...to33(wit.rinv), ...to33(wit.Ry), ...to33(wit.phiRx), ...to33(wit.t1a), ...to33(wit.t2a), ...to33(wit.t1b), ...to33(wit.t2b), ...wit.invb]);
  const covA = asm(covenantA()), covM = asm(covenantM()), covB = asm(covenantB2());
  const push = (b) => `<0x${binToHex(b)}>`;
  const padFor = (witBytes) => new Uint8Array(Math.max(0, 9950 - witBytes));
  const SALT0 = new Uint8Array(32);
  const unlockA = asm(`${push(padFor(argBlob.length + sharedBlob.length + aBlob.length + 32))} ${push(argBlob)} ${push(sharedBlob)} ${push(aBlob)} ${push(SALT0)}`);
  const unlockM = asm(`${push(padFor(argBlob.length + sharedBlob.length + C1.length + 32))} ${push(argBlob)} ${push(sharedBlob)} ${push(C1)} ${push(SALT0)}`);
  const unlockB = asm(`${push(padFor(argBlob.length + sharedBlob.length + C2.length + 34 + 32))} ${push(argBlob)} ${push(sharedBlob)} ${push(C2)} ${num(Zinv)} ${push(SALT0)}`);
  const HA = sha256d(Uint8Array.from([...argBlob, ...sharedBlob, ...C1]));
  const HM = sha256d(Uint8Array.from([...argBlob, ...sharedBlob, ...C2]));
  const CATA = new Uint8Array(32).fill(0xa1), CATM = new Uint8Array(32).fill(0xa2), CATB = new Uint8Array(32).fill(0xb2);
  const tok = (cat, commitment) => ({ category: cat, amount: 0n, nft: { capability: 'mutable', commitment } });
  const tx = { version: 2, locktime: 0,
    inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: unlockA },
             { outpointIndex: 1, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff, unlockingBytecode: unlockM },
             { outpointIndex: 2, outpointTransactionHash: new Uint8Array(32).fill(3), sequenceNumber: 0xffffffff, unlockingBytecode: unlockB }],
    outputs: [{ lockingBytecode: covA, valueSatoshis: 1000n, token: tok(CATA, HA) },
             { lockingBytecode: covM, valueSatoshis: 1000n, token: tok(CATM, HM) },
             { lockingBytecode: covB, valueSatoshis: 1000n, token: tok(CATB, compQ) }] };
  const sourceOutputs = [{ lockingBytecode: covA, valueSatoshis: 1000n, token: tok(CATA, new Uint8Array(32)) },
                        { lockingBytecode: covM, valueSatoshis: 1000n, token: tok(CATM, new Uint8Array(32)) },
                        { lockingBytecode: covB, valueSatoshis: 1000n, token: tok(CATB, new Uint8Array(34)) }];
  const rA = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction: tx });
  const rM = vm.evaluate({ inputIndex: 1, sourceOutputs, transaction: tx });
  const rB = vm.evaluate({ inputIndex: 2, sourceOutputs, transaction: tx });
  const qMatch = Qx === expQ.x && Qy === expQ.y;
  console.log(`  A (verify + ladder -> H_A commit): ${!rA.error}  cost=${rA.metrics?.operationCost} ${rA.error ? '(' + rA.error.slice(0, 55) + ')' : ''}`);
  console.log(`  M (verify H_A + ladder -> H_M commit): ${!rM.error}  cost=${rM.metrics?.operationCost} ${rM.error ? '(' + rM.error.slice(0, 55) + ')' : ''}`);
  console.log(`  B (verify H_M + ladder -> Q commit): ${!rB.error}  cost=${rB.metrics?.operationCost} ${rB.error ? '(' + rB.error.slice(0, 55) + ')' : ''}`);
  console.log(`  recovered pubkey Q == ethers: ${qMatch}`);
  console.log(`  covA=${covA.length}B covM=${covM.length}B covB=${covB.length}B`);
  const ok = !rA.error && !rM.error && !rB.error && qMatch;
  console.log(`\n  PRODUCTION 3-COVENANT RECOVERY: ${ok ? 'WORKS (A->M->B + Q correct + self-preserving)' : 'FAIL'}`);
  if (ok && process.env.GEN) {
    console.log('\n--- covenant hexes for packages/utils/src/ecrecover-compute-library.ts ---');
    console.log('M_COVENANT =', binToHex(covM));
    console.log('M_COVENANT_HASH =', binToHex(sha256d(covM)));
    console.log('B3_COVENANT =', binToHex(covB));
    console.log('B3_COVENANT_HASH =', binToHex(sha256d(covB)));
  }
}
main().catch((e) => { console.error('ERR', e.stack || e.message); process.exit(1); });
