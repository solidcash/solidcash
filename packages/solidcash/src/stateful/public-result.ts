import {
  attachDecodedAccessors, decorateDecodedResult, type AbiFunction, type Artifact, type StateValue,
} from '@solidcash/utils';
import { resolveExternalResultEncoding } from './solidityAbi.js';

/** The same public schema projection for authenticated direct reads and decoded VM return values. */
export function decorateFunctionResult(value: StateValue, fn: AbiFunction | undefined, artifact: Artifact): StateValue {
  if (fn?.outputs?.length !== 1) return attachDecodedAccessors(value);
  const type = fn.outputs[0].type;
  return decorateDecodedResult(value, type, artifact.structs ?? artifact.stateLayout?.structs,
    resolveExternalResultEncoding(fn.resultEncoding, artifact, [type], `function '${fn.name}' result`));
}
