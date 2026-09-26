import { encodeDataPush, Opcodes } from '@bitauth/libauth';
import {
  chainCategory,
  encodeTranscript,
  sha256,
  validatorAddress,
  validatorRedeemScript,
  type Transcript,
} from '@solidcash/utils';
import { buildValidatorProgram } from '../../../src/per-call/validator/index.js';

/** A category that is not a repeated byte, so the chain's order differs from the display order. */
export function seededCategory(label: string): Uint8Array {
  return sha256(new TextEncoder().encode(label));
}

/** The validator program a master recognises and a validator input runs. */
export const REAL_VALIDATOR_PROGRAM: Uint8Array = buildValidatorProgram();

/**
 * Accepts the same stack shape as the shipped program and hashes differently.
 *
 * Entry is `[transcript, pin]`. Both are dropped and one truthy item is left, so a master that expected the
 * shipped program's hash refuses the input while the input's own script still succeeds.
 */
export const ALTERNATE_ACCEPTING_PROGRAM = new Uint8Array([Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_1]);

/** The bytes a master's category slot holds: the order `OP_UTXOTOKENCATEGORY` answers in. */
export function categorySlotValue(category: Uint8Array): Uint8Array {
  return chainCategory(category);
}

/** A validator input: its redeem script, the lock over that script, and the unlocking bytecode that spends it. */
export interface ValidatorSpend {
  readonly program: Uint8Array;
  readonly redeem: Uint8Array;
  readonly lock: Uint8Array;
  readonly unlockingBytecode: Uint8Array;
  readonly templateHash: Uint8Array;
}

/**
 * Builds a validator input the shipped program accepts.
 *
 * The redeem script pushes the category pin in the chain's order and then runs the program. The unlocking
 * bytecode carries a real transcript, which the program parses. The token handed to the machine stays in display
 * order; the machine reverses it when it answers, and that answer is what the pin matches.
 */
export function validatorSpend(
  category: Uint8Array,
  transcript: Transcript,
  program: Uint8Array = REAL_VALIDATOR_PROGRAM,
): ValidatorSpend {
  const redeem = validatorRedeemScript(category, program);
  return {
    program,
    redeem,
    lock: validatorAddress(category, program),
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeTranscript(transcript)),
      ...encodeDataPush(redeem),
    ]),
    templateHash: sha256(program),
  };
}
