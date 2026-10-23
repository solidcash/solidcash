import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind,
  buildPushdataCommitment,
  bytesToHex,
  encodeIntegerValue,
  encodeResultList,
  validatorAddress,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  deployMaster,
  readComputedDeclaration,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  UNFILLED_CALLEE_REF,
  createComposedDerivationHost,
  createShippedDerivationHost,
  deriveDepthFirst,
  participant,
  type CompositionDraft,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { layoutWithFacets } from '../shapes/harness.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * A nested read: a `STATIC` root whose entry reads another contract's `view` entry.
 *
 * `A.peek` runs in a read-only frame and calls `B.value`, another read-only frame. Nothing in the call changes a
 * record, so the two frames are two reads in one transaction. The values are learned the same way a direct read
 * learns one: each frame records a placeholder, and the frame's own return comparison hands back what it computed.
 * A callee's value is what its caller's call record must carry, so the callee is learned first and its value is
 * written into the caller's record before the caller's own comparison is read.
 *
 * The suite reports how the two-frame read lands: every contract input the machine is asked about is accepted, the
 * caller's recorded value is the callee's, and the shipped derivation completes once the callee's reference is the
 * only witness still missing when the driver reaches the call site.
 */

const CATEGORY_A = seededCategory('reads nested A');
const CATEGORY_B = seededCategory('reads nested B');
const CATEGORY_B_HEX = bytesToHex(CATEGORY_B);
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS_A = validatorAddress(CATEGORY_A, VALIDATOR_PROGRAM);
const ADDRESS_B = validatorAddress(CATEGORY_B, VALIDATOR_PROGRAM);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IB { function value() view returns (int); }'
  + ' contract B { int public v; function value() view returns (int) { return this.v; } }'
  + ' contract A {'
  + `   function peek() view returns (int) { return IB(0x${Buffer.from(ADDRESS_B).toString('hex')}).value(); }`
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const aArtifact = artifacts.A!;
const bArtifact = artifacts.B!;
const VALUE_SELECTOR = new Uint8Array(Buffer.from(bArtifact.abi.find((row) => row.name === 'value')!.selector!, 'hex'));
const PEEK_SELECTOR = new Uint8Array(Buffer.from(aArtifact.abi.find((row) => row.name === 'peek')!.selector!, 'hex'));

const empty = new Uint8Array(0);
const token = (
  capability: 'minting' | 'mutable',
  category: Uint8Array,
  commitmentBytes: Uint8Array = empty,
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: commitmentBytes } });

const BVALUE = 7n;

/** The two-contract read plan, with each frame's value still a placeholder. */
function buildPlan(): { readonly plan: CompositionDraftPlan; readonly commitment: Uint8Array } {
  const a = deployMaster(aArtifact, CATEGORY_A, VALIDATOR_PROGRAM);
  const b = deployMaster(bArtifact, CATEGORY_B, VALIDATOR_PROGRAM);
  const validator = validatorSpend(CATEGORY_A, { roots: [], masters: [0, 2], settles: [] });
  const commitment = new Uint8Array(
    Buffer.from(buildPushdataCommitment(bArtifact.stateLayout!, { v: BVALUE }, 0), 'hex'),
  );
  const blocks = [
    { contract: 'A', masters: ['read-1'], validator: { id: 'validator', settles: [] }, state: [] },
    { contract: 'B', masters: ['value-1'], state: ['record-b'] },
  ];
  const layout = layoutWithFacets(blocks);

  const readMaster: DraftMaster = {
    master: 'read-1', contract: 'A', functionName: 'A.peek()', program: a.script,
    facts: {
      contract: 'A', functionName: 'peek', kind: FrameKind.STATIC, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.STATIC, sender: ADDRESS_B, self: ADDRESS_A, value: 0n },
    enteredBy: 'record-b', origin: 'record-b',
    calls: [{
      kind: FrameKind.STATIC, callee: 'value-1', target: ADDRESS_B, value: 0n, argumentPushes: [VALUE_SELECTOR],
    }],
    retval: new Uint8Array(32).fill(0xcd),
    segments: [[], []],
    events: [], sends: [], argumentPushes: [PEEK_SELECTOR], redeemScript: a.script, dispatches: true,
  };
  const valueMaster: DraftMaster = {
    master: 'value-1', contract: 'B', functionName: 'B.value()', program: b.script,
    facts: {
      contract: 'B', functionName: 'value', kind: FrameKind.STATIC, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.STATIC, sender: ADDRESS_A, self: ADDRESS_B, value: 0n },
    enteredBy: 'read-1', origin: 'record-b',
    calls: [], retval: new Uint8Array(32).fill(0xef),
    // The record B's frame reads, at the index the layout gives it.
    segments: [[{ in: participant(layout, 'record-b').index, out: participant(layout, 'record-b').index,
      viewIn: commitment, viewOut: commitment }]],
    events: [], sends: [], argumentPushes: [VALUE_SELECTOR], redeemScript: b.script,
  };

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [],
    masters: [readMaster, valueMaster],
    inputs: {
      'read-1': {
        source: { lockingBytecode: a.lockingBytecode, valueSatoshis: 20_000n, token: token('minting', CATEGORY_A) },
      },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token('mutable', CATEGORY_A) },
      },
      'value-1': {
        source: { lockingBytecode: b.lockingBytecode, valueSatoshis: 20_000n, token: token('minting', CATEGORY_B) },
      },
      'record-b': {
        source: {
          lockingBytecode: stateRecordLockingBytecode(CATEGORY_B_HEX),
          valueSatoshis: 20_000n, token: token('mutable', CATEGORY_B, commitment),
        },
        // A read leaves the record where it is, so it takes the covenant's read-only path.
        unlockingBytecode: stateRecordUnlockingBytecode(CATEGORY_B_HEX, participant(layout, 'value-1').index, 0),
      },
    },
    validator: { id: 'validator', covers: ['B'], settles: [], redeemScript: validator.redeem },
  };
  return { plan, commitment };
}

