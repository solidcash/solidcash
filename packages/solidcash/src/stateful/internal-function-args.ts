/**
 * Compiler-owned internal ABI arguments and the vmap counter permutation naming scheme.
 *
 * These helpers are shared by the direct stateful builder: a missing trailing `__internal__` argument is
 * materialized at its canonical default so a void entry's witness slot stays well formed.
 */

import { CALL_RECORD_NO_READER, CALL_RECORD_READER_INPUT } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';

export interface VmapCounterPermutationSpec {
  countName: string;
  boundOffset: bigint;
  postTest: boolean;
  start: bigint;
  step: bigint;
  exactBound?: boolean;
}

export function defaultInternalFunctionArg(input: { name: string; type?: string }): FunctionArgument {
  const { name, type = '' } = input;
  // A witness-filled stride always advances by at least one co-spent input per occurrence. Keeping the sentinel at
  // one reproduces the pre-witness assumption wherever no composed block pins the real width.
  if (name.startsWith('__internal__loopTargetStride')) return 1n;
  // A computed target's lock witness: an empty value matches no co-spent input, so an unreached call fails closed.
  if (name.startsWith('__internal__computedCallTarget')) return new Uint8Array();
  if (name === '__internal__dynamicChunkOutputBase' || name === '__internal__graphSelfIdentityInput') return -1n;
  // A record no contract reads names no input.
  if (name === CALL_RECORD_READER_INPUT) return CALL_RECORD_NO_READER;
  // A synthesized array witness (for example `__internal__loopTargets<n>` for a computed loop target) is
  // carried pushdata-encoded, not as a host array. Its empty value is the zero-length array encoding, which
  // keeps an unreachable call's unlocking script well formed so the covenant's own require can revert.
  if (type.endsWith('[]')) return new Uint8Array([0]);
  if (name.includes('Selector') || type === 'bytes4') return new Uint8Array(4);
  if (name.includes('Category') || name.includes('BatchSlot')
    || name.includes('BatchNext') || type === 'bytes32') return new Uint8Array(32);
  if (name.includes('valueWitness') || type === 'bytes'
    || (type.startsWith('bytes') && type !== 'bytes4' && type !== 'bytes32')) return new Uint8Array();
  if (name.includes('PredOut')) return -2n;
  if (name.includes('Return') || name.includes('Proof')
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

/**
 * Arguments of an unlocker that settles no record of its own, a probe or an outState read: every missing trailing
 * compiler-owned argument at its default, so a void entry's record witness is -1 and needs no output.
 */
export function completeInternalFunctionArguments(
  args: readonly FunctionArgument[],
  inputs: readonly { name: string; type?: string }[],
): FunctionArgument[] {
  const visible = inputs.filter((input) => !input.name.startsWith('__internal__')).length;
  const settlesRecord = inputs.some((input) => input.name === '__internal__returnOutputIdx');
  if (args.length === visible && !settlesRecord) return [...args];
  const completed = [...args];
  while (completed.length < inputs.length && inputs[completed.length].name.startsWith('__internal__')) {
    completed.push(defaultInternalFunctionArg(inputs[completed.length]));
  }
  return completed;
}

export function vmapCounterPermutationSpec(name: string): VmapCounterPermutationSpec | undefined {
  const decodeSigned = (component: string): bigint => (
    component === 'runtime_p' ? 1n
      : component === 'runtime_n' ? -1n
        : component.startsWith('n') ? -BigInt(component.slice(1)) : BigInt(component.slice(1))
  );
  const range = name.match(
    /^__internal__vmapCounterPerm_(.+)_\d+_from_([pn]\d+)_step_([pn]\d+|runtime_[pn])(_post)?$/,
  );
  const affine = name.match(
    /^__internal__vmapCounterPerm_(.+)_\d+_bound_([pn]\d+)(?:_from_([pn]\d+)_step_([pn]\d+|runtime_[pn]))?(_post)?$/,
  );
  if (affine) {
    return {
      countName: affine[1],
      boundOffset: decodeSigned(affine[2]),
      start: affine[3] === undefined ? 0n : decodeSigned(affine[3]),
      step: affine[4] === undefined ? 1n : decodeSigned(affine[4]),
      postTest: affine[5] !== undefined,
    };
  }
  if (range) {
    return {
      countName: range[1],
      boundOffset: 0n,
      start: decodeSigned(range[2]),
      step: decodeSigned(range[3]),
      postTest: range[4] !== undefined,
    };
  }
  const postTest = name.match(/^__internal__vmapCounterPerm_(.+)_\d+_post$/);
  if (postTest) return {
    countName: postTest[1], boundOffset: 0n, postTest: true, start: 0n, step: 1n,
  };
  const preTest = name.match(/^__internal__vmapCounterPerm_(.+)_\d+$/);
  return preTest ? {
    countName: preTest[1], boundOffset: 0n, postTest: false, start: 0n, step: 1n,
  } : undefined;
}
