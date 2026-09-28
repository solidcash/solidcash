import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
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
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact } from '../../../src/per-call/proxy/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  createComposedDerivationHost,
  deriveComposition,
  layoutTransaction,
  layOutMappingWrites,
  participant,
  planMappingWrite,
  reportCompositionRefusal,
  type CompositionDraftPlan,
  type DraftMaster,
  type MappingNodePlacement,
} from '../../../src/per-call/composer/index.js';
import {
  bytesToSlotValue,
  encodeEntryCommitment,
  headSentinelCommitment,
  keyToSlot,
} from '../../../src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../src/utils.js';
import {
  USER_LOCK,
  composeAndDerive,
  entryName,
  master,
  masterInput,
  rootOf,
  selectorOf,
  token,
  userInput,
  userInputs,
  validatorFor,
  type DeployedContract,
} from './harness.js';

/**
 * A proxied single master: the outer hop of a contract a user reaches through its proxy.
 *
 * A user calls a generated proxy's fallback, which `DELEGATE`s into the implementation's entry. The implementation
 * reads the proxy's record, writes it, and emits; no other contract is involved. The generated proxy mirrors the
 * implementation's declaration, and the delegate frame runs as the proxy, so the write rebuilds the proxy's own
 * record commitment.
 *
 * The entry is the shape for an entry that reads its own record, writes it and emits. The registration-style
 * mapping write — a few distinct keys written in one entry — cannot be laid out on this contract: the entry's frame
 * has to declare the contract's data-NFT record, and the writer's own record groups then start at the frame's
 * declared record base, so a mapping batch read there either mistakes the data-NFT record for its first target
 * group (record declared first) or resolves the data-NFT record at the wrong coordinate (record declared last).
 * Both refusals are pinned below with the frame, the site and the machine's error.
 *
 * Every coordinate comes from `layoutTransaction`/`participant` and every commitment from the shipped encoders.
 * The whole shipped path runs: the compiler, `deployMaster`, `buildProxyArtifact`, the composer, the derivation
 * and the BCH-2026 machine.
 */

const PROXY_LABEL = 'proxied single master proxy';
const IMPL_LABEL = 'proxied single master implementation';
const PROXY_CATEGORY = seededCategory(PROXY_LABEL);
const PROXY_CATEGORY_HEX = bytesToHex(PROXY_CATEGORY);

const RECORD_ID = 'record';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const PROXY_MASTER = 'proxy-1';
const IMPL_MASTER = 'impl-1';
const HEAD_ID = 'head';
const KEY_NODE_ID = 'key-node';

/** The record's scalar before and after the entry runs. */
const COUNT_BEFORE = 7n;
const COUNT_AFTER = 8n;
/** The value written against the event's key. */
const WRITTEN_VALUE = 42n;

/**
 * The two registration keys whose slots order the writes so the insert's predecessor is a spent node.
 *
 * The read key's node already exists, so its write is an update. The second key must sit below the first by slot,
 * so its insert splices in beside the head sentinel rather than beside the node the first write rewrote.
 */
function chooseKeys(): { readonly readKey: bigint; readonly writeKey: bigint } {
  const readKey = 9n;
  let writeKey = 1n;
  while (bytesToSlotValue(keyToSlot(encodeIntegerValue(writeKey)))
    >= bytesToSlotValue(keyToSlot(encodeIntegerValue(readKey)))) {
    writeKey += 1n;
  }
  return { readKey, writeKey };
}
const KEYS = chooseKeys();

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   int public count;'
  + '   mapping(int => int) registrations;'
  + '   event Registered(int indexed key, int value);'
  + '   function touch(int readKey, int value) {'
  + '     int current = this.count;'
  + '     require(current == 7);'
  + '     this.count = current + 1;'
  + '     emit Registered(readKey, value);'
  + '     require(true);'
  + '   }'
  + '   function register(int readKey, int writeKey, int value) {'
  + '     int current = this.registrations[readKey];'
  + '     require(current == 7);'
  + '     this.registrations[readKey] = value;'
  + '     this.registrations[writeKey] = value;'
  + '     emit Registered(readKey, value);'
  + '     require(true);'
  + '   }'
  + '   function currentCount() view returns (int) { return this.count; }'
  + ' }';

