/**
 * Central registry for SOLIDC* / SOLIDCASH* process environment variables.
 *
 * Classes:
 * - observation: tracing/logging only; must not change bytecode or graph behavior
 * - instrumented: may alter emitted program for debugging; prohibited in release/default compile APIs
 * - feature: explicit compiler feature; must be included in artifact/cache identity when enabled
 *
 * Default: unknown SOLIDC_* names are ignored deterministically (never silently change production semantics).
 * SOLIDC env registry: enable strict unknown-reject via `SOLIDC_STRICT_UNKNOWN_ENV=1` or `assertNoUnknownSolidcEnvKeys` /
 * `enforceSolidcEnvPolicy({ strictUnknown: true })` for CI.
 */

export type SolidcEnvClass = 'observation' | 'instrumented' | 'feature' | 'unknown';

export type SolidcEnvEntry = {
  name: string;
  class: SolidcEnvClass;
  /** When class=feature, this key must appear in cache/artifact identity if set. */
  identityKey?: string;
};

const ENTRIES: readonly SolidcEnvEntry[] = Object.freeze([
  // Observation-only (debug prints / profiles)
  { name: 'SOLIDC_PROFILE', class: 'observation' },
  { name: 'SOLIDC_DEBUG_OUTLINE_TIMING', class: 'observation' },
  { name: 'SOLIDC_DEBUG_ARG_ORDER', class: 'observation' },
  { name: 'SOLIDC_DEBUG_DYNAMIC_FRAME', class: 'observation' },
  { name: 'SOLIDC_DEBUG_DYNAMIC_FRAME_STACK', class: 'observation' },
  { name: 'SOLIDC_DEBUG_DYNAMIC_FRAME_FUNCTION', class: 'observation' },
  { name: 'SOLIDC_DEBUG_DYNAMIC_FRAME_VARIABLE', class: 'observation' },
  { name: 'SOLIDC_DEBUG_DYNAMIC_FRAME_LINE', class: 'observation' },
  { name: 'SOLIDC_DEBUG_TUPLE_ASSIGNMENT', class: 'observation' },
  { name: 'SOLIDC_DEBUG_TUPLE_FUNCTION', class: 'observation' },
  { name: 'SOLIDC_DEBUG_TUPLE_LINE', class: 'observation' },
  { name: 'SOLIDC_DEBUG_TUPLE_STACK', class: 'observation' },
  { name: 'SOLIDC_DEBUG_USER_FUNCTION_CALL', class: 'observation' },
  { name: 'SOLIDC_DEBUG_USER_FUNCTION_CALL_TARGET', class: 'observation' },
  { name: 'SOLIDC_DEBUG_USER_FUNCTION_CALL_STACK', class: 'observation' },
  { name: 'SOLIDC_DEBUG_COMPUTE_BASE', class: 'observation' },
  { name: 'SOLIDC_DEBUG_COMPUTE_BASE_MARKERS', class: 'observation' },
  { name: 'SOLIDC_DEBUG_ENTRY_INPUT_INDEX', class: 'observation' },
  { name: 'SOLIDC_DEBUG_EMIT_TRAP', class: 'observation' },
  { name: 'SOLIDC_DEBUG_EMIT_TRAP_WINDOW', class: 'observation' },
  { name: 'SOLIDC_DEBUG_INPUTS', class: 'observation' },
  { name: 'SOLIDC_DEBUG_ADMISSION_REASONS', class: 'observation' },
  // production SOLIDC env hot-set production observation / dump / oracle (do not alter default bytecode by themselves)
  { name: 'SOLIDC_DUMP_ROUTE', class: 'observation' },
  { name: 'SOLIDC_ROUTE_PARSE_ORACLE', class: 'observation' },
  { name: 'SOLIDC_COMPILE_CACHE_DIR', class: 'observation' },
  { name: 'SOLIDC_COMPILE_CACHE_MAX_ENTRIES', class: 'observation' },
  { name: 'SOLIDC_DEBUG_CACHE_ID', class: 'observation' },
  { name: 'SOLIDC_DEBUG_ENTRY_OUTPUT', class: 'observation' },
  { name: 'SOLIDC_DEBUG_LOOP', class: 'observation' },
  { name: 'SOLIDC_DEBUG_MESSAGE_BUS_FALLBACK', class: 'observation' },
  { name: 'SOLIDC_DEBUG_OWNER_BOTTOM_HANDLER', class: 'observation' },
  { name: 'SOLIDC_DEBUG_OWNER_TOP_HANDLER', class: 'observation' },
  { name: 'SOLIDC_DEBUG_RAW_TARGET', class: 'observation' },
  { name: 'SOLIDC_DEBUG_RECOVERY_CLOSURE', class: 'observation' },
  { name: 'SOLIDC_DEBUG_RECOVERY_PRE', class: 'observation' },
  { name: 'SOLIDC_DEBUG_ROUTE', class: 'observation' },
  { name: 'SOLIDC_DEBUG_STREAM_PICK_OFFSET', class: 'observation' },
  { name: 'SOLIDC_DEBUG_UPSERT_WITNESS', class: 'observation' },
  { name: 'SOLIDC_DEBUG_UPSERT_WITNESS_DEFINE_ONLY', class: 'observation' },
  { name: 'SOLIDC_DEBUG_UPSERT_WITNESS_TARGET', class: 'observation' },
  { name: 'SOLIDC_ROUTE_ABI_TAIL', class: 'observation' },
  // Instrumented (change codegen shape) — must not affect default release compile
  { name: 'SOLIDC_DEBUG_NO_OUTLINE', class: 'instrumented' },
  { name: 'SOLIDCASH_NO_OUTLINE', class: 'instrumented' },
  { name: 'SOLIDC_NO_OPTIMISE', class: 'instrumented' },
  { name: 'SOLIDC_SKIP_MESSAGE_BUS_BINDER', class: 'instrumented' },
  // Explicit features — identity-bearing when enabled
  {
    name: 'SOLIDC_OWNER_ALT_ANCHOR',
    class: 'feature',
    identityKey: 'ownerAltAnchor',
  },
  {
    name: 'SOLIDC_HANDLER_BAND_MODEL',
    class: 'feature',
    identityKey: 'handlerBandModel',
  },
  // production SOLIDC env hot-set production cache / binder identity knobs
  {
    name: 'SOLIDC_COMPILE_CACHE',
    class: 'feature',
    identityKey: 'compileCache',
  },
  {
    name: 'SOLIDC_COMPILE_CACHE_BUILD_ID',
    class: 'feature',
    identityKey: 'compileCacheBuildId',
  },
  // SOLIDC env registry: CI / harness strict unknown-reject switch (observation — does not alter bytecode by itself)
  { name: 'SOLIDC_STRICT_UNKNOWN_ENV', class: 'observation' },
]);

