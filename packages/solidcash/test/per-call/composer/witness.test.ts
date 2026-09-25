import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import {
  type RecordEntry,
  type Transcript,
  type WitnessBlock,
  FrameKind,
  argumentPushesOf,
  decodeTranscript,
  decodeWitnessBlock,
  encodeTranscript,
  encodeWitnessBlock,
  readOwnWitnessBlock,
  splitFirstPush,
} from '@solidcash/utils';
import {
  assembleMasterWitness,
  assembleValidatorWitness,
} from '../../../src/per-call/composer/index.js';

const contractAddress = new Uint8Array(35).fill(0x11);
const redeemScript = new Uint8Array([0x21, 0x00, 0x00, 0x00, 0x87]);

/** The offset of `needle` in `haystack`, or -1. */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let offset = 0; offset + needle.length <= haystack.length; offset += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[offset + index] !== needle[index]) continue outer;
    }
    return offset;
  }
  return -1;
}

describe('master witness assembly', () => {
  it('round trips a call-free block through the frozen witness block codec', () => {
    const kept: RecordEntry = { in: 3, out: 3, viewIn: new Uint8Array([5]), viewOut: new Uint8Array([6]) };
    const assembled = assembleMasterWitness({
      frame: { kind: FrameKind.ROOT, sender: new Uint8Array(25).fill(0x02), self: contractAddress, value: 0n },
      callerRef: 6,
      originRef: 6,
      validatorRef: 2,
      calls: [],
      retval: new Uint8Array(0),
      segments: [[kept]],
      events: [6],
      sends: [7],
      argumentPushes: [new Uint8Array([3])],
      redeemScript,
    });

    const decoded = decodeWitnessBlock(encodeWitnessBlock(assembled.block));

    expect(decoded).toEqual(assembled.block);
    expect(decoded.kind).toBe(FrameKind.ROOT);
    expect(decoded.callerRef).toBe(6);
    expect(decoded.originRef).toBe(6);
    expect(decoded.validatorRef).toBe(2);
    expect(decoded.segments).toEqual([[kept]]);
    expect(decoded.events).toEqual([6]);
    expect(decoded.sends).toEqual([7]);
  });

  it('encodes a call record in the documented wire order', () => {
    const created: RecordEntry = { in: 0xffff, out: 9, viewIn: new Uint8Array(), viewOut: new Uint8Array([1]) };
    const argsHash = new Uint8Array(32).fill(7);
    const call = {
      kind: FrameKind.CALL,
      target: contractAddress,
      value: 0n,
      calleeRef: 4,
      argsHash,
      result: new Uint8Array([0x14]),
    };
    const assembled = assembleMasterWitness({
      frame: { kind: FrameKind.CALL, sender: contractAddress, self: contractAddress, value: 0n },
      callerRef: 0,
      originRef: 6,
      validatorRef: 2,
      calls: [call],
      retval: new Uint8Array(0),
      segments: [[], [created]],
      events: [],
      sends: [],
      argumentPushes: [],
      redeemScript,
    });

    expect(assembled.block.calls).toEqual([call]);
    expect(assembled.block.segments).toEqual([[], [created]]);

    // `kind:u8 target:lp16 value:u64 calleeRef:u16 argsHash:32 result:lp32`: the callee reference sits
    // immediately before the arguments hash. The frozen decoder reads calleeRef before target instead, so a
    // call-bearing block cannot be decoded back with it; only the encoder order is checked here.
    const encoded = encodeWitnessBlock(assembled.block);
    const hashAt = indexOfBytes(encoded, argsHash);
    expect(hashAt).toBeGreaterThan(0);
    expect([...encoded.slice(hashAt - 2, hashAt)]).toEqual([call.calleeRef & 0xff, (call.calleeRef >>> 8) & 0xff]);
  });

  it('places the block first, the arguments next and the redeem script last', () => {
    const argumentPushes = [new Uint8Array([3]), new Uint8Array([7, 0])];
    const assembled = assembleMasterWitness({
      frame: { kind: FrameKind.CALL, sender: contractAddress, self: contractAddress, value: 0n },
      callerRef: 0,
      originRef: 6,
      validatorRef: 2,
      calls: [],
      retval: new Uint8Array([0x14]),
      segments: [[]],
      events: [],
      sends: [],
      argumentPushes,
      redeemScript,
    });

    const own = readOwnWitnessBlock(assembled.unlockingBytecode, assembled.block);

    // The boundaries of the unlocking bytecode separate the two: the first push is the witness block, the last is
    // the redeem script, and the argument pushes sit between them. Conflating the script with the arguments would
    // make the caller's argument hash disagree with the callee's.
    const expectedArgumentPushes = Uint8Array.from(
      argumentPushes.flatMap((push) => [...encodeDataPush(push)]),
    );
    const scriptPush = encodeDataPush(redeemScript);

    expect(own.block).toEqual(assembled.block);
    expect(own.argumentPushes).toEqual(expectedArgumentPushes);
    expect(own.redeemScript).toEqual(redeemScript);
    expect(argumentPushesOf(assembled.unlockingBytecode)).toEqual(expectedArgumentPushes);
    expect(assembled.unlockingBytecode.slice(-scriptPush.length)).toEqual(scriptPush);
    expect(assembled.unlockingBytecode.slice(0, assembled.unlockingBytecode.length
      - expectedArgumentPushes.length - scriptPush.length))
      .toEqual(encodeDataPush(encodeWitnessBlock(assembled.block)));
  });

  it('refuses a block whose segment count does not follow its calls', () => {
    expect(() => assembleMasterWitness({
      frame: { kind: FrameKind.ROOT, sender: new Uint8Array(25), self: contractAddress, value: 0n },
      callerRef: 0,
      originRef: 0,
      validatorRef: 0xffff,
      calls: [{
        kind: FrameKind.CALL,
        target: contractAddress,
        value: 0n,
        calleeRef: 1,
        argsHash: new Uint8Array(32),
        result: new Uint8Array(0),
      }],
      retval: new Uint8Array(0),
      segments: [[]],
      events: [],
      sends: [],
      argumentPushes: [],
      redeemScript,
    })).toThrowError(/one more segment than calls/);
  });

  it('refuses a call that records a root frame', () => {
    const block: WitnessBlock = {
      kind: FrameKind.ROOT,
      callerRef: 0,
      originRef: 0,
      validatorRef: 0xffff,
      sender: new Uint8Array(25),
      self: contractAddress,
      value: 0n,
      retval: new Uint8Array(0),
      calls: [{
        kind: FrameKind.ROOT,
        target: contractAddress,
        value: 0n,
        calleeRef: 1,
        argsHash: new Uint8Array(32),
        result: new Uint8Array(0),
      }],
      segments: [[], []],
      events: [],
      sends: [],
    };

    expect(() => encodeWitnessBlock(block)).toThrowError(/root frame/);
  });
});

describe('validator witness assembly', () => {
  it('round trips the transcript through the frozen transcript codec', () => {
    const transcript: Transcript = {
      roots: [0],
      masters: [0, 1, 4],
      settles: [{ category: new Uint8Array(32).fill(0x33), stateInputs: [3] }],
    };

    const assembled = assembleValidatorWitness({ transcript, redeemScript });

    const transcriptPush = splitFirstPush(assembled.unlockingBytecode);
    expect(decodeTranscript(transcriptPush.payload)).toEqual(transcript);
    expect(transcriptPush.payload).toEqual(encodeTranscript(transcript));

    const scriptPush = splitFirstPush(transcriptPush.rest);
    expect(scriptPush.payload).toEqual(redeemScript);
    expect(scriptPush.rest).toHaveLength(0);
  });

  it('refuses a transcript whose settled contract lists no state input', () => {
    const transcript: Transcript = {
      roots: [0],
      masters: [0],
      settles: [{ category: new Uint8Array(32), stateInputs: [] }],
    };

    expect(() => assembleValidatorWitness({ transcript, redeemScript })).toThrowError(/no state input/);
  });
});
