import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';
import {
  assertPublishedHandlersMatchAdmission,
  buildAdmissionDecisionSet,
  clearPublishedHandlerAdmissionGateInvocations,
  getPublishedHandlerAdmissionGateInvocations,
} from '../src/admission-decision.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

describe('assertPublishedHandlersMatchAdmission (item 13 shipped gate)', () => {
  it('throws KERNEL_INTERNAL_DEFECT when a refused name is published eligible', () => {
    const analysis = buildAdmissionDecisionSet([
      { handlerId: 'set@1:1', handlerName: 'set', admitted: true, reason: 'ADMITTED' },
      { handlerId: 'bad@2:1', handlerName: 'bad', admitted: false, reason: 'KERNEL_LAYOUT' },
    ]);
    expect(() => assertPublishedHandlersMatchAdmission(analysis, [
      { name: 'set', eligible: true, selector: 'aaaaaaaa' },
      { name: 'bad', eligible: true, selector: 'bbbbbbbb' },
    ])).toThrow(/KERNEL_INTERNAL_DEFECT.*bad/);
  });
});

describe('compileString attribution-spans admission (item 13 non-tautology)', () => {
  it('uses span-based analysis with refused selfdestruct externals so removing the gate fails', () => {
    // Same shape as ExternalAdmissionRetry: many independently refused selfdestruct externals +
    // one eligible control. Forces attribution.spans + refusedHandlerIds (non-tautological).
    const unsupported = Array.from({ length: 6 }, (_, index) => `
      function unsupported${index}() external selfdestruct { require(true); }
    `).join('');
    clearPublishedHandlerAdmissionGateInvocations();
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract ManyUnsupported {
        int current;
        ${unsupported}
        function eligible(int value) public { current = value; require(value >= 0); }
      }
    `, { ...KERNEL, maximumInputBytes: 1_000_000 });

    expect(artifact.messageBus?.admissionSource).toBe('attribution-spans');
    expect(artifact.messageBus?.admittedHandlerIds).toContain('eligible');
    expect(artifact.messageBus?.refusedHandlerIds?.some((name) => name.startsWith('unsupported')))
      .toBe(true);
    expect(artifact.messageBus?.handlers?.find((h) => h.name === 'unsupported0'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
    expect(artifact.messageBus?.handlers?.find((h) => h.name === 'eligible'))
      .toMatchObject({ eligible: true });

    // Removing assertPublishedHandlersMatchAdmission from the compiler stamp path
    // leaves this counter unchanged across compileString.
    expect(getPublishedHandlerAdmissionGateInvocations()).toBeGreaterThan(0);

    // Rebuild analysis from stamps; forge a refused handler eligible → shipped gate throws.
    const analysis = buildAdmissionDecisionSet([
      ...(artifact.messageBus!.admittedHandlerIds ?? []).map((name) => ({
        handlerId: name,
        handlerName: name,
        admitted: true as const,
        reason: 'ADMITTED' as const,
      })),
      ...(artifact.messageBus!.refusedHandlerIds ?? []).map((name) => ({
        handlerId: name,
        handlerName: name,
        admitted: false as const,
        reason: 'KERNEL_LIFECYCLE' as const,
      })),
    ]);
    const forged = (artifact.messageBus!.handlers ?? []).map((handler) => (
      handler.name === 'unsupported0' ? { ...handler, eligible: true } : handler
    ));
    expect(() => assertPublishedHandlersMatchAdmission(analysis, forged))
      .toThrow(/KERNEL_INTERNAL_DEFECT.*unsupported0/);
  });
});
