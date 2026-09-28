import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  buildEntryNftCovenantScript,
  buildPushdataCommitment,
  bytesToHex,
  computeCollectionHash,
  encodeEventCommitment,
  encodeIntegerValue,
  type RecordEntry,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { eventOutput } from '../../../../solidc/test/per-call/master/event-input.js';
import { seededCategory, REAL_VALIDATOR_PROGRAM } from '../../../../solidc/test/per-call/master/validator-input.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import {
  deployMaster,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/per-call/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveComposition,
  layOutMappingWrites,
  layoutTransaction,
  participant,
  planMappingWrite,
  reportCompositionRefusal,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import {
  composeAndDerive,
  entryName,
  master,
  masterInput,
  rootOf,
  token,
  userInput,
  userInputs,
  validatorFor,
  type DeployedContract,
  USER_LOCK,
} from './harness.js';
import {
  encodeEntryCommitment,
  headSentinelCommitment,
  keyToSlot,
} from '../../../src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../src/utils.js';

/**
 * One entry that keeps its contract's data-NFT record and writes a mapping batch.
 *
 * The frame's segment declares its own state record first — that record is what its state sites read and what the
 * head derives the state block's base from — and the mapping nodes it writes after it. The plan, its coordinates
 * and every commitment come from the shipped encoders and the shipped layout; the case pins where the run stops.
 */

const LABEL = 'record with mapping write';
const CATEGORY = seededCategory(LABEL);
const CATEGORY_HEX = bytesToHex(CATEGORY);

const RECORD_ID = 'record';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const MASTER = 'impl-1';
const HEAD_ID = 'head';
const READ_NODE_ID = 'read-node';
const READ_KEY = 9n;
const WRITE_KEY = 1n;
const WRITTEN_VALUE = 42n;
const COUNT_BEFORE = 7n;
const COUNT_AFTER = 8n;
const MASTER_INDEX = 0;

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   int public count;'
  + '   mapping(int => int) registrations;'
  + '   event Registered(int indexed key, int value);'
  + '   function register(int readKey, int writeKey, int value) {'
  + '     int current = this.registrations[readKey];'
  + '     require(current == 7);'
  + '     this.count = this.count + 1;'
  + '     this.registrations[readKey] = value;'
  + '     this.registrations[writeKey] = value;'
  + '     emit Registered(readKey, value);'
  + '     require(true);'
  + '   }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'per-call' }).Impl!;
const deployed = deployMaster(artifact, CATEGORY, REAL_VALIDATOR_PROGRAM);
const DEPLOYED: DeployedContract = {
  name: artifact.contractName, category: CATEGORY, address: deployed.address,
  program: deployed.script, lockingBytecode: deployed.lockingBytecode,
};
const EVENT = artifact.events![0]!;
const ENTRY_LOCK = scriptToLockingBytecode(
  buildEntryNftCovenantScript(
    CATEGORY, computeCollectionHash(artifact.stateLayout!.collections![0]!.signature),
  ),
  'p2sh32',
);
const ENTRY_UNLOCK = new Uint8Array([1]);
const ROOT = rootOf(artifact.contractName, 'register', MASTER);

/** The commitment the shipped encoder materializes for the contract's one state record. */
function recordOf(count: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(artifact.stateLayout!, { count }, 0), 'hex'));
}

