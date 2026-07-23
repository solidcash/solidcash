// FINISHED sound recovery: one per-signature covenant that (input 0) BINDS to (hash,v,r,s) - verifies rinv, Ry,
// phiR, u1,u2, GLV split, and reconstructs the scalars from the baked mask blob - then runs the GLV 4-way Shamir
// ladder across co-spent inputs in ONE transaction, checkpoint-chained. Exposes recover(digest,v,r,s) -> {tx, Q,
// address, valid}. Verified vs ethers + negatives (forged witness / mask / checkpoint all fail closed).
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { E, P } from './emit.mjs';
import { emitJdbl, emitJaddMixed } from './group.mjs';

const vm = createVirtualMachineBch2026();
export const asm = (s) => { const r = assembleBytecodeBch(s); if (!r.success) throw new Error('asm: ' + JSON.stringify(r.errors) + ' | ' + s.slice(0, 200)); return r.bytecode; };
const num = (v) => (v === 0n ? 'OP_0' : `<0x${binToHex(bigIntToVmNumber(v))}>`);
const N = secp256k1.CURVE.n, BETA = secp256k1.CURVE.endo.beta;
const LAMBDA = 0x5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72n;
const mod = (a, m) => ((a % m) + m) % m;
const invP = (a) => { let [g, x] = [mod(a, P), P], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, P); };
const invN = (a) => { let [g, x] = [mod(a, N), N], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, N); };
const jAff = ([X, Y, Z]) => { const zi = invP(Z), z2 = mod(zi * zi, P); return [mod(X * z2, P), mod(Y * z2 * zi, P)]; };
const Pt = (x, y) => secp256k1.ProjectivePoint.fromAffine({ x, y });
const pN = num(N), pP = num(P), muln = `OP_MUL ${pN} OP_MOD`, mulp = `OP_MUL ${pP} OP_MOD`;

function splitScalar(k) {
  const a1 = 0x3086d221a7d46bcde86c90e49284eb15n, b1 = -0xe4437ed6010e88286f547fa90abfe4c3n;
  const a2 = 0x114ca50f7a8e2f3f657c1108d9d44cfd8n, b2 = a1, POW = 1n << 128n, dn = (x, y) => (x + y / 2n) / y;
  const c1 = dn(b2 * k, N), c2 = dn(-b1 * k, N);
  let k1 = mod(k - c1 * a1 - c2 * a2, N), k2 = mod(-c1 * b1 - c2 * b2, N);
  const k1neg = k1 > POW, k2neg = k2 > POW; if (k1neg) k1 = N - k1; if (k2neg) k2 = N - k2;
  return { k1neg, k1, k2neg, k2 };
}
const glvRecomb = (sp) => { const t1 = sp.k1neg ? mod(-sp.k1, N) : sp.k1, t2 = sp.k2neg ? mod(-sp.k2, N) : sp.k2; return `${num(t2)} ${num(LAMBDA)} ${muln} ${num(t1)} OP_ADD ${pN} OP_MOD`; };
function jDbl([X1, Y1, Z1]) { const A = mod(X1 * X1, P), B = mod(Y1 * Y1, P), C = mod(B * B, P); const D = mod(2n * mod((X1 + B) * (X1 + B) - A - C, P), P), Ee = mod(3n * A, P), F = mod(Ee * Ee, P); const X3 = mod(F - 2n * D, P); return [X3, mod(Ee * (D - X3) - 8n * C, P), mod(2n * Y1 * Z1, P)]; }
function jAdd([X1, Y1, Z1], x2, y2) { const Z1Z1 = mod(Z1 * Z1, P), U2 = mod(x2 * Z1Z1, P), S2 = mod(y2 * Z1 * Z1Z1, P); const H = mod(U2 - X1, P), HH = mod(H * H, P), I = mod(4n * HH, P), J = mod(H * I, P); const r = mod(2n * (S2 - Y1), P), V = mod(X1 * I, P); const X3 = mod(r * r - J - 2n * V, P); return [X3, mod(r * (V - X3) - 2n * Y1 * J, P), mod((Z1 + H) * (Z1 + H) - Z1Z1 - HH, P)]; }

