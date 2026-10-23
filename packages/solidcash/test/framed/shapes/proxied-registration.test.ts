import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from './harness.js';
import { encodeDataPush, encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  FrameKind,
  buildEntryNftCovenantScript,
  buildPushdataCommitment,
  bytesToHex,
  computeCollectionHash,
  encodeEventCommitment,
  encodeIntegerValue,
  scriptToBytecode,
  type RecordEntry,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import { seededCategory, REAL_VALIDATOR_PROGRAM } from '../../../../solidc/test/framed/master/validator-input.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  deployMaster,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact } from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  createComposedDerivationHost,
  deriveComposition,
  layOutMappingWrites,
  participant,
  planMappingWrite,
  reportCompositionRefusal,
  type CompositionDraftPlan,
  type DraftMaster,
  type MappingNodePlacement,
} from '../../../src/framed/composer/index.js';
import {
  bytesToSlotValue,
  encodeEntryCommitment,
  headSentinelCommitment,
  keyToSlot,
} from '../../../src/stateful/SortedList.js';
import { createUnlockingBytecode } from '../../../src/utils.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
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
 * mapping write — a few distinct keys written in one entry — is laid out on this contract the same way: the entry's
 * frame declares the contract's data-NFT record first, and the writer's own record groups follow it, so a mapping
 * batch read starts at the target groups rather than mistaking the data-NFT record for its first one. The record
 * declared last is still refused, because the group walk then consumes a mapping record as that record's group.
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

const SOURCE = 'pragma solidcash ^0.14.0;'
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
  + '     this.count = this.count + 1;'
  + '     this.registrations[readKey] = value;'
  + '     this.registrations[writeKey] = value;'
  + '     emit Registered(readKey, value);'
  + '     require(true);'
  + '   }'
  + '   function currentCount() view returns (int) { return this.count; }'
  + ' }';

