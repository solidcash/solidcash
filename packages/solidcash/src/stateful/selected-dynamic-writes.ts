import type { AbiFunction } from '@solidcash/utils';

/**
 * The route-wide union determines physical run order, not which runs this envelope mutates. An explicitly
 * empty per-handler write list is authoritative. Only missing legacy metadata needs the broad fallback.
 */
export function resolveSelectedDynamicWrites(
  routeWrites: readonly string[],
  selectedHandlers: readonly Pick<AbiFunction, 'dynamicWrites'>[] | undefined,
): readonly string[] {
  if (selectedHandlers === undefined || selectedHandlers.some((handler) => handler.dynamicWrites === undefined)) {
    return routeWrites;
  }
  return [...new Set(selectedHandlers.flatMap((handler) => handler.dynamicWrites ?? []))];
}