const to33 = (v) => { const b = new Uint8Array(33); b.set(bigIntToVmNumber(v)); return b; };
const accBlob = ([X, Y, Z]) => { const b = new Uint8Array(99); b.set(to33(X), 0); b.set(to33(Y), 33); b.set(to33(Z), 66); return b; };

// DOUBLE/ADD (no O-handling; the ladder inits acc = table[first nonzero mask], so acc is never O in the hot loop).
const DEFS = (() => {
  const db = new E(); db.stk = ['X', 'Y', 'Z']; emitJdbl(db, []);
  const ad = new E(); ad.stk = ['X', 'Y', 'Z', 'X2', 'Y2']; ad.relabel('X', 'X1').relabel('Y', 'Y1').relabel('Z', 'Z1'); emitJaddMixed(ad, []);
  return `<0x${binToHex(asm(db.asm()))}> <0x10> OP_DEFINE <0x${binToHex(asm(ad.asm()))}> <0x11> OP_DEFINE`;
})();
const COMBINE3 = 'OP_TOALTSTACK OP_TOALTSTACK <33> OP_NUM2BIN OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT';
const DECODE3 = '<33> OP_SPLIT <33> OP_SPLIT OP_BIN2NUM OP_TOALTSTACK OP_BIN2NUM OP_TOALTSTACK OP_BIN2NUM OP_FROMALTSTACK OP_FROMALTSTACK';
// ONE-PASS packed reconstruction: pack the 4 scalars as combined = s0 + s1*2^128 + s2*2^256 + s3*2^384 and
// reconstruct `combined` from the mask blob in a single loop (per mask: combined = 2*combined + term[mask], where
// term[mask] places the mask's 4 bits at the 2^128 boundaries). termHex = 16 entries x 65 bytes, baked.
const reconstructPacked = (termHex) => `OP_0 OP_SWAP OP_BEGIN OP_1 OP_SPLIT OP_SWAP OP_BIN2NUM <0x41> OP_MUL <0x${termHex}> OP_SWAP OP_SPLIT OP_NIP <0x41> OP_SPLIT OP_DROP OP_BIN2NUM OP_ROT OP_DUP OP_ADD OP_ADD OP_SWAP OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP`;
// GLV 4-way Shamir loop; masks read from a blob on top; table baked; [X Y Z maskblob] -> [X' Y' Z']
const shamirLoop4 = (tableHex) => 'OP_BEGIN OP_TOALTSTACK <0x10> OP_INVOKE OP_FROMALTSTACK OP_1 OP_SPLIT OP_TOALTSTACK OP_BIN2NUM OP_DUP OP_0 OP_NUMEQUAL OP_IF OP_DROP OP_ELSE ' + `<0x42> OP_MUL <0x${tableHex}> OP_SWAP OP_SPLIT OP_NIP <0x42> OP_SPLIT OP_DROP <33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP <0x11> OP_INVOKE OP_ENDIF ` + 'OP_FROMALTSTACK OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP';

