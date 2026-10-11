import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  type Artifact, type RequireStatement, type Type, decodeBool, decodeInt, decodeString, sourceMapToLocationData,
} from '@solidcash/utils';

const decodeCustomErrorArgument = (type: string, value: Uint8Array): unknown => {
  if (type === 'bool') return decodeBool(value);
  if (type === 'int' || type === 'uint' || type === 'bigint' || /^u?int\d+$/.test(type)) {
    return decodeInt(value);
  }
  if (type === 'string') return decodeString(value);
  if (type === 'bytes' || /^bytes\d+$/.test(type) || type === 'address') return `0x${binToHex(value)}`;
  return undefined;
};

export class TypeError extends Error {
  constructor(actual: string, expected: Type) {
    super(`Found type '${actual}' where type '${expected.toString()}' was expected`);
  }
}

export class UndefinedInputError extends Error {
  constructor() {
    super('Input is undefined');
  }
}

export class OutputSatoshisTooSmallError extends Error {
  constructor(satoshis: bigint, minimumAmount: bigint) {
    super(`Tried to add an output with ${satoshis} satoshis, which is less than the required minimum for this output-type (${minimumAmount})`);
  }
}

export class OutputTokenAmountTooSmallError extends Error {
  constructor(amount: bigint) {
    super(`Tried to add an output with ${amount} tokens, which is invalid`);
  }
}

export class TokensToNonTokenAddressError extends Error {
  constructor(address: string) {
    super(`Tried to send tokens to an address without token support, ${address}.`);
  }
}

export class NoDebugInformationInArtifactError extends Error {
  constructor() {
    super('No debug information found in artifact, please recompile with solidc version 0.10.0 or newer.');
  }
}

export class FailedTransactionError extends Error {
  constructor(public reason: string, public bitauthUri: string) {
    // Note: bitauthUri contains private keys. It is stored on the error object
    // for explicit debugging use, but NOT included in the error message to
    // prevent accidental leakage through logging.
    super(reason);
    // Hide bitauthUri from JSON.stringify / error reporting tools
    Object.defineProperty(this, 'bitauthUri', { enumerable: false, writable: true });
  }
}

export class FailedTransactionEvaluationError extends FailedTransactionError {
  constructor(
    public artifact: Artifact,
    public failingInstructionPointer: number,
    public inputIndex: number,
    public bitauthUri: string,
    public libauthErrorMessage: string,
    functionSourceMap?: string,
  ) {
    let message = `${artifact.contractName}.scash Error in transaction at input ${inputIndex} in contract ${artifact.contractName}.scash.\nReason: ${libauthErrorMessage}`;

    if (artifact.debug) {
      const { statement, lineNumber } = getLocationDataForInstructionPointer(
        artifact, failingInstructionPointer, functionSourceMap,
      );
      if (lineNumber > 0) {
        message = `${artifact.contractName}.scash:${lineNumber} Error in transaction at input ${inputIndex} in contract ${artifact.contractName}.scash at line ${lineNumber}.\nReason: ${libauthErrorMessage}\nFailing statement: ${statement}`;
      }
    }

    super(message, bitauthUri);
  }
}

/** One frame of a failing require's call stack: the function it is in, and the line it failed or called at. */
export interface CallStackEntry {
  /** Absent for the contract function the transaction entered. */
  functionName?: string;
  sourceName: string;
  line: number;
  statement: string;
}

const formatCallStack = (callStack: readonly CallStackEntry[]): string => callStack
  .map(({ functionName, sourceName, line, statement }) => {
    const location = functionName ? `${functionName} (${sourceName}:${line})` : `${sourceName}:${line}`;
    return `  at ${location} - ${statement}`;
  })
  .join('\n');

export class FailedRequireError extends FailedTransactionError {
  readonly errorArgs?: readonly unknown[];

  constructor(
    public artifact: Artifact,
    public failingInstructionPointer: number,
    public requireStatement: RequireStatement,
    public inputIndex: number,
    public bitauthUri: string,
    public libauthErrorMessage?: string,
    functionSourceMap?: string,
    preferDirectCheckSigPredicate = false,
    stackAtFailure?: readonly Uint8Array[],
    public callStack: readonly CallStackEntry[] = [],
  ) {
    const { statement, lineNumber } = getRequireLocationData(
      artifact, failingInstructionPointer, functionSourceMap, requireStatement.line,
    );
    const failingStatement = preferDirectCheckSigPredicate
      ? directCheckSigPredicate(statement) ?? statement : statement;

    const baseMessage = `${artifact.contractName}.scash:${lineNumber} Require statement failed at input ${inputIndex} in contract ${artifact.contractName}.scash at line ${lineNumber}`;
    const baseMessageWithRequireMessage = `${baseMessage} with the following message: ${requireStatement.message}`;
    const fullMessage = `${requireStatement.message ? baseMessageWithRequireMessage : baseMessage}.\nFailing statement: ${failingStatement}`;

    // A single-entry call stack adds nothing over the headline, so it is only shown for nested calls
    const callStackMessage = callStack.length >= 2 ? `\n${formatCallStack(callStack)}` : '';

    super(fullMessage + callStackMessage, bitauthUri);
    const types = requireStatement.errorArgumentTypes;
    if (types && stackAtFailure && stackAtFailure.length >= types.length) {
      try {
        const values = stackAtFailure.slice(-types.length).map((value, index) =>
          decodeCustomErrorArgument(types[index], value));
        if (values.every((value) => value !== undefined)) this.errorArgs = values;
      } catch { /* Invalid sideband data must not mask the source-level revert. */ }
    }
  }
}

