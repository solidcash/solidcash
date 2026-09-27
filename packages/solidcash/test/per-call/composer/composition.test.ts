import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  type CallRecord,
  type StopSiteMetadata,
  decodeTranscript,
  encodeWitnessBlock,
  splitFirstPush,
} from '@solidcash/utils';
import {
  type ContractBlock,
  type DerivationHost,
  type FrameRequest,
  CompositionPools,
  allocateOutputRegions,
  assembleMasterWitness,
  assembleValidatorWitness,
  deriveComposition,
  layoutTransaction,
  participant,
  selectGroupValidators,
} from '../../../src/per-call/composer/index.js';

const category = new Uint8Array(32).fill(0x33);
const addrA = new Uint8Array(35).fill(0xaa);
const userLock = new Uint8Array(25).fill(0x02);
const redeemScript = new Uint8Array([0x21, 0x01, 0x02, 0x03, 0x87]);

/** The `A -> B -> B -> A` shape: A.f re-enters A through B.g, so A runs on two masters and B on one. */
const sites: Record<string, StopSiteMetadata> = {
  'A.f()': {
    version: 1,
    functionName: 'A.f()',
    sites: [
      { kind: 'read', site: 0, record: 'DA' },
      { kind: 'call', site: 1, callIndex: 0 },
      { kind: 'segmentClose', site: 2, segmentIndex: 0 },
      { kind: 'segmentClose', site: 3, segmentIndex: 1 },
    ],
  },
  'B.g()': {
    version: 1,
    functionName: 'B.g()',
    sites: [
      { kind: 'read', site: 0, record: 'DB' },
      { kind: 'call', site: 1, callIndex: 0 },
      { kind: 'segmentClose', site: 2, segmentIndex: 0 },
      { kind: 'segmentClose', site: 3, segmentIndex: 1 },
    ],
  },
  'A.k()': {
    version: 1,
    functionName: 'A.k()',
    sites: [
      { kind: 'read', site: 0, record: 'DA' },
      { kind: 'segmentClose', site: 1, segmentIndex: 0 },
    ],
  },
};

/** Derives the shape on fresh pools, then lays out A's and B's blocks. */
function deriveAndLayOut(): {
  readonly pools: CompositionPools;
  readonly blocks: readonly ContractBlock[];
  readonly validator: string;
} {
  const pools = new CompositionPools({
    masters: { A: ['A m1', 'A m2'], B: ['B m1'] },
    validators: { A: ['V_A'] },
  });
  const host: DerivationHost = {
    sitesFor: (functionName) => sites[functionName]!,
    step: (request, site) => {
      if (site.kind !== 'call') {
        return { filled: site.kind === 'read' ? 'recordCommitment' : 'segmentRecords' };
      }
      const callee = request.functionName === 'A.f()' ? 'B.g()' : 'A.k()';
      const contract = callee === 'B.g()' ? 'B' : 'A';
      return {
        filled: 'callResult',
        callee: { contract, functionName: callee, kind: FrameKind.CALL, master: pools.takeMaster(contract) },
      };
    },
  };
  const root: FrameRequest = {
    contract: 'A',
    functionName: 'A.f()',
    kind: FrameKind.ROOT,
    master: pools.takeMaster('A'),
  };

  const derived = deriveComposition([root], host);
  // A is entered twice and B once; the second A entry is the re-entry from B.g.
  expect(pools.mastersTaken('A')).toEqual(['A m1', 'A m2']);
  expect(pools.mastersTaken('B')).toEqual(['B m1']);
  expect(derived.completed.map((frame) => [frame.functionName, frame.master])).toEqual([
    ['A.k()', 'A m2'],
    ['B.g()', 'B m1'],
    ['A.f()', 'A m1'],
  ]);

  const [placement] = selectGroupValidators([{
    firstRootContract: 'A',
    masters: [
      { contract: 'A', master: 'A m1' },
      { contract: 'A', master: 'A m2' },
      { contract: 'B', master: 'B m1' },
    ],
  }], pools);
  expect(placement).toEqual({ block: 'A', validator: 'V_A', covers: ['A', 'B'], settles: ['A'] });

  const blocks: readonly ContractBlock[] = [
    {
      contract: 'A',
      masters: pools.mastersTaken('A'),
      validator: { id: placement!.validator, settles: placement!.settles },
      state: ['DA'],
    },
    { contract: 'B', masters: pools.mastersTaken('B'), state: ['DB'] },
  ];
  return { pools, blocks, validator: placement!.validator };
}

describe('ABBA composition', () => {
  it('lays the derived blocks out in the order of the transaction layout', () => {
    const { blocks, validator } = deriveAndLayOut();

    const layout = layoutTransaction(blocks);

    expect(['A m1', 'A m2', validator, 'DA', 'B m1', 'DB'].map((id) => participant(layout, id).index))
      .toEqual([0, 1, 2, 3, 4, 5]);
    expect(layout.funderInputBase).toBe(6);
  });

  it('assembles the validator transcript from the coordinates the layout gave it', () => {
    const { blocks, validator } = deriveAndLayOut();
    const layout = layoutTransaction(blocks);

    const assembled = assembleValidatorWitness({
      transcript: {
        roots: [participant(layout, 'A m1').index],
        masters: ['A m1', 'A m2', 'B m1'].map((master) => participant(layout, master).index),
        settles: [{ category, stateInputs: [participant(layout, 'DA').index] }],
      },
      redeemScript,
    });

    expect(decodeTranscript(splitFirstPush(assembled.unlockingBytecode).payload)).toEqual({
      roots: [0],
      masters: [0, 1, 4],
      settles: [{ category, stateInputs: [3], createdOutputs: [] }],
    });
    expect(participant(layout, validator).index).toBe(2);
  });

  it('assembles a master against the coordinates the layout gave it', () => {
    const { blocks, validator } = deriveAndLayOut();
    const layout = layoutTransaction(blocks);
    const regions = allocateOutputRegions(layout, { events: 1, sends: 0, created: 0 });
    const call: CallRecord = {
      kind: FrameKind.CALL,
      target: addrA,
      value: 0n,
      calleeRef: participant(layout, 'B m1').index,
      argsHash: new Uint8Array(32).fill(9),
      result: new Uint8Array([0x14]),
    };

    const assembled = assembleMasterWitness({
      frame: { kind: FrameKind.ROOT, sender: userLock, self: addrA, value: 0n },
      callerRef: layout.funderInputBase,
      originRef: layout.funderInputBase,
      validatorRef: participant(layout, validator).index,
      calls: [call],
      retval: new Uint8Array(0),
      segments: [[], []],
      events: [regions.eventIndices[0]!],
      sends: [],
      argumentPushes: [new Uint8Array([3])],
      redeemScript,
    });

    expect(assembled.block.kind).toBe(FrameKind.ROOT);
    expect(assembled.block.callerRef).toBe(6);
    expect(assembled.block.originRef).toBe(6);
    expect(assembled.block.validatorRef).toBe(2);
    expect(assembled.block.calls[0]!.calleeRef).toBe(4);
    expect(assembled.block.events).toEqual([6]);
    expect(regions.changeIndex).toBe(7);
    // The block is the first push of the master's unlocking bytecode.
    expect(splitFirstPush(assembled.unlockingBytecode).payload).toEqual(encodeWitnessBlock(assembled.block));
  });
});
