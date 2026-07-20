// GLV-optimized recovery: split u1,u2 into ~128-bit halves (endomorphism), 4-way Shamir over
// {+/-G, +/-phiG, +/-R, +/-phiR} with a baked 16-entry table selected per bit by computed offset.
// Halves the doubling count (256 -> 128). Verified in-Script vs ethers; reports the op-cost / input count.
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { run, num, asm, binToHex, vmNumberToBigInt, hexToBin } from './harness.mjs';
import { E, P } from './emit.mjs';
import { emitJdbl, emitJaddMixed } from './group.mjs';

const N = secp256k1.CURVE.n;
const BETA = secp256k1.CURVE.endo.beta;
const mod = (a, m) => ((a % m) + m) % m;
const invP = (a) => { let [g, x] = [mod(a, P), P], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, P); };
const invN = (a) => { let [g, x] = [mod(a, N), N], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, N); };
const jAff = ([X, Y, Z]) => { const zi = invP(Z), z2 = mod(zi * zi, P); return [mod(X * z2, P), mod(Y * z2 * zi, P)]; };
const Pt = (x, y) => secp256k1.ProjectivePoint.fromAffine({ x, y });

// GLV scalar split (noble secp256k1 constants)
function splitScalar(k) {
  const a1 = 0x3086d221a7d46bcde86c90e49284eb15n, b1 = -0xe4437ed6010e88286f547fa90abfe4c3n;
  const a2 = 0x114ca50f7a8e2f3f657c1108d9d44cfd8n, b2 = a1, POW = 1n << 128n, dn = (a, b) => (a + b / 2n) / b;
  const c1 = dn(b2 * k, N), c2 = dn(-b1 * k, N);
  let k1 = mod(k - c1 * a1 - c2 * a2, N), k2 = mod(-c1 * b1 - c2 * b2, N);
  const k1neg = k1 > POW, k2neg = k2 > POW; if (k1neg) k1 = N - k1; if (k2neg) k2 = N - k2;
  return { k1neg, k1, k2neg, k2 };
}

const DEFS = (() => {
  const db = new E(); db.stk = ['X', 'Y', 'Z']; emitJdbl(db, []);
  const ad = new E(); ad.stk = ['X', 'Y', 'Z', 'X2', 'Y2']; ad.relabel('X', 'X1').relabel('Y', 'Y1').relabel('Z', 'Z1'); emitJaddMixed(ad, []);
  return `<0x${binToHex(asm(db.asm()))}> <0x10> OP_DEFINE <0x${binToHex(asm(ad.asm()))}> <0x11> OP_DEFINE`;
})();
const COMBINE3 = 'OP_TOALTSTACK OP_TOALTSTACK <33> OP_NUM2BIN OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT';
const dec = (u8) => { const r = vmNumberToBigInt(u8, { maximumVmNumberByteLength: 40, requireMinimalEncoding: false }); return typeof r === 'bigint' ? r : 0n; };
const decode3 = (hex) => { const b = hexToBin(hex); return [dec(b.slice(0, 33)), dec(b.slice(33, 66)), dec(b.slice(66, 99))]; };
const enc33 = (v) => { const b = new Uint8Array(33); b.set(bigIntToVm(v)); return b; };
import { bigIntToVmNumber as bigIntToVm } from '@bitauth/libauth';

// 4-way Shamir loop with computed-offset table select. maskBlob = 1 byte/bit (mask 0..15).
function shamirLoop4(tableHex) {
  return (
    'OP_BEGIN ' +
    'OP_TOALTSTACK <0x10> OP_INVOKE OP_FROMALTSTACK ' +                 // DOUBLE
    'OP_1 OP_SPLIT OP_TOALTSTACK OP_BIN2NUM ' +                         // restBlob->alt, [X Y Z mask]
    'OP_DUP OP_0 OP_NUMEQUAL OP_IF OP_DROP OP_ELSE ' +                  // mask==0 -> skip
    '<0x42> OP_MUL ' +                                                  // offset = mask*66
    `<0x${tableHex}> OP_SWAP OP_SPLIT OP_NIP <0x42> OP_SPLIT OP_DROP ` + // entry66 = table[mask]
    '<33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP ' +            // [X Y Z X2 Y2]
    '<0x11> OP_INVOKE ' +                                               // ADD
    'OP_ENDIF ' +
    'OP_FROMALTSTACK OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP'
  );
}

