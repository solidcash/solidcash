/**
 * The proxy half of framed composition: deploying a contract behind the fallback-only proxy the convention
 * compiles, and running an entry through that proxy — the deployment's `initialize`, and any later call a user
 * makes.
 *
 * A caller does not have to write the proxy: `buildProxyArtifact` derives one from the implementation's own
 * declaration, and `deployFramedProxy` uses it when no proxy artifact is supplied.
 */

export { FramedProxyDeployError } from './errors.js';
export * from './deploy.js';
export * from './generate.js';
export * from './upgrade.js';
