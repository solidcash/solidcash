import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

const selected = (source: string, name: string) => {
  const artifact = compileString(source, KERNEL);
  const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
  expect(handler, `missing handler ${name}`).toBeDefined();
  return { artifact, handler: handler! };
};

describe('kernel lifecycle topology metadata', () => {
  it('publishes participant-local split input and output spans without admitting the handler', () => {
    const { artifact, handler } = selected(`contract Threads() {
      function divide(int count) public split(count) { require(count > 0); }
    }`, 'divide');
    expect(artifact.messageBus?.available).toBe(false);
    expect(handler).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LIFECYCLE',
      lifecycleTopology: {
        version: 1,
        kind: 'split',
        coordinate: 'participant',
        inputSpans: [
          { mode: 'preserve', offset: 0, count: { source: 'fixed', value: 1 } },
        ],
        outputSpans: [
          { mode: 'preserve', offset: 0, count: { source: 'fixed', value: 1 } },
          { mode: 'create', offset: 1, count: { source: 'parameter', parameterIndex: 0, addend: 0 } },
        ],
      },
    });
  });

  it('publishes participant-local merge input and output spans', () => {
    const { handler } = selected(`contract Threads() {
      function combine(bytes32 tag, uint count) external merge(count) {
        require(tag == tag && count > 0);
      }
      function inspect() public { require(true); }
    }`, 'combine');
    expect(handler).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LIFECYCLE',
      lifecycleTopology: {
        version: 1,
        kind: 'merge',
        coordinate: 'participant',
        inputSpans: [
          { mode: 'preserve', offset: 0, count: { source: 'fixed', value: 1 } },
          { mode: 'consume', offset: 1, count: { source: 'parameter', parameterIndex: 1, addend: 0 } },
        ],
        outputSpans: [
          { mode: 'preserve', offset: 0, count: { source: 'fixed', value: 1 } },
        ],
      },
    });
  });

  it('does not invent bounded spans for other lifecycle modes', () => {
    const { handler } = selected(`contract Terminal(address recipient) {
      function close() public selfdestruct { selfdestruct(recipient); }
      function inspect() public { require(true); }
    }`, 'close');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
    expect(handler).not.toHaveProperty('lifecycleTopology');
  });
});