function runChunk(acc, maskBytes, tableHex) {
  const pad = `<0x${'00'.repeat(9600)}>`;
  const blob = maskBytes.map((m) => m.toString(16).padStart(2, '0')).join('');
  const unlock = `${num(acc[0])} ${num(acc[1])} ${num(acc[2])} <0x${blob}> ${pad}`;
  const lock = `OP_DROP ${DEFS} ${shamirLoop4(tableHex)} ${COMBINE3}`;
  const r = run(unlock, lock);
  if (r.error) return { error: r.error };
  return { acc: decode3(r.stackHex[r.stackHex.length - 1]), opCost: r.opCost };
}

async function main() {
  console.log('=== GLV 4-way Shamir recovery (in-Script) vs ethers ===');
  const wallet = ethers.Wallet.createRandom();
  const sig = await wallet.signMessage('glv');
  const digest = ethers.hashMessage('glv');
  const ethAddr = ethers.recoverAddress(digest, sig);
  const { r, s, v } = ethers.Signature.from(sig);
  const rr = BigInt(r), ss = BigInt(s), rec = v - 27;

  const z = BigInt(digest) % N, Fp = secp256k1.CURVE.Fp;
  const ry = (() => { const y = Fp.sqrt(mod(mod(rr * rr, P) * rr + 7n, P)); return (y & 1n) === BigInt(rec & 1) ? y : mod(P - y, P); })();
  const rinv = invN(rr), u1 = mod(mod(-z, N) * rinv, N), u2 = mod(ss * rinv, N);
  const { x: gx, y: gy } = secp256k1.ProjectivePoint.BASE.toAffine();

  // GLV: 4 bases (sign-applied affine), 4 128-bit scalars
  const s1 = splitScalar(u1), s2 = splitScalar(u2);
  const neg = (pt, isNeg) => isNeg ? Pt(pt.x, mod(-pt.y, P)) : pt;
  const G = Pt(gx, gy), phiG = Pt(mod(BETA * gx, P), gy), R = Pt(rr, ry), phiR = Pt(mod(BETA * rr, P), ry);
  const bases = [neg(G, s1.k1neg), neg(phiG, s1.k2neg), neg(R, s2.k1neg), neg(phiR, s2.k2neg)];
  const scal = [s1.k1, s1.k2, s2.k1, s2.k2];

  // 16-entry table (subset sums), baked
  const table = [];
  for (let m = 0; m < 16; m++) {
    let acc = null;
    for (let i = 0; i < 4; i++) if (m & (1 << i)) acc = acc ? acc.add(bases[i]) : bases[i];
    table.push(acc);
  }
  const tableBytes = new Uint8Array(16 * 66);
  for (let m = 1; m < 16; m++) { const a = table[m].toAffine(); tableBytes.set(enc33(a.x).slice(0, 33), m * 66); tableBytes.set(enc33(a.y).slice(0, 33), m * 66 + 33); }
  const tableHex = binToHex(tableBytes);

  // masks per bit (MSB..LSB, 128 bits)
  const L = 128, masks = [];
  for (let i = L - 1; i >= 0; i--) { let m = 0; for (let j = 0; j < 4; j++) if ((scal[j] >> BigInt(i)) & 1n) m |= (1 << j); masks.push(m); }
  const start = masks.findIndex((m) => m !== 0);
  const a0 = table[masks[start]].toAffine();
  let acc = [a0.x, a0.y, 1n];
  const rest = masks.slice(start + 1);

  // chunk to fit budget
  const CHUNK = 64;
  let evals = 0, maxCost = 0;
  for (let i = 0; i < rest.length; i += CHUNK) {
    const rc = runChunk(acc, rest.slice(i, i + CHUNK), tableHex);
    if (rc.error) { console.log('  chunk err:', rc.error.slice(0, 70)); return; }
    acc = rc.acc; evals++; maxCost = Math.max(maxCost, rc.opCost);
  }
  const [Qx, Qy] = jAff(acc);
  const pub = new Uint8Array(64);
  const put = (val, off) => { const h = val.toString(16).padStart(64, '0'); for (let i = 0; i < 32; i++) pub[off + i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); };
  put(Qx, 0); put(Qy, 32);
  const scriptAddr = ethers.getAddress('0x' + Buffer.from(ethers.keccak256(pub).slice(2), 'hex').slice(12).toString('hex'));
  console.log(`  ethers: ${ethAddr}`);
  console.log(`  script: ${scriptAddr}`);
  console.log(`  GLV: 128-bit ladder, ${evals} chunks(inputs), ~${maxCost}/input (budget 8.03M), covenant table ${tableBytes.length}B`);
  console.log(`  MATCH: ${scriptAddr.toLowerCase() === ethAddr.toLowerCase() ? 'YES - GLV recovery correct' : 'NO'}`);
}
main().catch((e) => { console.error('ERR', e.stack || e.message); process.exit(1); });
