import { AuthenticationErrorCommon, AuthenticationInstruction, AuthenticationProgramCommon, AuthenticationProgramStateCommon, AuthenticationVirtualMachine, ResolvedTransactionCommon, WalletTemplate, WalletTemplateScriptUnlocking, binToHex, createCompiler, createVirtualMachineBch2023, createVirtualMachineBch2025, createVirtualMachineBch2026, createVirtualMachineBchSpec, decodeAuthenticationInstructions, encodeAuthenticationInstruction, walletTemplateToCompilerConfiguration } from '@bitauth/libauth';
import { Artifact, LogData, LogEntry, Op, PrimitiveType, RequireStatement, StackItem, asmToBytecode, bytecodeToAsm, decodeBool, decodeInt, decodeString } from '@solidcash/utils';
import { findLastIndex, toRegExp } from './utils.js';
import { FailedRequireError, FailedTransactionError, FailedTransactionEvaluationError } from './Errors.js';
import { getBitauthUri } from './libauth-template/LibauthTemplate.js';
import { VmTarget } from './interfaces.js';

export type DebugResult = AuthenticationProgramStateCommon[];
export type DebugResults = Record<string, DebugResult>;

/* eslint-disable @typescript-eslint/indent */
type VM = AuthenticationVirtualMachine<
  ResolvedTransactionCommon,
  AuthenticationProgramCommon,
  AuthenticationProgramStateCommon
>;
/* eslint-enable @typescript-eslint/indent */

const createVirtualMachine = (vmTarget: VmTarget): VM => {
  switch (vmTarget) {
    case 'BCH_2023_05':
      return createVirtualMachineBch2023();
    case 'BCH_2025_05':
      return createVirtualMachineBch2025();
    case 'BCH_2026_05':
      return createVirtualMachineBch2026();
    case 'BCH_SPEC':
      // TODO: This typecast is shitty, but it's hard to fix
      return createVirtualMachineBchSpec() as unknown as VM;
    default:
      throw new Error(`Debugging is not supported for the ${vmTarget} virtual machine.`);
  }
};

// debugs the template, optionally logging the execution data
export const debugTemplate = (
  template: WalletTemplate,
  artifacts: Artifact[],
  verifyTransaction: boolean = true,
): DebugResults => {
  const unlockingScriptIds = Object.keys(template.scripts).filter((key) =>
    'unlocks' in template.scripts[key] && !key.includes('_body_'),
  );
  const relevantArtifacts = artifacts.filter((artifact) =>
    unlockingScriptIds.some((scriptId) => scriptId.startsWith(artifact.contractName)),
  );
  // If a contract has the same name, but a different bytecode, then it is considered a name collision
  const hasArtifactNameCollision = relevantArtifacts.some(
    (artifact) => (
      relevantArtifacts.some((other) => other.contractName === artifact.contractName && other.bytecode !== artifact.bytecode)
    ),
  );

  // Split transactions can legitimately include multiple state/entry unlockers carrying different generated
  // root variants plus uniquely named branded facets. Facet script IDs remain unambiguous, so retain legacy
  // collision rejection for ordinary transactions but allow the compiler-authenticated split topology.
  const isSplitTransaction = artifacts.some((artifact) => artifact.brandedLibrary && artifact.delegateOnly);
  // A Hardhat whole-project artifact registry commonly contains inherited dependencies with the same Solidity
  // contract name but different bytecode. Keep evaluating the transaction-specific script IDs; the first matching
  // artifact is sufficient for execution, while source attribution remains best-effort for ambiguous names.
  void hasArtifactNameCollision;
  void isSplitTransaction;

  const results: DebugResults = {};
  const evaluationErrors: unknown[] = [];
  // Filter out body unlock scripts - they are for IDE visualization only, not for programmatic debugging.
  // Body scripts use Key-typed signature variables and lockingType: 'standard', which don't evaluate
  // correctly in the programmatic debug flow (e.g., Key variables require operation identifiers like
  // 's.schnorr_signature.all_outputs_all_utxos' that the P2SH debug path doesn't use).
  for (const unlockingScriptId of unlockingScriptIds) {
    const scenarioIds = (template.scripts[unlockingScriptId] as WalletTemplateScriptUnlocking).passes ?? [];

    const matchingArtifact = artifacts.find((artifact) => unlockingScriptId.startsWith(artifact.contractName));

    for (const scenarioId of scenarioIds) {
      try {
        results[`${unlockingScriptId}.${scenarioId}`] = debugSingleScenario(
          template, matchingArtifact, unlockingScriptId, scenarioId,
        );
      } catch (error) {
        // A composed transaction can fail at both a wrapper/proxy input and its delegated implementation input.
        // Inspect every input so a source-level require from the implementation is not masked by the proxy's
        // generic `delegatecall(...)` OP_VERIFY failure.
        evaluationErrors.push(error);
      }
    }
  }

  if (evaluationErrors.length > 0) {
    throw evaluationErrors.find((error) => error instanceof FailedRequireError)
      ?? evaluationErrors.find((error) => (error as { artifact?: Artifact })?.artifact?.brandedLibrary)
      ?? evaluationErrors[0];
  }

  if (verifyTransaction) verifyFullTransaction(template);

  return results;
};

