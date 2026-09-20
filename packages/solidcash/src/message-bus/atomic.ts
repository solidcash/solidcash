import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  ATOMIC_MESSAGE_BUS_DOMAIN_HEX, ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS, ATOMIC_MESSAGE_BUS_MAX_ROWS,
} from '@solidcash/utils';

/** Atomic single-transaction bus wire domain: ASCII `L3BUS1\0\0`. */
export const ATOMIC_MESSAGE_BUS_DOMAIN = ATOMIC_MESSAGE_BUS_DOMAIN_HEX;
/** Upgrade-capable wire domain: ASCII `L3BUS2\0\0`. V1 remains byte-for-byte stable for ordinary graphs. */
export const ATOMIC_MESSAGE_BUS_DOMAIN_V2 = '4c33425553320000';
/** Lifecycle-capable wire domain: ASCII `L3BUS3\0\0`. */
export const ATOMIC_MESSAGE_BUS_DOMAIN_V3 = '4c33425553330000';
/** Transaction-signature provenance domain: ASCII `L3BUS4\0\0`. */
export const ATOMIC_MESSAGE_BUS_DOMAIN_V4 = '4c33425553340000';
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

export interface AtomicParticipantLifecycle {
  version: 1;
  kind: 'split' | 'merge' | 'selfdestruct';
  /** Number of masters created or consumed, excluding the preserved master. Selfdestruct uses 1. */
  count: number;
  /** Semantic input/output spans. The balanced span includes the opposite side's explicit padding. */
  inputSpan: number;
  outputSpan: number;
  balancedSpan: number;
  inputTail: 'funding' | 'consumed-masters' | 'retired-master';
  outputTail: 'created-masters' | 'reclaim';
}

export interface AtomicParticipant {
  /** Covenant identity consumed by this participant. */
  lockingBytecode: string;
  /**
   * Covenant identity created by this participant. Omitted is the canonical V1 spelling and means
   * `lockingBytecode`. A distinct value selects the V2 manifest, where both identities are authenticated.
   */
  outputLockingBytecode?: string;
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
  /** Compiler-derived lifecycle geometry. It is never accepted as an invocation/composer witness. */
  lifecycle?: AtomicParticipantLifecycle;
}

export interface AtomicRow {
  /** Stable row kind. 0 invocation, 1 resource, 2 event, 3 value, 4 token, 5 deployment, 6 sidecar. */
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
  /** KTS1 compiler-derived signature provenance. Signature bytes remain outside the manifest to avoid a hash cycle. */
  transactionSignatureFrameHex?: string;
}

