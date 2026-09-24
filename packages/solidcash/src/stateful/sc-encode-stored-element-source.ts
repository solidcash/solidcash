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
  const recipe = access.storedElementSource;
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
      return expression.name === '__block_timestamp' && numericType(expression.type);
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
  if (access.arrayMutation !== 'push' || recipe?.version !== 1 || recipe.elementType !== elementType
    || recipe.expression.type !== elementType
    || access.mutationEffectOrdinals?.length !== 1
    || recipe.mutationEffectOrdinal !== access.mutationEffectOrdinals[0]
    || !validate(recipe.expression, recipe.elementType)) return undefined;
  const value = host.evaluateExternalExpression(
    recipe.expression, functionArgs, artifact, state, visibleInputs,
    undefined, 0, false, undefined, undefined, undefined, true,
  );
  if (value === undefined) return undefined;
  try {
    const encoded = encodeFunctionArgument(value, elementType, structs);
    return encoded instanceof Uint8Array ? encoded : undefined;
  } catch {
    return undefined;
  }
}
