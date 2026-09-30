/**
 * Resolving what an implementation entry's published call sites target, carry and run as.
 *
 * The artifact publishes each call site's routing — the interface and method it reaches, where its target address
 * comes from (`addressLiteral`, a state field, or an `addressSource` built from the entry's own arguments and
 * state), and where each argument comes from (`argSources`). A hop's delegate frame is a body like any other, so
 * the plan has to state the call data its body will push: the selector, then each argument's canonical push.
 *
 * The routing is resolved the way the SDK's other external-call paths resolve it: a forwarded parameter, a literal,
 * the frame's own `msg.sender` or `address(this)`, an array element at the reached occurrence, and any expression
 * the compiler serialized, evaluated against the caller's arguments and its own state by the shared expression
 * evaluator. What cannot be resolved from facts a plan holds — a value only the running execution computes, a
 * producer result from an earlier call, a target no route names — is refused by name rather than guessed at.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  FrameKind,
  type ArgSource,
  type Artifact,
  type ExternalCallAbi,
  type ExternalCallExpression,
  type FrameKindValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import {
  evaluateExternalExpression, type EvaluateExternalExpressionHost,
} from '../../stateful/sc-evaluate-external-expression.js';
import { addressToLockScript } from '../../utils.js';
import { PerCallProxyDeployError } from './errors.js';

/** The ABI fields one entry is read from, on the caller or the callee side. */
export interface AbiEntryRow {
  readonly name: string;
  readonly selector?: string;
  readonly inputs: readonly { readonly name: string; readonly type: string }[];
  readonly outputs?: readonly { readonly type: string }[];
  readonly modifiers?: readonly string[];
  readonly externalCalls?: readonly unknown[];
}

/** One artifact's entry row, refusing an entry the artifact does not publish. */
export function entryRowOf(artifact: Artifact, functionName: string): AbiEntryRow {
  const row = artifact.abi.find((candidate) => candidate.name === functionName);
  if (row === undefined) {
    throw new PerCallProxyDeployError(
      `contract "${artifact.contractName}" publishes no entry "${functionName}"`,
    );
  }
  return row as AbiEntryRow;
}

/** The caller-side facts a published call site is resolved from. */
export interface HopCallInputs {
  readonly artifact: Artifact;
  readonly functionName: string;
  /** The entry's own arguments, in parameter order, as the caller supplied them. */
  readonly args: readonly FunctionArgument[];
  /** The caller's own state, keyed by field name, as its body reads it. */
  readonly stateValues: Readonly<Record<string, unknown>>;
  /** The caller's own locking bytecode, i.e. `address(this)` as the frame observes it. */
  readonly selfAddress?: Uint8Array;
  /** The frame's own `msg.sender`. */
  readonly senderAddress?: Uint8Array;
  /** The caller's constructor arguments, when a routing forwards one. */
  readonly constructorArgs?: readonly FunctionArgument[];
}

/** One published call site resolved to what a plan states. */
export interface ResolvedCall {
  readonly target: Uint8Array;
  readonly argumentPushes: readonly Uint8Array[];
  /** The argument values in parameter order, before encoding, which a nested callee's own plan reads. */
  readonly argumentValues: readonly FunctionArgument[];
  readonly kind: FrameKindValue;
}

/**
 * The resolvers a caller resolves a site's target and arguments with.
 *
 * `resolve` reads one argument source, and `evaluate` reports whether an expression holds under a set of loop
 * bindings — which is how a repeated site's reached count is read from the caller's own arguments.
 */
export interface CallResolver {
  resolve(source: ArgSource, occurrence: number): FunctionArgument | undefined;
  evaluate(
    expression: ExternalCallExpression,
    occurrence: number,
    bindings?: ReadonlyMap<string, FunctionArgument>,
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
  ): FunctionArgument | undefined;
}

/** One argument as a routing serialized it, in the form the shared encoder takes. */
function literalArgument(value: string, type: string): FunctionArgument {
  if (type === 'bool') return value === 'true' || value === '1';
  if (type === 'string') return value;
  if (type.startsWith('bytes') || type === 'address') return new Uint8Array(hexToBin(value));
  return BigInt(value);
}

