/**
 * Filling a finished composition's census checkpoints.
 *
 * A validator's census facet leads its unlocking bytecode with the checkpoint its head's settlement walk leaves, and
 * the head requires that push to equal its own (`framedValidator.CENSUS_FACET`). The composer states a placeholder
 * there; once every view and value of the composition is known, each head is run once and the checkpoint it computed
 * is read off the close at which it refuses the placeholder. No input's padding moves a checkpoint, so the inputs
 * are padded to their budgets after this.
 */

import { framedValidator } from '@solidcash/solidc/runtime';
import { concatBytes, encodeMinimalDataPush, splitFirstPush } from '@solidcash/utils';
import { facetId, type PlacedParticipant } from './layout.js';
import type { ShippedVmProgram } from './shipped-host.js';

/**
 * Returns `program` with each validator's census facet leading with the checkpoint its head computes. A head that
 * refuses the transaction for another reason leaves its facet's checkpoint as it was, so that refusal is the verdict.
 */
export function fillCensusCheckpoints(
  program: ShippedVmProgram,
  participants: readonly PlacedParticipant[],
): ShippedVmProgram {
  const transaction = program.transaction;
  if (transaction === undefined) return program;
  let inputs = transaction.inputs;
  for (const head of participants.filter((placed) => placed.kind === 'validator')) {
    const facet = participants.find((placed) => placed.id === facetId(head.id, framedValidator.CENSUS_FACET));
    const unlocking = facet === undefined ? undefined : inputs[facet.index]?.unlockingBytecode;
    if (facet === undefined || unlocking === undefined) continue;
    const { payload: stated, rest } = splitFirstPush(unlocking);
    const computed = framedValidator.validatorCensusCheckpointOf(
      { ...program, inputIndex: head.index, transaction: { ...transaction, inputs } } as never, stated,
    );
    if (computed === undefined) continue;
    inputs = inputs.map((input, index) => (index === facet.index
      ? { ...input, unlockingBytecode: concatBytes([encodeMinimalDataPush(computed), rest]) } : input));
  }
  return inputs === transaction.inputs ? program : { ...program, transaction: { ...transaction, inputs } };
}

/** A transaction a broadcast built, with the outputs its inputs spend. */
export interface BuiltBroadcast {
  readonly transaction: NonNullable<ShippedVmProgram['transaction']>;
  readonly sourceOutputs: ShippedVmProgram['sourceOutputs'];
}

/** How many times a broadcast is laid out again before its checkpoints are taken to have settled. */
const RESTATE_ROUNDS = 3;

/**
 * Lays a broadcast out with census checkpoints of its own. A checkpoint is as wide as the transaction's input and
 * output counts, and a broadcast is not the derived transaction: its caller's change replaces the funders' recreated
 * outputs, and a genesis adds its publication. So `assemble` lays the broadcast out with each census facet leading
 * with the push `restated` names for its input index, or the one the derivation stated, and the checkpoints are taken
 * again over what it built. A push that changes length changes the fee, and with it whether a change output is made,
 * so the broadcast is laid out again until its checkpoints hold.
 */
export function withRestatedCensus<T extends BuiltBroadcast>(
  participants: readonly PlacedParticipant[],
  assemble: (restated: ReadonlyMap<number, Uint8Array>) => T,
): T {
  const restated = new Map<number, Uint8Array>();
  for (let round = 0; round < RESTATE_ROUNDS; round += 1) {
    const built = assemble(restated);
    const program = { inputIndex: 0, sourceOutputs: built.sourceOutputs, transaction: built.transaction };
    const filled = fillCensusCheckpoints(program as ShippedVmProgram, participants);
    if (filled === program) return built;
    filled.transaction!.inputs.forEach((input, index) => {
      if (input !== built.transaction.inputs[index]) restated.set(index, input.unlockingBytecode);
    });
  }
  throw new Error(`the broadcast's census checkpoints did not settle within ${RESTATE_ROUNDS} layouts`);
}
