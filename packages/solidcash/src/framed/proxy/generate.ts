/**
 * The Node build of the proxy module: it compiles the generated proxy with the shipped compiler.
 *
 * A browser bundle resolves `generate.browser.js` instead (the SDK package's `browser` field), which refuses the
 * default and points the caller at a supplied `proxyArtifact`; everything else about the proxy - the generated
 * source, the layout agreement check - is shared through `generate-core.js`.
 */

import { compileStringMulti } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { compileProxyArtifact } from './generate-core.js';

export * from './generate-core.js';

/** Compiles the proxy generated from an implementation's declaration and returns its artifact. */
export function buildProxyArtifact(implementationArtifact: Artifact, hopGuard?: Uint8Array): Artifact {
  return compileProxyArtifact(
    implementationArtifact,
    (source, options) => compileStringMulti(source, options),
    hopGuard,
  );
}