const implementationArtifact = compileStringMulti(SOURCE, { composition: 'framed' }).Impl!;
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
const ENTRY_REDEEM = scriptToBytecode(
  buildEntryNftCovenantScript(
    PROXY_CATEGORY,
    computeCollectionHash(implementationArtifact.stateLayout!.collections![0]!.signature),
  ),
);
const ENTRY_LOCK = encodeLockingBytecodeP2sh32(hash256(ENTRY_REDEEM));
/** The entry covenant's `<masterInputIndex> <flag>` unlocking, authorized by the proxy's own master. */
const entryUnlock = (masterInputIndex: number): Uint8Array => createUnlockingBytecode('p2sh32', ENTRY_REDEEM, [
  encodeFunctionArgument(1n, 'bigint') as Uint8Array,
  encodeFunctionArgument(BigInt(masterInputIndex), 'bigint') as Uint8Array,
]);
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
  const { pushes } = callDataOf('Impl', 'touch', [readKey, encodeIntegerValue(WRITTEN_VALUE)]);

  const blocks = transactionBlocks(false);
  const layout = layoutWithFacets(blocks);
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
    // The fallback's one parameter is the frame's own call-data band: the selector push and the argument pushes.
    argumentPushes: [...pushes],
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
  readonly headIndex: number;
  readonly keyNodeIndex: number;
  readonly createdIndex: number;
  readonly headAfter: Uint8Array;
  readonly keyNodeAfter: Uint8Array;
  readonly createdCommitment: Uint8Array;
} {
  const readKeyPush = encodeIntegerValue(KEYS.readKey);
  const writeKeyPush = encodeIntegerValue(KEYS.writeKey);
  const { pushes: callPushes } = callDataOf('Impl', 'register',
    [readKeyPush, writeKeyPush, encodeIntegerValue(WRITTEN_VALUE)]);

  // The read node is already in the map, so the head sentinel links to it rather than carrying the empty map's
  // +infinity successor. Building it from a shipped genesis insert keeps the inventory a real sorted list.
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

  // The mapping nodes are the row's entry UTXOs, so they sit in the row's own block: the read node first (the
  // batch's first target), then the head the insert relinks. The frame's data-NFT record leads the block, and the
  // implementation master follows the row's whole block.
  const blocks: CompositionDraftPlan['blocks'] = [
    {
      contract: proxyContract, masters: [PROXY_MASTER],
      validator: { id: VALIDATOR_ID, settles: [] as readonly string[] },
      state: [RECORD_ID, KEY_NODE_ID, HEAD_ID],
    },
    { contract: implementationContract, masters: [IMPL_MASTER], state: [] as readonly string[] },
  ];
  const layout = layoutWithFacets(blocks);
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
  const recordAfter = recordOf(COUNT_AFTER);
  const recordWritten: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordAfter,
  };
  const eventPayload = encodeEventCommitment(EVENT.parameters, [KEYS.readKey, WRITTEN_VALUE]);
  const createdCommitment = insert.written.find((node) => !node.existed)!.after;
  // The frame has to declare the contract's data-NFT record; the writer's groups follow it, or precede it in the
  // control that shows the alternative order resolves the record at the wrong coordinate.
  const writerSegment: readonly RecordEntry[] = options.recordLast === true
    ? [...mappingEntries, recordWritten]
    : [recordWritten, ...mappingEntries];

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
      [{ in: recordIndex, out: recordIndex, viewIn: recordAfter, viewOut: recordAfter }],
    ],
    // The fallback's one parameter is the frame's own call-data band: the selector push and the argument pushes.
    argumentPushes: [...callPushes],
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
        output: { ...recordSource, token: token(PROXY_CATEGORY, 'mutable', recordAfter) },
        unlockingBytecode: stateRecordUnlockingBytecode(PROXY_CATEGORY_HEX, proxyIndex, 1),
      },
      [HEAD_ID]: {
        source: headSource,
        output: { ...headSource, token: token(PROXY_CATEGORY, 'mutable', insert.written[0]!.after) },
        unlockingBytecode: entryUnlock(proxyIndex),
      },
      [KEY_NODE_ID]: {
        source: keyNodeSource,
        output: { ...keyNodeSource, token: token(PROXY_CATEGORY, 'mutable', update.written[0]!.after) },
        unlockingBytecode: entryUnlock(proxyIndex),
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
  return {
    plan, recordIndex, eventIndex, mappingEntries, headIndex, keyNodeIndex, createdIndex,
    headAfter: insert.written[0]!.after, keyNodeAfter: update.written[0]!.after, createdCommitment,
  };
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
      .toStrictEqual([PROXY_MASTER, IMPL_MASTER, VALIDATOR_ID, `${VALIDATOR_ID}/1`, RECORD_ID].sort());
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
  it('settles: every contract input is accepted and each write matches the shipped planner', () => {
    const built = buildRegistrationEntry();
    // The plan is built from the shipped encoders: the read node is rewritten in place, the head is relinked, and
    // the second key's node is created — three records across the two writer groups.
    expect(built.mappingEntries).toHaveLength(3);

    const outcome = composeAndDerive(built.plan, [proxyArtifact, implementationArtifact], [ROOT]);
    // The delegate frame's records resolve from the input its caller's block put them at, so the batch read finds
    // the group it wrote and the close reaches its own declared views.
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    expect(outcome.verdicts.filter((verdict) => verdict.accepted)
      .map((verdict) => verdict.participant).sort())
      .toStrictEqual([PROXY_MASTER, IMPL_MASTER, VALIDATOR_ID, `${VALIDATOR_ID}/1`, RECORD_ID, HEAD_ID, KEY_NODE_ID].sort());

    const program = outcome.draft.programFor(PROXY_MASTER);
    const commitmentAt = (index: number): Uint8Array =>
      new Uint8Array(program.transaction.outputs[index]!.token!.nft!.commitment);
    // The created node is the shipped encoder's value for the second key's write, and the rewritten head and read
    // node carry the commitments the shipped planner computed.
    expect(bytesToHex(commitmentAt(built.createdIndex))).toBe(bytesToHex(built.createdCommitment));
    expect(bytesToHex(commitmentAt(built.createdIndex))).toBe(bytesToHex(encodeEntryCommitment(
      keyToSlot(encodeIntegerValue(KEYS.writeKey)), keyToSlot(encodeIntegerValue(KEYS.readKey)),
      encodeIntegerValue(WRITTEN_VALUE))));
    expect(bytesToHex(commitmentAt(built.headIndex))).toBe(bytesToHex(built.headAfter));
    expect(bytesToHex(commitmentAt(built.keyNodeIndex))).toBe(bytesToHex(built.keyNodeAfter));
    expect(bytesToHex(built.headAfter)).not.toBe(bytesToHex(headSentinelCommitment()));
  });

  it('refuses a created node no frame computed, on the same composition', () => {
    const built = buildRegistrationEntry();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [proxyArtifact, implementationArtifact], plan: built.plan,
    });
    deriveComposition([ROOT], host);
    const program = draft.programFor(PROXY_MASTER);
    const wrong = encodeEntryCommitment(keyToSlot(encodeIntegerValue(KEYS.writeKey)),
      keyToSlot(encodeIntegerValue(KEYS.readKey)), encodeIntegerValue(WRITTEN_VALUE + 1n));
    const transaction = {
      ...program.transaction,
      outputs: program.transaction.outputs.map((output, index) => (index === built.createdIndex
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

  it('still refuses the record declared last: the batch then reads it as a target group', () => {
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
    // The driver's own message: the writer's derivation never advances because the state record sits behind the
    // groups it reads, so the group walk consumes a mapping record as the state record's group.
    expect(stalled).toBeDefined();
    expect(stalled!.message).toMatch(/FRAMED_DERIVATION_STALLED: master "impl-1" of Impl\.register\(\)/);

    const report = reportCompositionRefusal({
      draft, artifacts: [proxyArtifact, implementationArtifact], vm: compositionMachine(),
    });
    expect(report.accepted).toBe(false);
    const impl = report.refusals.find((refusal) => refusal.master === IMPL_MASTER);
    expect(impl).toBeDefined();
    expect(impl!.objection).toMatch(/OP_VERIFY|OP_SPLIT/);
  });
});

describe('the off-chain read path on the proxied contract', () => {
  it('is no longer refused by the mapping the contract keeps: it stops on the empty deployment instead', async () => {
    // The implementation keeps a `registrations` mapping. The read path classifies a mapping's nodes like any other
    // record, so the plan is built and the read is refused on the empty deployment's missing master, not on the
    // mapping the contract keeps.
    const provider = new MockNetworkProvider();
    await expect(readFramedEntry({
      provider, artifact: implementationArtifact, categoryId: PROXY_CATEGORY_HEX, functionName: 'currentCount',
      vm: compositionMachine(),
    })).rejects.toThrow(/holds 0 master\(s\), and the read runs 1 frame\(s\) over it/);
  });
});
