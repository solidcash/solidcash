import { Artifact, RequireStatement, sourceMapToLocationData, Type } from '@solidcash/utils';

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

export class FailedRequireError extends FailedTransactionError {
  constructor(
    public artifact: Artifact,
    public failingInstructionPointer: number,
    public requireStatement: RequireStatement,
    public inputIndex: number,
    public bitauthUri: string,
    public libauthErrorMessage?: string,
    functionSourceMap?: string,
    preferDirectCheckSigPredicate = false,
  ) {
    const { statement, lineNumber } = getLocationDataForInstructionPointer(
      artifact, failingInstructionPointer, functionSourceMap, requireStatement.line,
    );
    const failingStatement = preferDirectCheckSigPredicate
      ? directCheckSigPredicate(statement) ?? statement : statement;

    const baseMessage = `${artifact.contractName}.scash:${lineNumber} Require statement failed at input ${inputIndex} in contract ${artifact.contractName}.scash at line ${lineNumber}`;
    const baseMessageWithRequireMessage = `${baseMessage} with the following message: ${requireStatement.message}`;
    const fullMessage = `${requireStatement.message ? baseMessageWithRequireMessage : baseMessage}.\nFailing statement: ${failingStatement}`;

    super(fullMessage, bitauthUri);
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

const getLocationDataForInstructionPointer = (
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
