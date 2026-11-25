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

export class MixedCompileModeCallError extends Error {
  constructor(interfaceName: string, functionName: string, callerEvmCompat: boolean) {
    const [caller, callee] = callerEvmCompat ? ['under evmCompat', 'natively'] : ['natively', 'under evmCompat'];
    super(`Call to ${interfaceName}.${functionName} crosses compile modes: its caller is compiled ${caller} and its `
      + `callee ${callee}. The caller binds the selector it hashed, keccak256 under evmCompat and sha256 natively, `
      + 'so the callee can never match it. Compile both contracts in one mode.');
  }
}

/**
 * A call between an artifact whose call records name their reader (`Artifact.callRecordReader`) and one compiled
 * before, whose records name none. The caller digests its own input index and the callee the reader its witness
 * names, so one side always digests two bytes the other does not: the caller would never accept the record, and
 * accepting an unbound one would let two callers read one run.
 */
export class MixedCallRecordReaderError extends Error {
  constructor(interfaceName: string, functionName: string, callerNamesReader: boolean) {
    const [caller, callee] = callerNamesReader ? ['names', 'does not'] : ['does not', 'names'];
    super(`Call to ${interfaceName}.${functionName} mixes call record schemes: its caller ${caller} the record's `
      + `reader in the call's digest and its callee ${callee}, so the caller can never accept the callee's record. `
      + 'Recompile the contract compiled before records named their reader.');
  }
}

/**
 * A call whose target the function writes before the call runs on a callee the caller's current state and the
 * call's arguments do not name (ABI `targetWrittenBeforeCall`), so the builder cannot resolve it from them. `remedy`
 * names how the author passes the callee: withExternalCall for a call slot, withCall for a low-level call.
 */
export class ExternalCallTargetWrittenBeforeCallError extends Error {
  constructor(
    functionName: string, interfaceName: string, methodName: string, remedy = 'withExternalCall(contract)',
  ) {
    super(`'${functionName}' writes the target of its call to ${interfaceName}.${methodName} before the call, so the `
      + 'call runs on a callee the contract\'s current state and the call\'s arguments do not name. Pass the callee '
      + `the call runs on with ${remedy}.`);
  }
}

/**
 * A contract's call that its run may skip, under a guard the SDK cannot evaluate before it builds the transaction. A
 * callee co-spent on a guess runs without being called when the guard is false, so the SDK refuses the call instead.
 */
export class CallGuardUndecidedError extends Error {
  constructor(
    /** The calling function, `Contract.function`. */
    public readonly caller: string,
    /** The call, `Interface.function`, with its source line when the artifact publishes it. */
    public readonly call: string,
    /** The contract the call reaches. */
    public readonly callee: string,
    /**
     * The guard as the artifact publishes it; undefined when the compiler publishes no form of it; `{ loop: true }` when
     * the call runs once per turn of a loop whose number of turns does not resolve.
     */
    public readonly guard: string | undefined | { readonly loop: true },
    /** Why the published guard, or the loop, did not resolve. */
    public readonly reason?: string,
  ) {
    const contract = caller.slice(0, caller.lastIndexOf('.')) || caller;
    const because = reason === undefined ? '' : ` (${reason})`;
    const loop = typeof guard === 'object';
    super(`${caller}'s call of ${call} cannot be built: it runs ${guard === undefined
      ? 'only under a guard the compiler publishes no form of, so the SDK cannot tell before it builds the transaction '
        + `whether ${contract} makes the call`
      : loop
        ? `once per turn of a loop, and the SDK cannot tell before it builds the transaction whether the loop turns${because}`
        : `only under the guard \`${guard}\`, and the SDK cannot tell before it builds the transaction whether that `
          + `holds${because}`}. Spending ${callee} on a guess would let it run without being called when the `
      + `${loop ? 'loop does not turn' : 'guard is false'}. ${loop
        ? `Bound the loop by something the SDK can evaluate when it builds: the state of ${contract}, an argument, `
          + 'block.number or block.timestamp, or the result of an earlier call whose contract it can run.'
        : 'Make the guard something the SDK can evaluate when it builds: the state of '
          + `${contract}, an argument, block.number or block.timestamp, or the result of an earlier call whose contract `
          + 'it can run; or move the call into a function of its own that requires the guard, and call that function '
          + 'only when the guard holds.'}`);
    this.name = 'CallGuardUndecidedError';
  }
}

/**
 * A call `withExternalCall()` or `withCall()` lists a callee for, which the calling function does not make: its guard
 * reads false when the SDK builds the transaction. The function pins no caller edge for the call, so nothing in its
 * covenant would refuse the listed callee, co-spent, running without being called; the SDK refuses the call instead.
 */
export class ListedCallNotMadeError extends Error {
  constructor(
    /** The calling function, `Contract.function`. */
    public readonly caller: string,
    /** The call, `Interface.function`, with its source line when the artifact publishes it. */
    public readonly call: string,
    /** The contract the listed callee is. */
    public readonly callee: string,
    /** The guard as the artifact publishes it. */
    public readonly guard: string,
    /** The list the callee is named in. */
    public readonly list: 'withExternalCall' | 'withCall' = 'withExternalCall',
  ) {
    const contract = caller.slice(0, caller.lastIndexOf('.')) || caller;
    super(`${caller}'s call of ${call} is listed with ${list}(), but ${contract} does not make it: it runs only `
      + `under the guard \`${guard}\`, which is false when the transaction is built. Spending ${callee} would let it `
      + 'run without being called. Send the call without listing its callee, and the SDK leaves out a call its guard '
      + 'skips; or send it when the guard holds.');
    this.name = 'ListedCallNotMadeError';
  }
}

