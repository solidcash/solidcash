// Minimal BCH-2026 VM harness: evaluate [unlocking][locking], report script error + final stack.
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, hexToBin } from '@bitauth/libauth';

const vm = createVirtualMachineBch2026();

export function asm(s) {
  const r = assembleBytecodeBch(s);
  if (!r.success) throw new Error('assemble failed: ' + JSON.stringify(r.errors) + '\n for: ' + s.slice(0, 200));
  return r.bytecode;
}

// Evaluate the program; return {error, stack:[hex...], ok}. ok = no error and a single truthy item.
export function run(unlockingAsm, lockingAsm) {
  const transaction = {
    version: 2, locktime: 0,
    inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff,
      unlockingBytecode: asm(unlockingAsm) }],
    outputs: [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }],
  };
  const sourceOutputs = [{ lockingBytecode: asm(lockingAsm), valueSatoshis: 1000n }];
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  const stack = (state.stack ?? []).map(binToHex);
  const top = stack[stack.length - 1];
  const truthy = top !== undefined && top !== '' && !/^0+$/.test(top) && top !== '80';
  return { error: typeof state.error === 'string' ? state.error : undefined, stack, ok: !state.error && truthy };
}
export { binToHex, hexToBin };
