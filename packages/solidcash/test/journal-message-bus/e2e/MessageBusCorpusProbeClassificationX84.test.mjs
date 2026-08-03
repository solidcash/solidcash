import { describe, expect, it } from 'vitest';
import { classifyMissingBusArtifact } from './message-bus-corpus-probe-classification-f3.mjs';

describe('X84 corpus failure classification', () => {
  it('publishes the multi-compile ParseError as the cause of a primary-fallback missing sibling', () => {
    const parseError = "ParseError: Unexpected token '[' at Line 68, Column 82";
    expect(classifyMissingBusArtifact({ method: 'primary', siblingError: parseError }, 'Router02Sibling'))
      .toEqual({
        bus: 'FAIL', busAbsentFromMap: true, busError: parseError, busSiblingError: parseError,
      });
  });

  it('fails loudly when a mutation deletes the fallback cause', () => {
    expect(() => classifyMissingBusArtifact({ method: 'primary' }, 'Router02Sibling'))
      .toThrow(/corpus-classification refusal.*without a primary-fallback sibling error/s);
  });

  it('fails loudly when a successful multi-map omits a directly compiled contract', () => {
    expect(() => classifyMissingBusArtifact({ method: 'multi' }, 'MissingFromSuccessfulMap'))
      .toThrow(/corpus-classification refusal.*refusing to publish an unattributed row/s);
  });
});
