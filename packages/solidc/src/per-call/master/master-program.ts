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

import { bytesEqual } from '@solidcash/utils';
import { SolidcDiagnosticError } from '../../Errors.js';
import {
  ADDRESS_SLOT_LENGTH,
  CATEGORY_SLOT_LENGTH,
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
