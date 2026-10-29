/**
 * Reading the census checkpoint a validator head computes.
 *
 * The census facet's unlocking bytecode leads with the checkpoint the head's settlement walk leaves — the settle lists
 * and the walk's accumulators — and the head refuses any other at the close that compares the two, the checkpoint it
 * computed below the one the facet states. A builder states a placeholder, runs the head once on a machine whose
 * budgets are lifted, and reads the checkpoint off that close. The checkpoint follows from the transaction's
 * declarations, values and input and output counts, so no input's padding moves it.
 */

import { ripemd160, secp256k1, sha1, sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { createInstructionSetBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-instruction-set.js';
import { OpcodesBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { createVirtualMachine } from '@bitauth/libauth/build/lib/vm/virtual-machine.js';
import { bytesEqual } from '@solidcash/utils';

type InstructionSet = ReturnType<typeof createInstructionSetBch2026>;
type MachineState = ReturnType<InstructionSet['evaluate']>;

/** The program a head runs: its input of the transaction, with the outputs every input spends. */
export type ValidatorHeadProgram = Parameters<InstructionSet['evaluate']>[0];

/**
 * The run that reads the close: every budget and size ceiling lifted, so the head reaches it whatever its input pays
 * for and however long the bytecode it reads is. The checkpoint is a function of the transaction's contents alone;
 * the machine that judges the transaction holds it to the chain's limits.
 */
const LIFTED_CONSENSUS = {
  ...ConsensusBch2026,
  operationCostBudgetPerByte: 1_000_000_000,
  hashDigestIterationsPerByteNonstandard: 1_000_000,
  hashDigestIterationsPerByteStandard: 1_000_000,
  maximumBytecodeLength: 100_000_000,
  maximumStackItemLength: 100_000_000,
  maximumTokenCommitmentLength: 1_000_000,
};

/** The instruction set and machine the head's run is stepped on. */
function liftedMachine() {
  const set = createInstructionSetBch2026(false, { consensus: LIFTED_CONSENSUS, ripemd160, secp256k1, sha1, sha256 });
  return { set, machine: createVirtualMachine(set) };
}

let lifted: ReturnType<typeof liftedMachine> | undefined;

/**
 * The census checkpoint the head at `program.inputIndex` computes, read off the close at which it refuses `stated`,
 * the checkpoint its census facet leads with. `undefined` when the head accepts `stated`, or stops anywhere else:
 * a head that refuses the transaction for another reason never reaches the close.
 */
export function validatorCensusCheckpointOf(
  program: ValidatorHeadProgram, stated: Uint8Array,
): Uint8Array | undefined {
  lifted ??= liftedMachine();
  const { set, machine } = lifted;
  // Only the step being taken is kept: an OP_EQUALVERIFY's two operands, which are what a run that stops on it left.
  let close: { readonly computed: Uint8Array; readonly declared: Uint8Array } | undefined;
  const stream = (initial: MachineState): MachineState => {
    let state = machine.stateClone(initial);
    while (machine.stateContinue(state)) {
      const { stack } = state;
      close = state.instructions[state.ip]?.opcode === OpcodesBch2026.OP_EQUALVERIFY && stack.length >= 2
        ? { computed: stack[stack.length - 2]!, declared: stack[stack.length - 1]! }
        : undefined;
      state = machine.stateStepMutate(state);
    }
    return state;
  };
  const final = set.evaluate(program, { stateEvaluate: stream, stateInitialize: machine.stateInitialize });
  if (final.error === undefined || close === undefined || !bytesEqual(close.declared, stated)) return undefined;
  return Uint8Array.from(close.computed);
}
