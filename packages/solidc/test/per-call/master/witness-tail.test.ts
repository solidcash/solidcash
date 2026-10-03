import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256, Opcodes,
} from '@bitauth/libauth';
import {
  ByteWriter, WITNESS_BLOCK_MAGIC, WITNESS_BLOCK_VERSION, buildSatoshiContainerCovenantScript, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { buildMasterHeadScript, type MasterHeadOptions } from '../../../src/per-call/master/master-head.js';
import { findPlaceholderOffsets } from '../../../src/per-call/master/master-program.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import type { MasterTailShape } from '../../../src/per-call/master/frame-tail.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory } from './validator-input.js';

/**
 * The variable-length tail of a witness block, walked by a master.
 *
 * After the frame fields and the call records, the block carries a segment, an event and a send section. The
 * master's head requires the counts the entry fixes, checks the shape of every record entry, checks that each
 * listed event output carries the contract's category with no capability, leaves each listed send's output index
 * for the body that computed the send, and requires nothing to follow the last field. This file drives a compiled
 * head through the BCH-2026 virtual machine so the machine's own verdict is the assertion, and pairs every refusal
 * with the shape it does not touch, so the refusal is the check under test rather than a malformed block.
 *
 * The head is built directly rather than compiled: the entry's calls, events and sends are the shape the head is
 * handed, which is exactly what the compiler derives for a compiled contract and passes through.
 */

const CATEGORY = seededCategory('witness tail');
const OTHER_CATEGORY = seededCategory('witness tail other');
/** The shipped program. This master never runs it; the address is derived from it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const EVENT_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x33));
/** A lock that is not a P2PKH, for a send output that should be refused. */
const OTHER_LOCK = encodeLockingBytecodeP2sh32(hash256(new Uint8Array([1, 2, 3])));
/** The contract's container lock: a frame's sends follow one of its containers. */
const CONTAINER_LOCK = encodeLockingBytecodeP2sh32(
  hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(CATEGORY))),
);

const MASTER_INDEX = 0;
const USER_INDEX = 1;
const MASTER_VALUE = 20_000n;
const PAYMENT = 10_000n;

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** A token, with an NFT capability and commitment where one is wanted. */
function token(
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  commitment: Uint8Array = new Uint8Array(0),
): VmOutput['token'] {
  return { category, amount: 0n, nft: { capability, commitment } };
}

/** The filled, deployed program of a standalone master whose body drops the frame values and accepts. */
function masterProgram(options: MasterHeadOptions): { program: Uint8Array; lock: Uint8Array } {
  const head = buildMasterHeadScript(options);
  const filled = fillPlaceholders(
    head.script,
    { version: 1, ...findPlaceholderOffsets(head.script, head.validatorHashSlotOffset !== undefined) },
    {
      category: categorySlotValue(CATEGORY),
      contractAddress: ADDRESS,
      ...(head.validatorHashSlotOffset === undefined ? {} : { templateHash: TEMPLATE_HASH }),
    },
  );
  // The head leaves the four frame values, the category-owner index, the block's declared call count, the record
  // indices when the head keeps them, and the event and send regions: the declared count above one slot per
  // position, when a region holds any.
  const eventRegionSize = options.tail?.maxEventCount ?? 0;
  const sendRegionSize = options.tail?.sendCount ?? 0;
  const leaves = 4 + 1 + 1 + (options.keepsRecordIndices === true ? 2 : 0)
    + (eventRegionSize > 0 ? eventRegionSize + 1 : 0)
    + (sendRegionSize > 0 ? sendRegionSize + 1 : 0);
  const program = new Uint8Array([
    ...filled,
    ...new Array<number>(leaves).fill(Opcodes.OP_DROP), Opcodes.OP_1,
  ]);
  return { program, lock: encodeLockingBytecodeP2sh32(hash256(program)) };
}

/** The block a root frame stands in: a user's caller, no validator, no call. */
function baseBlock(overrides: Partial<WitnessBlock> = {}): WitnessBlock {
  return {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: ADDRESS,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
    ...overrides,
  };
}

/**
 * Encodes a block with a chosen segment count, so a count that is not the call count plus one can be presented.
 * The published codec refuses such a block, which is the point: only the master's own check is under test.
 */
