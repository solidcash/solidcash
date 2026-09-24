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
    expect(artifact.messageBus?.atomicMessageBus.protocolVersions).not.toContain(3);
    expect(artifact.messageBus?.verifierProgram?.lifecycle).toBe(true);
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
    const { artifact, handler } = selected(`contract Threads() {
      function combine(bytes32 tag, uint count) external merge(count) {
        require(tag == tag && count > 0);
      }
      function inspect() public { require(true); }
    }`, 'combine');
    expect(artifact.messageBus?.verifierProgram?.lifecycle).toBe(true);
    expect(handler).toMatchObject({
      eligible: true,
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

  it('admits resource-free modifier-only selfdestruct retirement topology', () => {
    const { artifact, handler } = selected(`contract Terminal() {
      function close() public selfdestruct { require(true); }
      function inspect() public { require(true); }
    }`, 'close');
    expect(artifact.messageBus?.verifierProgram?.lifecycle).toBe(true);
    expect(handler).toMatchObject({
      eligible: true,
      lifecycleTopology: {
        version: 2,
        kind: 'selfdestruct',
        coordinate: 'participant',
        categoryCensus: {
          tokenCategory: 'participant', nftCapability: 'minting',
          inputCount: { source: 'fixed', value: 1 },
          outputCount: { source: 'fixed', value: 0 },
        },
        inputSpans: [
          {
            mode: 'consume', offset: 0, count: { source: 'fixed', value: 1 },
            identity: consumedMaster,
          },
        ],
        outputSpans: [],
      },
    });
  });

  it('admits statement-form selfdestruct on master-only contracts', () => {
    const { handler } = selected(`contract Terminal(address payable recipient) {
      function close() public {
        require(true);
        selfdestruct(recipient);
      }
      function inspect() public { require(true); }
    }`, 'close');
    expect(handler).toMatchObject({
      eligible: true,
      lifecycleTopology: { version: 2, kind: 'selfdestruct' },
    });
  });

  it('publishes preserve resourcePrefix for read-only fixed-state split', () => {
    const { handler } = selected(`contract Threads() {
      int public marker;
      function divide(int count) public split(count) {
        require(this.marker > 0 && count > 0);
      }
    }`, 'divide');
    expect(handler).toMatchObject({
      eligible: true,
      lifecycleTopology: {
        version: 2,
        kind: 'split',
        resourcePrefix: { mode: 'preserve', dataNftCount: 1, nftIndices: [0] },
        outputSpans: [
          { mode: 'preserve', offset: 0 },
          { mode: 'create', offset: 2 },
        ],
      },
    });
  });

  it('publishes consume resourcePrefix for modifier-only fixed-state selfdestruct', () => {
    const { handler } = selected(`contract Victim() {
      int public dust;
      function close() public selfdestruct { require(true); }
      function inspect() public { require(true); }
    }`, 'close');
    expect(handler).toMatchObject({
      eligible: true,
      lifecycleTopology: {
        version: 2,
        kind: 'selfdestruct',
        resourcePrefix: { mode: 'consume', dataNftCount: 1, nftIndices: [0] },
      },
    });
  });

  it('keeps collection-bearing and statement-form state selfdestruct behind KERNEL_LIFECYCLE', () => {
    const mapping = selected(`contract MappingVictim() {
      mapping(bytes20 => int) public balances;
      function close() public selfdestruct { require(true); }
    }`, 'close');
    expect(mapping.handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });

    const statementState = selected(`contract StatementVictim(address payable recipient) {
      int public dust;
      function close() public {
        require(true);
        selfdestruct(recipient);
      }
    }`, 'close');
    expect(statementState.handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
  });

  it('Fence #16: event- and blockhash-bearing selfdestruct stay KERNEL_LIFECYCLE', () => {
    const withEvent = selected(`contract EventVictim() {
      event Gone(int v);
      function close() public selfdestruct { emit Gone(1); require(true); }
    }`, 'close');
    expect(withEvent.handler).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LIFECYCLE',
      rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
    });

    const withBlockhash = selected(`contract BlockhashVictim() {
      function close() public selfdestruct {
        bytes32 h = blockhash(0);
        require(h == h);
      }
    }`, 'close');
    expect(withBlockhash.handler).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LIFECYCLE',
      rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
    });

    const eventAndState = selected(`contract EventStateVictim() {
      int public x;
      event Gone(int v);
      function close() public selfdestruct { emit Gone(this.x); require(true); }
    }`, 'close');
    expect(eventAndState.handler).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LIFECYCLE',
    });
  });
});
