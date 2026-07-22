import {
  createVirtualMachine, createVirtualMachineBch2026, ripemd160, secp256k1, sha1, sha256,
} from '@bitauth/libauth';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { createInstructionSetBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-instruction-set.js';
import type NetworkProvider from './NetworkProvider.js';

/** Build the SDK's probe VM with the active private-network limits, if any. */
export function createVirtualMachineBch2026ForProvider(
  provider?: NetworkProvider,
): ReturnType<typeof createVirtualMachineBch2026> {
  const limits = provider?.consensusLimits;
  if (limits === undefined) return createVirtualMachineBch2026();
  const consensus = {
    ...ConsensusBch2026,
    maximumBytecodeLength: limits.maximumInputBytes,
    maximumStackItemLength: limits.maximumStackItemBytes,
    maximumTransactionLengthBytes: limits.maximumTransactionBytes,
    maximumStandardUnlockingBytecodeLength: limits.maximumInputBytes,
    maximumStandardLockingBytecodeLength: limits.maximumInputBytes,
    maximumStandardTransactionSize: limits.maximumTransactionBytes,
  };
  const instructionSet = createInstructionSetBch2026(true, {
    consensus, ripemd160, secp256k1, sha1, sha256,
  } as never);
  return createVirtualMachine(instructionSet);
}