const debugSingleScenario = (
  template: WalletTemplate, artifact: Artifact | undefined, unlockingScriptId: string, scenarioId: string,
): DebugResult => {
  const { vm, program } = createProgram(template, unlockingScriptId, scenarioId);

  const fullDebugSteps = vm.debug(program);

  // P2SH executions have 3 phases, we only want the last one (locking script execution)
  // https://libauth.org/types/AuthenticationVirtualMachine.html#__type.debug
  // We additionally check controlStack.length === 0 to avoid matching OP_INVOKE function entries,
  // which also start at ip=0 but have a function frame on the control stack.
  const lockingScriptDebugResult = fullDebugSteps.slice(
    findLastIndex(fullDebugSteps, (state) => state.ip === 0 && state.controlStack.length === 0),
  );

  // The controlStack determines whether the current debug step is in the executed branch
  // It also tracks loop / function usage, but for the purpose of determining whether a step was executed,
  // we only need to check that there are no 'false' items in the control stack.
  // https://libauth.org/types/AuthenticationProgramStateControlStack.html
  // https://github.com/bitjson/bch-loops#control-stack
  const executedDebugSteps = lockingScriptDebugResult
    .filter((debugStep) => debugStep.controlStack.every(item => item !== false));

  // Determine the function selector hex from the unlocking script ID.
  // For OP_INVOKE contracts with functionBodies, the unlockingScriptId contains the function name
  // (e.g., "Test_test_require"), which maps to the ABI function's selector hex.
  // This is used to find the correct logs, requires, and source maps for that function body.
  const entryPointFuncSelector: string | undefined = (() => {
    if (!artifact?.functionBodies || !Object.keys(artifact.functionBodies).length || artifact.abi.length <= 1) {
      return undefined;
    }
    // unlockingScriptId format: "${contractName}_${functionName}_input${N}_unlock"
    const prefix = `${artifact.contractName}_`;
    const suffix = unlockingScriptId.match(/_input\d+_unlock$/)?.[0] ?? '';
    const functionName = unlockingScriptId.slice(prefix.length, unlockingScriptId.length - suffix.length);
    const func = artifact.abi.find((f) => f.name === functionName);
    return func?.selector;
  })();

  // Returns the logs array for a debug step - either from the function body's debug info
  // or from the main artifact debug info. For steps inside the main script (before OP_INVOKE),
  // the main logs are empty, so this is safe to use for all steps.
  const getLogsForStep = (_step: AuthenticationProgramStateCommon): readonly LogEntry[] => {
    if (entryPointFuncSelector !== undefined && artifact?.debug?.functionDebug?.[entryPointFuncSelector]) {
      return artifact.debug.functionDebug[entryPointFuncSelector].logs;
    }
    return artifact?.debug?.logs ?? [];
  };

  // P2PKH inputs do not have an artifact, so we skip the console.log handling
  if (artifact) {
    // For OP_INVOKE contracts, only match logs against debug steps that are inside the function body.
    // Function body steps always have at least one function frame on the control stack (from OP_INVOKE),
    // while main script steps (OP_DEFINE, dispatcher) have an empty control stack.
    // Without this filter, main script steps at IPs that coincidentally match function body log IPs
    // would incorrectly trigger log output (e.g., logs from non-executed if/else branches).
    const logMatchingSteps = entryPointFuncSelector !== undefined
      ? executedDebugSteps.filter((step) => step.controlStack.length > 0)
      : executedDebugSteps;

    // Try to match each executed debug step to a log entry if it exists. Note that inside loops,
    // the same log statement may be executed multiple times in different debug steps
    // Also note that multiple log statements may exist for the same ip, so we need to handle all of them
    const executedLogs = logMatchingSteps
      .flatMap((debugStep, index) => {
        const logEntries = getLogsForStep(debugStep).filter((log) => log.ip === debugStep.ip);
        if (logEntries.length === 0) return [];

        const reversedPriorDebugSteps = logMatchingSteps.slice(0, index + 1).reverse();
        const enumNames = new Set((artifact.enums ?? []).map((e) => e.name));

        return logEntries.map((logEntry) => {
          const decodedLogData = logEntry.data
            .map((dataEntry) => decodeLogDataEntry(dataEntry, reversedPriorDebugSteps, vm, enumNames));
          return { logEntry, decodedLogData };
        });
      });

    for (const { logEntry, decodedLogData } of executedLogs) {
      const inputIndex = extractInputIndexFromScenario(scenarioId);
      logConsoleLogStatement(logEntry, decodedLogData, artifact.contractName, inputIndex);
    }
  }

  const lastExecutedDebugStep = executedDebugSteps[executedDebugSteps.length - 1];

  // If an error is present in the last step, that means a require statement in the middle of the function failed
  if (lastExecutedDebugStep.error) {
    // In Libauth any thrown error gets registered in the instruction that happens right *after* the instruction that
    // caused the error (in other words the OP_VERIFY). We need to decrement the instruction pointer to get the correct
    // failing instruction.
    const failingIp = lastExecutedDebugStep.ip - 1;
    const failingInstruction = lastExecutedDebugStep.instructions[failingIp];

    // With optimisations, the OP_CHECKSIG and OP_VERIFY instructions are merged into a single opcode (OP_CHECKSIGVERIFY).
    // However, for the final verify, the OP_VERIFY is not present. In most cases, the implicit final VERIFY is checked
    // later in the code. However, for NULLFAIL, the error is thrown in the OP_CHECKSIG opcode, rather than in the
    // implicit final VERIFY. The error message is registered in the next instruction, so we need to increment the
    // instruction pointer to get the correct error message from the require messages in the artifact.
    // Note that we do NOT use this adjusted IP when passing the failing IP into the FailedRequireError.
    const isNullFail = lastExecutedDebugStep.error.includes(AuthenticationErrorCommon.nonNullSignatureFailure);
    const requireStatementIp = failingIp + (isNullFail && isSignatureCheckWithoutVerify(failingInstruction) ? 1 : 0);

    const { program: { inputIndex }, error } = lastExecutedDebugStep;

    // If there is no artifact, this is a P2PKH debug error, error can occur when final CHECKSIG fails with NULLFAIL or when
    // public key does not match pkh in EQUALVERIFY
    // Note: due to P2PKHUnlocker implementation, the CHECKSIG cannot fail in practice, only the EQUALVERIFY can fail
    if (!artifact) {
      throw new FailedTransactionError(error, getBitauthUri(template));
    }

    // Use entryPointFuncSelector to search the correct function's debug info
    let requireStatement = findRequireStatement(artifact, requireStatementIp, entryPointFuncSelector);
    let functionSourceMap = getFunctionSourceMap(artifact, entryPointFuncSelector);

    if (requireStatement) {
      // Use failingIp for the source map lookup. In function bodies, the instruction after
      // OP_CHECKSIG may be cleanup code (OP_NIP) mapped to the function declaration line,
      // while the OP_CHECKSIG itself maps to the correct require statement line.
      // In optimised code (CHECKSIGVERIFY), requireStatementIp == failingIp anyway.
      throw new FailedRequireError(
        artifact, failingIp, requireStatement, inputIndex, getBitauthUri(template), error,
        functionSourceMap,
      );
    }

    throw new FailedTransactionEvaluationError(
      artifact, failingIp, inputIndex, getBitauthUri(template), error, functionSourceMap,
    );
  }

  // Evaluate the final program state to see if it evaluated successfully
  const evaluationResult = vm.stateSuccess(lastExecutedDebugStep);

  // Check if the evaluation failed matches any of the possible failure cases
  if (failedFinalVerify(evaluationResult)) {
    const finalExecutedVerifyIp = getFinalExecutedVerifyIp(executedDebugSteps);

    // The final executed verify instruction points to the "implicit" VERIFY that is added at the end of the script.
    // This instruction does not exist in the sourcemap, so we need to decrement the instruction pointer to get the
    // actual final executed statement (which is *not* the require statement, but the evaluation within)
    const sourcemapInstructionPointer = finalExecutedVerifyIp - 1;

    const { program: { inputIndex } } = lastExecutedDebugStep;

    // If there is no artifact, this is a P2PKH debug error, final verify can only occur when final CHECKSIG failed
    // Note: due to P2PKHUnlocker implementation, this cannot happen in practice
    if (!artifact) {
      throw new FailedTransactionError(evaluationResult, getBitauthUri(template));
    }

    // Use entryPointFuncSelector to search the correct function's debug info
    let requireStatement = findRequireStatement(artifact, finalExecutedVerifyIp, entryPointFuncSelector);
    let functionSourceMap = getFunctionSourceMap(artifact, entryPointFuncSelector);

    if (requireStatement) {
      throw new FailedRequireError(
        artifact, sourcemapInstructionPointer, requireStatement, inputIndex, getBitauthUri(template),
        undefined, functionSourceMap,
      );
    }

    throw new FailedTransactionEvaluationError(
      artifact, sourcemapInstructionPointer, inputIndex, getBitauthUri(template), evaluationResult, functionSourceMap,
    );
  }

  return fullDebugSteps;
};

