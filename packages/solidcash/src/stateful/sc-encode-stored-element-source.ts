/**
 * phase-boundary extract: SC class-body extract — encode compiler-described stored-element sources for entry access.
 */

import {
  type AbiFunction,
  type Artifact,
  type EntryAccessAbi,
  type ExternalCallExpression,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import { projectMessageBusHandlerArguments } from '../message-bus/message-bus.js';
import { visibleHandlerInputs } from './route-expression-key.js';

export interface EncodeStoredElementSourceHost {
  evaluateExternalExpression(
    expression: ExternalCallExpression,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    state?: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
    occurrenceIndex?: number,
    stateIncludesPriorWrites?: boolean,
    executionSelfAddress?: FunctionArgument,
    localBindings?: ReadonlyMap<string, FunctionArgument>,
    stateLengthDeltas?: Readonly<Record<string, bigint>>,
    strictFieldAccess?: boolean,
  ): FunctionArgument | undefined;
}

export function encodeStoredElementSource(
  host: EncodeStoredElementSourceHost,
  access: EntryAccessAbi,
  elementType: string,
  functionArgs: FunctionArgument[],
  handler: AbiFunction,
  artifact: Artifact,
  state?: Record<string, unknown>,
): Uint8Array | undefined {
  return encodeStoredSource(host, access, elementType, functionArgs, handler, artifact, state);
}

/** Evaluate one exact whole-value write, using only supplied authenticated producer results. */
export function encodeStoredValueSource(
  host: EncodeStoredElementSourceHost,
  access: EntryAccessAbi,
  valueType: string,
  functionArgs: FunctionArgument[],
  handler: AbiFunction,
  artifact: Artifact,
  state?: Record<string, unknown>,
  externalReturns?: ReadonlyMap<string, FunctionArgument>,
): Uint8Array | undefined {
  return encodeStoredSource(host, access, valueType, functionArgs, handler, artifact, state, true, externalReturns);
}

function encodeStoredSource(
  host: EncodeStoredElementSourceHost,
  access: EntryAccessAbi,
  storedType: string,
  functionArgs: FunctionArgument[],
  handler: AbiFunction,
  artifact: Artifact,
  state?: Record<string, unknown>,
  wholeValue = false,
  externalReturns?: ReadonlyMap<string, FunctionArgument>,
): Uint8Array | undefined {
  const recipe = wholeValue ? access.storedValueSource : access.storedElementSource;
  const visibleInputs = visibleHandlerInputs(handler.inputs);
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  const normalizeType = (type: string | undefined): string | undefined => (
    type === 'uint' ? 'uint256' : type === 'int' ? 'int256' : type
  );
  const typeMatches = (actual: string | undefined, expected?: string): boolean => (
    expected === undefined || normalizeType(actual) === normalizeType(expected)
  );
  const numericType = (type: string | undefined): boolean => (
    type === 'bigint' || /^(?:u?int(?:\d+)?|u?fixed(?:\d+x\d+)?)$/u.test(type ?? '')
  );
  const validate = (expression: ExternalCallExpression, expectedType?: string): boolean => {
    const comparison = ['==', '!=', '<', '<=', '>', '>=', '&&', '||'].includes(expression.operator ?? '');
    const inferredExpressionType = expression.type ?? (expression.kind === 'binary'
      ? comparison ? 'bool' : expression.left?.type : undefined);
    if (expression.kind !== 'field' && !typeMatches(inferredExpressionType, expectedType)) return false;
    if (expression.kind === 'source') {
      const index = expression.source?.paramIndex;
      return expression.source?.kind === 'forward' && Number.isSafeInteger(index)
        && index! >= 0 && index! < visibleInputs.length
        && (!wholeValue || functionArgs[index!] !== undefined)
        && typeMatches(expression.type, visibleInputs[index!].type);
    }
    if (expression.kind === 'literal') {
      if (numericType(expression.type)) {
        return typeof expression.value === 'string' && /^-?\d+$/u.test(expression.value);
      }
      if (expression.type === 'bool') return typeof expression.value === 'boolean';
      if (expression.type === 'string') return typeof expression.value === 'string';
      if (expression.type?.startsWith('bytes')) {
        return typeof expression.value === 'string' && /^(?:[0-9a-fA-F]{2})*$/u.test(expression.value);
      }
      return false;
    }
    if (expression.kind === 'state') {
      if (expression.name === '__block_timestamp') return numericType(expression.type);
      const variable = wholeValue && artifact.stateLayout?.variables
        .find((candidate) => candidate.name === expression.name);
      return !!variable && typeMatches(expression.type, variable.type);
    }
    if (wholeValue && expression.kind === 'producerResult') {
      const producers = handler.externalCalls?.filter((call) => call.callsiteId === expression.callsiteId);
      const resultIndex = expression.resultIndex;
      return producers?.length === 1 && Number.isSafeInteger(resultIndex) && resultIndex! >= 0
        && resultIndex! < (producers[0].returnTypes?.length ?? 0)
        && (expression.sourceCallsiteId === undefined || expression.sourceCallsiteId === expression.callsiteId)
        && typeMatches(expression.type, producers[0].returnTypes![resultIndex!]);
    }
    if (wholeValue && expression.kind === 'unary') {
      return ['-', '!', '~'].includes(expression.operator ?? '')
        && expression.expression !== undefined && validate(expression.expression);
    }
    if (expression.kind === 'cast') {
      return expression.expression !== undefined && expression.type !== undefined
        && validate(expression.expression);
    }
    if (expression.kind === 'field') {
      if (!expression.expression || !validate(expression.expression)) return false;
      const struct = structs?.find((candidate) => candidate.name === expression.expression!.type);
      const field = struct?.fields.find((candidate) => candidate.name === expression.name);
      return field !== undefined
        && (expression.type === undefined || typeMatches(expression.type, field.type))
        && typeMatches(field.type, expectedType);
    }
    if (expression.kind === 'binary') {
      return ['+', '-', '*', '/', '%', '&', '|', '^', '==', '!=', '<', '<=', '>', '>=', '&&', '||']
        .includes(expression.operator ?? '')
        && expression.left !== undefined && expression.right !== undefined
        && validate(expression.left) && validate(expression.right);
    }
    if (expression.kind === 'ternary') {
      return expression.condition !== undefined && expression.ifTrue !== undefined
        && expression.ifFalse !== undefined && validate(expression.condition, 'bool')
        && validate(expression.ifTrue, expression.type) && validate(expression.ifFalse, expression.type);
    }
    if (expression.kind === 'arrayAccess') {
      const elementType = expression.left?.type?.match(/^(.*)\[(?:\d*)\]$/u)?.[1];
      return expression.left !== undefined && expression.right !== undefined && elementType !== undefined
        && validate(expression.left) && validate(expression.right)
        && numericType(expression.right.type) && typeMatches(expression.type, elementType);
    }
    if (expression.kind === 'array') {
      const elementType = expression.type?.match(/^(.*)\[(?:\d*)\]$/u)?.[1];
      return elementType !== undefined && expression.args?.every((argument) => (
        validate(argument, elementType)
      )) === true;
    }
    if (expression.kind === 'call') {
      const struct = structs?.find((candidate) => candidate.name === expression.name);
      return struct !== undefined && expression.type === struct.name
        && expression.args?.length === struct.fields.length
        && expression.args.every((argument, index) => validate(argument, struct.fields[index].type));
    }
    return false;
  };
  const validShape = wholeValue
    ? !access.arrayMutation && access.operations.includes('write')
      && access.storedValueSource?.execution === 'unconditional-once'
      && access.storedValueSource.valueType === storedType
    : access.arrayMutation === 'push' && access.storedElementSource?.elementType === storedType;
  if (!validShape || recipe?.version !== 1 || recipe.expression.type !== storedType
    || access.mutationEffectOrdinals?.length !== 1
    || recipe.mutationEffectOrdinal !== access.mutationEffectOrdinals[0]
    || !validate(recipe.expression, storedType)) return undefined;
  // Recipes execute in the decoded handler's value domain, not the SDK's public argument domain.
  // In Solidity-compatible kernel rows, nested value addresses are ABI words while call targets stay native.
  const executionArgs = wholeValue
    ? projectMessageBusHandlerArguments(artifact, handler.name, handler.selector, functionArgs) : functionArgs;
  const value = host.evaluateExternalExpression(
    recipe.expression, executionArgs, artifact, state, visibleInputs,
    externalReturns, 0, false, undefined, undefined, undefined, true,
  );
  if (value === undefined) return undefined;
  try {
    const encoded = encodeFunctionArgument(value, storedType, structs);
    return encoded instanceof Uint8Array ? encoded : undefined;
  } catch {
    return undefined;
  }
}
