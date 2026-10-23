import { describe, expect, it } from 'vitest';
import { encodeDataPush, hash256, encodeLockingBytecodeP2sh32, Opcodes } from '@bitauth/libauth';
import { masterPrologue, witnessReader } from '@solidcash/solidc';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { encodeWitnessBlock, type WitnessBlock } from '@solidcash/utils';
import { seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * Reading a witness block inside script, evaluated in the VM.
 *
 * A master's unlocking bytecode begins with its witness block, so the block is recoverable from the transaction
 * rather than from a copy handed to the program. These cases build real transactions whose unlocker carries a real
 * block, and have the program read it and then *assert* the values it read: a wrong offset would surface as a
 * rejection, not as a passing test.
 */

const relaxedLimits = {
  maximumInputBytes: 100_000,
  maximumStackItemBytes: 10_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800,
  hashDigestIterationsPerByte: 3,
};

const CATEGORY = seededCategory('witness reader');
const SENDER = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);
const SELF = new Uint8Array([0xaa, 0x20, ...new Uint8Array(32).fill(0x33), 0x87]);
const VALUE = 20_000n;

const empty = new Uint8Array(0);

/** A call-free block: one segment, no calls, no events, no sends. */
const baseBlock = (overrides: Partial<WitnessBlock> = {}): WitnessBlock => ({
  kind: 0,
  callerRef: 0,
  originRef: 0,
  validatorRef: 0xffff,
  sender: SENDER,
  self: SELF,
  value: VALUE,
  retval: empty,
  calls: [],
  segments: [[]],
  events: [],
  sends: [],
  ...overrides,
});

/** A block large enough to need the two-byte length form, grown the way a real one grows: with call records. */
const largeBlock = (): WitnessBlock => baseBlock({
  calls: [0, 1, 2].map((index) => ({
    kind: 1,
    target: SELF,
    value: 0n,
    calleeRef: index + 1,
    argsHash: new Uint8Array(32).fill(index + 1),
    result: empty,
  })),
  segments: [[], [], [], []],
});

/**
 * The body under test: the reader leaves `[kind, callerRef, originRef, validatorRef, sender, self, value, rest]` with
 * the remainder on top, so a body that consumes all of it — comparing every field against a value from outside the
 * block — proves which bytes were read at which offset. The comparisons run from the top downwards.
 *
 * The frame references are compared as raw bytes rather than as numbers: their absent-index sentinel is `0xffff`,
 * which a script number reads as negative, so a numeric comparison would reject a block that legitimately carries it.
 */
const bodyChecking = (
  header: { kind: number; callerRef: number; originRef: number; validatorRef: number },
  expectedSender: Uint8Array,
  expectedSelf: Uint8Array,
  expectedValue: bigint,
): Uint8Array =>
  new Uint8Array([
    // rest, then value, self and sender.
    Opcodes.OP_DROP,
    ...encodeDataPush(vmNumber(expectedValue)), Opcodes.OP_NUMEQUALVERIFY,
    ...encodeDataPush(expectedSelf), Opcodes.OP_EQUALVERIFY,
    ...encodeDataPush(expectedSender), Opcodes.OP_EQUALVERIFY,
    // Then the fixed header, field by field as bytes, from the top of the stack downwards: the reader leaves the
    // validator reference highest of the four.
    ...encodeDataPush(rawUint16(header.validatorRef)), Opcodes.OP_EQUALVERIFY,
    ...encodeDataPush(rawUint16(header.originRef)), Opcodes.OP_EQUALVERIFY,
    ...encodeDataPush(rawUint16(header.callerRef)), Opcodes.OP_EQUALVERIFY,
    ...encodeDataPush(rawByte(header.kind)), Opcodes.OP_EQUALVERIFY,
    Opcodes.OP_1,
  ]);

const rawByte = (value: number): Uint8Array => new Uint8Array([value & 0xff]);

const rawUint16 = (value: number): Uint8Array => new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);

const headerOf = (block: WitnessBlock): {
  kind: number; callerRef: number; originRef: number; validatorRef: number;
} => ({
  kind: block.kind,
  callerRef: block.callerRef,
  originRef: block.originRef,
  validatorRef: block.validatorRef,
});

function vmNumber(value: bigint): Uint8Array {
  if (value === 0n) return empty;
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0n) {
    bytes.push(Number(rest & 0xffn));
    rest >>= 8n;
  }
  if ((bytes[bytes.length - 1]! & 0x80) !== 0) bytes.push(0x00);
  return new Uint8Array(bytes);
}

