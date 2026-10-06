import { binToHex, encodeDataPush, Opcodes } from '@bitauth/libauth';
import {
  chainCategory,
  encodeTranscript,
  sha256,
  validatorAddress,
  validatorRedeemScript,
  type Transcript,
} from '@solidcash/utils';
import { buildValidatorFacets, buildValidatorProgram, validatorFacetSpends } from '../../../src/framed/validator/index.js';
import { stateRecordLockingBytecode } from '../../../../solidcash/src/framed/deploy/index.js';

/** A category that is not a repeated byte, so the chain's order differs from the display order. */
export function seededCategory(label: string): Uint8Array {
  return sha256(new TextEncoder().encode(label));
}

/** The lock a contract's data record sits at: the data-NFT covenant for its category, which the master pins. */
export function dataRecordLock(category: Uint8Array): Uint8Array {
  return stateRecordLockingBytecode(binToHex(category));
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

/** The value a facet UTXO holds; the head requires the output that recreates it to be worth at least as much. */
export const FACET_VALUE = 10_000n;

/** One facet as a hand-laid transaction states it: the input at `head + k` and the output that recreates it. */
export interface ValidatorFacetPlacement {
  readonly input: {
    readonly outpointIndex: number;
    readonly outpointTransactionHash: Uint8Array;
    readonly sequenceNumber: number;
    readonly unlockingBytecode: Uint8Array;
  };
  readonly output: { readonly lockingBytecode: Uint8Array; readonly valueSatoshis: bigint };
}

/** The facet spends the shipped head holds directly after it, in order. */
const VALIDATOR_FACETS = validatorFacetSpends(buildValidatorFacets());

/**
 * The facets a hand-laid validator carries directly after its head, in order.
 *
 * The head binds each facet's lock as a constant and requires the input and the output at `head + k` to be that
 * lock, the output worth at least the input, so a fixture places these immediately after the validator input and
 * recreates each at its own index. A hand-laid transaction that evaluates the validator input needs them.
 */
export function validatorFacetPlacements(valueSatoshis: bigint = FACET_VALUE): readonly ValidatorFacetPlacement[] {
  return VALIDATOR_FACETS.map((facet, at) => ({
    input: {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(0xf0 + at),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: facet.unlockingBytecode,
    },
    output: { lockingBytecode: facet.lock, valueSatoshis },
  }));
}

/** How many inputs a hand-laid validator occupies: its head plus the facets the head binds. */
export const VALIDATOR_INPUT_SPAN = 1 + VALIDATOR_FACETS.length;
