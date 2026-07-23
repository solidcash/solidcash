// SOUND recovery binding: the covenant BINDS to (hash, v, r, s) and verifies every witness on-chain, so the
// SDK cannot feed a forged pubkey. Verifies r^-1 (mod n), Ry (on-curve + parity), phi(R).x = beta*r, derives
// u1,u2 on-chain, and verifies the GLV decomposition of each. Verified vs ethers; forged witnesses fail closed.
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { run, num } from './harness.mjs';

const P = 2n ** 256n - 2n ** 32n - 977n;
const Nn = secp256k1.CURVE.n;
const BETA = secp256k1.CURVE.endo.beta;
const LAMBDA = 0x5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72n;
const mod = (a, m) => ((a % m) + m) % m;
const invN = (a) => { let [g, x] = [mod(a, Nn), Nn], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, Nn); };
const pN = num(Nn), pP = num(P);
const muln = `OP_MUL ${pN} OP_MOD`;
const mulp = `OP_MUL ${pP} OP_MOD`;

function splitScalar(k) {
  const a1 = 0x3086d221a7d46bcde86c90e49284eb15n, b1 = -0xe4437ed6010e88286f547fa90abfe4c3n;
  const a2 = 0x114ca50f7a8e2f3f657c1108d9d44cfd8n, b2 = a1, POW = 1n << 128n, dn = (x, y) => (x + y / 2n) / y;
  const c1 = dn(b2 * k, Nn), c2 = dn(-b1 * k, Nn);
  let k1 = mod(k - c1 * a1 - c2 * a2, Nn), k2 = mod(-c1 * b1 - c2 * b2, Nn);
  const k1neg = k1 > POW, k2neg = k2 > POW; if (k1neg) k1 = Nn - k1; if (k2neg) k2 = Nn - k2;
  return { k1neg, k1, k2neg, k2 };
}
// (t1 +/- t2*lambda) mod n, leaving the value on the stack
const glvRecomb = (sp) => {
  const t1 = sp.k1neg ? mod(-sp.k1, Nn) : sp.k1;
  const t2 = sp.k2neg ? mod(-sp.k2, Nn) : sp.k2;
  return `${num(t2)} ${num(LAMBDA)} ${muln} ${num(t1)} OP_ADD ${pN} OP_MOD`;
};

// self-contained on-chain verifier of (z,r,s) witnesses; leaves OP_1 iff everything binds
function verifyScript(z, r, s, rinv, Ry, rec, phiRx, split1, split2) {
  return [
    `${num(r)} ${num(rinv)} ${muln} OP_1 OP_NUMEQUALVERIFY`,                                   // r*rinv == 1 (mod n)
    `${num(Ry)} ${num(Ry)} ${mulp} ${num(r)} ${num(r)} ${mulp} ${num(r)} ${mulp} <0x07> OP_ADD ${pP} OP_MOD OP_NUMEQUALVERIFY`, // Ry^2 == r^3+7
    `${num(Ry)} <0x02> OP_MOD ${num(BigInt(rec & 1))} OP_NUMEQUALVERIFY`,                        // parity(Ry) == rec
    `${num(BETA)} ${num(r)} ${mulp} ${num(phiRx)} OP_NUMEQUALVERIFY`,                            // phiR.x == beta*r
    `${num(mod(-z, Nn))} ${num(rinv)} ${muln} ${glvRecomb(split1)} OP_NUMEQUALVERIFY`,           // u1 == recomb(split1)
    `${num(s)} ${num(rinv)} ${muln} ${glvRecomb(split2)} OP_NUMEQUALVERIFY`,                     // u2 == recomb(split2)
    'OP_1',
  ].join(' ');
}

async function main() {
  console.log('=== SOUND binding: verify (hash,v,r,s) witnesses on-chain (vs ethers) ===');
  const wallet = ethers.Wallet.createRandom();
  const sig = await wallet.signMessage('sound');
  const digest = ethers.hashMessage('sound');
  const { r, s, v } = ethers.Signature.from(sig);
  const rr = BigInt(r), ss = BigInt(s), rec = v - 27;
  const z = BigInt(digest) % Nn, Fp = secp256k1.CURVE.Fp;
  const Ry = (() => { const y = Fp.sqrt(mod(mod(rr * rr, P) * rr + 7n, P)); return (y & 1n) === BigInt(rec & 1) ? y : mod(P - y, P); })();
  const rinv = invN(rr);
  const u1 = mod(mod(-z, Nn) * rinv, Nn), u2 = mod(ss * rinv, Nn);
  const phiRx = mod(BETA * rr, P);
  const split1 = splitScalar(u1), split2 = splitScalar(u2);

  const pad = `<0x${'00'.repeat(600)}>`;
  const isOk = (r) => !r.error && r.stack.length === 1 && r.stack[0] === 1n; // clean stack, top == OP_1
  const ok = (scr) => isOk(run(pad, `OP_DROP ${scr}`));
  const good = verifyScript(z, rr, ss, rinv, Ry, rec, phiRx, split1, split2);
  const r0 = run(pad, `OP_DROP ${good}`);
  console.log(`  all witnesses valid -> passes: ${isOk(r0)} ${r0.error ? '(' + r0.error.slice(0, 55) + ')' : (isOk(r0) ? '' : 'stack=' + JSON.stringify(r0.stack.map(String)))}`);
  const tests = {
    'forged rinv': verifyScript(z, rr, ss, mod(rinv + 1n, Nn), Ry, rec, phiRx, split1, split2),
    'forged Ry': verifyScript(z, rr, ss, rinv, mod(Ry + 2n, P), rec, phiRx, split1, split2),
    'wrong parity': verifyScript(z, rr, ss, rinv, mod(P - Ry, P), rec, phiRx, split1, split2),
    'forged phiRx': verifyScript(z, rr, ss, rinv, Ry, rec, mod(phiRx + 1n, P), split1, split2),
    'forged GLV u1': verifyScript(z, rr, ss, rinv, Ry, rec, phiRx, splitScalar(mod(u1 + 1n, Nn)), split2),
    'forged GLV u2': verifyScript(z, rr, ss, rinv, Ry, rec, phiRx, split1, splitScalar(mod(u2 + 1n, Nn))),
  };
  let allRej = true;
  for (const [name, scr] of Object.entries(tests)) { const rej = !ok(scr); allRej = allRej && rej; console.log(`  ${name.padEnd(14)} rejected: ${rej}`); }
  console.log(`\n  SOUND: ${isOk(r0) && allRej ? 'YES - witnesses bound to (hash,v,r,s); every forgery fails closed' : 'NO'}`);
}
main().catch((e) => { console.error('ERR', e.stack || e.message); process.exit(1); });