const implementationArtifact = compileStringMulti(SOURCE, { composition: 'per-call' }).Impl!;
const proxyArtifact = buildProxyArtifact(implementationArtifact);
const proxyContract = proxyArtifact.contractName;
const implementationContract = implementationArtifact.contractName;

const PROXY_DEPLOYED = deployMaster(proxyArtifact, PROXY_CATEGORY, REAL_VALIDATOR_PROGRAM);
const IMPL_DEPLOYED = deployMaster(implementationArtifact, seededCategory(IMPL_LABEL), REAL_VALIDATOR_PROGRAM);

const PROXY: DeployedContract = {
  name: proxyContract, category: PROXY_CATEGORY, address: PROXY_DEPLOYED.address,
  program: PROXY_DEPLOYED.script, lockingBytecode: PROXY_DEPLOYED.lockingBytecode,
};
const IMPL: DeployedContract = {
  name: implementationContract, category: seededCategory(IMPL_LABEL), address: IMPL_DEPLOYED.address,
  program: IMPL_DEPLOYED.script, lockingBytecode: IMPL_DEPLOYED.lockingBytecode,
};

const EVENT = implementationArtifact.events![0]!;
/** The mapping collection's node lock: the proxy's category derives it, because the delegate frame runs as the proxy. */
const ENTRY_LOCK = scriptToLockingBytecode(
  buildEntryNftCovenantScript(
    PROXY_CATEGORY,
    computeCollectionHash(implementationArtifact.stateLayout!.collections![0]!.signature),
  ),
  'p2sh32',
);
const ENTRY_UNLOCK = encodeDataPush(new Uint8Array([1]));
const ROOT = rootOf(proxyContract, '__fallback', PROXY_MASTER);

/** The commitment the shipped encoder materializes for the proxy's data-NFT record, at one state. */
function recordOf(count: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(proxyArtifact.stateLayout!, { implementation: IMPL.address, count }, 0), 'hex'));
}

/** The push list a caller sends a proxied entry, and the call data the fallback forwards verbatim. */
function callDataOf(contract: string, entry: string, argsInDeclarationOrder: readonly Uint8Array[]): {
  readonly pushes: readonly Uint8Array[];
  readonly callData: Uint8Array;
} {
  const selector = selectorOf({ Impl: implementationArtifact }, contract, entry);
  // The callee reads its parameters last-declared-first, so the argument pushes are the declaration reversed.
  const pushes = [selector, ...[...argsInDeclarationOrder].reverse()];
  const callData = new Uint8Array([
    ...encodeDataPush(selector),
    ...pushes.slice(1).flatMap((push) => [...encodeDataPush(push)]),
  ]);
  return { pushes, callData };
}

/** The block layout both entries share: the proxy hosts the validator and the record; the implementation follows. */
function transactionBlocks(withHead: boolean): CompositionDraftPlan['blocks'] {
  return [
    {
      contract: proxyContract, masters: [PROXY_MASTER],
      validator: { id: VALIDATOR_ID, settles: [] as readonly string[] }, state: [RECORD_ID],
    },
    {
      contract: implementationContract, masters: [IMPL_MASTER],
      state: withHead ? [HEAD_ID, KEY_NODE_ID] : [] as readonly string[],
    },
  ];
}

/** The two masters and the record input a proxied entry shares; each entry supplies its own segments and event. */
interface ProxiedEntry {
  readonly plan: CompositionDraftPlan;
  readonly recordIndex: number;
  readonly eventIndex: number;
}

