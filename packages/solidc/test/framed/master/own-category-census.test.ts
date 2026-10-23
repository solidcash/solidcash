import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, encodeAuthenticationInstructions, encodeDataPush, encodeLockingBytecodeP2pkh,
  encodeLockingBytecodeP2sh32, hash256, Opcodes,
} from '@bitauth/libauth';
import {
  asmToScript, encodeArgumentList, encodeIntegerValue, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { mastersRecreatedInPlaceScript } from '../../../src/framed/master/lifecycle.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { eventCovenantLock } from './event-input.js';
import { categorySlotValue, seededCategory } from './validator-input.js';

/**
 * Spec S2's census of the contract's own category at a master that settles alone, bullets 3 and 4.
 *
 * A standalone master spends its category's minting NFT, so the machine lets the transaction mint any NFT of the
 * category beside it. As V7 requires of a settled contract, an own-category immutable NFT sits only at an event
 * output the frame lists, whatever its commitment or lock, and no own-category input or output carries a fungible
 * amount. Each refusal is a minimal change to an accepted spend, judged by the BCH-2026 machine at the master, and
 * names the check that refused it: the head's per-index census for an amount, the settlement walk for an immutable.
 */

const CATEGORY = seededCategory('own category census');
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const OP_TRUE_LOCK = new Uint8Array([Opcodes.OP_1]);
const VALUE = 1_000n;
const EMPTY = new Uint8Array(0);

const QUIET = 'pragma solidcash ^0.14.0; contract Quiet { function idle() { require(true); } }';
const EMITTER = 'pragma solidcash ^0.14.0;'
  + ' contract Emitter { event Ping(int value); function fire(int n) { emit Ping(n); require(true); } }';

type Machine = ReturnType<typeof createVirtualMachineBch2026>;
type VmProgram = Parameters<Machine['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
type VmToken = NonNullable<VmOutput['token']>;
type VmState = ReturnType<Machine['evaluate']>;

interface Deployed {
  readonly program: Uint8Array;
  readonly lock: Uint8Array;
  readonly signature?: string;
}

function deploy(source: string): Deployed {
  const artifact = compileString(source, { composition: 'framed' });
  const { placeholders } = artifact.composition!;
  const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), placeholders, {
    category: categorySlotValue(CATEGORY), contractAddress: ADDRESS,
    ...(placeholders.templateHashOffset === undefined ? {} : { templateHash: sha256(VALIDATOR_PROGRAM) }),
  });
  const signature = artifact.events?.[0]?.signature;
  return { program, lock: encodeLockingBytecodeP2sh32(hash256(program)), ...(signature ? { signature } : {}) };
}

const quiet = deploy(QUIET);
const emitter = deploy(EMITTER);
const PING = encodeArgumentList([encodeIntegerValue(7n)]);

const minting: VmToken = { category: CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } };
const immutable = (commitment: Uint8Array, amount = 0n): VmToken =>
  ({ category: CATEGORY, amount, nft: { capability: 'none', commitment } });
const fungible = (amount: bigint): VmToken => ({ category: CATEGORY, amount });
const at = (lockingBytecode: Uint8Array, token?: VmToken): VmOutput =>
  ({ lockingBytecode, valueSatoshis: VALUE, ...(token === undefined ? {} : { token }) });
const change = at(USER_LOCK);

interface Spend {
  readonly master: Deployed;
  /** The outputs after the master's own recreation at 0. */
  readonly outputs: readonly VmOutput[];
  readonly events?: readonly number[];
  readonly argumentPushes?: Uint8Array;
  /** The master's own output token, when it is not the plain minting NFT. */
  readonly masterToken?: VmToken;
  /** A token-carrying input spent after the user's. */
  readonly extra?: VmOutput;
}

/** Which check refused a spend, read from where the master's failing instruction sits. */
type Verdict = 'accepted' | 'amount census' | 'immutable census' | 'elsewhere';

