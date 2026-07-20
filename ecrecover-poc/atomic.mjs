// ATOMIC + FULL + GLV-OPTIMIZED: an ethers.js signature recovered to its EVM address, the entire recovery
// (Q = u1*G + u2*R via GLV 4-way Shamir over a 128-bit ladder) executed as 2 co-spent inputs in ONE
// transaction, checkpoint-chained via output token commitments (introspection). Final input commits Q;
// its address is compared to ethers.recoverAddress. A tampered checkpoint is rejected (sound, fails closed).
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { E, P } from './emit.mjs';
import { emitJdbl, emitJaddMixed } from './group.mjs';

const vm = createVirtualMachineBch2026();
const asm = (s) => { const r = assembleBytecodeBch(s); if (!r.success) throw new Error('asm: ' + JSON.stringify(r.errors) + ' | ' + s.slice(0, 160)); return r.bytecode; };
const num = (v) => (v === 0n ? 'OP_0' : `<0x${binToHex(bigIntToVmNumber(v))}>`);
const N = secp256k1.CURVE.n, BETA = secp256k1.CURVE.endo.beta;
const mod = (a, m) => ((a % m) + m) % m;
const invP = (a) => { let [g, x] = [mod(a, P), P], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, P); };
const invN = (a) => { let [g, x] = [mod(a, N), N], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, N); };
const jAff = ([X, Y, Z]) => { const zi = invP(Z), z2 = mod(zi * zi, P); return [mod(X * z2, P), mod(Y * z2 * zi, P)]; };
const Pt = (x, y) => secp256k1.ProjectivePoint.fromAffine({ x, y });

function splitScalar(k) {
  const a1 = 0x3086d221a7d46bcde86c90e49284eb15n, b1 = -0xe4437ed6010e88286f547fa90abfe4c3n;
  const a2 = 0x114ca50f7a8e2f3f657c1108d9d44cfd8n, b2 = a1, POW = 1n << 128n, dn = (x, y) => (x + y / 2n) / y;
  const c1 = dn(b2 * k, N), c2 = dn(-b1 * k, N);
  let k1 = mod(k - c1 * a1 - c2 * a2, N), k2 = mod(-c1 * b1 - c2 * b2, N);
  const k1neg = k1 > POW, k2neg = k2 > POW; if (k1neg) k1 = N - k1; if (k2neg) k2 = N - k2;
  return { k1neg, k1, k2neg, k2 };
}
// JS Jacobian oracle (matches Script formulas)
function jDbl([X1, Y1, Z1]) {
  const A = mod(X1 * X1, P), B = mod(Y1 * Y1, P), C = mod(B * B, P);
  const D = mod(2n * mod((X1 + B) * (X1 + B) - A - C, P), P), Ee = mod(3n * A, P), F = mod(Ee * Ee, P);
  return [mod(F - 2n * D, P), mod(Ee * (D - mod(F - 2n * D, P)) - 8n * C, P), mod(2n * Y1 * Z1, P)];
}
function jAdd([X1, Y1, Z1], x2, y2) {
  const Z1Z1 = mod(Z1 * Z1, P), U2 = mod(x2 * Z1Z1, P), S2 = mod(y2 * Z1 * Z1Z1, P);
  const H = mod(U2 - X1, P), HH = mod(H * H, P), I = mod(4n * HH, P), J = mod(H * I, P);
  const r = mod(2n * (S2 - Y1), P), V = mod(X1 * I, P);
  const X3 = mod(r * r - J - 2n * V, P);
  return [X3, mod(r * (V - X3) - 2n * Y1 * J, P), mod((Z1 + H) * (Z1 + H) - Z1Z1 - HH, P)];
}

const to33 = (v) => { const b = new Uint8Array(33); b.set(bigIntToVmNumber(v)); return b; };
const accBlob = ([X, Y, Z]) => { const b = new Uint8Array(99); b.set(to33(X), 0); b.set(to33(Y), 33); b.set(to33(Z), 66); return b; };

