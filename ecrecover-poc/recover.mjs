// END-TO-END: ethers.js signs -> (v,r,s,hash) -> secp256k1 recovery IN BCH SCRIPT (split across VM
// evaluations to respect the 8M/eval budget) -> Q -> address, compared to ethers' own recovered address.
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { run, num, asm, binToHex, vmNumberToBigInt, hexToBin } from './harness.mjs';
import { E, P } from './emit.mjs';
const PRE = '';
import { emitJdbl, emitJaddMixed } from './group.mjs';

const N = secp256k1.CURVE.n;
const mod = (a, m) => ((a % m) + m) % m;
const inv = (a, m) => { let [g, x] = [mod(a, m), m], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, m); };
const jToAffine = ([X, Y, Z]) => { const zi = inv(Z, P); const zi2 = mod(zi * zi, P); return [mod(X * zi2, P), mod(Y * zi2 * zi, P)]; };

// --- function definitions (bodies operate on top-of-stack) ---

const dblBody = () => { const e = new E(); e.stk = ['X', 'Y', 'Z']; emitJdbl(e, []); return e.asm(); };
const addBody = () => { const e = new E(); e.stk = ['X', 'Y', 'Z', 'X2', 'Y2']; e.relabel('X', 'X1').relabel('Y', 'Y1').relabel('Z', 'Z1'); emitJaddMixed(e, []); return e.asm(); };
const DEFS = `<0x${binToHex(asm(dblBody()))}> <0x10> OP_DEFINE <0x${binToHex(asm(addBody()))}> <0x11> OP_DEFINE`;
const COMBINE3 = 'OP_TOALTSTACK OP_TOALTSTACK <33> OP_NUM2BIN OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT';
const dec = (u8) => { const r = vmNumberToBigInt(u8, { maximumVmNumberByteLength: 40, requireMinimalEncoding: false }); return typeof r === 'bigint' ? r : 0n; };
function decode3(hex) { const b = hexToBin(hex); return [dec(b.slice(0, 33)), dec(b.slice(33, 66)), dec(b.slice(66, 99))]; }

// Run one CHUNK of the MSB-first double-and-add ladder in a single VM evaluation.
// acc (Jacobian) in via witness; chunkBits = string of '0'/'1' (each = one double + conditional add of base).
// base (bx,by affine) baked as constants. Returns new acc [X,Y,Z] and opCost.
function runChunk(acc, chunkBits, bx, by) {
  const blob = chunkBits.split('').map((c) => (c === '1' ? '01' : '00')).join(''); // 1 byte/bit, front=next MSB
  // loop: double; pop front bit; if set add base; until blob empty
  const LOOP =
    'OP_BEGIN ' +
    'OP_TOALTSTACK <0x10> OP_INVOKE OP_FROMALTSTACK ' +      // blob->alt, DOUBLE acc, blob back
    'OP_1 OP_SPLIT OP_TOALTSTACK OP_BIN2NUM ' +              // [X Y Z bit], alt=[restBlob]
    `OP_IF ${num(bx)} ${num(by)} <0x11> OP_INVOKE OP_ENDIF ` + // conditional ADD base
    'OP_FROMALTSTACK OP_SIZE OP_0 OP_NUMEQUAL ' +            // [X Y Z restBlob (empty?)]
    'OP_UNTIL OP_DROP';                                       // exit when blob empty; drop empty blob
  const pad = `<0x${'00'.repeat(9600)}>`;
  const unlock = `${num(acc[0])} ${num(acc[1])} ${num(acc[2])} <0x${blob}> ${pad}`; // pad on TOP -> OP_DROP removes it
  const lock = `OP_DROP ${DEFS} ${LOOP} ${COMBINE3}`;
  const r = run(unlock, lock);
  if (r.error) return { error: r.error };
  return { acc: decode3(r.stackHex[r.stackHex.length - 1]), opCost: r.opCost };
}

// full scalar mult k*base (base affine), MSB-first, split into chunks that each fit the ~8M budget.
function scalarMulInScript(k, bx, by, chunkSize = 40) {
  const bits = k.toString(2);            // MSB first, bits[0]='1'
  let acc = [bx, by, 1n];                // init acc = base (the MSB)
  const rest = bits.slice(1);
  let maxCost = 0, evals = 0;
  for (let i = 0; i < rest.length; i += chunkSize) {
    const chunk = rest.slice(i, i + chunkSize);
    const r = runChunk(acc, chunk, bx, by);
    if (r.error) throw new Error(`chunk eval err: ${r.error}`);
    acc = r.acc; maxCost = Math.max(maxCost, r.opCost); evals++;
  }
  return { acc, maxCost, evals };
}

