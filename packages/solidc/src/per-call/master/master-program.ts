/**
 * Publishing a compiled master program.
 *
 * A master script reserves a zero-filled push for its state category and one for the address it presents as
 * `address(this)`. Both are only known once the contract is deployed, so the compiler reserves them, records where
 * they landed in the finished script, and publishes that in `artifact.composition` for deployment to fill.
 *
 * The offsets are located in the emitted bytes rather than tracked through code generation, because the
 * optimiser rewrites the script between emission and publication; a slot is found by its exact reserved push.
 */

import {
  bytesEqual, encodeInt, Op, scriptToBytecode, type Script,
} from '@solidcash/utils';
import { SolidcDiagnosticError } from '../../Errors.js';
import {
  ADDRESS_SLOT_LENGTH,
  CATEGORY_SLOT_LENGTH,
  placeholderPrefixLength,
  placeholderPush,
} from './placeholders.js';

/** The internal option that marks this compile as a per-call master. */
export interface PerCallMasterOptionCarrier {
  __perCallMaster?: boolean;
}

/** True when this compile emits a per-call master program. */
export function isPerCallMaster(options: PerCallMasterOptionCarrier): boolean {
  return options.__perCallMaster === true;
}

/** Marks this compile as emitting a per-call master program. */
export function setPerCallMaster(options: PerCallMasterOptionCarrier): void {
  options.__perCallMaster = true;
}

/**
 * Locates the reserved category, address and (when declared) validator-program-hash slots in a finished master.
 *
 * Each slot is a zero-filled push of a fixed length, so its byte pattern is unique in a real script; a script with
 * zero or several matches is refused rather than publishing an offset a fill would write to the wrong place. The
 * category and validator-program-hash slots are both 32-byte zero pushes and so identical; they are told apart by
 * position, because the head emits the category slot first, in its prologue, and the validator hash slot later,
 * inside the frame checks.
 */
export function findPlaceholderOffsets(
  script: Uint8Array,
  declaresTemplateHash = false,
): { categoryOffset: number; addressOffset: number; templateHashOffset?: number } {
  const categoryLengthSlots = allOffsets(script, placeholderPush(CATEGORY_SLOT_LENGTH));
  const expectedCategorySlots = declaresTemplateHash ? 2 : 1;
  if (categoryLengthSlots.length !== expectedCategorySlots) {
    throw new SolidcDiagnosticError(
      'PER_CALL_CODEGEN_UNAVAILABLE',
      `the compiled master reserves a ${CATEGORY_SLOT_LENGTH}-byte slot ${categoryLengthSlots.length} times, `
      + `but its descriptor declares ${expectedCategorySlots}`,
      { matches: categoryLengthSlots, expected: expectedCategorySlots },
    );
  }
  const addressOffset = uniqueOffset(script, placeholderPush(ADDRESS_SLOT_LENGTH), 'address');
  return declaresTemplateHash
    ? { categoryOffset: categoryLengthSlots[0]!, addressOffset, templateHashOffset: categoryLengthSlots[1]! }
    : { categoryOffset: categoryLengthSlots[0]!, addressOffset };
}

/** Every offset at which `pattern` occurs, in script order. */
function allOffsets(script: Uint8Array, pattern: Uint8Array): number[] {
  const offsets: number[] = [];
  for (let index = 0; index + pattern.length <= script.length; index += 1) {
    if (bytesEqual(script.subarray(index, index + pattern.length), pattern)) offsets.push(index);
  }
  return offsets;
}

/**
 * Points the self-settlement census at the address slot the finished script actually contains.
 *
 * The census is emitted with the payload offset of the slot as it stood in the head. The optimiser then rewrites
 * the bytes before that slot, so the baked split would read past the address and a mutable token locked to the
 * contract would be refused. The slot itself is found afterwards, by its reserved push; this rewrites the census
 * to that payload. A master that does not settle its own records has no such read, and is left unchanged.
 */
export function alignCensusAddressOffset(script: Script, declaresTemplateHash: boolean): Script {
  let current = script;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const aligned = retargetCensusAddress(current, declaresTemplateHash);
    if (aligned === current) return current;
    current = aligned;
  }
  throw new SolidcDiagnosticError(
    'PER_CALL_CODEGEN_UNAVAILABLE',
    'the census address offset did not settle on the reserved address slot',
    {},
  );
}

/**
 * The trailing room a master's own input needs to pay for its own execution.
 *
 * An input's operation-cost budget is a density over the bytecode that spends it — `800` units per byte of the
 * input's unlocking bytecode, which carries the master's program. A body's cost grows with the number of calls its
 * execution makes, because every call binds a record, closes a segment and walks to the next, while those calls add
 * only a few bytes of records and segments to the program. A master that makes one call therefore fits its own
 * budget and a master that makes several runs out of it. The padding block is a data push per chunk, dropped where
 * the program ends: it lengthens the bytecode the budget is measured over, costs about a byte's worth of budget to
 * execute, and leaves the stack as it found it, so it changes nothing except the room an input has. Each chunk
 * stays under the push size limit, so a path that reaches the block pays for it rather than failing on it.
 */
export const PER_CALL_MASTER_PADDING_BYTES = 1024;
const PADDING_CHUNK_BYTES = 512;