/** The plan: a kept-in-place state record, an in-place update of one key and an insert of another. */
function buildPlan(): CompositionDraftPlan {
  const readKeyPush = encodeIntegerValue(READ_KEY);
  const writeKeyPush = encodeIntegerValue(WRITE_KEY);
  const readSlot = keyToSlot(readKeyPush);
  const genesis = planMappingWrite({
    keys: [readKeyPush], value: COUNT_BEFORE, inventory: [headSentinelCommitment()],
    encodeValue: (value) => encodeIntegerValue(value),
  });
  const headBefore = genesis.written[0]!.after;
  const nodeBefore = genesis.written.find((node) => !node.existed)!.after;
  const update = planMappingWrite({
    keys: [readKeyPush], value: WRITTEN_VALUE, inventory: [headBefore, nodeBefore],
    encodeValue: (value) => encodeIntegerValue(value),
  });
  const insert = planMappingWrite({
    keys: [writeKeyPush], value: WRITTEN_VALUE, inventory: [headBefore, update.written[0]!.after],
    encodeValue: (value) => encodeIntegerValue(value),
  });

  const blocks = [{
    contract: artifact.contractName, masters: [MASTER],
    validator: { id: VALIDATOR_ID, settles: [] as readonly string[] },
    state: [RECORD_ID, READ_NODE_ID, HEAD_ID],
  }];
  const layout = layoutTransaction(blocks);
  const recordIndex = participant(layout, RECORD_ID).index;
  const headIndex = participant(layout, HEAD_ID).index;
  const readNodeIndex = participant(layout, READ_NODE_ID).index;
  const participantCount = layout.participantCount;
  const eventIndex = participantCount;
  const createdIndex = participantCount + 1;

  const placements = new Map<string, { readonly in?: number; readonly out?: number }>([
    [bytesToHex(new Uint8Array(32)), { in: headIndex, out: headIndex }],
    [bytesToHex(readSlot), { in: readNodeIndex, out: readNodeIndex }],
    [bytesToHex(keyToSlot(writeKeyPush)), { out: createdIndex }],
  ]);
  const mappingEntries = layOutMappingWrites([[update, insert]], {
    placementOf: (slot) => placements.get(bytesToHex(slot)),
  })[0]!;

  const recordBefore = recordOf(COUNT_BEFORE);
  const recordWritten: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordOf(COUNT_AFTER),
  };
  const selector = new Uint8Array(Buffer.from(
    artifact.abi.find((entry) => entry.name === 'register')!.selector!, 'hex'));
  const argumentPushes = [selector, encodeIntegerValue(WRITTEN_VALUE), writeKeyPush, readKeyPush];

  const implMaster: DraftMaster = {
    ...master({
      master: MASTER, contract: artifact.contractName, entry: 'register', program: DEPLOYED.program,
      facts: {
        contract: artifact.contractName, functionName: entryName(artifact.contractName, 'register'),
        kind: FrameKind.ROOT, callerIsUser: true, originEqualsCaller: true,
        makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: DEPLOYED.address, value: 0n },
      enteredBy: USER_ID, origin: USER_ID, calls: [],
      segments: [[recordWritten, ...mappingEntries]],
      argumentPushes, dispatches: true,
    }),
    events: [eventIndex],
  };

  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(CATEGORY_HEX), valueSatoshis: 20_000n,
    token: token(CATEGORY, 'mutable', recordBefore),
  };
  const headSource = {
    lockingBytecode: ENTRY_LOCK, valueSatoshis: 1_500n, token: token(CATEGORY, 'mutable', headBefore),
  };
  const nodeSource = {
    lockingBytecode: ENTRY_LOCK, valueSatoshis: 1_500n, token: token(CATEGORY, 'mutable', nodeBefore),
  };
  const createdCommitment = insert.written.find((node) => !node.existed)!.after;

  return {
    blocks,
    userInputs: userInputs([USER_ID], participantCount),
    masters: [implMaster],
    inputs: {
      [MASTER]: { source: masterInput(DEPLOYED) },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validatorFor(CATEGORY).lock, valueSatoshis: 20_000n,
          token: token(CATEGORY, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(CATEGORY, 'mutable', recordOf(COUNT_AFTER)) },
        unlockingBytecode: stateRecordUnlockingBytecode(CATEGORY_HEX, MASTER_INDEX, 1),
      },
      [HEAD_ID]: {
        source: headSource,
        output: { ...headSource, token: token(CATEGORY, 'mutable', insert.written[0]!.after) },
        unlockingBytecode: ENTRY_UNLOCK,
      },
      [READ_NODE_ID]: {
        source: nodeSource,
        output: { ...nodeSource, token: token(CATEGORY, 'mutable', update.written[0]!.after) },
        unlockingBytecode: ENTRY_UNLOCK,
      },
      [USER_ID]: userInput(),
    },
    trailingOutputs: [
      eventOutput(CATEGORY, EVENT.signature, encodeEventCommitment(EVENT.parameters, [READ_KEY, WRITTEN_VALUE])),
      {
        lockingBytecode: ENTRY_LOCK, valueSatoshis: 1_500n,
        token: token(CATEGORY, 'mutable', createdCommitment),
      },
    ],
    validator: {
      id: VALIDATOR_ID, covers: [],
      settles: [{
        category: CATEGORY, stateInputs: [RECORD_ID, HEAD_ID, READ_NODE_ID], createdOutputs: [createdIndex],
      }],
      redeemScript: validatorFor(CATEGORY).redeem,
    },
  };
}

describe('one entry that keeps its record and writes a mapping batch', () => {
  it('stalls in the writer\'s own close, with the state record declared before its groups', () => {
    const plan = buildPlan();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifact], plan,
    });
    let stalled: Error | undefined;
    try {
      deriveComposition([ROOT], host);
    } catch (error) {
      stalled = error as Error;
    }
    expect(stalled).toBeDefined();
    expect(stalled!.message).toMatch(
      new RegExp(`PER_CALL_DERIVATION_STALLED: master "${MASTER}" of Impl\\.register\\(\\)`),
    );

    const report = reportCompositionRefusal({ draft, artifacts: [artifact], vm: compositionMachine() });
    expect(report.refusals.map((refusal) => refusal.master)).toContain(MASTER);
    expect(report.refusals[0]!.objection).toMatch(/OP_VERIFY/);
  });

  it('refuses the same plan with the state record declared after its groups', () => {
    const plan = buildPlan();
    // The state record is what the frame's state sites read and what the block base derives from, so a plan that
    // declares it behind the mapping groups hands the block a base at the wrong coordinate.
    const writer = plan.masters[0]!;
    const segment = writer.segments[0]!;
    (writer as { segments: readonly (readonly RecordEntry[])[] }).segments = [
      [segment[segment.length - 1]!, ...segment.slice(0, -1)],
    ];
    expect(() => composeAndDerive(plan, [artifact], [ROOT])).toThrow(/PER_CALL_DERIVATION_STALLED/);
  });
});