/** Lays out a proxied entry that reads and writes the record's scalar and emits, with no callee of its own. */
function buildScalarEntry(): ProxiedEntry & {
  readonly recordBefore: Uint8Array;
  readonly recordAfter: Uint8Array;
  readonly eventPayload: Uint8Array;
} {
  const readKey = encodeIntegerValue(KEYS.readKey);
  const { pushes, callData } = callDataOf('Impl', 'touch', [readKey, encodeIntegerValue(WRITTEN_VALUE)]);

  const blocks = transactionBlocks(false);
  const layout = layoutTransaction(blocks);
  const recordIndex = participant(layout, RECORD_ID).index;
  const proxyIndex = participant(layout, PROXY_MASTER).index;
  const participantCount = layout.participantCount;
  const eventIndex = participantCount;

  const recordBefore = recordOf(COUNT_BEFORE);
  const recordAfter = recordOf(COUNT_AFTER);
  const recordRead: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordBefore,
  };
  const recordWritten: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordAfter,
  };
  const recordResumed: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordAfter, viewOut: recordAfter,
  };

  const proxyMaster: DraftMaster = master({
    master: PROXY_MASTER, contract: proxyContract, entry: '__fallback', program: PROXY.program,
    facts: {
      contract: proxyContract, functionName: '__fallback', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: PROXY.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.DELEGATE, callee: IMPL_MASTER, target: IMPL.address, value: 0n,
      argumentPushes: [...pushes],
    }],
    segments: [[recordRead], [recordResumed]],
    argumentPushes: [callData],
    dispatches: true,
  });
  const implMaster: DraftMaster = {
    ...master({
      master: IMPL_MASTER, contract: implementationContract, entry: 'touch', program: IMPL.program,
      facts: {
        contract: implementationContract, functionName: 'touch', kind: FrameKind.DELEGATE, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: PROXY.address, value: 0n },
      enteredBy: PROXY_MASTER, origin: USER_ID,
      calls: [],
      segments: [[recordWritten]],
      argumentPushes: [...pushes],
    }),
    events: [eventIndex],
  };

  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(PROXY_CATEGORY_HEX), valueSatoshis: 20_000n,
    token: token(PROXY_CATEGORY, 'mutable', recordBefore),
  };
  const eventPayload = encodeEventCommitment(EVENT.parameters, [KEYS.readKey, WRITTEN_VALUE]);

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], participantCount),
    masters: [proxyMaster, implMaster],
    inputs: {
      [PROXY_MASTER]: { source: masterInput(PROXY) },
      [IMPL_MASTER]: { source: masterInput(IMPL) },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validatorFor(PROXY_CATEGORY).lock, valueSatoshis: 20_000n,
          token: token(PROXY_CATEGORY, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(PROXY_CATEGORY, 'mutable', recordAfter) },
        // A master of the record's own category rewrites it, so the covenant's write path authorizes the spend.
        unlockingBytecode: stateRecordUnlockingBytecode(PROXY_CATEGORY_HEX, proxyIndex, 1),
      },
      [USER_ID]: userInput(),
    },
    trailingOutputs: [eventOutput(PROXY_CATEGORY, EVENT.signature, eventPayload)],
    validator: {
      id: VALIDATOR_ID, covers: [implementationContract],
      settles: [{ category: PROXY_CATEGORY, stateInputs: [RECORD_ID] }],
      redeemScript: validatorFor(PROXY_CATEGORY).redeem,
    },
  };
  return { plan, recordIndex, eventIndex, recordBefore, recordAfter, eventPayload };
}

