// Side-car keccak library (separate from the original exploration; reuses gen25/vm read-only).
// The keccak blob lives in a side-car UTXO's redeem [self-pres, push blob, OP_DROP, OP_1]; a main
// script loads it via OP_INPUTBYTECODE, strips the wrapper, OP_DEFINEs the blob, and invokes it.
import { createVirtualMachineBch2026, sha256 } from '@bitauth/libauth';
import { asm, binToHex, hexToBin } from './vm.mjs';
import { genKeccak256x32v2 } from './gen25.mjs';

const aTo = (s) => binToHex(asm(s));
// keccak blob: self-contained function [msg32] -> [hash32] (internally defines round id2).
export const blobHex = binToHex(asm(genKeccak256x32v2(aTo)));
export const blobLen = blobHex.length / 2;
export const KID = 7;                                   // function id keccak is defined under

// self-preservation: output[myIndex].lockingBytecode == utxo[myIndex].lockingBytecode
export const SP_ASM = 'OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY';
export const Lsp = binToHex(asm(SP_ASM)).length / 2;

// side-car redeem = SP | PUSHDATA(blob) | OP_DROP OP_1
export const redeemAsm = `${SP_ASM} <0x${blobHex}> OP_DROP OP_1`;
export const redeemHex = binToHex(asm(redeemAsm));
const afterSP = redeemHex.slice(Lsp * 2);
export const blobPushPrefix = afterSP.startsWith('4d') ? 3 : afterSP.startsWith('4c') ? 2 : 1;

// Given side-car REDEEM bytes on top of stack, leave the keccak blob defined as KID (consumes redeem).
export const defineFromRedeem =
  `<${Lsp}> OP_SPLIT OP_NIP `                 // drop self-pres
  + `<${blobPushPrefix}> OP_SPLIT OP_NIP `    // drop blob push prefix
  + `<${blobLen}> OP_SPLIT OP_DROP `          // split blob | (OP_DROP OP_1) suffix; drop suffix
  + `<${KID}> OP_DEFINE`;                     // define keccak as KID

// --- multi-input VM harness (side-car specific) ---
const vm = createVirtualMachineBch2026();
export const hash256 = (b) => sha256.hash(sha256.hash(b));
export const p2sh32 = (redeem) => Uint8Array.from([0xaa, 0x20, ...hash256(redeem), 0x87]); // HASH256 <32> EQUAL
export function evalInput(inputs, sourceOutputs, outputs, inputIndex) {
  const st = vm.evaluate({ inputIndex, sourceOutputs, transaction: { version: 2, locktime: 0, inputs, outputs } });
  const stack = (st.stack ?? []).map(binToHex);
  const top = stack[stack.length - 1];
  const truthy = top !== undefined && top !== '' && !/^0+$/.test(top) && top !== '80';
  return { error: typeof st.error === 'string' ? st.error : undefined, stack, ok: !st.error && truthy, metrics: st.metrics };
}
export { asm, hexToBin, binToHex };
