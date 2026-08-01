/*   Compiler.test.ts
 *
 * - This file is used to test the overall functioning of the compiler.
 * - It tests successful compilation using fixture .scash files in ../valid-contract-files.
 * - It tests compile errors using fixture .scash files in respective Error directories.
 */

import { URL } from 'url';
import { getSubdirectories, readCashFiles } from '../test-utils.js';
import * as Errors from '../../src/Errors.js';
import { compileString as _csRawSolidc } from '../../src/index.js';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import type { SolidCashErrorListener } from '../../src/index.js';

const VALID_SOURCE = `
contract Test() {
  function unlock() {
    require(true);
  }
}
`;
const INVALID_SOURCE = 'contract Test() { function unlock() { require(true) } }';

describe('Compiler', () => {
  describe('Successful compilation', () => {
    readCashFiles(new URL('../valid-contract-files', import.meta.url)).forEach((file) => {
      it(`${file.fn} should succeed`, () => {
        expect(() => compileString(file.contents)).not.toThrow();
      });
    });

    it('keeps the default enabled while omitting a handler whose effects cannot be settled', () => {
      const artifact = compileString(`contract ConditionalTokenContainerSend() {
        int counter;
        function sendConditional(bool flag, bytes32 category, bytes20 a, bytes20 b, int amount) {
          if (flag) this.tokens[category].transfer(a, amount);
          else this.tokens[category].transfer(b, amount);
          this.counter = this.counter + 1;
        }
      }`);

      expect(artifact.hiddenBatch).toBeUndefined();
      expect(artifact.compiler.options?.experimentalHiddenBatch).toBe(true);
    });
  });

  describe('Compilation errors', () => {
    const errorTypes = getSubdirectories(new URL('.', import.meta.url));

    errorTypes.forEach((errorType) => {
      describe(errorType.toString(), () => {
        readCashFiles(new URL(errorType, import.meta.url)).forEach((file) => {
          it(`${file.fn} should throw ${errorType}`, () => {
            // Retrieve the correct Error constructor from the Errors.ts file
            const expectedError = Errors[errorType as keyof typeof Errors];

            if (!expectedError) throw new Error(`Invalid test configuration: error ${errorType} does not exist`);

            expect(() => compileString(file.contents)).toThrow(expectedError);
          });
        });
      });
    });
  });

  describe('Custom error listener', () => {
    it('uses the custom error listener for parse errors', () => {
      const errors: string[] = [];
      const errorListener: SolidCashErrorListener = {
        syntaxError(_recognizer, _offendingSymbol, line, charPositionInLine, message): void {
          errors.push(`${line}:${charPositionInLine}:${message}`);
          throw new Error('Custom parse error');
        },
      };

      expect(() => compileString(INVALID_SOURCE, { errorListener })).toThrow('Custom parse error');
      expect(errors).toHaveLength(1);
    });

    it('throws a ParseError after reporting to a non-throwing custom error listener', () => {
      const errors: string[] = [];
      const errorListener: SolidCashErrorListener = {
        syntaxError(_recognizer, _offendingSymbol, line, charPositionInLine, message): void {
          errors.push(`${line}:${charPositionInLine}:${message}`);
        },
      };

      expect(() => compileString(INVALID_SOURCE, { errorListener })).toThrow(Errors.ParseError);
      expect(errors).toHaveLength(1);
    });

    it('does not include custom error listeners in compiler artifact options', () => {
      const errorListener: SolidCashErrorListener = {
        syntaxError(): void {
          throw new Error('Unexpected parse error');
        },
      };

      const artifact = compileString(VALID_SOURCE, { enforceLocktimeGuard: false, errorListener });

      expect(artifact.compiler.options).toEqual({
        enforceFunctionParameterTypes: true,
        enforceLocktimeGuard: false,
        commitmentLimit: 128,
        experimentalHiddenBatch: true,
      });
    });
  });
});
