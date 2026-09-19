/**
 * X49 broadcast-capture config. Named so the root `packages/xx/vitest.config.ts` project glob never picks it
 * up, exactly as F1's envelope config is. It is the ordinary SDK config plus the broadcast probe, which is
 * itself inert unless `L3_BROADCAST_OUT` is set.
 */
declare const _default: import("vite").UserConfig;
export default _default;
