/**
 * Byte primitives for the composition wire formats.
 *
 * All integers are unsigned little-endian. `lp16` is a byte string with a 2-byte length prefix, `lp32` one with a
 * 4-byte prefix. Decoding is exact: every read is bounds-checked and a decoder that finishes a structure requires
 * the payload to be fully consumed, so a trailing byte is a rejection rather than a silently ignored suffix.
 */

/** Raised whenever a composition payload is malformed, truncated, or non-canonical. */
export class FramedEncodingError extends Error {
  constructor(
    message: string,
    readonly offset?: number,
  ) {
    super(offset === undefined ? message : `${message} (at byte ${offset})`);
    this.name = 'FramedEncodingError';
  }
}

/** Sentinel index meaning "absent" in a transcript or a record entry. */
export const INDEX_NONE = 0xffff;

/** Appends fields to a payload. Every method returns `this` so calls chain. */
export class ByteWriter {
  private readonly chunks: Uint8Array[] = [];

  pushByte(value: number): this {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) {
      throw new FramedEncodingError(`byte out of range: ${String(value)}`);
    }
    return this.pushBytes(new Uint8Array([value]));
  }

  pushUint16(value: number): this {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new FramedEncodingError(`uint16 out of range: ${String(value)}`);
    }
    return this.pushBytes(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  pushUint32(value: number): this {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
      throw new FramedEncodingError(`uint32 out of range: ${String(value)}`);
    }
    return this.pushBytes(new Uint8Array([
      value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff,
    ]));
  }

  pushUint64(value: bigint): this {
    if (value < 0n || value > 0xffffffffffffffffn) {
      throw new FramedEncodingError(`uint64 out of range: ${value}`);
    }
    const out = new Uint8Array(8);
    let rest = value;
    for (let index = 0; index < 8; index += 1) {
      out[index] = Number(rest & 0xffn);
      rest >>= 8n;
    }
    return this.pushBytes(out);
  }

  pushBytes(bytes: Uint8Array): this {
    if (!(bytes instanceof Uint8Array)) throw new FramedEncodingError('expected a byte array');
    this.chunks.push(bytes);
    return this;
  }

  /** `lp16`: a 2-byte length prefix followed by the payload. */
  pushLp16(bytes: Uint8Array): this {
    if (bytes.length > 0xffff) throw new FramedEncodingError(`lp16 payload too long: ${bytes.length}`);
    return this.pushUint16(bytes.length).pushBytes(bytes);
  }

  /** `lp32`: a 4-byte length prefix followed by the payload. */
  pushLp32(bytes: Uint8Array): this {
    if (bytes.length > 0xffffffff) throw new FramedEncodingError(`lp32 payload too long: ${bytes.length}`);
    return this.pushUint32(bytes.length).pushBytes(bytes);
  }

  /** A `u16`-counted list whose elements are written by `writeElement`. */
  pushCounted16<T>(items: readonly T[], writeElement: (writer: ByteWriter, item: T, index: number) => void): this {
    if (items.length > 0xffff) throw new FramedEncodingError(`counted list too long: ${items.length}`);
    this.pushUint16(items.length);
    items.forEach((item, index) => writeElement(this, item, index));
    return this;
  }

  finish(): Uint8Array {
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

/** Reads fields from a payload, rejecting truncation and any trailing byte at `assertEnd`. */
export class ByteReader {
  private offset = 0;

  constructor(private readonly data: Uint8Array) {}

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.data.length - this.offset;
  }

  readBytes(length: number): Uint8Array {
    if (!Number.isInteger(length) || length < 0) {
      throw new FramedEncodingError(`invalid byte length: ${String(length)}`, this.offset);
    }
    if (this.remaining < length) {
      throw new FramedEncodingError(`truncated: wanted ${length} byte(s), ${this.remaining} left`, this.offset);
    }
    const out = this.data.slice(this.offset, this.offset + length);
    this.offset += length;
    return out;
  }

  readByte(): number {
    return this.readBytes(1)[0]!;
  }

  readUint16(): number {
    const bytes = this.readBytes(2);
    return bytes[0]! | (bytes[1]! << 8);
  }

  readUint32(): number {
    const bytes = this.readBytes(4);
    return (bytes[0]! | (bytes[1]! << 8) | (bytes[2]! << 16) | (bytes[3]! << 24)) >>> 0;
  }

  readUint64(): bigint {
    const bytes = this.readBytes(8);
    let value = 0n;
    for (let index = 7; index >= 0; index -= 1) value = (value << 8n) | BigInt(bytes[index]!);
    return value;
  }

  readLp16(): Uint8Array {
    return this.readBytes(this.readUint16());
  }

  readLp32(): Uint8Array {
    return this.readBytes(this.readUint32());
  }

  /** Reads a `u16`-counted list whose elements are read by `readElement`. */
  readCounted16<T>(readElement: (reader: ByteReader, index: number) => T): T[] {
    const count = this.readUint16();
    const out: T[] = [];
    for (let index = 0; index < count; index += 1) out.push(readElement(this, index));
    return out;
  }

  /** Requires that the payload is fully consumed, so nothing follows the last field. */
  assertEnd(): void {
    if (this.remaining !== 0) {
      throw new FramedEncodingError(`${this.remaining} trailing byte(s) after the last field`, this.offset);
    }
  }
}

