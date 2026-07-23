// SELF-PRESERVING REUSABLE recovery sidecar (2 UTXOs). Unlike lib.mjs (per-signature baked covenant), this is a
// FIXED signature-independent covenant PAIR: (hash,v,r,s), the GLV table and masks are WITNESSED in the unlocking
// and verified on-chain. Deployed N times at contract creation; each spend recovers a pubkey and RE-CREATES the
// pair (self-preservation) so it is reused across spends. The recovered pubkey lands in the SECOND sidecar output's
// data-NFT commitment (compressed, 34B, fits the CashTokens 40B commitment limit). This step-1 file proves the
// core reusability primitive: a ladder that reads the GLV table from a WITNESSED blob == the baked-table ladder.
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, bigIntToVmNumber, vmNumberToBigInt, hash256 as sha256d } from '@bitauth/libauth';
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
function jDbl([X1, Y1, Z1]) { const A = mod(X1 * X1, P), B = mod(Y1 * Y1, P), C = mod(B * B, P); const D = mod(2n * mod((X1 + B) * (X1 + B) - A - C, P), P), Ee = mod(3n * A, P), F = mod(Ee * Ee, P); const X3 = mod(F - 2n * D, P); return [X3, mod(Ee * (D - X3) - 8n * C, P), mod(2n * Y1 * Z1, P)]; }
function jAdd([X1, Y1, Z1], x2, y2) { const Z1Z1 = mod(Z1 * Z1, P), U2 = mod(x2 * Z1Z1, P), S2 = mod(y2 * Z1 * Z1Z1, P); const H = mod(U2 - X1, P), HH = mod(H * H, P), I = mod(4n * HH, P), J = mod(H * I, P); const r = mod(2n * (S2 - Y1), P), V = mod(X1 * I, P); const X3 = mod(r * r - J - 2n * V, P); return [X3, mod(r * (V - X3) - 2n * Y1 * J, P), mod((Z1 + H) * (Z1 + H) - Z1Z1 - HH, P)]; }

const to33 = (v) => { const b = new Uint8Array(33); b.set(bigIntToVmNumber(v)); return b; };
const accBlob = ([X, Y, Z]) => { const b = new Uint8Array(99); b.set(to33(X), 0); b.set(to33(Y), 33); b.set(to33(Z), 66); return b; };
const DECODE3 = '<33> OP_SPLIT <33> OP_SPLIT OP_BIN2NUM OP_TOALTSTACK OP_BIN2NUM OP_TOALTSTACK OP_BIN2NUM OP_FROMALTSTACK OP_FROMALTSTACK';
const COMBINE3 = 'OP_TOALTSTACK OP_TOALTSTACK <33> OP_NUM2BIN OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT';

const DEFS = (() => {
  const db = new E(); db.stk = ['X', 'Y', 'Z']; emitJdbl(db, []);
  const ad = new E(); ad.stk = ['X', 'Y', 'Z', 'X2', 'Y2']; ad.relabel('X', 'X1').relabel('Y', 'Y1').relabel('Z', 'Z1'); emitJaddMixed(ad, []);
  return `<0x${binToHex(asm(db.asm()))}> <0x10> OP_DEFINE <0x${binToHex(asm(ad.asm()))}> <0x11> OP_DEFINE`;
})();

// WITNESSED-table GLV 4-way Shamir. Stack in: [tableBlob X Y Z maskChunk]; the table blob is kept at the bottom
// and OP_PICKed (constant depth 4) each step, so the covenant bakes NO signature data. Leaves [tableBlob X' Y' Z'].
const shamirWitnessed =
  'OP_BEGIN ' +
    'OP_TOALTSTACK ' +                                    // maskChunk -> alt ; [tbl X Y Z]
    '<0x10> OP_INVOKE ' +                                 // double
    'OP_FROMALTSTACK ' +                                  // [tbl X Y Z maskChunk]
    'OP_1 OP_SPLIT OP_TOALTSTACK OP_BIN2NUM ' +           // [tbl X Y Z mask] ; rest -> alt
    'OP_DUP OP_0 OP_NUMEQUAL OP_IF OP_DROP OP_ELSE ' +
      '<4> OP_PICK OP_SWAP <0x42> OP_MUL OP_SPLIT OP_NIP <0x42> OP_SPLIT OP_DROP ' + // table[mask] entry (66B)
      '<33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP ' +                       // -> x2 y2
      '<0x11> OP_INVOKE ' +                                                          // mixed add
    'OP_ENDIF ' +
    'OP_FROMALTSTACK OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP';

