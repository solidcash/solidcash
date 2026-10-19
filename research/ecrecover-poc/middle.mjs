// cspell:ignore CHUNKM
// 3-COVENANT recovery split (A -> middle -> B) for width-0 signatures whose GLV ladder cannot fit a 2-input
// split. A runs sig+mask+table verification and ladders to checkpoint C1 (commits H_A). The middle covenant M is a
// PURE ladder from C1 to a second checkpoint C2 (commits H_M). B ladders from C2 to the recovered pubkey (verifies
// H_M). This proves the body math on the real BCH-2026 VM vs ethers, then generates the deployable covenant hexes.
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, bigIntToVmNumber, vmNumberToBigInt, hash256 as sha256d } from '@bitauth/libauth';
import {
  asm, num, N, P, BETA, mod, invP, invN, splitScalar, recTerm, jDbl, jAdd, to33, accBlob,
  DEFS, COMBINE3, SHAMIR_PRESPLIT, DECODE3, AFFINE, V, covABody, GX, GY, PHIGX,
} from './engine.mjs';

const vm = createVirtualMachineBch2026();

// Middle covenant body: pure ladder from C1 over (chunkM - chunkA) steps -> C2 checkpoint blob.
const M_BASE = ['Cblob', 'masks', 'tbl', 'start', 'chunkA', 'chunkM'];
function covMBody(base = M_BASE) {
  const v = V(base);
  v.presplit();                                        // tbl -> e0..e15 (reusable pre-split entries)
  v.pk('Cblob').raw(DECODE3, -2);                      // C1 -> X Y Z
  v.pk('masks').pk('start').raw('OP_1ADD', 0).pk('chunkA').raw('OP_ADD OP_SPLIT OP_NIP', 2); // rest = masks[start+1+chunkA:]
  v.pk('chunkM').pk('chunkA').raw('OP_SUB OP_SPLIT OP_DROP', 2);                            // sliceM = rest[:chunkM-chunkA]
  v.raw(SHAMIR_PRESPLIT, 1);                           // ladder sliceM -> X Y Z (C2 Jacobian)
  v.raw(COMBINE3, 2);                                  // -> C2blob (99 B)
  return { v, asm: v.asm() };
}

// Modified B body: pure ladder from C2 over the remainder -> Q -> compressed pubkey.
const B2_BASE = ['Cblob', 'Zinv', 'masks', 'tbl', 'start', 'chunkA', 'chunkM'];
function covB2Body(base = B2_BASE) {
  const v = V(base);
  v.presplit();                                        // tbl -> e0..e15
  v.pk('Cblob').raw(DECODE3, -2);                      // C2 -> X Y Z
  v.pk('masks').pk('start').raw('OP_1ADD', 0).pk('chunkM').raw('OP_ADD OP_SPLIT OP_NIP', 2); // rest = masks[start+1+chunkM:]
  v.raw(SHAMIR_PRESPLIT, 1);                           // ladder rest -> X Y Z (Q Jacobian)
  v.pk('Zinv');
  v.raw(AFFINE, 1);                                    // -> Qx Qy zchk
  v.raw('OP_1 OP_NUMEQUALVERIFY', 1);
  v.raw('<0x02> OP_MOD <0x02> OP_ADD OP_1 OP_NUM2BIN OP_SWAP <33> OP_NUM2BIN OP_CAT', 1); // compressed Q
  return { v, asm: v.asm() };
}