const BY_NAME = new Map(ENTRIES.map((entry) => [entry.name, entry]));

export function classifySolidcEnv(name: string): SolidcEnvClass {
  if (!name.startsWith('SOLIDC') && !name.startsWith('SOLIDCASH')) return 'unknown';
  return BY_NAME.get(name)?.class ?? 'unknown';
}

export function solidcEnvEntry(name: string): SolidcEnvEntry | undefined {
  return BY_NAME.get(name);
}

export type SolidcFeatureFlags = {
  ownerAltAnchor: boolean;
  handlerBandModel: boolean;
};

/**
 * Resolve production-semantics feature flags.
 * When `releaseMode` is true, instrumented and unknown vars are ignored; only explicit features apply.
 */
export function resolveSolidcFeatureFlags(
  env: Record<string, string | undefined> | undefined,
  options?: { releaseMode?: boolean; allowInstrumented?: boolean },
): SolidcFeatureFlags {
  const releaseMode = options?.releaseMode !== false;
  const allowInstrumented = options?.allowInstrumented === true;
  const read = (name: string): boolean => env?.[name] === '1';

  // Instrumented switches never affect release/default compilation.
  if (releaseMode && !allowInstrumented) {
    /* intentionally ignore SOLIDC_DEBUG_NO_OUTLINE / SOLIDCASH_NO_OUTLINE */
  }

  return {
    ownerAltAnchor: read('SOLIDC_OWNER_ALT_ANCHOR'),
    handlerBandModel: read('SOLIDC_HANDLER_BAND_MODEL'),
  };
}