/** Concatenates byte arrays. */
export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * The minimal push of `data`, byte-identical to libauth's `encodeDataPush`: an empty push is OP_0, a single byte 1..16
 * is OP_N and 0x81 is OP_1NEGATE, up to 75 bytes is a direct push, then PUSHDATA1/2/4 with a little-endian length.
 * The framed derivation pushes whole redeem scripts for every program it evaluates, so a push of a buffer it already
 * pushed is returned as it was built; see `minimalPushCache`.
 */
export function encodeMinimalDataPush(data: Uint8Array): Uint8Array {
  const cached = minimalPushCache.get(data);
  if (cached !== undefined) return cached;
  const push = minimalDataPush(data);
  minimalPushCache.set(data, push);
  return push;
}

/**
 * The encoded push last built for a buffer. The framed composer pushes the same redeem script (thousands of bytes)
 * and the same argument buffers on every attempt, and each push is a fresh copy; remembering it removes that copy.
 * Keyed on the buffer itself, so a rewritten or freshly built array misses instead of reusing an old push.
 *
 * The push is handed out as it is stored, so both the input and the result are treated as immutable. The framed code
 * builds unlocking bytecode by concatenation, never by writing into a push it was given.
 */
const minimalPushCache = new WeakMap<Uint8Array, Uint8Array>();

function minimalDataPush(data: Uint8Array): Uint8Array {
  const { length } = data;
  if (length === 0) return Uint8Array.of(0x00);
  if (length === 1 && data[0] !== 0 && data[0] <= 16) return Uint8Array.of(data[0] + 0x50);
  if (length === 1 && data[0] === 0x81) return Uint8Array.of(0x4f);
  let header: number[];
  if (length <= 75) header = [length];
  else if (length <= 0xff) header = [0x4c, length];
  else if (length <= 0xffff) header = [0x4d, length & 0xff, length >>> 8];
  else header = [0x4e, length & 0xff, (length >>> 8) & 0xff, (length >>> 16) & 0xff, length >>> 24];
  const out = new Uint8Array(header.length + length);
  out.set(header, 0);
  out.set(data, header.length);
  return out;
}

/** Structural equality over byte arrays. */
export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/** Lowercase hex, for fixtures, diagnostics and vector files. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/** Parses lowercase or uppercase hex. An odd length or a non-hex digit is rejected. */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new FramedEncodingError(`odd hex length: ${hex.length}`);
  if (!/^[0-9a-fA-F]*$/.test(hex)) throw new FramedEncodingError('non-hex character');
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}
