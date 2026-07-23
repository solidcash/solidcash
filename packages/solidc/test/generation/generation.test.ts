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
      const artifact = compileFile(new URL(`../valid-contract-files/${fixture.fn}`, import.meta.url), fixture.compilerOptions);
      // Invocation analysis is additive compiler metadata with dedicated
      // structural tests. Keep legacy artifact fixtures focused on bytecode,
      // ABI, state layout, and debug/source-map compatibility.
      const { invocationAnalysis, ...legacyArtifact } = artifact;
      expect(invocationAnalysis?.version).toBe(1);
      // fingerprint is a deterministic hash of the (separately asserted) bytecode, so match its presence
      expect(legacyArtifact).toEqual({
        ...fixture.artifact, updatedAt: expect.any(String), fingerprint: expect.any(String),
      });
    });
  });
});
