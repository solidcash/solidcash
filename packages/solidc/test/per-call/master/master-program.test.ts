import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import {
  ADDRESS_SLOT_LENGTH, CATEGORY_SLOT_LENGTH, TEMPLATE_HASH_SLOT_LENGTH, assertPlaceholders, fillPlaceholders,
} from '../../../src/per-call/master/placeholders.js';

/**
 * A compiled per-call master, driven through the real entry point.
 *
 * The structural half asserts what the artifact publishes and where the deployment-time slots are. The VM half
 * builds a real transaction that spends the master and asks the BCH-2026 virtual machine, because the ownership,
 * recreation and frame rules are all opinions about a transaction: only the machine can settle them, and libauth
 * reports every `OP_*VERIFY` failure with the same sentence, so each rejection below is attributed to the mutation
 * that produced it.
 */

const CATEGORY = new Uint8Array(32).fill(0x5a);
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]); // OP_1 OP_2, any program the address rule accepts
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Frame(address owner, address expected) {'
  + '   function bump() {'
  + '     require(msg.sender == owner);'
  + '     require(tx.origin == owner);'
  + '     require(address(this) == expected);'
  + '     require(msg.value == 0);'
  + '   }'
  + ' }';

const compile = (): ReturnType<typeof compileString> => compileString(SOURCE, { composition: 'per-call' });
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);

/** The finished script as bytes: the artifact publishes it as ASM, deployment fills the slots in the bytes. */
const scriptBytes = (artifact: ReturnType<typeof compileString>): Uint8Array =>
  scriptToBytecode(asmToScript(artifact.bytecode));

const contains = (script: Uint8Array, pattern: readonly number[]): boolean => {
  for (let index = 0; index + pattern.length <= script.length; index += 1) {
    if (pattern.every((byte, offset) => script[index + offset] === byte)) return true;
  }
  return false;
};

