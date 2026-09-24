/**
 * phase-boundary extract: STB public-surface extract — seedOptimisticScalarWrites first-probe scalar state guesses.
 */

import { parsePushdataCommitment, type StateLayout, type StateValue } from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import { isContractUnlocker } from '../interfaces.js';
import {
  canEncodeScalarStateValue,
  fieldNameMatchesArg,
  isIntegerType,
  paramToStateValue,
  permutations,
  scalarTypeKey,
} from './delegate-event-jobevent-helpers.js';
import {
  legacyScalarNameHints,
  permitsLegacyScalarNameHeuristics,
} from './legacy-planning-heuristics.js';

export interface SeedOptimisticScalarWritesHost {
  lastOptimisticPermutationCount: number;
  readonly stateUpdates: ReadonlyMap<string, unknown>;
  readonly stateRawCommitments: ReadonlyMap<number, unknown>;
  readonly masterUtxo: UnlockableUtxo;
  readonly stateLayout: StateLayout;
  readonly requiredNftIndices: readonly number[];
  readonly dataNftUtxos: readonly UnlockableUtxo[];
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  setState(fieldName: string, value: StateValue): void;
}

/**
 * Seed scalar state updates for the first VM probe when no explicit overrides exist: match visible ABI
 * args to fixed fields by name/type, permute ambiguous groups, then apply leftover int/bool heuristics.
 */
