// WITNESSED sig-binding: the reusable sidecar's covenant is signature-INDEPENDENT, so (hash,v,r,s) and the helper
// witnesses arrive in the UNLOCKING (not baked as in sound.mjs) and are verified against each other on-chain. This
// proves the witnessed form of sound.mjs's binding: the covenant reads the values from the stack and checks
// r*rinv==1, Ry on-curve+parity, phiR.x==beta*r, u1==recomb(s1), u2==recomb(s2). Verified vs ethers + forgeries.
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { P } from './emit.mjs';

const vm = createVirtualMachineBch2026();
const asm = (s) => { const r = assembleBytecodeBch(s); if (!r.success) throw new Error('asm ' + JSON.stringify(r.errors)); return r.bytecode; };
const num = (v) => (v === 0n ? 'OP_0' : `<0x${binToHex(bigIntToVmNumber(v))}>`);
const N = secp256k1.CURVE.n, BETA = secp256k1.CURVE.endo.beta;
const LAMBDA = 0x5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72n;
const mod = (a, m) => ((a % m) + m) % m;
const invN = (a) => { let [g, x] = [mod(a, N), N], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, N); };
const pN = num(N), pP = num(P), muln = `OP_MUL ${pN} OP_MOD`, mulp = `OP_MUL ${pP} OP_MOD`;

function splitScalar(k) {
  const a1 = 0x3086d221a7d46bcde86c90e49284eb15n, b1 = -0xe4437ed6010e88286f547fa90abfe4c3n;
  const a2 = 0x114ca50f7a8e2f3f657c1108d9d44cfd8n, b2 = a1, POW = 1n << 128n, dn = (x, y) => (x + y / 2n) / y;
  const c1 = dn(b2 * k, N), c2 = dn(-b1 * k, N);
  let k1 = mod(k - c1 * a1 - c2 * a2, N), k2 = mod(-c1 * b1 - c2 * b2, N);
  const k1neg = k1 > POW, k2neg = k2 > POW; if (k1neg) k1 = N - k1; if (k2neg) k2 = N - k2;
  return { k1neg, k1, k2neg, k2 };
}
// signed recomposition terms t1,t2 (so u == t1 + t2*LAMBDA mod n) - these are the SIGNED scalars, witnessed
const recTerms = (sp) => ({ t1: sp.k1neg ? mod(-sp.k1, N) : sp.k1, t2: sp.k2neg ? mod(-sp.k2, N) : sp.k2 });

// stack-tracked verification emitter: pk(name) copies a named base value to the top; ops pop/push per the model,
// so pick depths are always correct regardless of intervening pushes.
function verifier(baseNames) {
  const stk = [...baseNames]; const out = [];
  const D = (n) => { const i = stk.lastIndexOf(n); if (i < 0) throw new Error('no ' + n); return stk.length - 1 - i; };
  return {
    pk(n) { const d = D(n); out.push(d === 0 ? 'OP_DUP' : `<0x${binToHex(bigIntToVmNumber(BigInt(d)))}> OP_PICK`); stk.push('@' + n); return this; },
    lit(tok) { out.push(tok); stk.push('@lit'); return this; },
    bin(tok) { out.push(tok); stk.pop(); return this; },              // pops 2 pushes 1 (e.g. OP_MUL) -> net -1
    mul(m) { out.push(m === 'n' ? muln : mulp); stk.pop(); return this; },
    verify1() { out.push('OP_1 OP_NUMEQUALVERIFY'); stk.pop(); return this; },
    eqv() { out.push('OP_NUMEQUALVERIFY'); stk.pop(); stk.pop(); return this; }, // pops 2
    raw(tok, dpop) { out.push(tok); for (let i = 0; i < (dpop || 0); i++) stk.pop(); return this; },
    fold() { out.push(`OP_DUP <0x${binToHex(bigIntToVmNumber(1n << 128n))}> OP_GREATERTHANOREQUAL OP_IF ${pN} OP_SWAP OP_SUB OP_ENDIF`); return this; }, // |k| = t<2^128 ? t : N-t
    reconstruct(termHex) { out.push(`OP_0 OP_SWAP OP_BEGIN OP_1 OP_SPLIT OP_SWAP OP_BIN2NUM <0x41> OP_MUL <0x${termHex}> OP_SWAP OP_SPLIT OP_NIP <0x41> OP_SPLIT OP_DROP OP_BIN2NUM OP_ROT OP_DUP OP_ADD OP_ADD OP_SWAP OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP`); return this; },
    asm() { return out.join(' '); },
    _stk: stk,
  };
}
// term table for the one-pass packed reconstruction (signature-independent, bakeable)
const B128 = 1n << 128n;
const termHex = (() => { const tb = new Uint8Array(16 * 65); for (let m = 0; m < 16; m++) { let term = 0n; for (let j = 0; j < 4; j++) if (m & (1 << j)) term += B128 ** BigInt(j); tb.set(bigIntToVmNumber(term), m * 65); } return binToHex(tb); })();

