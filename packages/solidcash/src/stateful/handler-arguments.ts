import type { Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';

/** Direct entries use their source ABI arguments unchanged. */
export function projectHandlerArguments(
  _artifact: Artifact,
  _functionName: string,
  _selector: string | undefined,
  args: readonly FunctionArgument[],
): FunctionArgument[] {
  return [...args];
}