// off-chain: full witness set for a signature (what the unlocking provides + the covenant verifies)
function witnessFor(digestHex, v, rr, ss) {
  const rec = v - 27, z = BigInt(digestHex) % N, Fp = secp256k1.CURVE.Fp;
  const Ry = (() => { const y = Fp.sqrt(mod(mod(rr * rr, P) * rr + 7n, P)); return (y & 1n) === BigInt(rec & 1) ? y : mod(P - y, P); })();
  const rinv = invN(rr), u1 = mod(mod(-z, N) * rinv, N), u2 = mod(ss * rinv, N), phiRx = mod(BETA * rr, P);
  const s1 = splitScalar(u1), s2 = splitScalar(u2);
  const { x: gx, y: gy } = secp256k1.ProjectivePoint.BASE.toAffine();
  const neg = (pt, isNeg) => isNeg ? Pt(pt.x, mod(-pt.y, P)) : pt;
  const bases = [neg(Pt(gx, gy), s1.k1neg), neg(Pt(mod(BETA * gx, P), gy), s1.k2neg), neg(Pt(rr, Ry), s2.k1neg), neg(Pt(phiRx, Ry), s2.k2neg)];
  const scalars = [s1.k1, s1.k2, s2.k1, s2.k2];
  const table = []; for (let m = 0; m < 16; m++) { let a = null; for (let i = 0; i < 4; i++) if (m & (1 << i)) a = a ? a.add(bases[i]) : bases[i]; table.push(a); }
  const tableAff = table.map((t) => t && t.toAffine());
  const tableBytes = new Uint8Array(16 * 66); for (let m = 1; m < 16; m++) { tableBytes.set(to33(tableAff[m].x), m * 66); tableBytes.set(to33(tableAff[m].y), m * 66 + 33); }
  const masks = []; for (let i = 127; i >= 0; i--) { let m = 0; for (let j = 0; j < 4; j++) if ((scalars[j] >> BigInt(i)) & 1n) m |= (1 << j); masks.push(m); }
  const start = masks.findIndex((m) => m !== 0), rest = masks.slice(start + 1);
  const a0 = tableAff[masks[start]], acc0 = [a0.x, a0.y, 1n];
  return { tableBytes, tableAff, masks, start, rest, acc0, scalars };
}

// ---- SELF-PRESERVING covenant PAIR (reusable across spends; the covenant is FIXED, signature-independent) ----
// A runs masks[0:HALF] -> checkpoint C, commits H = hash256(C ‖ masks ‖ tbl) and self-preserves. B verifies H against
// A's output, runs masks[HALF:] from C -> Q, converts to affine (witnessed Zinv), and commits the COMPRESSED pubkey
// into the SECOND output's data-NFT commitment (per spec). The shared (tbl,masks) hash-binding makes A and B agree on
// one signature; omission/substitution of any of tbl/masks/C fails closed. Deployed once, reused every spend.
const SELFPRESERVE =
  'OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY ' +   // output re-creates this covenant
  'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY'; // and its category