// Note: this relies on the naming convention that the scenario ID is of the form <name>_input<index>_evaluate
const extractInputIndexFromScenario = (scenarioId: string): number => {
  const match = scenarioId.match(/_input(\d+)_/);
  if (!match) throw new Error(`Invalid scenario ID: ${scenarioId}`);
  return parseInt(match[1]);
};

type Program = AuthenticationProgramCommon;
type CreateProgramResult = { vm: VM, program: Program };

// internal util. instantiates the virtual machine and compiles the template into a program
const createProgram = (template: WalletTemplate, unlockingScriptId: string, scenarioId: string): CreateProgramResult => {
  const configuration = walletTemplateToCompilerConfiguration(template);
  const vm = createVirtualMachine(template.supported[0] as VmTarget);
  const compiler = createCompiler(configuration);

  if (!template.scripts[unlockingScriptId]) {
    throw new Error(`No unlock script found in template for ID ${unlockingScriptId}`);
  }

  if (!template.scenarios?.[scenarioId]) {
    throw new Error(`No scenario found in template for ID ${scenarioId}`);
  }

  const scenarioGeneration = compiler.generateScenario({
    debug: true,
    unlockingScriptId,
    scenarioId,
  });

  if (typeof scenarioGeneration === 'string') {
    throw new FailedTransactionError(scenarioGeneration, getBitauthUri(template));
  }

  if (typeof scenarioGeneration.scenario === 'string') {
    throw new FailedTransactionError(scenarioGeneration.scenario, getBitauthUri(template));
  }

  return { vm, program: scenarioGeneration.scenario.program };
};

