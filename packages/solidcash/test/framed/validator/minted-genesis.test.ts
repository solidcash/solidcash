/**
 * The genesis-shape (version 0x03) transcript, decided by the derivation.
 *
 * SDKFRAMED-2's atomic calling initialize needs a minted proxy root master: a master the transaction mints as an
 * output rather than spends, whose witness block rides in the transcript. This suite hand-lays that minimal shape —
 * a validator, its facet, a spent Writer master, and one minted proxy root that calls the Writer — and checks the
 * derivation accepts it and refuses each edge mutation. The on-chain program path for this shape is tracked in
 * `packages/solidc/docs/deferrals.md`: its V6/V7 emitters still walk the minted list as a settle list, so the
 * program is not yet run here.
 */

import { describe, expect, test } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  FrameKind,
  INDEX_NONE,
  argsHash,
  encodeArgumentList,
  encodeMintedTranscript,
  encodeWitnessBlock,
  mintedRef,
  validatorAddress,
  validatorRedeemScript,
  type WitnessBlock,
} from '@solidcash/utils';
import {
  VALIDATOR_PROGRAM_REASONS,
  buildValidatorFacets,
  buildValidatorProgram,
  decideValidator,
  type FramedTransaction,
  type InputView,
  type OutputView,
} from '../../../../solidc/src/framed/validator/index.js';
import {
  categoryOf,
  contractLockOf,
  emptyToken,
  masterTokenShape,
  mutableTokenShape,
  selectorOf,
} from './fixture.js';

/** The real program, so the addresses this transaction presents are the ones every deployed validator derives. */
const PROGRAM = buildValidatorProgram();
const FACETS = buildValidatorFacets();

const writerCategory = categoryOf('minted-genesis-writer');
const proxyCategory = categoryOf('minted-genesis-proxy');

const writerLock = contractLockOf(categoryOf('minted-genesis-writer-code'));
const writerRedeem = categoryOf('minted-genesis-writer-redeem');

const SELECTOR = selectorOf('bump');

/** The writer master (spent): a CALL frame entered by the minted proxy root. */
function writerBlock(callerRef: number, overrides: Partial<WitnessBlock> = {}): WitnessBlock {
  return {
    kind: FrameKind.CALL,
    callerRef,
    originRef: INDEX_NONE,
    validatorRef: 0,
    sender: validatorAddress(proxyCategory, PROGRAM),
    self: validatorAddress(writerCategory, PROGRAM),
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
    ...overrides,
  };
}

/** The proxy root (minted): a ROOT frame with no caller, calling the writer. */
function proxyBlock(calls: WitnessBlock['calls']): WitnessBlock {
  return {
    kind: FrameKind.ROOT,
    callerRef: INDEX_NONE,
    originRef: INDEX_NONE,
    validatorRef: 0,
    sender: new Uint8Array(0),
    self: validatorAddress(proxyCategory, PROGRAM),
    value: 0n,
    retval: new Uint8Array(0),
    calls,
    segments: calls.map(() => []).concat([[]]),
    events: [],
    sends: [],
  };
}

/** The genesis transaction with the writer at input 2 and the minted proxy root at output 3. */
function transaction(block: WitnessBlock, proxyCalls: WitnessBlock['calls']): FramedTransaction {
  const transcript = encodeMintedTranscript({
    roots: [],
    masters: [2],
    mintedMasters: [{ output: 3, block: proxyBlock(proxyCalls) }],
    settles: [],
  });
  const inputs: InputView[] = [
    {
      index: 0,
      value: 10_000n,
      lockingBytecode: validatorAddress(writerCategory, PROGRAM),
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(transcript),
        ...encodeDataPush(validatorRedeemScript(writerCategory, PROGRAM)),
      ]),
      token: mutableTokenShape(writerCategory, categoryOf('minted-genesis-validator-commitment').subarray(0, 8)),
      outpointTransactionHash: categoryOf('minted-genesis-outpoint:0'),
      outpointIndex: 0,
    },
    {
      index: 1,
      value: 10_000n,
      lockingBytecode: encodeLockingBytecodeP2sh32(hash256(FACETS[0]!)),
      unlockingBytecode: encodeDataPush(FACETS[0]!),
      token: emptyToken(),
      outpointTransactionHash: categoryOf('minted-genesis-outpoint:1'),
      outpointIndex: 0,
    },
    {
      index: 2,
      value: 10_000n,
      lockingBytecode: writerLock,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(block)),
        ...encodeDataPush(SELECTOR),
        ...encodeDataPush(writerRedeem),
      ]),
      token: masterTokenShape(writerCategory),
      outpointTransactionHash: categoryOf('minted-genesis-outpoint:2'),
      outpointIndex: 0,
    },
  ];
  const outputs: OutputView[] = [
    { index: 0, value: 10_000n, lockingBytecode: validatorAddress(writerCategory, PROGRAM), token: mutableTokenShape(writerCategory, categoryOf('minted-genesis-validator-commitment').subarray(0, 8)) },
    { index: 1, value: 10_000n, lockingBytecode: encodeLockingBytecodeP2sh32(hash256(FACETS[0]!)), token: emptyToken() },
    { index: 2, value: 10_000n, lockingBytecode: writerLock, token: masterTokenShape(writerCategory) },
    { index: 3, value: 10_000n, lockingBytecode: contractLockOf(categoryOf('minted-genesis-proxy-code')), token: masterTokenShape(proxyCategory) },
  ];
  return { inputs, outputs };
}

