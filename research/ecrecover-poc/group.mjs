// secp256k1 Jacobian point ops (a=0) in BCH Script, verified against @noble/curves on the real VM.
import { secp256k1 } from '@noble/curves/secp256k1';
import { run, num, asm, vmNumberToBigInt, hexToBin, binToHex } from './harness.mjs';
import { E, P } from './emit.mjs';
const prelude = () => ''; // field ops are now inlined by the emitter; no function-def prelude needed

// combine top-3 [a b c] -> one 99-byte blob a33||b33||c33 (clean-stack). JS decodes with decode3.
const COMBINE3 = 'OP_TOALTSTACK OP_TOALTSTACK <33> OP_NUM2BIN OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT';
function decode3(hex) {
  const b = hexToBin(hex);
  const dec = (u8) => { const r = vmNumberToBigInt(u8, { maximumVmNumberByteLength: 40, requireMinimalEncoding: false }); return typeof r === 'bigint' ? r : 0n; };
  return [dec(b.slice(0, 33)), dec(b.slice(33, 66)), dec(b.slice(66, 99))];
}

const mod = (a, m = P) => ((a % m) + m) % m;
const inv = (a, m = P) => { let [old_r, r] = [mod(a, m), m], [old_s, s] = [1n, 0n]; while (r) { const q = old_r / r; [old_r, r] = [r, old_r - q * r]; [old_s, s] = [s, old_s - q * s]; } return mod(old_s, m); };
const jToAffine = ([X, Y, Z]) => { const zi = inv(Z); const zi2 = mod(zi * zi); return [mod(X * zi2), mod(Y * zi2 * zi)]; };

// --- Script bodies (emit straight-line formulas over named registers) ---
// double: stack in [X Y Z] -> [..preserve, X3 Y3 Z3]
export function emitJdbl(e, preserve = []) {
  e.sqr('X', 'A'); e.sqr('Y', 'B'); e.sqr('B', 'C');
  e.add('X', 'B', 'XB'); e.sqr('XB', 'XB2'); e.sub('XB2', 'A', 't1'); e.sub('t1', 'C', 't2'); e.add('t2', 't2', 'D');
  e.add('A', 'A', 'A2'); e.add('A2', 'A', 'EE'); e.sqr('EE', 'F');
  e.add('D', 'D', 'D2'); e.sub('F', 'D2', 'X3');
  e.sub('D', 'X3', 'DmX3'); e.mul('EE', 'DmX3', 'ED'); e.add('C', 'C', 'C2'); e.add('C2', 'C2', 'C4'); e.add('C4', 'C4', 'C8'); e.sub('ED', 'C8', 'Y3');
  e.mul('Y', 'Z', 'YZ'); e.add('YZ', 'YZ', 'Z3');
  e.keep([...preserve, 'X3', 'Y3', 'Z3']);
}
// mixed add: stack in [.. X1 Y1 Z1 X2 Y2] (X2,Y2 affine) -> [..preserve, X3 Y3 Z3]  (madd-2007-bl)
export function emitJaddMixed(e, preserve = []) {
  e.sqr('Z1', 'Z1Z1'); e.mul('X2', 'Z1Z1', 'U2');
  e.mul('Y2', 'Z1', 'YZ'); e.mul('YZ', 'Z1Z1', 'S2');
  e.sub('U2', 'X1', 'H'); e.sqr('H', 'HH'); e.add('HH', 'HH', 'I2'); e.add('I2', 'I2', 'I');
  e.mul('H', 'I', 'J'); e.sub('S2', 'Y1', 'SY'); e.add('SY', 'SY', 'r'); e.mul('X1', 'I', 'V');
  e.sqr('r', 'r2'); e.sub('r2', 'J', 'rj'); e.add('V', 'V', 'V2'); e.sub('rj', 'V2', 'X3');
  e.sub('V', 'X3', 'VmX3'); e.mul('r', 'VmX3', 'rV'); e.mul('Y1', 'J', 'YJ'); e.add('YJ', 'YJ', 'YJ2'); e.sub('rV', 'YJ2', 'Y3');
  e.add('Z1', 'H', 'ZH'); e.sqr('ZH', 'ZH2'); e.sub('ZH2', 'Z1Z1', 'z1'); e.sub('z1', 'HH', 'Z3');
  e.keep([...preserve, 'X3', 'Y3', 'Z3']);
}

