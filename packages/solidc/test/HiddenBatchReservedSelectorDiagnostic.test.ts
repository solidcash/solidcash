import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  assertNoReservedHiddenBatchSelector, classifyHiddenBatchRejection, compileString, SolidcDiagnosticError,
} from '../src/index.js';
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

describe('transcript-v1 static refusal classes', () => {
  it.each([
    ['unsupported-inline-assembly', 'SCB_UNSUPPORTED_CONSTRUCT'],
    ['future-result-before-use', 'SCB_FUTURE_RESULT_DEPENDENCY'],
    ['external-recursion-unbounded', 'SCB_EXTERNAL_RECURSION_UNBOUNDED'],
    ['collection-route-has-ambiguous-global-and-row-key', 'SCB_DUPLICATE_SETTLEMENT_AUTHORITY'],
    ['foreign-outstate-read-precedes-shared-call-settlement', 'SCB_FOREIGN_INTERMEDIATE_STATE_READ'],
    ['direct-versus-batch-introspection-divergence', 'SCB_STACK_CONTEXT_UNPRESERVABLE'],
    ['transaction-signature-route-binding-required', 'SCB_EFFECT_UNSUMMARIZABLE'],
  ] as const)('classifies %s as %s', (reason, code) => {
    expect(classifyHiddenBatchRejection(reason)).toBe(code);
  });

  it('publishes the stable class and handler identity beside the detailed reason', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract SignatureRefusal() {
        function signed(sig s, pubkey pk) public { require(checkSig(s, pk)); }
        function open() public { require(true); }
      }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'signed')).toMatchObject({
      eligible: false,
      rejectionReason: 'transaction-signature-route-binding-required',
      rejectionCode: 'SCB_EFFECT_UNSUMMARIZABLE',
      rejectionContext: {
        handlerId: expect.any(Number),
        functionName: 'signed',
        reason: 'transaction-signature-route-binding-required',
      },
    });
  });
});