export function seedOptimisticScalarWrites(
  host: SeedOptimisticScalarWritesHost,
  permutationIndex: number = 0,
): boolean {
  host.lastOptimisticPermutationCount = 1;
  if (host.stateUpdates.size > 0 || host.stateRawCommitments.size > 0) return false;
  if (!isContractUnlocker(host.masterUtxo.unlocker)) return false;
  const { abiFunction, params } = host.masterUtxo.unlocker;
  if (abiFunction.writesState === false) return false;
  if (abiFunction.entryAccesses && abiFunction.entryAccesses.length > 0) return false;
  const modifiers = abiFunction.modifiers ?? [];
  if (modifiers.includes('view') || modifiers.includes('pure')) return false;

  const visibleInputs = abiFunction.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const fields = host.stateLayout.variables.filter((variable) => !variable.dynamic
    && !variable.name.includes('$')
    && scalarTypeKey(variable.type) !== undefined);
  if (fields.length === 0) return false;

  const currentState: Record<string, StateValue> = {};
  for (let i = 0; i < host.requiredNftIndices.length; i += 1) {
    const nftUtxo = host.dataNftUtxos[i];
    if (!nftUtxo?.token?.nft?.commitment) continue;
    Object.assign(
      currentState,
      parsePushdataCommitment(nftUtxo.token.nft.commitment, host.stateLayout, host.requiredNftIndices[i]),
    );
  }

  const assigned = new Set<string>();
  const usedArgs = new Set<number>();
  const tryAssign = (fieldName: string, argIndex: number): void => {
    if (assigned.has(fieldName) || usedArgs.has(argIndex)) return;
    if (argIndex < 0 || argIndex >= params.length || argIndex >= visibleInputs.length) return;
    const field = fields.find((candidate) => candidate.name === fieldName);
    if (!field) return;
    const value = paramToStateValue(params[argIndex], visibleInputs[argIndex].type);
    if (value === undefined) return;
    if (!canEncodeScalarStateValue(value, field.type)) return;
    host.setState(fieldName, value);
    assigned.add(fieldName);
    usedArgs.add(argIndex);
  };

  const fieldKeys = fields.map((field) => scalarTypeKey(field.type)!);
  const argKeys = visibleInputs.map((input) => scalarTypeKey(input.type));
  visibleInputs.forEach((input, argIndex) => {
    const field = fields.find((candidate) => fieldNameMatchesArg(candidate.name, input.name));
    if (!field || scalarTypeKey(field.type) !== argKeys[argIndex]) return;
    tryAssign(field.name, argIndex);
  });
  const permGroups: Array<{ fields: typeof fields; argIndexes: number[] }> = [];
  for (const key of new Set(fieldKeys)) {
    const matchingFields = fields.filter((field, index) => fieldKeys[index] === key && !assigned.has(field.name));
    const matchingArgs = visibleInputs
      .map((input, index) => ({ input, index }))
      .filter(({ index }) => argKeys[index] === key && !usedArgs.has(index));
    if (matchingFields.length === 1 && matchingArgs.length === 1) {
      tryAssign(matchingFields[0].name, matchingArgs[0].index);
    } else if (matchingFields.length === matchingArgs.length && matchingFields.length > 3) {
      matchingFields.forEach((field, offset) => tryAssign(field.name, matchingArgs[offset].index));
    } else if (matchingFields.length === matchingArgs.length && matchingFields.length >= 2) {
      permGroups.push({ fields: matchingFields, argIndexes: matchingArgs.map((entry) => entry.index) });
    }
  }
  const groupPerms = permGroups.map((group) => permutations(group.argIndexes));
  let permutationCount = groupPerms.reduce((acc, perms) => acc * perms.length, 1);
  if (permutationCount > 8) permutationCount = 1;
  host.lastOptimisticPermutationCount = permutationCount;
  let remaining = ((permutationIndex % permutationCount) + permutationCount) % permutationCount;
  permGroups.forEach((group, groupIndex) => {
    const perms = groupPerms[groupIndex];
    const pick = permutationCount === 1 ? perms[0] : perms[remaining % perms.length];
    remaining = Math.floor(remaining / perms.length);
    group.fields.forEach((field, offset) => tryAssign(field.name, pick[offset]));
  });

  const leftoverInts = fields.filter((field) => !assigned.has(field.name) && isIntegerType(field.type));
  const leftoverBools = fields.filter((field) => !assigned.has(field.name) && field.type === 'bool');
  const unusedIntArgs = visibleInputs
    .map((input, index) => ({ input, index }))
    .filter(({ input, index }) => !usedArgs.has(index) && isIntegerType(input.type));
  // Name-regex leftover probes are legacy-only. Kernel convention uses typed arg→field matching above.
  const allowNameHeuristics = permitsLegacyScalarNameHeuristics(host.messageBusConvention);
  const hints = allowNameHeuristics
    ? legacyScalarNameHints(abiFunction.name)
    : { decrement: false, zero: false, enable: false, disable: false, twice: false };
  // A leftover increment is only a good first-probe guess for a single unassigned counter. Blindly
  // +1-ing every leftover packed field (or zipping a uint256 slot word onto a uint16) aborts
  // derivation when encodePushdataValue rejects the out-of-range value.
  const applyLeftoverInts = hints.zero || hints.decrement || hints.twice
    || (leftoverInts.length === 1 && unusedIntArgs.length === 0);
  const applyLeftoverBools = hints.enable || hints.disable || hints.zero || leftoverBools.length === 1;
  if (applyLeftoverInts) {
    for (const field of leftoverInts) {
      const current = currentState[field.name];
      if (typeof current !== 'bigint') continue;
      // Kernel path: single leftover int may still +1 without a function-name regex.
      const nextInt = hints.zero ? 0n
        : hints.twice ? current * 2n
          : current + (hints.decrement ? -1n : 1n);
      if (!canEncodeScalarStateValue(nextInt, field.type)) continue;
      host.setState(field.name, nextInt);
      assigned.add(field.name);
    }
  }
  if (applyLeftoverBools) {
    for (const field of leftoverBools) {
      const current = currentState[field.name];
      if (typeof current !== 'boolean') continue;
      host.setState(
        field.name,
        hints.enable ? true : (hints.disable || hints.zero) ? false : !current,
      );
      assigned.add(field.name);
    }
  }

  return assigned.size > 0;
}
