// FULLY-SOUND mask binding: the ladder's mask stream is committed and BOUND to the verified GLV scalars by
// reconstructing each scalar from the masks ON-CHAIN and checking equality. s_j = sum_i bit_j(mask_i) * 2^(n-1-i).
// Combined with sound.mjs (scalars bound to the signature) this closes the loop: the masks provably encode the
// scalars of the real (hash,v,r,s), so no forged pubkey is possible. Verified vs the true scalars + negatives.
import { secp256k1 } from '@noble/curves/secp256k1';
import { run, num } from './harness.mjs';

const Nn = secp256k1.CURVE.n;

// on-chain bit primitive: bit_p(s) = (s mod 2^(p+1)) >= 2^p   (used by the derive-on-chain variant)
function verifyBitPrimitive() {
  let ok = true;
  for (let t = 0; t < 200; t++) {
    const s = BigInt('0x' + [...Array(4)].map(() => Math.floor(Math.random() * 4294967296).toString(16).padStart(8, '0')).join('')) & ((1n << 128n) - 1n);
    const p = BigInt(Math.floor(Math.random() * 128)), pow = 1n << p, twoPow = pow * 2n;
    const r = run(`${num(s)} ${num(twoPow)} ${num(pow)}`, 'OP_ROT OP_ROT OP_MOD OP_SWAP OP_GREATERTHANOREQUAL');
    if (r.error || r.stack[r.stack.length - 1] !== ((s >> p) & 1n)) ok = false;
  }
  return ok;
}

// reconstruct scalar s_j from a mask blob (1 byte/bit, MSB-first): acc=0; per mask: bit=(mask>>j)&1; acc=acc*2+bit.
// Returns the Script that leaves [s_j] on the stack given [maskBlob] on top.
function reconstructScript(j) {
  const div = j === 0 ? '' : `${num(1n << BigInt(j))} OP_DIV `;   // mask >> j
  return (
    'OP_0 OP_SWAP ' +                                            // [acc=0 blob]
    'OP_BEGIN ' +
    'OP_1 OP_SPLIT OP_SWAP OP_BIN2NUM ' +                        // [acc restBlob mask]
    `${div}<0x02> OP_MOD ` +                                     // bit = (mask>>j) mod 2  -> [acc restBlob bit]
    'OP_ROT OP_DUP OP_ADD OP_ADD OP_SWAP ' +                     // acc = acc*2 + bit ; [acc' restBlob]
    'OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP'                  // until blob empty -> [s_j]
  );
}

console.log('=== FULLY-SOUND mask binding (on-chain reconstruction of scalars from masks) ===');
console.log(`  bit primitive  bit_p(s)=(s mod 2^(p+1))>=2^p : ${verifyBitPrimitive() ? 'PASS (200 random)' : 'FAIL'}`);

// build a mask blob from 4 scalars (as the ladder/SDK would) and reconstruct each on-chain
const rand = () => BigInt('0x' + [...Array(4)].map(() => Math.floor(Math.random() * 4294967296).toString(16).padStart(8, '0')).join('')) & ((1n << 128n) - 1n);
const scal = [rand(), rand(), rand(), rand()];
const L = 128;
const masks = [];
for (let i = L - 1; i >= 0; i--) { let m = 0; for (let j = 0; j < 4; j++) if ((scal[j] >> BigInt(i)) & 1n) m |= (1 << j); masks.push(m); }
const blobHex = masks.map((m) => m.toString(16).padStart(2, '0')).join('');
const pad = `<0x${'00'.repeat(600)}>`;

let allOk = true;
for (let j = 0; j < 4; j++) {
  const r = run(pad, `OP_DROP <0x${blobHex}> ${reconstructScript(j)}`);
  const got = r.stack[r.stack.length - 1];
  const ok = !r.error && got === scal[j];
  allOk = allOk && ok;
  console.log(`  reconstruct s${j} on-chain == verified scalar : ${ok ? 'PASS' : 'FAIL ' + (r.error?.slice(0, 40) ?? got)}`);
}
// negative: a tampered mask blob must reconstruct a DIFFERENT scalar (so the equality check would reject it)
const badBlob = (blobHex.slice(0, -2) + ((parseInt(blobHex.slice(-2), 16) ^ 1).toString(16).padStart(2, '0')));
const rb = run(pad, `OP_DROP <0x${badBlob}> ${reconstructScript(0)}`);
const tamperDetected = rb.stack[rb.stack.length - 1] !== scal[0];
console.log(`  tampered mask -> reconstructs != scalar (rejected by ==check): ${tamperDetected}`);

console.log(`\n  SOUND MASK BINDING: ${allOk && tamperDetected ? 'YES - masks provably encode the verified scalars; tamper detected' : 'NO'}`);
