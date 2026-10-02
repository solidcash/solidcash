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
const observerlessVmByProvider = new WeakMap<
NetworkProvider, Map<string, ReturnType<typeof createVirtualMachineBch2026>>
>();

function observerlessVmCacheKey(provider: NetworkProvider, standard: boolean): string {
  return `${standard ? '1' : '0'}:${JSON.stringify(provider.consensusLimits ?? null)}`;
}

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
  const decoded = decodeAuthenticationInstructions(redeemBytecode);
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
  onPhaseComplete?: (state: unknown) => void,
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
    // A faithful trace records each evaluation phase's exit state: `debug()` appends the state every phase ends
    // with, and the observed operations alone cannot express a phase boundary.
    onPhaseComplete?.(unlockingResult);
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
    onPhaseComplete?.(lockingResult);
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
    // Exclude the authenticated redeem script before deep-cloning the argument stack. Cloning it only to pop it
    // immediately is particularly expensive for generated contracts, while cloning the evaluated arguments keeps
    // libauth's isolation semantics for the P2SH execution.
    const unlockingStack = [...unlockingResult.stack];
    const p2shScript = unlockingStack.pop() ?? Uint8Array.of();
    const p2shStack = structuredClone(unlockingStack);
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
    onPhaseComplete?.(p2shResult);
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
  const decodedFunctionKeys = new WeakMap<DecodedInstructions, string>();
  const returnProbes = new WeakMap<object, { functionTableKey: string; frameDepth: number }>();
  const invokeReturnDebugEnv = (): Record<string, string> | undefined =>
    (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
  const logInvokeReturn = (details: unknown): void => { console.error('invoke-return', JSON.stringify(details)); };
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
    const invokeDebugEnv = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
    const callerFunctionTableKey = decodedFunctionKeys.get(state.instructions);
    if ((invokeDebugEnv?.SOLIDC_DEBUG_INVOKE_ID !== undefined
      && invokeDebugEnv.SOLIDC_DEBUG_INVOKE_ID === functionTableKey)
      || (invokeDebugEnv?.SOLIDC_DEBUG_INVOKE_CALLER_ID !== undefined
        && invokeDebugEnv.SOLIDC_DEBUG_INVOKE_CALLER_ID === callerFunctionTableKey)) {
      const inputIndex = (state as unknown as { program?: { inputIndex?: number } }).program?.inputIndex;
      const hexOf = (bytes: Uint8Array): string => binToHex(bytes.slice(0, 160));
      console.error('invoke-boundary', JSON.stringify({
        inputIndex,
        functionTableKey,
        callerFunctionTableKey,
        stackLength: state.stack.length,
        tail: state.stack.slice(-24).map((item) => `${item.length}:${hexOf(item)}`),
      }));
    }
    let instructions = decodedFunctions.get(functionBody);
    if (instructions === undefined) {
      instructions = decodeAuthenticationInstructionViews(functionBody);
      decodedFunctions.set(functionBody, instructions);
      decodedFunctionKeys.set(instructions, functionTableKey);
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
    if (invokeDebugEnv?.SOLIDC_DEBUG_INVOKE_RETURN_ID === functionTableKey) {
      returnProbes.set(state as object, { functionTableKey, frameDepth: state.controlStack.length });
    }
    state.ip = -1;
    state.instructions = instructions;
    return state;
  });
  for (let opcode = 0; opcode < 256; opcode += 1) {
    const operation = instructionSet.operations[opcode];
    // Unknown opcodes are dispatched through instructionSet.undefined. Leave those slots empty so a diagnostic
    // observer still receives libauth's consensus error instead of a TypeError from this return probe.
    if (operation === undefined) continue;
    instructionSet.operations[opcode] = ((state: State) => {
      const probe = returnProbes.get(state as object);
      if (probe !== undefined && state.controlStack.length < probe.frameDepth) {
        const env = invokeReturnDebugEnv();
        const inputIndex = (state as unknown as { program?: { inputIndex?: number } }).program?.inputIndex;
        if (env?.SOLIDC_DEBUG_EQUALVERIFY_INPUT === undefined
          || inputIndex === Number(env.SOLIDC_DEBUG_EQUALVERIFY_INPUT)) {
          logInvokeReturn({
            inputIndex,
            functionTableKey: probe.functionTableKey,
            opcode,
            stackLength: state.stack.length,
            tail: state.stack.slice(-32).map((item) => `${item.length}:${binToHex(item.slice(0, 160))}`),
          });
        }
        returnProbes.delete(state as object);
      }
      return (operation as (inner: State) => State)(state);
    }) as typeof operation;
  }
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
type ProviderVmObserver = {
  opcodes: ReadonlySet<number>;
  beforeOperation: (state: unknown) => void;
  /** Probe-only operation wrapper. Consensus callers must omit this; their operation remains byte-for-byte stock. */
  operation?: (
    opcode: number, state: unknown, operation: (state: never) => unknown,
  ) => unknown;
  /**
   * Record inactive conditional branches instead of jumping over them.
   *
   * The sparse probe deliberately skips them: it keeps only the six inspected opcodes, so an inactive branch
   * cannot contribute an observation, and skipping keeps its instruction cost in the metrics. A faithful trace
   * must not skip: `extractCommitmentMapFromTrace` reads adjacency, and `debug()` steps through every inactive
   * instruction, so a jumped-over region would silently change which introspections pair with which equality.
   */
  recordInactiveBranches?: boolean;
  /**
   * Called with the state each top-level evaluation phase (unlocking, locking, redeem) ends with.
   *
   * `debug()` appends that state to its trace; an operation observer alone cannot see it, so a faithful trace
   * built from observations needs this to reproduce the reference sequence exactly.
   */
  onPhaseComplete?: (state: unknown) => void;
};

