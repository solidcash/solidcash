// affine-add-verified (AAV): the atom of ON-CHAIN GLV table derivation. Subroutine [x1 y1 x2 y2 inv] -> [x3 y3] that
// inline-verifies inv == (x2-x1)^-1 (chk = (x2-x1)*inv must == 1), then computes the affine sum. 11 chained AAVs derive
// the 16-entry GLV Shamir table from the 4 verified bases (~180K op-cost), binding a witnessed table to the signature.
// Verified vs noble + a wrong inverse rejected. This is the missing soundness piece for a fully self-verifying sidecar.
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { E, P } from './emit.mjs';
const vm = createVirtualMachineBch2026();
const asm = (s) => { const r = assembleBytecodeBch(s); if (!r.success) throw new Error('asm ' + JSON.stringify(r.errors)); return r.bytecode; };
const num = (v) => (v === 0n ? 'OP_0' : `<0x${binToHex(bigIntToVmNumber(v))}>`);
const mod = (a, m) => ((a % m) + m) % m;
const invP = (a) => { let [g, x] = [mod(a, P), P], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, P); };

// AAV body: [x1 y1 x2 y2 inv] -> [x3 y3], with an inline chk==1 verify (chk = (x2-x1)*inv)
const AAV = (() => {
  const e = new E(); e.stk = ['x1', 'y1', 'x2', 'y2', 'inv'];
  e.sub('x2', 'x1', 'dx'); e.mul('dx', 'inv', 'chk');
  e.sub('y2', 'y1', 'dy'); e.mul('dy', 'inv', 'lam');
  e.sqr('lam', 'lam2'); e.sub('lam2', 'x1', 'tt'); e.sub('tt', 'x2', 'x3');
  e.sub('x1', 'x3', 'd1'); e.mul('lam', 'd1', 'm1'); e.sub('m1', 'y1', 'y3');
  e.keep(['x3', 'y3', 'chk']);
  return e.asm() + ' OP_1 OP_NUMEQUALVERIFY';
})();

console.log('=== affine-add-verified (AAV) atom - on-chain GLV table derivation ===');
let pass = 0, total = 0;
for (let t = 0; t < 5; t++) {
  const a = secp256k1.ProjectivePoint.BASE.multiply(BigInt(t * 97 + 3)).toAffine();
  const b = secp256k1.ProjectivePoint.BASE.multiply(BigInt(t * 131 + 50000)).toAffine();
  const sum = secp256k1.ProjectivePoint.fromAffine(a).add(secp256k1.ProjectivePoint.fromAffine(b)).toAffine();
  const inv = invP(mod(b.x - a.x, P));
  const check = AAV + ` ${num(sum.y)} OP_NUMEQUALVERIFY ${num(sum.x)} OP_NUMEQUALVERIFY OP_1`;
  const st = vm.evaluate({ inputIndex: 0, sourceOutputs: [{ lockingBytecode: asm(check), valueSatoshis: 1000n }],
    transaction: { version: 2, locktime: 0, inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: asm(`${num(a.x)} ${num(a.y)} ${num(b.x)} ${num(b.y)} ${num(inv)}`) }], outputs: [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }] } });
  const ok = !st.error && st.stack.length === 1 && vmNumberToBigInt(st.stack[0], { requireMinimalEncoding: false }) === 1n;
  total++; if (ok) pass++;
  console.log(`  add ${t}: on-chain x3,y3 == noble = ${ok} ${st.error ? '(' + st.error.slice(0, 45) + ')' : ''}`);
}
const a = secp256k1.ProjectivePoint.BASE.multiply(7n).toAffine(), b = secp256k1.ProjectivePoint.BASE.multiply(9n).toAffine();
const badInv = invP(mod(b.x - a.x, P)) + 1n;
const stBad = vm.evaluate({ inputIndex: 0, sourceOutputs: [{ lockingBytecode: asm(AAV + ' OP_2DROP OP_1'), valueSatoshis: 1000n }],
  transaction: { version: 2, locktime: 0, inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: asm(`${num(a.x)} ${num(a.y)} ${num(b.x)} ${num(b.y)} ${num(badInv)}`) }], outputs: [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }] } });
console.log(`  negative: wrong inverse rejected = ${!!stBad.error}`);
console.log(`\n  AAV atom: ${pass === total && !!stBad.error ? 'PROVEN (' + pass + '/' + total + ' vs noble + neg)' : 'FAIL'} | body ${asm(AAV).length}B`);
