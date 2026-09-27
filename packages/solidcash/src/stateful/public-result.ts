import {
  attachDecodedAccessors, decorateDecodedResult, parseArrayTypeString,
  type AbiFunction, type Artifact, type StateValue,
} from '@solidcash/utils';
import { artifactUsesSolidityAbi, resolveExternalResultEncoding } from './solidityAbi.js';

/** The same public schema projection for authenticated direct reads and decoded VM return values. */
export function decorateFunctionResult(value: StateValue, fn: AbiFunction | undefined, artifact: Artifact): StateValue {
  if (fn?.outputs?.length !== 1) return attachDecodedAccessors(value);
  const type = fn.outputs[0].type;
  return decorateDecodedResult(value, type, artifact.structs ?? artifact.stateLayout?.structs,
    resolveExternalResultEncoding(fn.resultEncoding, artifact, [type], `function '${fn.name}' result`));
}

/**
 * State accessors already decoded the storage representation, so no return-wire encoding is inferred here.
 * Apply the declared value schema and compiler's address semantics to a public copy, including indexed arrays
 * and mappings which have no generated ABI getter. Raw state/entry APIs keep their storage bytes unchanged.
 */
export function decorateStateAccessorResult(
  value: StateValue | undefined,
  name: string,
  indexCount: number,
  artifact: Artifact,
): StateValue | undefined {
  if (value === undefined) return value;
  const variable = artifact.stateLayout?.variables.find((entry) => entry.name === name);
  let type = variable?.type ?? artifact.stateLayout?.collections?.find((entry) => (
    entry.name === name && entry.kind === 'mapping'
  ))?.valueType;
  if (type === undefined) return value;
  if (variable) {
    for (let index = 0; index < indexCount; index += 1) {
      const array = parseArrayTypeString(type);
      if (!array) throw new Error(`State variable '${name}' is not indexable at this depth.`);
      type = array.elementType;
    }
  }
  return decorateDecodedResult(value, type, artifact.structs ?? artifact.stateLayout?.structs,
    artifactUsesSolidityAbi(artifact) ? 'evm-abi-v1' : 'compact-pushdata-v1');
}