const logConsoleLogStatement = (
  log: LogEntry,
  decodedLogData: Array<string | bigint | boolean>,
  contractName: string,
  inputIndex: number,
): void => {
  console.log(`[Input #${inputIndex}] ${contractName}.scash:${log.line} ${decodedLogData.join(' ')}`);
};

const decodeLogDataEntry = (
  dataEntry: LogData,
  reversedPriorDebugSteps: AuthenticationProgramStateCommon[],
  vm: VM,
  enumNames: Set<string> = new Set(),
): string | bigint | boolean => {
  if (typeof dataEntry === 'string') return dataEntry;

  const dataEntryDebugStep = reversedPriorDebugSteps.find((step) => step.ip === dataEntry.ip);

  if (!dataEntryDebugStep) {
    throw new Error(`Should not happen: corresponding data entry debug step not found for entry at ip ${dataEntry.ip}`);
  }

  const transformedDebugStep = applyStackItemTransformations(dataEntry, dataEntryDebugStep, vm);
  return decodeStackItem(dataEntry, transformedDebugStep.stack, enumNames);
};

const applyStackItemTransformations = (
  element: StackItem,
  debugStep: AuthenticationProgramStateCommon,
  vm: VM,
): AuthenticationProgramStateCommon => {
  if (!element.transformations) return debugStep;

  const transformationsBytecode = asmToBytecode(element.transformations);
  const transformationsAuthenticationInstructions = decodeAuthenticationInstructions(transformationsBytecode);

  const transformationsStartState: AuthenticationProgramStateCommon = {
    alternateStack: [...debugStep.alternateStack],
    controlStack: [],
    ip: 0,
    lastCodeSeparator: -1,
    metrics: {} as any,
    stack: [...debugStep.stack],
    operationCount: 0,
    instructions: transformationsAuthenticationInstructions,
    signedMessages: [],
    program: { ...debugStep.program },
    functionTable: debugStep.functionTable ?? {},
    functionCount: debugStep.functionCount ?? 0,
  };

  const transformationsEndState = vm.stateEvaluate(transformationsStartState);

  return transformationsEndState;
};

