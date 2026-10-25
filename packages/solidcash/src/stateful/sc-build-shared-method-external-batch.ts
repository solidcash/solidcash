/**
 * Build one authenticated message-bus route that executes one or more methods of a callee from a single master
 * input.
 *
 * A token invoked by the Router's `transferFrom` and, transitively, the pair's `balanceOf` has one state owner but
 * two returning calls. The callee's own message-bus route already dispatches rows by selector, so the two logical
 * calls become two rows of that route; neither needs a second carrier. A single call to a bus-compiled callee uses
 * the same route with one row, which keeps the callee's direct entry out of the path.
 */

import { binToHex } from '@bitauth/libauth';
import type { AbiFunction, AbiInput, ArgSource, Artifact, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

export type SharedMethodBatchHost = {
  buildRepeatedExternalBatch: (...args: any[]) => any;
};

export type SharedMethodBatchCaller = {
  artifact: Artifact;
  state?: Record<string, unknown>;
  inputs: readonly { name?: string; type: string }[];
  selfAddress?: FunctionArgument;
  identity?: { categoryId: string; lockingBytecode: string };
};

/** One logical call reduced to the row the callee's route dispatches. */
export type MethodBatchCall = { functionName: string; args: readonly FunctionArgument[] };

/** A literal argument source round-trips the already-resolved value through `resolveExternalArgs`. */
function literalSource(value: FunctionArgument, input: AbiInput): ArgSource | undefined {
  if (typeof value === 'bigint') return { kind: 'literal', value: value.toString(), type: 'bigint' };
  if (typeof value === 'boolean') return { kind: 'literal', value: value ? 'true' : 'false', type: 'bool' };
  if (typeof value === 'string') {
    if (input.type === 'string') return { kind: 'literal', value, type: 'string' };
    return /^(?:0x)?[0-9a-f]*$/iu.test(value)
      ? { kind: 'literal', value: value.replace(/^0x/iu, ''), type: input.type } : undefined;
  }
  if (value instanceof Uint8Array) return { kind: 'literal', value: binToHex(value), type: input.type };
  return undefined;
}

/** The callee's published handler for a method, or undefined when the route does not advertise it. */
function eligibleHandler(artifact: Artifact, functionName: string): AbiFunction | undefined {
  const capability = artifact.messageBus;
  const abi = artifact.abi.find((candidate) => candidate.name === functionName);
  if (!capability || abi?.selector === undefined) return undefined;
  const selector = abi.selector.toLowerCase();
  const handler = capability.handlers.find((candidate) => candidate.selector === selector);
  return handler?.eligible ? { ...abi, selector, inputs: handler.inputs } : undefined;
}

/**
 * Build a route for the given calls, or undefined when the callee cannot dispatch them. Every call must name an
 * eligible handler and its resolved arguments must be expressible as literals.
 */
export function buildMethodExternalBatch(
  host: SharedMethodBatchHost,
  calls: readonly MethodBatchCall[],
  callee: { inner: { artifact: Artifact } },
  caller: SharedMethodBatchCaller,
): NonNullable<ExternalCallUtxoGroup['compilerRoute']> | undefined {
  const artifact = callee.inner.artifact;
  const capability = artifact.messageBus;
  if (!capability || capability.version !== 1 || capability.selector !== '53434231'
    || capability.available === false || calls.length === 0) return undefined;
  const rows = calls.map((call, logicalIndex) => {
    const handler = eligibleHandler(artifact, call.functionName);
    if (handler === undefined || handler.inputs.length !== call.args.length) return undefined;
    const argSources = call.args.map((value, index) => literalSource(value, handler.inputs[index]!));
    if (argSources.some((source) => source === undefined)) return undefined;
    return {
      selector: handler.selector,
      logicalIndex,
      inputs: handler.inputs,
      argSources: argSources as ArgSource[],
      occurrence: 'once' as const,
      returnTypes: handler.outputs?.map((output) => output.type) ?? [],
    };
  });
  if (rows.some((row) => row === undefined)) return undefined;
  const synthetic: ExternalCallAbi = {
    interfaceName: artifact.contractName,
    functionName: calls[0]!.functionName,
    occurrence: 'once',
    requiredDataNftIndices: [],
    hasReturnValues: true,
    batchInvocations: rows as NonNullable<ExternalCallAbi['batchInvocations']>,
  };
  try {
    return host.buildRepeatedExternalBatch(
      synthetic,
      [],
      callee,
      caller.artifact,
      caller.state,
      artifact,
      caller.inputs,
      false,
      caller.selfAddress,
      undefined,
      caller.identity,
    ) ?? undefined;
  } catch {
    // A row the route cannot materialize is a limit, not a reason to assemble a second placeholder carrier.
    return undefined;
  }
}

/** A single call to a bus-compiled callee: one route row instead of the callee's direct entry. */
export function buildSingleMethodExternalBatch(
  host: SharedMethodBatchHost,
  call: MethodBatchCall,
  callee: { inner: { artifact: Artifact } },
  caller: SharedMethodBatchCaller,
): NonNullable<ExternalCallUtxoGroup['compilerRoute']> | undefined {
  return buildMethodExternalBatch(host, [call], callee, caller);
}

/**
 * Return a route for `shared` + `next`, or undefined when the callee cannot batch both methods. The route is
 * attached to both logical groups; the shared group owns the physical input.
 */
export function buildSharedMethodExternalBatch(
  host: SharedMethodBatchHost,
  shared: ExternalCallUtxoGroup,
  next: ExternalCallUtxoGroup,
  callee: { inner: { artifact: Artifact } },
  caller: SharedMethodBatchCaller,
): NonNullable<ExternalCallUtxoGroup['compilerRoute']> | undefined {
  if (shared.functionName === next.functionName) return undefined;
  return buildMethodExternalBatch(host, [
    { functionName: shared.functionName, args: shared.functionArgs },
    { functionName: next.functionName, args: next.functionArgs },
  ], callee, caller);
}
