// END-TO-END LANGUAGE FEATURE: a contract that authenticates a signer via on-chain ecrecover. The contract input
// is co-spent WITH the 2 recovery inputs in ONE transaction; it (1) verifies the co-spent recovery is bound to
// the contract's own (hash,v,r,s) via the recovery covenant hashes, (2) reads the recovered Q from the recovery
// output, converts it to affine, and (3) requires it equal the expected signer. This is what the compiler would
// emit for `require(ecrecoverPubKey(hash,v,r,s) == signer)`, dispatched over recover(). Verified vs ethers.
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, binToHex, hash256, bigIntToVmNumber } from '@bitauth/libauth';
import { recover, asm } from './lib.mjs';
import { E, P } from './emit.mjs';

const vm = createVirtualMachineBch2026();
const num = (v) => (v === 0n ? 'OP_0' : `<0x${binToHex(bigIntToVmNumber(v))}>`);
const mod = (a, m) => ((a % m) + m) % m;
const invP = (a) => { let [g, x] = [mod(a, P), P], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, P); };
const DECODE3 = '<33> OP_SPLIT <33> OP_SPLIT OP_BIN2NUM OP_TOALTSTACK OP_BIN2NUM OP_TOALTSTACK OP_BIN2NUM OP_FROMALTSTACK OP_FROMALTSTACK';

// contract covenant: input index = K (after the K recovery inputs). Bakes expected signer (Qx,Qy) + recovery cov hashes.
function contractCovenant(covHashes, expX, expY, lastOutIdx) {
  // affine + compare, generated with the register machine (stack in: [Zinv X Y Z])
  const e = new E(); e.stk = ['Zinv', 'X', 'Y', 'Z'];
  e.mul('Zinv', 'Zinv', 'Zi2'); e.mul('X', 'Zi2', 'Qx'); e.mul('Zi2', 'Zinv', 'Zi3'); e.mul('Y', 'Zi3', 'Qy');
  e.keep(['Qx', 'Qy']);
  const integrity = covHashes.map((h, j) => `${num(BigInt(j))} OP_UTXOBYTECODE OP_HASH256 <0x${binToHex(h)}> OP_EQUALVERIFY`).join(' ');
  return (
    'OP_DROP ' +                                            // drop pad -> [Zinv]
    `${integrity} ` +                                        // recovery inputs are the genuine covenant for THIS (hash,v,r,s)
    `${num(BigInt(lastOutIdx))} OP_OUTPUTTOKENCOMMITMENT ` + // [Zinv Qblob]  (recovered Q, Jacobian)
    `${DECODE3} ` +                                          // [Zinv X Y Z]
    `${e.asm()} ` +                                          // -> [Qx Qy]  (affine)
    `${num(expY)} OP_NUMEQUALVERIFY ${num(expX)} OP_NUMEQUALVERIFY OP_1`  // recovered signer == expected
  );
}

async function main() {
  console.log('=== END-TO-END FEATURE: contract authenticates signer via on-chain ecrecover ===');
  let pass = 0, total = 0;
  for (let t = 0; t < 3; t++) {
    const wallet = ethers.Wallet.createRandom();
    const msg = 'feature ' + t;
    const sig = await wallet.signMessage(msg);
    const digest = ethers.hashMessage(msg);
    const { r, s, v } = ethers.Signature.from(sig);
    // signer's pubkey (what the contract authenticates against)
    const pub = secp256k1.ProjectivePoint.fromHex(ethers.SigningKey.recoverPublicKey(digest, sig).slice(2)).toAffine();

    // build the recovery (2 inputs) via the engine
    const rec = recover(digest, v, BigInt(r), BigInt(s), { chunk: 66 });
    const K = rec.K;
    const covHashes = rec.sourceOutputs.map((so) => hash256(so.lockingBytecode));
    const Zinv = invP(rec.checkpoints[K - 1][2]);   // Z^-1 of the final Jacobian Q (contract witness)

    // build the contract covenant + extend the recovery tx with the contract input (index K)
    const buildContract = (expX, expY) => asm(contractCovenant(covHashes, expX, expY, K - 1));
    const cov = buildContract(pub.x, pub.y);
    const pad = `<0x${'00'.repeat(5000)}>`;
    const contractUnlock = asm(`${num(Zinv)} ${pad}`);
    const tx = {
      ...rec.transaction,
      inputs: [...rec.transaction.inputs, { outpointIndex: K, outpointTransactionHash: new Uint8Array(32).fill(K), sequenceNumber: 0xffffffff, unlockingBytecode: contractUnlock }],
    };
    const srcs = [...rec.sourceOutputs, { lockingBytecode: cov, valueSatoshis: 1000n }];
    // validate every input in the ONE transaction
    let allValid = true;
    for (let j = 0; j <= K; j++) { const st = vm.evaluate({ inputIndex: j, sourceOutputs: srcs, transaction: tx }); if (st.error) { allValid = false; if (j === K) console.log(`    contract input err: ${st.error.slice(0, 60)}`); } }
    total++; if (allValid) pass++;
    console.log(`  sig ${t}: ${K + 1} inputs (${K} recovery + 1 contract), contract authenticates signer: ${allValid ? 'PASS' : 'FAIL'}`);

    // negative: contract expecting a DIFFERENT signer must reject
    if (t === 0) {
      const wrongCov = buildContract(mod(pub.x + 1n, P), pub.y);
      const wrongSrcs = [...rec.sourceOutputs, { lockingBytecode: wrongCov, valueSatoshis: 1000n }];
      const wrongTx = { ...tx, inputs: [...rec.transaction.inputs, { ...tx.inputs[K] }] };
      const rej = !!vm.evaluate({ inputIndex: K, sourceOutputs: wrongSrcs, transaction: wrongTx }).error;
      console.log(`  negative: contract expecting wrong signer rejects: ${rej}`);
    }
  }
  console.log(`\n  FEATURE: contract-authenticates-via-ecrecover works on ${pass}/${total}: ${pass === total ? 'YES - END TO END' : 'NO'}`);
}
main().catch((e) => { console.error('ERR', e.stack || e.message); process.exit(1); });
