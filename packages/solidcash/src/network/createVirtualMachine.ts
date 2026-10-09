import { isPayToScriptHash20, isPayToScriptHash32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { ripemd160, secp256k1, sha1, sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
import { createVirtualMachineBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-vm.js';
import { conditionallyEvaluate, incrementOperationCount, pushToStack, pushToStackChecked, pushToStackVmNumber, useFourStackItems, useOneStackItem, useOneVmNumber, useThreeStackItems, useTwoStackItems } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/combinators.js';
import { applyError, AuthenticationErrorCommon } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/errors.js';
import { useTransactionInput, useTransactionOutput, useTransactionUtxo } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/inspection.js';
import { authenticationInstructionsAreMalformed, decodeAuthenticationInstructions, disassembleAuthenticationInstructionMalformed, encodeAuthenticationInstructions, isWitnessProgram, stackItemIsTruthy } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { createVirtualMachine } from '@bitauth/libauth/build/lib/vm/virtual-machine.js';
;
;
;
import { AuthenticationErrorBch2025 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2025/bch-2025-errors.js';
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
// A bounded invocation path, filled only while the split-failure probe is enabled. The path is what names the
// emitter that built the offending body: each entry is the depth the body runs at and the key it was invoked by.
const invokeTrace: string[] = [];
let invokeTraceEnabled = false;
// The last few `OP_PICK`s, so a mis-indexed slot read names the depth it used and the item it fetched.
const pickTrace: string[] = [];
// Steps taken while a witness block is live, so a stack the check leaves one item off names the step that did it.
const stepTrace: string[] = [];
let countLayoutDumped = false;

/** The host-step probe, which records every step of a run that fails. */
function stepProbeEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_SPLIT_FAILURE !== undefined;
}

/** The steps the step probe recorded, oldest first. */
export function stepProbeTrace(): readonly string[] {
  return stepTrace;
}

/**
 * Wraps every operation in an instruction set with the step recorder.
 *
 * The recorder only observes: each wrapped operation is called unchanged, and the ring is what a failure reads.
 */
function installStepTrace(instructionSet: ReturnType<typeof createInstructionSetBch2026>): void {
  type StepState = Parameters<(typeof instructionSet.operations)[number]>[0];
  for (let opcode = 0; opcode < 256; opcode += 1) {
    const operation = instructionSet.operations[opcode]!;
    instructionSet.operations[opcode] = ((state: StepState) => {
      // Only while a witness block is live: the walk that reads one is what a stack left one item off is read from,
      // and recording every step of every run costs more than it tells.
      if (state.stack.some((item) => item.length >= 4000)) {
        stepTrace.push(`${state.instructions.length}@${state.ip}:${opcode}`
          + ` d=${state.controlStack.length} len=${state.stack.length}`
          + ` top=${state.stack.slice(-5).map((entry) => `${entry.length}:${binToHex(entry.slice(0, 4))}`).join('/')}`);
        if (stepTrace.length > 6000) stepTrace.splice(0, stepTrace.length - 6000);
      }
      return (operation as (inner: StepState) => StepState)(state);
    }) as typeof operation;
  }
}
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
): NonNullable<typeof instructionSet.evaluate> {
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  // The phased runner is shared with the bounded declaration reader: it runs the same unlocking, locking and
  // P2SH redeem phases, so a reader that only needs the stop state can step them without retaining a full trace.
  const runPhases: NonNullable<typeof instructionSet.evaluate> = (
    program, { stateEvaluate, stateInitialize, stateOverride },
  ) => {
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
  instructionSet.evaluate = runPhases;
  return runPhases;
}

/** Two lowercase hex digits per byte value, as libauth's `binToHex` writes them. */
const BYTE_HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'));

/** A function table key: `binToHex` of the identifier, without its framed allocations for the usual 1-2 bytes. */
function functionTableKeyOf(identifier: Uint8Array): string {
  if (identifier.length === 1) return BYTE_HEX[identifier[0]!]!;
  if (identifier.length === 2) return BYTE_HEX[identifier[0]!]! + BYTE_HEX[identifier[1]!]!;
  return binToHex(identifier);
}

/** Cache immutable OP_DEFINE bodies instead of decoding and copying their pushes at every OP_INVOKE. */
function installCachedInvokeEvaluator(
  instructionSet: ReturnType<typeof createInstructionSetBch2026>,
): void {
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  const decodedFunctions = new WeakMap<Uint8Array, DecodedInstructions>();
  const decodedFunctionKeys = new WeakMap<DecodedInstructions, string>();
  const returnProbes = new WeakMap<object, { functionTableKey: string; frameDepth: number }>();
  // The invoke probes are read once per VM: an environment read is a native lookup, and these sit on every invoke.
  const debugEnv = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
  const debugInvokeId = debugEnv?.SOLIDC_DEBUG_INVOKE_ID;
  const debugInvokeCallerId = debugEnv?.SOLIDC_DEBUG_INVOKE_CALLER_ID;
  const debugInvokeReturnId = debugEnv?.SOLIDC_DEBUG_INVOKE_RETURN_ID;
  const debugEqualVerifyInput = debugEnv?.SOLIDC_DEBUG_EQUALVERIFY_INPUT;
  invokeTraceEnabled = debugEnv?.SOLIDC_DEBUG_SPLIT_FAILURE !== undefined;
  const logInvokeReturn = (details: unknown): void => { console.error('invoke-return', JSON.stringify(details)); };
  instructionSet.operations[OpcodesBch2026.OP_INVOKE] = conditionallyEvaluate((state: State) => {
    const functionIdentifier = state.stack.pop();
    if (functionIdentifier === undefined) {
      return applyError(state, AuthenticationErrorCommon.emptyStack);
    }
    const functionTableKey = functionTableKeyOf(functionIdentifier);
    if (invokeTraceEnabled) {
      invokeTrace.push(`${state.controlStack.length + 1}:${functionTableKey}`);
      if (invokeTrace.length > 512) invokeTrace.splice(0, invokeTrace.length - 512);
    }
    const functionBody = state.functionTable[functionTableKey];
    if (functionBody === undefined) {
      return applyError(
        state,
        AuthenticationErrorBch2026.functionIdentifierUndefined,
        `Function identifier: 0x${functionTableKey}.`,
      );
    }
    if (debugInvokeId !== undefined || debugInvokeCallerId !== undefined) {
      const callerFunctionTableKey = decodedFunctionKeys.get(state.instructions);
      if ((debugInvokeId !== undefined && debugInvokeId === functionTableKey)
        || (debugInvokeCallerId !== undefined && debugInvokeCallerId === callerFunctionTableKey)) {
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
    if (debugInvokeReturnId === functionTableKey) {
      returnProbes.set(state as object, { functionTableKey, frameDepth: state.controlStack.length });
    }
    state.ip = -1;
    state.instructions = instructions;
    return state;
  });
  // Only a configured return probe can register one, so without it no opcode needs the per-step lookup.
  if (debugInvokeReturnId === undefined) return;
  for (let opcode = 0; opcode < 256; opcode += 1) {
    const operation = instructionSet.operations[opcode];
    // Unknown opcodes are dispatched through instructionSet.undefined. Leave those slots empty so a diagnostic
    // observer still receives libauth's consensus error instead of a TypeError from this return probe.
    if (operation === undefined) continue;
    instructionSet.operations[opcode] = ((state: State) => {
      const probe = returnProbes.get(state as object);
      if (probe !== undefined && state.controlStack.length < probe.frameDepth) {
        const inputIndex = (state as unknown as { program?: { inputIndex?: number } }).program?.inputIndex;
        if (debugEqualVerifyInput === undefined || inputIndex === Number(debugEqualVerifyInput)) {
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

/**
 * OP_ACTIVEBYTECODE as libauth builds it (`incrementOperationCount(conditionallyEvaluate(...))`), but encoding the
 * active instructions once per instruction array and code-separator offset instead of on every execution. The cached
 * evaluators above decode each program and OP_DEFINE body once, and nothing rewrites an instruction array in place.
 * The cached encoding itself is pushed, not a copy of it (22-140 KB per execution for an outlined contract): no
 * operation writes a stack item in place, which libauth's own pushes already rely on, since they push the data of the
 * cached redeem script's instructions to every run (see `installZeroCopyStackOperations`).
 */
function installCachedActiveBytecode(
  instructionSet: ReturnType<typeof createInstructionSetBch2026>,
  maximumStackItemLength: number | undefined,
): void {
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  const encodings = new WeakMap<object, Map<number, Uint8Array>>();
  const activeBytecode = (state: State): State => {
    let byOffset = encodings.get(state.instructions);
    if (byOffset === undefined) {
      byOffset = new Map();
      encodings.set(state.instructions, byOffset);
    }
    let bytecode = byOffset.get(state.lastCodeSeparator);
    if (bytecode === undefined) {
      bytecode = encodeAuthenticationInstructions(state.instructions.slice(state.lastCodeSeparator + 1));
      byOffset.set(state.lastCodeSeparator, bytecode);
    }
    return pushToStackChecked(state, bytecode, { maximumStackItemLength });
  };
  instructionSet.operations[OpcodesBch2026.OP_ACTIVEBYTECODE] = incrementOperationCount(
    conditionallyEvaluate(activeBytecode),
  ) as (typeof instructionSet.operations)[number];
}

/**
 * OP_INPUTBYTECODE as libauth builds it (`incrementOperationCount(conditionallyEvaluate(...))`, the same length check
 * and pushed-byte accounting), pushing the input's unlocking bytecode instead of a copy of it. A P2SH input's unlocking
 * bytecode carries its whole redeem script, so the copy was the operation. The VM treats transaction bytecode as
 * immutable (the P2SH evaluator above decodes the unlocking bytecode into views of it), the token commitment
 * operations below push transaction bytes the same way, and no operation writes a stack item in place.
 */
function installZeroCopyInputBytecode(
  instructionSet: ReturnType<typeof createInstructionSetBch2026>,
  maximumStackItemLength: number | undefined,
): void {
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  instructionSet.operations[OpcodesBch2026.OP_INPUTBYTECODE] = incrementOperationCount(conditionallyEvaluate(
    (state: State) => useTransactionInput(state, (next, [input]) =>
      pushToStackChecked(next, input!.unlockingBytecode, { maximumStackItemLength })),
  )) as (typeof instructionSet.operations)[number];
}

/**
 * libauth's BCH-2026 check after every operation: the BCH-2025 checks (operation cost, hashing, stack depth, control
 * stack depth, signature checks), then the memory-slot check, in that order and with libauth's messages. libauth runs
 * it as two nested closures that read each limit off the consensus object and pass the costs through an options
 * object on every operation; here the limits are read once, and an operation within all of them returns at once. One
 * over a limit takes the cold path, which repeats libauth's checks one by one so the first failing check names the
 * error. The fast path computes the same `operationCost`, in the same order, before any check reads it.
 */
function installOperationLimitCheck(
  instructionSet: ReturnType<typeof createInstructionSetBch2026>,
  consensus: typeof ConsensusBch2026,
  standard: boolean,
): void {
  type State = Parameters<NonNullable<typeof instructionSet.every>>[0];
  const { baseInstructionCost, signatureCheckCost, maximumStackDepth, maximumControlStackDepth } = consensus;
  const hashDigestIterationCost = standard
    ? consensus.hashDigestIterationCostStandard
    : consensus.hashDigestIterationCostConsensus;
  const { maximumMemorySlots } = consensus;
  // libauth falls back to its own default for a cost the consensus leaves unset; keep its check then.
  const limits = [baseInstructionCost, signatureCheckCost, hashDigestIterationCost, maximumStackDepth,
    maximumControlStackDepth, maximumMemorySlots];
  if (!limits.every((limit) => typeof limit === 'number')) return;
  const exceeded2025 = (state: State): State => {
    const { metrics } = state;
    if (metrics.operationCost > metrics.maximumOperationCost) {
      return applyError(state, AuthenticationErrorBch2025.excessiveOperationCost,
        `Maximum operation cost: ${metrics.maximumOperationCost}`
        + ` (density control length: ${metrics.densityControlLength});`
        + ` operation cost following operation: ${metrics.operationCost}.`);
    }
    if (metrics.hashDigestIterations > metrics.maximumHashDigestIterations) {
      return applyError(state, AuthenticationErrorBch2025.excessiveHashing,
        `Maximum hash digest iterations: ${metrics.maximumHashDigestIterations}`
        + ` (density control length: ${metrics.densityControlLength});`
        + ` hash digest iterations following operation: ${metrics.hashDigestIterations}.`);
    }
    if (state.stack.length + state.alternateStack.length > maximumStackDepth) {
      return applyError(state, AuthenticationErrorBch2025.exceededMaximumStackDepth,
        `Maximum stack depth: ${maximumStackDepth} items.`);
    }
    if (state.controlStack.length > maximumControlStackDepth) {
      return applyError(state, AuthenticationErrorBch2025.exceededMaximumControlStackDepth,
        `Maximum control stack depth: ${maximumControlStackDepth}.`);
    }
    if (standard && metrics.signatureCheckCount > metrics.maximumSignatureCheckCount) {
      return applyError(state, AuthenticationErrorBch2025.exceededMaximumSignatureCheckCount,
        `Maximum signature check count: ${metrics.maximumSignatureCheckCount};`
        + ` signature check count following operation: ${metrics.signatureCheckCount}.`);
    }
    return state;
  };
  const exceeded = (state: State): State => {
    const next = exceeded2025(state);
    return next.stack.length + next.alternateStack.length + next.functionCount > maximumMemorySlots
      ? applyError(next, AuthenticationErrorBch2026.exceededMaximumMemorySlots,
        `Maximum memory slots: ${maximumMemorySlots}.`)
      : next;
  };
  instructionSet.every = (state: State): State => {
    const { metrics } = state;
    const operationCost = metrics.evaluatedInstructionCount * baseInstructionCost
      + metrics.signatureCheckCount * signatureCheckCost
      + metrics.hashDigestIterations * hashDigestIterationCost
      + metrics.arithmeticCost
      + metrics.stackPushedBytes;
    metrics.operationCost = operationCost;
    const depth = state.stack.length + state.alternateStack.length;
    return operationCost > metrics.maximumOperationCost
      || metrics.hashDigestIterations > metrics.maximumHashDigestIterations
      || depth > maximumStackDepth
      || state.controlStack.length > maximumControlStackDepth
      || (standard && metrics.signatureCheckCount > metrics.maximumSignatureCheckCount)
      || depth + state.functionCount > maximumMemorySlots
      ? exceeded(state)
      : state;
  };
}

/** The two operands a failed OP_EQUALVERIFY compared, and the instruction it stood at. */
interface FailedClose {
  readonly instructions: unknown;
  readonly ip: number;
  readonly declared: Uint8Array;
  readonly computed: Uint8Array;
}

/**
 * OP_EQUALVERIFY as installed, noting the operands of one that fails. A body's close compares the value it computed
 * (below) with a declaration (on top), and libauth pops both on the failure, so the state a run stops with no longer
 * holds them; `SOLIDC_DEBUG_EQUALVERIFY_FAIL` logs them from the same place. With both operands present the only
 * failure is the verify itself, and a failure ends the run, so a note left by an evaluation whose stop state stands
 * one instruction past it, in the same instructions, is that run's stop.
 */
function installFailedCloseRecorder(
  instructionSet: ReturnType<typeof createInstructionSetBch2026>,
): { last: FailedClose | undefined } {
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  const recorder: { last: FailedClose | undefined } = { last: undefined };
  const equalVerify = instructionSet.operations[OpcodesBch2026.OP_EQUALVERIFY]!;
  instructionSet.operations[OpcodesBch2026.OP_EQUALVERIFY] = ((state: State): State => {
    const { stack, instructions, ip } = state;
    const declared = stack[stack.length - 1];
    const computed = stack[stack.length - 2];
    const next = (equalVerify as (inner: State) => State)(state);
    if (next.error !== undefined && declared !== undefined && computed !== undefined) {
      recorder.last = { instructions, ip, declared, computed };
    }
    return next;
  }) as typeof equalVerify;
  return recorder;
}

/** What `copyOfPlainData` returns for a value it has no faithful copy of. */
const NOT_PLAIN_DATA = Symbol('not plain data');

/**
 * A deep copy of a program's plain data (plain objects, arrays, byte arrays and primitives), byte for byte, so a later
 * write to the caller's own arrays cannot reach it. Anything else (a class instance, a function, an unexpected depth)
 * has no faithful copy here and yields `NOT_PLAIN_DATA`.
 */
function copyOfPlainData(value: unknown, depth = 0): unknown {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (typeof value === 'function' || typeof value === 'symbol') return NOT_PLAIN_DATA;
  if (typeof value !== 'object' || value === null) return value;
  if (depth > 12) return NOT_PLAIN_DATA;
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    for (const item of value) {
      const itemCopy = copyOfPlainData(item, depth + 1);
      if (itemCopy === NOT_PLAIN_DATA) return NOT_PLAIN_DATA;
      copy.push(itemCopy);
    }
    return copy;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) return NOT_PLAIN_DATA;
  const copy: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    const fieldCopy = copyOfPlainData(field, depth + 1);
    if (fieldCopy === NOT_PLAIN_DATA) return NOT_PLAIN_DATA;
    copy[key] = fieldCopy;
  }
  return copy;
}

/** True when `value` holds the same plain data as `copy`, a `copyOfPlainData` result. */
function samePlainData(copy: unknown, value: unknown): boolean {
  if (copy instanceof Uint8Array) {
    if (!(value instanceof Uint8Array) || value.length !== copy.length) return false;
    for (let index = 0; index < copy.length; index += 1) {
      if (copy[index] !== value[index]) return false;
    }
    return true;
  }
  if (typeof copy !== 'object' || copy === null) return copy === value;
  if (typeof value !== 'object' || value === null || value instanceof Uint8Array) return false;
  if (Array.isArray(copy)) {
    if (!Array.isArray(value) || value.length !== copy.length) return false;
    return copy.every((item, index) => samePlainData(item, (value as unknown[])[index]));
  }
  if (Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Object.keys(copy);
  if (Object.keys(value).length !== keys.length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)
    && samePlainData((copy as Record<string, unknown>)[key], (value as Record<string, unknown>)[key]));
}

/**
 * libauth's stack operations without their defensive copies: the duplicating operations push the item they
 * duplicate, and OP_SPLIT pushes two views of its operand. No operation writes a stack item in place (each builds
 * its result in a fresh array) and a state clone copies the stack shallowly, so an aliased or viewed item is never
 * seen to change. Wrapping, errors and pushed-byte accounting are libauth's, item for item.
 */
function installZeroCopyStackOperations(instructionSet: ReturnType<typeof createInstructionSetBch2026>): void {
  type State = Parameters<(typeof instructionSet.operations)[number]>[0];
  const set = (opcode: number, operation: (state: State) => State): void => {
    instructionSet.operations[opcode] = incrementOperationCount(
      conditionallyEvaluate(operation),
    ) as (typeof instructionSet.operations)[number];
  };
  set(OpcodesBch2026.OP_DUP, (state) => useOneStackItem(state, (next, [item]) =>
    pushToStack(next, [item!, item!], { pushedBytes: item!.length })));
  set(OpcodesBch2026.OP_IFDUP, (state) => useOneStackItem(state, (next, [item]) => (stackItemIsTruthy(item!)
    ? pushToStack(next, [item!, item!], { pushedBytes: item!.length })
    : pushToStack(next, [item!], { pushedBytes: 0 }))));
  set(OpcodesBch2026.OP_OVER, (state) => useTwoStackItems(state, (next, [a, b]) =>
    pushToStack(next, [a!, b!, a!], { pushedBytes: a!.length })));
  set(OpcodesBch2026.OP_2DUP, (state) => useTwoStackItems(state, (next, [a, b]) =>
    pushToStack(next, [a!, b!, a!, b!], { pushedBytes: a!.length + b!.length })));
  set(OpcodesBch2026.OP_3DUP, (state) => useThreeStackItems(state, (next, [a, b, c]) =>
    pushToStack(next, [a!, b!, c!, a!, b!, c!], { pushedBytes: a!.length + b!.length + c!.length })));
  set(OpcodesBch2026.OP_2OVER, (state) => useFourStackItems(state, (next, [a, b, c, d]) =>
    pushToStack(next, [a!, b!, c!, d!, a!, b!], { pushedBytes: a!.length + b!.length })));
  set(OpcodesBch2026.OP_TUCK, (state) => useTwoStackItems(state, (next, [a, b]) =>
    pushToStack(next, [b!, a!, b!], { pushedBytes: b!.length })));
  set(OpcodesBch2026.OP_PICK, (state) => useOneVmNumber(state, (next, [depth]) => {
    const item = next.stack[next.stack.length - 1 - Number(depth)];
    if (invokeTraceEnabled) {
      pickTrace.push(`d=${String(depth)} len=${next.stack.length}`
        + ` got=${item === undefined ? '-' : `${item.length}:${binToHex(item.slice(0, 8))}`}`);
      if (pickTrace.length > 24) pickTrace.splice(0, pickTrace.length - 24);
      if (!countLayoutDumped && item?.length === 1 && item[0] === 0x64 && Number(depth) === 3) {
        countLayoutDumped = true;
        console.error('pick-count-layout', JSON.stringify({
          depth: String(depth),
          stackLength: next.stack.length,
          values: next.stack.map((entry) => `${entry.length}:${binToHex(entry.slice(0, 10))}`),
        }));
      }
    }
    return item === undefined
      ? applyError(state, AuthenticationErrorCommon.invalidStackIndex,
        `Current stack depth: ${next.stack.length}; requested depth: ${depth}.`)
      : pushToStack(next, [item]);
  }));
  set(OpcodesBch2026.OP_SPLIT, (state) => {
    // useOneStackItem/useOneVmNumber pop this stack in place, so the operands are captured before the nested calls.
    const operandIndex = state.stack[state.stack.length - 1];
    const operandItem = state.stack[state.stack.length - 2];
    // libauth's `opSplit` reads the index as `Number([value])`, the one-item argument list, which converts through a
    // decimal string on every split. A bigint's number is the same value.
    return useOneVmNumber(state, (next, [value]) => {
      const index = Number(value);
      return useOneStackItem(next, (final, [item]) => {
        if (index < 0 || index > item!.length) {
          if (invokeTraceEnabled) {
            const describe = (bytes: Uint8Array | undefined): string => (bytes === undefined
              ? '-' : `${bytes.length}:${binToHex(bytes.slice(0, 96))}`);
            const program = (state as unknown as {
              program?: {
                inputIndex?: number;
                transaction?: { inputs?: Array<{ unlockingBytecode?: Uint8Array }> };
              };
            }).program;
            const unlocking = program?.transaction?.inputs?.[program.inputIndex ?? 0]?.unlockingBytecode;
            console.error('split-failure', JSON.stringify({
              ip: state.ip,
              of: state.instructions.length,
              depth: state.controlStack.length,
              lastCodeSeparator: state.lastCodeSeparator,
              functionCount: state.functionCount,
              opcodes: state.instructions.map((instruction) => instruction.opcode).join(','),
              index: describe(operandIndex),
              item: describe(operandItem),
              inputIndex: program?.inputIndex,
              inputCount: program?.transaction?.inputs?.length,
              unlockingLength: unlocking?.length,
              unlockingHead: unlocking === undefined ? '-' : binToHex(unlocking.slice(0, 80)),
              stackLength: state.stack.length,
              stackLengths: state.stack.map((entry) => entry.length),
              stackValues: state.stack.map((entry) => binToHex(entry.slice(0, 12))),
              frames: state.controlStack.flatMap((frame) => {
                if (typeof frame !== 'object' || frame === null) return [];
                const { instructions, ip } = frame as {
                  instructions: Array<{ opcode: number; data?: Uint8Array }>; ip: number;
                };
                const around = instructions.slice(Math.max(0, ip - 24), ip + 2)
                  .map((instruction) => (instruction.data === undefined
                    ? String(instruction.opcode)
                    : `${instruction.opcode}'${binToHex(instruction.data.slice(0, 8))}`)).join(',');
                return [`${instructions.length}@${ip}[${around}]`];
              }),
              trace: invokeTrace.slice(-80),
              picks: pickTrace.slice(),
              steps: stepTrace.slice(),
            }));
            if (operandItem !== undefined) {
              console.error(`split-item-hex ${binToHex(operandItem)}`);
            }
          }
          return applyError(final, AuthenticationErrorCommon.invalidSplitIndex,
            `stack item length: ${item!.length}; requested split index: ${index}.`);
        }
        // The two parts are the whole item, which is the pushed-byte count libauth sums from them.
        return pushToStack(final, [item!.subarray(0, index), item!.subarray(index)], { pushedBytes: item!.length });
      });
    });
  });
  // A view must not become an OP_DEFINE body: libauth's state clone deep-copies the function table, and a view
  // carries its whole underlying buffer into that copy. A defined body is stored compact instead.
  const define = instructionSet.operations[OpcodesBch2026.OP_DEFINE]!;
  instructionSet.operations[OpcodesBch2026.OP_DEFINE] = ((state: State): State => {
    const before = state.functionCount;
    // OP_DEFINE pops the identifier first, so the new entry's key is the current top item's.
    const identifier = state.stack[state.stack.length - 1];
    const next = define(state) as State;
    if (next.functionCount === before || identifier === undefined) return next;
    const key = functionTableKeyOf(identifier);
    const body = next.functionTable[key];
    if (body !== undefined && (body.byteOffset !== 0 || body.byteLength !== body.buffer.byteLength)) {
      next.functionTable[key] = body.slice();
    }
    return next;
  }) as (typeof instructionSet.operations)[number];
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
  if (limits === undefined && observer === undefined) {
    if (!stepProbeEnabled()) return createVirtualMachineBch2026(standard);
    // The step probe records this path too, building what libauth's factory would and wrapping it, so a run on a
    // machine with no custom limits is observable without changing what it computes.
    const observed = createInstructionSetBch2026(standard);
    installStepTrace(observed);
    return createVirtualMachine(observed);
  }
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
  let runPhases: NonNullable<typeof instructionSet.evaluate> | undefined;
  let closes: { last: FailedClose | undefined } | undefined;
  if (limits !== undefined && limits.maximumInputBytes > 10_000) {
    // The kernel lane's fast `every` goes first; the framed operation-limit check installed below replaces it with
    // the same libauth-equivalent check, and this one stays in effect wherever that check declines to install.
    installFastBch2026Every(instructionSet, consensus, standard);
    runPhases = installCachedP2shEvaluator(
      instructionSet, provider!, limits.maximumInputBytes, observer?.onPhaseComplete,
    );
    installCachedInvokeEvaluator(instructionSet);
    installCachedActiveBytecode(instructionSet, consensus.maximumStackItemLength);
    installZeroCopyInputBytecode(instructionSet, consensus.maximumStackItemLength);
    installZeroCopyStackOperations(instructionSet);
    installOperationLimitCheck(instructionSet, consensus, standard);
    closes = installFailedCloseRecorder(instructionSet);

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
  // A step trace, installed only for the split probe and last of all so no other override sits outside it: every
  // step taken while a witness block is live is recorded with the stack's size and its top lengths, so a walk that
  // leaves the stack one item off names the step that did it rather than only the operation that later failed.
  if (stepProbeEnabled()) installStepTrace(instructionSet);
  const machine = createVirtualMachine(instructionSet);
  if (runPhases !== undefined) {
    // The same phases as `evaluate`, stepped in place as `evaluate` steps them, returning each phase's stop state
    // and the step before it. That step carries only what a stop is read from: its position, and its stack when it
    // is an OP_EQUALVERIFY; its other fields are the stop state's. `stateStep` clones the whole state, OP_DEFINE
    // table included, at every instruction, which made this reader most of a hop's derivation time.
    type MachineState = Parameters<typeof machine.stateStep>[0];
    const boundedDebug = (program: Parameters<typeof machine.evaluate>[0]): readonly MachineState[] => {
      const states: MachineState[] = [];
      const collect = (initial: MachineState): MachineState => {
        let current = machine.stateClone(initial);
        let stepped = false;
        let ip = current.ip;
        let instructions = current.instructions;
        // Only the last step's stack is kept, so an OP_EQUALVERIFY step notes its depth and the two items it may
        // consume instead of copying the stack: the stack before it is the stack after it plus what it popped.
        let closeDepth = -1;
        let closeOperands: MachineState['stack'] = [];
        while (machine.stateContinue(current)) {
          ({ ip, instructions } = current);
          if (instructions[ip]?.opcode === OpcodesBch2026.OP_EQUALVERIFY) {
            closeDepth = current.stack.length;
            closeOperands = current.stack.slice(-2);
          } else closeDepth = -1;
          current = machine.stateStepMutate(current);
          stepped = true;
        }
        const stack = closeDepth < 0 ? current.stack
          : current.stack.concat(closeOperands.slice(closeOperands.length - (closeDepth - current.stack.length)));
        const previous = stepped
          ? { ...current, error: undefined, ip, instructions, stack } as MachineState
          : initial;
        states.push(previous, current);
        return current;
      };
      runPhases(program, {
        stateEvaluate: collect, stateInitialize: machine.stateInitialize, stateOverride: undefined,
      } as never);
      return states;
    };
    (machine as { boundedDebug?: typeof boundedDebug }).boundedDebug = boundedDebug;
  }
  if (runPhases !== undefined && closes !== undefined) {
    // A derivation evaluates a program and then reads the close its run stopped at, which `boundedDebug` gets by
    // running the same program again. An evaluation that stops on a failed close keeps what that reading needs
    // instead: a copy of the program it ran and the close's two operands. `recordedClose` hands them back for a
    // program with the same content, which the machine runs to the same stop; any other program reads nothing.
    const recorder = closes;
    type Program = Parameters<typeof machine.evaluate>[0];
    let recorded: { readonly program: unknown; readonly declared: Uint8Array; readonly computed: Uint8Array }
    | undefined;
    const evaluate = machine.evaluate;
    machine.evaluate = (program, options) => {
      recorder.last = undefined;
      const state = evaluate(program, options);
      const close = recorder.last as FailedClose | undefined;
      recorder.last = undefined;
      const stop = state as unknown as { readonly error?: unknown; readonly instructions: unknown; readonly ip: number };
      if (close !== undefined && options?.stateOverride === undefined && stop.error !== undefined
        && stop.instructions === close.instructions && stop.ip === close.ip + 1) {
        const copy = copyOfPlainData(program);
        recorded = copy === NOT_PLAIN_DATA ? undefined : {
          program: copy, declared: Uint8Array.from(close.declared), computed: Uint8Array.from(close.computed),
        };
      } else if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RECORDED_CLOSE === '1') {
        // Why a run's close was not kept: the reading that follows it must trace the program again instead.
        console.error('recorded-close-declined', JSON.stringify({
          close: close === undefined ? 'none' : 'kept',
          stateOverride: options?.stateOverride !== undefined,
          error: stop.error === undefined ? 'none' : String(stop.error).slice(0, 80),
          instructionsMatch: close === undefined ? null : stop.instructions === close.instructions,
          ip: stop.ip,
          closeIp: close === undefined ? null : close.ip,
        }));
      }
      return state;
    };
    const recordedClose = (program: Program): { declared: Uint8Array; computed: Uint8Array } | undefined =>
      (recorded !== undefined && samePlainData(recorded.program, program)
        ? { declared: Uint8Array.from(recorded.declared), computed: Uint8Array.from(recorded.computed) }
        : undefined);
    (machine as { recordedClose?: typeof recordedClose }).recordedClose = recordedClose;
  }
  return machine;
}