/** Appends the padding block to a finished master script. */
export function padPerCallMasterScript(script: Script): Script {
  const padding: Script = [];
  for (let written = 0; written < PER_CALL_MASTER_PADDING_BYTES; written += PADDING_CHUNK_BYTES) {
    padding.push(new Uint8Array(PADDING_CHUNK_BYTES), Op.OP_DROP);
  }
  return [...script, ...padding];
}

/** One encoded push: `start` is its first byte and `end` is the byte after its payload. */
interface EncodedPush {
  readonly start: number;
  readonly end: number;
}

/** The offset pushes in `OP_ACTIVEBYTECODE <offset> OP_SPLIT OP_NIP <35> OP_SPLIT OP_DROP`. */
function censusAddressPushes(bytecode: Uint8Array): EncodedPush[] {
  const width = scriptToBytecode([encodeInt(BigInt(ADDRESS_SLOT_LENGTH))]);
  const sites: EncodedPush[] = [];
  for (let index = 0; index < bytecode.length; index += 1) {
    if (bytecode[index] !== Op.OP_ACTIVEBYTECODE) continue;
    const offsetPush = readEncodedPush(bytecode, index + 1);
    if (offsetPush === undefined) continue;
    let cursor = offsetPush.end;
    if (bytecode[cursor] !== Op.OP_SPLIT || bytecode[cursor + 1] !== Op.OP_NIP) continue;
    cursor += 2;
    const widthPush = readEncodedPush(bytecode, cursor);
    if (widthPush === undefined) continue;
    if (!bytesEqual(bytecode.subarray(widthPush.start, widthPush.end), width)) continue;
    cursor = widthPush.end;
    if (bytecode[cursor] !== Op.OP_SPLIT || bytecode[cursor + 1] !== Op.OP_DROP) continue;
    sites.push(offsetPush);
  }
  return sites;
}

function readEncodedPush(bytecode: Uint8Array, at: number): EncodedPush | undefined {
  if (at >= bytecode.length) return undefined;
  const opcode = bytecode[at]!;
  if (opcode === Op.OP_0 || opcode === Op.OP_1NEGATE || (opcode >= Op.OP_1 && opcode <= Op.OP_16)) {
    return { start: at, end: at + 1 };
  }
  let header = 0;
  let length = 0;
  if (opcode >= 0x01 && opcode <= 0x4b) {
    header = 1;
    length = opcode;
  } else if (opcode === Op.OP_PUSHDATA_1) {
    if (at + 1 >= bytecode.length) return undefined;
    header = 2;
    length = bytecode[at + 1]!;
  } else if (opcode === Op.OP_PUSHDATA_2) {
    if (at + 2 >= bytecode.length) return undefined;
    header = 3;
    length = bytecode[at + 1]! | (bytecode[at + 2]! << 8);
  } else if (opcode === Op.OP_PUSHDATA_4) {
    if (at + 4 >= bytecode.length) return undefined;
    header = 5;
    length = bytecode[at + 1]!
      | (bytecode[at + 2]! << 8)
      | (bytecode[at + 3]! << 16)
      | (bytecode[at + 4]! << 24);
  } else {
    return undefined;
  }
  const end = at + header + length;
  if (end > bytecode.length) return undefined;
  return { start: at, end };
}

/**
 * Rewrites each census offset to the address payload, returning the same script when there is nothing to do.
 *
 * The two reads sit after the slot, so a same-length rewrite cannot move the slot. A rewrite that changes the
 * push's length is applied once and the caller measures the slot again.
 */
function retargetCensusAddress(script: Script, declaresTemplateHash: boolean): Script {
  const bytecode = scriptToBytecode(script);
  const payload = findPlaceholderOffsets(bytecode, declaresTemplateHash).addressOffset
    + placeholderPrefixLength(ADDRESS_SLOT_LENGTH);
  const desired = scriptToBytecode([encodeInt(BigInt(payload))]);
  const sites = censusAddressPushes(bytecode);
  if (sites.length === 0) return script;
  if (sites.every((site) => bytesEqual(bytecode.subarray(site.start, site.end), desired))) return script;
  const indexes = sites.map((site) => elementIndexCovering(script, site));
  return script.map((element, index) => (indexes.includes(index) ? encodeInt(BigInt(payload)) : element));
}

/** The script element whose encoding is exactly the push `site` names. */
function elementIndexCovering(script: Script, site: EncodedPush): number {
  const want = site.end - site.start;
  let at = 0;
  for (let index = 0; index < script.length; index += 1) {
    const size = scriptToBytecode([script[index]!]).length;
    if (at === site.start && size === want) return index;
    at += size;
  }
  throw new SolidcDiagnosticError(
    'PER_CALL_CODEGEN_UNAVAILABLE',
    `the census address offset at byte ${site.start} is not one script element`,
    { start: site.start, end: site.end },
  );
}

function uniqueOffset(script: Uint8Array, pattern: Uint8Array, what: string): number {
  const offsets = allOffsets(script, pattern);
  if (offsets.length > 1) {
    throw new SolidcDiagnosticError(
      'PER_CALL_CODEGEN_UNAVAILABLE',
      `the compiled master reserves its ${what} slot more than once, so no single offset identifies it`,
      { slot: what, matches: offsets },
    );
  }
  if (offsets.length === 0) {
    throw new SolidcDiagnosticError(
      'PER_CALL_CODEGEN_UNAVAILABLE',
      `the compiled master does not contain its reserved ${what} slot`,
      { slot: what },
    );
  }
  return offsets[0]!;
}