/** Keep libauth's boundary checks and errors while avoiding layered callbacks on in-budget instructions. */
export function installFastBch2026Every(
  instructionSet: ReturnType<typeof createInstructionSetBch2026>,
  consensus: typeof ConsensusBch2026,
  standard: boolean,
): void {
  const originalEvery = instructionSet.every;
  if (originalEvery === undefined) return;
  const hashIterationCost = standard
    ? consensus.hashDigestIterationCostStandard : consensus.hashDigestIterationCostConsensus;
  instructionSet.every = (state) => {
    const { metrics } = state;
    metrics.operationCost = metrics.evaluatedInstructionCount * consensus.baseInstructionCost
      + metrics.signatureCheckCount * consensus.signatureCheckCost
      + metrics.hashDigestIterations * hashIterationCost
      + metrics.arithmeticCost + metrics.stackPushedBytes;
    const stackSlots = state.stack.length + state.alternateStack.length;
    if (metrics.operationCost > metrics.maximumOperationCost
      || metrics.hashDigestIterations > metrics.maximumHashDigestIterations
      || stackSlots > consensus.maximumStackDepth
      || state.controlStack.length > consensus.maximumControlStackDepth
      || (standard && metrics.signatureCheckCount > metrics.maximumSignatureCheckCount)
      || stackSlots + state.functionCount > consensus.maximumMemorySlots) {
      return originalEvery(state);
    }
    return state;
  };
}

/** Every opcode of the BCH-2026 instruction set: the faithful tracer observes the whole execution, not a subset. */
const ALL_OPCODES: ReadonlySet<number> = new Set(Array.from({ length: 256 }, (_unused, opcode) => opcode));

/**
 * Build a VM that records a faithful, `debug()`-equivalent trace without deep-cloning each program state.
 *
 * libauth's `debug()` runs `partiallyCloneProgramState` before every operation, which `structuredClone`s every
 * state key outside `instructions`/`program` and the four shallow-cloned arrays. On BCH-2026 the state also
 * carries `functionTable` - the whole OP_DEFINE'd body table, tens of kilobytes for an outlined contract - so
 * each step pays a deep copy of the entire program: a 6,132-state probe measured 2.4 s, of which the state
 * copies are ~99%. Sharing the table here is observationally equivalent: identifiers can never be redefined
 * (a repeated identifier is a VM error), so the table only grows, and no trace consumer reads it from a
 * historical state.
 */
export function createFaithfulTraceVmForProvider(
  provider: NetworkProvider,
  beforeOperation: (state: unknown) => void,
  onPhaseComplete?: (state: unknown) => void,
): ReturnType<typeof createVirtualMachineBch2026> {
  return buildVirtualMachineBch2026ForProvider(provider, {
    opcodes: ALL_OPCODES,
    beforeOperation,
    recordInactiveBranches: true,
    onPhaseComplete,
  }, true);
}


export function createVirtualMachineBch2026ForProvider(
  provider?: NetworkProvider,
  observer?: ProviderVmObserver,
  options?: { standard?: boolean },
): ReturnType<typeof createVirtualMachineBch2026> {
  const standard = options?.standard ?? true;
  if (observer === undefined && provider !== undefined) {
    const key = observerlessVmCacheKey(provider, standard);
    let byKey = observerlessVmByProvider.get(provider);
    if (byKey === undefined) {
      byKey = new Map();
      observerlessVmByProvider.set(provider, byKey);
    }
    const cached = byKey.get(key);
    if (cached !== undefined) return cached;
    const built = buildVirtualMachineBch2026ForProvider(provider, undefined, standard);
    byKey.set(key, built);
    return built;
  }
  return buildVirtualMachineBch2026ForProvider(provider, observer, standard);
}