// double-and-add ladder: acc = k*Pbase, Pbase affine in registers PX,PY. bits = MSB..LSB of k, top bit assumed 1.
// acc threaded through registers X,Y,Z (Jacobian). Base PX,PY preserved across iterations.
export function emitScalarMul(e, bits) {
  e.copy('PX', 'X'); e.copy('PY', 'Y'); e.pushNum(1n, 'Z');  // acc = Pbase (Z=1)
  for (const b of bits.slice(1)) {
    emitJdbl(e, ['PX', 'PY']);                 // [PX PY X3 Y3 Z3]
    e.relabel('X3', 'X').relabel('Y3', 'Y').relabel('Z3', 'Z');
    if (b) {
      e.relabel('X', 'X1').relabel('Y', 'Y1').relabel('Z', 'Z1');
      e.copy('PX', 'X2'); e.copy('PY', 'Y2');
      emitJaddMixed(e, ['PX', 'PY']);          // [PX PY X3 Y3 Z3]
      e.relabel('X3', 'X').relabel('Y3', 'Y').relabel('Z3', 'Z');
    }
  }
  e.keep(['X', 'Y', 'Z']);
}

function pad(n) { return `<0x${'00'.repeat(n)}>`; } // buy op-cost budget

function testDbl() {
  const PRE = prelude(asm);
  let ok = true, maxCost = 0;
  for (let i = 1; i <= 60; i++) {
    const Pt = secp256k1.ProjectivePoint.BASE.multiply(BigInt(i * 7 + 3));
    const { x, y } = Pt.toAffine();
    const z = BigInt(i * 1000 + 12345) % P || 1n;                // random Z
    const X = mod(x * z * z), Y = mod(y * z * z * z), Z = z;     // lift to Jacobian
    const e = new E();
    e.pushNum(X, 'X').pushNum(Y, 'Y').pushNum(Z, 'Z');
    emitJdbl(e);
    const r = run(pad(2000), `OP_DROP ${PRE} ${e.asm()} ${COMBINE3}`);
    if (r.error) { ok = false; if (i < 3) console.log('  dbl err', r.error); continue; }
    const [X3, Y3, Z3] = decode3(r.stackHex[r.stackHex.length - 1]);
    const [ax, ay] = jToAffine([X3, Y3, Z3]);
    const want = Pt.double().toAffine();
    if (ax !== want.x || ay !== want.y) { ok = false; if (i < 3) console.log(`  dbl MISMATCH i=${i}`); }
    maxCost = Math.max(maxCost, r.opCost);
  }
  console.log(`point double: ${ok ? 'PASS' : 'FAIL'} | opCost ~${maxCost} (~${Math.round(maxCost / 4029)} modmul-equiv)`);
  return maxCost;
}

function testAdd() {
  const PRE = prelude(asm);
  let ok = true, maxCost = 0;
  for (let i = 1; i <= 60; i++) {
    const P1 = secp256k1.ProjectivePoint.BASE.multiply(BigInt(i * 5 + 1));
    const P2 = secp256k1.ProjectivePoint.BASE.multiply(BigInt(i * 131 + 100000)); // distinct, never == +/-P1 for these i
    const { x: x1, y: y1 } = P1.toAffine();
    const { x: x2, y: y2 } = P2.toAffine();
    const z = BigInt(i * 777 + 999) % P || 1n;
    const X1 = mod(x1 * z * z), Y1 = mod(y1 * z * z * z), Z1 = z;
    const e = new E();
    e.pushNum(X1, 'X1').pushNum(Y1, 'Y1').pushNum(Z1, 'Z1').pushNum(x2, 'X2').pushNum(y2, 'Y2');
    emitJaddMixed(e);
    const r = run(pad(2000), `OP_DROP ${PRE} ${e.asm()} ${COMBINE3}`);
    if (r.error) { ok = false; if (i < 3) console.log('  add err', r.error); continue; }
    const [X3, Y3, Z3] = decode3(r.stackHex[r.stackHex.length - 1]);
    const [ax, ay] = jToAffine([X3, Y3, Z3]);
    const want = P1.add(P2).toAffine();
    if (ax !== want.x || ay !== want.y) { ok = false; if (i < 3) console.log(`  add MISMATCH i=${i}`); }
    maxCost = Math.max(maxCost, r.opCost);
  }
  console.log(`point add(mixed): ${ok ? 'PASS' : 'FAIL'} | opCost ~${maxCost} (~${Math.round(maxCost / 4029)} modmul-equiv)`);
  return maxCost;
}

