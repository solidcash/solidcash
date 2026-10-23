import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
  hexToBin, Opcodes,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, buildSatoshiContainerCovenantScript, encodeWitnessBlock, scriptToBytecode,
  sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { buildMasterHeadScript } from '../../../src/framed/master/master-head.js';
import { findPlaceholderOffsets } from '../../../src/framed/master/master-program.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory, validatorSpend,
} from './validator-input.js';

/**
 * Residual G0: a delegate frame's own category is settled by nobody when its master is its only one.
 *
 * A forwarding proxy delegates into a victim contract X whose code runs on the proxy's records. Left open, the
 * builder could co-spend X's own records, containers and events in that transaction while nobody settles X's
 * category: X's master is a delegate frame (skips S), and X's category is not the one the validator's census needs
 * (V8), so its records could be rewritten (an owner takeover), its containers drained, events of it minted. The
 * guard in X's head requires X's category untouched when X is its only master - present on exactly one input and
 * one output, the recreated master - and a value-handling X's own satoshi containers not to shrink.
 *
 * The verdict evaluated is the machine's on X's (the implementation's) own master input. The caller is a stand-in
 * master that carries the proxy's category and whose block delegates into X; the record the delegate frame runs on
 * carries the proxy's category, as a proxy's own records do. Each attack adds a UTXO of X's own category, or drains
 * a container at X's own container lock; the honest delegatecall adds none.
 */

const CATEGORY_PROXY = seededCategory('untouched proxy');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const MASTER_VALUE = 20_000n;
const USER_VALUE = 100_000n;
const EMPTY = new Uint8Array(0);

const CALLER_INDEX = 0;
const IMPL_INDEX = 1;
const VALIDATOR_INDEX = 2;
const RECORD_INDEX = 3;
const USER_INDEX = 4;
const ATTACK_INDEX = 5;

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];
type Capability = 'minting' | 'mutable' | 'none';
const token = (category: Uint8Array, capability: Capability, commitment: Uint8Array = EMPTY): VmOutput['token'] =>
  ({ category, amount: 0n, nft: { capability, commitment } });

/** A compiled victim contract deployed under its own category, reached as a delegate callee. */
interface Victim {
  readonly category: Uint8Array;
  readonly program: Uint8Array;
  readonly lock: Uint8Array;
  readonly selector: Uint8Array;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
  readonly handlesValue: boolean;
}

function deployVictim(label: string, source: string, entry: string, handlesValue: boolean): Victim {
  const category = seededCategory(label);
  const address = validatorAddress(category, REAL_VALIDATOR_PROGRAM);
  const artifact = compileString(source, { composition: 'framed' });
  const program = fillPlaceholders(
    scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders,
    { category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH },
  );
  const view = (counter: bigint): Uint8Array =>
    hexToBin(buildPushdataCommitment(artifact.stateLayout!, { counter }, 0));
  return {
    category, program, lock: encodeLockingBytecodeP2sh32(hash256(program)),
    selector: hexToBin(artifact.abi.find((row) => row.name === entry)!.selector!),
    before: view(5n), after: view(6n), handlesValue,
  };
}

const COUNTER = deployVictim(
  'untouched counter',
  'pragma solidcash ^0.14.0; contract Counter { int public counter;'
  + ' function increment() { this.counter = this.counter + 1; require(this.counter > 0); } }',
  'increment', false,
);
const VAULT = deployVictim(
  'untouched vault',
  'pragma solidcash ^0.14.0; contract Vault { int public counter;'
  + ' receive() external payable { this.counter = this.counter + 1; require(this.counter > 0); } }',
  '__receive', true,
);

/** The proxy stand-in: a bare head that accepts, carrying the proxy's category; it is not the evaluated input. */
const callerProgram = ((): Uint8Array => {
  const head = buildMasterHeadScript({ blockOnTop: true });
  const filled = fillPlaceholders(
    head.script, { version: 1, ...findPlaceholderOffsets(head.script, head.validatorHashSlotOffset !== undefined) },
    { category: categorySlotValue(CATEGORY_PROXY), contractAddress: new Uint8Array(35) },
  );
  return new Uint8Array([
    ...filled,
    Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_1,
  ]);
})();
const callerLock = encodeLockingBytecodeP2sh32(hash256(callerProgram));
const RECORD_LOCK = dataRecordLock(CATEGORY_PROXY);

/** The satoshi container lock of a category: the direct convention's covenant, salted by the category. */
function satoshiContainerLock(category: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(category))));
}

interface Attack {
  /** An input and output carrying the victim's own category: a co-spent, rewritten record of it. */
  readonly recordRewrite?: boolean;
  /** An output carrying the victim's own category with no input: a forged event NFT of it. */
  readonly eventMint?: boolean;
  /** An input at the victim's satoshi container lock with no recreating output: a drained container. */
  readonly containerDrain?: boolean;
}

