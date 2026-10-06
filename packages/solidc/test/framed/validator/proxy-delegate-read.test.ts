import { describe, expect, it } from 'vitest';
import { FrameKind } from '@solidcash/utils';
import {
  categoryOf,
  contractLockOf,
  materialise,
  planComposition,
  seedBytes,
  selectorOf,
  userLockOf,
  type Composition,
  type CompositionPlan,
  type ContractPlan,
  type RecordTouchPlan,
  type SegmentPlan,
} from '../../../../solidcash/test/framed/validator/fixture.js';
import {
  buildValidatorFacets,
  buildValidatorProgram,
  decideValidator,
  type FramedTransaction,
  type TokenShape,
  type ValidatorReasonName,
} from '../../../src/framed/validator/index.js';
import { compositionMachine } from '../machine.js';

/**
 * A read-only entry reached through a proxy, at the validator program and in the derivation.
 *
 * A caller enters its own root frame and records a read-only call to the proxy's frame, so the proxy's frame is the
 * read-only kind its caller's site requires. That proxy frame then records a delegate call into the implementation's
 * frame, which runs the entry's read-only body against the proxy's records and returns the value the caller reads.
 * The delegate leg is what V10 used to refuse: the clause required every call below a read-only frame to be
 * read-only itself, and a delegate call is not. The value the delegate returns, and every refusal below, are built
 * from the same plan so each case differs only in the one fact it exercises.
 *
 * Both halves are exercised: `decideValidator` decides the derivation and the shipped program runs the validator
 * head and its facets on the composition machine, so a refusal is the same rule on chain and off.
 */

const EMPTY = new Uint8Array(0);
const ANSWER = seedBytes('proxy delegate answer', 4);
const RECORD_BEFORE = seedBytes('proxy delegate record:0', 6);
const RECORD_AFTER = seedBytes('proxy delegate record:1', 6);

const PROGRAM = buildValidatorProgram();
const FACETS = buildValidatorFacets();
const FACET_COUNT = FACETS.length;

