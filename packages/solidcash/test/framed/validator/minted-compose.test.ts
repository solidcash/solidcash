/**
 * The minted-master shape as the composer builds it.
 *
 * `minted-genesis.test.ts` hand-lays the genesis-shape transaction; this suite runs the same shape through the
 * composer (`composeDraft`) and checks the derivation accepts what it assembles. A minted master is an output the
 * transaction creates rather than spends, whose witness block rides in the v0x03 transcript; its callee's caller is
 * `mintedRef(output)` and the callee's origin is `INDEX_NONE`.
 */

import { describe, expect, test } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  FrameKind,
  INDEX_NONE,
  mintedRef,
  validatorAddress,
  validatorRedeemScript,
} from '@solidcash/utils';
import {
  buildValidatorFacets,
  buildValidatorProgram,
  decideValidator,
  tokenShape,
  type FramedTransaction,
  type InputView,
  type OutputView,
  type TokenShape,
} from '../../../../solidc/src/framed/validator/index.js';
import {
  INDEX_NONE_REFERENCE,
  composeDraft,
  type CompositionDraftPlan,
  type DraftInput,
  type DraftMaster,
  type DraftMintedMaster,
} from '../../../src/framed/composer/index.js';
import {
  categoryOf,
  contractLockOf,
  selectorOf,
} from './fixture.js';

const PROGRAM = buildValidatorProgram();
const FACETS = buildValidatorFacets();

const writerCategory = categoryOf('minted-compose-writer');
const proxyCategory = categoryOf('minted-compose-proxy');
const writerCode = categoryOf('minted-compose-writer-code');
const proxyCode = categoryOf('minted-compose-proxy-code');
const SELECTOR = selectorOf('bump');

const WRITER_MASTER = 'writer';
const PROXY_MASTER = 'proxy';
const VALIDATOR = 'validator';
const FACET = 'validator/1';

/** The model token the derivation reads, from a machine token. */
function modelToken(
  token: { category: Uint8Array; amount: bigint; nft?: { capability: string; commitment: Uint8Array } } | undefined,
): TokenShape {
  if (token === undefined || token.category.length === 0) return tokenShape(new Uint8Array(0), 0, false);
  const capability = token.nft?.capability === 'minting' ? 2 : token.nft?.capability === 'mutable' ? 1 : 0;
  return tokenShape(token.category, capability, token.nft !== undefined, token.nft?.commitment ?? new Uint8Array(0), token.amount);
}

/** Turns the composer's shipped program into the model transaction the derivation reads. */
function toModel(program: ReturnType<ReturnType<typeof composeDraft>['programFor']>): FramedTransaction {
  const inputs: InputView[] = program.transaction.inputs.map((input, index) => {
    const source = program.sourceOutputs[index]!;
    return {
      index,
      value: source.valueSatoshis,
      lockingBytecode: source.lockingBytecode,
      unlockingBytecode: input.unlockingBytecode,
      token: modelToken(source.token),
      outpointTransactionHash: input.outpointTransactionHash,
      outpointIndex: input.outpointIndex,
    };
  });
  const outputs: OutputView[] = program.transaction.outputs.map((output, index) => ({
    index,
    value: output.valueSatoshis,
    lockingBytecode: output.lockingBytecode,
    token: modelToken(output.token),
  }));
  return { inputs, outputs };
}

/** The honest call: the proxy root calls the writer, recording the writer's address and empty arguments. */
function honestCall(): DraftMaster['calls'][number] {
  return {
    kind: FrameKind.CALL,
    callee: WRITER_MASTER,
    target: validatorAddress(writerCategory, PROGRAM),
    value: 0n,
    argumentPushes: [SELECTOR],
    result: new Uint8Array(0),
  };
}

/** The writer master, entered by the minted proxy root. */
function writerMaster(): DraftMaster {
  return {
    master: WRITER_MASTER,
    contract: 'writer',
    functionName: 'Writer.bump()',
    program: new Uint8Array(0),
    facts: {
      contract: 'writer', functionName: 'Writer.bump()', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: {
      kind: FrameKind.CALL,
      sender: validatorAddress(proxyCategory, PROGRAM),
      self: validatorAddress(writerCategory, PROGRAM),
      value: 0n,
    },
    enteredBy: PROXY_MASTER,
    origin: INDEX_NONE_REFERENCE,
    calls: [],
    retval: new Uint8Array(0),
    segments: [[]],
    events: [],
    sends: [],
    argumentPushes: [SELECTOR],
    redeemScript: writerCode,
  };
}

/** The minted proxy root: a ROOT frame with no caller, calling the writer. */
function proxyMaster(): DraftMintedMaster {
  return {
    master: PROXY_MASTER,
    contract: 'proxy',
    frame: { kind: FrameKind.ROOT, sender: new Uint8Array(0), self: validatorAddress(proxyCategory, PROGRAM), value: 0n },
    calls: [honestCall()],
    retval: new Uint8Array(0),
    segments: [[], []],
    events: [],
    sends: [],
    output: {
      lockingBytecode: contractLockOf(proxyCode),
      valueSatoshis: 10_000n,
      token: { category: proxyCategory, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
    },
  };
}

function plan(): CompositionDraftPlan {
  const inputs: Record<string, DraftInput> = {
    [VALIDATOR]: {
      source: {
        lockingBytecode: validatorAddress(writerCategory, PROGRAM),
        valueSatoshis: 10_000n,
        token: { category: writerCategory, amount: 0n, nft: { capability: 'mutable', commitment: categoryOf('minted-compose-validator-commitment').subarray(0, 8) } },
      },
    },
    [FACET]: {
      source: {
        lockingBytecode: encodeLockingBytecodeP2sh32(hash256(FACETS[0]!)),
        valueSatoshis: 10_000n,
      },
    },
    [WRITER_MASTER]: {
      source: {
        lockingBytecode: contractLockOf(writerCode),
        valueSatoshis: 10_000n,
        token: { category: writerCategory, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
      },
    },
  };
  return {
    blocks: [{
      contract: 'writer',
      masters: [WRITER_MASTER],
      validator: { id: VALIDATOR, settles: [] },
      state: [],
    }],
    userInputs: [],
    masters: [writerMaster()],
    mintedMasters: [proxyMaster()],
    inputs,
    validator: {
      id: VALIDATOR,
      covers: ['proxy'],
      settles: [],
      redeemScript: validatorRedeemScript(writerCategory, PROGRAM),
    },
  };
}

describe('the minted-master shape, as the composer builds it', () => {
  test('assembles a v0x03 transcript and the derivation accepts it', () => {
    const draft = composeDraft(plan());
    const program = draft.programFor(WRITER_MASTER);
    const model = toModel(program);
    // The composer lays the writer's master first, then its validator and facet, so the head is input 1.
    const decided = decideValidator(model, { validatorTemplate: PROGRAM, validatorInputIndex: 1 });
    console.log('rejection', JSON.stringify(decided.rejection));
    expect(decided.accepted).toBe(true);

    // The writer's caller is the minted proxy master, and its origin is INDEX_NONE.
    const writerBlock = draft.blockOf(WRITER_MASTER);
    expect(writerBlock.callerRef).toBe(mintedRef(3));
    expect(writerBlock.originRef).toBe(INDEX_NONE);

    // The transcript is the genesis-shape codec, carrying the proxy's block inline at its minted output.
    const mintedBlock = draft.blockOf(PROXY_MASTER);
    expect(mintedBlock.callerRef).toBe(INDEX_NONE);
    expect(mintedBlock.originRef).toBe(INDEX_NONE);
    expect(mintedBlock.calls[0]!.calleeRef).toBe(0);
  });
});
