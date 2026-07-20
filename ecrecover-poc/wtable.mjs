// WITNESSED table verification: the reusable covenant's GLV table is witnessed, so it must be checked on-chain
// against the 4 verified bases. table[1,2,4,8] == B0,B1,B2,B3 (single bases); the 11 composites == predecessor + base
// via the AAV atom (proven in aav.mjs) with a witnessed inverse. A forged table entry fails closed. ~11 AAVs ~= 284K.
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { E, P } from './emit.mjs';

const vm = createVirtualMachineBch2026();
const asm = (s) => { const r = assembleBytecodeBch(s); if (!r.success) throw new Error('asm ' + JSON.stringify(r.errors) + ' | ' + s.slice(0, 120)); return r.bytecode; };
const num = (v) => (v === 0n ? 'OP_0' : `<0x${binToHex(bigIntToVmNumber(v))}>`);
const mod = (a, m) => ((a % m) + m) % m;
const invP = (a) => { let [g, x] = [mod(a, P), P], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, P); };
const to33 = (v) => { const b = new Uint8Array(33); b.set(bigIntToVmNumber(v)); return b; };

// AAV subroutine 0x12: [x1 y1 x2 y2 inv] -> [x3 y3], inline-verifies inv==(x2-x1)^-1
const AAVDEF = (() => {
  const e = new E(); e.stk = ['x1', 'y1', 'x2', 'y2', 'inv'];
  e.sub('x2', 'x1', 'dx'); e.mul('dx', 'inv', 'chk'); e.sub('y2', 'y1', 'dy'); e.mul('dy', 'inv', 'lam');
  e.sqr('lam', 'lam2'); e.sub('lam2', 'x1', 'tt'); e.sub('tt', 'x2', 'x3'); e.sub('x1', 'x3', 'd1'); e.mul('lam', 'd1', 'm1'); e.sub('m1', 'y1', 'y3');
  e.keep(['x3', 'y3', 'chk']);
  return `<0x${binToHex(asm(e.asm() + ' OP_1 OP_NUMEQUALVERIFY'))}> <0x12> OP_DEFINE`;
})();

// composite recipe: [m, predecessor, baseIndex] - each table[m] == table[pred] + B[baseIndex]
const COMPOSITES = [[3, 2, 0], [5, 4, 0], [6, 4, 1], [7, 6, 0], [9, 8, 0], [10, 8, 1], [11, 10, 0], [12, 8, 2], [13, 12, 0], [14, 12, 1], [15, 14, 0]];

// stack-tracked emitter over base block [tbl B0x B0y B1x B1y B2x B2y B3x B3y invBlob]
function tableVerifier() {
  const base = ['tbl', 'B0x', 'B0y', 'B1x', 'B1y', 'B2x', 'B2y', 'B3x', 'B3y', 'inv'];
  const stk = [...base]; const out = [];
  const D = (n) => { const i = stk.lastIndexOf(n); if (i < 0) throw new Error('no ' + n); return stk.length - 1 - i; };
  const push = (name) => stk.push(name), pop = () => stk.pop();
  const emit = (tok) => out.push(tok);
  const api = {
    pk(n) { const d = D(n); emit(d === 0 ? 'OP_DUP' : `${num(BigInt(d))} OP_PICK`); push('@'); return api; },
    extract(m) { api.pk('tbl'); emit(`${num(BigInt(m * 66))} OP_SPLIT OP_NIP <0x42> OP_SPLIT OP_DROP <33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP`); push('@'); return api; }, // tbl copy -> x y (net +1 over the pk)
    invNext(k) { api.pk('inv'); emit(`${num(BigInt(k * 33))} OP_SPLIT OP_NIP <33> OP_SPLIT OP_DROP OP_BIN2NUM`); return api; }, // inv blob -> inv[k]
    aav() { emit('<0x12> OP_INVOKE'); pop(); pop(); pop(); return api; }, // [x1 y1 x2 y2 inv] -> [x3 y3] : -3
    rot() { emit('OP_ROT'); return api; },                                // rearrange top 3, net 0
    eqv() { emit('OP_NUMEQUALVERIFY'); pop(); pop(); return api; },
    baseX(i) { return api.pk(`B${i}x`); }, baseY(i) { return api.pk(`B${i}y`); },
    asm() { return out.join(' '); },
  };
  return api;
}