// [tbl masks acc] -> [tbl X Y Z] running the given mask slice; stashes the FULL masks blob on alt for later hashing.
function ladderHalf(mode) {
  const slice = mode === 'A' ? `${num(BigInt(HALF))} OP_SPLIT OP_DROP` : `${num(BigInt(HALF))} OP_SPLIT OP_NIP`;
  return (
    'OP_SWAP OP_DUP OP_TOALTSTACK ' +        // [tbl acc masks] ; masks -> alt
    `${slice} ` +                            // [tbl acc maskSlice]
    'OP_SWAP ' + `${DECODE3} ` +             // [tbl maskSlice X Y Z]
    '<3> OP_ROLL ' +                         // [tbl X Y Z maskSlice]
    `${shamirWitnessed}`                     // [tbl X Y Z]
  );
}
const HALF = 63;
function covenantA() {
  return (
    'OP_DROP ' +                                             // [tbl masks acc0]
    `${DEFS} ${ladderHalf('A')} ${COMBINE3} ` +              // [tbl Cblob] ; masks on alt
    'OP_FROMALTSTACK ' +                                     // [tbl Cblob masks]
    'OP_ROT OP_CAT OP_CAT OP_HASH256 ' +                     // H = hash256(Cblob ‖ masks ‖ tbl)
    'OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' + // commit H into A's output NFT commitment
    `${SELFPRESERVE} OP_1`
  );
}
// affine + compress, generated with the register machine. Stack in: [X Y Z Zinv]; leaves [Qx Qy zchk] (zchk==1 iff Zinv ok)
const AFFINE = (() => {
  const e = new E(); e.stk = ['X', 'Y', 'Z', 'Zinv'];
  e.mul('Z', 'Zinv', 'zchk');
  e.mul('Zinv', 'Zinv', 'Zi2'); e.mul('X', 'Zi2', 'Qx');
  e.mul('Zi2', 'Zinv', 'Zi3'); e.mul('Y', 'Zi3', 'Qy');
  e.keep(['Qx', 'Qy', 'zchk']);
  return e.asm();
})();
function covenantB() {
  return (
    'OP_DROP OP_TOALTSTACK ' +                               // [tbl masks Cblob] ; Zinv -> alt
    // recompute H from copies (keep tbl/masks/Cblob for the ladder) and verify == A's output (prev index)
    'OP_DUP <2> OP_PICK <4> OP_PICK OP_CAT OP_CAT OP_HASH256 ' + // [tbl masks Cblob H] , H=hash256(Cblob‖masks‖tbl)
    'OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' + // [tbl masks Cblob]
    `${DEFS} ${ladderHalf('B')} ` +                          // [tbl X Y Z] (Q Jacobian) ; masks on alt (stale), Zinv under it
    'OP_FROMALTSTACK OP_DROP OP_FROMALTSTACK ' +             // drop stale masks, pull Zinv -> [tbl X Y Z Zinv]
    '<4> OP_ROLL OP_DROP ' +                                 // drop tbl -> [X Y Z Zinv]
    `${AFFINE} ` +                                           // [Qx Qy zchk]
    'OP_1 OP_NUMEQUALVERIFY ' +                              // Z*Zinv == 1
    '<0x02> OP_MOD <0x02> OP_ADD OP_1 OP_NUM2BIN ' +         // parity byte 0x02/0x03 ; [Qx pbyte]
    'OP_SWAP <33> OP_NUM2BIN OP_CAT ' +                      // compressed = pbyte ‖ Qx(33) ; [compressedQ]
    'OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY ' + // commit the recovered pubkey into B's (2nd) output
    `${SELFPRESERVE} OP_1`
  );
}

// ---- deploy the pair once; spend it (recover); confirm it RE-CREATES itself; spend AGAIN with a different sig (reuse) ----
const covA = asm(covenantA()), covB = asm(covenantB());
const CATA = new Uint8Array(32).fill(0xa1), CATB = new Uint8Array(32).fill(0xb2);
const tokk = (cat, commitment) => ({ category: cat, amount: 0n, nft: { capability: 'mutable', commitment } });
const PADB = `<0x${'00'.repeat(8600)}>`;

