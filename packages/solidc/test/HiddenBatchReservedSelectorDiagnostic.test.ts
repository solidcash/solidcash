import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { assertNoReservedHiddenBatchSelector, SolidcDiagnosticError } from '../src/index.js';
import { Location, Point } from '../src/ast/Location.js';

describe('SCB1 reserved-selector diagnostic', () => {
  it('names the stable code, colliding selector, function, and source location', () => {
    const functions = [{
      name: 'collision',
      functionSelector: hexToBin('53434231'),
      location: new Location(new Point(7, 4), new Point(7, 23)),
    }];
    try {
      assertNoReservedHiddenBatchSelector(functions);
      throw new Error('expected selector collision');
    } catch (error) {
      expect(error).toBeInstanceOf(SolidcDiagnosticError);
      expect(error).toMatchObject({
        code: 'SCB_RESERVED_SELECTOR_COLLISION',
        context: {
          selector: '53434231',
          functionName: 'collision',
          sourceLocation: { line: 7, column: 4 },
        },
      });
      expect((error as Error).message).toContain('reserved hidden batch selector 0x53434231');
    }
  });
});