// emit the full binding: 6 signature checks + mask blob bound to the (folded) recomb terms. Base block = 12 values.
const BASE = ['negZ', 'r', 's', 'rinv', 'Ry', 'phiRx', 'recPar', 't1a', 't2a', 't1b', 't2b', 'masks'];
function bindChecks() {
  const v = verifier(BASE);
  // 1. r*rinv == 1 (mod n)
  v.pk('r').pk('rinv').mul('n').verify1();
  // 2. Ry^2 == r^3 + 7 (mod p)
  v.pk('Ry').pk('Ry').mul('p');                         // Ry^2
  v.pk('r').pk('r').mul('p').pk('r').mul('p').lit('<0x07>').raw('OP_ADD', 1).lit(pP).raw('OP_MOD', 1); // r^3+7
  v.eqv();
  // 3. parity(Ry) == recPar
  v.pk('Ry').lit('<0x02>').raw('OP_MOD', 1).pk('recPar').eqv();
  // 4. phiR.x == beta*r (mod p)
  v.pk('r').lit(num(BETA)).mul('p').pk('phiRx').eqv();
  // 5. u1 = (negZ*rinv) mod n == t1a + t2a*LAMBDA (mod n)
  v.pk('negZ').pk('rinv').mul('n');                     // u1
  v.pk('t2a').lit(num(LAMBDA)).mul('n').pk('t1a').raw('OP_ADD', 1).lit(pN).raw('OP_MOD', 1); // recomb
  v.eqv();
  // 6. u2 = (s*rinv) mod n == t1b + t2b*LAMBDA (mod n)
  v.pk('s').pk('rinv').mul('n');
  v.pk('t2b').lit(num(LAMBDA)).mul('n').pk('t1b').raw('OP_ADD', 1).lit(pN).raw('OP_MOD', 1);
  v.eqv();
  // 7. mask blob reconstructs to the packed |k| scalars = fold(t1a)+fold(t2a)*2^128+fold(t1b)*2^256+fold(t2b)*2^384.
  //    Binds the ladder's masks to the sig-verified recomb terms (fold = |k| = t<2^128 ? t : N-t).
  v.pk('masks').reconstruct(termHex);                  // packedRecon
  v.pk('t1a').fold();
  v.pk('t2a').fold().lit(`<0x${binToHex(bigIntToVmNumber(B128))}>`).raw('OP_MUL', 1).raw('OP_ADD', 1);
  v.pk('t1b').fold().lit(`<0x${binToHex(bigIntToVmNumber(B128 * B128))}>`).raw('OP_MUL', 1).raw('OP_ADD', 1);
  v.pk('t2b').fold().lit(`<0x${binToHex(bigIntToVmNumber(B128 * B128 * B128))}>`).raw('OP_MUL', 1).raw('OP_ADD', 1);
  v.eqv();                                              // packedRecon == rhs
  return v.asm();
}

