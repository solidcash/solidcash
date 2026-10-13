/**
 * The browser build of the proxy module. The SDK's browser bundles do not ship the compiler, so the generated
 * proxy cannot be compiled at deploy time here; a caller that deploys behind a proxy supplies one.
 */

import type { Artifact } from '@solidcash/utils';
import { FramedProxyDeployError } from './errors.js';

export * from './generate-core.js';

/**
 * Refuses: compiling the generated proxy needs the compiler, which a browser bundle of the SDK does not include.
 * Build the proxy in Node and pass it to the deploy as `proxyArtifact`.
 */
export function buildProxyArtifact(implementationArtifact: Artifact): Artifact {
  throw new FramedProxyDeployError(
    `cannot build the proxy artifact for "${implementationArtifact.contractName}" in a browser bundle: the `
    + 'generated proxy is compiled by the compiler, which the browser build of the SDK does not ship. Build it in '
    + 'Node and pass it as `proxyArtifact` (`buildProxyArtifact` from "solidcash/dist/framed/proxy/index.js").',
  );
}