function buildVirtualMachineBch2026ForProvider(
  provider: NetworkProvider | undefined,
  observer: ProviderVmObserver | undefined,
  standard: boolean,
): ReturnType<typeof createVirtualMachineBch2026> {
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
  if (limits !== undefined && limits.maximumInputBytes > 10_000) {
    installFastBch2026Every(instructionSet, consensus, standard);
    installCachedP2shEvaluator(
      instructionSet, provider!, limits.maximumInputBytes, observer?.onPhaseComplete,
    );
    installCachedInvokeEvaluator(instructionSet);

    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RUNTIME_ASSIGN === '1') {
      type AssignState = Parameters<(typeof instructionSet.operations)[number]>[0];
      const dropOpcode = OpcodesBch2026.OP_DROP;
      const originalDrop = instructionSet.operations[dropOpcode]!;
      instructionSet.operations[dropOpcode] = ((state: AssignState) => {
        const top = state.stack.at(-1);
        const marker = top === undefined ? '' : new TextDecoder().decode(top);
        const inputIndex = (state as unknown as { program?: { inputIndex?: number } }).program?.inputIndex;
        if ((marker.startsWith('cj-') || marker.startsWith('vc-pin:')) && inputIndex === 518) {
          console.error('runtime-assign', JSON.stringify({
            marker,
            inputIndex,
            stackLength: state.stack.length,
            stack: state.stack.map((item) => `${item.length}:${binToHex(item.slice(0, 120))}`),
          }));
        }
        return (originalDrop as (inner: AssignState) => AssignState)(state);
      }) as typeof originalDrop;
    }

    // Diagnostic: log the value-chunk domain preimage the covenant hashes (its last 64 hex characters are the stored
    // value's root), so a probe's staged value can be compared against the covenant's own expectation.
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_VALUE_ROOT === '1') {
    type DomainState = Parameters<(typeof instructionSet.operations)[number]>[0];
    const hash256Opcode = (OpcodesBch2026 as unknown as { OP_HASH256?: number }).OP_HASH256 ?? 0xaa;
    const originalHash = instructionSet.operations[hash256Opcode];
    const tag = [118, 97, 108, 117, 101, 45, 99, 104, 117, 110, 107];
    const containsTag = (bytes: Uint8Array): boolean => {
      for (let start = 0; start + tag.length <= bytes.length; start += 1) {
        let match = true;
        for (let offset = 0; offset < tag.length; offset += 1) {
          if (bytes[start + offset] !== tag[offset]) { match = false; break; }
        }
        if (match) return true;
      }
      return false;
    };
    instructionSet.operations[hash256Opcode] = ((state: DomainState) => {
      const top = (state as unknown as { stack?: Uint8Array[] }).stack?.at(-1);
      // The domain preimage is exactly the 11-byte tag followed by 20 + 32 + 32 bytes.
      if (top !== undefined && top.length === 95 && containsTag(top)) {
        const hex = Array.from(top).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        console.error('value-domain', JSON.stringify({ length: top.length, preimage: hex.slice(0, 240) }));
      }
      return (originalHash as (inner: DomainState) => unknown)(state);
    }) as typeof originalHash;
    }

    // Companion diagnostic: the covenant's value is the PREIMAGE of a sha256 whose digest is the value root, so log
    // every sha256 preimage of a plausible struct length; its bytes can be compared with the SDK's staged value.
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_VALUE_PREIMAGE === '1') {
    type ShaState = Parameters<(typeof instructionSet.operations)[number]>[0];
    const sha256Opcode = 0xa8;
    const originalSha = instructionSet.operations[sha256Opcode];
    instructionSet.operations[sha256Opcode] = ((state: ShaState) => {
      const top = (state as unknown as { stack?: Uint8Array[] }).stack?.at(-1);
      if (top !== undefined && top.length >= 150 && top.length <= 260) {
        const hex = Array.from(top).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        console.error('value-preimage', JSON.stringify({ length: top.length, value: hex.slice(0, 420) }));
      }
      return (originalSha as (inner: ShaState) => unknown)(state);
    }) as typeof originalSha;
    }

    // Companion diagnostic: the chunked-value tail is `len4 || sha256(value) || value[0..28]` (64 bytes). Logging it
    // exposes the covenant's own value HEAD, which can be compared member-by-member with the SDK's staged value.
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_VALUE_TAIL === '1') {
    type CatState = Parameters<(typeof instructionSet.operations)[number]>[0];
    const catOpcode = 0x7e;
    const originalCat = instructionSet.operations[catOpcode];
    instructionSet.operations[catOpcode] = ((state: CatState) => {
      const evaluated = (originalCat as (inner: CatState) => CatState)(state);
      const top = (evaluated as unknown as { stack?: Uint8Array[] }).stack?.at(-1);
      if (top !== undefined && top.length === 64) {
        const hex = Array.from(top).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        console.error('value-tail', JSON.stringify({ head: hex.slice(8, 64), length: hex.slice(0, 8) }));
      }
      return evaluated;
    }) as typeof originalCat;
    }

    // Diagnostic: report every failed `OP_EQUALVERIFY` with the operands it compared and the shape of the program
    // that ran it. A covenant's identity/commitment checks all end here, and the trace recorders can be sparse (or
    // run on a different VM instance), so this hooks the operation itself.
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EQUALVERIFY_FAIL === '1') {
    type EqState = Parameters<(typeof instructionSet.operations)[number]>[0];
    const equalVerifyOpcode = 0x88;
    const originalEqualVerify = instructionSet.operations[equalVerifyOpcode];
    const hexOf = (bytes: Uint8Array): string =>
      Array.from(bytes.slice(0, 64)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    instructionSet.operations[equalVerifyOpcode] = ((state: EqState) => {
      const stack = (state as unknown as { stack?: Uint8Array[] }).stack ?? [];
      const top = stack.at(-1);
      const second = stack.at(-2);
      const inputIndex = (state as unknown as { program?: { inputIndex?: number } }).program?.inputIndex;
      const debugInput = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_EQUALVERIFY_INPUT;
      if ((debugInput === undefined || inputIndex === Number(debugInput))
        && top !== undefined && second !== undefined
        && (top.length !== second.length
          || top.some((byte, index) => byte !== second[index]))) {
        const instructions = (state as unknown as { instructions?: Array<{ opcode: number }> }).instructions ?? [];
        const controlStack = (state as unknown as { controlStack?: unknown[] }).controlStack ?? [];
        console.error('equalverify-fail', JSON.stringify({
          inputIndex,
          ip: (state as unknown as { ip?: number }).ip,
          instrLen: instructions.length,
          head: instructions.slice(0, 6).map((instruction) => instruction.opcode).join(','),
          stackLen: stack.length,
          frameDepth: controlStack.length,
          callers: controlStack.flatMap((frame) => (typeof frame === 'object' && frame !== null
            ? [{
              len: (frame as { instructions?: unknown[] }).instructions?.length,
              ip: (frame as { ip?: number }).ip,
              head: ((frame as { instructions?: Array<{ opcode: number }> }).instructions ?? [])
                .slice(0, 4).map((instruction) => instruction.opcode).join(','),
            }] : [])).slice(-4),
          below: stack.slice(-8, -2).map((item) => `${item.length}:${hexOf(item)}`),
          second: `${second.length}:${hexOf(second)}`,
          top: `${top.length}:${hexOf(top)}`,
        }));
      }
      return (originalEqualVerify as (inner: EqState) => unknown)(state);
    }) as typeof originalEqualVerify;
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_STACK_IP !== undefined) {
    type DebugState = Parameters<(typeof instructionSet.operations)[number]>[0];
    const equalOpcode = 0x87;
    const originalEqual = instructionSet.operations[equalOpcode];
    instructionSet.operations[equalOpcode] = ((state: DebugState) => {
      const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
      const inputIndex = (state as unknown as { program?: { inputIndex?: number } }).program?.inputIndex;
      const ip = (state as unknown as { ip?: number }).ip;
      const stack = (state as unknown as { stack?: Uint8Array[] }).stack ?? [];
      const scanIndex = stack.at(-3);
      if (ip === Number(env?.SOLIDC_DEBUG_STACK_IP)
        && (env?.SOLIDC_DEBUG_EQUALVERIFY_INPUT === undefined
          || inputIndex === Number(env.SOLIDC_DEBUG_EQUALVERIFY_INPUT))
        && scanIndex?.[0] === 0x02 && scanIndex?.[1] === 0x02) {
        const hexOf = (bytes: Uint8Array): string =>
          Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        const outputs = (state as unknown as { program?: { transaction?: { outputs?: Array<{
          lockingBytecode: Uint8Array;
          token?: { category: Uint8Array; nft?: { commitment: Uint8Array } };
        }> } } }).program?.transaction?.outputs ?? [];
        console.error('stack-at-ip', JSON.stringify({ inputIndex, ip,
          stack: stack.slice(-8).map((item) => `${item.length}:${hexOf(item)}`),
          outputs: outputs.slice(500).map((output, offset) => ({ index: offset + 500,
            lockingBytecode: hexOf(output.lockingBytecode), category: output.token && hexOf(output.token.category),
            commitment: output.token?.nft && hexOf(output.token.nft.commitment) })),
        }));
      }
      return (originalEqual as (inner: DebugState) => unknown)(state);
    }) as typeof originalEqual;
    }
    if (observer !== undefined && observer.recordInactiveBranches !== true) {
      installSparseProbeBranchSkips(instructionSet);
    }
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