/** One frame's recorded answer, or the run's failure, read back through the shipped declaration channel. */
function probe(draft: CompositionDraft, master: string): Uint8Array | undefined {
  const reading = readComputedDeclaration({
    vm: compositionMachine(), program: draft.programFor(master), maximumCommitmentBytes: 128,
  });
  if (!reading.ok) return undefined;
  const placeholder = draft.blockOf(master).retval;
  return bytesToHex(reading.declared) === bytesToHex(placeholder) ? reading.computed : reading.declared;
}

/** The machine's verdict on one input of the assembled transaction. */
function verdict(draft: CompositionDraft, index: number): string {
  const program = draft.programFor('read-1');
  const vm: ReturnType<typeof createVirtualMachineBch2026> = compositionMachine();
  const state = vm.evaluate({ inputIndex: index, sourceOutputs: program.sourceOutputs, transaction: program.transaction });
  return vm.stateSuccess(state) === true ? 'accepted' : String((state as { error?: unknown }).error);
}

/** Composes the read, learns both frames callee-first, then derives it through the shipped driver. */
function drive(): {
  readonly draft: CompositionDraft;
  readonly completed: readonly string[];
  readonly error?: string;
} {
  const { plan } = buildPlan();
  const { draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [aArtifact, bArtifact], plan });

  // Resolve every call reference from the layout, so a caller's run reaches its own return comparison.
  for (const master of plan.masters) {
    const block = draft.blockOf(master.master);
    master.calls.forEach((call, index) => {
      block.calls[index]!.calleeRef = participant(draft.layout, call.callee).index;
    });
  }

  // Callee first: its value is what the caller's call record has to carry, and only then can the caller's own
  // comparison be read.
  const calleeValue = probe(draft, 'value-1');
  expect(calleeValue).toBeDefined();
  draft.blockOf('value-1').retval = calleeValue!;
  draft.blockOf('read-1').calls[0]!.result = calleeValue!;

  const callerValue = probe(draft, 'read-1');
  expect(callerValue).toBeDefined();
  draft.blockOf('read-1').retval = callerValue!;

  // The driver proves a call step by the program moving, so the caller's callee reference has to be the witness it
  // is still missing when it reaches the site. Everything the frames compute is already known, so unsetting it is
  // what leaves the derivation something to fill.
  draft.blockOf('read-1').calls[0]!.calleeRef = UNFILLED_CALLEE_REF;

  let completed: readonly string[] = [];
  let error: string | undefined;
  try {
    const host = createShippedDerivationHost({
      artifacts: [aArtifact, bArtifact], runs: draft.runs, vm: compositionMachine(),
    });
    completed = deriveDepthFirst(
      { contract: 'A', functionName: 'A.peek()', kind: FrameKind.STATIC, master: 'read-1' }, host,
    ).completed.map((frame) => frame.master);
  } catch (caught) {
    error = (caught as Error).message;
  }
  return { draft, completed, error };
}

describe('a read whose entry reads another contract\'s view entry', () => {
  it('lands as two read-only frames, each accepted, with the caller answering the callee\'s value', () => {
    const { draft, completed, error } = drive();

    // The callee's value is B's record, and the caller's answer is exactly what the callee returned.
    const expected = encodeResultList([encodeIntegerValue(BVALUE)]);
    expect(draft.blockOf('value-1').retval).toStrictEqual(expected);
    expect(draft.blockOf('read-1').retval).toStrictEqual(expected);
    // The caller's call record carries the callee's value, which is what a body reads back as the call's result.
    expect(draft.blockOf('read-1').calls[0]!.result).toStrictEqual(expected);

    // Both frames accept, and the record the callee read is accepted under its own covenant.
    expect(verdict(draft, participant(draft.layout, 'read-1').index)).toBe('accepted');
    expect(verdict(draft, participant(draft.layout, 'value-1').index)).toBe('accepted');
    expect(verdict(draft, participant(draft.layout, 'record-b').index)).toBe('accepted');

    // With the caller's callee reference left as the driver's witness, the shipped derivation completes callee
    // first and resumes the caller.
    expect(error).toBeUndefined();
    expect(completed).toStrictEqual(['value-1', 'read-1']);
  });
});