/** Lays out the registration entry: a read of its own mapping record and two writes, the second an insert. */
function buildRegistrationEntry(options: { readonly recordLast?: boolean } = {}): ProxiedEntry & {
  readonly mappingEntries: readonly RecordEntry[];
  readonly createdIndex: number;
  readonly createdCommitment: Uint8Array;
} {
  const readKeyPush = encodeIntegerValue(KEYS.readKey);
  const writeKeyPush = encodeIntegerValue(KEYS.writeKey);
  const { pushes: callPushes, callData } = callDataOf('Impl', 'register',
    [readKeyPush, writeKeyPush, encodeIntegerValue(WRITTEN_VALUE)]);

  const headBefore = headSentinelCommitment();
  const readSlot = keyToSlot(readKeyPush);
  const nodeBefore = encodeEntryCommitment(readSlot, new Uint8Array(32), encodeIntegerValue(COUNT_BEFORE));
  const update = planMappingWrite({
    keys: [readKeyPush], value: WRITTEN_VALUE, inventory: [headBefore, nodeBefore],
    encodeValue: (value) => encodeIntegerValue(value),
  });
  const insert = planMappingWrite({
    keys: [writeKeyPush], value: WRITTEN_VALUE, inventory: [headBefore, update.written[0]!.after],
    encodeValue: (value) => encodeIntegerValue(value),
  });

  const blocks = transactionBlocks(true);
  const layout = layoutTransaction(blocks);
  const recordIndex = participant(layout, RECORD_ID).index;
  const headIndex = participant(layout, HEAD_ID).index;
  const keyNodeIndex = participant(layout, KEY_NODE_ID).index;
  const proxyIndex = participant(layout, PROXY_MASTER).index;
  const participantCount = layout.participantCount;
  const eventIndex = participantCount;
  const createdIndex = participantCount + 1;

  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(new Uint8Array(32)), { in: headIndex, out: headIndex }],
    [bytesToHex(readSlot), { in: keyNodeIndex, out: keyNodeIndex }],
    [bytesToHex(keyToSlot(writeKeyPush)), { out: createdIndex }],
  ]);
  const mappingEntries = layOutMappingWrites([[update, insert]], {
    placementOf: (slot) => placements.get(bytesToHex(slot)),
  })[0]!;

  const recordBefore = recordOf(COUNT_BEFORE);
  const recordEntry: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordBefore,
  };
  const eventPayload = encodeEventCommitment(EVENT.parameters, [KEYS.readKey, WRITTEN_VALUE]);
  const createdCommitment = insert.written.find((node) => !node.existed)!.after;
  // The frame has to declare the contract's data-NFT record; the writer's groups follow it, or precede it in the
  // control that shows the alternative order resolves the record at the wrong coordinate.
  const writerSegment: readonly RecordEntry[] = options.recordLast === true
    ? [...mappingEntries, recordEntry]
    : [recordEntry, ...mappingEntries];

  const proxyMaster: DraftMaster = master({
    master: PROXY_MASTER, contract: proxyContract, entry: '__fallback', program: PROXY.program,
    facts: {
      contract: proxyContract, functionName: '__fallback', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: PROXY.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.DELEGATE, callee: IMPL_MASTER, target: IMPL.address, value: 0n, argumentPushes: callPushes,
    }],
    segments: [
      [{ in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordBefore }],
      [{ in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordBefore }],
    ],
    argumentPushes: [callData],
    dispatches: true,
  });
  const implMaster: DraftMaster = {
    ...master({
      master: IMPL_MASTER, contract: implementationContract, entry: 'register', program: IMPL.program,
      facts: {
        contract: implementationContract, functionName: 'register', kind: FrameKind.DELEGATE, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: PROXY.address, value: 0n },
      enteredBy: PROXY_MASTER, origin: USER_ID,
      calls: [],
      segments: [[...writerSegment]],
      argumentPushes: callPushes,
    }),
    events: [eventIndex],
  };

  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(PROXY_CATEGORY_HEX), valueSatoshis: 20_000n,
    token: token(PROXY_CATEGORY, 'mutable', recordBefore),
  };
  const headSource = {
    lockingBytecode: ENTRY_LOCK, valueSatoshis: 1_500n, token: token(PROXY_CATEGORY, 'mutable', headBefore),
  };
  const keyNodeSource = {
    lockingBytecode: ENTRY_LOCK, valueSatoshis: 1_500n, token: token(PROXY_CATEGORY, 'mutable', nodeBefore),
  };

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], participantCount),
    masters: [proxyMaster, implMaster],
    inputs: {
      [PROXY_MASTER]: { source: masterInput(PROXY) },
      [IMPL_MASTER]: { source: masterInput(IMPL) },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validatorFor(PROXY_CATEGORY).lock, valueSatoshis: 20_000n,
          token: token(PROXY_CATEGORY, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: recordSource,
        unlockingBytecode: stateRecordUnlockingBytecode(PROXY_CATEGORY_HEX, proxyIndex, 0),
      },
      [HEAD_ID]: {
        source: headSource,
        output: { ...headSource, token: token(PROXY_CATEGORY, 'mutable', insert.written[0]!.after) },
        unlockingBytecode: ENTRY_UNLOCK,
      },
      [KEY_NODE_ID]: {
        source: keyNodeSource,
        output: { ...keyNodeSource, token: token(PROXY_CATEGORY, 'mutable', update.written[0]!.after) },
        unlockingBytecode: ENTRY_UNLOCK,
      },
      [USER_ID]: userInput(),
    },
    trailingOutputs: [
      eventOutput(PROXY_CATEGORY, EVENT.signature, eventPayload),
      {
        lockingBytecode: ENTRY_LOCK, valueSatoshis: 1_500n,
        token: token(PROXY_CATEGORY, 'mutable', createdCommitment),
      },
    ],
    validator: {
      id: VALIDATOR_ID, covers: [implementationContract],
      settles: [{
        category: PROXY_CATEGORY,
        stateInputs: [RECORD_ID, HEAD_ID, KEY_NODE_ID],
        createdOutputs: [createdIndex],
      }],
      redeemScript: validatorFor(PROXY_CATEGORY).redeem,
    },
  };
  return { plan, recordIndex, eventIndex, mappingEntries, createdIndex, createdCommitment };
}