// per-signature covenant. bakes z,r,s,rec,rinv,Ry,phiRx,scalars,table,maskBlob,offsets; input 0 verifies + runs chunk 0.
function covenant(b) {
  const preamble =
    `${num(b.r)} ${num(b.rinv)} ${muln} OP_1 OP_NUMEQUALVERIFY ` +
    `${num(b.Ry)} ${num(b.Ry)} ${mulp} ${num(b.r)} ${num(b.r)} ${mulp} ${num(b.r)} ${mulp} <0x07> OP_ADD ${pP} OP_MOD OP_NUMEQUALVERIFY ` +
    `${num(b.Ry)} <0x02> OP_MOD ${num(BigInt(b.rec & 1))} OP_NUMEQUALVERIFY ` +
    `${num(BETA)} ${num(b.r)} ${mulp} ${num(b.phiRx)} OP_NUMEQUALVERIFY ` +
    `${num(mod(-b.z, N))} ${num(b.rinv)} ${muln} ${glvRecomb(b.s1)} OP_NUMEQUALVERIFY ` +
    `${num(b.s)} ${num(b.rinv)} ${muln} ${glvRecomb(b.s2)} OP_NUMEQUALVERIFY ` +
    // reconstruct the packed scalars from the baked mask blob (one pass) and check == the packed (verified) scalars
    `<0x${b.maskHex}> ${reconstructPacked(b.termHex)} ${num(b.packed)} OP_NUMEQUALVERIFY`;
  // chunk masks for this input come from the baked blob (split by this input's offset/len)
  const myChunk = `<0x${b.maskHex}> ${num(BigInt(b.ladderBase + b.off))} OP_SPLIT OP_NIP ${num(BigInt(b.len))} OP_SPLIT OP_DROP`;
  return (
    'OP_DROP OP_DUP ' +                                   // [accInBlob accInBlob]
    'OP_INPUTINDEX OP_0 OP_NUMEQUAL OP_IF ' +
    `<0x${b.baseHex}> OP_EQUALVERIFY ${preamble} ` +      // input 0: acc==base + full binding verification
    'OP_ELSE OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY OP_ENDIF ' +
    `${DECODE3} ${myChunk} ` +                            // [X Y Z myMaskChunk]  (chunk from baked verified blob)
    `${DEFS} ${shamirLoop4(b.tableHex)} ${COMBINE3} ` +
    'OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY OP_1'
  );
}