const decodeStackItem = (
  element: StackItem,
  stack: Uint8Array[],
  enumNames: Set<string> = new Set(),
): string | bigint | boolean => {
  // Reversed since stack is in reverse order
  const stackItem = [...stack].reverse()[element.stackIndex];

  if (!stackItem) {
    throw Error(`Stack item at index ${element.stackIndex} not found at instruction pointer ${element.ip}`);
  }

  if (element.type === PrimitiveType.BOOL) return decodeBool(stackItem);
  if (element.type === PrimitiveType.BIGINT || element.type === PrimitiveType.INT) return decodeInt(stackItem);
  // Bounded integer types (int8..int256, uint8..uint256) are int-backed.
  if (/^u?int\d+$/.test(element.type)) return decodeInt(stackItem);
  if (element.type === PrimitiveType.STRING) return decodeString(stackItem);
  // Enums are int-backed: decode to their underlying integer value.
  if (enumNames.has(element.type)) return decodeInt(stackItem);
  // Function pointers are int-backed (their functionId): decode to the integer.
  if (element.type.startsWith('function(')) return decodeInt(stackItem);

  return `0x${binToHex(stackItem)}`;
};

const failedFinalVerify = (evaluationResult: string | true): evaluationResult is string => {
  // true indicates a successful evaluation (so no failed final verify)
  if (evaluationResult === true) return false;

  // If any of the following errors occurred, then the final verify failed - any other messages
  // indicate other kinds of failures
  return toRegExp([
    // TODO: Ask Jason to put these back into an enum and replace with the enum value
    'The CashAssembly internal evaluation completed with an unexpected number of items on the stack (must be exactly 1).', // AuthenticationErrorCommon.requiresCleanStack,
    'The CashAssembly internal evaluation completed with a non-empty control stack.', // AuthenticationErrorCommon.nonEmptyControlStack,
    AuthenticationErrorCommon.unsuccessfulEvaluation,
  ]).test(evaluationResult);
};

