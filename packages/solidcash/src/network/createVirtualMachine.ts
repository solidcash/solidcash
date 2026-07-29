import {
  conditionallyEvaluate, createVirtualMachine, createVirtualMachineBch2026, pushToStackChecked,
  pushToStackVmNumber, ripemd160, secp256k1, sha1, sha256, useTransactionOutput, useTransactionUtxo,
} from '@bitauth/libauth';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { createInstructionSetBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-instruction-set.js';
import { OpcodesBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import type NetworkProvider from './NetworkProvider.js';

/**
 * Build the SDK's probe VM with the active private-network limits, if any.
 *
 * `options.standard` selects the regime libauth evaluates under. It is `true` by default, which is the
 * historical behaviour and the conservative one: standard mode applies the per-input SigChecks ceiling, prices
 * a hash digest iteration at 192 rather than 64, and reads `hashDigestIterationsPerByteStandard`. Passing
 * `false` selects real consensus pricing and reads `hashDigestIterationsPerByteNonstandard` instead.
 */
export function createVirtualMachineBch2026ForProvider(
  provider?: NetworkProvider,
  observer?: { opcodes: ReadonlySet<number>; beforeOperation: (state: unknown) => void },
  options?: { standard?: boolean },
): ReturnType<typeof createVirtualMachineBch2026> {
  const standard = options?.standard ?? true;
  const limits = provider?.consensusLimits;
  if (limits === undefined) return createVirtualMachineBch2026(standard);
  const consensus = {
    ...ConsensusBch2026,
    maximumBytecodeLength: limits.maximumInputBytes,
    maximumStackItemLength: limits.maximumStackItemBytes,
    maximumTransactionLengthBytes: limits.maximumTransactionBytes,
    maximumStandardUnlockingBytecodeLength: limits.maximumInputBytes,
    maximumStandardLockingBytecodeLength: limits.maximumInputBytes,
    maximumStandardTransactionSize: limits.maximumTransactionBytes,
    maximumTokenCommitmentLength: limits.maximumNftCommitmentBytes,
    operationCostBudgetPerByte: limits.operationCostBudgetPerByte,
    // The two regimes are set independently; each falls back to the shared value when unset.
    hashDigestIterationsPerByteStandard:
      limits.hashDigestIterationsPerByteStandard ?? limits.hashDigestIterationsPerByte,
    hashDigestIterationsPerByteNonstandard:
      limits.hashDigestIterationsPerByteNonstandard ?? limits.hashDigestIterationsPerByte,
  };
  const instructionSet = createInstructionSetBch2026(standard, {
    consensus, ripemd160, secp256k1, sha1, sha256,
  } as never);
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  const pushCommitment = (state: State, output: { token?: { nft?: { commitment: Uint8Array } } }) => (
    output.token?.nft === undefined
      ? pushToStackVmNumber(state, 0n)
      : pushToStackChecked(state, output.token.nft.commitment, {
        maximumStackItemLength: limits.maximumStackItemBytes,
      })
  );
  instructionSet.operations[OpcodesBch2026.OP_UTXOTOKENCOMMITMENT] = conditionallyEvaluate(
    (state: State) => useTransactionUtxo(state, (nextState, [utxo]) => pushCommitment(nextState, utxo)),
  );
  instructionSet.operations[OpcodesBch2026.OP_OUTPUTTOKENCOMMITMENT] = conditionallyEvaluate(
    (state: State) => useTransactionOutput(state, (nextState, [output]) => pushCommitment(nextState, output)),
  );
  if (observer !== undefined) {
    for (const opcode of observer.opcodes) {
      const operation = instructionSet.operations[opcode];
      instructionSet.operations[opcode] = (state: State) => {
        observer.beforeOperation(state);
        return operation(state);
      };
    }
  }
  return createVirtualMachine(instructionSet);
}