async function main() {
  console.log('=== WITNESSED sig-binding (reusable covenant reads (hash,v,r,s)+helpers from unlocking) ===');
  const w = ethers.Wallet.createRandom();
  const sig = await w.signMessage('wsound'); const digest = ethers.hashMessage('wsound');
  const { r, s, v } = ethers.Signature.from(sig);
  const rr = BigInt(r), ss = BigInt(s), rec = v - 27, z = BigInt(digest) % N, Fp = secp256k1.CURVE.Fp;
  const Ry = (() => { const y = Fp.sqrt(mod(mod(rr * rr, P) * rr + 7n, P)); return (y & 1n) === BigInt(rec & 1) ? y : mod(P - y, P); })();
  const rinv = invN(rr), u1 = mod(mod(-z, N) * rinv, N), u2 = mod(ss * rinv, N), phiRx = mod(BETA * rr, P);
  const sp1 = splitScalar(u1), sp2 = splitScalar(u2), s1 = recTerms(sp1), s2 = recTerms(sp2);
  const scalars = [sp1.k1, sp1.k2, sp2.k1, sp2.k2];    // absolute |k| < 2^128, encoded by the masks
  const masks = []; for (let i = 127; i >= 0; i--) { let m = 0; for (let j = 0; j < 4; j++) if ((scalars[j] >> BigInt(i)) & 1n) m |= (1 << j); masks.push(m); }
  const maskHex = binToHex(new Uint8Array(masks));
  // witness push order (base block, bottom->top): negZ r s rinv Ry phiRx recPar t1a t2a t1b t2b masks
  const vals = { negZ: mod(-z, N), r: rr, s: ss, rinv, Ry, phiRx, recPar: BigInt(rec & 1), t1a: s1.t1, t2a: s1.t2, t1b: s2.t1, t2b: s2.t2, masks: maskHex };
  const order = ['negZ', 'r', 's', 'rinv', 'Ry', 'phiRx', 'recPar', 't1a', 't2a', 't1b', 't2b', 'masks'];
  const push = (o) => order.map((k) => (k === 'masks' ? `<0x${o[k]}>` : num(o[k]))).join(' ');
  // drop pad, run checks, drop the 12 base values, leave clean OP_1
  const drop12 = 'OP_2DROP OP_2DROP OP_2DROP OP_2DROP OP_2DROP OP_2DROP';
  const lock = asm(`OP_DROP ${bindChecks()} ${drop12} OP_1`);
  const run = (o) => vm.evaluate({ inputIndex: 0, sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: 1000n }],
    transaction: { version: 2, locktime: 0, inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: asm(push(o) + ' <0x' + '00'.repeat(2000) + '>') }], outputs: [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }] } });
  const good = run(vals);
  console.log(`  valid witnesses pass: ${!good.error}  cost=${good.metrics?.operationCost} ${good.error ? '(' + good.error.slice(0, 55) + ')' : ''}`);
  const badMask = maskHex.slice(0, -2) + ((parseInt(maskHex.slice(-2), 16) ^ 1).toString(16).padStart(2, '0'));
  const forgeries = {
    'forged rinv': { ...vals, rinv: mod(rinv + 1n, N) },
    'forged Ry': { ...vals, Ry: mod(Ry + 2n, P) },
    'wrong parity': { ...vals, Ry: mod(P - Ry, P) },
    'forged phiRx': { ...vals, phiRx: mod(phiRx + 1n, P) },
    'forged t1a (u1)': { ...vals, t1a: mod(s1.t1 + 1n, N) },
    'forged t2b (u2)': { ...vals, t2b: mod(s2.t2 + 1n, N) },
    'tampered masks': { ...vals, masks: badMask },
  };
  let allRej = true;
  for (const [name, o] of Object.entries(forgeries)) { const rej = !!run(o).error; allRej = allRej && rej; console.log(`  ${name.padEnd(16)} rejected: ${rej}`); }
  console.log(`\n  WITNESSED sig+mask binding: ${!good.error && allRej ? 'PROVEN (valid passes, all 7 forgeries fail closed)' : 'FAIL'}  cost=${good.metrics?.operationCost}`);
}
main().catch((e) => { console.error('ERR', e.stack || e.message); process.exit(1); });
