import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  SINGLE_TX_BUS_DOMAIN_HEX, SINGLE_TX_BUS_MAX_PARTICIPANTS, SINGLE_TX_BUS_MAX_ROWS,
  SINGLE_TX_BUS_VERSION, scriptToBytecode,
} from '@solidcash/utils';
import type { ContractUnlocker } from '../interfaces.js';

/** Controllerless single-transaction bus wire domain: ASCII `L3BUS1\0\0`. */
export const SINGLE_TX_BUS_DOMAIN = SINGLE_TX_BUS_DOMAIN_HEX;
export { SINGLE_TX_BUS_MAX_PARTICIPANTS, SINGLE_TX_BUS_MAX_ROWS, SINGLE_TX_BUS_VERSION };

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
};

const uint = (value: number, width: 1 | 2 | 4, field: string): Uint8Array => {
  const limit = 2 ** (width * 8);
  if (!Number.isSafeInteger(value) || value < 0 || value >= limit) {
    throw new Error(`layer3: ${field} is outside uint${width * 8}`);
  }
  return Uint8Array.from({ length: width }, (_, index) => Math.floor(value / 2 ** (8 * index)) & 0xff);
};

class Reader {
  public cursor = 0;
  public constructor(private readonly bytes: Uint8Array) {}
  public take(length: number, field: string): Uint8Array {
    if (!Number.isSafeInteger(length) || length < 0 || this.cursor + length > this.bytes.length) {
      throw new Error(`layer3: truncated controllerless transcript at ${field}`);
    }
    const value = this.bytes.slice(this.cursor, this.cursor + length);
    this.cursor += length;
    return value;
  }

  public uint(width: 1 | 2 | 4, field: string): number {
    const bytes = this.take(width, field);
    return bytes.reduce((value, byte, index) => value + byte * 2 ** (8 * index), 0);
  }

  public frame(field: string): Uint8Array { return this.take(this.uint(2, `${field}.length`), field); }

  public eof(): boolean { return this.cursor === this.bytes.length; }
}

const frame = (bytes: Uint8Array, field: string): Uint8Array =>
  concat(uint(bytes.length, 2, `${field}.length`), bytes);

export interface SingleTxParticipant {
  lockingBytecode: string;
  masterCategory: string;
  /** Compiler-authored non-variable prefix, including the master at local offset zero. */
  fixedSize: number;
  /** Physical span used by this execution. Its absolute base is the sum of preceding actual sizes. */
  actualSize: number;
  /** Compiler-authored upper bound for the fixed prefix plus variable trailing resources. */
  maximumSize: number;
  policyHash: string;
  /** Actual number of variable trailing slots: `actualSize - fixedSize`. */
  trailingUsed: number;
  /** Local return-event output offset, or 0xffff when this participant has no returning route. */
  returnOffset: number;
}

export interface SingleTxRow {
  /** Stable row kind. 0 invocation, 1 resource, 2 event, 3 value, 4 token, 5 return-event, 6 sidecar. */
  kind: number;
  owner: number;
  consumer: number;
  /** Exact occurrence/resource ordinal within the owning compiler policy. */
  slot: number;
  /** Invocation call mode or effect subtype; zero when the row family has no subtype. */
  mode: number;
  /** Participant-local input offset, or 0xffff when the row consumes no distinct input. */
  sourceOffset: number;
  /** Participant-local output offset, or 0xffff when the row creates no distinct output. */
  targetOffset: number;
  /** Four-byte function/event/effect discriminator; zero for resource rows without one. */
  selectorHex: string;
  /** Completion position for invocations, otherwise the compiler-authored settlement position. */
  position: number;
  /** Invocation parent and DFS structure; non-invocation rows use 0xffff/0/slot. */
  parent: number;
  depth: number;
  subtreeEnd: number;
  /** Category, locking bytecode, caller, event topic, or sidecar request identity. */
  subjectHex: string;
  argsHex: string;
  resultHex: string;
  /** State commitment, event data, transfer amount/token fields, or sidecar response. */
  effectHex: string;
}

export interface SingleTxBusTranscript {
  participants: readonly SingleTxParticipant[];
  rows: readonly SingleTxRow[];
}

const checkedHex = (value: string, bytes: number | undefined, field: string): Uint8Array => {
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(value)) throw new Error(`layer3: ${field} is not byte-aligned hex`);
  const result = hexToBin(value);
  if (bytes !== undefined && result.length !== bytes) {
    throw new Error(`layer3: ${field} must be ${bytes} bytes`);
  }
  return result;
};