// general Jacobian add (both Z != 1), add-2007-bl, for the final Q = u1G + u2R. One evaluation.
function jaddGeneralInScript(A, B) {
  const e = new E();
  e.pushNum(A[0], 'X1').pushNum(A[1], 'Y1').pushNum(A[2], 'Z1').pushNum(B[0], 'X2').pushNum(B[1], 'Y2').pushNum(B[2], 'Z2');
  // add-2007-bl
  e.sqr('Z1', 'Z1Z1'); e.sqr('Z2', 'Z2Z2');
  e.mul('X1', 'Z2Z2', 'U1'); e.mul('X2', 'Z1Z1', 'U2');
  e.mul('Y1', 'Z2', 'yz1'); e.mul('yz1', 'Z2Z2', 'S1');
  e.mul('Y2', 'Z1', 'yz2'); e.mul('yz2', 'Z1Z1', 'S2');
  e.sub('U2', 'U1', 'H'); e.add('H', 'H', 'H2'); e.sqr('H2', 'I'); e.mul('H', 'I', 'J');
  e.sub('S2', 'S1', 'rr'); e.add('rr', 'rr', 'r'); e.mul('U1', 'I', 'V');
  e.sqr('r', 'r2'); e.sub('r2', 'J', 'x1'); e.add('V', 'V', 'V2'); e.sub('x1', 'V2', 'X3');
  e.sub('V', 'X3', 'vx'); e.mul('r', 'vx', 'rv'); e.mul('S1', 'J', 'sj'); e.add('sj', 'sj', 'sj2'); e.sub('rv', 'sj2', 'Y3');
  e.add('Z1', 'Z2', 'z12'); e.sqr('z12', 'z12s'); e.sub('z12s', 'Z1Z1', 'zz'); e.sub('zz', 'Z2Z2', 'zzz'); e.mul('zzz', 'H', 'Z3');
  e.keep(['X3', 'Y3', 'Z3']);
  const pad = `<0x${'00'.repeat(2000)}>`;
  const r = run(pad, `OP_DROP ${e.asm()} ${COMBINE3}`);
  if (r.error) throw new Error('jadd err: ' + r.error);
  return decode3(r.stackHex[r.stackHex.length - 1]);
}

// ---- driver: ethers sign -> in-Script recovery -> compare ----
async function main() {
  // quick sanity: scalarMul small k vs noble
  {
    const k = 0xABCDEF12345n;
    const { x: gx, y: gy } = secp256k1.ProjectivePoint.BASE.toAffine();
    const { acc, evals, maxCost } = scalarMulInScript(k, gx, gy, 40);
    const [ax, ay] = jToAffine(acc);
    const want = secp256k1.ProjectivePoint.BASE.multiply(k).toAffine();
    console.log(`scalarMul(k=0x${k.toString(16)})*G in-Script: ${ax === want.x && ay === want.y ? 'PASS' : 'FAIL'} | ${evals} evals, ~${maxCost}/eval`);
  }

  console.log('\n=== END-TO-END: ethers.js signature -> in-Script recovery ===');
  const wallet = ethers.Wallet.createRandom();
  const message = 'ecrecover in pure BCH script';
  const sig = await wallet.signMessage(message);                       // ethers signs
  const digest = ethers.hashMessage(message);                          // EIP-191 digest ethers signed
  const ethAddr = ethers.recoverAddress(digest, sig);                  // ethers' own recovery (oracle)
  const { r: rHex, s: sHex, v } = ethers.Signature.from(sig);
  const r = BigInt(rHex), s = BigInt(sHex), rec = v - 27;
  console.log(`  ethers signer address : ${ethAddr}`);
  console.log(`  sig: v=${v} r=${rHex.slice(0, 12)}.. s=${sHex.slice(0, 12)}..`);

  // recovery prep (public, JS = what the SDK/witness would compute): z, R, rinv, u1, u2
  const z = BigInt(digest) % N;
  const Fp = secp256k1.CURVE.Fp;
  const ry = (() => { const y = Fp.sqrt(mod(mod(r * r, P) * r + 7n, P)); return (y & 1n) === BigInt(rec & 1) ? y : mod(P - y, P); })();
  const rinv = inv(r, N);
  const u1 = mod(mod(-z, N) * rinv, N);
  const u2 = mod(s * rinv, N);
  const { x: gx, y: gy } = secp256k1.ProjectivePoint.BASE.toAffine();

  // the two scalar mults IN SCRIPT
  const t0 = Date.now();
  const u1G = scalarMulInScript(u1, gx, gy, 40);
  const u2R = scalarMulInScript(u2, r, ry, 40);
  const Qj = jaddGeneralInScript(u1G.acc, u2R.acc);                     // final add IN SCRIPT
  const [Qx, Qy] = jToAffine(Qj);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  // derive EVM address from the Script-recovered pubkey (uncompressed X||Y, keccak[12:])
  const pub = new Uint8Array(64);
  const put = (val, off) => { const h = val.toString(16).padStart(64, '0'); for (let i = 0; i < 32; i++) pub[off + i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); };
  put(Qx, 0); put(Qy, 32);
  const scriptAddr = ethers.getAddress('0x' + Buffer.from(ethers.keccak256(pub).slice(2), 'hex').slice(12).toString('hex'));

  console.log(`  in-Script recovered Q : (${Qx.toString(16).slice(0, 12)}.., ${Qy.toString(16).slice(0, 12)}..)`);
  console.log(`  => Script EVM address : ${scriptAddr}`);
  console.log(`  u1G: ${u1G.evals} evals, u2R: ${u2R.evals} evals, ~${Math.max(u1G.maxCost, u2R.maxCost)}/eval, ${secs}s`);
  console.log(`\n  MATCH ethers == in-Script recovery: ${scriptAddr.toLowerCase() === ethAddr.toLowerCase() ? 'YES - VERIFIED END TO END' : 'NO - MISMATCH'}`);
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
