import type { AbiFunction } from '@solidcash/utils';

/**
 * The call-wide union determines physical run order, not which runs this envelope mutates. An explicitly
 * empty per-function write list is authoritative. Only missing legacy metadata needs the broad fallback.
 */
export function resolveSelectedDynamicWrites(
  allDynamicWrites: readonly string[],
  selectedFunctions: readonly Pick<AbiFunction, 'dynamicWrites'>[] | undefined,
): readonly string[] {
  if (selectedFunctions === undefined || selectedFunctions.some((handler) => handler.dynamicWrites === undefined)) {
    return allDynamicWrites;
  }
  return [...new Set(selectedFunctions.flatMap((handler) => handler.dynamicWrites ?? []))];
}
