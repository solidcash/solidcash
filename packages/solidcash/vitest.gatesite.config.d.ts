/**
 * X126 blast-radius config. Named so the root `packages/xx/vitest.config.ts` project glob never picks it up,
 * exactly as the envelope and broadcast configs are. It is the ordinary SDK config plus the gate-site probe,
 * which is itself inert unless `L3_GATESITE_OUT` is set.
 */
declare const _default: import("vite").UserConfig;
export default _default;
