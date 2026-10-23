import { describe, expect, it } from 'vitest';
import { retryMonotoneAttribution } from '../../src/admissionRetry.js';
import { compileString } from '../../src/compiler.js';

describe('external admission attribution fixed point', () => {
  it('removes more than four independently failing handlers before retaining the eligible control', () => {
    const refused = new Set<string>();
    const failures = ['external0', 'external1', 'external2', 'external3', 'external4', 'external5'];
    let attempts = 0;
    const recovered = retryMonotoneAttribution(
      new Error(failures[0]),
      refused,
      (error) => [String((error as Error).message)],
      () => {
        attempts += 1;
        const next = failures.find((name) => !refused.has(name));
        if (next !== undefined) throw new Error(next);
        return 'eligible-control';
      },
    );

    expect(recovered).toEqual({ succeeded: true, value: 'eligible-control' });
    expect([...refused]).toEqual(failures);
    expect(attempts).toBe(failures.length);
  });

  it('stops at an unattributable or duplicate-only fixed point', () => {
    const unattributable = retryMonotoneAttribution(
      new Error('opaque'), new Set<string>(), () => [], () => 'unreachable',
    );
    expect(unattributable).toMatchObject({ succeeded: false, error: expect.any(Error) });

    let attempts = 0;
    const refused = new Set(['same']);
    const duplicate = retryMonotoneAttribution(
      new Error('same'), refused, () => ['same'], () => { attempts += 1; return 'unreachable'; },
    );
    expect(duplicate).toMatchObject({ succeeded: false, error: expect.any(Error) });
    expect(attempts).toBe(0);
  });

  it('keeps a kernel route when more than four external handlers are independently refused', () => {
    const unsupported = Array.from({ length: 6 }, (_, index) => `
      function unsupported${index}() external selfdestruct { require(true); }
    `).join('');
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract ManyUnsupported {
        int current;
        ${unsupported}
        function eligible(int value) public { current = value; require(value >= 0); }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
    });

    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    for (let index = 0; index < 6; index += 1) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === `unsupported${index}`))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
    }
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'eligible'))
      .toMatchObject({ eligible: true });
  });
});
