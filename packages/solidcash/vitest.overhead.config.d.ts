/**
 * X163 Row B overhead-measurement config. Named so the root `packages/xx/vitest.config.ts` project glob never
 * picks it up, exactly as the gatesite, census, envelope, broadcast and estimator configs are. Ordinary SDK
 * config plus the overhead probe, which is itself inert unless `L4_OVERHEAD_OUT` is set.
 */
declare const _default: import("vite").UserConfig;
export default _default;
