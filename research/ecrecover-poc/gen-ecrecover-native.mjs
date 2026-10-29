// PRODUCTION NATIVE-SIGCHECK RECOVERY COVENANT (role V): one side-car input verifies a witnessed ecrecover result with
// four OP_CHECKDATASIGs (native.mjs) and commits the recovered key, in place of the A/B ladder pair.
//
// Unlocking: <pad(32)> <argBlob> <wBlob> <redeem>, redeem = 0x20 || salt || covenant (P2SH32), so the covenant runs
// on [pad argBlob wBlob salt]:
//  - salt: dropped when SHARED (all-zero), else input 0 must carry that category (the A/B brand check);
//  - pad: 32 bytes the covenant drops; a framed body reads an off-curve proof in it, as in A's pad;
//  - argBlob = hash(32) || v(1) || r(32) || s(32), the scalars little-endian (the master binds it to its own call);
//  - wBlob = Qx Qy Ry rinv D1x D1y inv1 gInv r2inv D2x D2y inv2 (each a 33-byte little-endian number) || m1 || m2.
// It commits parity || Qx (a 33-byte little-endian number), the 34-byte form B commits, to its own output's NFT and
// preserves its lock and token category (with capability) there.
// GEN=1 prints the covenant and its hash256 for packages/utils/src/ecrecover-compute-library.ts.
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, hexToBin, sha256 as libSha256 } from '@bitauth/libauth';
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { defines, verifierBody, witnessFor, signedBy, P } from './native.mjs';

const vm = createVirtualMachineBch2026();
const asm = (text) => { const r = assembleBytecodeBch(text); if (!r.success) throw new Error('asm ' + JSON.stringify(r.errors)); return r.bytecode; };
const sha256d = (b) => libSha256.hash(libSha256.hash(b));

const SALT_CHECK = `OP_DUP <0x${'00'.repeat(32)}> OP_EQUAL OP_IF OP_DROP OP_ELSE OP_0 OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_DROP OP_EQUALVERIFY OP_ENDIF`;
// [pad argBlob wBlob] -> the named stack PARSED, bottom to top.
const PARSED = ['z', 'v', 'r', 's', 'Qx', 'Qy', 'Ry', 'rinv', 'D1x', 'D1y', 'inv1', 'gInv', 'r2inv', 'D2x', 'D2y', 'inv2', 'm1', 'm2'];
const PARSE = [
  'OP_ROT OP_DROP OP_SWAP',                                                     // drop pad -> [wBlob argBlob]
  '<32> OP_SPLIT OP_SWAP <0x00> OP_CAT OP_BIN2NUM OP_SWAP',                     // z
  'OP_1 OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP',                                   // v
  '<32> OP_SPLIT OP_SWAP <0x00> OP_CAT OP_BIN2NUM OP_SWAP <0x00> OP_CAT OP_BIN2NUM', // r s
  '<4> OP_ROLL',                                                                // [z v r s wBlob]
  // twelve 33-byte numbers, then m1 || m2
  'OP_BEGIN <33> OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP OP_SIZE OP_2 OP_NUMEQUAL OP_UNTIL OP_1 OP_SPLIT',
].join(' ');
// [Qx Qy] -> []: commit parity || Qx33 to this input's output, and preserve the lock and the token category there.
const COMMIT = [
  'OP_2 OP_MOD OP_2 OP_ADD OP_SWAP <33> OP_NUM2BIN OP_CAT',
  'OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY',
  'OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY',
  'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUAL',
].join(' ');

export const covenantV = () => `${SALT_CHECK} ${PARSE} ${defines()} ${verifierBody(PARSED)} ${COMMIT}`;

const le = (value, bytes) => { const b = new Uint8Array(bytes); for (let i = 0, x = value; x > 0n; i += 1, x >>= 8n) b[i] = Number(x & 0xffn); return b; };
/** argBlob, wBlob and the committed key for a witness. */
export function blobsOf(w) {
  const argBlob = Uint8Array.from([...le(w.z, 32), Number(w.v), ...le(w.r, 32), ...le(w.s, 32)]);
  const fields = ['Qx', 'Qy', 'Ry', 'rinv', 'D1x', 'D1y', 'inv1', 'gInv', 'r2inv', 'D2x', 'D2y', 'inv2'];
  const wBlob = Uint8Array.from([...fields.flatMap((f) => [...le(w[f], 33)]), ...w.m1, ...w.m2]);
  const committed = Uint8Array.from([2 + Number(w.Qy & 1n), ...le(w.Qx, 33)]);
  return { argBlob, wBlob, committed };
}