function testScalarMul() {
  const PRE = prelude(asm);
  const bitsOf = (k) => k.toString(2).split('').map((c) => c === '1');
  let ok = true, maxCost = 0, nbits = 0;
  for (const k of [0x8000000001n, 0xC0000000000005n, 0xFEDCBA9876n, 0xABCDEF0123n]) {
    const bits = bitsOf(k); nbits = bits.length;
    const { x: gx, y: gy } = secp256k1.ProjectivePoint.BASE.toAffine();
    const e = new E();
    e.pushNum(gx, 'PX').pushNum(gy, 'PY');
    emitScalarMul(e, bits);
    const r = run(pad(3000), `OP_DROP ${PRE} ${e.asm()} ${COMBINE3}`);
    if (r.error) { ok = false; console.log(`  scalarmul err (k bits=${bits.length}):`, r.error?.slice(0, 60)); continue; }
    const [X, Y, Z] = decode3(r.stackHex[r.stackHex.length - 1]);
    const [ax, ay] = jToAffine([X, Y, Z]);
    const want = secp256k1.ProjectivePoint.BASE.multiply(k).toAffine();
    if (ax !== want.x || ay !== want.y) { ok = false; console.log(`  scalarmul MISMATCH k=${k.toString(16)}`); }
    maxCost = Math.max(maxCost, r.opCost);
  }
  const perBit = Math.round(maxCost / nbits);
  console.log(`scalar mul (double-and-add loop): ${ok ? 'PASS' : 'FAIL'} | ${nbits}-bit opCost ~${maxCost} | ~${perBit}/bit`);
  console.log(`  => full 256-bit ~${(256 * perBit / 1e6).toFixed(1)}M; GLV 128-bit dbl-scalar est with real dbl/add costs:`);
  return { perBit, ok };
}

// Prove loop + OP_DEFINE function composition in BOUNDED script size: N doublings via a looped DOUBLE function.
function testLoopDouble() {
  const PRE = prelude(asm);
  // DOUBLE function body: top-3 [X Y Z] -> [X3 Y3 Z3]  (deeper stack untouched)
  const db = new E(); db.stk = ['X', 'Y', 'Z']; emitJdbl(db, []);
  const DOUBLE_DEF = `<0x${binToHexLocal(asm(db.asm()))}> <0x10> OP_DEFINE`;
  const { x: gx, y: gy } = secp256k1.ProjectivePoint.BASE.toAffine();
  let ok = true, maxCost = 0, scriptLen = 0;
  for (const N of [10, 40, 100]) {
    // acc = G (Z=1), counter=N; loop: counter->alt, double, counter<-alt, --counter, until 0
    const LOOP = `OP_BEGIN OP_TOALTSTACK <0x10> OP_INVOKE OP_FROMALTSTACK OP_1SUB OP_DUP OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP`;
    const lock = `OP_DROP ${PRE} ${DOUBLE_DEF} ${num(gx)} ${num(gy)} OP_1 ${num(BigInt(N))} ${LOOP} ${COMBINE3}`;
    scriptLen = asm(lock).length;
    const r = run(pad(9500), lock);
    if (r.error) { ok = false; console.log(`  loopDouble N=${N} err:`, r.error?.slice(0, 55)); continue; }
    const [X, Y, Z] = decode3(r.stackHex[r.stackHex.length - 1]);
    const [ax, ay] = jToAffine([X, Y, Z]);
    const want = secp256k1.ProjectivePoint.BASE.multiply(1n << BigInt(N)).toAffine();
    if (ax !== want.x || ay !== want.y) { ok = false; console.log(`  loopDouble N=${N} MISMATCH`); }
    maxCost = Math.max(maxCost, r.opCost || 0);
  }
  console.log(`loop+function double (2^N*G): ${ok ? 'PASS' : 'FAIL'} | script ${scriptLen}B (<10000) | 100-dbl opCost ~${maxCost}`);
  return ok;
}
function binToHexLocal(u8) { return Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join(''); }

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Jacobian point ops on BCH-2026 VM (verified vs noble) ===');
  const dblCost = testDbl();
  const addCost = testAdd();
  testLoopDouble();
  // Real-cost recovery estimate: GLV+4way-Shamir ~128 doublings + ~138 mixed-adds
  const recEC = 128 * dblCost + 138 * addCost;
  console.log(`\n=== REAL recovery op-cost (measured primitives) ===`);
  console.log(`  double=${dblCost} add=${addCost} | 128*dbl + 138*add = ${(recEC / 1e6).toFixed(2)}M`);
  console.log(`  budget/input=8.03M => ~${(recEC / 8_032_800).toFixed(2)} inputs (unoptimized emitter). Sidecar blocks needed: ${Math.ceil(recEC / 7_000_000)}`);
}