const DEFS = (() => {
  const db = new E(); db.stk = ['X', 'Y', 'Z']; emitJdbl(db, []);
  const ad = new E(); ad.stk = ['X', 'Y', 'Z', 'X2', 'Y2']; ad.relabel('X', 'X1').relabel('Y', 'Y1').relabel('Z', 'Z1'); emitJaddMixed(ad, []);
  return `<0x${binToHex(asm(db.asm()))}> <0x10> OP_DEFINE <0x${binToHex(asm(ad.asm()))}> <0x11> OP_DEFINE`;
})();
const COMBINE3 = 'OP_TOALTSTACK OP_TOALTSTACK <33> OP_NUM2BIN OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT';
const DECODE3 = '<33> OP_SPLIT <33> OP_SPLIT OP_BIN2NUM OP_TOALTSTACK OP_BIN2NUM OP_TOALTSTACK OP_BIN2NUM OP_FROMALTSTACK OP_FROMALTSTACK';

// GLV 4-way Shamir chunk loop; mask byte per bit (0..15) selects table[mask] via computed offset.
const shamirLoop4 = (tableHex) =>
  'OP_BEGIN OP_TOALTSTACK <0x10> OP_INVOKE OP_FROMALTSTACK ' +
  'OP_1 OP_SPLIT OP_TOALTSTACK OP_BIN2NUM ' +
  'OP_DUP OP_0 OP_NUMEQUAL OP_IF OP_DROP OP_ELSE ' +
  `<0x42> OP_MUL <0x${tableHex}> OP_SWAP OP_SPLIT OP_NIP <0x42> OP_SPLIT OP_DROP ` +
  '<33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP <0x11> OP_INVOKE OP_ENDIF ' +
  'OP_FROMALTSTACK OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP';

function covenant(tableHex, baseBlobHex) {
  return (
    'OP_DROP OP_OVER ' +
    'OP_INPUTINDEX OP_0 OP_NUMEQUAL OP_IF ' +
    `<0x${baseBlobHex}> OP_EQUALVERIFY ` +
    'OP_ELSE OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY OP_ENDIF ' +
    `OP_SWAP ${DECODE3} <0x03> OP_ROLL ` +
    `${DEFS} ${shamirLoop4(tableHex)} ${COMBINE3} ` +
    'OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY OP_1'
  );
}

