/**
 * The genesis-shape (version 0x03) transcript, decided by the derivation.
 *
 * SDKFRAMED-2's atomic calling initialize needs a minted proxy root master: a master the transaction mints as an
 * output rather than spends, whose witness block rides in the transcript. This suite hand-lays that minimal shape —
 * a validator, its facet, a spent Writer master, and one minted proxy root that calls the Writer — and checks the
 * derivation accepts it and refuses each edge mutation, and that the on-chain program accepts the honest shape and
 * refuses the same edge mutation.
 */

import { describe, expect, test } from 'vitest';
import { compileString } from 'solidc';
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
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { MOCK_RELAXED_OPERATION_COST, MockNetworkProvider } from '../../../src/network/mock/index.js';

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

/** Replaces the minted root carried in the validator's transcript. */
function withMintedRoot(tx: FramedTransaction, block: WitnessBlock): FramedTransaction {
  const transcript = encodeMintedTranscript({
    roots: [],
    masters: [2],
    mintedMasters: [{ output: 3, block }],
    settles: [],
  });
  return {
    ...tx,
    inputs: tx.inputs.map((input) => (input.index === 0
      ? {
        ...input,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(transcript),
          ...encodeDataPush(validatorRedeemScript(writerCategory, PROGRAM)),
        ]),
      }
      : input)),
  };
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

  test('refuses a minted root that records a sender', () => {
    const tx = transaction(writerBlock(mintedRef(3)), [honestCall()]);
    const forged = withMintedRoot(tx, { ...proxyBlock([honestCall()]), sender: new Uint8Array([0x01]) });
    expect(model(forged).rejection?.reason).toBe('V4_MINTED_ROOT_SENDER');
  });
});

describe('the minted V5 reasons are on-chain', () => {
  test('the program names the edge reasons the minted walk enforces', () => {
    for (const reason of ['V5_CALLER_MISMATCH', 'V5_KIND_MISMATCH', 'V5_CALLEE_NOT_A_MASTER'] as const) {
      expect(VALIDATOR_PROGRAM_REASONS).toContain(reason);
    }
  });
});

/** The machine's token shape for one the derivation states. */
function vmToken(token: OutputView['token'] | InputView['token']): unknown {
  if (token.category.length === 0) return undefined;
  const capabilities = ['none', 'mutable', 'minting'] as const;
  return {
    category: token.category,
    amount: token.amount,
    ...(token.hasNft ? { nft: { capability: capabilities[token.capability]!, commitment: token.nftCommitment } } : {}),
  };
}

/** How the machine decided one input of the modelled transaction, at the relaxed operation-cost density. */
function vmVerdict(tx: FramedTransaction, inputIndex: number): { accepted: boolean; objection?: string } {
  const vm = createVirtualMachineBch2026ForProvider(
    new MockNetworkProvider({ consensusLimits: { operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST } }),
  );
  const state = vm.evaluate({
    inputIndex,
    sourceOutputs: tx.inputs.map((input) => ({
      lockingBytecode: input.lockingBytecode,
      valueSatoshis: input.value,
      token: vmToken(input.token),
    })),
    transaction: {
      version: 2,
      locktime: 0,
      inputs: tx.inputs.map((input) => ({
        outpointIndex: input.outpointIndex,
        outpointTransactionHash: input.outpointTransactionHash,
        sequenceNumber: 0xffffffff,
        unlockingBytecode: input.unlockingBytecode,
      })),
      outputs: tx.outputs.map((output) => ({
        lockingBytecode: output.lockingBytecode,
        valueSatoshis: output.value,
        token: vmToken(output.token),
      })),
    },
  });
  if (vm.stateSuccess(state) === true) return { accepted: true };
  const failure = state as { error?: unknown; errorMessage?: unknown; ip?: unknown };
  return {
    accepted: false,
    objection: `input ${inputIndex} ip ${String(failure.ip)}: `
      + `${JSON.stringify(failure.error ?? failure.errorMessage ?? Object.keys(state))}`,
  };
}

describe('the genesis-shape transcript, decided by the on-chain program', () => {
  test('accepts a minted proxy root whose call names the spent writer', () => {
    const tx = transaction(writerBlock(mintedRef(3)), [honestCall()]);
    // The facet runs first: it carries V4/V5/V6, and the head then checks the minted master's completeness.
    for (const inputIndex of [1, 0]) {
      expect(vmVerdict(tx, inputIndex).accepted).toBe(true);
    }
  });

  test('refuses a minted root whose callee records a different caller', () => {
    const tx = transaction(writerBlock(mintedRef(3)), [honestCall()]);
    expect(vmVerdict(withWriterBlock(tx, writerBlock(2)), 1).accepted).toBe(false);
  });

  // A minted root's self has to be the address of its output's category. The derivation reports V11, and the
  // facet reads that output and refuses a self that names another category.
  test('a forged minted-root self fails on chain and as V11 in the derivation', () => {
    const authorized = validatorAddress(categoryOf('audit-expected-authority'), PROGRAM);
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Guarded {'
      + `   function act() { require(msg.sender == 0x${Buffer.from(authorized).toString('hex')}); }`
      + ' }';
    const artifact = compileString(source, { composition: 'framed' });
    const deployed = deployMaster(artifact, writerCategory, PROGRAM);
    const selector = Uint8Array.from(Buffer.from(artifact.abi.find((row) => row.name === 'act')!.selector!, 'hex'));
    const call = { ...honestCall(), argsHash: argsHash(selector, encodeArgumentList([])) };
    const frame = writerBlock(mintedRef(3), { sender: authorized });
    const tx = transaction(frame, [call]);
    const transcript = encodeMintedTranscript({
      roots: [],
      masters: [2],
      mintedMasters: [{ output: 3, block: { ...proxyBlock([call]), self: authorized } }],
      settles: [],
    });
    const changed: FramedTransaction = {
      ...tx,
      inputs: tx.inputs.map((input) => {
        if (input.index === 0) {
          return {
            ...input,
            unlockingBytecode: new Uint8Array([
              ...encodeDataPush(transcript),
              ...encodeDataPush(validatorRedeemScript(writerCategory, PROGRAM)),
            ]),
          };
        }
        if (input.index === 2) {
          return {
            ...input,
            lockingBytecode: deployed.lockingBytecode,
            unlockingBytecode: new Uint8Array([
              ...encodeDataPush(encodeWitnessBlock(frame)),
              ...encodeDataPush(selector),
              ...encodeDataPush(deployed.script),
            ]),
          };
        }
        return input;
      }),
      outputs: tx.outputs.map((output) => (
        output.index === 2 ? { ...output, lockingBytecode: deployed.lockingBytecode } : output
      )),
    };
    expect(model(changed).rejection?.reason).toBe('V11_SELF_NOT_CONTRACT_ADDRESS');
    // The facet carries the minted-root rule. A transaction the facet refuses does not settle.
    expect(vmVerdict(changed, 1).accepted).toBe(false);
  });

  test('a minted root that records a sender fails on chain', () => {
    const tx = transaction(writerBlock(mintedRef(3)), [honestCall()]);
    const forged = withMintedRoot(tx, { ...proxyBlock([honestCall()]), sender: new Uint8Array([0x01]) });
    expect(vmVerdict(forged, 1).accepted).toBe(false);
  });
});
