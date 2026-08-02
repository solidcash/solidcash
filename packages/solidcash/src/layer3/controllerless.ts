import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  SINGLE_TX_BUS_DOMAIN_HEX, SINGLE_TX_BUS_MAX_PARTICIPANTS, SINGLE_TX_BUS_MAX_ROWS,
  SINGLE_TX_BUS_VERSION,
} from '@solidcash/utils';

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
  slot: number;
  payloadHex: string;
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
    return concat(
      uint(row.kind, 1, 'row kind'), uint(row.owner, 1, 'row owner'),
      uint(row.consumer, 1, 'row consumer'), uint(row.slot, 2, 'row slot'),
      frame(checkedHex(row.payloadHex, undefined, `row ${index} payload`), 'row payload'),
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
    const payloadHex = binToHex(reader.frame(`row ${index}.payload`));
    if (kind > 6 || owner >= participantCount || consumer >= participantCount) {
      throw new Error(`layer3: row ${index} has an invalid kind or participant`);
    }
    rows.push({ kind, owner, consumer, slot, payloadHex });
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
