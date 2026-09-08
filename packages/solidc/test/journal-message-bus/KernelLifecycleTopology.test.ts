import { describe, expect, it } from 'vitest';
import { Artifact } from '@solidcash/utils';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

const preservedMaster = {
  lockingBytecode: 'participant', tokenCategory: 'participant', nftCapability: 'minting',
  nftCommitment: 'preserve', tokenAmount: 'preserve', satoshis: 'preserve',
};
const consumedMaster = {
  lockingBytecode: 'participant', tokenCategory: 'participant', nftCapability: 'minting',
  nftCommitment: 'unconstrained', tokenAmount: 'unconstrained', satoshis: 'reclaim',
};
const createdMaster = {
  lockingBytecode: 'participant', tokenCategory: 'participant', nftCapability: 'minting',
  nftCommitment: 'empty', tokenAmount: 'zero', satoshis: 'funded',
};

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
  it('admits the exact split topology and publishes participant-local input and output spans', () => {
    const { artifact, handler } = selected(`contract Threads() {
      function divide(int count) public split(count) { require(count > 0); }
    }`, 'divide');
    expect(artifact.messageBus?.available).toBe(true);
    expect(artifact.messageBus?.atomicMessageBus.protocolVersions).toContain(3);
    expect(handler).toMatchObject({
      eligible: true,
      lifecycleTopology: {
        version: 2,
        kind: 'split',
        coordinate: 'participant',
        categoryCensus: {
          tokenCategory: 'participant', nftCapability: 'minting',
          inputCount: { source: 'fixed', value: 1 },
          outputCount: { source: 'parameter', parameterIndex: 0, addend: 1 },
        },
        inputSpans: [
          { mode: 'preserve', offset: 0, count: { source: 'fixed', value: 1 }, identity: preservedMaster },
        ],
        outputSpans: [
          { mode: 'preserve', offset: 0, count: { source: 'fixed', value: 1 }, identity: preservedMaster },
          {
            mode: 'create', offset: 1,
            count: { source: 'parameter', parameterIndex: 0, addend: 0 }, identity: createdMaster,
          },
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
        version: 2,
        kind: 'merge',
        coordinate: 'participant',
        categoryCensus: {
          tokenCategory: 'participant', nftCapability: 'minting',
          inputCount: { source: 'parameter', parameterIndex: 1, addend: 1 },
          outputCount: { source: 'fixed', value: 1 },
        },
        inputSpans: [
          {
            mode: 'preserve', offset: 0, count: { source: 'fixed', value: 1 },
            identity: { ...preservedMaster, tokenAmount: 'nondecrease' },
          },
          {
            mode: 'consume', offset: 1,
            count: { source: 'parameter', parameterIndex: 1, addend: 0 }, identity: consumedMaster,
          },
        ],
        outputSpans: [
          {
            mode: 'preserve', offset: 0, count: { source: 'fixed', value: 1 },
            identity: { ...preservedMaster, tokenAmount: 'nondecrease' },
          },
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
