/**
 * The lock a value send pays, read from the recipe its artifact publishes, before the frame runs.
 *
 * A body pays a user's lock as a listed send and any other lock through a call into the recipient's `receive()`,
 * choosing by the lock's length (spec 4b), so a call path resolves each recipient first to tell the two apart. A
 * recipe only the running code can evaluate leaves the recipient unresolved, and the frame learns its lock from the
 * body's own pin.
 */

import { hexToBin } from '@bitauth/libauth';
import type { ChildDeploymentValueRecipe, StateValue, StructDefinitionInfo } from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';

/** What a send's recipe reads, before the frame runs. */
export interface RecipientContext {
  readonly args: readonly FunctionArgument[];
  readonly inputs: readonly { readonly type: string }[];
  readonly structs: readonly StructDefinitionInfo[] | undefined;
  readonly callerLock: Uint8Array;
  readonly state: readonly Record<string, StateValue>[];
}

/** The lock a send pays, from its published recipe, or undefined when only the running code holds it. */
export function sendRecipient(
  recipe: ChildDeploymentValueRecipe | undefined, context: RecipientContext,
): Uint8Array | undefined {
  switch (recipe?.kind) {
    case 'logicalCaller':
      return context.callerLock;
    case 'handlerInput': {
      const argument = context.args[recipe.inputIndex];
      const input = context.inputs[recipe.inputIndex];
      if (argument === undefined || input === undefined) return undefined;
      return argument instanceof Uint8Array
        ? argument
        : encodeFunctionArgument(argument, input.type, context.structs) as Uint8Array;
    }
    case 'bytesLiteral':
      return hexToBin(recipe.value);
    case 'cast':
      return sendRecipient(recipe.operand, context);
    case 'state': {
      const held = context.state.find((values) => values[recipe.name] instanceof Uint8Array);
      return held?.[recipe.name] as Uint8Array | undefined;
    }
    default:
      return undefined;
  }
}