function main() {
  const cov = asm(covenantV());
  const CAT = new Uint8Array(32).fill(0xee);
  const tok = (commitment) => ({ category: CAT, amount: 0n, nft: { capability: 'mutable', commitment } });
  const push = (b) => `<0x${binToHex(b)}>`;
  /** One side-car spend at input 1 (input 0 stands for the master), committing `committed`. */
  const spend = (w, committed, { pad = new Uint8Array(32), argBlob, wBlob } = {}) => {
    const blobs = blobsOf(w);
    const unlocking = asm(`${push(pad)} ${push(argBlob ?? blobs.argBlob)} ${push(wBlob ?? blobs.wBlob)} ${push(new Uint8Array(32))}`);
    const input = (i, unlockingBytecode) => ({ outpointIndex: i, outpointTransactionHash: new Uint8Array(32).fill(i + 1), sequenceNumber: 0xffffffff, unlockingBytecode });
    const tx = { version: 2, locktime: 0, inputs: [input(0, new Uint8Array(0)), input(1, unlocking)],
      outputs: [{ lockingBytecode: new Uint8Array([0x51]), valueSatoshis: 1000n }, { lockingBytecode: cov, valueSatoshis: 1000n, token: tok(committed ?? blobs.committed) }] };
    const sourceOutputs = [{ lockingBytecode: new Uint8Array([0x51]), valueSatoshis: 1000n }, { lockingBytecode: cov, valueSatoshis: 1000n, token: tok(new Uint8Array(0)) }];
    return { state: vm.evaluate({ inputIndex: 1, sourceOutputs, transaction: tx }), unlocking };
  };

  console.log('=== production recovery covenant V: parse + 4 native checks + commit + self-preserve ===');
  let ok = true, worstCost = 0, worstUnlocking = 0;
  for (let i = 0; i < 12; i += 1) {
    const wallet = ethers.Wallet.createRandom();
    const digest = ethers.keccak256(ethers.toUtf8Bytes(`permit ${i} ${Date.now()}`));
    const { call, Q } = signedBy(wallet, digest);
    const w = witnessFor(call, Q);
    const { state, unlocking } = spend(w);
    const fine = state.error === undefined;
    ok &&= fine;
    worstCost = Math.max(worstCost, state.metrics?.operationCost ?? 0);
    worstUnlocking = Math.max(worstUnlocking, unlocking.length + 33 + cov.length + 3);
    if (!fine) console.log(`  sig ${i}: FAIL ${state.error}`);
  }
  console.log(`  12 random signatures: ${ok ? 'all verify and commit' : 'SOME FAILED'}; worst op-cost ${worstCost} (budget-bound below ${Math.ceil(worstCost / 800) - 41} B), unlocking ${worstUnlocking} B`);

  // Negatives: each spend must fail.
  const wallet = ethers.Wallet.createRandom();
  const digest = ethers.keccak256(ethers.toUtf8Bytes('negatives'));
  const { call, Q } = signedBy(wallet, digest);
  const honest = witnessFor(call, Q);
  const otherKey = (() => {
    const pub = ethers.SigningKey.recoverPublicKey(digest, { r: ethers.toBeHex(call.r, 32), s: ethers.toBeHex(call.s, 32), v: call.v === 27 ? 28 : 27 });
    const b = hexToBin(pub.slice(2)); return { x: BigInt('0x' + binToHex(b.slice(1, 33))), y: BigInt('0x' + binToHex(b.slice(33))) };
  })();
  const random = secp256k1.ProjectivePoint.BASE.multiply(98765432123456789n).toAffine();
  const fails = (w, committed, extra) => spend(w, committed, extra).state.error !== undefined;
  const wrongCommit = Uint8Array.from(blobsOf(honest).committed); wrongCommit[5] ^= 1;
  const otherArg = blobsOf(honest).argBlob.slice(); otherArg[0] ^= 1;
  const cases = {
    'honest spend passes': !fails(honest),
    'an off-curve proof in the pad still passes': !fails(honest, undefined, { pad: new Uint8Array(32).fill(7) }),
    'other recovery id key': fails({ ...witnessFor(call, otherKey), v: BigInt(call.v) }),
    'random key with honest shifts': fails(witnessFor(call, random)),
    'Q.y negated': fails(witnessFor(call, { x: Q.x, y: P - Q.y })),
    'commitment of another key': fails(honest, wrongCommit),
    'argBlob hash changed': fails(honest, undefined, { argBlob: otherArg }),
    'v flipped with its R': fails(witnessFor({ ...call, v: call.v === 27 ? 28 : 27 }, Q)),
    'D2 replaced by D1': fails({ ...honest, D2x: honest.D1x, D2y: honest.D1y }),
    'wBlob one field short': fails(honest, undefined, { wBlob: blobsOf(honest).wBlob.slice(33) }),
  };
  for (const [name, passed] of Object.entries(cases)) console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}`);
  const negativesHold = Object.values(cases).every(Boolean);
  console.log(`  covenant V = ${cov.length} B, hash256 ${binToHex(sha256d(cov))}`);
  console.log(`\n  PRODUCTION RECOVERY COVENANT V: ${ok && negativesHold ? 'WORKS (verify + commit + self-preserving, every negative fails)' : 'FAIL'}`);
  if (ok && negativesHold && process.env.GEN) {
    console.log('\n--- covenant hex for packages/utils/src/ecrecover-compute-library.ts ---');
    console.log('V_COVENANT =', binToHex(cov));
    console.log('V_COVENANT_HASH =', binToHex(sha256d(cov)));
  }
}
main();