interface ReaderOptions {
  readonly block: WitnessBlock;
  /** Body that runs after the frame reader. Defaults to comparing every field against the values put in the block. */
  readonly body?: Uint8Array;
  /** Replaces the unlocking-bytecode prefix that precedes the redeem script. */
  readonly unlockingPrefix?: Uint8Array;
}

/** Builds a real transaction whose master reads its own block, and evaluates the input in the BCH-2026 VM. */
function evaluateReader(options: ReaderOptions): boolean {
  // Every expectation comes from the base block, not from the block under test: a body that compared the block's
  // fields against values taken from that same block could not tell a correct read from a wrong one.
  const body = options.body ?? bodyChecking(headerOf(baseBlock()), SENDER, SELF, VALUE);
  const redeemScript = new Uint8Array([
    ...masterPrologue.buildMasterPrologue(CATEGORY),
    // This frame takes no arguments, so the inherited copy of the block is on top and goes before the reader.
    ...witnessReader.buildArgumentlessFrameReaderScript(),
    ...body,
  ]);
  const lock = encodeLockingBytecodeP2sh32(hash256(redeemScript));

  const unlockingBytecode = new Uint8Array([
    ...(options.unlockingPrefix ?? encodeDataPush(encodeWitnessBlock(options.block))),
    ...encodeDataPush(redeemScript),
  ]);

  const token = { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: empty } };
  const transaction = {
    version: 2,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32),
      sequenceNumber: 0xffffffff,
      unlockingBytecode,
    }],
    outputs: [{ lockingBytecode: lock, valueSatoshis: 20_000n, token }],
    locktime: 0,
  };

  const provider = new MockNetworkProvider({ consensusLimits: relaxedLimits, policy: { enforceDust: false } });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({
    inputIndex: 0,
    sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: 20_000n, token }],
    transaction,
  })) === true;
}

describe('witness block reader in script', () => {
  it('reads the frame fields out of a block carried by a one-byte length push', () => {
    expect(evaluateReader({ block: baseBlock() })).toBe(true);
  });

  it('reads the same fields when the block is long enough to need a two-byte length push', () => {
    const block = largeBlock();
    expect(encodeWitnessBlock(block).length).toBeGreaterThan(255);
    expect(encodeDataPush(encodeWitnessBlock(block))[0]).toBe(witnessReader.PUSHDATA2_OPCODE);
    expect(evaluateReader({ block })).toBe(true);
  });

  it('reports the value the block carries, not a neighbouring field', () => {
    // The same block, with only the value changed: the body's value check is what must fail.
    const block = baseBlock({ value: 20_001n });
    expect(evaluateReader({ block })).toBe(false);
  });

  it('reports the sender the block carries', () => {
    const otherSender = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x44), 0x88, 0xac]);
    expect(evaluateReader({ block: baseBlock({ sender: otherSender }) })).toBe(false);
  });

  it('reports the self claim the block carries', () => {
    const otherSelf = new Uint8Array([0xaa, 0x20, ...new Uint8Array(32).fill(0x55), 0x87]);
    expect(evaluateReader({ block: baseBlock({ self: otherSelf }) })).toBe(false);
  });

  it('reports the validator reference the block carries', () => {
    // The body expects the absent reference the base block carries, so a real index must fail its check.
    expect(evaluateReader({ block: baseBlock({ validatorRef: 5 }) })).toBe(false);
  });

  it('reports the frame kind the block carries', () => {
    expect(evaluateReader({ block: baseBlock({ kind: 1 }) })).toBe(false);
  });

  it('rejects a block whose magic is not the expected one', () => {
    // A well-formed block with its magic and version replaced: the header check is what must refuse it.
    const block = baseBlock();
    const payload = encodeWitnessBlock(block);
    const tampered = Uint8Array.from(payload);
    tampered[0] = 0x58;
    expect(evaluateReader({ block, unlockingPrefix: encodeDataPush(tampered) })).toBe(false);
  });

  it('fails closed when the first push is not a witness block', () => {
    // A five-byte first push claims a block it cannot be, so the header walk runs off the end.
    expect(evaluateReader({ block: baseBlock(), unlockingPrefix: encodeDataPush(new Uint8Array([1, 2, 3, 4, 5])) }))
      .toBe(false);
  });

  it('accepts a block whose retval and arguments are absent', () => {
    // Nothing after the value: the reader must not require the fields it does not read here.
    expect(evaluateReader({ block: baseBlock({ retval: empty, events: [], sends: [] }) })).toBe(true);
  });
});
