/**
 * The proxy half of per-call composition: deploying a contract behind the fallback-only proxy the convention
 * compiles, and running its `initialize` entry through that proxy.
 *
 * A caller does not have to write the proxy: `buildProxyArtifact` derives one from the implementation's own
 * declaration, and `deployPerCallProxy` uses it when no proxy artifact is supplied.
 */

export { PerCallProxyDeployError } from './errors.js';
export * from './deploy.js';
export * from './generate.js';