/** Feature bits that must be folded into artifact/cache identity when enabled. */
export function solidcFeatureIdentityBits(flags: SolidcFeatureFlags): Record<string, boolean> {
  const bits: Record<string, boolean> = {};
  if (flags.ownerAltAnchor) bits.ownerAltAnchor = true;
  if (flags.handlerBandModel) bits.handlerBandModel = true;
  return bits;
}

/**
 * List unknown SOLIDC* keys present in env (for deterministic rejection/logging).
 * Release compilation ignores them by default; SOLIDC env registry strict mode refuses them.
 */
export function unknownSolidcEnvKeys(env: Record<string, string | undefined>): string[] {
  return Object.keys(env)
    .filter((key) => key.startsWith('SOLIDC') || key.startsWith('SOLIDCASH'))
    .filter((key) => classifySolidcEnv(key) === 'unknown')
    .sort();
}

export function listRegisteredSolidcEnv(): readonly SolidcEnvEntry[] {
  return ENTRIES;
}

/**
 * production SOLIDC env hot-set: read a registered boolean SOLIDC_* flag (`=== '1'`).
 * Unknown / unregistered names return false (never invent production semantics).
 */
export function solidcEnvFlagEnabled(
  name: string,
  env: Record<string, string | undefined> | undefined = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env,
): boolean {
  if (classifySolidcEnv(name) === 'unknown') return false;
  return env?.[name] === '1';
}

/**
 * SOLIDC env registry: read a registered SOLIDC_* string value.
 * Unknown / unregistered names return undefined (never invent production semantics).
 */
export function solidcEnvValue(
  name: string,
  env: Record<string, string | undefined> | undefined = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env,
): string | undefined {
  if (classifySolidcEnv(name) === 'unknown') return undefined;
  const value = env?.[name];
  return value === undefined || value === '' ? undefined : value;
}

/** True when SOLIDC env registry strict unknown-reject is requested via env or explicit option. */
export function isSolidcStrictUnknownEnvEnabled(
  env: Record<string, string | undefined> | undefined = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env,
): boolean {
  return solidcEnvFlagEnabled('SOLIDC_STRICT_UNKNOWN_ENV', env);
}

/**
 * SOLIDC env registry: fail closed when unknown SOLIDC_* keys are present.
 * CI enables this via `SOLIDC_STRICT_UNKNOWN_ENV=1` or by calling this helper directly.
 */
export function assertNoUnknownSolidcEnvKeys(
  env: Record<string, string | undefined> | undefined = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env,
): void {
  const unknown = unknownSolidcEnvKeys(env ?? {});
  if (unknown.length === 0) return;
  throw new Error(
    `solidc-env: unknown SOLIDC_* keys refused in strict mode: ${unknown.join(', ')}`,
  );
}

/**
 * SOLIDC env registry: production/CI policy entry. Returns unknown keys; throws when strict mode is on and any exist.
 */
export function enforceSolidcEnvPolicy(
  env: Record<string, string | undefined> | undefined = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env,
  options?: { strictUnknown?: boolean },
): string[] {
  const source = env ?? {};
  const unknown = unknownSolidcEnvKeys(source);
  const strict = options?.strictUnknown === true || isSolidcStrictUnknownEnvEnabled(source);
  if (strict && unknown.length > 0) {
    assertNoUnknownSolidcEnvKeys(source);
  }
  return unknown;
}

/** Production hot-set names that must stay registered (subset of the full SOLIDC env registration). */
export const PRODUCTION_SOLIDC_ENV_HOT_SET: readonly string[] = Object.freeze([
  'SOLIDC_SKIP_MESSAGE_BUS_BINDER',
  'SOLIDC_COMPILE_CACHE',
  'SOLIDC_COMPILE_CACHE_BUILD_ID',
  'SOLIDC_COMPILE_CACHE_DIR',
  'SOLIDC_COMPILE_CACHE_MAX_ENTRIES',
  'SOLIDC_NO_OPTIMISE',
  'SOLIDC_ROUTE_PARSE_ORACLE',
  'SOLIDC_DUMP_ROUTE',
  'SOLIDC_STRICT_UNKNOWN_ENV',
]);
