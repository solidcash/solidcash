/**
 * Legacy planning heuristics isolated from the kernel builder path.
 *
 * Kernel artifacts (`messageBus.convention === 'kernel-row-loop'` or typed value-chunk /
 * state-transition descriptors) must never take these branches. Old Marketplace-shaped plans
 * that lack descriptors may opt in explicitly via `permitsLegacyNamedValueChunkFallback`.
 */

export type LegacyScalarNameHints = {
  decrement: boolean;
  zero: boolean;
  enable: boolean;
  disable: boolean;
  twice: boolean;
};

/** Name-regex scalar transition hints — legacy probe seed only. */
export function legacyScalarNameHints(functionName: string): LegacyScalarNameHints {
  return {
    decrement: /(?:dec|sub|minus|reduce|spend)/i.test(functionName),
    zero: /(?:reset|clear|zero)/i.test(functionName),
    enable: /(?:enable|arm|activate|start)/i.test(functionName),
    disable: /(?:disable|disarm|deactivate|stop)/i.test(functionName),
    twice: /(?:double|twice)/i.test(functionName),
  };
}

/** Historical JobEvent publisher ABI name — legacy value-chunk writer discovery only. */
export function legacyIsPublishJobEventName(name: string | undefined): boolean {
  return name === 'publishJobEvent';
}

/** True when any group name field is the historical publishJobEvent ABI (legacy only). */
export function legacyGroupLooksLikePublishJobEvent(group: {
  functionName?: string;
  logicalFunctionName?: string;
  compilerRoute?: { abiFunction?: { name?: string } };
}): boolean {
  return legacyIsPublishJobEventName(group.functionName)
    || legacyIsPublishJobEventName(group.logicalFunctionName)
    || legacyIsPublishJobEventName(group.compilerRoute?.abiFunction?.name);
}

/** Pre-descriptor plans did not publish a write operation. Use planned INSERTs when available. */
type LegacyValueChunkWriteGroup = {
  functionName?: string;
  logicalFunctionName?: string;
  plannedEntryInserts?: readonly unknown[];
};

export function legacyInitialValueChunkWrite(
  lowLevelGroups: readonly LegacyValueChunkWriteGroup[],
  externalGroups: readonly LegacyValueChunkWriteGroup[],
): boolean {
  if ([...lowLevelGroups, ...externalGroups].some(
    (group) => (group.plannedEntryInserts?.length ?? 0) > 0,
  )) return true;
  // Historical plans may also predate plannedEntryInserts. Keep their ABI compatibility here only.
  return lowLevelGroups.some((group) => group.functionName === 'publishJobPost')
    || externalGroups.some((group) =>
      (group.functionName ?? group.logicalFunctionName) === 'publishJobPost');
}

/** Historical jobEvents collection identity — legacy band packing only. */
export function legacyIsJobEventsCollection(collection: string | undefined): boolean {
  if (collection === undefined) return false;
  return /jobEvents/i.test(collection);
}

export const LEGACY_JOB_EVENTS_COLLECTION_ALIASES: readonly string[] = Object.freeze([
  'jobEvents',
  'jobEvents:mapping(uint256 => JobEventData[])',
  'jobEvents:mapping(uint256=>JobEventData[])',
]);

/**
 * Whether leftover integer/bool fields may be seeded from function-name regexes.
 * Kernel convention always returns false — typed arg→field matching may still run.
 */
export function permitsLegacyScalarNameHeuristics(
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
  artifactConvention?: 'legacy-unroll' | 'kernel-row-loop' | string,
): boolean {
  if (ownerConvention === 'kernel-row-loop') return false;
  if (artifactConvention === 'kernel-row-loop') return false;
  return true;
}
