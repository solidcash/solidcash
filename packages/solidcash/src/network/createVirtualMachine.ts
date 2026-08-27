import {
  applyError, authenticationInstructionsAreMalformed, AuthenticationErrorCommon, binToHex,
  conditionallyEvaluate, createVirtualMachine, createVirtualMachineBch2026, decodeAuthenticationInstructions,
  disassembleAuthenticationInstructionMalformed, isPayToScriptHash20, isPayToScriptHash32,
  isWitnessProgram, pushToStackChecked, pushToStackVmNumber, ripemd160, secp256k1, sha1, sha256,
  stackItemIsTruthy, useTransactionOutput, useTransactionUtxo,
} from '@bitauth/libauth';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { AuthenticationErrorBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-errors.js';
import { createInstructionSetBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-instruction-set.js';
import { OpcodesBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import type NetworkProvider from './NetworkProvider.js';

type DecodedInstructions = ReturnType<typeof decodeAuthenticationInstructions>;

/** Decode immutable program bytecode without copying each pushed item. */
function decodeAuthenticationInstructionViews(bytecode: Uint8Array): DecodedInstructions {
  const instructions: Array<DecodedInstructions[number]> = [];
  const view = new DataView(bytecode.buffer, bytecode.byteOffset, bytecode.byteLength);
  let index = 0;
  while (index < bytecode.length) {
    const opcode = bytecode[index]!;
    if (opcode > 0x4e) {
      instructions.push({ opcode });
      index += 1;
      continue;
    }
    const lengthBytes = opcode === 0x4c ? 1 : opcode === 0x4d ? 2 : opcode === 0x4e ? 4 : 0;
    if (lengthBytes !== 0 && index + lengthBytes >= bytecode.length) {
      const lengthStart = index + 1;
      instructions.push({
        expectedLengthBytes: lengthBytes as 1 | 2 | 4,
        length: bytecode.slice(lengthStart, lengthStart + lengthBytes),
        malformed: true,
        opcode,
      });
      break;
    }
    const dataLength = lengthBytes === 0
      ? opcode
      : lengthBytes === 1
        ? view.getUint8(index + 1)
        : lengthBytes === 2
          ? view.getUint16(index + 1, true)
          : view.getUint32(index + 1, true);
    const dataStart = index + 1 + lengthBytes;
    const dataEnd = dataStart + dataLength;
    instructions.push({
      data: bytecode.subarray(dataStart, dataEnd),
      ...(dataEnd > bytecode.length ? { expectedDataBytes: dataLength, malformed: true as const } : undefined),
      opcode,
    });
    index = dataEnd;
  }
  return instructions as DecodedInstructions;
}

// Oversized private-network contracts repeatedly spend the same P2SH scripts while changing only arguments and
// transaction state. libauth decodes the complete redeem script on every evaluation; for generated contracts the
// script can be several megabytes of function definitions, so decoding alone can take longer than execution.
// The P2SH locking bytecode authenticates the exact redeem script, making it a stable cache key. Scope the cache to
// the provider lifetime and bound it so long-running mock/miner-direct processes cannot retain every script seen.
const decodedP2shByProvider = new WeakMap<NetworkProvider, Map<string, DecodedInstructions>>();
const MAX_CACHED_P2SH_SCRIPTS = 64;

function decodeCachedP2sh(
  provider: NetworkProvider,
  lockingBytecode: Uint8Array,
  redeemBytecode: Uint8Array,
): DecodedInstructions {
  let cache = decodedP2shByProvider.get(provider);
  if (!cache) {
    cache = new Map();
    decodedP2shByProvider.set(provider, cache);
  }
  const key = binToHex(lockingBytecode);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const decoded = decodeAuthenticationInstructionViews(redeemBytecode);
  if (cache.size >= MAX_CACHED_P2SH_SCRIPTS) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, decoded);
  return decoded;
}

/** Install libauth's BCH evaluator with only its authenticated P2SH decode step cached. */
function installCachedP2shEvaluator(
  instructionSet: ReturnType<typeof createInstructionSetBch2026>,
  provider: NetworkProvider,
  maximumBytecodeLength: number,
): void {
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  instructionSet.evaluate = (program, { stateEvaluate, stateInitialize, stateOverride }) => {
    const { unlockingBytecode } = program.transaction.inputs[program.inputIndex]!;
    const { lockingBytecode } = program.sourceOutputs[program.inputIndex]!;
    // The final P2SH push can be several megabytes. The VM treats program bytecode as immutable, and the actual
    // argument stack is cloned below before redeem evaluation, so copying every pushed byte here is unnecessary.
    const unlockingInstructions = decodeAuthenticationInstructionViews(unlockingBytecode);
    const lockingInstructions = decodeAuthenticationInstructions(lockingBytecode);
    const initialState = {
      ...stateInitialize(program),
      ...stateOverride,
      instructions: unlockingInstructions,
      program,
      stack: [],
    } as State;
    if (unlockingBytecode.length > maximumBytecodeLength) {
      return applyError(
        initialState,
        AuthenticationErrorCommon.exceededMaximumBytecodeLengthUnlocking,
        `Maximum bytecode length: ${maximumBytecodeLength} bytes. Unlocking bytecode length: ${unlockingBytecode.length} bytes.`,
      );
    }
    if (authenticationInstructionsAreMalformed(unlockingInstructions)) {
      return applyError(
        initialState,
        AuthenticationErrorCommon.malformedUnlockingBytecode,
        `Malformed instruction: ${disassembleAuthenticationInstructionMalformed(
          OpcodesBch2026,
          (unlockingInstructions[unlockingInstructions.length - 1]! as
            Parameters<typeof disassembleAuthenticationInstructionMalformed>[1]),
        )}.`,
      );
    }
    // `unlockingInstructions` was decoded above without copying pushed data. Re-decoding here through libauth's
    // `isPushOnly` would allocate a second instruction graph and copy every push, defeating that optimization for
    // multi-megabyte private-network inputs. Malformed pushes have already been rejected, so opcode inspection is
    // exactly the remaining `CScript::IsPushOnly` check (OP_RESERVED through OP_16 are push-type opcodes too).
    if (!unlockingInstructions.every(({ opcode }) => opcode <= OpcodesBch2026.OP_16)) {
      return applyError(initialState, AuthenticationErrorCommon.requiresPushOnly);
    }
    if (lockingBytecode.length > maximumBytecodeLength) {
      return applyError(
        initialState,
        AuthenticationErrorCommon.exceededMaximumBytecodeLengthLocking,
        `Maximum bytecode length: ${maximumBytecodeLength} bytes. Locking bytecode length: ${lockingBytecode.length} bytes.`,
      );
    }
    if (authenticationInstructionsAreMalformed(lockingInstructions)) {
      return applyError(
        initialState,
        AuthenticationErrorCommon.malformedLockingBytecode,
        `Malformed instruction: ${disassembleAuthenticationInstructionMalformed(
          OpcodesBch2026,
          (lockingInstructions[lockingInstructions.length - 1]! as
            Parameters<typeof disassembleAuthenticationInstructionMalformed>[1]),
        )}.`,
      );
    }
    const unlockingResult = stateEvaluate(initialState);
    if (unlockingResult.error !== undefined) return unlockingResult;
    if (unlockingResult.controlStack.length !== 0) {
      return applyError(
        unlockingResult,
        AuthenticationErrorCommon.nonEmptyControlStackUnlockingBytecode,
        `Remaining control stack depth: ${unlockingResult.controlStack.length}.`,
      );
    }
    const lockingResult = stateEvaluate({
      ...stateInitialize(program),
      ...stateOverride,
      instructions: lockingInstructions,
      metrics: unlockingResult.metrics,
      program,
      stack: unlockingResult.stack,
    } as State);
    if (lockingResult.error !== undefined) return lockingResult;
    if (lockingResult.controlStack.length !== 0) {
      return applyError(
        lockingResult,
        AuthenticationErrorCommon.nonEmptyControlStackLockingBytecode,
        `Remaining control stack depth: ${lockingResult.controlStack.length}.`,
      );
    }
    const p2sh20 = isPayToScriptHash20(lockingBytecode);
    const p2sh32 = isPayToScriptHash32(lockingBytecode);
    if (!p2sh20 && !p2sh32) {
      if (lockingResult.stack.length !== 1) {
        return applyError(
          lockingResult,
          AuthenticationErrorCommon.requiresCleanStackLockingBytecode,
          `Remaining stack depth: ${lockingResult.stack.length}.`,
        );
      }
      return lockingResult;
    }
    const top = lockingResult.stack[lockingResult.stack.length - 1]!;
    if (!stackItemIsTruthy(top)) {
      return applyError(
        lockingResult,
        AuthenticationErrorCommon.unmatchedP2shRedeemBytecode,
        `Top stack item: "${binToHex(top)}".`,
      );
    }
    // Exclude the authenticated redeem script before cloning the argument-stack container. VM operations consume
    // and replace Uint8Array stack items; they never edit an existing item in place (byte-transforming opcodes
    // first take a slice). A shallow container clone therefore provides the same isolation as libauth's deep
    // clone without copying every routed argument on every fixed-point probe. Generated message-bus frames can
    // contain megabytes of immutable arguments, so deep-cloning here otherwise dominates both time and memory.
    const unlockingStack = [...unlockingResult.stack];
    const p2shScript = unlockingStack.pop() ?? Uint8Array.of();
    const p2shStack = unlockingStack.slice();
    if (p2sh20 && p2shStack.length === 0 && isWitnessProgram(p2shScript)) return lockingResult;
    const p2shInstructions = decodeCachedP2sh(provider, lockingBytecode, p2shScript);
    const p2shResult = authenticationInstructionsAreMalformed(p2shInstructions)
      ? { ...lockingResult, error: AuthenticationErrorCommon.malformedP2shBytecode }
      : stateEvaluate({
        ...stateInitialize(program),
        ...stateOverride,
        instructions: p2shInstructions,
        metrics: lockingResult.metrics,
        program,
        stack: p2shStack,
      } as State);
    if (p2shResult.controlStack.length !== 0) {
      return applyError(
        p2shResult,
        AuthenticationErrorCommon.nonEmptyControlStackRedeemBytecode,
        `Remaining control stack depth: ${p2shResult.controlStack.length}.`,
      );
    }
    if (p2shResult.stack.length !== 1) {
      return applyError(
        p2shResult,
        AuthenticationErrorCommon.requiresCleanStackRedeemBytecode,
        `Remaining stack depth: ${p2shResult.stack.length}.`,
      );
    }
    return p2shResult;
  };
}

/** Cache immutable OP_DEFINE bodies instead of decoding and copying their pushes at every OP_INVOKE. */
function installCachedInvokeEvaluator(
  instructionSet: ReturnType<typeof createInstructionSetBch2026>,
): void {
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  const decodedFunctions = new WeakMap<Uint8Array, DecodedInstructions>();
  instructionSet.operations[OpcodesBch2026.OP_INVOKE] = conditionallyEvaluate((state: State) => {
    const functionIdentifier = state.stack.pop();
    if (functionIdentifier === undefined) {
      return applyError(state, AuthenticationErrorCommon.emptyStack);
    }
    const functionTableKey = binToHex(functionIdentifier);
    const functionBody = state.functionTable[functionTableKey];
    if (functionBody === undefined) {
      return applyError(
        state,
        AuthenticationErrorBch2026.functionIdentifierUndefined,
        `Function identifier: 0x${functionTableKey}.`,
      );
    }
    let instructions = decodedFunctions.get(functionBody);
    if (instructions === undefined) {
      instructions = decodeAuthenticationInstructionViews(functionBody);
      decodedFunctions.set(functionBody, instructions);
    }
    if (authenticationInstructionsAreMalformed(instructions)) {
      return applyError(
        state,
        AuthenticationErrorBch2026.malformedFunction,
        `Malformed instruction: ${disassembleAuthenticationInstructionMalformed(
          OpcodesBch2026,
          (instructions[instructions.length - 1]! as
            Parameters<typeof disassembleAuthenticationInstructionMalformed>[1]),
        )}.`,
      );
    }
    state.controlStack.push({ instructions: state.instructions, ip: state.ip + 1 });
    state.ip = -1;
    state.instructions = instructions;
    return state;
  });
}

interface InactiveBranchTargets {
  falseBranch: Int32Array;
  elseBranch: Int32Array;
}

/** Skip inactive compiler-generated branches while preserving their base instruction cost in sparse probes. */
function installSparseProbeBranchSkips(
  instructionSet: ReturnType<typeof createInstructionSetBch2026>,
): void {
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  const targetsByInstructions = new WeakMap<DecodedInstructions, InactiveBranchTargets>();
  const targetsFor = (instructions: DecodedInstructions): InactiveBranchTargets => {
    const existing = targetsByInstructions.get(instructions);
    if (existing !== undefined) return existing;
    const falseBranch = new Int32Array(instructions.length).fill(-1);
    const elseBranch = new Int32Array(instructions.length).fill(-1);
    const open: Array<{ conditional: number; otherwise?: number }> = [];
    instructions.forEach(({ opcode }, index) => {
      if (opcode === OpcodesBch2026.OP_IF || opcode === OpcodesBch2026.OP_NOTIF) {
        open.push({ conditional: index });
      } else if (opcode === OpcodesBch2026.OP_ELSE) {
        const current = open[open.length - 1];
        if (current !== undefined && current.otherwise === undefined) current.otherwise = index;
      } else if (opcode === OpcodesBch2026.OP_ENDIF) {
        const current = open.pop();
        if (current === undefined) return;
        falseBranch[current.conditional] = current.otherwise ?? index;
        if (current.otherwise !== undefined) elseBranch[current.otherwise] = index;
      }
    });
    const targets = { falseBranch, elseBranch };
    targetsByInstructions.set(instructions, targets);
    return targets;
  };
  const jumpTo = (state: State, target: number): State => {
    if (target <= state.ip) return state;
    // `createVirtualMachine` increments both the instruction count and IP after this operation. Point one before
    // the delimiter so OP_ELSE/OP_ENDIF still performs the real control-stack transition. Inactive operations
    // cannot change any other metric, but each still contributes the BCH-2025 base instruction cost.
    state.metrics.evaluatedInstructionCount += target - state.ip - 1;
    state.ip = target - 1;
    return state;
  };
  for (const opcode of [OpcodesBch2026.OP_IF, OpcodesBch2026.OP_NOTIF]) {
    const operation = instructionSet.operations[opcode]!;
    instructionSet.operations[opcode] = (state: State) => {
      const activeBefore = state.controlStack.every((entry) => entry !== false);
      const next = operation(state);
      if (!activeBefore || next.error !== undefined || next.controlStack.at(-1) !== false) return next;
      return jumpTo(next, targetsFor(next.instructions).falseBranch[next.ip]);
    };
  }
  const elseOperation = instructionSet.operations[OpcodesBch2026.OP_ELSE]!;
  instructionSet.operations[OpcodesBch2026.OP_ELSE] = (state: State) => {
    const activeBefore = state.controlStack.every((entry) => entry !== false);
    const next = elseOperation(state);
    if (!activeBefore || next.error !== undefined) return next;
    return jumpTo(next, targetsFor(next.instructions).elseBranch[next.ip]);
  };
}

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
  observer?: {
    opcodes: ReadonlySet<number>;
    beforeOperation: (state: unknown) => void;
    /** Probe-only operation wrapper. Consensus callers must omit this; their operation remains byte-for-byte stock. */
    operation?: (
      opcode: number, state: unknown, operation: (state: never) => unknown,
    ) => unknown;
  },
  options?: { standard?: boolean; operationCostBudgetPerByte?: number },
): ReturnType<typeof createVirtualMachineBch2026> {
  const standard = options?.standard ?? true;
  const limits = provider?.consensusLimits;
  // Nothing to customise. This is not a silent drop: with no limits AND no observer, libauth's own factory
  // builds precisely the instruction set the rest of this function would assemble.
  if (limits === undefined && observer === undefined && options?.operationCostBudgetPerByte === undefined) {
    return createVirtualMachineBch2026(standard);
  }
  const consensus = {
    ...ConsensusBch2026,
    ...(limits === undefined ? {} : {
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
    }),
    ...(options?.operationCostBudgetPerByte === undefined ? {} : {
      operationCostBudgetPerByte: options.operationCostBudgetPerByte,
    }),
  };
  const instructionSet = createInstructionSetBch2026(standard, {
    consensus, ripemd160, secp256k1, sha1, sha256,
  } as never);
  if (limits !== undefined && limits.maximumInputBytes > 10_000) {
    installCachedP2shEvaluator(instructionSet, provider!, limits.maximumInputBytes);
    installCachedInvokeEvaluator(instructionSet);
    if (observer !== undefined) installSparseProbeBranchSkips(instructionSet);
  }
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  if (limits !== undefined) {
    const maximumStackItemLength = limits.maximumStackItemBytes;
    const pushCommitment = (
      state: State, output: { token?: { nft?: { commitment: Uint8Array } } },
    ): State => (
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
        return (observer.operation
          ? observer.operation(opcode, state, operation as (state: never) => unknown)
          : operation(state)) as State;
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
