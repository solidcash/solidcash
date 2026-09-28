/**
 * The proxy half of per-call composition: deploying a contract behind the fallback-only proxy the convention
 * compiles, and running its `initialize` entry through that proxy.
 */

export * from './deploy.js';
