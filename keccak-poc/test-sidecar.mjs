// 2-input transaction: a `main` input loads keccak from a `side-car` input via OP_INPUTBYTECODE,
// OP_DEFINEs it, and invokes it on data; the side-car self-preserves. Output verified vs EVM keccak256.
import createKeccak from 'keccak';
import * as S from './sidecar.mjs';

const evm = (h) => createKeccak('keccak256').update(Buffer.from(h, 'hex')).digest('hex');

function runPair(msg, expected) {
  const redeem = S.hexToBin(S.redeemHex);
  const sidecarLock = S.p2sh32(redeem);
  const sidecarUnlock = S.asm(`<0x${S.redeemHex}>`);             // P2SH unlocking = PUSHDATA(redeem)

  // main (input0, bare script): read side-car (input1) unlocking, strip outer PUSHDATA2 prefix (3),
  // define keccak from the redeem, invoke on msg, compare to the expected hash arg.
  const mainAsm = `<1> OP_INPUTBYTECODE <3> OP_SPLIT OP_NIP `    // [pad,msg,exp, redeem]
    + `${S.defineFromRedeem} `                                  // [pad,msg,exp]  (keccak = KID)
    + `OP_SWAP <${S.KID}> OP_INVOKE `                           // [pad, exp, hash]
    + `OP_EQUAL OP_NIP`;                                        // [bool]
  const mainLock = S.asm(mainAsm);
  const mainUnlock = S.asm(`<0x${'00'.repeat(3200)}> <0x${msg}> <0x${expected}>`); // pad, msg, expected

  const inputs = [
    { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32),         sequenceNumber: 0xffffffff, unlockingBytecode: mainUnlock },
    { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: sidecarUnlock },
  ];
  const sourceOutputs = [{ lockingBytecode: mainLock, valueSatoshis: 100000n }, { lockingBytecode: sidecarLock, valueSatoshis: 100000n }];
  const outputs = [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }, { lockingBytecode: sidecarLock, valueSatoshis: 100000n }];

  return { main: S.evalInput(inputs, sourceOutputs, outputs, 0), side: S.evalInput(inputs, sourceOutputs, outputs, 1) };
}

console.log('keccak blob:', S.blobLen, 'bytes | redeem:', S.redeemHex.length / 2, 'bytes | main locking: small\n');
for (const msg of ['00'.repeat(32), '11'.repeat(32), 'deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718']) {
  const ok = runPair(msg, evm(msg));
  console.log(`msg ${msg.slice(0,12)}..  main=${ok.main.ok?'OK':'FAIL'} (opCost ${ok.main.metrics?.operationCost})  side-car=${ok.side.ok?'OK':'FAIL'}${ok.main.error?'  ['+ok.main.error.slice(0,40)+']':''}`);
}
// negative: a tampered side-car blob must make the main produce a wrong hash -> fail
const bad = runPair('11'.repeat(32), '00'.repeat(32));
console.log(`\nnegative (wrong expected): main correctly fails = ${!bad.main.ok}`);
