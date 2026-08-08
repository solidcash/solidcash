import { asmToScript } from '../src/script.js';
import { buildLineToOpcodesMap, buildLineToAsmMap, formatBitAuthScript } from '../src/bitauth-script.js';
import { fixtures } from './fixtures/bitauth-script.fixture.js';

/**
 * These fixtures are STATIC SAMPLE INPUT for the formatter, not a pin on compiler output.
 *
 * There used to be a further row here that recompiled `fixture.sourceCode` and asserted the fresh artifact still
 * matched `fixture.asmBytecode` and `fixture.sourceMap`. Its own comment conceded the point ("this also tests the
 * compiler, but the compiler is tested much more thoroughly in its own test suite") - and that is exactly the
 * problem: `packages/solidc/test/generation/fixtures.ts` already pins the full artifact, bytecode included, for
 * these same contracts (`hodl_vault.scash`, `mecenas.scash`, `transfer_with_timeout.scash`), and those goldens
 * are maintained with the codegen that changes them. This copy was a duplicate that only ever went stale, three
 * times so far, each time reddening the release `yarn test` gate over an intentional size optimisation - most
 * recently a wide constant rebuilt through `OP_NUM2BIN` and a two-byte helper id folded to a single-byte `OP_1`.
 *
 * Regenerating all five fixture fields instead was considered and rejected: the maps and the aligned BitAuth
 * block are themselves outputs of the functions under test, so mechanically re-deriving them would leave every
 * row here passing no matter what the formatter did. Removing the duplicated assertion keeps the formatter
 * honest and leaves compiler-output pinning in the one package that owns it.
 */
describe('Libauth Script formatting', () => {
  fixtures.forEach((fixture) => {
    describe(fixture.name, () => {
      const scriptBytecode = asmToScript(fixture.asmBytecode);

      it('should build a line-to-opcodes map', () => {
        expect(buildLineToOpcodesMap(scriptBytecode, fixture.sourceMap)).toEqual(fixture.expectedLineToOpcodeMap);
      });

      it('should build a line-to-asm map', () => {
        expect(buildLineToAsmMap(scriptBytecode, fixture.sourceMap)).toEqual(fixture.expectedLineToAsmMap);
      });

      it('should format script as debugging output for BitAuth IDE', () => {
        const expectedBitAuthScript = fixture.expectedBitAuthScript.replace(/^\n+/, '').replace(/\n+$/, '');
        expect(formatBitAuthScript(scriptBytecode, fixture.sourceMap, fixture.sourceCode)).toBe(expectedBitAuthScript);
      });
    });
  });
});