describe('a compiled per-call master', () => {
  it('publishes the convention and the deployment-time slots', () => {
    const artifact = compile();
    expect(artifact.composition?.convention).toBe('per-call');
    const placeholders = artifact.composition!.placeholders;
    expect(placeholders.version).toBe(1);
    // The reserved pushes must be exactly where deployment will fill them.
    assertPlaceholders(scriptBytes(artifact), placeholders);
  });

  it('opens the program with the head: the block drop, then the reserved category slot', () => {
    const artifact = compile();
    const script = scriptBytes(artifact);
    const { categoryOffset } = artifact.composition!.placeholders;
    // The unlocking bytecode's own copy of the block is removed from the bottom of the frame, then the head starts
    // with the category slot. Nothing precedes the head, so the program cannot be running an entry body first.
    expect(script.subarray(0, 4)).toEqual(new Uint8Array([0x74, 0x8c, 0x7a, 0x75])); // OP_DEPTH 1SUB ROLL DROP
    expect(categoryOffset).toBe(4);
    expect(script.subarray(categoryOffset, categoryOffset + 33))
      .toEqual(new Uint8Array([CATEGORY_SLOT_LENGTH, ...new Array<number>(CATEGORY_SLOT_LENGTH).fill(0)]));
  });

  it('carries the ownership check, the recreation check and the witness-block reader', () => {
    const script = scriptBytes(compile());
    // Ownership: the reserved category slot, the capability byte, then the introspection comparison.
    expect(contains(script, [0x20, ...new Array<number>(CATEGORY_SLOT_LENGTH).fill(0)])).toBe(true);
    expect(contains(script, [0x52, 0x7e, 0x76, 0xc0, 0xce, 0x88])).toBe(true); // OP_2 OP_CAT DUP INPUTINDEX UTXOCATEGORY EQV
    // Recreation in place: same lock, then the same category on the output side.
    expect(contains(script, [0xc0, 0xcd, 0xc0, 0xc7, 0x88])).toBe(true); // INPUTINDEX OUTPUTBYTECODE ... EQV
    expect(contains(script, [0x76, 0xc0, 0xd1, 0x88])).toBe(true); // DUP INPUTINDEX OUTPUTTOKENCATEGORY EQV
    expect(contains(script, [0x75, 0xc0, 0xd2, 0x00, 0x88])).toBe(true); // DROP INPUTINDEX OUTPUTTOKENCOMMITMENT 0 EQV
    expect(contains(script, [0xc0, 0xcc, 0xc0, 0xc6, 0xa2, 0x69])).toBe(true); // ... OUTPUTVALUE >= UTXOVALUE VERIFY
    // W0: the reader compares the block's leading magic and version with its constant.
    expect(contains(script, [0x03, 0x50, 0x57, 0x01, 0x88])).toBe(true);
  });

  it('carries the frame-kind branch and the root-frame checks', () => {
    const script = scriptBytes(compile());
    // The head branches on the frame kind: 0 is a user's frame, 1 a message call.
    expect(contains(script, [0x57, 0x79, 0x81, 0x00, 0x9c, 0x63])).toBe(true); // OP_7 PICK BIN2NUM 0 NUMEQUAL IF
    expect(contains(script, [0x57, 0x79, 0x81, 0x51, 0x9c, 0x63])).toBe(true); // OP_7 PICK BIN2NUM 1 NUMEQUAL IF
    // The call arm requires kind 1, then removes the call data's unconsumed selector from the bottom.
    expect(contains(script, [0x57, 0x79, 0x81, 0x51, 0x9d, 0x74, 0x8c, 0x7a, 0x75])).toBe(true);
    // A caller reference is never this input: OP_5 PICK BIN2NUM INPUTINDEX NUMNOTEQUAL VERIFY.
    expect(contains(script, [0x55, 0x79, 0x81, 0xc0, 0x9e, 0x69])).toBe(true);
    // The root arm binds origin to the caller and requires no value.
    expect(contains(script, [0x55, 0x79, 0x81, 0x57, 0x79, 0x81, 0x9d])).toBe(true); // originRef == callerRef
    // The caller reference's lock is checked to be P2PKH and compared against the witness sender.
    expect(contains(script, [0x03, 0x76, 0xa9, 0x14, 0x88])).toBe(true);
    expect(contains(script, [0x02, 0x88, 0xac, 0x88])).toBe(true);
    // A frame that names no validator is standalone, so only a root frame is admitted.
    expect(contains(script, [0x02, 0xff, 0xff, 0x87, 0x63])).toBe(true); // validatorRef == the u16 sentinel
    expect(contains(script, [0x57, 0x79, 0x81, 0x00, 0x9d])).toBe(true); // standalone: kind == 0
    // The reserved address slot is pushed right before the self comparison.
    const { addressOffset, templateHashOffset } = compile().composition!.placeholders;
    expect(script.subarray(addressOffset, addressOffset + 36).subarray(0, 1))
      .toEqual(new Uint8Array([ADDRESS_SLOT_LENGTH]));
    expect(script.subarray(addressOffset - 1, addressOffset + 1))
      .toEqual(new Uint8Array([0x78, ADDRESS_SLOT_LENGTH])); // OP_OVER then the slot
    // A master that can be entered as a callee reserves the validator program hash slot its call arm reads.
    expect(templateHashOffset).toBeTypeOf('number');
    expect(script.subarray(templateHashOffset!, templateHashOffset! + 1))
      .toEqual(new Uint8Array([TEMPLATE_HASH_SLOT_LENGTH]));
  });
});

// Consensus rules only: the master's unlocking bytecode leads with a witness-block push, which the additional
// standardness rules do not describe.
const relaxed = false;

interface SpendOptions {
  readonly sender?: Uint8Array;
  readonly self?: Uint8Array;
  readonly value?: bigint;
  readonly kind?: number;
  readonly callerRef?: number;
  readonly originRef?: number;
  readonly validatorRef?: number;
  readonly outputRecreates?: boolean;
  readonly outputValue?: bigint;
  /** Spend from a caller that is not the transaction's first P2PKH input, with a decoy lock at index 0. */
  readonly decoyCaller?: boolean;
}