function verdictOf(master: Deployed, state: VmState, vm: Machine): Verdict {
  if (vm.stateSuccess(state) === true) return 'accepted';
  const failing = state.ip - 1;
  const opcodes = state.instructions.map((instruction) => instruction.opcode);
  const offset = encodeAuthenticationInstructions(state.instructions.slice(0, failing)).length;
  const own = binToHex(encodeAuthenticationInstructions(state.instructions)) === binToHex(master.program);
  if (!own || opcodes[failing] !== Opcodes.OP_VERIFY) return 'elsewhere';
  const census = mastersRecreatedInPlaceScript();
  const found = binToHex(master.program).indexOf(binToHex(census));
  if (found % 2 === 0 && offset > found / 2 && offset < found / 2 + census.length) return 'amount census';
  const tail = [Opcodes.OP_ROT, Opcodes.OP_OVER, Opcodes.OP_GREATERTHANOREQUAL];
  const counted = tail.every((opcode, index) => opcodes[failing - tail.length + index] === opcode);
  return counted ? 'immutable census' : 'elsewhere';
}

/** The machine's verdict on the master at input 0, entered by the user at input 1 with no validator. */
function verdict(spend: Spend): Verdict {
  const block: WitnessBlock = {
    kind: 0, callerRef: 1, originRef: 1, validatorRef: 0xffff, sender: USER_LOCK, self: ADDRESS, value: 0n,
    retval: EMPTY, calls: [], segments: [[]], events: [...(spend.events ?? [])], sends: [],
  };
  const input = (byte: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(byte), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const transaction: VmTransaction = {
    version: 2,
    locktime: 0,
    inputs: [
      input(1, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(block)), ...(spend.argumentPushes ?? EMPTY),
        ...encodeDataPush(spend.master.program),
      ])),
      input(2, callerUnlockingBytecode()),
      ...(spend.extra === undefined ? [] : [input(3, encodeDataPush(Uint8Array.of(1)))]),
    ],
    outputs: [at(spend.master.lock, spend.masterToken ?? minting), ...spend.outputs],
  };
  const sourceOutputs = [
    at(spend.master.lock, minting), { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    ...(spend.extra === undefined ? [] : [spend.extra]),
  ];
  const vm = compositionMachine();
  return verdictOf(spend.master, vm.evaluate({ inputIndex: 0, sourceOutputs, transaction }), vm);
}

describe('a standalone master that declares no event', () => {
  it('is accepted with no own-category token beside its own', () => {
    expect(verdict({ master: quiet, outputs: [change] })).toBe('accepted');
  });

  it('refuses an own-category immutable NFT, a forged event, with or without a commitment', () => {
    for (const commitment of [Uint8Array.of(9), EMPTY]) {
      expect(verdict({ master: quiet, outputs: [change, at(USER_LOCK, immutable(commitment))] }))
        .toBe('immutable census');
    }
  });

  it('refuses a fungible amount of its category on an output, its own recreation included', () => {
    expect(verdict({ master: quiet, outputs: [change, at(USER_LOCK, fungible(5n))] })).toBe('amount census');
    expect(verdict({ master: quiet, outputs: [change], masterToken: { ...minting, amount: 5n } }))
      .toBe('amount census');
  });

  it('refuses a fungible amount of its category on an input, and not another category\'s', () => {
    expect(verdict({ master: quiet, outputs: [change], extra: at(USER_LOCK, fungible(5n)) })).toBe('amount census');
    const foreign: VmToken = { category: seededCategory('own category census other'), amount: 5n };
    expect(verdict({ master: quiet, outputs: [change], extra: at(USER_LOCK, foreign) })).toBe('accepted');
  });
});

describe('a standalone master that emits', () => {
  const event = (token: VmToken = immutable(PING)): VmOutput =>
    at(eventCovenantLock(CATEGORY, emitter.signature!), token);
  const fire = (outputs: readonly VmOutput[]): Verdict =>
    verdict({ master: emitter, outputs, events: [1], argumentPushes: PING });

  it('is accepted with its event at the output its frame lists', () => {
    expect(fire([event(), change])).toBe('accepted');
  });

  it('refuses an own-category immutable NFT its frame does not list, at any lock or commitment', () => {
    // The body's own event pin passes an empty commitment, an identity-anchor prefix and an OP_TRUE lock over.
    expect(fire([event(), change, event(immutable(EMPTY))])).toBe('immutable census');
    expect(fire([event(), change, at(OP_TRUE_LOCK, immutable(PING))])).toBe('immutable census');
    expect(fire([event(), change, at(USER_LOCK, immutable(new TextEncoder().encode('SCID')))]))
      .toBe('immutable census');
  });

  it('refuses a fungible amount of its category on its event or on an unlisted immutable NFT', () => {
    expect(fire([event(immutable(PING, 1n)), change])).toBe('amount census');
    expect(fire([event(), change, event(immutable(PING, 1n))])).toBe('amount census');
  });
});