/** NULLFAIL rejects the nonempty signature inside a direct checkSig call before the enclosing require runs. */
const directCheckSigPredicate = (statement: string): string | undefined => {
  const opening = /^require\s*\(/.exec(statement.trim());
  if (!opening) return undefined;
  const source = statement.trim();
  const start = opening[0].length;
  let depth = 0;
  let quote: string | undefined;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== undefined) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') { depth += 1; continue; }
    if (char === ')' && depth > 0) { depth -= 1; continue; }
    if ((char === ',' || char === ')') && depth === 0) {
      const predicate = source.slice(start, index).trim();
      return /^checkSig\s*\(/.test(predicate) ? predicate : undefined;
    }
  }
  return undefined;
};

// A require statement's own opcodes can be optimised away (e.g. a final `require(ok)` where `ok` is already on top of
// the stack), in which case the failing opcode belongs to an earlier statement. We then use the require's own line.
export const getRequireLocationData = (
  artifact: Artifact,
  instructionPointer: number,
  functionSourceMap: string | undefined,
  requireLine: number,
): { lineNumber: number, statement: string } => {
  const locationData = getLocationDataForInstructionPointer(
    artifact, instructionPointer, functionSourceMap, requireLine,
  );
  const statementEndLine = locationData.lineNumber + locationData.statement.split('\n').length - 1;
  if (requireLine <= 0 || (locationData.lineNumber > 0 && statementEndLine >= requireLine)) return locationData;

  const line = artifact.source.split('\n')[requireLine - 1];
  if (line === undefined) return locationData;
  return { lineNumber: requireLine, statement: line.trim().replace(/;$/, '') };
};

export const getLocationDataForInstructionPointer = (
  artifact: Artifact,
  instructionPointer: number,
  functionSourceMap?: string,
  fallbackLine?: number,
): { lineNumber: number, statement: string } => {
  // For function body errors (OP_INVOKE'd entry-point functions), use the function's source map directly.
  // Function body IPs are relative to the function body, not the main script, so no constructor offset adjustment.
  const sourceMap = functionSourceMap ?? artifact.debug?.sourceMap ?? '';
  if (!sourceMap) {
    const lines = artifact.source.split('\n');
    const lineNumber = fallbackLine ?? 0;
    const statement = lineNumber > 0 && lineNumber <= lines.length
      ? lines[lineNumber - 1].trim()
      : '<unknown>';
    return { lineNumber, statement };
  }
  const locationData = sourceMapToLocationData(sourceMap);

  // We subtract the constructor inputs because these are present in the evaluation (and thus the instruction pointer)
  // but they are not present in the source code (and thus the location data).
  // For function bodies (functionSourceMap provided), the IP is already relative to the function body - no adjustment.
  const modifiedInstructionPointer = functionSourceMap
    ? instructionPointer
    : instructionPointer - artifact.constructorInputs.length;

  if (modifiedInstructionPointer < 0 || modifiedInstructionPointer >= locationData.length
    || !locationData[modifiedInstructionPointer]) {
    return { lineNumber: 0, statement: '<unknown>' };
  }

  const { location } = locationData[modifiedInstructionPointer];

  const failingLines = artifact.source.split('\n').slice(location.start.line - 1, location.end.line);

  // Slice off the start and end of the statement's start and end lines to only return the failing part
  // Note that we first slice off the end, to avoid shifting the end column index
  failingLines[failingLines.length - 1] = failingLines[failingLines.length - 1].slice(0, location.end.column);
  failingLines[0] = failingLines[0].slice(location.start.column);

  const statement = failingLines.join('\n');
  const lineNumber = location.start.line;

  return { statement, lineNumber };
};

export class OutputBchChangeLockedError extends Error {
  constructor() {
    super('Tried to add a BCH input or output after a BCH change output was already added');
  }
}

export class OutputTokenChangeLockedError extends Error {
  constructor(category: string) {
    super(`Tried to add a token input or output with category ${category} after a change output with the same category was already added`);
  }
}

export class OutputTokenCommitmentTooLongError extends Error {
  constructor(commitment: string, maximumSize: number) {
    super(`Provided token commitment ${commitment} is longer than the maximum size of ${maximumSize} bytes`);
  }
}

export class TransactionInputsRequiredError extends Error {
  constructor() {
    super('Transaction must have at least one input');
  }
}

export class TransactionOutputsRequiredError extends Error {
  constructor() {
    super('Transaction must have at least one output');
  }
}

export class TransactionFeeTooHighError extends Error {
  constructor(fee: bigint, maximumFee: bigint) {
    super(`Transaction fee of ${fee} is higher than max fee of ${maximumFee}`);
  }
}

export class TransactionFeePerByteTooHighError extends Error {
  constructor(feePerByte: number, maximumFeePerByte: number) {
    super(
      `Transaction fee per byte of ${feePerByte} is higher than max fee per byte of ${maximumFeePerByte}. `
      + 'This may indicate a missing change output. Set maximumFeeSatsPerByte to override.',
    );
  }
}

export class InputMissingLockingBytecodeError extends Error {
  constructor() {
    super('Input UTXO is missing its lockingBytecode. UTXOs fetched from a network provider include it automatically; '
      + 'when constructing UTXOs manually, set lockingBytecode to the hex-encoded locking script of the output.');
  }
}

export class UnlockerLockingBytecodeMismatchError extends Error {
  constructor(
    public inputIndex: number,
    utxoLockScript: string,
    unlockerLockScript: string,
    unlockerDescription: string,
  ) {
    super(`Input #${inputIndex} is locked by ${utxoLockScript}, which does not match the provided unlocker `
      + `(${unlockerDescription}, corresponding to ${unlockerLockScript}). This transaction would be rejected by the `
      + 'network. Make sure to use an unlocker that matches the address/contract holding the UTXO.');
  }
}