export interface AtomicMessageBusCallManifest {
  /** V2 authenticates outputs, V3 lifecycle geometry, and V4 transaction-signature provenance. */
  version?: 1 | 2 | 3 | 4;
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

const validateTransactionSignatureFrame = (bytes: Uint8Array, field: string): void => {
  if (bytes.length === 0) return;
  const reader = new Reader(bytes);
  if (binToHex(reader.take(4, `${field}.domain`)) !== '4b545331') {
    throw new Error(`messageBus: ${field} has an invalid KTS1 domain`);
  }
  if (reader.uint(1, `${field}.hashType`) !== 1) {
    throw new Error(`messageBus: ${field} does not require SIGHASH_ALL`);
  }
  const parameters = reader.uint(1, `${field}.parameterCount`);
  if (parameters === 0) throw new Error(`messageBus: ${field} has no signature parameters`);
  let prior = -1;
  for (let parameter = 0; parameter < parameters; parameter += 1) {
    const index = reader.uint(2, `${field}.parameterIndex`);
    if (index <= prior) throw new Error(`messageBus: ${field} parameter indices are not canonical`);
    prior = index;
    const leaves = reader.uint(1, `${field}.leafCount`);
    if (leaves === 0) throw new Error(`messageBus: ${field} has an empty signature leaf set`);
    for (let leaf = 0; leaf < leaves; leaf += 1) {
      const depth = reader.uint(1, `${field}.pathDepth`);
      for (let segment = 0; segment < depth; segment += 1) {
        const kind = reader.uint(1, `${field}.pathKind`);
        if (kind > 1) throw new Error(`messageBus: ${field} has an unknown signature path segment`);
        reader.take(2, `${field}.pathValue`);
      }
      reader.take(32, `${field}.coveredBytecodeHash`);
    }
  }
  if (!reader.eof()) throw new Error(`messageBus: ${field} has trailing signature provenance bytes`);
};

export function encodeAtomicMessageBusCallManifest(callManifest: AtomicMessageBusCallManifest): Uint8Array {
  const { participants, rows } = callManifest;
  const requiresV2 = participants.some((participant) => participant.outputLockingBytecode !== undefined
    && participant.outputLockingBytecode.toLowerCase() !== participant.lockingBytecode.toLowerCase());
  const requiresV3 = participants.some((participant) => participant.lifecycle !== undefined);
  const requiresV4 = rows.some((row) => (row.transactionSignatureFrameHex?.length ?? 0) > 0);
  const version = callManifest.version ?? (requiresV4 ? 4 : requiresV3 ? 3 : requiresV2 ? 2 : 1);
  if (version === 1 && requiresV2) {
    throw new Error('messageBus: atomic V1 cannot authenticate a distinct participant output locking bytecode');
  }
  if (version < 3 && requiresV3) {
    throw new Error('messageBus: atomic V1/V2 cannot authenticate participant lifecycle geometry');
  }
  if (version < 4 && requiresV4) {
    throw new Error('messageBus: atomic V1/V2/V3 cannot authenticate transaction-signature provenance');
  }
  if (version === 2 && !requiresV2) {
    throw new Error('messageBus: atomic V2 requires at least one distinct participant output locking bytecode');
  }
  if (version === 3 && !requiresV3) {
    throw new Error('messageBus: atomic V3 requires at least one lifecycle participant');
  }
  if (version === 4 && !requiresV4) {
    throw new Error('messageBus: atomic V4 requires transaction-signature provenance');
  }
  if (participants.length < 2 || participants.length > ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS) {
    throw new Error(`messageBus: participant count must be in [2, ${ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS}]`);
  }
  if (rows.length > ATOMIC_MESSAGE_BUS_MAX_ROWS) {
    const rowCounts = rows.reduce<Record<number, number>>((counts, row) => {
      counts[row.kind] = (counts[row.kind] ?? 0) + 1;
      return counts;
    }, {});
    const breakdown = [
      ['invocations', 0], ['resources', 1], ['events', 2], ['values', 3], ['tokens', 4],
      ['deployments', 5], ['sidecars', 6],
    ].map(([label, kind]) => `${label}=${rowCounts[kind as number] ?? 0}`).join(', ');
    throw new Error(
      `messageBus: callManifest row count ${rows.length} exceeds ${ATOMIC_MESSAGE_BUS_MAX_ROWS} (${breakdown})`,
    );
  }
  const participantParts = participants.map((participant, index) => {
    const lifecycle = participant.lifecycle;
    if (version >= 3 && participant.outputLockingBytecode === undefined) {
      throw new Error(`messageBus: atomic V${version} participant ${index} must spell its output locking bytecode`);
    }
    if (lifecycle !== undefined) {
      const split = lifecycle.kind === 'split';
      const retired = lifecycle.kind === 'selfdestruct';
      const expected = retired ? {
        version: 1 as const, kind: 'selfdestruct' as const, count: 1,
        inputSpan: 1, outputSpan: 1, balancedSpan: 1,
        inputTail: 'retired-master' as const, outputTail: 'reclaim' as const,
      } : {
        version: 1 as const, kind: lifecycle.kind, count: lifecycle.count,
        inputSpan: split ? 1 : lifecycle.count + 1,
        outputSpan: split ? lifecycle.count + 1 : 1,
        balancedSpan: lifecycle.count + 1,
        inputTail: split ? 'funding' as const : 'consumed-masters' as const,
        outputTail: split ? 'created-masters' as const : 'reclaim' as const,
      };
      if (!Number.isSafeInteger(lifecycle.count) || lifecycle.count < 1 || lifecycle.count >= 0xffff
        || Object.entries(expected).some(([key, value]) =>
          lifecycle[key as keyof AtomicParticipantLifecycle] !== value)) {
        throw new Error(`messageBus: participant ${index} has non-canonical lifecycle geometry`);
      }
      const expectedTrailing = retired ? 0 : lifecycle.count;
      if (participant.fixedSize !== 1 || participant.actualSize !== expected.balancedSpan
        || participant.maximumSize !== expected.balancedSpan || participant.trailingUsed !== expectedTrailing
        || participant.returnOffset !== 0xffff) {
        throw new Error(`messageBus: participant ${index} lifecycle does not occupy its exact balanced span`);
      }
    }
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
    const outputLbc = checkedHex(
      participant.outputLockingBytecode ?? participant.lockingBytecode,
      undefined,
      `participant ${index} output locking bytecode`,
    );
    if (outputLbc.length === 0) {
      throw new Error(`messageBus: participant ${index} output locking bytecode is empty`);
    }
    const category = checkedHex(participant.stateCategory, 32, `participant ${index} master category`);
    if (participant.returnOffset !== 0xffff && participant.returnOffset >= participant.fixedSize) {
      throw new Error(`messageBus: participant ${index} has an out-of-block return output`);
    }
    return concat(
      uint(participant.fixedSize, 2, 'participant fixed size'),
      uint(participant.actualSize, 2, 'participant actual size'),
      frame(lbc, 'locking bytecode'),
      ...(version >= 2 ? [frame(outputLbc, 'output locking bytecode')] : []),
      category,
      uint(participant.maximumSize, 2, 'participant maximum size'),
      uint(participant.trailingUsed, 2, 'participant trailing use'),
      uint(participant.returnOffset, 2, 'return output offset'),
      ...(version >= 3 ? [
        uint(lifecycle === undefined ? 0
          : lifecycle.kind === 'split' ? 1
            : lifecycle.kind === 'merge' ? 2 : 3, 1, 'lifecycle mode'),
        uint(lifecycle?.count ?? 0, 2, 'lifecycle count'),
      ] : []),
    );
  });
  const rowParts = rows.map((row, index) => {
    if (row.kind < 0 || row.kind > 6) {
      throw new Error(`messageBus: row ${index} has an unknown kind`);
    }
    if (row.owner >= participants.length || row.consumer >= participants.length) {
      throw new Error(`messageBus: row ${index} names an unknown participant`);
    }
    const selector = checkedHex(row.selectorHex, 4, `row ${index} selector`);
    const subject = checkedHex(row.subjectHex, undefined, `row ${index} subject`);
    const args = checkedHex(row.argsHex, undefined, `row ${index} arguments`);
    const result = checkedHex(row.resultHex, undefined, `row ${index} result`);
    const effect = checkedHex(row.effectHex, undefined, `row ${index} effect`);
    const signatureFrame = checkedHex(
      row.transactionSignatureFrameHex ?? '', undefined, `row ${index} transaction signature frame`,
    );
    if (signatureFrame.length > 0 && row.kind !== 0) {
      throw new Error(`messageBus: row ${index} attaches transaction-signature provenance to a non-invocation row`);
    }
    validateTransactionSignatureFrame(signatureFrame, `row ${index} transaction signature frame`);
    return concat(
      uint(row.kind, 1, 'row kind'), uint(row.owner, 1, 'row owner'),
      uint(row.consumer, 1, 'row consumer'), uint(row.slot, 2, 'row slot'),
      uint(row.mode, 1, 'row mode'), uint(row.sourceOffset, 2, 'row source offset'),
      uint(row.targetOffset, 2, 'row target offset'), selector,
      uint(row.position, 2, 'row position'), uint(row.parent, 2, 'row parent'),
      uint(row.depth, 1, 'row depth'), uint(row.subtreeEnd, 2, 'row subtree end'),
      frame(subject, 'row subject'), frame(args, 'row arguments'),
      frame(result, 'row result'), frame(effect, 'row effect'),
      ...(version === 4 ? [frame(signatureFrame, 'row transaction signature frame')] : []),
    );
  });
  const body = concat(
    hexToBin(version === 4 ? ATOMIC_MESSAGE_BUS_DOMAIN_V4 : version === 3 ? ATOMIC_MESSAGE_BUS_DOMAIN_V3
      : version === 2 ? ATOMIC_MESSAGE_BUS_DOMAIN_V2 : ATOMIC_MESSAGE_BUS_DOMAIN),
    uint(participants.length, 1, 'participant count'), ...participantParts,
    uint(rows.length, 2, 'row count'), ...rowParts,
  );
  return concat(body.slice(0, 8), uint(body.length + 4, 4, 'total length'), body.slice(8));
}

export function decodeAtomicMessageBusCallManifest(bytes: Uint8Array): AtomicMessageBusCallManifest {
  const reader = new Reader(bytes);
  const domain = binToHex(reader.take(8, 'domain'));
  const version = domain === ATOMIC_MESSAGE_BUS_DOMAIN ? 1
    : domain === ATOMIC_MESSAGE_BUS_DOMAIN_V2 ? 2
      : domain === ATOMIC_MESSAGE_BUS_DOMAIN_V3 ? 3
        : domain === ATOMIC_MESSAGE_BUS_DOMAIN_V4 ? 4 : undefined;
  if (version === undefined) {
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
    const outputLockingBytecode = version >= 2
      ? binToHex(reader.frame(`participant ${index}.outputLockingBytecode`)) : undefined;
    const stateCategory = binToHex(reader.take(32, `participant ${index}.stateCategory`));
    const maximumSize = reader.uint(2, `participant ${index}.maximumSize`);
    const trailingUsed = reader.uint(2, `participant ${index}.trailingUsed`);
    const returnOffset = reader.uint(2, `participant ${index}.returnOffset`);
    const lifecycleMode = version >= 3 ? reader.uint(1, `participant ${index}.lifecycleMode`) : 0;
    const lifecycleCount = version >= 3 ? reader.uint(2, `participant ${index}.lifecycleCount`) : 0;
    if (lifecycleMode > 3 || (lifecycleMode === 0) !== (lifecycleCount === 0)
      || (lifecycleMode === 3 && lifecycleCount !== 1)) {
      throw new Error(`messageBus: participant ${index} has non-canonical lifecycle geometry`);
    }
    const lifecycle = lifecycleMode === 0 ? undefined : lifecycleMode === 1 ? {
      version: 1 as const, kind: 'split' as const, count: lifecycleCount,
      inputSpan: 1, outputSpan: lifecycleCount + 1, balancedSpan: lifecycleCount + 1,
      inputTail: 'funding' as const, outputTail: 'created-masters' as const,
    } : lifecycleMode === 2 ? {
      version: 1 as const, kind: 'merge' as const, count: lifecycleCount,
      inputSpan: lifecycleCount + 1, outputSpan: 1, balancedSpan: lifecycleCount + 1,
      inputTail: 'consumed-masters' as const, outputTail: 'reclaim' as const,
    } : {
      version: 1 as const, kind: 'selfdestruct' as const, count: 1,
      inputSpan: 1, outputSpan: 1, balancedSpan: 1,
      inputTail: 'retired-master' as const, outputTail: 'reclaim' as const,
    };
    if (lifecycle !== undefined && (fixedSize !== 1 || actualSize !== lifecycle.balancedSpan
      || maximumSize !== lifecycle.balancedSpan
      || trailingUsed !== (lifecycle.kind === 'selfdestruct' ? 0 : lifecycle.count)
      || returnOffset !== 0xffff)) {
      throw new Error(`messageBus: participant ${index} lifecycle does not occupy its exact balanced span`);
    }
    if (fixedSize < 1 || actualSize !== fixedSize + trailingUsed || actualSize > maximumSize
      || lockingBytecode.length === 0 || (version >= 2 && outputLockingBytecode!.length === 0)) {
      throw new Error(`messageBus: participant ${index} has a non-canonical variable span`);
    }
    if (returnOffset !== 0xffff && returnOffset >= fixedSize) {
      throw new Error(`messageBus: participant ${index} has an out-of-block return output`);
    }
    participants.push({
      fixedSize, actualSize, maximumSize, lockingBytecode, stateCategory,
      trailingUsed, returnOffset,
      ...(version >= 2 && { outputLockingBytecode }),
      ...(lifecycle && { lifecycle }),
    });
  }
  if (version === 2 && !participants.some((participant) =>
    participant.outputLockingBytecode!.toLowerCase() !== participant.lockingBytecode.toLowerCase())) {
    throw new Error('messageBus: atomic V2 requires at least one distinct participant output locking bytecode');
  }
  if (version === 3 && !participants.some((participant) => participant.lifecycle !== undefined)) {
    throw new Error('messageBus: atomic V3 requires at least one lifecycle participant');
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
    const transactionSignatureFrameHex = version === 4
      ? binToHex(reader.frame(`row ${index}.transactionSignatureFrame`)) : '';
    validateTransactionSignatureFrame(
      hexToBin(transactionSignatureFrameHex), `row ${index} transaction signature frame`,
    );
    if (transactionSignatureFrameHex.length > 0 && kind !== 0) {
      throw new Error(`messageBus: row ${index} attaches transaction-signature provenance to a non-invocation row`);
    }
    if (kind > 6 || owner >= participantCount || consumer >= participantCount) {
      throw new Error(`messageBus: row ${index} has an invalid kind or participant`);
    }
    rows.push({
      kind, owner, consumer, slot, mode, sourceOffset, targetOffset, selectorHex, position,
      parent, depth, subtreeEnd,
      subjectHex, argsHex, resultHex, effectHex,
      ...(version === 4 && transactionSignatureFrameHex.length > 0 && { transactionSignatureFrameHex }),
    });
  }
  if (version === 4 && !rows.some((row) => (row.transactionSignatureFrameHex?.length ?? 0) > 0)) {
    throw new Error('messageBus: atomic V4 requires transaction-signature provenance');
  }
  if (!reader.eof()) throw new Error('messageBus: trailing bytes after atomic callManifest');
  return { ...(version > 1 && { version }), participants, rows };
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
