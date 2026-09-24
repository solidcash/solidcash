/**
 * phase-boundary extract: bind compiler-identified returning call expressions to authenticated results
 * (phase-boundary extract from StatefulContract.ts).
 */

import type {
  ArgSource,
  ExternalCallAbi,
  ExternalCallExpression,
  ExternalResultConsumerAbi,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';

export function externalReturnsForCallsites(
  argSources: readonly ArgSource[] | undefined,
  results: ReadonlyMap<number, FunctionArgument>,
  producerCalls: readonly ExternalCallAbi[],
  consumer?: {
    callsiteId: number;
    resultConsumers?: readonly ExternalResultConsumerAbi[];
  },
): Map<string, FunctionArgument> {
  const resolved = new Map<string, FunctionArgument>();
  const producerById = new Map<number, ExternalCallAbi>();
  for (const producer of producerCalls) {
    if (producer.callsiteId === undefined || producer.callsiteId < 0) {
      throw new Error('Graph external-call metadata requires a nonnegative callsiteId for every producer.');
    }
    if (producerById.has(producer.callsiteId)) {
      throw new Error(`Graph external-call metadata has duplicate callsiteId ${producer.callsiteId}.`);
    }
    producerById.set(producer.callsiteId, producer);
  }
  if (consumer?.resultConsumers) {
    const lanes = new Set<string>();
    for (const lane of consumer.resultConsumers) {
      if (!Number.isInteger(lane.consumerCallsiteId) || lane.consumerCallsiteId < 0
        || ('argument' in lane && (!Number.isInteger(lane.argument) || lane.argument! < 0))
        || (!('argument' in lane) && lane.condition !== true)
        || !Number.isInteger(lane.producerCallsiteId) || lane.producerCallsiteId < 0) {
        throw new Error('Graph result-consumer metadata requires nonnegative integer callsite and argument lanes.');
      }
      const producer = producerById.get(lane.producerCallsiteId);
      if (!producer) {
        throw new Error(
          `Graph result-consumer metadata references missing producer callsite ${lane.producerCallsiteId}.`,
        );
      }
      if (lane.resultIndex !== undefined && (!Number.isInteger(lane.resultIndex) || lane.resultIndex < 0
        || lane.resultIndex >= (producer.returnTypes?.length ?? 0))) {
        throw new Error(
          `Graph result-consumer metadata has invalid result index ${String(lane.resultIndex)} for producer `
          + `${lane.producerCallsiteId}.`,
        );
      }
      const key = `${lane.consumerCallsiteId}:${lane.argument}:${lane.producerCallsiteId}`
        + `:${lane.resultIndex ?? '*'}`;
      if (lanes.has(key)) throw new Error(`Graph result-consumer metadata has duplicate lane ${key}.`);
      lanes.add(key);
    }
  }
  const visit = (expression: ExternalCallExpression | undefined, argument: number): void => {
    if (!expression) return;
    for (const child of [expression.target, expression.expression, expression.left, expression.right,
      expression.condition, expression.ifTrue, expression.ifFalse]) visit(child, argument);
    for (const child of expression.args ?? []) visit(child, argument);
    if (expression.kind === 'producerResult' && expression.callsiteId !== undefined) {
      const producer = producerById.get(expression.callsiteId);
      const resultIndex = expression.resultIndex;
      if (!producer || resultIndex === undefined || !Number.isInteger(resultIndex)
        || resultIndex < 0 || resultIndex >= (producer.returnTypes?.length ?? 0)) {
        throw new Error(
          `Graph producerResult ${expression.callsiteId}:${String(resultIndex)} does not identify one published result.`,
        );
      }
      if (consumer?.resultConsumers) {
        const lanes = consumer.resultConsumers.filter((lane) =>
          lane.consumerCallsiteId === consumer.callsiteId && lane.argument === argument
          && lane.producerCallsiteId === expression.callsiteId
          && (lane.resultIndex === undefined || lane.resultIndex === resultIndex));
        if (lanes.length !== 1) {
          throw new Error(
            `Graph producerResult ${expression.callsiteId}:${resultIndex} does not identify exactly one `
            + `published consumer lane ${consumer.callsiteId}:${argument}.`,
          );
        }
      }
      const result = results.get(expression.callsiteId);
      if (result !== undefined && (producer.returnTypes?.length ?? 0) > 1
        && (!Array.isArray(result) || result.length !== producer.returnTypes!.length)) {
        throw new Error(
          `Authenticated graph result for producer ${expression.callsiteId} does not match its `
          + `${producer.returnTypes!.length}-component schema.`,
        );
      }
      const selected = (producer.returnTypes?.length ?? 0) === 1
        ? result : Array.isArray(result) ? result[resultIndex] as FunctionArgument : undefined;
      if (selected !== undefined) resolved.set(JSON.stringify(expression), selected);
      return;
    }
    if (expression.kind !== 'externalCall' || expression.callsiteId === undefined) return;
    const result = results.get(expression.callsiteId);
    if (result !== undefined) resolved.set(JSON.stringify(expression), result);
  };
  for (const [argument, source] of (argSources ?? []).entries()) visit(source.expression, argument);
  return resolved;
}