describe('a proxied single master: the outer hop', () => {
  it('settles a read of its own record, a scalar write and an event: every contract input is accepted', () => {
    const built = buildScalarEntry();
    const outcome = composeAndDerive(built.plan, [proxyArtifact, implementationArtifact], [ROOT]);
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    // The accepted inputs are the proxy master, the implementation master, the validator and the record.
    expect(outcome.verdicts.filter((verdict) => verdict.accepted)
      .map((verdict) => verdict.participant).sort())
      .toStrictEqual([PROXY_MASTER, IMPL_MASTER, VALIDATOR_ID, RECORD_ID].sort());
  });

  it('derives the implementation frame before the proxy fallback', () => {
    const outcome = composeAndDerive(buildScalarEntry().plan, [proxyArtifact, implementationArtifact], [ROOT]);
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName(implementationContract, 'touch'), entryName(proxyContract, '__fallback'),
    ]);
  });

  it('the record\'s written state equals what the entry computed, read back through the shipped encoder', () => {
    const built = buildScalarEntry();
    const outcome = composeAndDerive(built.plan, [proxyArtifact, implementationArtifact], [ROOT]);
    const program = outcome.draft.programFor(PROXY_MASTER);
    const recordIndex = participant(outcome.draft.layout, RECORD_ID).index;
    const spent = new Uint8Array(program.sourceOutputs[recordIndex]!.token!.nft!.commitment);
    const written = new Uint8Array(program.transaction.outputs[recordIndex]!.token!.nft!.commitment);
    expect(bytesToHex(spent)).toBe(bytesToHex(built.recordBefore));
    expect(bytesToHex(written)).toBe(bytesToHex(built.recordAfter));
    // The written commitment is exactly the shipped encoder's state for the value the entry computed.
    expect(bytesToHex(written)).toBe(bytesToHex(recordOf(COUNT_AFTER)));
    expect(bytesToHex(written)).not.toBe(bytesToHex(recordOf(COUNT_BEFORE)));
  });

  it('emits the event commitment the shipped encoder materializes', () => {
    const built = buildScalarEntry();
    const outcome = composeAndDerive(built.plan, [proxyArtifact, implementationArtifact], [ROOT]);
    const program = outcome.draft.programFor(PROXY_MASTER);
    expect(program.transaction.outputs[built.eventIndex]!.token!.nft!.commitment)
      .toStrictEqual(built.eventPayload);
  });

  it('refuses a record output no frame computed, on the same composition', () => {
    const built = buildScalarEntry();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [proxyArtifact, implementationArtifact], plan: built.plan,
    });
    deriveComposition([ROOT], host);
    const recordIndex = participant(draft.layout, RECORD_ID).index;
    const program = draft.programFor(PROXY_MASTER);
    const wrong = recordOf(COUNT_BEFORE + 100n);
    const transaction = {
      ...program.transaction,
      outputs: program.transaction.outputs.map((output, index) => (index === recordIndex
        ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: wrong } } }
        : output)),
    };
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: participant(draft.layout, VALIDATOR_ID).index,
      sourceOutputs: program.sourceOutputs, transaction,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });
});

