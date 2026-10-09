/**
 * phase-boundary extract: SC class-body extract — rebuild a repeated external-call batch row after argument rewrite.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { encodeFunctionArgument } from '../Argument.js';
import { encodeMessageBusArguments, inactiveMessageBusRouteWitness } from '../message-bus/message-bus.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { functionArgumentListsEqual } from './graph-planning-producer-result.js';

export interface ReplaceRepeatedExternalBatchRowHost {
  concatBytes(...parts: Uint8Array[]): Uint8Array;
  uintLe(value: bigint, width: number): Uint8Array;
  signedLogicalValue(value: bigint): Uint8Array;
}

/**
 * Locate the last batch row matching `previousArgs`, rewrite it with `nextArgs`, and rebuild the
 * positional SCB1 blob + route witnesses. Returns undefined when the capability cannot encode the rewrite.
 */
export function replaceRepeatedExternalBatchRow(
  host: ReplaceRepeatedExternalBatchRowHost,
  route: NonNullable<ExternalCallUtxoGroup['compilerRoute']>,
  previousArgs: readonly FunctionArgument[],
  nextArgs: readonly FunctionArgument[],
  calleeArtifact: Artifact,
  routeMsgSender: FunctionArgument,
): NonNullable<ExternalCallUtxoGroup['compilerRoute']> | undefined {
  const capability = calleeArtifact.messageBus;
  if (!capability || !route.rowArguments) return undefined;
  const rowIndex = route.rowArguments.findLastIndex((row) => (
    functionArgumentListsEqual(row.args, previousArgs)
  ));
  if (rowIndex < 0) return undefined;
  const rowArguments = route.rowArguments.map((row, index) => (
    index === rowIndex ? { ...row, args: [...nextArgs] } : row
  ));
  const structs = calleeArtifact.structs ?? calleeArtifact.stateLayout?.structs;
  const valueMode = capability.handlers.some((handler) => handler.eligible && handler.usesMsgValue);
  const keyWitnessValues = new Map<string, FunctionArgument>();
  const encodedRows = rowArguments.map((row, logicalIndex) => {
    const handler = capability.handlers.find((candidate) => candidate.selector === row.selector);
    if (!handler?.eligible || handler.inputs.length !== row.args.length) return undefined;
    const encoded = row.args.map((argument, index) => (
      encodeFunctionArgument(argument, handler.inputs[index].type, structs)
    ));
    if (encoded.some((argument) => !(argument instanceof Uint8Array))) return undefined;
    for (const binding of handler.batchKeyWitnesses ?? []) {
      const routeInput = binding.perRow ? `${binding.routeInput}_r${logicalIndex}` : binding.routeInput;
      keyWitnessValues.set(
        routeInput,
        binding.source === 'msgSender' ? routeMsgSender : row.args[binding.inputIndex],
      );
    }
    let logicalValue = 0n;
    if (handler.usesMsgValue) {
      for (const transfer of handler.transfers ?? []) {
        if (transfer.amount.kind === 'forward' && transfer.amount.paramIndex !== undefined
          && typeof row.args[transfer.amount.paramIndex] === 'bigint') {
          logicalValue -= row.args[transfer.amount.paramIndex] as bigint;
        } else if (transfer.amount.kind === 'literal' && transfer.amount.value !== undefined) {
          logicalValue -= BigInt(transfer.amount.value);
        } else {
          return undefined;
        }
      }
    }
    const argsBlob = encodeMessageBusArguments(
      encoded as Uint8Array[], handler.inputs.map((input) => input.type), structs,
    );
    return host.concatBytes(
      hexToBin(row.selector),
      host.uintLe(BigInt(logicalIndex), 4),
      host.uintLe(0n, 2),
      host.uintLe(BigInt(argsBlob.length), 2),
      ...(valueMode ? [host.signedLogicalValue(logicalValue)] : []),
      argsBlob,
    );
  });
  if (encodedRows.some((row) => row === undefined)) return undefined;
  const blob = host.concatBytes(
    hexToBin('53434231'),
    Uint8Array.from([1, valueMode ? 1 : 0, rowArguments.length]),
    ...encodedRows as Uint8Array[],
  );
  if (blob.length > capability.maximumBlobBytes) return undefined;
  const witnessInputs = capability.route.inputs
    .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'));
  const previousWitnesses = new Map(witnessInputs.map(
    (input, index) => [input.name, route.args[index + 1]],
  ));
  const witnesses = witnessInputs.map((input) => (
    keyWitnessValues.get(input.name) ?? previousWitnesses.get(input.name)
    ?? inactiveMessageBusRouteWitness(input.type)
  ));
  return {
    ...route,
    blob,
    args: [blob, ...witnesses],
    rowArguments,
  };
}
