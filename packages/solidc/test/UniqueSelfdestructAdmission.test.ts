/**
 * Unique modifier-only selfdestruct stays admitted; selfdestruct swarms stay KERNEL_LIFECYCLE.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('unique selfdestruct admission unique selfdestruct admission', () => {
  it('admits a single modifier-only fixed-state selfdestruct', () => {
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract OneKill {
        int current;
        function kill() public selfdestruct { require(true); }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers?.find((h) => h.name === 'kill'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers?.find((h) => h.name === 'kill')?.lifecycleTopology)
      .toMatchObject({ kind: 'selfdestruct' });
  });

  it('refuses a swarm of selfdestruct externals while retaining an eligible control', () => {
    const unsupported = Array.from({ length: 6 }, (_, index) => `
      function unsupported${index}() external selfdestruct { require(true); }
    `).join('');
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract ManyUnsupported {
        int current;
        ${unsupported}
        function eligible(int value) public { current = value; require(value >= 0); }
      }
    `, KERNEL);
    for (let index = 0; index < 6; index += 1) {
      expect(artifact.messageBus?.handlers?.find((h) => h.name === `unsupported${index}`))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
    }
    expect(artifact.messageBus?.handlers?.find((h) => h.name === 'eligible'))
      .toMatchObject({ eligible: true });
  });
});
