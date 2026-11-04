import {
  attachDecodedAccessors, decorateDecodedResult, parseArrayTypeString,
  type AbiFunction, type Artifact, type StateValue,
} from '@solidcash/utils';
import {
  artifactAddressForm, artifactUsesSolidityAbi, externalResultUsesEvmWords, resolveExternalResultEncoding,
} from './solidityAbi.js';

/** The same public schema projection for authenticated direct reads and decoded VM return values. */
export function decorateFunctionResult(value: StateValue, fn: AbiFunction | undefined, artifact: Artifact): StateValue {
  if (fn?.outputs?.length !== 1) return attachDecodedAccessors(value);
  const type = fn.outputs[0].type;
  return decorateDecodedResult(value, type, artifact.structs ?? artifact.stateLayout?.structs,
    resolveExternalResultEncoding(fn.resultEncoding, artifact, [type], `function '${fn.name}' result`),
    artifactAddressForm(artifact));
}

/** Apply array indices after the authenticated state variable or mapping entry has been selected. */
export function indexStateAccessorValue(value: unknown, indices: readonly unknown[], name: string): unknown {
  let selected = value;
  for (const rawIndex of indices) {
    if (!Array.isArray(selected)) throw new Error(`State variable '${name}' is not indexable at this depth.`);
    const index = typeof rawIndex === 'number'
      ? rawIndex
      : typeof rawIndex === 'bigint' || (typeof rawIndex === 'string' && /^-?\d+$/.test(rawIndex))
        ? Number(rawIndex)
        : Number.NaN;
    if (!Number.isSafeInteger(index) || index < 0 || index >= selected.length) {
      throw new Error(`Array index ${String(rawIndex)} is out of bounds for '${name}'.`);
    }
    selected = selected[index];
  }
  return selected;
}

/**
 * State accessors already decoded the storage representation; the value is presented as its getter's result travels
 * (`externalResultUsesEvmWords`), so a direct read and a call answer one form. Apply the declared value schema and
 * compiler's address semantics to a public copy, including indexed arrays and mappings which have no generated ABI
 * getter. Raw state/entry APIs keep their storage bytes unchanged.
 */
export function decorateStateAccessorResult(
  value: StateValue | undefined,
  name: string,
  indexCount: number,
  artifact: Artifact,
  resolveDeployedAddress?: (identity: Uint8Array) => string | undefined,
): StateValue | undefined {
  if (value === undefined) return value;
  const variable = artifact.stateLayout?.variables.find((entry) => entry.name === name);
  const mapping = artifact.stateLayout?.collections?.find((entry) => (
    entry.name === name && entry.kind === 'mapping'
  ));
  let type = variable?.type ?? mapping?.valueType;
  if (type === undefined) return value;
  const arrayIndexCount = variable ? indexCount : indexCount - (mapping?.keyTypes?.length ?? 1);
  for (let index = 0; index < arrayIndexCount; index += 1) {
    const array = parseArrayTypeString(type);
    if (!array) throw new Error(`State variable '${name}' is not indexable at this depth.`);
    type = array.elementType;
  }
  // The value answers as its getter's result travels (`externalResultUsesEvmWords`): ABI words, whose address is the
  // 20-byte identity, or compact pushdata, which keeps the stored locking bytecode under `addressForm: 'bytecode'`.
  const decorated = decorateDecodedResult(value, type, artifact.structs ?? artifact.stateLayout?.structs,
    externalResultUsesEvmWords(artifact, [type]) ? 'evm-abi-v1' : 'compact-pushdata-v1', artifactAddressForm(artifact));
  // An unmodified Solidity test compares a `public address` getter with `contract.getAddress()`, which names the
  // deployed contract, and hands it to `getContractAt`, so present the registered deployment's address when the
  // value names one: the 20-byte identity, or under `evmCompat` the whole lock `addressForm: 'bytecode'` keeps. Any
  // other address keeps its form (an account's whole lock), and raw `getState()`/entry reads keep their storage form.
  if (type === 'address' && resolveDeployedAddress !== undefined && decorated instanceof Uint8Array
    && (decorated.length === 20 || (artifactUsesSolidityAbi(artifact) && decorated.length > 0))) {
    const resolved = resolveDeployedAddress(decorated);
    if (resolved !== undefined) return resolved;
  }
  return decorated;
}