const calculateCleanupSize = (instructions: Array<AuthenticationInstruction | undefined>): number => {
  // OP_NIP (or OP_DROP/OP_2DROP in optimised bytecode) is used for cleanup at the end of a function,
  // OP_ENDIF and OP_ELSE are the end of branches. We need to remove all of these to get to the actual last
  // executed instruction of a function
  // Note that in the case where we re-add OP_1 because we cannot optimise the final explicit VERIFY into an implicit one
  // (like when dealing with if-statements, or with CHECKLOCKTIMEVERIFY), it is impossible to run into an implicit final
  // verify failure. That is why OP_1 does not need to be included in the cleanup opcodes.
  // TODO: Perhaps we also do not need to add OP_DROP/OP_2DROP either, because they only occur together with OP_1
  const cleanupOpcodes = [Op.OP_ENDIF, Op.OP_NIP, Op.OP_ELSE, Op.OP_DROP, Op.OP_2DROP];

  let cleanupSize = 0;
  for (const instruction of [...instructions].reverse()) {
    // The instructions array may contain undefined elements for the final executed debug steps that are not
    // technically instructions (e.g. the final *implicit* verify). We still want to get rid of these in the cleanup
    if (!instruction || cleanupOpcodes.includes(instruction.opcode)) {
      cleanupSize++;
    } else {
      break;
    }
  }

  return cleanupSize;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const logDebugSteps = (
  debugSteps: AuthenticationProgramStateCommon[],
  instructions: AuthenticationInstruction[],
): void => {
  debugSteps.map((step) => {
    const opcode = instructions[step.ip] ? bytecodeToAsm(encodeAuthenticationInstruction(instructions[step.ip])) : 'null';
    console.warn(step.ip, opcode, step.stack, step.error);
  });
};

const getFinalExecutedVerifyIp = (executedDebugSteps: AuthenticationProgramStateCommon[]): number => {
  // Map every executed debug step to its corresponding instruction
  // (note that the last executed step(s) may not have a corresponding instruction and will be `undefined`)
  const executedInstructions = executedDebugSteps.map((step) => step.instructions[step.ip]);

  const finalExecutedDebugStepIndex = executedDebugSteps.length - 1;
  const cleanupSize = calculateCleanupSize(executedInstructions);
  const finalExecutedNonCleanupStep = executedDebugSteps[finalExecutedDebugStepIndex - cleanupSize];

  // The final verify in a function is dropped, so after cleanup, we get the final OP that was executed *before* the
  // final verify, so we need to add one to get the actual final verify instruction
  const finalExecutedVerifyIp = finalExecutedNonCleanupStep.ip + 1;
  return finalExecutedVerifyIp;
};

// Finds a require statement matching the given IP, searching in the correct function body's
// debug info (if funcIndex is defined) or in the main artifact's requires.
const findRequireStatement = (
  artifact: Artifact,
  ip: number,
  funcSelector: string | undefined,
): RequireStatement | undefined => {
  // If we know which function body we're in, search only that function's requires
  if (funcSelector !== undefined && artifact.debug?.functionDebug?.[funcSelector]) {
    return artifact.debug.functionDebug[funcSelector].requires.find((r: RequireStatement) => r.ip === ip);
  }

  // Search main requires first
  const mainRequire = (artifact.debug?.requires ?? []).find((r) => r.ip === ip);
  if (mainRequire) return mainRequire;

  // Fall back to searching all function debug entries (for cases where we couldn't determine the function)
  if (artifact.debug?.functionDebug) {
    for (const funcDebug of Object.values(artifact.debug.functionDebug)) {
      const req = funcDebug.requires.find((r: RequireStatement) => r.ip === ip);
      if (req) return req;
    }
  }

  return undefined;
};

// Returns the source map for a function body, or undefined for the main script.
const getFunctionSourceMap = (
  artifact: Artifact,
  funcSelector: string | undefined,
): string | undefined => {
  if (funcSelector !== undefined && artifact.debug?.functionDebug?.[funcSelector]) {
    return artifact.debug.functionDebug[funcSelector].sourceMap;
  }
  return undefined;
};

// After debugging, we want to verify the full transaction to ensure it is valid (this catches any errors that are not
// necessarily script errors)
const verifyFullTransaction = (template: WalletTemplate): void => {
  const placeholderScriptId = Object.keys(template.scripts).find((key) =>
    'unlocks' in template.scripts[key] && !key.includes('_body_'),
  );
  const placeholderScenarioId = (template.scripts[placeholderScriptId ?? ''] as WalletTemplateScriptUnlocking)?.passes?.[0];

  if (!placeholderScenarioId || !placeholderScriptId) {
    throw new Error('No placeholder scenario ID or script ID found');
  }

  const { vm, program } = createProgram(template, placeholderScriptId, placeholderScenarioId);

  const verificationResult = vm.verify({
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });

  if (typeof verificationResult === 'string') {
    throw new FailedTransactionError(verificationResult, getBitauthUri(template));
  }
};

const isSignatureCheckWithoutVerify = (instruction: AuthenticationInstruction): boolean => {
  return [Op.OP_CHECKSIG, Op.OP_CHECKMULTISIG, Op.OP_CHECKDATASIG].includes(instruction.opcode);
};
