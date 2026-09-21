/**
 * X204 settlement-attribution config. Named so the root `packages/**\/vitest.config.ts` project glob never
 * picks it up, exactly as the broadcast and envelope configs are. It is the ordinary SDK config plus the
 * X204 probe, which is itself inert unless `L3_X204_OUT` is set.
 */
declare const _default: import("vite").UserConfig;
export default _default;
