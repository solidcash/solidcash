/**
 * phase-boundary extract: SC class-body extract — build ethers-style state/call/callStatic/functions/tokens namespaces.
 */

import type { AbiFunction, Artifact, StateValue } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Contract } from '../Contract.js';
import type { StateGetterMap, StateValueType } from '../types/state-inference.js';
import type { AbiToFunctionMap } from '../types/type-inference.js';
import { selectMappingEntryByKeys } from './mapping-key-lookup.js';
import {
  canonicalAbiFunctionSignature,
  visibleHandlerInputs,
} from './route-expression-key.js';
import { resolveStatefulAbiFunction } from './stateful-abi-resolve.js';
import { decorateStateAccessorResult, indexStateAccessorValue } from './public-result.js';
import type { DeployFunctionCall, StatefulFunctionCall, TokenContainerAccessor } from './StatefulContract.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

export interface BuildNamespacesHost<TArtifact extends Artifact = Artifact> {
  state: StateGetterMap<TArtifact>;
  call: Record<string, unknown>;
  functions: Record<string, unknown>;
  callStatic: Record<string, unknown>;
  tokens: { [tokenContainerCategoryIdHex: string]: TokenContainerAccessor };
  getState(): Promise<Record<string, StateValue>>;
  getEntries(collectionNameOrSignature: string): Promise<Array<{
    slot?: Uint8Array;
    key?: bigint | boolean | Uint8Array;
    keys?: Array<bigint | boolean | Uint8Array>;
    value: StateValue;
  }>>;
  createBuilder(functionName: string, args: any[], overrides?: Record<string, unknown>): Promise<StatefulTransactionBuilder>;
  deriveReturnValue(
    functionName: string,
    args: FunctionArgument[],
    calls?: unknown,
    exactAbiFunction?: AbiFunction,
  ): Promise<StateValue>;
  createTokenContainerAccessor(categoryIdHex: string): TokenContainerAccessor;
  createDeployFunctionCall(functionName: string, args: FunctionArgument[]): DeployFunctionCall;
  createStatefulFunctionCall(
    functionName: string,
    args: FunctionArgument[],
    abiFunction: AbiFunction,
  ): StatefulFunctionCall;
}