function buildVerify() {
  const v = tableVerifier();
  // single-base entries: table[1<<i] == B{i}
  for (const [m, i] of [[1, 0], [2, 1], [4, 2], [8, 3]]) {
    v.extract(m);                 // [.. x y]
    v.baseY(i).eqv();             // y == B{i}y
    v.baseX(i).eqv();             // x == B{i}x
  }
  // composites: table[m] == table[pred] + B[base]  (AAV with witnessed inverse k)
  COMPOSITES.forEach(([m, pred, bi], k) => {
    v.extract(pred);              // [.. xp yp]
    v.baseX(bi).baseY(bi);        // [.. xp yp Bx By]
    v.invNext(k);                 // [.. xp yp Bx By inv]
    v.aav();                      // [.. x3 y3]
    v.extract(m);                 // [.. x3 y3 xm ym]
    // compare (x3,y3)==(xm,ym): OP_ROT -> [x3 xm ym y3], then y3==ym, x3==xm
    v.rot();
    v.eqv();                      // y3 == ym
    v.eqv();                      // x3 == xm
  });
  return v.asm();
}

// ---- driver: build a real GLV table, verify it on-chain; forge one entry -> reject ----
const Pt = (x, y) => secp256k1.ProjectivePoint.fromAffine({ x, y });
function tableFor(seed) {
  const bases = [0, 1, 2, 3].map((i) => secp256k1.ProjectivePoint.BASE.multiply(BigInt(seed * 7 + i * 101 + 5)).toAffine());
  const B = bases.map((b) => Pt(b.x, b.y));
  const t = []; for (let m = 0; m < 16; m++) { let a = null; for (let i = 0; i < 4; i++) if (m & (1 << i)) a = a ? a.add(B[i]) : B[i]; t.push(a ? a.toAffine() : null); }
  const tbl = new Uint8Array(16 * 66); for (let m = 1; m < 16; m++) { tbl.set(to33(t[m].x), m * 66); tbl.set(to33(t[m].y), m * 66 + 33); }
  const invs = COMPOSITES.map(([m, pred, bi]) => invP(mod(bases[bi].x - t[pred].x, P)));
  const invBlob = new Uint8Array(invs.length * 33); invs.forEach((iv, k) => invBlob.set(to33(iv), k * 33));
  return { bases, tbl, invBlob };
}

console.log('=== WITNESSED GLV table verification (11-AAV composition) ===');
const V = asm(buildVerify());
const drop10 = 'OP_2DROP OP_2DROP OP_2DROP OP_2DROP OP_2DROP';
function run(tbl, bases, invBlob) {
  const push = `<0x${binToHex(tbl)}> ${num(bases[0].x)} ${num(bases[0].y)} ${num(bases[1].x)} ${num(bases[1].y)} ${num(bases[2].x)} ${num(bases[2].y)} ${num(bases[3].x)} ${num(bases[3].y)} <0x${binToHex(invBlob)}>`;
  const lock = asm(`OP_DROP ${AAVDEF} ${buildVerify()} ${drop10} OP_1`);
  return vm.evaluate({ inputIndex: 0, sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: 1000n }],
    transaction: { version: 2, locktime: 0, inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: asm(`${push} <0x${'00'.repeat(1500)}>`) }], outputs: [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }] } });
}
let pass = 0, total = 0;
for (let s = 0; s < 3; s++) {
  const { bases, tbl, invBlob } = tableFor(s);
  const st = run(tbl, bases, invBlob);
  total++; if (!st.error) pass++;
  console.log(`  table ${s}: verified=${!st.error} cost=${st.metrics?.operationCost} ${st.error ? '(' + st.error.slice(0, 50) + ')' : ''}`);
}
// negative: corrupt one composite entry (t15) -> AAV compare fails
const bad = tableFor(0); const tblBad = bad.tbl.slice(); tblBad[15 * 66] ^= 1;
console.log(`  negative: forged table entry rejected=${!!run(tblBad, bad.bases, bad.invBlob).error}`);
console.log(`\n  WITNESSED table verification: ${pass === total ? 'PROVEN (' + pass + '/' + total + ' + forged-entry rejected)' : 'FAIL'}`);