/**
 * A low-level call a loop may make more than once (`perTurn`) takes one `withCall()` callee per turn, each a run of its
 * own. The SDK refuses a listing it cannot lay out that way, naming why.
 */
export class LowLevelCallTurnsError extends Error {
  constructor(
    /** The calling function, `Contract.function`. */
    public readonly caller: string,
    public readonly reason: string,
  ) {
    super(`${caller}'s low-level call in a loop takes one withCall() callee per turn, each a run of its own: ${reason}.`);
    this.name = 'LowLevelCallTurnsError';
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

/** Which limit makes a lock unspendable: the push of its redeem script, the script as one stack item, a P2S script. */
export type UnspendableContractLimit = 'unlocking bytecode' | 'stack item' | 'locking bytecode';

/**
 * A deployment refused before it broadcast anything: no input could ever spend the lock it would put coins at, because
 * the contract's code is over a per-input limit of the network its provider enforces.
 */
export class UnspendableContractError extends Error {
  constructor(
    public readonly contractName: string,
    /** The bytes of the code the lock commits to. */
    public readonly codeBytes: number,
    /** The fewest bytes a spend needs under `limitKind`: the redeem script's push, or the code itself. */
    public readonly requiredBytes: number,
    /** The network's limit, from its provider's `consensusLimits` or BCH's 10,000 bytes when it publishes none. */
    public readonly limit: number,
    public readonly limitKind: UnspendableContractLimit,
  ) {
    const reason = limitKind === 'unlocking bytecode'
      ? `a spend pushes its ${codeBytes}-byte redeem script in ${requiredBytes} unlocking bytecode bytes, `
        + `${requiredBytes - limit} over the network's ${limit}-byte per-input limit`
      : limitKind === 'stack item'
        ? `a spend pushes its ${codeBytes}-byte redeem script as one stack item, ${codeBytes - limit} over the `
          + `network's ${limit}-byte stack item limit`
        : `its ${codeBytes}-byte script is its locking bytecode, ${codeBytes - limit} over the network's `
          + `${limit}-byte bytecode limit`;
    super(`Contract '${contractName}' cannot be deployed: no input can spend its lock, as ${reason}. Nothing was `
      + 'broadcast. Split the contract (compileFileSplit / compileStringSplit) or reduce it.');
    this.name = 'UnspendableContractError';
  }
}

/**
 * Why a raw call cannot be built. A payload with bytes: no deployment is at the target (a wallet, or address(0)), none of
 * its functions takes the payload, the one that does fails, or it names a function that declares a result and the
 * callee's run pins no record to read. An empty payload: the target is a contract deployment, which a plain send that
 * co-spends no callee cannot answer for. A payload with bytes sent with a `{value:}` to its co-spent callee: a direct
 * build has nowhere to pay it that the callee would see.
 */
export type RawCallCalleeRequiredReason = 'no contract at the target' | 'no matching function' | 'callee fails'
| 'no record to read' | 'plain send to a contract' | 'value to a co-spent callee';

/** The sentence a refusal of `reason` gives after the call's name. */
function rawCallRefusal(reason: RawCallCalleeRequiredReason, detail: string | undefined): string {
  const runs = 'its payload is not empty, so its target must be co-spent and run the call';
  const plainSend = 'Only an empty-payload call, a plain send, is answered without a callee.';
  switch (reason) {
    case 'no contract at the target':
      return `${runs}, and no contract deployment is at the target. ${plainSend}`;
    case 'no matching function':
      return `${runs}, and the target deployment has no function for the payload. ${plainSend}`;
    case 'callee fails':
      return `${runs}, and the target fails the call${detail === undefined ? '' : ` (${detail})`}. ${plainSend}`;
    case 'no record to read':
      return 'its payload names a function that declares a result, so the caller reads its callee\'s record, and '
        + `the callee's run pins none${detail === undefined ? '' : ` (${detail})`}.`;
    case 'value to a co-spent callee':
      return `its payload is not empty, so its target is co-spent and runs the call${detail === undefined ? ''
        : ` (${detail})`}, and it sends {value:}. A direct build pays that value to the call's target address, which `
        + 'names the callee\'s master, not its satoshi container: the master spends only a coin that carries its '
        + 'minting NFT, so the payment could never be spent (a send refuses such an output, '
        + 'StatefulMasterPaymentError), and the callee reads msg.value from its satoshi container, so it would run '
        + 'as if sent nothing. Pay the callee\'s satoshi container with a transfer of its own, or call without '
        + '{value:}.';
    case 'plain send to a contract':
    default:
      return 'its payload is empty and its target is a contract deployment. A call that co-spends no callee answers '
        + '`(true, "")` only, as an account with no code does; the EVM would run the contract\'s receive or fallback, '
        + 'or answer `(false, "")`, and no spend states either.';
  }
}

/**
 * A raw low-level call refused before anything is built. A payload with bytes must run on its co-spent target, and a
 * payload naming a function that declares a result is answered from the callee's record; the planner has no callee
 * that does so. A call that co-spends no callee is a plain send, answered `(true, "")` only.
 */
export class RawCallCalleeRequiredError extends Error {
  constructor(
    public readonly reason: RawCallCalleeRequiredReason,
    /** The call as its caller's ABI publishes it: the payload's function or selector, when the source names one. */
    public readonly call: string,
    /**
     * The callee's own failure for `callee fails`, the callee's function for `no record to read`, the callee and its
     * function for `value to a co-spent callee`.
     */
    public readonly calleeError?: string,
  ) {
    super(`Raw call ${call} cannot be built: ${rawCallRefusal(reason, calleeError)}`);
    this.name = 'RawCallCalleeRequiredError';
  }
}

export type CallValueUnpayableReason = 'callee takes no value' | 'callee sends value on' | 'below dust';

/**
 * A typed call's `{value:}` that the builder cannot pay, refused before anything is built: its callee's record would
 * never match the caller's, which names the value, or its deposit could not be relayed.
 */
export class CallValueUnpayableError extends Error {
  constructor(
    public readonly reason: CallValueUnpayableReason,
    /** The call as `Caller.fn's call to Callee.fn()`, or `Caller.fn calls Callee.fn()` for a nested one. */
    public readonly call: string,
    /** The nested call for `callee sends value on`, the value and the dust threshold for `below dust`. */
    detail?: string,
  ) {
    super(reason === 'callee takes no value'
      ? `${call} sends {value:} to an entry whose record digests no value: it is not payable and reads no msg.value, `
        + 'or it was compiled with the message bus. Its record cannot match the caller\'s, which names the value.'
      : reason === 'callee sends value on'
        ? `${call}, which sends {value:} with ${detail}: a nested value call is not built, since a deposit and its `
          + 'payer\'s debit are laid out only for the calls the root makes.'
        : `${call} sends ${detail} a deposit into the callee's satoshi container needs to be relayed.`);
    this.name = 'CallValueUnpayableError';
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