function encodeBlockWithSegmentCount(block: WitnessBlock, segmentCount: number): Uint8Array {
  const writer = new ByteWriter()
    .pushBytes(WITNESS_BLOCK_MAGIC)
    .pushByte(WITNESS_BLOCK_VERSION)
    .pushByte(block.kind)
    .pushUint16(block.callerRef)
    .pushUint16(block.originRef)
    .pushUint16(block.validatorRef)
    .pushLp16(block.sender)
    .pushLp16(block.self)
    .pushUint64(block.value)
    .pushLp32(block.retval)
    .pushCounted16(block.calls, (out, call) => {
      out.pushByte(call.kind)
        .pushLp16(call.target)
        .pushUint64(call.value)
        .pushUint16(call.calleeRef)
        .pushBytes(call.argsHash)
        .pushLp32(call.result);
    })
    .pushUint16(segmentCount);
  for (const segment of block.segments) {
    writer.pushCounted16(segment, (entries, entry) => {
      entries.pushUint16(entry.in)
        .pushUint16(entry.out)
        .pushLp32(entry.viewIn)
        .pushLp32(entry.viewOut);
    });
  }
  return writer
    .pushCounted16(block.events, (out, output) => { out.pushUint16(output); })
    .pushCounted16(block.sends, (out, output) => { out.pushUint16(output); })
    .pushCounted16(block.values ?? [], (out, value) => { out.pushLp32(value); })
    .finish();
}

interface Execution {
  readonly tail: MasterTailShape;
  readonly block: WitnessBlock;
  /** The outputs after the master's own recreation at index 0. */
  readonly outputs: readonly VmOutput[];
  /** Overrides the encoded block, for a block the codec itself would not produce. */
  readonly blockBytes?: Uint8Array;
}