/** An address value as its locking bytecode, or undefined when it is not one. */
function addressBytes(value: FunctionArgument | undefined): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value.length === 0 ? undefined : value;
  if (typeof value === 'string') {
    try {
      return addressToLockScript(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * True when a resolved argument names the zero address: an empty or all-zero byte string.
 *
 * Nothing can sit at the zero address, so it is never a deployment the hop could place a callee on. Unlike a value
 * the resolver cannot state at all, it is a value the caller's own facts do name, which is why the two are read
 * apart.
 */
function isZeroAddress(value: FunctionArgument | undefined): boolean {
  return value instanceof Uint8Array && value.every((byte) => byte === 0);
}

/**
 * Builds the resolvers one entry's call sites are read with.
 *
 * Every value comes from the caller's own facts — its arguments, its state and its frame's addresses — so a
 * resolver never reaches a live deployment. The expression evaluator is the SDK's own, so a compiler-serialized
 * expression means the same thing here as on a direct call: an inline pure helper, a struct constructor, a packed
 * encoding, a state read, or arithmetic over them.
 */
export function makeCallResolver(inputs: HopCallInputs): CallResolver {
  const callerInputs = entryRowOf(inputs.artifact, inputs.functionName)
    .inputs.map((input) => ({ type: input.type }));

  const resolve = (source: ArgSource, occurrence: number): FunctionArgument | undefined => {
    switch (source.kind) {
      case 'forward':
        return source.paramIndex === undefined ? undefined : inputs.args[source.paramIndex];
      case 'constructorArg': {
        if (source.paramName === undefined) return undefined;
        const index = inputs.artifact.constructorInputs.findIndex((input) => input.name === source.paramName);
        return index < 0 ? undefined : inputs.constructorArgs?.[index];
      }
      case 'literal':
        return source.value === undefined || source.type === undefined
          ? undefined : literalArgument(source.value, source.type);
      case 'msgSender':
        return inputs.senderAddress;
      case 'selfAddress':
        return inputs.selfAddress;
      case 'arrayElement': {
        const array = source.paramIndex === undefined ? undefined : inputs.args[source.paramIndex];
        if (!Array.isArray(array)) return undefined;
        let index = (source.indexValue ?? 0) + (source.indexStepValue ?? 0) * occurrence;
        if (source.indexParamIndex !== undefined) {
          const raw = inputs.args[source.indexParamIndex];
          if (typeof raw !== 'bigint' && typeof raw !== 'number') return undefined;
          index = Number(raw);
        }
        return index < 0 || index >= array.length ? undefined : array[index] as FunctionArgument;
      }
      case 'loopIndex': {
        if (source.initialValue === undefined) return undefined;
        const step = source.stepValue === undefined ? 1n : BigInt(source.stepValue);
        return BigInt(source.initialValue) + step * BigInt(occurrence);
      }
      case 'expression':
        return source.expression === undefined ? undefined : evaluate(source.expression, occurrence);
      default:
        return undefined;
    }
  };

  const host: EvaluateExternalExpressionHost = {
    resolveExternalArgs(
      sources, _functionArgs, _artifact, _state, _callerInputs, _externalReturns,
      occurrenceIndex = 0, _stateIncludesPriorWrites, executionSelfAddress,
    ): FunctionArgument[] | undefined {
      if (sources === undefined) return undefined;
      const resolved: FunctionArgument[] = [];
      for (const source of sources) {
        const value = source.kind === 'selfAddress' && executionSelfAddress !== undefined
          ? executionSelfAddress
          : resolve(source, occurrenceIndex);
        if (value === undefined) return undefined;
        resolved.push(value);
      }
      return resolved;
    },
  };

  const evaluate = (
    expression: ExternalCallExpression,
    occurrence: number,
    bindings?: ReadonlyMap<string, FunctionArgument>,
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
  ): FunctionArgument | undefined => evaluateExternalExpression(
    host, expression, [...inputs.args], inputs.artifact, inputs.stateValues, callerInputs,
    externalReturns, occurrence, false, inputs.selfAddress, bindings,
  );

  return {
    resolve: (source, occurrence) => resolve(source, occurrence),
    evaluate,
  };
}

/**
 * The address one call reaches, or `undefined` when its own source names the zero address.
 *
 * The routing names it one of four ways: a literal the compiler baked in, a state field the entry holds, an
 * `addressSource` (a forwarded parameter, a cast, a computation over the entry's own state), or the named
 * `addressParam` a caller forwards. A target no route names is refused by name; a target the route names as the
 * zero address is reported as `undefined`, because nothing can sit there and the hop states no callee for it.
 */
export function resolveCallTarget(
  row: ExternalCallAbi, inputs: HopCallInputs, resolver: CallResolver, occurrence: number,
): Uint8Array | undefined {
  const where = `the call to "${row.interfaceName}.${row.functionName}"`;
  if (row.addressLiteral !== undefined && row.addressLiteral.length > 0) {
    return new Uint8Array(hexToBin(row.addressLiteral));
  }
  if (row.addressStateVar !== undefined) {
    const bytes = addressBytes(inputs.stateValues[row.addressStateVar] as FunctionArgument | undefined);
    if (bytes !== undefined) return bytes;
    throw new PerCallProxyDeployError(
      `${where} targets the state field "${row.addressStateVar}", which the caller's own state does not hold as `
      + 'an address',
    );
  }
  if (row.addressSource !== undefined) {
    const resolved = resolver.resolve(row.addressSource, occurrence);
    if (isZeroAddress(resolved)) return undefined;
    const bytes = addressBytes(resolved);
    if (bytes !== undefined) return bytes;
    throw new PerCallProxyDeployError(
      `${where} computes its target from a "${row.addressSource.kind}" source the hop cannot resolve to an address`,
    );
  }
  if (row.addressParam !== undefined) {
    const index = entryRowOf(inputs.artifact, inputs.functionName)
      .inputs.findIndex((input) => input.name === row.addressParam);
    const bytes = index < 0 ? undefined : addressBytes(inputs.args[index]);
    if (bytes !== undefined) return bytes;
  }
  throw new PerCallProxyDeployError(
    `${where} publishes no target address the hop can read (no literal, state field or resolvable source)`,
  );
}

/**
 * The argument pushes one call carries: the selector, then each argument's canonical push, the last parameter's
 * first.
 *
 * The pushes become the record's digest and the callee's call data alike, so each is encoded the way the callee's
 * own ABI decodes it: against the declared input type, with the artifact's structs. An argument no source resolves
 * from the caller's own facts is refused, because the plan would have no value to state.
 */
export function resolveCallArguments(
  row: ExternalCallAbi,
  calleeArtifact: Artifact,
  calleeEntry: AbiEntryRow,
  resolver: CallResolver,
  occurrence: number,
): { readonly pushes: readonly Uint8Array[]; readonly values: readonly FunctionArgument[] } {
  const where = `the call to "${row.interfaceName}.${row.functionName}"`;
  const visible = calleeEntry.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const sources = row.argSources ?? [];
  if (sources.length !== visible.length) {
    throw new PerCallProxyDeployError(
      `${where} takes ${visible.length} argument(s), but the artifact publishes sources for ${sources.length}, so `
      + 'the hop cannot state their digest',
    );
  }
  const selector = calleeEntry.selector;
  if (selector === undefined) {
    throw new PerCallProxyDeployError(
      `the callee entry "${calleeEntry.name}" publishes no selector, so the call carries no call data`,
    );
  }
  const values = sources.map((source, index): FunctionArgument => {
    const value = resolver.resolve(source, occurrence);
    if (value === undefined) {
      throw new PerCallProxyDeployError(
        `${where} passes argument ${index} from a "${source.kind}"${source.expression === undefined ? '' : ` `
          + `expression of kind "${source.expression.kind}"`}, which the hop cannot resolve from the caller's own `
        + 'arguments and state',
      );
    }
    return value;
  });
  const encoded = values.map((value, index): Uint8Array => {
    const push = encodeFunctionArgument(value, visible[index]!.type, calleeArtifact.structs);
    if (!(push instanceof Uint8Array)) {
      throw new PerCallProxyDeployError(
        `${where} passes a signature as argument ${index}, which a record's digest cannot state`,
      );
    }
    return push;
  });
  return { pushes: [new Uint8Array(hexToBin(selector)), ...[...encoded].reverse()], values };
}

/** The frame kind the caller's own code pins for a call: a `view` or `pure` callee runs as a `STATIC` frame. */
export function frameKindOf(entry: AbiEntryRow): FrameKindValue {
  const readOnly = (entry.modifiers ?? []).some((modifier) => modifier === 'view' || modifier === 'pure');
  return readOnly ? FrameKind.STATIC : FrameKind.CALL;
}

/** One call site resolved end to end, from the routing and the callee's own entry. */
export function resolvePublishedCall(
  row: ExternalCallAbi,
  calleeArtifact: Artifact,
  inputs: HopCallInputs,
  resolver: CallResolver,
  occurrence: number,
): ResolvedCall {
  const calleeEntry = entryRowOf(calleeArtifact, row.functionName);
  const { pushes, values } = resolveCallArguments(row, calleeArtifact, calleeEntry, resolver, occurrence);
  const target = resolveCallTarget(row, inputs, resolver, occurrence);
  if (target === undefined) {
    // A site whose target names the zero address is stated for nothing, so no caller reaches here for one.
    throw new PerCallProxyDeployError(
      `the call to "${row.interfaceName}.${row.functionName}" names the zero address, so the hop states no callee`,
    );
  }
  return {
    target,
    argumentPushes: pushes,
    argumentValues: values,
    kind: frameKindOf(calleeEntry),
  };
}
