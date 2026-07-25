import { hexToBin } from '@bitauth/libauth';
import type { AbiFunction, ArgSource, ExternalCallAbi } from '@solidcash/utils';
import { encodeFunctionArguments, type FunctionArgument } from '../Argument.js';
import { Contract } from '../Contract.js';
import { createUnlockingBytecode } from '../utils.js';
import type { BalancedLayout, ExecutionExternalCall } from './covenant.js';

export type NativeTargetRegistry = Record<string, Contract | readonly Contract[]>;
export type DerivedExternalCallTable = ExecutionExternalCall[] & { readonly __compilerDerived: true };

const derivedTables = new WeakSet<object>();
const derivedStatements = new WeakMap<object, ReadonlyMap<number, readonly string[]>>();

/** Runtime guard used by covenant generation to reject manually authored parallel call tables. */
export const isCompilerDerivedExternalCalls = (
  rows: readonly ExecutionExternalCall[],
): rows is DerivedExternalCallTable => derivedTables.has(rows);

/** Compiler-authored native call statements assigned to one physical caller input. */
export const compilerDerivedCallStatements = (
  rows: DerivedExternalCallTable, callerInput: number,
): readonly string[] => derivedStatements.get(rows)?.get(callerInput) ?? [];

export interface DeriveNativeCallsOptions {
  /** Compiled application contract whose function contains the first native callsites. */
  caller: Contract;
  functionName: string;
  /** User-visible runtime arguments of `functionName` (compiler-owned inputs are derived). */
  functionArgs: FunctionArgument[];
  /** Physical input occupied by the caller in the balanced transaction. */
  callerInput: number;
  layout: BalancedLayout;
  /** Interface name -> exact deployed/constructed target. Arrays are consumed in callsite order. */
  targets: NativeTargetRegistry;
}

const abiFunction = (contract: Contract, name: string): AbiFunction => {
  const matches = contract.artifact.abi.filter((fn) => fn.name === name);
  if (matches.length !== 1) {
    throw new Error(`layer3: native derivation requires one unambiguous ABI function '${name}'`);
  }
  return matches[0];
};

const literalArgument = (source: ArgSource): FunctionArgument => {
  if (source.value === undefined || source.type === undefined) {
    throw new Error('layer3: malformed literal external-call argument metadata');
  }
  if (/^(u?int|bigint)/.test(source.type)) return BigInt(source.value);
  if (source.type === 'bool') return source.value === 'true';
  if (/^bytes/.test(source.type)) return hexToBin(source.value);
  if (source.type === 'string') return source.value;
  throw new Error(`layer3: unsupported literal external-call argument type '${source.type}'`);
};

const resolveArguments = (
  ec: ExternalCallAbi, caller: Contract, visibleArgs: FunctionArgument[],
): FunctionArgument[] => (ec.argSources ?? []).map((source) => {
  if (source.kind === 'forward' && source.paramIndex !== undefined) {
    if (source.paramIndex >= visibleArgs.length) {
      throw new Error('layer3: forwarded external-call argument index is out of range');
    }
    return visibleArgs[source.paramIndex];
  }
  if (source.kind === 'constructorArg' && source.paramName) {
    const index = caller.artifact.constructorInputs.findIndex((input) => input.name === source.paramName);
    if (index < 0) throw new Error(`layer3: constructor argument '${source.paramName}' is absent`);
    return caller.constructorArgs[index] as FunctionArgument;
  }
  if (source.kind === 'literal') return literalArgument(source);
  throw new Error(
    `layer3: external-call argument source '${source.kind}' is not statically derivable`,
  );
});

const sourceArgument = (source: ArgSource, callerFn: AbiFunction): string => {
  if (source.kind === 'forward' && source.paramIndex !== undefined) {
    const input = callerFn.inputs.filter((candidate) => !candidate.name.startsWith('__internal__'))[source.paramIndex];
    if (!input) throw new Error('layer3: forwarded source argument index is out of range');
    return input.name;
  }
  if (source.kind === 'constructorArg' && source.paramName) return source.paramName;
  if (source.kind === 'literal' && source.value !== undefined && source.type !== undefined) {
    if (source.type === 'bool' || /^(u?int|bigint)/.test(source.type)) return source.value;
    if (/^bytes/.test(source.type)) return `hex"${source.value}"`;
    if (source.type === 'string') return JSON.stringify(source.value);
  }
  throw new Error(`layer3: external-call source '${source.kind}' cannot be emitted canonically`);
};

const validateCallsite = (ec: ExternalCallAbi): void => {
  if (ec.callMode || ec.loopArrayVar || ec.selectorArrayVar || ec.fnPtrCall || ec.batchInvocations) {
    throw new Error('layer3: dynamic, low-level, pointer, loop, and batch native calls are not derivable in v3');
  }
  if (ec.hasReturnValues || ec.opaqueReturn) {
    throw new Error('layer3: returning native calls require an explicit authenticated result model');
  }
};