/** Evaluates the master's own input and returns the machine's verdict. */
function verdict(execution: Execution): { accepted: boolean; objection?: string } {
  const { program, lock } = masterProgram({ blockOnTop: true, tail: execution.tail });
  const blockBytes = execution.blockBytes ?? encodeWitnessBlock(execution.block);
  const masterValue = MASTER_VALUE;
  const masterOutput: VmOutput = { lockingBytecode: lock, valueSatoshis: masterValue, token: token(CATEGORY, 'minting') };
  const inputs = [
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(1),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([...encodeDataPush(blockBytes), ...encodeDataPush(program)]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(2),
      sequenceNumber: 0xffffffff,
      // The user's signed P2PKH input: the root frame reads its signature's hash type.
      unlockingBytecode: callerUnlockingBytecode(),
    },
  ];
  const transaction: VmTransaction = {
    version: 2,
    inputs,
    outputs: [masterOutput, ...execution.outputs],
    locktime: 0,
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    masterOutput,
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** An event output: the event lock, carrying the contract's category with no capability. */
function eventOutput(commitment: Uint8Array = new Uint8Array([1, 2, 3])): VmOutput {
  return { lockingBytecode: EVENT_LOCK, valueSatoshis: PAYMENT, token: token(CATEGORY, 'none', commitment) };
}

const NO_EVENTS: MasterTailShape = { maxEventCount: 0, sendCount: 0 };

describe('a master whose tail carries an event', () => {
  it('is accepted when the event sits at its listed output', () => {
    expect(verdict({
      tail: { maxEventCount: 1, sendCount: 0 },
      block: baseBlock({ events: [1] }),
      outputs: [eventOutput()],
    })).toStrictEqual({ accepted: true });
  });

  it('is refused when the listed output carries another category', () => {
    const output = eventOutput();
    output.token = token(OTHER_CATEGORY, 'none', new Uint8Array([1, 2, 3]));
    expect(verdict({
      tail: { maxEventCount: 1, sendCount: 0 },
      block: baseBlock({ events: [1] }),
      outputs: [output],
    }).accepted).toBe(false);
  });

  it('is refused when the listed output carries no token at all', () => {
    const output: VmOutput = { lockingBytecode: EVENT_LOCK, valueSatoshis: PAYMENT };
    expect(verdict({
      tail: { maxEventCount: 1, sendCount: 0 },
      block: baseBlock({ events: [1] }),
      outputs: [output],
    }).accepted).toBe(false);
  });

  it('is refused when the listed output carries the category with the mutable capability', () => {
    const output = eventOutput();
    output.token = token(CATEGORY, 'mutable', new Uint8Array([1, 2, 3]));
    expect(verdict({
      tail: { maxEventCount: 1, sendCount: 0 },
      block: baseBlock({ events: [1] }),
      outputs: [output],
    }).accepted).toBe(false);
  });

  it('is refused when the listed output is not where the event sits', () => {
    // The NFT is at output 2 but the record names output 1, so the walk reads a lock with no token.
    expect(verdict({
      tail: { maxEventCount: 1, sendCount: 0 },
      block: baseBlock({ events: [1] }),
      outputs: [{ lockingBytecode: EVENT_LOCK, valueSatoshis: PAYMENT }, eventOutput()],
    }).accepted).toBe(false);
  });

  it('is accepted when two events sit at two increasing outputs', () => {
    expect(verdict({
      tail: { maxEventCount: 2, sendCount: 0 },
      block: baseBlock({ events: [1, 2] }),
      outputs: [eventOutput(new Uint8Array([1])), eventOutput(new Uint8Array([2]))],
    })).toStrictEqual({ accepted: true });
  });

  it('is refused when two events name the same output', () => {
    expect(verdict({
      tail: { maxEventCount: 2, sendCount: 0 },
      block: baseBlock({ events: [1, 1] }),
      outputs: [eventOutput(new Uint8Array([1])), eventOutput(new Uint8Array([2]))],
    }).accepted).toBe(false);
  });

  it('is refused when the listed outputs are out of order', () => {
    expect(verdict({
      tail: { maxEventCount: 2, sendCount: 0 },
      block: baseBlock({ events: [2, 1] }),
      outputs: [eventOutput(new Uint8Array([1])), eventOutput(new Uint8Array([2]))],
    }).accepted).toBe(false);
  });

  it('is refused when the block lists more events than the region holds', () => {
    // The region holds one position, but the block declares two events; the count check refuses before the walk.
    expect(verdict({
      tail: { maxEventCount: 1, sendCount: 0 },
      block: baseBlock({ events: [1, 2] }),
      outputs: [eventOutput(new Uint8Array([1])), eventOutput(new Uint8Array([2]))],
    }).accepted).toBe(false);
  });

  it('is accepted when the block lists fewer events than the region holds', () => {
    // The region holds two positions and the block declares one: the second position parks the sentinel, and the
    // body behind the head pins its own count. The head itself leaves the region and accepts.
    expect(verdict({
      tail: { maxEventCount: 2, sendCount: 0 },
      block: baseBlock({ events: [1] }),
      outputs: [eventOutput()],
    })).toStrictEqual({ accepted: true });
  });
});

describe('a master whose tail carries a value send', () => {
  /** One of the contract's containers, which the frame's sends follow. */
  const marker: VmOutput = { lockingBytecode: CONTAINER_LOCK, valueSatoshis: 1_000n };
  const payment = (lock: Uint8Array = USER_LOCK): VmOutput => ({ lockingBytecode: lock, valueSatoshis: PAYMENT });

  it('is accepted when the send sits at the listed output', () => {
    expect(verdict({
      tail: { maxEventCount: 0, sendCount: 1 },
      block: baseBlock({ sends: [2] }),
      outputs: [marker, payment()],
    })).toStrictEqual({ accepted: true });
  });

  it('is accepted when the listed output is not a P2PKH lock', () => {
    // A listed send's recipient lock is a run-time value the body computed, so the tail leaves the index for the
    // body to pin rather than checking a shape: a contract's lock reads like a user's at this level.
    expect(verdict({
      tail: { maxEventCount: 0, sendCount: 1 },
      block: baseBlock({ sends: [2] }),
      outputs: [marker, payment(OTHER_LOCK)],
    })).toStrictEqual({ accepted: true });
  });

  it('is refused when the output before the send is not one of the contract\'s containers', () => {
    expect(verdict({
      tail: { maxEventCount: 0, sendCount: 1 },
      block: baseBlock({ sends: [1] }),
      outputs: [payment()],
    }).accepted).toBe(false);
    expect(verdict({
      tail: { maxEventCount: 0, sendCount: 1 },
      block: baseBlock({ sends: [2] }),
      outputs: [payment(), payment()],
    }).accepted).toBe(false);
  });

  it('is refused when two listed sends are not a run, or name one output twice', () => {
    const tail = { maxEventCount: 0, sendCount: 2 };
    expect(verdict({ tail, block: baseBlock({ sends: [2, 3] }), outputs: [marker, payment(), payment()] }))
      .toStrictEqual({ accepted: true });
    expect(verdict({
      tail, block: baseBlock({ sends: [2, 4] }), outputs: [marker, payment(), payment(), payment()],
    }).accepted).toBe(false);
    expect(verdict({ tail, block: baseBlock({ sends: [2, 2] }), outputs: [marker, payment()] }).accepted)
      .toBe(false);
  });

  it('is accepted when the block lists fewer sends than the region holds', () => {
    // The region holds one position and the block declares none: the position parks the sentinel, and the body
    // behind the head requires it there for a send it did not make. The head itself leaves the region.
    expect(verdict({
      tail: { maxEventCount: 0, sendCount: 1 },
      block: baseBlock(),
      outputs: [],
    })).toStrictEqual({ accepted: true });
  });

  it('is refused when the block lists more sends than the region holds', () => {
    expect(verdict({
      tail: { maxEventCount: 0, sendCount: 1 },
      block: baseBlock({ sends: [1, 2] }),
      outputs: [{ lockingBytecode: USER_LOCK, valueSatoshis: PAYMENT }],
    }).accepted).toBe(false);
  });
});

describe('a master whose tail carries a segment section', () => {
  it('is accepted when every segment declares no record and no record count is fixed', () => {
    expect(verdict({ tail: NO_EVENTS, block: baseBlock(), outputs: [] })).toStrictEqual({ accepted: true });
  });

  it('is accepted when a segment declares a kept record', () => {
    const block = baseBlock({
      segments: [[{ in: MASTER_INDEX, out: MASTER_INDEX, viewIn: new Uint8Array([1]), viewOut: new Uint8Array([2]) }]],
    });
    expect(verdict({
      tail: { segmentRecordCounts: [1], maxEventCount: 0, sendCount: 0 },
      block,
      outputs: [],
    }).accepted).toBe(true);
    // The walk that does not know the count reaches the same verdict.
    expect(verdict({ tail: NO_EVENTS, block, outputs: [] }).accepted).toBe(true);
  });

  it('is accepted when a segment declares created and deleted records', () => {
    const block = baseBlock({
      segments: [[
        { in: 0xffff, out: 1, viewIn: new Uint8Array(0), viewOut: new Uint8Array([1]) },
        { in: USER_INDEX, out: 0xffff, viewIn: new Uint8Array([1]), viewOut: new Uint8Array(0) },
      ]],
    });
    expect(verdict({ tail: NO_EVENTS, block, outputs: [] }).accepted).toBe(true);
  });

  it('is refused when a record names an index the transaction does not have', () => {
    // Two inputs and one output: 2 names neither, and 0x8001 reads as -1. Settlement visits neither.
    for (const index of [2, 0x8001]) {
      const shapes: [number, number][] = [[index, 0xffff], [0xffff, index], [index, index]];
      for (const [inIndex, outIndex] of shapes) {
        const block = baseBlock({
          segments: [[{ in: inIndex, out: outIndex, viewIn: new Uint8Array([1]), viewOut: new Uint8Array([1]) }]],
        });
        expect(verdict({ tail: NO_EVENTS, block, outputs: [] }).accepted, `${inIndex} ${outIndex}`).toBe(false);
      }
    }
  });

  it('is refused when a kept record moves its index', () => {
    // The published codec refuses to encode this entry, so the bytes are written as declared: the master's own
    // shape check is what is under test.
    const block = baseBlock({
      segments: [[{ in: MASTER_INDEX, out: USER_INDEX, viewIn: new Uint8Array(0), viewOut: new Uint8Array(0) }]],
    });
    expect(verdict({
      tail: { segmentRecordCounts: [1], maxEventCount: 0, sendCount: 0 },
      block,
      blockBytes: encodeBlockWithSegmentCount(block, 1),
      outputs: [],
    }).accepted).toBe(false);
    expect(verdict({
      tail: NO_EVENTS,
      block,
      blockBytes: encodeBlockWithSegmentCount(block, 1),
      outputs: [],
    }).accepted).toBe(false);
  });

  it('is refused when a record is created and deleted by the same segment', () => {
    const block = baseBlock({
      segments: [[{ in: 0xffff, out: 0xffff, viewIn: new Uint8Array(0), viewOut: new Uint8Array(0) }]],
    });
    expect(verdict({
      tail: NO_EVENTS,
      block,
      blockBytes: encodeBlockWithSegmentCount(block, 1),
      outputs: [],
    }).accepted).toBe(false);
  });

  it('is refused when the segment count is not the call count plus one', () => {
    const block = baseBlock();
    expect(verdict({
      tail: NO_EVENTS,
      block,
      blockBytes: encodeBlockWithSegmentCount(block, 2),
      outputs: [],
    }).accepted).toBe(false);
    // The control: the same block with the count the entry fixes is accepted.
    expect(verdict({
      tail: NO_EVENTS,
      block: baseBlock(),
      blockBytes: encodeBlockWithSegmentCount(block, 1),
      outputs: [],
    })).toStrictEqual({ accepted: true });
  });
});

describe('a master that requires nothing after the last field', () => {
  it('is refused when a byte follows the last field', () => {
    const trailing = new Uint8Array([...encodeWitnessBlock(baseBlock()), 0x00]);
    expect(verdict({ tail: NO_EVENTS, block: baseBlock(), blockBytes: trailing, outputs: [] }).accepted).toBe(false);
  });

  it('is accepted for the same block without the trailing byte', () => {
    expect(verdict({ tail: NO_EVENTS, block: baseBlock(), outputs: [] })).toStrictEqual({ accepted: true });
  });
});