export function encodeSingleTxBusTranscript(transcript: SingleTxBusTranscript): Uint8Array {
  const { participants, rows } = transcript;
  if (participants.length < 2 || participants.length > SINGLE_TX_BUS_MAX_PARTICIPANTS) {
    throw new Error(`layer3: participant count must be in [2, ${SINGLE_TX_BUS_MAX_PARTICIPANTS}]`);
  }
  if (rows.length > SINGLE_TX_BUS_MAX_ROWS) {
    throw new Error(`layer3: transcript row count exceeds ${SINGLE_TX_BUS_MAX_ROWS}`);
  }
  const participantParts = participants.map((participant, index) => {
    if (!Number.isSafeInteger(participant.fixedSize) || participant.fixedSize < 1
      || !Number.isSafeInteger(participant.actualSize)
      || !Number.isSafeInteger(participant.maximumSize)
      || !Number.isSafeInteger(participant.trailingUsed)
      || participant.actualSize !== participant.fixedSize + participant.trailingUsed
      || participant.actualSize > participant.maximumSize) {
      throw new Error(`layer3: participant ${index} has a non-canonical variable span`);
    }
    const lbc = checkedHex(participant.lockingBytecode, undefined, `participant ${index} locking bytecode`);
    if (lbc.length === 0) throw new Error(`layer3: participant ${index} locking bytecode is empty`);
    const category = checkedHex(participant.masterCategory, 32, `participant ${index} master category`);
    const policy = checkedHex(participant.policyHash, 32, `participant ${index} policy hash`);
    if (participant.returnOffset !== 0xffff && participant.returnOffset >= participant.fixedSize) {
      throw new Error(`layer3: participant ${index} has an out-of-block return output`);
    }
    return concat(
      uint(participant.fixedSize, 2, 'participant fixed size'),
      uint(participant.actualSize, 2, 'participant actual size'),
      frame(lbc, 'locking bytecode'), category, policy,
      uint(participant.maximumSize, 2, 'participant maximum size'),
      uint(participant.trailingUsed, 2, 'participant trailing use'),
      uint(participant.returnOffset, 2, 'return output offset'),
    );
  });
  const rowParts = rows.map((row, index) => {
    if (row.kind < 0 || row.kind > 6) throw new Error(`layer3: row ${index} has an unknown kind`);
    if (row.owner >= participants.length || row.consumer >= participants.length) {
      throw new Error(`layer3: row ${index} names an unknown participant`);
    }
    const selector = checkedHex(row.selectorHex, 4, `row ${index} selector`);
    const subject = checkedHex(row.subjectHex, undefined, `row ${index} subject`);
    const args = checkedHex(row.argsHex, undefined, `row ${index} arguments`);
    const result = checkedHex(row.resultHex, undefined, `row ${index} result`);
    const effect = checkedHex(row.effectHex, undefined, `row ${index} effect`);
    return concat(
      uint(row.kind, 1, 'row kind'), uint(row.owner, 1, 'row owner'),
      uint(row.consumer, 1, 'row consumer'), uint(row.slot, 2, 'row slot'),
      uint(row.mode, 1, 'row mode'), uint(row.sourceOffset, 2, 'row source offset'),
      uint(row.targetOffset, 2, 'row target offset'), selector,
      uint(row.position, 2, 'row position'), uint(row.parent, 2, 'row parent'),
      uint(row.depth, 1, 'row depth'), uint(row.subtreeEnd, 2, 'row subtree end'),
      frame(subject, 'row subject'), frame(args, 'row arguments'),
      frame(result, 'row result'), frame(effect, 'row effect'),
    );
  });
  const body = concat(
    hexToBin(SINGLE_TX_BUS_DOMAIN), uint(SINGLE_TX_BUS_VERSION, 1, 'version'),
    uint(participants.length, 1, 'participant count'), ...participantParts,
    uint(rows.length, 2, 'row count'), ...rowParts,
  );
  return concat(body.slice(0, 9), uint(body.length + 4, 4, 'total length'), body.slice(9));
}