function spend(digestHex, v, rr, ss, { tamper } = {}) {
  const wit = witnessFor(digestHex, v, rr, ss);
  const masks = new Uint8Array(wit.rest), tbl = wit.tableBytes;
  const Cjac = (() => { let a = wit.acc0; for (let i = 0; i < HALF; i++) { a = jDbl(a); const m = wit.rest[i]; if (m) a = jAdd(a, wit.tableAff[m].x, wit.tableAff[m].y); } return a; })();
  const Cblob = accBlob(Cjac);
  const Qj = (() => { let a = Cjac; for (let i = HALF; i < wit.rest.length; i++) { a = jDbl(a); const m = wit.rest[i]; if (m) a = jAdd(a, wit.tableAff[m].x, wit.tableAff[m].y); } return a; })();
  const [Qx, Qy] = jAff(Qj), Zinv = invP(Qj[2]);
  const compressed = new Uint8Array(34); compressed[0] = 2 + Number(Qy & 1n); compressed.set(to33(Qx), 1);
  const Hbind = (() => { const pre = new Uint8Array(Cblob.length + masks.length + tbl.length); pre.set(Cblob); pre.set(masks, Cblob.length); pre.set(tbl, Cblob.length + masks.length); return sha256d(pre); })();
  const mT = tamper === 'masks' ? masks.map((b, i) => i === 0 ? b ^ 1 : b) : masks;
  const cT = tamper === 'checkpoint' ? Cblob.map((b, i) => i === 0 ? b ^ 1 : b) : Cblob;
  const unlockA = asm(`<0x${binToHex(tbl)}> <0x${binToHex(masks)}> <0x${binToHex(accBlob(wit.acc0))}> ${PADB}`);
  const unlockB = asm(`<0x${binToHex(tbl)}> <0x${binToHex(new Uint8Array(mT))}> <0x${binToHex(new Uint8Array(cT))}> ${num(Zinv)} ${PADB}`);
  const tx = { version: 2, locktime: 0,
    inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: unlockA },
             { outpointIndex: 1, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff, unlockingBytecode: unlockB }],
    outputs: [{ lockingBytecode: covA, valueSatoshis: 1000n, token: tokk(CATA, Hbind) },
             { lockingBytecode: covB, valueSatoshis: 1000n, token: tokk(CATB, compressed) }] };
  const sourceOutputs = [{ lockingBytecode: covA, valueSatoshis: 1000n, token: tokk(CATA, new Uint8Array(32)) },
                        { lockingBytecode: covB, valueSatoshis: 1000n, token: tokk(CATB, new Uint8Array(34)) }];
  const rA = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction: tx });
  const rB = vm.evaluate({ inputIndex: 1, sourceOutputs, transaction: tx });
  return { rA, rB, Qx, Qy, compressed, outputs: tx.outputs, sourceOutputs, tx };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { ethers } = await import('ethers');
  console.log('=== SELF-PRESERVING reusable sidecar: recover + re-create + reuse (2 different sigs) ===');
  let ok = 0, total = 0;
  const results = [];
  for (let t = 0; t < 2; t++) {
    const w = ethers.Wallet.createRandom(); const msg = 'reuse ' + t;
    const sig = await w.signMessage(msg); const digest = ethers.hashMessage(msg);
    const { r, s, v } = ethers.Signature.from(sig);
    const expQ = secp256k1.ProjectivePoint.fromHex(ethers.SigningKey.recoverPublicKey(digest, sig).slice(2)).toAffine();
    const res = spend(digest, v, BigInt(r), BigInt(s));
    const validA = !res.rA.error, validB = !res.rB.error;
    const qMatch = res.Qx === expQ.x && res.Qy === expQ.y;
    total++; if (validA && validB && qMatch) ok++;
    console.log(`  sig ${t}: A=${validA} B=${validB} Q==ethers=${qMatch} costA=${res.rA.metrics?.operationCost} costB=${res.rB.metrics?.operationCost} ${res.rA.error ? 'A:' + res.rA.error.slice(0, 45) : res.rB.error ? 'B:' + res.rB.error.slice(0, 45) : ''}`);
    results.push(res);
  }
  // negatives: tampering the masks or the checkpoint in B must break the hash binding
  const w = ethers.Wallet.createRandom(); const sig = await w.signMessage('neg'); const digest = ethers.hashMessage('neg'); const { r, s, v } = ethers.Signature.from(sig);
  const badMasks = !!spend(digest, v, BigInt(r), BigInt(s), { tamper: 'masks' }).rB.error;
  const badCp = !!spend(digest, v, BigInt(r), BigInt(s), { tamper: 'checkpoint' }).rB.error;
  console.log(`  negatives: tampered masks rejected=${badMasks}  tampered checkpoint rejected=${badCp}`);
  console.log(`\n  SELF-PRESERVING + REUSABLE + Q-IN-2ND-OUTPUT: ${ok === total && badMasks && badCp ? 'YES' : 'NO (' + ok + '/' + total + ')'}`);
}