/** The honest call: the proxy root calls the writer at input 2, recording the writer's address and empty arguments. */
function honestCall(): WitnessBlock['calls'][number] {
  return {
    kind: FrameKind.CALL,
    target: validatorAddress(writerCategory, PROGRAM),
    value: 0n,
    calleeRef: 2,
    argsHash: argsHash(SELECTOR, encodeArgumentList([])),
    result: new Uint8Array(0),
  };
}

/** The model transaction the derivation reads. */
function model(tx: FramedTransaction): ReturnType<typeof decideValidator> {
  return decideValidator(tx, { validatorTemplate: PROGRAM, validatorInputIndex: 0 });
}

/** Replaces the writer's witness block. */
function withWriterBlock(tx: FramedTransaction, block: WitnessBlock): FramedTransaction {
  return {
    ...tx,
    inputs: tx.inputs.map((input) => (input.index === 2
      ? {
        ...input,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeDataPush(SELECTOR),
          ...encodeDataPush(writerRedeem),
        ]),
      }
      : input)),
  };
}

describe('the genesis-shape transcript, decided by the derivation', () => {
  test('accepts a minted proxy root whose call names the spent writer', () => {
    expect(model(transaction(writerBlock(mintedRef(3)), [honestCall()])).accepted).toBe(true);
  });

  test('refuses a minted root whose callee records a different caller', () => {
    const tx = transaction(writerBlock(mintedRef(3)), [honestCall()]);
    expect(model(withWriterBlock(tx, writerBlock(2))).rejection?.reason).toBe('V5_CALLER_MISMATCH');
  });

  test('refuses a minted root whose callee records a different kind', () => {
    const tx = transaction(writerBlock(mintedRef(3)), [honestCall()]);
    expect(model(withWriterBlock(tx, writerBlock(mintedRef(3), { kind: FrameKind.STATIC }))).rejection?.reason)
      .toBe('V5_KIND_MISMATCH');
  });

  test('refuses a minted root whose call names an input that is not a covered master', () => {
    const tx = transaction(writerBlock(mintedRef(3)), [{ ...honestCall(), calleeRef: 1 }]);
    expect(model(tx).rejection?.reason).toBe('V5_CALLEE_NOT_A_MASTER');
  });

  test('refuses a minted root that records a caller or an origin', () => {
    const tx = transaction(writerBlock(mintedRef(3)), [honestCall()]);
    const minted = encodeMintedTranscript({
      roots: [],
      masters: [2],
      mintedMasters: [{ output: 3, block: { ...proxyBlock([honestCall()]), callerRef: 0 } }],
      settles: [],
    });
    const forged: FramedTransaction = {
      ...tx,
      inputs: tx.inputs.map((input) => (input.index === 0
        ? {
          ...input,
          unlockingBytecode: new Uint8Array([
            ...encodeDataPush(minted),
            ...encodeDataPush(validatorRedeemScript(writerCategory, PROGRAM)),
          ]),
        }
        : input)),
    };
    expect(model(forged).rejection?.reason).toBe('V4_ROOT_ORIGIN_MISMATCH');
  });
});

describe('the minted V5 reasons are on-chain', () => {
  test('the program names the edge reasons the minted walk enforces', () => {
    for (const reason of ['V5_CALLER_MISMATCH', 'V5_KIND_MISMATCH', 'V5_CALLEE_NOT_A_MASTER'] as const) {
      expect(VALIDATOR_PROGRAM_REASONS).toContain(reason);
    }
  });
});