export function decodeSingleTxBusTranscript(bytes: Uint8Array): SingleTxBusTranscript {
  const reader = new Reader(bytes);
  if (binToHex(reader.take(8, 'domain')) !== SINGLE_TX_BUS_DOMAIN) {
    throw new Error('layer3: invalid controllerless transcript domain');
  }
  if (reader.uint(1, 'version') !== SINGLE_TX_BUS_VERSION) {
    throw new Error('layer3: unsupported controllerless transcript version');
  }
  if (reader.uint(4, 'total length') !== bytes.length) {
    throw new Error('layer3: controllerless transcript length mismatch');
  }
  const participantCount = reader.uint(1, 'participant count');
  if (participantCount < 2 || participantCount > SINGLE_TX_BUS_MAX_PARTICIPANTS) {
    throw new Error('layer3: controllerless participant count is out of range');
  }
  const participants: SingleTxParticipant[] = [];
  for (let index = 0; index < participantCount; index += 1) {
    const fixedSize = reader.uint(2, `participant ${index}.fixedSize`);
    const actualSize = reader.uint(2, `participant ${index}.actualSize`);
    const lockingBytecode = binToHex(reader.frame(`participant ${index}.lockingBytecode`));
    const masterCategory = binToHex(reader.take(32, `participant ${index}.masterCategory`));
    const policyHash = binToHex(reader.take(32, `participant ${index}.policyHash`));
    const maximumSize = reader.uint(2, `participant ${index}.maximumSize`);
    const trailingUsed = reader.uint(2, `participant ${index}.trailingUsed`);
    const returnOffset = reader.uint(2, `participant ${index}.returnOffset`);
    if (fixedSize < 1 || actualSize !== fixedSize + trailingUsed || actualSize > maximumSize
      || lockingBytecode.length === 0) {
      throw new Error(`layer3: participant ${index} has a non-canonical variable span`);
    }
    if (returnOffset !== 0xffff && returnOffset >= fixedSize) {
      throw new Error(`layer3: participant ${index} has an out-of-block return output`);
    }
    participants.push({
      fixedSize, actualSize, maximumSize, lockingBytecode, masterCategory, policyHash,
      trailingUsed, returnOffset,
    });
  }
  const rowCount = reader.uint(2, 'row count');
  if (rowCount > SINGLE_TX_BUS_MAX_ROWS) throw new Error('layer3: controllerless row count is out of range');
  const rows: SingleTxRow[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const kind = reader.uint(1, `row ${index}.kind`);
    const owner = reader.uint(1, `row ${index}.owner`);
    const consumer = reader.uint(1, `row ${index}.consumer`);
    const slot = reader.uint(2, `row ${index}.slot`);
    const mode = reader.uint(1, `row ${index}.mode`);
    const sourceOffset = reader.uint(2, `row ${index}.sourceOffset`);
    const targetOffset = reader.uint(2, `row ${index}.targetOffset`);
    const selectorHex = binToHex(reader.take(4, `row ${index}.selector`));
    const position = reader.uint(2, `row ${index}.position`);
    const parent = reader.uint(2, `row ${index}.parent`);
    const depth = reader.uint(1, `row ${index}.depth`);
    const subtreeEnd = reader.uint(2, `row ${index}.subtreeEnd`);
    const subjectHex = binToHex(reader.frame(`row ${index}.subject`));
    const argsHex = binToHex(reader.frame(`row ${index}.arguments`));
    const resultHex = binToHex(reader.frame(`row ${index}.result`));
    const effectHex = binToHex(reader.frame(`row ${index}.effect`));
    if (kind > 6 || owner >= participantCount || consumer >= participantCount) {
      throw new Error(`layer3: row ${index} has an invalid kind or participant`);
    }
    rows.push({
      kind, owner, consumer, slot, mode, sourceOffset, targetOffset, selectorHex, position,
      parent, depth, subtreeEnd,
      subjectHex, argsHex, resultHex, effectHex,
    });
  }
  if (!reader.eof()) throw new Error('layer3: trailing bytes after controllerless transcript');
  return { participants, rows };
}

export interface SingleTxPhysicalLayout {
  participantInputs: readonly number[];
  feeInput: number;
  totalSlots: number;
}

/** Participant blocks occupy the complete prefix; only the ordinary fee/change pair follows it. */
export function singleTxBusPhysicalLayout(blockSizes: readonly number[]): SingleTxPhysicalLayout {
  if (blockSizes.length < 2 || blockSizes.length > SINGLE_TX_BUS_MAX_PARTICIPANTS) {
    throw new Error(`layer3: participant count must be in [2, ${SINGLE_TX_BUS_MAX_PARTICIPANTS}]`);
  }
  const participantInputs: number[] = [];
  let cursor = 0;
  blockSizes.forEach((size, participant) => {
    if (!Number.isSafeInteger(size) || size < 1) {
      throw new Error(`layer3: participant ${participant} block size must be a positive integer`);
    }
    participantInputs.push(cursor);
    cursor += size;
  });
  return Object.freeze({
    participantInputs: Object.freeze(participantInputs), feeInput: cursor, totalSlots: cursor + 1,
  });
}