/** Builds the spend of a filled master and asks the BCH-2026 machine. */
function evaluateSpend(options: SpendOptions = {}): boolean {
  const artifact = compile();
  const placeholders = artifact.composition!.placeholders;
  const address = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
  // Deployment fills the artifact script; the SDK prepends the constructor arguments to form the redeem script.
  const filled = fillPlaceholders(scriptBytes(artifact), placeholders, {
    category: CATEGORY, contractAddress: address, templateHash: TEMPLATE_HASH,
  });
  const redeemScript = new Uint8Array([
    ...encodeDataPush(address), // `expected`
    ...encodeDataPush(OWNER_LOCK), // `owner`
    ...filled,
  ]);
  const lock = encodeLockingBytecodeP2sh32(hash256(redeemScript));

  const decoy = options.decoyCaller === true;
  const masterIndex = decoy ? 1 : 1;
  const callerIndex = decoy ? 2 : 0;
  const callerRef = options.callerRef ?? callerIndex;
  const block: WitnessBlock = {
    kind: options.kind ?? 0,
    callerRef,
    originRef: options.originRef ?? callerRef,
    validatorRef: options.validatorRef ?? 0xffff,
    sender: options.sender ?? OWNER_LOCK,
    self: options.self ?? address,
    value: options.value ?? 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const unlockingBytecode = new Uint8Array([
    ...encodeDataPush(encodeWitnessBlock(block)),
    ...encodeDataPush(redeemScript),
  ]);

  const masterSource = {
    lockingBytecode: lock,
    valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
  };
  const masterOutput = options.outputRecreates === false
    ? {
      lockingBytecode: OWNER_LOCK,
      valueSatoshis: 20_000n,
    }
    : {
      lockingBytecode: lock,
      valueSatoshis: options.outputValue ?? 20_000n,
      token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
    };

  const decoyLock = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(3));
  const callerInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(7),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array(0),
  };
  const decoyInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array(0),
  };
  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(2),
    sequenceNumber: 0xffffffff,
    unlockingBytecode,
  };
  const decoySource = { lockingBytecode: decoyLock, valueSatoshis: 100_000n };
  const callerSource = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };
  const decoyOutput = { lockingBytecode: decoyLock, valueSatoshis: 100_000n };
  const callerOutput = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };

  const transaction = {
    version: 2,
    inputs: decoy ? [decoyInput, masterInput, callerInput] : [callerInput, masterInput],
    outputs: decoy ? [decoyOutput, masterOutput, callerOutput] : [callerOutput, masterOutput],
    locktime: 0,
  };
  const sourceOutputs = decoy
    ? [decoySource, masterSource, callerSource]
    : [callerSource, masterSource];

  const vm = createVirtualMachineBch2026(relaxed);
  return vm.stateSuccess(vm.evaluate({ inputIndex: masterIndex, sourceOutputs, transaction })) === true;
}

describe('a per-call master evaluated in the BCH-2026 virtual machine', () => {
  it('accepts a root spend whose frame matches', () => {
    expect(evaluateSpend()).toBe(true);
  });

  it('accepts a root spend whose caller is not the first P2PKH input', () => {
    // The decoy at index 0 is a P2PKH input that is not the caller: `msg.sender` and `tx.origin` can only be
    // answered from the frame's references, not from a scan for the transaction's first P2PKH lock.
    expect(evaluateSpend({ decoyCaller: true })).toBe(true);
  });

  it('refuses an origin reference that is not the caller reference', () => {
    expect(evaluateSpend({ decoyCaller: true, originRef: 0 })).toBe(false);
  });

  it('refuses a sender that is not the caller input\'s lock', () => {
    expect(evaluateSpend({ sender: encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(7)) })).toBe(false);
  });

  it('refuses a non-root frame', () => {
    expect(evaluateSpend({ kind: 1 })).toBe(false);
  });

  it('refuses a nonzero msg.value', () => {
    expect(evaluateSpend({ value: 1n })).toBe(false);
  });

  it('refuses a validator reference on a standalone master', () => {
    expect(evaluateSpend({ validatorRef: 0 })).toBe(false);
  });

  it('refuses a self claim that is not the reserved address', () => {
    expect(evaluateSpend({ self: encodeLockingBytecodeP2sh32(hash256(new Uint8Array([9, 9, 9]))) })).toBe(false);
  });

  it('refuses an output that does not recreate the master', () => {
    expect(evaluateSpend({ outputRecreates: false })).toBe(false);
  });

  it('refuses an output worth less than the master held', () => {
    expect(evaluateSpend({ outputValue: 19_999n })).toBe(false);
  });

  it('refuses a caller reference that is the master itself', () => {
    expect(evaluateSpend({ callerRef: 1 })).toBe(false);
  });
});

describe('a stateful per-call master', () => {
  const STATEFUL_SOURCE = 'pragma solidcash ^0.13.0;'
    + ' contract Vault(address owner) {'
    + '   int public hits;'
    + '   function bump() { require(msg.sender == owner); this.hits = this.hits + 1; }'
    + ' }';

  it('compiles to a master with every reserved slot', () => {
    const artifact = compileString(STATEFUL_SOURCE, { composition: 'per-call' });
    expect(artifact.composition?.convention).toBe('per-call');
    assertPlaceholders(scriptBytes(artifact), artifact.composition!.placeholders);
  });

  it('takes msg.sender from the frame rather than from a sender-category argument', () => {
    const artifact = compileString(STATEFUL_SOURCE, { composition: 'per-call' });
    const entry = artifact.abi.find((fn) => fn.name === 'bump');
    // The direct path's synthetic sender-category parameter is not part of a master's frame.
    expect(entry?.inputs.map((input) => input.name)).not.toContain('__internal__msgSenderCategory');
  });
});
