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
 *
 * `limits` and `observer` are independent. Only MockNetworkProvider publishes `consensusLimits`, so binding
 * the observer to their presence dropped it on every live network (Electrum, regtest, FullStack, Bitcoin RPC).
 *
 * THE CALLERS DO NOT PASS ONE FOR A LIMITS-LESS PROVIDER, AND SHOULD NOT START. Every in-tree observer caller
 * first checks `(provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000`, so the fix above removes a
 * trap rather than changing behaviour; the gate, not this factory, is what keeps live networks on full
 * `vm.debug()`. Relaxing the gate was measured and is wrong in both directions:
 *
 * - AT ordinary capacity `debug()` is cheap AND BOUNDED, because BCH-2026 density control caps a probe at
 *   `operationCostBudgetPerByte * (densityControlBaseLength + inputBytes)`. A maximal 9,817-byte input reaches
 *   77,216 retained states and then the VM refuses the next operation: 0.6-0.9 s, 63-68 MB. That is the worst
 *   case, not a typical one.
 * - The observer trace is NOT a faithful substitute. It retains only the six inspected opcodes, and
 *   `extractCommitmentMapFromTrace` treats ANY opcode between `OP_OUTPUTTOKENCOMMITMENT` and `OP_EQUALVERIFY`
 *   as proof the pair is not a commitment verification. An intervening opcode outside the observed set is
 *   invisible, so a pattern the full trace correctly derives nothing from yields a phantom commitment.
 * - ABOVE ordinary capacity `debug()` is not merely slow, it throws: libauth's `proxyDebug` spreads the whole
 *   state array into `push`, which exceeds V8's argument limit between 100,014 and 124,014 states. Past that
 *   point the observer is the only usable instrument, which is exactly what the gate selects it for.
 */
export function createVirtualMachineBch2026ForProvider(
  provider?: NetworkProvider,
  observer?: { opcodes: ReadonlySet<number>; beforeOperation: (state: unknown) => void },
  options?: { standard?: boolean },
): ReturnType<typeof createVirtualMachineBch2026> {
  const standard = options?.standard ?? true;
  const limits = provider?.consensusLimits;
  // Nothing to customise. This is not a silent drop: with no limits AND no observer, libauth's own factory
  // builds precisely the instruction set the rest of this function would assemble.
  if (limits === undefined && observer === undefined) return createVirtualMachineBch2026(standard);
  const consensus = limits === undefined ? ConsensusBch2026 : {
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
  if (limits !== undefined) {
    const maximumStackItemLength = limits.maximumStackItemBytes;
    const pushCommitment = (state: State, output: { token?: { nft?: { commitment: Uint8Array } } }) => (
      output.token?.nft === undefined
        ? pushToStackVmNumber(state, 0n)
        : pushToStackChecked(state, output.token.nft.commitment, { maximumStackItemLength })
    );
    instructionSet.operations[OpcodesBch2026.OP_UTXOTOKENCOMMITMENT] = conditionallyEvaluate(
      (state: State) => useTransactionUtxo(state, (nextState, [utxo]) => pushCommitment(nextState, utxo)),
    );
    instructionSet.operations[OpcodesBch2026.OP_OUTPUTTOKENCOMMITMENT] = conditionallyEvaluate(
      (state: State) => useTransactionOutput(state, (nextState, [output]) => pushCommitment(nextState, output)),
    );
  }
  if (observer !== undefined) {
    // 47 of the 256 opcodes have no entry in `operations`; libauth routes those through `instructionSet
    // .undefined`. Wrapping a missing entry produced `TypeError: operation is not a function` instead of the
    // VM's own "Called an unknown opcode." - and the covenant failure tracer observes the whole 0..255 range.
    let observesUndefined = false;
    for (const opcode of observer.opcodes) {
      const operation = instructionSet.operations[opcode];
      if (operation === undefined) {
        observesUndefined = true;
        continue;
      }
      instructionSet.operations[opcode] = (state: State) => {
        observer.beforeOperation(state);
        return operation(state);
      };
    }
    if (observesUndefined) {
      const undefinedOperation = instructionSet.undefined;
      instructionSet.undefined = (state: State) => {
        const executing = state as unknown as { ip: number; instructions: Array<{ opcode: number }> };
        const opcode = executing.instructions[executing.ip]?.opcode;
        if (opcode !== undefined && observer.opcodes.has(opcode)) observer.beforeOperation(state);
        return undefinedOperation(state);
      };
    }
  }
  return createVirtualMachine(instructionSet);
}
