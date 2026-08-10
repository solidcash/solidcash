/*   generation.test.ts
 *
 * - This file is used to test the IR and target code generation
 */

import { URL } from 'url';
import { compileFile } from '../../src/index.js';
import { fixtures } from './fixtures.js';

describe('Code generation & target code optimisation', () => {
  fixtures.forEach((fixture) => {
    it(`should compile ${fixture.fn} to correct Script and artifact`, () => {
      // These checked-in artifacts pin the legacy/direct code-generation
      // surface. Default-on message-bus artifacts are covered separately and
      // must not silently rewrite every historical fixture.
      const artifact = compileFile(new URL(`../valid-contract-files/${fixture.fn}`, import.meta.url), {
        messageBus: false,
        ...fixture.compilerOptions,
      });
      // Invocation analysis is additive compiler metadata with dedicated
      // structural tests. Keep legacy artifact fixtures focused on bytecode,
      // ABI, state layout, and debug/source-map compatibility.
      const { invocationAnalysis } = artifact;
      expect(invocationAnalysis?.version).toBe(1);
      // Fixtures are JSON artifacts, so compare the same serializable surface
      // (omitting in-memory `undefined` fields). The explicit test-only route
      // selection is not part of the historical artifact contract.
      const legacyArtifact = JSON.parse(JSON.stringify(artifact));
      delete legacyArtifact.invocationAnalysis;
      delete legacyArtifact.debug?.invokeDebug;
      delete legacyArtifact.compiler.options.messageBus;
      delete legacyArtifact.compiler.options.enforceFinalRequire;
      delete legacyArtifact.compiler.options.allowUnsafeOperations;
      // fingerprint is a deterministic hash of the (separately asserted) bytecode, so match its presence
      expect(legacyArtifact).toEqual({
        ...fixture.artifact, updatedAt: expect.any(String), fingerprint: expect.any(String),
      });
    });
  });
});
