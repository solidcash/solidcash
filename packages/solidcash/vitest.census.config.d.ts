/**
 * X130/X131 throw-census config. Named so the root `packages/xx/vitest.config.ts` project glob never picks it
 * up, exactly as the gatesite, envelope, broadcast and estimator configs are. Ordinary SDK config plus the
 * throw census, which is itself inert unless `L3_CENSUS_OUT` is set.
 */
declare const _default: import("vite").UserConfig;
export default _default;
