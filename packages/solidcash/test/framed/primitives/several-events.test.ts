import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import {
  FrameKind, buildEventNftCovenantScript, computeEventNameHash, encodeEventCommitment, hash256, scriptToBytecode,
} from '@solidcash/utils';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, master, masterInput, rootOf, selectorOf, token,
  userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import {
  allocateOutputRegions,
  type CompositionDraftPlan, type DraftMaster, type DraftTrailingOutput,
} from '../../../src/framed/composer/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';

/**
 * Two events of one contract, emitted by two frames of one transaction.
 *
 * The contract has two entries and one master per entry, so each event is emitted by its own frame. The plan gives
 * each event a trailing output; the layout is the composer's, and the covenant and commitment come from the
 * shipped event encoders. Every contract input — the two masters and the validator that orders them — is asked of
 * the BCH-2026 machine, and both events are read back out of the derived transaction with the shipped receipt.
 */

const LOG_LABEL = 'two events one contract';
const ALPHA = 1n;
const BETA = 2n;

describe('two events of one contract emitted from two frames', () => {
  it('lists both at their own outputs and reads both commitments back, accepted at every contract input', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Log {'
      + '   event Alpha(int x);'
      + '   event Beta(int y);'
      + '   function first() { emit Alpha(1); require(true); }'
      + '   function second() { emit Beta(2); require(true); }'
      + ' }';
    const { artifacts, contracts } = compileAndDeploy(source, { Log: LOG_LABEL });
    const log = contracts.Log!;
    const [alpha, beta] = artifacts.Log!.events!;

    // The layout, not the test, says where the trailing event outputs sit.
    const blocks = [{
      contract: 'Log', masters: ['log-first', 'log-second'], validator: { id: 'validator', settles: [] }, state: [],
    }];
    const layout = layoutWithFacets(blocks);
    const regions = allocateOutputRegions(layout, { events: 2, sends: 0, created: 0 });

    // The shipped encoders build each event's covenant lock and NFT commitment.
    const commitments = [
      encodeEventCommitment(alpha!.parameters, [ALPHA]),
      encodeEventCommitment(beta!.parameters, [BETA]),
    ];
    const locks = [alpha!, beta!].map((event) => encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(
      buildEventNftCovenantScript(log.category, computeEventNameHash(event.signature))))));
    const trailingOutputs: DraftTrailingOutput[] = commitments.map((commitment, index) => ({
      lockingBytecode: locks[index]!, valueSatoshis: 1_000n,
      token: { category: log.category, amount: 0n, nft: { capability: 'none', commitment } },
    }));

    const validator = validatorFor(log.category);
    const buildMaster = (masterId: string, entry: string, user: string, eventIndex: number): DraftMaster => ({
      ...master({
        master: masterId, contract: 'Log', entry, program: log.program,
        facts: {
          contract: 'Log', functionName: entry, kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 2,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: log.address, value: 0n },
        enteredBy: user, origin: user,
        // A two-entry program dispatches, so a user-entered master carries the selector of its entry.
        argumentPushes: [selectorOf(artifacts, 'Log', entry)],
        dispatches: true,
      }),
      events: [eventIndex],
    });
    const plan: CompositionDraftPlan = {
      blocks,
      userInputs: userInputs(['user-first', 'user-second'], layout.funderInputBase),
      masters: [
        buildMaster('log-first', 'first', 'user-first', regions.eventIndices[0]!),
        buildMaster('log-second', 'second', 'user-second', regions.eventIndices[1]!),
      ],
      inputs: {
        'log-first': { source: masterInput(log) },
        'log-second': { source: masterInput(log) },
        validator: {
          source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(log.category, 'mutable') },
        },
        'user-first': userInput(),
        'user-second': userInput(),
      },
      trailingOutputs,
      validator: {
        id: 'validator', covers: [],
        settles: [{ category: log.category, stateInputs: [] }],
        redeemScript: validator.redeem,
      },
    };

    const outcome = composeAndDerive(plan, [artifacts.Log!], [
      rootOf('Log', 'first', 'log-first'), rootOf('Log', 'second', 'log-second'),
    ]);

    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`)).toStrictEqual([]);
    // Both frames complete, and the composer allocates one trailing output per event.
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Log', 'first'), entryName('Log', 'second')]);
    expect(outcome.draft.assembly.outputs.eventIndices).toStrictEqual([...regions.eventIndices]);

    // Each frame's own block lists its own event output.
    expect(outcome.draft.blockOf('log-first').events).toStrictEqual([regions.eventIndices[0]]);
    expect(outcome.draft.blockOf('log-second').events).toStrictEqual([regions.eventIndices[1]]);

    // The shipped receipt decodes both commitments, one per emitting frame, in output order.
    const logs = compositionEventLogs(outcome.draft, [artifacts.Log!]);
    expect(logs.map((entry) => ({
      eventName: entry.eventName,
      eventSignature: entry.eventSignature,
      emitter: entry.emitter,
      outputIndex: entry.outputIndex,
      values: entry.values,
      commitment: entry.commitment,
    }))).toStrictEqual([
      {
        eventName: 'Alpha', eventSignature: alpha!.signature, emitter: 'log-first',
        outputIndex: regions.eventIndices[0]!, values: [ALPHA], commitment: commitments[0]!,
      },
      {
        eventName: 'Beta', eventSignature: beta!.signature, emitter: 'log-second',
        outputIndex: regions.eventIndices[1]!, values: [BETA], commitment: commitments[1]!,
      },
    ]);
  });
});