export function buildNamespaces<TArtifact extends Artifact>(
  host: BuildNamespacesHost<TArtifact>,
  contract: Contract<TArtifact>,
): void {
  host.state = {} as StateGetterMap<TArtifact>;
  for (const variable of contract.stateLayout!.variables) {
    // @ts-ignore - dynamic property assignment for type-safe getters
    // Native addresses retain their locking bytes; Solidity-compatible public getters project only fields
    // whose declared type is address. The raw getState() snapshot must not acquire public-result metadata.
    host.state[variable.name] = async (...indices: Array<bigint | number | string>): Promise<any> => {
      const value = indexStateAccessorValue((await host.getState())[variable.name], indices, variable.name);
      return decorateStateAccessorResult(value as StateValue | undefined, variable.name, indices.length, contract.artifact);
    };
  }
  // Solidity-getter parity for mappings: `sc.<mapping>(...keys)` reads the entry value at the given key(s)
  // (sugar over getEntries), or undefined when no entry exists. Nested/composite keys pass multiple args.
  // For mapping values that are arrays, the remaining arguments index the value, not the mapping key slot.
  for (const coll of contract.stateLayout!.collections ?? []) {
    if (coll.kind !== 'mapping') continue;
    // @ts-ignore - dynamic property assignment (mapping getter takes key args, unlike the scalar getters)
    host.state[coll.name] = async (...keys: Array<bigint | boolean | Uint8Array | string>): Promise<any> => {
      const entries = await host.getEntries(coll.name);
      const keyTypes = coll.keyTypes ?? [coll.keyType];
      const match = selectMappingEntryByKeys(entries, keys.slice(0, keyTypes.length), keyTypes, coll);
      if (match) {
        const value = indexStateAccessorValue(match.value, keys.slice(keyTypes.length), coll.name);
        return decorateStateAccessorResult(value as StateValue, coll.name, keys.length, contract.artifact);
      }
      // Solidity reads a missing mapping key as the value type's zero value, so a bool getter returns false
      // rather than an SDK-level missing value. Strings/bytes must be empty sequences so
      // `bytes(meceTags(tag)).length != 0` treats absent tags as non-MECE.
      const valueType = coll.valueType ?? '';
      if (valueType === 'bool') return false;
      if (/^u?int/.test(valueType) || valueType === 'bigint') return 0n;
      if (valueType === 'string') return '';
      if (valueType === 'bytes' || /^bytes\d+$/.test(valueType)) return new Uint8Array(0);
      return undefined;
    };
  }

  // A deploy-modifier function returns a thenable DeployFunctionCall (funds + runs via the connected signer);
  // every other function returns a StatefulFunctionCall wrapping a lazily-built transaction builder. Mirror
  // Contract.unlock's overload surface: signatures are exact, while a bare name is available only when unique
  // or when visible arity alone selects one overload.
  host.call = {} as AbiToFunctionMap<TArtifact['abi'], StatefulFunctionCall, DeployFunctionCall>;
  host.functions = {} as AbiToFunctionMap<TArtifact['abi'], Promise<StatefulTransactionBuilder>>;
  const groups = new Map<string, AbiFunction[]>();
  for (const abiFunction of contract.artifact.abi) {
    const group = groups.get(abiFunction.name) ?? [];
    group.push(abiFunction);
    groups.set(abiFunction.name, group);
  }
  const signatureOf = canonicalAbiFunctionSignature;
  const visibleArity = (abiFunction: AbiFunction): number => visibleHandlerInputs(abiFunction.inputs).length;
  type NamespaceCall = (...args: any[]) => StatefulFunctionCall | DeployFunctionCall;
  const callerFor = (abiFunction: AbiFunction): NamespaceCall => {
    const caller = abiFunction.modifiers?.includes('deploy')
      ? (...args: any[]): DeployFunctionCall => host.createDeployFunctionCall(
        abiFunction.name, args as FunctionArgument[],
      )
      : (...args: any[]): StatefulFunctionCall => host.createStatefulFunctionCall(
        abiFunction.name, args as FunctionArgument[], abiFunction,
      );
    return caller as NamespaceCall;
  };
  for (const [name, group] of groups) {
    const callers = group.map((abiFunction) => ({ abiFunction, caller: callerFor(abiFunction) }));
    if (group.length > 1) {
      for (const { abiFunction, caller } of callers) {
        (host.call as unknown as Record<string, NamespaceCall>)[signatureOf(abiFunction)] = caller;
        (host.functions as unknown as Record<string, (...args: any[]) => Promise<StatefulTransactionBuilder>>)
          [signatureOf(abiFunction)] = (...args: any[]) => host.createBuilder(
            abiFunction.name, args, { abiFunction },
          );
      }
    }
    const arities = callers.map(({ abiFunction }) => visibleArity(abiFunction));
    const aritySelectsExactly = new Set(arities).size === callers.length;
    const bareCaller: NamespaceCall = group.length === 1
      ? callers[0].caller
      : aritySelectsExactly
        ? (...args: FunctionArgument[]) => {
          const selected = callers.find(({ abiFunction }) => visibleArity(abiFunction) === args.length);
          if (!selected) {
            throw new Error(
              `No overload of function '${name}' accepts ${args.length} arguments. Available signatures: `
              + callers.map(({ abiFunction }) => signatureOf(abiFunction)).join(', '),
            );
          }
          return selected.caller(...args);
        }
        : (..._args: FunctionArgument[]) => {
          throw new Error(
            `Ambiguous call to overloaded function '${name}'. Use explicit signature: `
            + callers.map(({ abiFunction }) => signatureOf(abiFunction)).join(', '),
          );
        };
    (host.call as unknown as Record<string, NamespaceCall>)[name] = bareCaller;
    (host.functions as unknown as Record<string, (...args: any[]) => Promise<StatefulTransactionBuilder>>)[name]
      = (...args: any[]) => {
        const selected = group.length === 1 ? group[0]
          : aritySelectsExactly ? group.find((abiFunction) => visibleArity(abiFunction) === args.length)
            : undefined;
        if (!selected) return Promise.reject(new Error(
          group.length > 1 && !aritySelectsExactly
            ? `Ambiguous call to overloaded function '${name}'. Use explicit signature: `
              + group.map(signatureOf).join(', ')
            : `No overload of function '${name}' accepts ${args.length} arguments.`,
        ));
        return host.createBuilder(selected.name, args, { abiFunction: selected });
      };
  }

  // ethers-v5 `contract.callStatic.fn(...)` read namespace (each fn reads its return value without sending).
  host.callStatic = {};
  const staticNamespace = host.callStatic as Record<string, (...args: FunctionArgument[]) => Promise<StateValueType>>;
  for (const [name, group] of groups) {
    const staticFor = (abiFunction: AbiFunction) => (...args: FunctionArgument[]): Promise<StateValueType> =>
      host.deriveReturnValue(abiFunction.name, args, undefined, abiFunction) as Promise<StateValueType>;
    if (group.length > 1) {
      for (const abiFunction of group) staticNamespace[signatureOf(abiFunction)] = staticFor(abiFunction);
    }
    staticNamespace[name] = (...args: FunctionArgument[]) => {
      const selected = resolveStatefulAbiFunction(contract.artifact, name, args);
      return host.deriveReturnValue(selected.name, args, undefined, selected) as Promise<StateValueType>;
    };
  }

  // Token container sugar (sc.tokens[categoryHex]).
  host.tokens = new Proxy({} as Record<string, TokenContainerAccessor>, {
    get: (_target, prop) => (typeof prop === 'string' ? host.createTokenContainerAccessor(prop) : undefined),
  });
}