// Witness for a signature (same GLV decomposition as engine.mjs / gen-ecrecover-sidecar.mjs).
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
  const w = ethers.Wallet.createRandom(); const sig = await w.signMessage('middle'); const digest = ethers.hashMessage('middle');
  const { r, s, v } = ethers.Signature.from(sig);
  const wit = witnessFor(digest, v, BigInt(r), BigInt(s));
  const L = wit.rest.length; // total ladder doubling steps
  const CHUNKA = 57, CHUNKM = Math.min(L - 1, 95); // example 3-way split (A:57, M:38, B:rest)
  const C1 = accBlob(wit.accs[CHUNKA]), C2 = accBlob(wit.accs[CHUNKM]);
  const Qjac = wit.accs[L], Zinv = invP(Qjac[2]);
  const [Qx, Qy] = (() => { const zi = invP(Qjac[2]), z2 = mod(zi * zi, P); return [mod(Qjac[0] * z2, P), mod(Qjac[1] * z2 * zi, P)]; })();
  const compQ = new Uint8Array(34); compQ[0] = 2 + Number(Qy & 1n); compQ.set(to33(Qx), 1);
  const expQ = secp256k1.ProjectivePoint.fromHex(ethers.SigningKey.recoverPublicKey(digest, sig).slice(2)).toAffine();
  const orderA = { negZ: wit.negZ, r: BigInt(r), s: BigInt(s), rinv: wit.rinv, Ry: wit.Ry, phiRx: wit.phiRx, recPar: BigInt(wit.rec & 1), t1a: wit.t1a, t2a: wit.t2a, t1b: wit.t1b, t2b: wit.t2b };
  const maskBlob = wit.masks;
  const sharedBlob = Uint8Array.from([...maskBlob, ...wit.tbl, wit.start, CHUNKA, CHUNKM]);
  const argBlob = Uint8Array.from([...le32(mod(BigInt(digest), N) === 0n ? 0n : BigInt(digest)), v, ...le32(BigInt(r)), ...le32(BigInt(s))]);
  const aBlob = Uint8Array.from([...to33(wit.rinv), ...to33(wit.Ry), ...to33(wit.phiRx), ...to33(wit.t1a), ...to33(wit.t2a), ...to33(wit.t1b), ...to33(wit.t2b), ...wit.invb]);

  // Bare-covenant runs: [witness pushes] OP_DROP(salt) DEFS body <exp> EQUALVERIFY <drops> OP_1
  const dropN = (n) => Array.from({ length: n }, () => 'OP_DROP').join(' ');
  const runInput = (bodyAsm, pushes, expBlob, nDrop, inputIndex) => {
    const lock = asm(`OP_DROP ${DEFS} ${bodyAsm} <0x${binToHex(expBlob)}> OP_EQUALVERIFY ${dropN(nDrop)} OP_1`);
    const sourceOutputs = [0, 1, 2].map((k) => ({ lockingBytecode: k === inputIndex ? lock : new Uint8Array(0), valueSatoshis: 1000n }));
    const witnessAsm = asm(pushes);
    const pad = Math.max(0, 9990 - witnessAsm.length);
    const unlocking = asm(`${pushes} <0x${'00'.repeat(pad)}>`);
    const transaction = { version: 2, locktime: 0, inputs: [0, 1, 2].map((k) => ({ outpointIndex: k, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: k === inputIndex ? unlocking : new Uint8Array() })), outputs: [0, 1, 2].map(() => ({ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n })) };
    return vm.evaluate({ inputIndex, sourceOutputs, transaction });
  };

  // A witnesses the full verify set + ladder chunkA -> C1.
  const pushA = `${Object.values(orderA).map(num).join(' ')} <0x${binToHex(maskBlob)}> <0x${binToHex(wit.tbl)}> <0x${binToHex(wit.invb)}> ${num(BigInt(wit.start))} ${num(BigInt(CHUNKA))}`;
  // M: pure ladder C1 -> C2.
  const pushM = `<0x${binToHex(C1)}> <0x${binToHex(maskBlob)}> <0x${binToHex(wit.tbl)}> ${num(BigInt(wit.start))} ${num(BigInt(CHUNKA))} ${num(BigInt(CHUNKM))}`;
  // B2: pure ladder C2 -> Q.
  const pushB = `<0x${binToHex(C2)}> ${num(Zinv)} <0x${binToHex(maskBlob)}> <0x${binToHex(wit.tbl)}> ${num(BigInt(wit.start))} ${num(BigInt(CHUNKA))} ${num(BigInt(CHUNKM))}`;

  const covA = covABody(0, true, ['negZ','r','s','rinv','Ry','phiRx','recPar','t1a','t2a','t1b','t2b','masks','tbl','invb','start','chunkA']).asm;
  const covM = covMBody().asm;
  const covB2 = covB2Body().asm;
  const rA = runInput(covA, pushA, C1, 32, 0);
  const rM = runInput(covM, pushM, C2, 22, 1);
  const rB2 = runInput(covB2, pushB, compQ, 23, 2);
  const qMatch = Qx === expQ.x && Qy === expQ.y;
  console.log(`A (sig+mask+table + ladder[0..${CHUNKA}]) -> C1: ${!rA.error} cost=${rA.metrics?.operationCost}${rA.error ? ' ' + rA.error.slice(0, 50) : ''}`);
  console.log(`M (ladder[${CHUNKA}..${CHUNKM}]) -> C2: ${!rM.error} cost=${rM.metrics?.operationCost}${rM.error ? ' ' + rM.error.slice(0, 50) : ''}`);
  console.log(`B (ladder[${CHUNKM}..${L}] -> Q): ${!rB2.error} cost=${rB2.metrics?.operationCost}${rB2.error ? ' ' + rB2.error.slice(0, 50) : ''}`);
  console.log(`recovered pubkey Q == ethers: ${qMatch}`);
  console.log(`covA=${covA.length}B covM=${covM.length}B covB=${covB2.length}B`);

  // Forge: M ladders from a WRONG C1 (tampered checkpoint) -> its C2 differs; B2 must fail the C2->Q ladder is not
  // directly checked here, so also forge B2's C2 and confirm the recovered Q no longer equals the expected one.
  const wrongC1 = accBlob([mod(wit.accs[CHUNKA][0] + 1n, P), wit.accs[CHUNKA][1], wit.accs[CHUNKA][2]]);
  const rMw = runInput(covM, `<0x${binToHex(wrongC1)}> <0x${binToHex(maskBlob)}> <0x${binToHex(wit.tbl)}> ${num(BigInt(wit.start))} ${num(BigInt(CHUNKA))} ${num(BigInt(CHUNKM))}`, C2, 12, 1);
  const wrongC2 = accBlob([mod(wit.accs[CHUNKM][0] + 1n, P), wit.accs[CHUNKM][1], wit.accs[CHUNKM][2]]);
  const rBw = runInput(covB2, `<0x${binToHex(wrongC2)}> ${num(Zinv)} <0x${binToHex(maskBlob)}> <0x${binToHex(wit.tbl)}> ${num(BigInt(wit.start))} ${num(BigInt(CHUNKA))} ${num(BigInt(CHUNKM))}`, compQ, 14, 2);
  console.log(`forged C1 rejected (M): ${rMw.error !== undefined}`);
  console.log(`forged C2 rejected (B): ${rBw.error !== undefined}`);
}

main().catch((e) => { console.error('ERR', e.stack || e.message); process.exit(1); });