// build the whole recovery for a signature; returns tx + Q + validation. opts.tamper in {Ry,mask,checkpoint} for tests.
export function recover(digestHex, v, rr, ss, { chunk = 60, tamper } = {}) {
  const rec = v - 27, z = BigInt(digestHex) % N, Fp = secp256k1.CURVE.Fp;
  let Ry = (() => { const y = Fp.sqrt(mod(mod(rr * rr, P) * rr + 7n, P)); return (y & 1n) === BigInt(rec & 1) ? y : mod(P - y, P); })();
  const rinv = invN(rr); let u1 = mod(mod(-z, N) * rinv, N), u2 = mod(ss * rinv, N), phiRx = mod(BETA * rr, P);
  const s1 = splitScalar(u1), s2 = splitScalar(u2);
  const { x: gx, y: gy } = secp256k1.ProjectivePoint.BASE.toAffine();
  const neg = (pt, isNeg) => isNeg ? Pt(pt.x, mod(-pt.y, P)) : pt;
  const bases = [neg(Pt(gx, gy), s1.k1neg), neg(Pt(mod(BETA * gx, P), gy), s1.k2neg), neg(Pt(rr, Ry), s2.k1neg), neg(Pt(phiRx, Ry), s2.k2neg)];
  const scalars = [s1.k1, s1.k2, s2.k1, s2.k2];
  const table = []; for (let m = 0; m < 16; m++) { let a = null; for (let i = 0; i < 4; i++) if (m & (1 << i)) a = a ? a.add(bases[i]) : bases[i]; table.push(a); }
  const tableBytes = new Uint8Array(16 * 66); for (let m = 1; m < 16; m++) { const a = table[m].toAffine(); tableBytes.set(to33(a.x), m * 66); tableBytes.set(to33(a.y), m * 66 + 33); }
  const tableHex = binToHex(tableBytes), tableAff = table.map((t) => t && t.toAffine());
  const masks = []; for (let i = 127; i >= 0; i--) { let m = 0; for (let j = 0; j < 4; j++) if ((scalars[j] >> BigInt(i)) & 1n) m |= (1 << j); masks.push(m); }
  const maskHex = binToHex(new Uint8Array(masks)); // FULL 128-mask blob; reconstruction binds it to the scalars
  const start = masks.findIndex((m) => m !== 0);   // init acc = table[first nonzero mask] (no O in the hot loop)
  const a0 = tableAff[masks[start]]; const acc0 = [a0.x, a0.y, 1n];
  const rest = masks.slice(start + 1);
  const ladderBase = start + 1;                    // ladder chunks index into the full blob starting here

  // asymmetric: input 0 carries the verification preamble, so it takes the remainder; inputs 1+ take `chunk` ladder
  // bits each (kept safely under budget). For a 127-bit ladder this is [61, 66] = 2 inputs.
  const first = Math.max(1, rest.length - chunk);
  const chunkList = [[0, first]]; for (let i = first; i < rest.length; i += chunk) chunkList.push([i, Math.min(chunk, rest.length - i)]);
  const K = chunkList.length;
  const stepJS = (a, off, len) => { let p = a; for (let i = off; i < off + len; i++) { p = jDbl(p); const m = rest[i]; if (m) p = jAdd(p, tableAff[m].x, tableAff[m].y); } return p; };
  const checkpoints = []; let a = acc0; for (const [off, len] of chunkList) { a = stepJS(a, off, len); checkpoints.push(a); }
  const Qj = checkpoints[K - 1], [Qx, Qy] = jAff(Qj);

  // packed reconstruction params: combined = s0 + s1*2^128 + s2*2^256 + s3*2^384; term[m] places m's bits at those boundaries
  const B = 1n << 128n;
  const packed = scalars[0] + scalars[1] * B + scalars[2] * B * B + scalars[3] * B * B * B;
  const termBytes = new Uint8Array(16 * 65);
  for (let m = 0; m < 16; m++) { let term = 0n; for (let j = 0; j < 4; j++) if (m & (1 << j)) term += B ** BigInt(j); const t = bigIntToVmNumber(term); termBytes.set(t, m * 65); }
  const termHex = binToHex(termBytes);

  if (tamper === 'Ry') Ry = mod(Ry + 2n, P);         // negative-test corruptions
  const maskHexT = tamper === 'mask' ? (maskHex.slice(0, -2) + ((parseInt(maskHex.slice(-2), 16) ^ 1).toString(16).padStart(2, '0'))) : maskHex;
  const CAT = new Uint8Array(32).fill(0x33);
  const baked = { z, r: rr, s: ss, rec, rinv, Ry, phiRx, s1, s2, scalars, maskHex: maskHexT, tableHex, ladderBase, termHex, packed,
    baseHex: binToHex(accBlob(acc0)), off: 0, len: 0 };
  const covs = chunkList.map(([off, len]) => asm(covenant({ ...baked, off, len })));
  const pad = `<0x${'00'.repeat(9860)}>`;
  const unlock = (accIn) => asm(`<0x${binToHex(accBlob(accIn))}> ${pad}`);
  const tok = (commitment) => ({ category: CAT, amount: 0n, nft: { capability: 'none', commitment } });
  const accIns = [acc0, ...checkpoints.slice(0, K - 1)];
  const transaction = { version: 2, locktime: 0,
    inputs: chunkList.map((_, j) => ({ outpointIndex: j, outpointTransactionHash: new Uint8Array(32).fill(j), sequenceNumber: 0xffffffff, unlockingBytecode: unlock(accIns[j]) })),
    outputs: checkpoints.map((cp) => ({ lockingBytecode: new Uint8Array(25), valueSatoshis: 1000n, token: tok(accBlob(cp)) })) };
  const sourceOutputs = chunkList.map((_, j) => ({ lockingBytecode: covs[j], valueSatoshis: 1000n, token: tok(accBlob(accIns[j])) }));
  let valid = true, maxCost = 0;
  for (let j = 0; j < K; j++) { const st = vm.evaluate({ inputIndex: j, sourceOutputs, transaction }); if (st.error) { valid = false; if (globalThis.__ecdbg) console.log(`  input ${j}: ${st.error.slice(0, 80)}`); } maxCost = Math.max(maxCost, st.metrics?.operationCost ?? 0); }
  return { transaction, sourceOutputs, Qx, Qy, valid, K, maxCost, covLen: covs[0].length, checkpoints, tok, CAT };
}
// reconstruct the 4 scalar values FROM the `rest` mask stream (must match what the covenant checks)
function reconstructScalars(rest) { const s = [0n, 0n, 0n, 0n]; for (const m of rest) for (let j = 0; j < 4; j++) s[j] = s[j] * 2n + BigInt((m >> j) & 1); return s; }
const to2 = (n) => n.toString(16).padStart(2, '0');

