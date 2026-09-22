import { describe, expect, it } from 'vitest';
import {
  admittedHandlerNamesFromAnalysis,
  assertAdmissionSetUnchanged,
  assertPublishedHandlersMatchAdmission,
  buildAdmissionDecisionSet,
} from '../src/admission-decision.js';

describe('admission decision set (item 13)', () => {
  it('freezes analysis decisions and rejects silent codegen narrowing', () => {
    const analysis = buildAdmissionDecisionSet([
      { handlerId: 'a', admitted: true, reason: 'ADMITTED' },
      { handlerId: 'b', admitted: false, reason: 'KERNEL_LAYOUT' },
      { handlerId: 'c', admitted: true, reason: 'ADMITTED' },
    ]);
    expect(analysis.admittedHandlerIds).toEqual(['a', 'c']);
    expect(() => assertAdmissionSetUnchanged(analysis, ['a', 'c'])).not.toThrow();
    expect(() => assertAdmissionSetUnchanged(analysis, ['a'])).toThrow(/KERNEL_INTERNAL_DEFECT/);
  });

  it('admittedHandlerNamesFromAnalysis prefers handlerName for artifact stamps', () => {
    const analysis = buildAdmissionDecisionSet([
      { handlerId: 'set@1:1', handlerName: 'set', admitted: true, reason: 'ADMITTED' },
      { handlerId: 'bad@2:1', handlerName: 'bad', admitted: false, reason: 'KERNEL_LAYOUT' },
    ]);
    expect(admittedHandlerNamesFromAnalysis(analysis)).toEqual(['set']);
    expect(() => assertPublishedHandlersMatchAdmission(analysis, [
      { name: 'set', eligible: true },
    ])).not.toThrow();
  });
});