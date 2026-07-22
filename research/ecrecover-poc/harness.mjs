// BCH-2026 VM harness for the ecrecover recovery build.
// Assembles ASM, runs on createVirtualMachineBch2026, returns {error, stack (bigints/hex), opCost}.
import {
  createVirtualMachineBch2026, assembleBytecodeBch, binToHex, hexToBin,
  bigIntToVmNumber, vmNumberToBigInt,
} from '@bitauth/libauth';

const vm = createVirtualMachineBch2026();

export function asm(s) {
  const r = assembleBytecodeBch(s);
  if (!r.success) throw new Error('assemble failed: ' + JSON.stringify(r.errors) + '\n  for: ' + s.slice(0, 300));
  return r.bytecode;
}

// Push a bigint as a VM number literal (LE sign-magnitude, minimal). Zero -> OP_0 (empty push).
export const num = (v) => (v === 0n ? 'OP_0' : `<0x${binToHex(bigIntToVmNumber(v))}>`);
// Push raw bytes.
export const push = (hex) => `<0x${hex}>`;

// Evaluate unlocking||locking; return {error, opCost, instr, stack:[bigint...], stackHex:[...]}.
export function run(unlockingAsm, lockingAsm) {
  const transaction = {
    version: 2, locktime: 0,
    inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff,
      unlockingBytecode: asm(unlockingAsm) }],
    outputs: [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }],
  };
  const sourceOutputs = [{ lockingBytecode: asm(lockingAsm), valueSatoshis: 1000n }];
  const st = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  const stackHex = (st.stack ?? []).map(binToHex);
  const stack = (st.stack ?? []).map((b) => {
    const r = vmNumberToBigInt(b, { maximumVmNumberByteLength: 20000, requireMinimalEncoding: false });
    return typeof r === 'bigint' ? r : `<${stackHex[(st.stack).indexOf(b)]}>`;
  });
  return {
    error: typeof st.error === 'string' ? st.error : undefined,
    opCost: st.metrics?.operationCost, instr: st.metrics?.evaluatedInstructionCount,
    stack, stackHex,
  };
}

export { binToHex, hexToBin, bigIntToVmNumber, vmNumberToBigInt };