describe('the registration mapping write on the same proxy hop', () => {
  it('cannot be laid out: the frame must declare its data-NFT record, and the batch then misfinds its groups', () => {
    const built = buildRegistrationEntry();
    // The plan itself is built from the shipped encoders: the read node is rewritten in place, the head is
    // relinked, and the second key's node is created — three records across the two writer groups.
    expect(built.mappingEntries).toHaveLength(3);
    expect(built.createdCommitment).toStrictEqual(
      encodeEntryCommitment(keyToSlot(encodeIntegerValue(KEYS.writeKey)), new Uint8Array(32),
        encodeIntegerValue(WRITTEN_VALUE)));

    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [proxyArtifact, implementationArtifact], plan: built.plan,
    });
    let stalled: Error | undefined;
    try {
      deriveComposition([ROOT], host);
    } catch (error) {
      stalled = error as Error;
    }
    expect(stalled).toBeDefined();
    expect(stalled!.message).toMatch(/PER_CALL_DERIVATION_STALLED: master "impl-1" of Impl\.register\(\)/);
    expect(stalled!.message).toMatch(/site 0 \(close of segment 0\)/);

    const report = reportCompositionRefusal({
      draft, artifacts: [proxyArtifact, implementationArtifact], vm: compositionMachine(),
    });
    const impl = report.refusals.find((refusal) => refusal.master === IMPL_MASTER);
    expect(impl).toBeDefined();
    // The frame's body refused: the writer's group walk reads the declared data-NFT record and splits it as a node.
    expect(impl!.objection).toMatch(/OP_SPLIT/);
    expect(impl!.objection).toMatch(/requested split index: 32/);
  });

  it('still cannot be laid out with the record declared last: the data-NFT coordinate then resolves elsewhere', () => {
    const built = buildRegistrationEntry({ recordLast: true });
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [proxyArtifact, implementationArtifact], plan: built.plan,
    });
    let stalled: Error | undefined;
    try {
      deriveComposition([ROOT], host);
    } catch (error) {
      stalled = error as Error;
    }
    expect(stalled).toBeDefined();
    expect(stalled!.message).toMatch(/PER_CALL_DERIVATION_STALLED: master "impl-1" of Impl\.register\(\)/);

    const report = reportCompositionRefusal({
      draft, artifacts: [proxyArtifact, implementationArtifact], vm: compositionMachine(),
    });
    const impl = report.refusals.find((refusal) => refusal.master === IMPL_MASTER);
    expect(impl).toBeDefined();
    // With the record behind the groups the batch reads, the record's own coordinate is the first group's index.
    expect(impl!.objection).toMatch(/OP_VERIFY/);
  });
});

describe('the off-chain read path on the proxied contract', () => {
  it('cannot be pointed at it: the deployment layer classifies no mapping records', async () => {
    // The implementation publishes a view entry, but the contract keeps a registration mapping, and the read path
    // reads only a contract's data-NFT records. Pointing it at the deployed proxy category is refused at planning.
    const provider = new MockNetworkProvider();
    await expect(readPerCallEntry({
      provider, artifact: implementationArtifact, categoryId: PROXY_CATEGORY_HEX, functionName: 'currentCount',
      vm: compositionMachine(),
    })).rejects.toThrow(/keeps a mapping, whose entry records the deployment layer does not classify/);
  });
});
