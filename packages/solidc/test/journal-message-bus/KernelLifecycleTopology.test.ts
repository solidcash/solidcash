import { describe, expect, it } from 'vitest';
import { Artifact } from '@solidcash/utils';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

const selected = (source: string, name: string): {
  artifact: Artifact;
  handler: NonNullable<Artifact['messageBus']>['handlers'][number];
} => {
  const artifact = compileString(source, KERNEL);
  const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
  expect(handler, `missing handler ${name}`).toBeDefined();
  return { artifact, handler: handler! };
};

describe('kernel lifecycle topology metadata', () => {
  it.each([
    ['split', `contract Threads() {
      function divide(int count) public split(count) { require(count > 0); }
    }`, 'divide'],
    ['merge', `contract Threads() {
      function combine(bytes32 tag, uint count) external merge(count) {
        require(tag == tag && count > 0);
      }
    }`, 'combine'],
  ])('fails closed for %s lifecycle geometry until it has an authenticated row protocol', (_kind, source, name) => {
    const { handler } = selected(source, name);
    // The compiler may describe a statically known topology for diagnostics, but metadata is never an admission
    // proof: lifecycle rows stay unavailable until one authenticated row protocol binds those spans.
    expect(handler).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LIFECYCLE',
      lifecycleTopology: { version: 2, kind: _kind },
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
