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
  base: number;
  blockSize: number;
  policyHash: string;
  trailingBase?: number;
  trailingCapacity: number;
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
  /** Absolute input slot, or 0xffff when the row consumes no distinct input. */
  sourceSlot: number;
  /** Absolute output slot, or 0xffff when the row creates no distinct output. */
  targetSlot: number;
  /** Four-byte function/event/effect discriminator; zero for resource rows without one. */
  selectorHex: string;
  /** Completion position for invocations, otherwise the compiler-authored settlement position. */
  position: number;
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
  let expectedBase = 0;
  const participantParts = participants.map((participant, index) => {
    if (participant.base !== expectedBase || participant.blockSize < 1) {
      throw new Error(`layer3: participant ${index} does not form a contiguous positive block`);
    }
    const lbc = checkedHex(participant.lockingBytecode, undefined, `participant ${index} locking bytecode`);
    if (lbc.length === 0) throw new Error(`layer3: participant ${index} locking bytecode is empty`);
    const category = checkedHex(participant.masterCategory, 32, `participant ${index} master category`);
    const policy = checkedHex(participant.policyHash, 32, `participant ${index} policy hash`);
    const trailingBase = participant.trailingBase ?? 0xffff;
    if (participant.trailingCapacity === 0 ? trailingBase !== 0xffff
      : trailingBase >= participant.blockSize
        || trailingBase + participant.trailingCapacity !== participant.blockSize) {
      throw new Error(`layer3: participant ${index} has a non-canonical trailing region`);
    }
    expectedBase += participant.blockSize;
    return concat(
      uint(participant.base, 2, 'participant base'), uint(participant.blockSize, 2, 'participant block size'),
      frame(lbc, 'locking bytecode'), category, policy,
      uint(trailingBase, 2, 'trailing base'), uint(participant.trailingCapacity, 2, 'trailing capacity'),
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
      uint(row.mode, 1, 'row mode'), uint(row.sourceSlot, 2, 'row source slot'),
      uint(row.targetSlot, 2, 'row target slot'), selector,
      uint(row.position, 2, 'row position'), frame(subject, 'row subject'), frame(args, 'row arguments'),
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
  let expectedBase = 0;
  for (let index = 0; index < participantCount; index += 1) {
    const base = reader.uint(2, `participant ${index}.base`);
    const blockSize = reader.uint(2, `participant ${index}.blockSize`);
    const lockingBytecode = binToHex(reader.frame(`participant ${index}.lockingBytecode`));
    const masterCategory = binToHex(reader.take(32, `participant ${index}.masterCategory`));
    const policyHash = binToHex(reader.take(32, `participant ${index}.policyHash`));
    const trailing = reader.uint(2, `participant ${index}.trailingBase`);
    const trailingCapacity = reader.uint(2, `participant ${index}.trailingCapacity`);
    if (base !== expectedBase || blockSize < 1 || lockingBytecode.length === 0) {
      throw new Error(`layer3: participant ${index} has a non-contiguous block`);
    }
    if (trailingCapacity === 0 ? trailing !== 0xffff
      : trailing >= blockSize || trailing + trailingCapacity !== blockSize) {
      throw new Error(`layer3: participant ${index} has a non-canonical trailing region`);
    }
    participants.push({
      base, blockSize, lockingBytecode, masterCategory, policyHash,
      trailingBase: trailing === 0xffff ? undefined : trailing, trailingCapacity,
    });
    expectedBase += blockSize;
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
    const sourceSlot = reader.uint(2, `row ${index}.sourceSlot`);
    const targetSlot = reader.uint(2, `row ${index}.targetSlot`);
    const selectorHex = binToHex(reader.take(4, `row ${index}.selector`));
    const position = reader.uint(2, `row ${index}.position`);
    const subjectHex = binToHex(reader.frame(`row ${index}.subject`));
    const argsHex = binToHex(reader.frame(`row ${index}.arguments`));
    const resultHex = binToHex(reader.frame(`row ${index}.result`));
    const effectHex = binToHex(reader.frame(`row ${index}.effect`));
    if (kind > 6 || owner >= participantCount || consumer >= participantCount) {
      throw new Error(`layer3: row ${index} has an invalid kind or participant`);
    }
    rows.push({
      kind, owner, consumer, slot, mode, sourceSlot, targetSlot, selectorHex, position,
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