/**
 * Derive the complete native-call table from compiler artifacts. Allocation is preorder: a caller's direct
 * callee gets the next physical slot, then that callee's own artifact is recursively expanded. No row fields
 * are accepted from the application, so caller, occurrence, target, selector, arguments, and transitive
 * synthesized co-spend indices cannot diverge from the compiled call graph.
 */
export function deriveNativeExternalCalls(options: DeriveNativeCallsOptions): DerivedExternalCallTable {
  const rows: ExecutionExternalCall[] = [];
  const targetCursors = new Map<string, number>();
  const statements = new Map<number, string[]>();

  const takeTarget = (interfaceName: string): Contract => {
    const registered = options.targets[interfaceName];
    if (!registered) throw new Error(`layer3: no native target registered for interface '${interfaceName}'`);
    if (!Array.isArray(registered)) return registered as Contract;
    const cursor = targetCursors.get(interfaceName) ?? 0;
    const target = registered[cursor];
    if (!target) throw new Error(`layer3: native target list for '${interfaceName}' is exhausted`);
    targetCursors.set(interfaceName, cursor + 1);
    return target;
  };

  const walk = (
    caller: Contract, functionName: string, visibleArgs: FunctionArgument[], callerInput: number,
  ): void => {
    const callerFn = abiFunction(caller, functionName);
    for (const ec of callerFn.externalCalls ?? []) {
      validateCallsite(ec);
      const target = takeTarget(ec.interfaceName);
      const targetFn = abiFunction(target, ec.functionName);
      if (!targetFn.selector) throw new Error('layer3: native target has no ABI selector');
      if (target.artifact.abi.length < 2) {
        throw new Error('layer3: native target must retain runtime selector dispatch');
      }

      const slot = rows.length;
      if (slot >= options.layout.calleeSlots) {
        throw new Error('layer3: compiler-derived native calls exceed the balanced callee slots');
      }
      const targetInput = options.layout.calleeBase(slot);
      rows.push(undefined as unknown as ExecutionExternalCall); // reserve preorder slot before recursion
      const callArgs = resolveArguments(ec, caller, visibleArgs);
      const callSourceArgs = (ec.argSources ?? []).map((source) => sourceArgument(source, callerFn));
      const receiver = ec.addressParam ?? ec.addressLiteral;
      if (!receiver) {
        throw new Error('layer3: native derivation requires a constructor parameter or literal target');
      }
      const receiverExpr = ec.addressParam ? receiver : `hex"${receiver}"`;
      const callerStatements = statements.get(callerInput) ?? [];
      callerStatements.push(
        `${ec.interfaceName}(${receiverExpr}).${ec.functionName}(${callSourceArgs.join(', ')});`,
      );
      statements.set(callerInput, callerStatements);
      const firstChildSlot = rows.length;
      walk(target, ec.functionName, callArgs, targetInput);

      const completeArgs = [...callArgs];
      for (const input of targetFn.inputs.slice(callArgs.length)) {
        if (input.name === '__internal__externalCallInputBase') {
          if (rows.length === firstChildSlot) {
            throw new Error('layer3: callee declares an external-call base without a derived child call');
          }
          completeArgs.push(BigInt(options.layout.calleeBase(firstChildSlot)));
        } else {
          throw new Error(`layer3: unsupported compiler-owned native-call input '${input.name}'`);
        }
      }
      if (targetFn.inputs.some((input) => input.type === 'sig' || input.type === 'datasig')) {
        throw new Error('layer3: signature-bearing native call prefixes are transaction-dependent');
      }
      const structs = target.artifact.structs ?? target.artifact.stateLayout?.structs;
      const encoded = encodeFunctionArguments(targetFn, completeArgs, undefined, structs) as Uint8Array[];
      const prefix = createUnlockingBytecode('p2s', new Uint8Array(), encoded, hexToBin(targetFn.selector));
      rows[slot] = {
        caller: callerInput,
        calleeAddrHex: target.lockingBytecode,
        selectorHex: targetFn.selector,
        callPrefixHex: Array.from(prefix, (byte) => byte.toString(16).padStart(2, '0')).join(''),
      };
    }
  };

  walk(options.caller, options.functionName, options.functionArgs, options.callerInput);
  if (rows.length !== options.layout.calleeSlots) {
    throw new Error(
      `layer3: compiler derived ${rows.length} native calls for ${options.layout.calleeSlots} callee slots`,
    );
  }
  for (const row of rows) Object.freeze(row);
  const frozenRows = Object.freeze(rows) as unknown as DerivedExternalCallTable;
  const frozenStatements = new Map<number, readonly string[]>();
  for (const [caller, body] of statements) frozenStatements.set(caller, Object.freeze(body));
  derivedTables.add(frozenRows);
  derivedStatements.set(frozenRows, frozenStatements);
  return frozenRows;
}