/** Evaluates the victim's own master input in a transaction that delegates into it. */
function evaluate(victim: Victim, attack: Attack = {}): boolean {
  const validator = validatorSpend(CATEGORY_PROXY, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, IMPL_INDEX], settles: [],
  });
  const callerBlock: WitnessBlock = {
    kind: 0, callerRef: USER_INDEX, originRef: USER_INDEX, validatorRef: VALIDATOR_INDEX, sender: USER_LOCK,
    self: callerLock, value: 0n, retval: EMPTY,
    calls: [{
      kind: 3, target: victim.lock, value: 0n, calleeRef: IMPL_INDEX, argsHash: sha256(EMPTY), result: EMPTY,
    }],
    segments: [[], []], events: [], sends: [],
  };
  const implBlock: WitnessBlock = {
    kind: 3, callerRef: CALLER_INDEX, originRef: USER_INDEX, validatorRef: VALIDATOR_INDEX, sender: USER_LOCK,
    self: callerLock, value: 0n, retval: EMPTY,
    calls: [], segments: [[{ in: RECORD_INDEX, out: RECORD_INDEX, viewIn: victim.before, viewOut: victim.after }]],
    events: [], sends: [],
  };
  const input = (index: number, unlockingBytecode: Uint8Array): VmInput =>
    ({ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(index + 1), sequenceNumber: 0xffffffff,
      unlockingBytecode });
  const inputs: VmInput[] = [
    input(CALLER_INDEX, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(callerProgram),
    ])),
    input(IMPL_INDEX, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(implBlock)), ...encodeDataPush(victim.selector),
      ...encodeDataPush(victim.program),
    ])),
    input(VALIDATOR_INDEX, validator.unlockingBytecode),
    input(RECORD_INDEX, encodeDataPush(new Uint8Array([1]))),
    input(USER_INDEX, callerUnlockingBytecode()),
  ];
  const head = (commitment: Uint8Array): VmOutput[] => [
    { lockingBytecode: callerLock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY_PROXY, 'minting') },
    { lockingBytecode: victim.lock, valueSatoshis: MASTER_VALUE, token: token(victim.category, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY_PROXY, 'mutable') },
    { lockingBytecode: RECORD_LOCK, valueSatoshis: MASTER_VALUE, token: token(CATEGORY_PROXY, 'mutable', commitment) },
    { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE },
  ];
  const sourceOutputs = head(victim.before);
  const outputs = head(victim.after);
  // The record the delegate frame runs on belongs to the proxy; the attacks add the victim's own category beside it.
  if (attack.recordRewrite === true) {
    inputs.push(input(ATTACK_INDEX, encodeDataPush(new Uint8Array([1]))));
    sourceOutputs.push({ lockingBytecode: dataRecordLock(victim.category), valueSatoshis: MASTER_VALUE,
      token: token(victim.category, 'mutable', victim.before) });
    outputs.push({ lockingBytecode: dataRecordLock(victim.category), valueSatoshis: MASTER_VALUE,
      token: token(victim.category, 'mutable', victim.after) });
  }
  if (attack.eventMint === true) {
    outputs.push({ lockingBytecode: USER_LOCK, valueSatoshis: MASTER_VALUE,
      token: token(victim.category, 'none', victim.after) });
  }
  if (attack.containerDrain === true) {
    inputs.push({ ...input(ATTACK_INDEX, encodeDataPush(new Uint8Array([1]))),
      ...{ unlockingBytecode: encodeDataPush(new Uint8Array([1])) } });
    sourceOutputs.push({ lockingBytecode: satoshiContainerLock(victim.category), valueSatoshis: 50_000n });
    // No recreating output: the drained value lands on the user, so the container shrinks to nothing.
    outputs.push({ lockingBytecode: USER_LOCK, valueSatoshis: 50_000n });
  }
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({ inputIndex: IMPL_INDEX, sourceOutputs, transaction })) === true;
}

describe('a delegate callee whose own category has a single master', () => {
  it('settles the honest delegatecall: the callee runs on the proxy records, its own category untouched', () => {
    expect(evaluate(COUNTER)).toBe(true);
    expect(evaluate(VAULT)).toBe(true);
  });

  it('refuses co-spending and rewriting a record of the callee category (an owner takeover)', () => {
    expect(evaluate(COUNTER, { recordRewrite: true })).toBe(false);
  });

  it('refuses minting an event NFT of the callee category', () => {
    expect(evaluate(COUNTER, { eventMint: true })).toBe(false);
  });

  it('refuses draining a satoshi container of a value-handling callee category', () => {
    expect(evaluate(VAULT, { containerDrain: true })).toBe(false);
  });
});
