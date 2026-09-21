/**
 * X175 admin-site throw-census config. Named so the root `packages/xx/vitest.config.ts` project glob never
 * picks it up, exactly as the census, gatesite, envelope, broadcast and estimator configs are. Ordinary SDK
 * config plus `test/e2e/x175-admin-census.ts`, which is itself inert unless `L3_X175_OUT` is set.
 */
declare const _default: import("vite").UserConfig;
export default _default;
