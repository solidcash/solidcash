/**
 * F2 measurement config. Deliberately NOT named `vitest.config.ts`, so the root project glob never picks it
 * up and a normal `yarn test` is completely unaffected. It is the ordinary SDK config plus the estimator
 * probe, which is itself inert unless `L3_ESTIMATOR_OUT` is set.
 */
declare const _default: import("vite").UserConfig;
export default _default;
