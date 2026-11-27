/**
 * Entry-journal planning helpers.
 *
 * Extracted from `StatefulContract.ts`: pure, artifact-driven planners for the shipped state journal.
 */

import { type FunctionArgument } from '../Argument.js';

export function defaultInternalFunctionArg(input: { name: string; type?: string }): FunctionArgument {
  const { name, type = '' } = input;
  if (name.includes('Selector') || type === 'bytes4') return new Uint8Array(4);
  if (name.includes('Category') || name.includes('BatchSlot')
    || name.includes('BatchNext') || type === 'bytes32') return new Uint8Array(32);
  if (name.includes('valueWitness') || type === 'bytes'
    || (type.startsWith('bytes') && type !== 'bytes4' && type !== 'bytes32')) return new Uint8Array();
  if (name.includes('PredOut')) return -2n;
  if (name.includes('Return') || name.includes('Proof')
    || name.includes('AnchorIdx')
    || name.includes('OutputIdx')) return -1n;
  if (type === 'bool') return false;
  return 0n;
}

/** Materialize one compiler-owned ABI argument without shifting already-populated trailing witnesses. */
export function materializeInternalFunctionArgument(
  args: readonly FunctionArgument[],
  inputs: readonly { name: string; type?: string }[],
  name: string,
  value: FunctionArgument,
): FunctionArgument[] {
  const position = inputs.findIndex((input) => input.name === name);
  if (position < 0) return [...args];
  if (!inputs[position].name.startsWith('__internal__')) {
    throw new Error(`Cannot materialize non-internal ABI argument '${name}'.`);
  }
  const materialized = [...args];
  while (materialized.length <= position) {
    const pending = inputs[materialized.length];
    if (!pending?.name.startsWith('__internal__')) {
      throw new Error(
        `Cannot materialize '${name}' before missing visible ABI argument '${pending?.name ?? materialized.length}'.`,
      );
    }
    materialized.push(defaultInternalFunctionArg(pending));
  }
  materialized[position] = value;
  return materialized;
}