type VirtualMachine = ReturnType<typeof compositionMachine>;
type VmProgram = Parameters<VirtualMachine['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutput = NonNullable<VmProgram['sourceOutputs']>[number];

const CAPABILITY_NAMES = ['none', 'mutable', 'minting'] as const;

/** The fixture's token shape as the machine states it. */
function vmToken(token: TokenShape): VmSourceOutput['token'] {
  if (token.category.length === 0) return undefined;
  return {
    category: token.category,
    amount: token.amount,
    ...(token.hasNft
      ? { nft: { capability: CAPABILITY_NAMES[token.capability]!, commitment: token.nftCommitment } }
      : {}),
  };
}

/** The same transaction as the machine reads it, with every spent output stated. */
function toVm(transaction: FramedTransaction): { transaction: VmTransaction; sourceOutputs: VmSourceOutput[] } {
  return {
    transaction: {
      version: 2,
      locktime: 0,
      inputs: transaction.inputs.map((input) => ({
        outpointIndex: input.outpointIndex,
        outpointTransactionHash: input.outpointTransactionHash,
        sequenceNumber: 0xffffffff,
        unlockingBytecode: input.unlockingBytecode,
      })),
      outputs: transaction.outputs.map((output) => ({
        lockingBytecode: output.lockingBytecode,
        valueSatoshis: output.value,
        token: vmToken(output.token),
      })),
    },
    sourceOutputs: transaction.inputs.map((input) => ({
      lockingBytecode: input.lockingBytecode,
      valueSatoshis: input.value,
      token: vmToken(input.token),
    })),
  };
}

/** Whether the machine accepts the validator head and every facet the head binds. */
function programAccepts(transaction: FramedTransaction, validatorIndex: number): boolean {
  const vm = compositionMachine();
  const program = toVm(transaction);
  for (let offset = 0; offset <= FACET_COUNT; offset += 1) {
    const state = vm.evaluate({
      inputIndex: validatorIndex + offset,
      sourceOutputs: program.sourceOutputs,
      transaction: program.transaction,
    });
    if (vm.stateSuccess(state) !== true) return false;
  }
  return true;
}

/** The composition laid out against the shipped program and its facets. */
function laidOut(plan: CompositionPlan): Composition {
  return planComposition({ ...plan, validatorTemplate: PROGRAM, validatorFacets: FACETS });
}

/** The rule the derivation refuses for, or undefined when it accepts. */
function derivationReason(composition: Composition): ValidatorReasonName | undefined {
  return decideValidator(materialise(composition), {
    validatorTemplate: PROGRAM,
    validatorInputIndex: composition.validatorIndex,
  }).rejection?.reason;
}

function contract(id: string, label: string): ContractPlan {
  return {
    id,
    category: categoryOf(label),
    masterLock: contractLockOf(seedBytes(`code:${label}`, 8)),
    stateLock: contractLockOf(seedBytes(`state:${label}`, 8)),
    eventLock: contractLockOf(seedBytes(`event:${label}`, 8)),
  };
}

/** The one fact a case changes, so every case differs from the accepted plan in exactly that fact. */
interface ReadOptions {
  /** A commitment the delegate frame leaves the proxy's record at; omitted means the delegate reads it. */
  readonly delegateViewOut?: Uint8Array;
  /** How many events the delegate frame emits. */
  readonly delegateEvents?: number;
  /** The value the proxy frame's delegate call carries. */
  readonly callValue?: bigint;
  /** A commitment a frame one level below the delegate leaves the record at. */
  readonly belowViewOut?: Uint8Array;
  /** A commitment the read-only proxy frame itself leaves the record at. */
  readonly proxyViewOut?: Uint8Array;
  /** Whether the proxy frame is reached by a message call rather than a read-only call. */
  readonly viaMessageCall?: boolean;
}

/**
 * The plan: a caller's root frame calls the proxy's read-only frame, which delegates into the implementation.
 *
 * The implementation's frame reads the proxy's record and returns the value the caller's root frame reads. The
 * caller is the contract the validator is bound to, the proxy is the contract the delegate frame runs on, and the
 * implementation and the frame below it are separate contracts of their own.
 */
function readPlan(options: ReadOptions = {}): CompositionPlan {
  const hasBelow = options.belowViewOut !== undefined;
  const messageHop = options.viaMessageCall === true;
  const delegateTouch: RecordTouchPlan = options.delegateViewOut === undefined
    ? { slot: 'S' }
    : { slot: 'S', viewOut: options.delegateViewOut };
  const delegateChildren = hasBelow ? ['Below.step'] : [];
  const delegateSegments: SegmentPlan[] = hasBelow
    ? [{ touches: [] }, { touches: [] }]
    : [{ touches: [delegateTouch] }];

  return {
    contracts: [
      contract('Caller', 'proxy-delegate caller'),
      contract('Proxy', 'proxy-delegate proxy'),
      contract('Impl', 'proxy-delegate implementation'),
      contract('Below', 'proxy-delegate below'),
    ],
    users: [{ id: 'U', lock: userLockOf('U'), value: 500_000n }],
    stateSlots: [{ id: 'S', contract: 'Proxy', commitment: RECORD_BEFORE, value: 3_000n }],
    createdSlots: [],
    masters: [
      {
        id: 'Caller.go',
        contract: 'Caller',
        kind: FrameKind.ROOT,
        caller: 'U',
        selector: selectorOf('go'),
        args: [],
        children: ['Proxy.hop'],
        callKinds: [messageHop ? FrameKind.CALL : FrameKind.STATIC],
        callValues: [0n],
        segments: [{ touches: [] }, { touches: [] }],
        retval: EMPTY,
      },
      {
        id: 'Proxy.hop',
        contract: 'Proxy',
        kind: messageHop ? FrameKind.CALL : FrameKind.STATIC,
        caller: 'Caller.go',
        selector: selectorOf('hop'),
        args: [],
        children: ['Impl.work'],
        callKinds: [FrameKind.DELEGATE],
        callValues: [options.callValue ?? 0n],
        segments: [
          { touches: options.proxyViewOut === undefined ? [] : [{ slot: 'S', viewOut: options.proxyViewOut }] },
          { touches: [] },
        ],
        retval: ANSWER,
      },
      {
        id: 'Impl.work',
        contract: 'Impl',
        kind: FrameKind.DELEGATE,
        caller: 'Proxy.hop',
        selector: selectorOf('work'),
        args: [],
        children: delegateChildren,
        callKinds: delegateChildren.map(() => FrameKind.DELEGATE),
        segments: delegateSegments,
        events: options.delegateEvents ?? 0,
        retval: ANSWER,
      },
      ...(hasBelow
        ? [{
          id: 'Below.step',
          contract: 'Below',
          kind: FrameKind.DELEGATE,
          caller: 'Impl.work',
          selector: selectorOf('step'),
          args: [],
          children: [],
          segments: [{ touches: [{ slot: 'S', viewOut: options.belowViewOut }] }],
          retval: EMPTY,
        }]
        : []),
    ],
    changeUser: 'U',
  };
}

/** The kind-carrying frame kinds of a composition, as the validator reads them from the witness blocks. */
function frameKinds(composition: Composition): Record<string, number> {
  return Object.fromEntries([...composition.blocks].map(([id, block]) => [id, block.kind]));
}

describe('a read-only entry reached through a proxy that delegates into it', () => {
  it('reads as the caller records a read-only frame and the proxy delegates into a read-only frame', () => {
    const composition = laidOut(readPlan());
    expect(frameKinds(composition)).toStrictEqual({
      'Caller.go': FrameKind.ROOT,
      'Proxy.hop': FrameKind.STATIC,
      'Impl.work': FrameKind.DELEGATE,
    });
  });

  it('is accepted by the derivation and by the shipped program', () => {
    const composition = laidOut(readPlan());
    const transaction = materialise(composition);
    expect(derivationReason(composition)).toBeUndefined();
    expect(programAccepts(transaction, composition.validatorIndex)).toBe(true);
  });

  it('is refused by both when the delegate frame changes the record it reads', () => {
    const composition = laidOut(readPlan({ delegateViewOut: RECORD_AFTER }));
    expect(derivationReason(composition)).toBe('V10_STATIC_RECORD_CHANGED');
    expect(programAccepts(materialise(composition), composition.validatorIndex)).toBe(false);
  });

  it('is refused by both when the delegate frame emits an event', () => {
    const composition = laidOut(readPlan({ delegateEvents: 1 }));
    expect(derivationReason(composition)).toBe('V10_STATIC_EVENT');
    expect(programAccepts(materialise(composition), composition.validatorIndex)).toBe(false);
  });

  it('is refused by both when the delegate call carries value', () => {
    const composition = laidOut(readPlan({ callValue: 1n }));
    expect(derivationReason(composition)).toBe('V10_STATIC_VALUE_CALL');
    expect(programAccepts(materialise(composition), composition.validatorIndex)).toBe(false);
  });

  it('is refused by both when the read-only proxy frame itself writes the record', () => {
    const composition = laidOut(readPlan({ proxyViewOut: RECORD_AFTER }));
    expect(derivationReason(composition)).toBe('V10_STATIC_RECORD_CHANGED');
    expect(programAccepts(materialise(composition), composition.validatorIndex)).toBe(false);
  });

  it('is refused by both when a frame one level below the delegate writes the record', () => {
    const composition = laidOut(readPlan({ belowViewOut: RECORD_AFTER }));
    expect(derivationReason(composition)).toBe('V10_STATIC_RECORD_CHANGED');
    expect(programAccepts(materialise(composition), composition.validatorIndex)).toBe(false);
  });
});

/**
 * The control: a delegate frame a message call reaches may write.
 *
 * The rule is about the subtree a read-only frame reaches, not about the delegate kind by itself. A delegate frame
 * whose caller chain climbs to a message call rather than a read-only frame is outside that subtree, so its write is
 * no more refused than any other message-reached frame's.
 */
describe('a delegate frame a message call reaches', () => {
  it('is accepted by both even when it writes the record', () => {
    const composition = laidOut(readPlan({ viaMessageCall: true, delegateViewOut: RECORD_AFTER }));
    expect(frameKinds(composition)).toStrictEqual({
      'Caller.go': FrameKind.ROOT,
      'Proxy.hop': FrameKind.CALL,
      'Impl.work': FrameKind.DELEGATE,
    });
    expect(derivationReason(composition)).toBeUndefined();
    expect(programAccepts(materialise(composition), composition.validatorIndex)).toBe(true);
  });
});