/** Bytes carried as one canonical SCB1 argument in participant zero's unlocking bytecode. */
export function encodeSingleTxCarrier(transcript: SingleTxBusTranscript): Uint8Array {
  const encoded = encodeSingleTxBusTranscript(transcript);
  return concat(hexToBin('4c334331'), uint(encoded.length, 4, 'carrier length'), encoded);
}

export function decodeSingleTxCarrier(carrier: Uint8Array): SingleTxBusTranscript {
  const reader = new Reader(carrier);
  if (binToHex(reader.take(4, 'carrier domain')) !== '4c334331') {
    throw new Error('layer3: invalid controllerless carrier domain');
  }
  const transcript = reader.take(reader.uint(4, 'carrier length'), 'carrier transcript');
  if (!reader.eof()) throw new Error('layer3: trailing bytes after controllerless carrier');
  return decodeSingleTxBusTranscript(transcript);
}

interface CanonicalPush { start: number; end: number; payload: Uint8Array }

const canonicalPushAt = (script: Uint8Array, start: number, field: string): CanonicalPush => {
  if (start >= script.length) throw new Error(`layer3: missing ${field} push`);
  const opcode = script[start];
  let header = 1;
  let length: number;
  if (opcode <= 75) {
    length = opcode;
  } else if (opcode === 76) {
    if (start + 2 > script.length) throw new Error(`layer3: truncated ${field} PUSHDATA1`);
    length = script[start + 1]; header = 2;
    if (length < 76) throw new Error(`layer3: non-minimal ${field} PUSHDATA1`);
  } else if (opcode === 77) {
    if (start + 3 > script.length) throw new Error(`layer3: truncated ${field} PUSHDATA2`);
    length = script[start + 1] + script[start + 2] * 256; header = 3;
    if (length < 256) throw new Error(`layer3: non-minimal ${field} PUSHDATA2`);
  } else {
    throw new Error(`layer3: ${field} is not a canonical bounded push`);
  }
  const end = start + header + length;
  if (end > script.length) throw new Error(`layer3: truncated ${field} payload`);
  return { start, end, payload: script.slice(start + header, end) };
};

/**
 * Insert the unique carrier after SCB1's selector and positional batch pushes. The remaining ordinary ABI
 * pushes and redeem script remain byte-identical, so signatures are still generated only after this insertion.
 */
export function insertSingleTxCarrier(
  unlockingBytecode: Uint8Array, transcript: SingleTxBusTranscript,
): Uint8Array {
  const selector = canonicalPushAt(unlockingBytecode, 0, 'SCB1 selector');
  if (binToHex(selector.payload) !== '53434231') throw new Error('layer3: carrier input is not an SCB1 route');
  const batch = canonicalPushAt(unlockingBytecode, selector.end, 'SCB1 positional batch');
  const placeholder = canonicalPushAt(unlockingBytecode, batch.end, 'controllerless carrier placeholder');
  if (placeholder.payload.length !== 0) throw new Error('layer3: controllerless carrier slot is not empty');
  const carrierPush = scriptToBytecode([encodeSingleTxCarrier(transcript)]);
  return concat(unlockingBytecode.slice(0, placeholder.start), carrierPush, unlockingBytecode.slice(placeholder.end));
}

/** Extract the carrier from the exact canonical position in input zero's SCB1 unlocking bytecode. */
export function extractSingleTxCarrier(unlockingBytecode: Uint8Array): SingleTxBusTranscript {
  const selector = canonicalPushAt(unlockingBytecode, 0, 'SCB1 selector');
  if (binToHex(selector.payload) !== '53434231') throw new Error('layer3: carrier input is not an SCB1 route');
  const batch = canonicalPushAt(unlockingBytecode, selector.end, 'SCB1 positional batch');
  const carrier = canonicalPushAt(unlockingBytecode, batch.end, 'controllerless carrier');
  return decodeSingleTxCarrier(carrier.payload);
}

/** Wrap an SCB1 unlocker so carrier insertion happens after all transaction-dependent signatures are final. */
export function withSingleTxCarrier(
  unlocker: ContractUnlocker, transcript: SingleTxBusTranscript,
): ContractUnlocker {
  return {
    ...unlocker,
    generateUnlockingBytecode: (options) =>
      insertSingleTxCarrier(unlocker.generateUnlockingBytecode(options), transcript),
  };
}
