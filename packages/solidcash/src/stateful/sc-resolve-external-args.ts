/**
 * phase-boundary extract: SC class-body extract — resolve external-call args from ArgSource metadata.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  type ArgSource,
  type Artifact,
  type ExternalCallExpression,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type Signer from '../Signer.js';
import { addressToLockScript, tryCashAddressToLockScript } from '../utils.js';

export interface ResolveExternalArgsHost {
  readonly inner: {
    encodedConstructorArgs: readonly FunctionArgument[];
    lockingBytecode: string;
  };
  readonly signer?: Signer;
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
    executionCallerAddress?: FunctionArgument,
  ): FunctionArgument | undefined;
}

export function resolveExternalArgs(
  host: ResolveExternalArgsHost,
  argSources: readonly ArgSource[] | undefined,
  functionArgs: FunctionArgument[],
  artifact: Artifact,
  state?: Record<string, unknown>,
  callerInputs?: readonly { type: string }[],
  externalReturns?: ReadonlyMap<string, FunctionArgument>,
  occurrenceIndex = 0,
  stateIncludesPriorWrites = false,
  executionSelfAddress?: FunctionArgument,
  executionCallerAddress?: FunctionArgument,
  ownerConstructorArgs?: readonly FunctionArgument[],
): FunctionArgument[] | undefined {
  if (!argSources) return undefined;
  if (argSources.length === 0) return [];

  const resolved: FunctionArgument[] = [];
  for (const source of argSources) {
    switch (source.kind) {
      case 'forward': {
        if (source.paramIndex === undefined) return undefined;
        if (source.paramIndex >= functionArgs.length) {
          throw new Error(
            'External call argument forward references parameter '
            + `index ${source.paramIndex}, but the function was `
            + `called with only ${functionArgs.length} arguments.`,
          );
        }
        const forwarded = functionArgs[source.paramIndex];
        resolved.push(tryCashAddressToLockScript(forwarded) ?? forwarded);
        break;
      }
      case 'constructorArg': {
        if (!source.paramName) return undefined;
        // The index is taken from `artifact`, so the value must come from the same contract's arguments. A
        // caller that passes another contract's artifact - a nested compose reading the callee's own
        // constructor - supplies them; the host's own arguments stay the default.
        const ownerArgs = ownerConstructorArgs ?? host.inner.encodedConstructorArgs;
        const paramIndex = artifact.constructorInputs.findIndex((inp) => inp.name === source.paramName);
        if (paramIndex < 0 || paramIndex >= ownerArgs.length) return undefined;
        resolved.push(ownerArgs[paramIndex]);
        break;
      }
      case 'literal': {
        if (source.value === undefined || !source.type) return undefined;
        if (source.type === 'bigint') {
          resolved.push(BigInt(source.value));
        } else if (source.type === 'bool') {
          resolved.push(source.value === 'true');
        } else if (source.type === 'string') {
          resolved.push(source.value);
        } else {
          // bytes types - hex string to Uint8Array
          resolved.push(hexToBin(source.value));
        }
        break;
      }
      case 'msgSender': {
        if (executionCallerAddress !== undefined) {
          resolved.push(executionCallerAddress);
          break;
        }
        if (!host.signer) return undefined;
        resolved.push(addressToLockScript(host.signer.getAddress()));
        break;
      }
      case 'selfAddress': {
        // The compiler lowers `address(this)` to the authenticated `this` of the current expression context.
        // Local delegate execution uses its physical executor; an outgoing CALL planner supplies the state
        // owner here so this value and the downstream callee's reconstructed msg.sender remain one identity.
        resolved.push(executionSelfAddress ?? hexToBin(host.inner.lockingBytecode));
        break;
      }
      case 'arrayElement': {
        if (source.paramIndex === undefined || source.paramIndex >= functionArgs.length) return undefined;
        const array = functionArgs[source.paramIndex];
        if (!Array.isArray(array)) return undefined;
        // `indexValue` is the element index at occurrence zero; `indexStepValue` is its per-occurrence delta
        // for a loop induction variable index. Advancing the index is what keeps a runtime loop's later
        // occurrences on the element the generated loop body selected - the covenant evaluates that element
        // for every row, so a frozen index makes every row after the first disagree with its own call.
        let index = (source.indexValue ?? 0) + (source.indexStepValue ?? 0) * occurrenceIndex;
        if (source.indexParamIndex !== undefined) {
          const rawIndex = functionArgs[source.indexParamIndex];
          if (typeof rawIndex !== 'bigint' && typeof rawIndex !== 'number') return undefined;
          index = Number(rawIndex);
        }
        if (index < 0 || index >= array.length) return undefined;
        resolved.push(array[index] as FunctionArgument);
        break;
      }
      case 'loopIndex': {
        if (source.initialValue === undefined) return undefined;
        const runtimeStep = source.stepExpression && host.evaluateExternalExpression(
          source.stepExpression, functionArgs, artifact, state, callerInputs, externalReturns,
          occurrenceIndex, stateIncludesPriorWrites, executionSelfAddress,
          undefined, undefined, false, executionCallerAddress,
        );
        const step = runtimeStep ?? source.stepValue;
        if (typeof step !== 'bigint' && typeof step !== 'number' && typeof step !== 'string') return undefined;
        resolved.push(BigInt(source.initialValue) + BigInt(step) * BigInt(occurrenceIndex));
        break;
      }
      case 'expression':
        if (source.expression) {
          const value = host.evaluateExternalExpression(
            source.expression, functionArgs, artifact, state, callerInputs, externalReturns,
            occurrenceIndex, stateIncludesPriorWrites, executionSelfAddress,
            undefined, undefined, false, executionCallerAddress,
          );
          if (value === undefined) return undefined;
          resolved.push(value);
          break;
        }
        return undefined;
      default:
        // Can't resolve complex expressions - user must provide via withExternalCall
        return undefined;
    }
  }
  return resolved;
}
