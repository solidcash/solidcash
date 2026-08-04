import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  ATOMIC_MESSAGE_BUS_DOMAIN_HEX, ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS, ATOMIC_MESSAGE_BUS_MAX_ROWS,
} from '@solidcash/utils';

/** Atomic single-transaction bus wire domain: ASCII `L3BUS1\0\0`. */
export const ATOMIC_MESSAGE_BUS_DOMAIN = ATOMIC_MESSAGE_BUS_DOMAIN_HEX;
export { ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS, ATOMIC_MESSAGE_BUS_MAX_ROWS };

/** Atomic envelopes must use Bitcoin Script OP_PUSHDATA2 in every verifier unlocking bytecode. */
export const ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES = 256;

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
};

const uint = (value: number, width: 1 | 2 | 4, field: string): Uint8Array => {
  const limit = 2 ** (width * 8);
  if (!Number.isSafeInteger(value) || value < 0 || value >= limit) {
    throw new Error(`messageBus: ${field} is outside uint${width * 8}`);
  }
  return Uint8Array.from({ length: width }, (_, index) => Math.floor(value / 2 ** (8 * index)) & 0xff);
};

class Reader {
  public cursor = 0;
  public constructor(private readonly bytes: Uint8Array) {}
  public take(length: number, field: string): Uint8Array {
    if (!Number.isSafeInteger(length) || length < 0 || this.cursor + length > this.bytes.length) {
      throw new Error(`messageBus: truncated atomic callManifest at ${field}`);
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

export interface AtomicParticipant {
  lockingBytecode: string;
  stateCategory: string;
  /** Compiler-authored non-variable prefix, including the master at local offset zero. */
  fixedSize: number;
  /** Physical span used by this execution. Its absolute base is the sum of preceding actual sizes. */
  actualSize: number;
  /** Compiler-authored upper bound for the fixed prefix plus variable trailing resources. */
  maximumSize: number;
  /** Actual number of variable trailing slots: `actualSize - fixedSize`. */
  trailingUsed: number;
  /** Local return-event output offset, or 0xffff when this participant has no returning route. */
  returnOffset: number;
}

export interface AtomicRow {
  /** Stable row kind. 0 invocation, 1 resource, 2 event, 3 value, 4 token, 6 sidecar. Kind 5 is reserved. */
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

export interface AtomicMessageBusCallManifest {
  participants: readonly AtomicParticipant[];
  rows: readonly AtomicRow[];
}

const checkedHex = (value: string, bytes: number | undefined, field: string): Uint8Array => {
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(value)) throw new Error(`messageBus: ${field} is not byte-aligned hex`);
  const result = hexToBin(value);
  if (bytes !== undefined && result.length !== bytes) {
    throw new Error(`messageBus: ${field} must be ${bytes} bytes`);
  }
  return result;
};

export function encodeAtomicMessageBusCallManifest(callManifest: AtomicMessageBusCallManifest): Uint8Array {
  const { participants, rows } = callManifest;
  if (participants.length < 2 || participants.length > ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS) {
    throw new Error(`messageBus: participant count must be in [2, ${ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS}]`);
  }
  if (rows.length > ATOMIC_MESSAGE_BUS_MAX_ROWS) {
    throw new Error(`messageBus: callManifest row count exceeds ${ATOMIC_MESSAGE_BUS_MAX_ROWS}`);
  }
  const participantParts = participants.map((participant, index) => {
    if (!Number.isSafeInteger(participant.fixedSize) || participant.fixedSize < 1
      || !Number.isSafeInteger(participant.actualSize)
      || !Number.isSafeInteger(participant.maximumSize)
      || !Number.isSafeInteger(participant.trailingUsed)
      || participant.actualSize !== participant.fixedSize + participant.trailingUsed
      || participant.actualSize > participant.maximumSize) {
      throw new Error(`messageBus: participant ${index} has a non-canonical variable span`);
    }
    const lbc = checkedHex(participant.lockingBytecode, undefined, `participant ${index} locking bytecode`);
    if (lbc.length === 0) throw new Error(`messageBus: participant ${index} locking bytecode is empty`);
    const category = checkedHex(participant.stateCategory, 32, `participant ${index} master category`);
    if (participant.returnOffset !== 0xffff && participant.returnOffset >= participant.fixedSize) {
      throw new Error(`messageBus: participant ${index} has an out-of-block return output`);
    }
    return concat(
      uint(participant.fixedSize, 2, 'participant fixed size'),
      uint(participant.actualSize, 2, 'participant actual size'),
      frame(lbc, 'locking bytecode'), category,
      uint(participant.maximumSize, 2, 'participant maximum size'),
      uint(participant.trailingUsed, 2, 'participant trailing use'),
      uint(participant.returnOffset, 2, 'return output offset'),
    );
  });
  const rowParts = rows.map((row, index) => {
    if (row.kind < 0 || row.kind > 6 || row.kind === 5) {
      throw new Error(`messageBus: row ${index} has an unknown kind (5 is reserved)`);
    }
    if (row.owner >= participants.length || row.consumer >= participants.length) {
      throw new Error(`messageBus: row ${index} names an unknown participant`);
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
    hexToBin(ATOMIC_MESSAGE_BUS_DOMAIN), uint(participants.length, 1, 'participant count'), ...participantParts,
    uint(rows.length, 2, 'row count'), ...rowParts,
  );
  return concat(body.slice(0, 8), uint(body.length + 4, 4, 'total length'), body.slice(8));
}

export function decodeAtomicMessageBusCallManifest(bytes: Uint8Array): AtomicMessageBusCallManifest {
  const reader = new Reader(bytes);
  if (binToHex(reader.take(8, 'domain')) !== ATOMIC_MESSAGE_BUS_DOMAIN) {
    throw new Error('messageBus: invalid atomic callManifest domain');
  }
  if (reader.uint(4, 'total length') !== bytes.length) {
    throw new Error('messageBus: atomic callManifest length mismatch');
  }
  const participantCount = reader.uint(1, 'participant count');
  if (participantCount < 2 || participantCount > ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS) {
    throw new Error('messageBus: atomic participant count is out of range');
  }
  const participants: AtomicParticipant[] = [];
  for (let index = 0; index < participantCount; index += 1) {
    const fixedSize = reader.uint(2, `participant ${index}.fixedSize`);
    const actualSize = reader.uint(2, `participant ${index}.actualSize`);
    const lockingBytecode = binToHex(reader.frame(`participant ${index}.lockingBytecode`));
    const stateCategory = binToHex(reader.take(32, `participant ${index}.stateCategory`));
    const maximumSize = reader.uint(2, `participant ${index}.maximumSize`);
    const trailingUsed = reader.uint(2, `participant ${index}.trailingUsed`);
    const returnOffset = reader.uint(2, `participant ${index}.returnOffset`);
    if (fixedSize < 1 || actualSize !== fixedSize + trailingUsed || actualSize > maximumSize
      || lockingBytecode.length === 0) {
      throw new Error(`messageBus: participant ${index} has a non-canonical variable span`);
    }
    if (returnOffset !== 0xffff && returnOffset >= fixedSize) {
      throw new Error(`messageBus: participant ${index} has an out-of-block return output`);
    }
    participants.push({
      fixedSize, actualSize, maximumSize, lockingBytecode, stateCategory,
      trailingUsed, returnOffset,
    });
  }
  const rowCount = reader.uint(2, 'row count');
  if (rowCount > ATOMIC_MESSAGE_BUS_MAX_ROWS) throw new Error('messageBus: atomic row count is out of range');
  const rows: AtomicRow[] = [];
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
    if (kind > 6 || kind === 5 || owner >= participantCount || consumer >= participantCount) {
      throw new Error(`messageBus: row ${index} has an invalid kind or participant`);
    }
    rows.push({
      kind, owner, consumer, slot, mode, sourceOffset, targetOffset, selectorHex, position,
      parent, depth, subtreeEnd,
      subjectHex, argsHex, resultHex, effectHex,
    });
  }
  if (!reader.eof()) throw new Error('messageBus: trailing bytes after atomic callManifest');
  return { participants, rows };
}

export interface AtomicPhysicalLayout {
  participantInputs: readonly number[];
  verifierInputs: readonly number[];
  /** Canonical messageEnvelope source: the final verifier in the verifier region. */
  verifierInput: number;
  feeInput: number;
  totalSlots: number;
}

/** Participant blocks occupy the prefix; one verifier per participant and the fee/change pair follow it. */
export function atomicMessageBusPhysicalLayout(blockSizes: readonly number[]): AtomicPhysicalLayout {
  if (blockSizes.length < 2 || blockSizes.length > ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS) {
    throw new Error(`messageBus: participant count must be in [2, ${ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS}]`);
  }
  const participantInputs: number[] = [];
  let cursor = 0;
  blockSizes.forEach((size, participant) => {
    if (!Number.isSafeInteger(size) || size < 1) {
      throw new Error(`messageBus: participant ${participant} block size must be a positive integer`);
    }
    participantInputs.push(cursor);
    cursor += size;
  });
  const verifierInputs = blockSizes.map((_size, participant) => cursor + participant);
  return Object.freeze({
    participantInputs: Object.freeze(participantInputs),
    verifierInputs: Object.freeze(verifierInputs),
    verifierInput: verifierInputs[verifierInputs.length - 1],
    feeInput: cursor + blockSizes.length,
    totalSlots: cursor + blockSizes.length + 1,
  });
}

/** Bytes carried by each verifier; the final participant verifier is the canonical callManifest source. */
export function encodeAtomicMessageEnvelope(callManifest: AtomicMessageBusCallManifest): Uint8Array {
  const encoded = encodeAtomicMessageBusCallManifest(callManifest);
  const messageEnvelope = concat(hexToBin('4c334331'), uint(encoded.length, 4, 'messageEnvelope length'), encoded);
  if (messageEnvelope.length < ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES) {
    throw new Error(
      `messageBus: atomic messageEnvelope must be at least ${ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES} bytes`,
    );
  }
  return messageEnvelope;
}

export function decodeAtomicMessageEnvelope(messageEnvelope: Uint8Array): AtomicMessageBusCallManifest {
  if (messageEnvelope.length < ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES) {
    throw new Error(
      `messageBus: atomic messageEnvelope must be at least ${ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES} bytes`,
    );
  }
  const reader = new Reader(messageEnvelope);
  if (binToHex(reader.take(4, 'messageEnvelope domain')) !== '4c334331') {
    throw new Error('messageBus: invalid atomic messageEnvelope domain');
  }
  const callManifest = reader.take(reader.uint(4, 'messageEnvelope length'), 'messageEnvelope callManifest');
  if (!reader.eof()) throw new Error('messageBus: trailing bytes after atomic messageEnvelope');
  return decodeAtomicMessageBusCallManifest(callManifest);
}