// address from Q
export function addressOf(ethers, Qx, Qy) {
  const pub = new Uint8Array(64);
  const put = (val, off) => { const h = val.toString(16).padStart(64, '0'); for (let i = 0; i < 32; i++) pub[off + i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); };
  put(Qx, 0); put(Qy, 32);
  return ethers.getAddress('0x' + Buffer.from(ethers.keccak256(pub).slice(2), 'hex').slice(12).toString('hex'));
}
// revalidate input 1 after corrupting a checkpoint (negative test)
function checkpointRejects(res) {
  if (res.K < 2) return true;
  const cp0 = res.checkpoints[0];
  const bad = new Uint8Array(99); bad.set(res.sourceOutputs[1].token.nft.commitment); bad[0] ^= 1;
  const badTx = { ...res.transaction, outputs: res.transaction.outputs.map((o, i) => i === 0 ? { ...o, token: { ...o.token, nft: { ...o.token.nft, commitment: bad } } } : o) };
  const badSrc = res.sourceOutputs.map((so, i) => i === 1 ? { ...so, token: { ...so.token, nft: { ...so.token.nft, commitment: bad } } } : so);
  return !!vm.evaluate({ inputIndex: 1, sourceOutputs: badSrc, transaction: badTx }).error;
}

// ---- e2e driver ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const { ethers } = await import('ethers');
  console.log('=== FINISHED sound recovery: recover(digest,v,r,s) end-to-end vs ethers ===');
  let pass = 0, total = 0, inputs = 0;
  for (let t = 0; t < 4; t++) {
    const wallet = ethers.Wallet.createRandom();
    const msg = 'finish ' + t;
    const sig = await wallet.signMessage(msg);
    const digest = ethers.hashMessage(msg);
    const ethAddr = ethers.recoverAddress(digest, sig);
    const { r, s, v } = ethers.Signature.from(sig);
    const res = recover(digest, v, BigInt(r), BigInt(s), { chunk: 66 });
    const okAddr = addressOf(ethers, res.Qx, res.Qy).toLowerCase() === ethAddr.toLowerCase();
    total++; inputs = res.K; if (res.valid && okAddr) pass++;
    console.log(`  sig ${t}: ${res.K} inputs, ~${res.maxCost}/input, cov ${res.covLen}B | valid=${res.valid} addr match=${okAddr} ${res.valid && okAddr ? 'OK' : 'FAIL'}`);
  }
  console.log(`  -> recover() correct on ${pass}/${total} ethers signatures (${inputs} inputs each)`);

  // negatives: forged witness / mask / checkpoint must all fail closed
  const w = ethers.Wallet.createRandom(); const sig = await w.signMessage('neg'); const dg = ethers.hashMessage('neg'); const { r, s, v } = ethers.Signature.from(sig);
  const badRy = !recover(dg, v, BigInt(r), BigInt(s), { chunk: 66, tamper: 'Ry' }).valid;
  const badMask = !recover(dg, v, BigInt(r), BigInt(s), { chunk: 66, tamper: 'mask' }).valid;
  const badCp = checkpointRejects(recover(dg, v, BigInt(r), BigInt(s), { chunk: 66 }));
  console.log(`\n  NEGATIVES: forged Ry rejected=${badRy}  forged mask rejected=${badMask}  tampered checkpoint rejected=${badCp}`);
  console.log(`  SOUND + ATOMIC + 2-INPUT: ${pass === total && badRy && badMask && badCp && inputs <= 2 ? 'YES' : 'inputs=' + inputs + ' (not all conditions met)'}`);
}