async function main() {
  console.log('=== ATOMIC + FULL + GLV: ethers.js sig -> in-Script recovery in ONE transaction ===');
  const wallet = ethers.Wallet.createRandom();
  const sig = await wallet.signMessage('atomic glv ecrecover in pure BCH script');
  const digest = ethers.hashMessage('atomic glv ecrecover in pure BCH script');
  const ethAddr = ethers.recoverAddress(digest, sig);
  const { r, s, v } = ethers.Signature.from(sig);
  const rr = BigInt(r), ss = BigInt(s), rec = v - 27;

  const z = BigInt(digest) % N, Fp = secp256k1.CURVE.Fp;
  const ry = (() => { const y = Fp.sqrt(mod(mod(rr * rr, P) * rr + 7n, P)); return (y & 1n) === BigInt(rec & 1) ? y : mod(P - y, P); })();
  const rinv = invN(rr), u1 = mod(mod(-z, N) * rinv, N), u2 = mod(ss * rinv, N);
  const { x: gx, y: gy } = secp256k1.ProjectivePoint.BASE.toAffine();

  // GLV bases, table, 128-bit masks
  const s1 = splitScalar(u1), s2 = splitScalar(u2);
  const neg = (pt, isNeg) => isNeg ? Pt(pt.x, mod(-pt.y, P)) : pt;
  const bases = [neg(Pt(gx, gy), s1.k1neg), neg(Pt(mod(BETA * gx, P), gy), s1.k2neg), neg(Pt(rr, ry), s2.k1neg), neg(Pt(mod(BETA * rr, P), ry), s2.k2neg)];
  const scal = [s1.k1, s1.k2, s2.k1, s2.k2];
  const table = [];
  for (let m = 0; m < 16; m++) { let a = null; for (let i = 0; i < 4; i++) if (m & (1 << i)) a = a ? a.add(bases[i]) : bases[i]; table.push(a); }
  const tableBytes = new Uint8Array(16 * 66);
  for (let m = 1; m < 16; m++) { const a = table[m].toAffine(); tableBytes.set(to33(a.x), m * 66); tableBytes.set(to33(a.y), m * 66 + 33); }
  const tableHex = binToHex(tableBytes);
  const tableAff = table.map((t) => t && t.toAffine());

  const masks = [];
  for (let i = 127; i >= 0; i--) { let m = 0; for (let j = 0; j < 4; j++) if ((scal[j] >> BigInt(i)) & 1n) m |= (1 << j); masks.push(m); }
  const start = masks.findIndex((m) => m !== 0);
  const a0 = tableAff[masks[start]];
  let acc0 = [a0.x, a0.y, 1n];
  const rest = masks.slice(start + 1);

  const CHUNK = 64;
  const chunkList = [];
  for (let i = 0; i < rest.length; i += CHUNK) chunkList.push(rest.slice(i, i + CHUNK));

  const stepJS = (a, ms) => { let p = a; for (const m of ms) { p = jDbl(p); if (m) p = jAdd(p, tableAff[m].x, tableAff[m].y); } return p; };
  const checkpoints = []; let a = acc0; for (const ch of chunkList) { a = stepJS(a, ch); checkpoints.push(a); }
  const [Qx, Qy] = jAff(checkpoints[checkpoints.length - 1]);

  const K = chunkList.length, CAT = new Uint8Array(32).fill(0x22);
  const cov = asm(covenant(tableHex, binToHex(accBlob(acc0))));
  const pad = `<0x${'00'.repeat(9600)}>`;
  const maskHex = (ms) => ms.map((m) => m.toString(16).padStart(2, '0')).join('');
  const unlock = (accIn, ms) => asm(`<0x${binToHex(accBlob(accIn))}> <0x${maskHex(ms)}> ${pad}`);
  const tok = (commitment) => ({ category: CAT, amount: 0n, nft: { capability: 'none', commitment } });
  const accIns = [acc0, ...checkpoints.slice(0, K - 1)];
  const transaction = {
    version: 2, locktime: 0,
    inputs: chunkList.map((ch, j) => ({ outpointIndex: j, outpointTransactionHash: new Uint8Array(32).fill(j), sequenceNumber: 0xffffffff, unlockingBytecode: unlock(accIns[j], ch) })),
    outputs: checkpoints.map((cp) => ({ lockingBytecode: new Uint8Array(25), valueSatoshis: 1000n, token: tok(accBlob(cp)) })),
  };
  const sourceOutputs = chunkList.map((_, j) => ({ lockingBytecode: cov, valueSatoshis: 1000n, token: tok(accBlob(accIns[j])) }));

  let allValid = true, maxCost = 0;
  for (let j = 0; j < K; j++) { const st = vm.evaluate({ inputIndex: j, sourceOutputs, transaction }); if (st.error) { allValid = false; console.log(`  input ${j} FAIL: ${st.error.slice(0, 70)}`); } maxCost = Math.max(maxCost, st.metrics?.operationCost ?? 0); }

  const pub = new Uint8Array(64);
  const put = (val, off) => { const h = val.toString(16).padStart(64, '0'); for (let i = 0; i < 32; i++) pub[off + i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); };
  put(Qx, 0); put(Qy, 32);
  const scriptAddr = ethers.getAddress('0x' + Buffer.from(ethers.keccak256(pub).slice(2), 'hex').slice(12).toString('hex'));

  console.log(`  ethers signer address : ${ethAddr}`);
  console.log(`  GLV recovery: ${K} co-spent inputs in 1 tx, covenant ${cov.length}B, ~${maxCost}/input (budget 8.03M)`);
  console.log(`  all ${K} inputs validate atomically: ${allValid}`);
  console.log(`  Q committed by last output -> EVM address: ${scriptAddr}`);
  console.log(`\n  MATCH ethers == atomic GLV recovery: ${allValid && scriptAddr.toLowerCase() === ethAddr.toLowerCase() ? 'YES - FULL GLV RECOVERY, ATOMIC, ONE TX, ' + K + ' INPUTS' : 'NO'}`);

  if (K >= 2) {
    const badCp = accBlob([checkpoints[0][0] ^ 1n, checkpoints[0][1], checkpoints[0][2]]);
    const badTx = { ...transaction, outputs: transaction.outputs.map((o, i) => i === 0 ? { ...o, token: tok(badCp) } : o) };
    const badSrc = sourceOutputs.map((so, i) => i === 1 ? { ...so, token: tok(badCp) } : so);
    const st = vm.evaluate({ inputIndex: 1, sourceOutputs: badSrc, transaction: badTx });
    console.log(`  NEGATIVE (tampered checkpoint): input 1 rejects: ${!!st.error} ${st.error ? '' : '(UNSOUND!)'}`);
  }
}
main().catch((e) => { console.error('ERR', e.stack || e.message); process.exit(1); });
