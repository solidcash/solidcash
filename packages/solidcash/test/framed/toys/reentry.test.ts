import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import {
  FrameKind,
  buildEntryNftCovenantScript,
  bytesToHex,
  computeCollectionHash,
  decodeIntegerValue,
  decodeWitnessBlock,
  encodeEventCommitment,
  encodeIntegerValue,
  encodeResultList,
  scriptToBytecode,
  splitFirstPush,
  type PublishedEntryStopSites,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import { createUnlockingBytecode, scriptToLockingBytecode } from '../../../src/utils.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  USER_LOCK, compileAndDeploy, entryName, hexOf, master, masterInput, rootOf, seededAddress, selectorOf, token,
  userInput, validatorFor,
} from '../shapes/harness.js';
import {
  createComposedDerivationHost, deriveDepthFirst, layOutMappingWrites,
  participant, planMappingWrite, type CompositionDraft, type CompositionDraftPlan,
  type DraftMaster, type MappingNodePlacement,
} from '../../../src/framed/composer/index.js';
import { headSentinelCommitment } from '../../../src/stateful/SortedList.js';
import type { ArtifactMap } from '../shapes/harness.js';

/**
 * Re-entry: `Vault.release` writes its record, calls `Claimer.claim`, and emits what that call returns.
 *
 * `claim` reads the record back through the read-only `Vault.get`, requires it to be set, then re-enters `Vault`
 * through `markClaimed` and through `pay` twice; each `pay` reaches `Token.transfer`. One transaction therefore
 * re-enters one contract and reads back a record a call higher up wrote.
 *
 * A master that makes external calls is served a verified-mapping write: the derivation reads the segment the
 * write's records are declared in, and a call closes the segment the code before it runs in, so a write that
 * precedes every call lands in the segment the derivation reads. The tests below settle that shape through the
 * shipped path - compile, deploy, composer, derivation, machine - for a record the transaction already holds and
 * for a write that creates a fresh record, where the creating segment declares the list's head sentinel rewritten
 * in place and the created node as a trailing output and the frame names the created node by its position in that
 * declaration.
 *
 * A frame's `retval` is one length-prefixed byte string, and a tuple's canonical encoding is the concatenation
 * of its values' encodings, so an entry that returns several values settles against `retval` the same way one
 * scalar does: `claim` returns the two amounts `release` reads back, and the caller decodes the record's `result`.
 * The last test below settles that returned pair through the shipped path and refuses the control.
 */

const TOKEN_LABEL = 'reentry token';
const VAULT_LABEL = 'reentry vault';
const CLAIMER_LABEL = 'reentry claimer';
const VAULT = hexOf(seededAddress(VAULT_LABEL));
const CLAIMER = hexOf(seededAddress(CLAIMER_LABEL));
const TOKEN = hexOf(seededAddress(TOKEN_LABEL));
const USER = hexOf(new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]));
const LABELS = { Token: TOKEN_LABEL, Vault: VAULT_LABEL, Claimer: CLAIMER_LABEL };
const ID = 1n;
const ZERO_SLOT = new Uint8Array(32);

/** The write-then-call half of the shape: `claim` re-enters `markClaimed` and returns a pair `release` reads back. */
const PAIRED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IClaimer { function claim(int id) returns (int, int); }'
  + ' interface IVault { function markClaimed(int id); }'
  + ' contract Claimer {'
  + `   function claim(int id) returns (int, int) { IVault(0x${VAULT}).markClaimed(id); return (1, 2); }`
  + ' }'
  + ' contract Vault {'
  + '   mapping(int => int) recs;'
  + '   function release(int id) {'
  + '     this.recs[id] = 1;'
  + `     int first, int second = IClaimer(0x${CLAIMER}).claim(id);`
  + '     require(first == 1); require(second == 2); require(true);'
  + '   }'
  + '   function markClaimed(int id) { this.recs[id] = 2; require(true); }'
  + ' }';

/** The entries a contract publishes, in the order the artifact lists them. */
function entriesOf(artifacts: ArtifactMap, contract: string): readonly PublishedEntryStopSites[] {
  return artifacts[contract]!.composition!.stopSites?.entries ?? [];
}

/** One master's witness block, read back from the unlocking bytecode the composer built, through the shipped codec. */
function blockOf(unlocking: Uint8Array): ReturnType<typeof decodeWitnessBlock> {
  return decodeWitnessBlock(splitFirstPush(unlocking).payload);
}

/** The machine's verdict on one participant's own input of the assembled transaction. */
function verdictAt(draft: ReturnType<typeof createComposedDerivationHost>['draft'], id: string): string {
  return verdictAtIndex(draft, participant(draft.layout, id).index);
}

/** The machine's verdict on the input at an index, for the UTXOs the layout places that are not participants. */
function verdictAtIndex(draft: ReturnType<typeof createComposedDerivationHost>['draft'], index: number): string {
  const program = draft.programFor('release-1');
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? 'accepted' : `refused: ${String(state.error)}`;
}

/**
 * The write-then-call composition, driven through the shipped path.
 *
 * `Vault` runs on two masters, so its validator settles the mapping. `release` writes the record and then calls
 * `Claimer.claim`, which calls back into `Vault.markClaimed`, whose own rewrite closes the record. With `insert`
 * the transaction starts from an empty list, so `release` creates the record and the segment declares the head
 * sentinel rewritten in place and the created node as a trailing output; otherwise the record already exists at
 * the index right after the validator and both writes update it in place. With `control` the created node's output
 * is left at the value the creating frame wrote, which is not the commitment the last declaration ends at.
 *
 * `claim` returns a pair: its frame records `recordedPair` in its `retval`, which the honest run takes from the
 * shipped result encoding and the control changes, so `release` reads the record's `result` back and requires each
 * value.
 */
function driveSettled(
  insert = false,
  control = false,
  recordedPair: readonly [bigint, bigint] = [1n, 2n],
): {
    readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
    readonly completed: readonly string[];
    readonly error?: string;
    readonly verdicts: readonly string[];
    readonly written: Uint8Array;
    readonly nodeIndex: number;
    readonly createdIndex: number;
    readonly headIndex: number;
  } {
  const { artifacts, contracts } = compileAndDeploy(PAIRED_SOURCE, { Vault: VAULT_LABEL, Claimer: CLAIMER_LABEL });
  const vault = contracts.Vault!;
  const claimer = contracts.Claimer!;
  const validator = validatorFor(vault.category);
  const idPush = encodeIntegerValue(ID);
  const slot = keyToSlotMulti([idPush]);
  const encodeValue = (value: bigint): Uint8Array => encodeIntegerValue(value);

  // The record the transaction starts from, and what each of the two writes leaves. A write that creates the
  // record starts from an empty list, so the segment declares the head sentinel rewritten in place and the created
  // node as a trailing output.
  const before = encodeEntryCommitment(slot, ZERO_SLOT, encodeIntegerValue(0n));
  const head = headSentinelCommitment();
  const release = insert
    ? planMappingWrite({ keys: [idPush], value: 1n, inventory: [head], encodeValue })
    : planMappingWrite({ keys: [idPush], value: 1n, inventory: [before], encodeValue });
  const releaseRecord = insert ? release.written[1]! : release.written[0]!;
  const mark = planMappingWrite({ keys: [idPush], value: 2n, inventory: [head, releaseRecord.after], encodeValue });

  // Vault's block: two masters, its validator, then the record it settles. Claimer's master follows in its own
  // block, and the entering user after every participant. A created record is a funder's recreation, so it and the
  // head sentinel follow every participant instead.
  const stateCount = insert ? 0 : 1;
  // Two Vault masters, its validator, the facet it binds, its state record, then the Claimer's master.
  const participantCount = 2 + 1 + 1 + stateCount + 1;
  const nodeIndex = 4;
  const createdIndex = insert ? participantCount : nodeIndex;
  const headIndex = createdIndex + 1;
  const userIndex = participantCount + (insert ? 2 : 0);
  const placements = new Map<string, MappingNodePlacement>(insert
    ? [[Buffer.from(ZERO_SLOT).toString('hex'), { in: headIndex, out: headIndex }],
      [Buffer.from(slot).toString('hex'), { out: createdIndex }]]
    : [[Buffer.from(slot).toString('hex'), { in: nodeIndex, out: nodeIndex }]]);
  const segments = layOutMappingWrites([[release], [mark]], {
    placementOf: (candidate) => placements.get(Buffer.from(candidate).toString('hex')),
  });

  const entryLock = scriptToLockingBytecode(
    buildEntryNftCovenantScript(
      vault.category, computeCollectionHash(artifacts.Vault!.stateLayout!.collections![0]!.signature),
    ),
    'p2sh32',
  );
  const releaseSelector = selectorOf(artifacts, 'Vault', 'release');
  const markSelector = selectorOf(artifacts, 'Vault', 'markClaimed');
  const claimSelector = selectorOf(artifacts, 'Claimer', 'claim');

  const releaseMaster: DraftMaster = master({
    master: 'release-1', contract: 'Vault', entry: 'release', program: vault.program,
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: vault.address, value: 0n },
    facts: {
      contract: 'Vault', functionName: 'release', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 2,
    },
    enteredBy: 'user', origin: 'user',
    argumentPushes: [releaseSelector, idPush], dispatches: true,
    calls: [{ kind: FrameKind.CALL, callee: 'claim-1', target: claimer.address, value: 0n, argumentPushes: [claimSelector, idPush] }],
    segments: [segments[0]!, []],
  });
  const markMaster: DraftMaster = master({
    master: 'markClaimed-1', contract: 'Vault', entry: 'markClaimed', program: vault.program,
    frame: { kind: FrameKind.CALL, sender: claimer.address, self: vault.address, value: 0n },
    facts: {
      contract: 'Vault', functionName: 'markClaimed', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
    },
    enteredBy: 'claim-1', origin: 'user', argumentPushes: [markSelector, idPush],
    segments: [segments[1]!],
  });
  const claimBase: DraftMaster = master({
    master: 'claim-1', contract: 'Claimer', entry: 'claim', program: claimer.program,
    frame: { kind: FrameKind.CALL, sender: vault.address, self: claimer.address, value: 0n },
    facts: {
      contract: 'Claimer', functionName: 'claim', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
    },
    enteredBy: 'release-1', origin: 'user', argumentPushes: [claimSelector, idPush],
    calls: [{ kind: FrameKind.CALL, callee: 'markClaimed-1', target: vault.address, value: 0n, argumentPushes: [markSelector, idPush] }],
    segments: [[], []],
  });
  // The value the claimer's frame records: its own `return (1, 2)` leaves exactly the bytes the shipped result
  // encoding produces, and the control records another pair.
  const claimMaster: DraftMaster = {
    ...claimBase, retval: encodeResultList(recordedPair.map((value) => encodeIntegerValue(value))),
  };

  const vaultInput = (commitment: Uint8Array, output: Uint8Array): CompositionDraftPlan['inputs'][string] => ({
    source: { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable', commitment) },
    output: { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable', output) },
    unlockingBytecode: new Uint8Array([0x51]),
  });

  const plan: CompositionDraftPlan = {
    blocks: [
      {
        contract: 'Vault', masters: ['release-1', 'markClaimed-1'],
        validator: { id: 'validator', settles: [] }, state: insert ? [] : ['node'],
      },
      { contract: 'Claimer', masters: ['claim-1'], state: [] },
    ],
    userInputs: [
      ...(insert ? [{ id: 'site', index: createdIndex }, { id: 'head', index: headIndex }] : []),
      { id: 'user', index: userIndex },
    ],
    masters: [releaseMaster, markMaster, claimMaster],
    inputs: {
      'release-1': { source: masterInput(vault) },
      'markClaimed-1': { source: masterInput(vault) },
      'claim-1': { source: masterInput(claimer) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable') },
      },
      ...(insert
        ? {
          site: {
            source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
            output: {
              lockingBytecode: entryLock, valueSatoshis: 20_000n,
              // The control leaves the created node at the value the creating frame wrote, so the declaration the
              // frame one call higher ends at is not what the transaction writes.
              token: token(vault.category, 'mutable', control ? releaseRecord.after : mark.written[0]!.after),
            },
            unlockingBytecode: userInput().unlockingBytecode,
          },
          head: vaultInput(head, release.written[0]!.after),
        }
        : { node: vaultInput(before, mark.written[0]!.after) }),
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: ['Claimer'],
      settles: [{ category: vault.category, stateInputs: insert ? ['head'] : ['node'] }],
      redeemScript: validator.redeem,
    },
  };

  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Vault!, artifacts.Claimer!], plan,
  });
  let completed: readonly string[] = [];
  let error: string | undefined;
  try {
    completed = deriveDepthFirst(rootOf('Vault', 'release', 'release-1'), host)
      .completed.map((frame) => frame.master);
  } catch (caught) {
    error = (caught as Error).message;
  }
  const verdicts = ['release-1', 'markClaimed-1', 'claim-1', 'validator'].map((id) => verdictAt(draft, id));
  return {
    draft, completed, error, verdicts, written: mark.written[0]!.after, nodeIndex, createdIndex, headIndex,
  };
}

// The update case of the write-then-call shape settles inside the vault graph below, whose descriptor test and
// settlement also stand for the served-entry checks this describe used to repeat.
describe('a vault whose release writes its record and calls a claimer that reads it back', () => {
  it('settles the write that creates the record: its relinked head, the created node and the call', () => {
    // A write that creates the record has no input to read it at, so the segment declares the list's head sentinel
    // rewritten in place and the created node as a trailing output. The creating frame names the created node by
    // its position in that declaration - the record after the target's own - and the frame one call higher rewrites
    // it, so the chain ends at the commitment the transaction writes.
    const { draft, completed, error, written, createdIndex, headIndex } = driveSettled(true);

    expect(error).toBeUndefined();
    expect(completed).toStrictEqual(['markClaimed-1', 'claim-1', 'release-1']);

    // The created node's output and the relinked head are what the transaction writes, read back through the
    // shipped encoder; the created one carries the value the frame one call higher wrote.
    const program = draft.programFor('release-1');
    expect(program.transaction.outputs[createdIndex]!.token?.nft?.commitment).toStrictEqual(written);
    expect(program.transaction.outputs[createdIndex]!.token?.nft?.commitment).toStrictEqual(releaseView(2n));
    expect(program.transaction.outputs[headIndex]!.token?.nft?.commitment).toStrictEqual(relinkedHead());

    // The creating segment declares the head rewritten in place and the created node as its second record, and the
    // segment one call higher carries on from the value the created record ends at.
    expect(draft.blockOf('release-1').segments[0]!.map((entry) => entry.out)).toStrictEqual([headIndex, createdIndex]);
    expect(draft.blockOf('release-1').segments[0]![1]!.viewOut).toStrictEqual(releaseView(1n));
    expect(draft.blockOf('markClaimed-1').segments[0]![0]!.viewIn).toStrictEqual(releaseView(1n));

    for (const id of ['release-1', 'markClaimed-1', 'claim-1', 'validator']) {
      expect(`${id}: ${verdictAt(draft, id)}`).toBe(`${id}: accepted`);
    }
  });

  it('refuses a transaction that does not write what the last declaration ends at', () => {
    // The control leaves the created node at the value the creating frame wrote instead of the value the frame one
    // call higher ends it at, so the chain's last declaration is not the commitment the transaction writes. The
    // creating frame's own input is unaffected; the validator that settles the contract refuses.
    const { verdicts } = driveSettled(true, true);
    expect(verdicts[0]).toBe('accepted');
    expect(verdicts[3]).toBe('refused: Program failed an OP_VERIFY operation.');
  });
});

/** The record's commitment after `release` or `markClaimed` wrote the value, from the shipped encoder. */
function releaseView(value: bigint): Uint8Array {
  return encodeEntryCommitment(keyToSlotMulti([encodeIntegerValue(ID)]), ZERO_SLOT, encodeIntegerValue(value));
}

/** The head sentinel after a write relinks it to the target slot, from the shipped encoders. */
function relinkedHead(): Uint8Array {
  const sentinel = headSentinelCommitment();
  return encodeEntryCommitment(
    sentinel.slice(0, 32), keyToSlotMulti([encodeIntegerValue(ID)]), sentinel.slice(64),
  );
}

describe('the pair a claim returns beside the record write', () => {
  it('is served by the compiler and settles when the caller reads both values back', () => {
    // The pair the callee's own `return (1, 2)` computes, in the shipped result encoding.
    const pair = encodeResultList([encodeIntegerValue(1n), encodeIntegerValue(2n)]);
    const { draft, completed, error } = driveSettled();

    // The callee is derived before its caller, and the vault entry the call re-enters between them.
    expect(error).toBeUndefined();
    expect(completed).toStrictEqual(['markClaimed-1', 'claim-1', 'release-1']);

    // Every contract input passes the machine. `release` is accepted because its own `require`s read the two
    // values back in the order the callee returned them.
    for (const id of ['release-1', 'markClaimed-1', 'claim-1', 'validator']) {
      expect(`${id}: ${verdictAt(draft, id)}`).toBe(`${id}: accepted`);
    }

    // The caller's record of the call carries the pair, and the callee's frame records the same bytes: both read
    // back from the unlocking bytecode the machine evaluates and compared with the shipped encoders' output.
    const result = blockOf(draft.unlockingBytecodeOf('release-1')).calls[0]!.result;
    expect(result).toStrictEqual(pair);
    expect(blockOf(draft.unlockingBytecodeOf('claim-1')).retval).toStrictEqual(pair);
    // Reading the record's bytes back through the shipped codecs gives the two values the callee returned, in the
    // order it declared them.
    const first = splitFirstPush(result);
    const second = splitFirstPush(first.rest);
    expect(decodeIntegerValue(first.payload)).toBe(1n);
    expect(decodeIntegerValue(second.payload)).toBe(2n);

    // The control records the same two values in the other order. The callee's own comparison refuses the frame
    // that recorded what its code did not compute, and the caller reads the swapped values back and fails its own
    // requires.
    const swapped = driveSettled(false, false, [2n, 1n]);
    expect(verdictAt(swapped.draft, 'claim-1')).toBe('refused: Program failed an OP_VERIFY operation.');
    expect(verdictAt(swapped.draft, 'release-1')).toBe('refused: Program failed an OP_VERIFY operation.');
  });
});

/** The vault graph with an integer record and an integer balance, so every commitment is a shipped integer tail. */
const GRAPH_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IToken { function transfer(address to, int amount); }'
  + ' interface IVault {'
  + '   function markClaimed(int id);'
  + '   function pay(address to, int amount);'
  + ' }'
  + ' interface IClaimer { function claim(int id) returns (int); }'
  + ' contract Token {'
  + '   mapping(address => int) public balances;'
  + '   function transfer(address to, int amount) {'
  + '     this.balances[to] = this.balances[to] + amount;'
  + '     require(this.balances[to] >= amount);'
  + '   }'
  + ' }'
  + ' contract Vault {'
  + '   mapping(int => int) public recs;'
  + '   event Released(int first);'
  + '   function release(int id) {'
  + '     this.recs[id] = 1;'
  + `     int first = IClaimer(0x${CLAIMER}).claim(id);`
  + '     emit Released(first);'
  + '     require(true);'
  + '   }'
  + '   function markClaimed(int id) { this.recs[id] = 2; require(true); }'
  + `   function pay(address to, int amount) { IToken(0x${TOKEN}).transfer(to, amount); require(true); }`
  + ' }'
  + ' contract Claimer {'
  + '   function claim(int id) returns (int) {'
  + `     IVault(0x${VAULT}).markClaimed(id);`
  + `     IVault(0x${VAULT}).pay(0x${USER}, 1);`
  + `     IVault(0x${VAULT}).pay(0x${USER}, 2);`
  + '     return 1;'
  + '   }'
  + ' }';

const graph = compileAndDeploy(GRAPH_SOURCE, LABELS);

/** The two payments `claim` makes, and the balance the token's node ends at after both. */
const AMOUNTS = [1n, 2n] as const;
const BALANCE_AFTER = AMOUNTS[0] + AMOUNTS[1];

/** The token balance node's slot, and its commitment at a value, from the shipped encoders. */
function balanceNode(value: bigint): Uint8Array {
  return encodeEntryCommitment(keyToSlotMulti([USER_LOCK]), ZERO_SLOT, encodeIntegerValue(value));
}

/**
 * The unlocking a mapping node carries into a composition: the entry covenant's `<masterInputIndex> <flag>` shape.
 *
 * The node is written, so the flag is `1`, the write path a minting NFT of the node's own category at
 * `masterInputIndex` authorizes. The bytes are the shipped encoding `stateRecordUnlockingBytecode` builds for a
 * data-NFT record; only the redeem script differs, because a mapping node sits at its collection's entry covenant.
 */
function entryNodeUnlocking(
  script: ReturnType<typeof buildEntryNftCovenantScript>,
  masterInputIndex: number,
): Uint8Array {
  const args = [1n, BigInt(masterInputIndex)]
    .map((value) => encodeFunctionArgument(value, 'bigint') as Uint8Array);
  return createUnlockingBytecode('p2sh32', scriptToBytecode(script), args);
}

/** One participant's verdict on the assembled transaction, through the shipped machine. */
function verdictsOf(draft: CompositionDraft): readonly {
  readonly participant: string; readonly accepted: boolean; readonly objection?: string;
}[] {
  const program = draft.programFor('release-1');
  const vm = compositionMachine();
  return draft.layout.participants.map((placed) => {
    const state = vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    return vm.stateSuccess(state) === true
      ? { participant: placed.id, accepted: true }
      : { participant: placed.id, accepted: false, objection: String(state.error) };
  });
}

/** One participant's verdict in a form a test reads. */
function verdictOf(outcome: GraphOutcome, id: string): { readonly accepted: boolean; readonly objection?: string } {
  return outcome.verdicts.find((verdict) => verdict.participant === id)!;
}

interface GraphOutcome {
  readonly draft: CompositionDraft;
  readonly completed: readonly string[];
  readonly error?: string;
  readonly verdicts: ReturnType<typeof verdictsOf>;
  readonly vaultNodeIndex: number;
  readonly tokenNodeIndex: number;
  readonly eventIndex: number;
  readonly vaultRelease: Uint8Array;
  readonly vaultWritten: Uint8Array;
  readonly balanceWritten: Uint8Array;
}

/**
 * Lays the vault graph out and derives it through the shipped path.
 *
 * `release` writes the vault record in its first segment and calls `claim`; `claim` re-enters `markClaimed` and
 * pays twice, each `pay` reaching `transfer`. The vault record's declarations chain across `release` and
 * `markClaimed`; the token balance node, already held at zero, is rewritten by the two transfers, so its chain
 * runs from the spent commitment to the value the second transfer leaves. One validator covers every contract and
 * settles both records.
 *
 * The claimer's read-back of the vault's record is the piece of the graph that does not reach this path; it is
 * pinned by the composition below.
 */
function driveGraph(): GraphOutcome {
  const { artifacts, contracts } = graph;
  const vault = contracts.Vault!;
  const claimer = contracts.Claimer!;
  const tokenContract = contracts.Token!;
  const validator = validatorFor(vault.category);

  const idPush = encodeIntegerValue(ID);
  const slot = keyToSlotMulti([idPush]);
  const encodeValue = (value: bigint): Uint8Array => encodeIntegerValue(value);

  // The vault record the transaction holds, the value `release` writes, and the value `markClaimed` leaves.
  const recordSpent = encodeEntryCommitment(slot, ZERO_SLOT, encodeValue(0n));
  const vaultRelease = encodeEntryCommitment(slot, ZERO_SLOT, encodeValue(1n));
  const vaultWritten = encodeEntryCommitment(slot, ZERO_SLOT, encodeValue(2n));
  const releaseWrite = planMappingWrite({ keys: [idPush], value: 1n, inventory: [recordSpent], encodeValue });
  const markWrite = planMappingWrite({
    keys: [idPush], value: 2n, inventory: [releaseWrite.written[0]!.after], encodeValue,
  });

  // The token balance node, held at zero when the transaction starts: the two transfers rewrite it in turn.
  const balanceSpent = balanceNode(0n);
  const firstTransfer = planMappingWrite({ keys: [USER_LOCK], value: AMOUNTS[0], inventory: [balanceSpent], encodeValue });
  const secondTransfer = planMappingWrite({
    keys: [USER_LOCK], value: BALANCE_AFTER, inventory: [firstTransfer.written[0]!.after], encodeValue,
  });
  const balanceWritten = secondTransfer.written[0]!.after;

  const blocks: CompositionDraftPlan['blocks'] = [
    {
      contract: 'Vault', masters: ['release-1', 'markClaimed-1', 'pay-1', 'pay-2'],
      validator: { id: 'validator', settles: [] }, state: ['vaultNode'],
    },
    { contract: 'Claimer', masters: ['claim-1'], state: [] },
    { contract: 'Token', masters: ['transfer-1', 'transfer-2'], state: ['tokenNode'] },
  ];
  const layout = layoutWithFacets(blocks);
  const vaultNodeIndex = participant(layout, 'vaultNode').index;
  const tokenNodeIndex = participant(layout, 'tokenNode').index;
  const releaseIndex = participant(layout, 'release-1').index;
  const transferIndex = participant(layout, 'transfer-1').index;
  const eventIndex = layout.participantCount;

  const vaultPlacements = new Map<string, MappingNodePlacement>([
    [bytesToHex(slot), { in: vaultNodeIndex, out: vaultNodeIndex }],
  ]);
  const vaultSegments = layOutMappingWrites([[releaseWrite], [markWrite]], {
    placementOf: (candidate) => vaultPlacements.get(bytesToHex(candidate)),
  });
  const tokenPlacements = new Map<string, MappingNodePlacement>([
    [bytesToHex(keyToSlotMulti([USER_LOCK])), { in: tokenNodeIndex, out: tokenNodeIndex }],
  ]);
  const tokenSegments = layOutMappingWrites([[firstTransfer], [secondTransfer]], {
    placementOf: (candidate) => tokenPlacements.get(bytesToHex(candidate)),
  });

  const releaseSelector = selectorOf(artifacts, 'Vault', 'release');
  const markSelector = selectorOf(artifacts, 'Vault', 'markClaimed');
  const paySelector = selectorOf(artifacts, 'Vault', 'pay');
  const claimSelector = selectorOf(artifacts, 'Claimer', 'claim');
  const transferSelector = selectorOf(artifacts, 'Token', 'transfer');

  const vaultFacts = (functionName: string, kind: number, makesExternalCall: boolean): DraftMaster['facts'] => ({
    contract: 'Vault', functionName, kind, callerIsUser: kind === FrameKind.ROOT,
    originEqualsCaller: kind === FrameKind.ROOT, makesExternalCall, mastersOfContract: 4,
  });
  const tokenFacts = (): DraftMaster['facts'] => ({
    contract: 'Token', functionName: 'transfer', kind: FrameKind.CALL, callerIsUser: false,
    originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
  });

  const releaseMaster: DraftMaster = {
    ...master({
      master: 'release-1', contract: 'Vault', entry: 'release', program: vault.program,
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: vault.address, value: 0n },
      facts: vaultFacts('release', FrameKind.ROOT, true),
      enteredBy: 'user', origin: 'user', argumentPushes: [releaseSelector, idPush], dispatches: true,
      calls: [{
        kind: FrameKind.CALL, callee: 'claim-1', target: claimer.address, value: 0n,
        argumentPushes: [claimSelector, idPush],
      }],
      segments: [vaultSegments[0]!, []],
    }),
    events: [eventIndex],
  };
  const markMaster: DraftMaster = master({
    master: 'markClaimed-1', contract: 'Vault', entry: 'markClaimed', program: vault.program,
    frame: { kind: FrameKind.CALL, sender: claimer.address, self: vault.address, value: 0n },
    facts: vaultFacts('markClaimed', FrameKind.CALL, false),
    enteredBy: 'claim-1', origin: 'user', argumentPushes: [markSelector, idPush],
    segments: [vaultSegments[1]!],
  });
  const payMaster = (index: number): DraftMaster => master({
    master: `pay-${index + 1}`, contract: 'Vault', entry: 'pay', program: vault.program,
    frame: { kind: FrameKind.CALL, sender: claimer.address, self: vault.address, value: 0n },
    facts: vaultFacts('pay', FrameKind.CALL, true),
    enteredBy: 'claim-1', origin: 'user',
    argumentPushes: [paySelector, encodeValue(AMOUNTS[index]!), USER_LOCK],
    calls: [{
      kind: FrameKind.CALL, callee: `transfer-${index + 1}`, target: tokenContract.address, value: 0n,
      argumentPushes: [transferSelector, encodeValue(AMOUNTS[index]!), USER_LOCK],
    }],
  });
  const claimMaster: DraftMaster = {
    ...master({
      master: 'claim-1', contract: 'Claimer', entry: 'claim', program: claimer.program,
      frame: { kind: FrameKind.CALL, sender: vault.address, self: claimer.address, value: 0n },
      facts: {
        contract: 'Claimer', functionName: 'claim', kind: FrameKind.CALL, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
      },
      enteredBy: 'release-1', origin: 'user', argumentPushes: [claimSelector, idPush],
      calls: [
        {
          kind: FrameKind.CALL, callee: 'markClaimed-1', target: vault.address, value: 0n,
          argumentPushes: [markSelector, idPush],
        },
        {
          kind: FrameKind.CALL, callee: 'pay-1', target: vault.address, value: 0n,
          argumentPushes: [paySelector, encodeValue(AMOUNTS[0]!), USER_LOCK],
        },
        {
          kind: FrameKind.CALL, callee: 'pay-2', target: vault.address, value: 0n,
          argumentPushes: [paySelector, encodeValue(AMOUNTS[1]!), USER_LOCK],
        },
      ],
    }),
    retval: encodeResultList([encodeValue(1n)]),
  };
  const transferMaster = (index: number): DraftMaster => master({
    master: `transfer-${index + 1}`, contract: 'Token', entry: 'transfer', program: tokenContract.program,
    frame: { kind: FrameKind.CALL, sender: vault.address, self: tokenContract.address, value: 0n },
    facts: tokenFacts(),
    enteredBy: `pay-${index + 1}`, origin: 'user',
    argumentPushes: [transferSelector, encodeValue(AMOUNTS[index]!), USER_LOCK],
    segments: [tokenSegments[index]!],
  });

  const vaultEntryScript = buildEntryNftCovenantScript(
    vault.category, computeCollectionHash(artifacts.Vault!.stateLayout!.collections![0]!.signature),
  );
  const tokenEntryScript = buildEntryNftCovenantScript(
    tokenContract.category, computeCollectionHash(artifacts.Token!.stateLayout!.collections![0]!.signature),
  );
  const vaultLock = scriptToLockingBytecode(vaultEntryScript, 'p2sh32');
  const tokenLock = scriptToLockingBytecode(tokenEntryScript, 'p2sh32');
  const vaultEvent = artifacts.Vault!.events![0]!;

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [{ id: 'user', index: layout.participantCount }],
    masters: [
      releaseMaster, markMaster, payMaster(0), payMaster(1),
      claimMaster, transferMaster(0), transferMaster(1),
    ],
    inputs: {
      'release-1': { source: masterInput(vault) },
      'markClaimed-1': { source: masterInput(vault) },
      'pay-1': { source: masterInput(vault) },
      'pay-2': { source: masterInput(vault) },
      'claim-1': { source: masterInput(claimer) },
      'transfer-1': { source: masterInput(tokenContract) },
      'transfer-2': { source: masterInput(tokenContract) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable') },
      },
      vaultNode: {
        source: { lockingBytecode: vaultLock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable', recordSpent) },
        output: {
          lockingBytecode: vaultLock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable', vaultWritten),
        },
        unlockingBytecode: entryNodeUnlocking(vaultEntryScript, releaseIndex),
      },
      tokenNode: {
        source: {
          lockingBytecode: tokenLock, valueSatoshis: 20_000n,
          token: token(tokenContract.category, 'mutable', balanceSpent),
        },
        output: {
          lockingBytecode: tokenLock, valueSatoshis: 20_000n,
          token: token(tokenContract.category, 'mutable', balanceWritten),
        },
        unlockingBytecode: entryNodeUnlocking(tokenEntryScript, transferIndex),
      },
      user: userInput(),
    },
    trailingOutputs: [
      eventOutput(vault.category, vaultEvent.signature, encodeEventCommitment(vaultEvent.parameters, [1n])),
    ],
    validator: {
      id: 'validator', covers: ['Claimer', 'Token'],
      settles: [
        { category: vault.category, stateInputs: ['vaultNode'] },
        { category: tokenContract.category, stateInputs: ['tokenNode'] },
      ],
      redeemScript: validator.redeem,
    },
  };

  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Vault!, artifacts.Claimer!, artifacts.Token!], plan,
  });
  let completed: readonly string[] = [];
  let error: string | undefined;
  try {
    completed = deriveDepthFirst(rootOf('Vault', 'release', 'release-1'), host)
      .completed.map((frame) => frame.master);
  } catch (caught) {
    error = (caught as Error).message;
  }
  return {
    draft, completed, error, verdicts: verdictsOf(draft),
    vaultNodeIndex, tokenNodeIndex, eventIndex, vaultRelease, vaultWritten, balanceWritten,
  };
}

let honestGraph: GraphOutcome | undefined;

/** The honest graph, derived once: the cases that read it change nothing in it. */
function sharedGraph(): GraphOutcome {
  honestGraph ??= driveGraph();
  return honestGraph;
}

describe('the vault graph: release, two payments through the token and the emit', () => {
  it('publishes the descriptor, the two collections and the event the graph needs', () => {
    for (const name of ['Token', 'Vault', 'Claimer']) {
      expect(graph.artifacts[name]?.composition?.convention).toBe('framed');
    }
    expect(graph.artifacts.Vault?.stateLayout?.mappings?.map((mapping) => `${mapping.name}:${mapping.sorted}`))
      .toStrictEqual(['recs:true']);
    expect(graph.artifacts.Token?.stateLayout?.mappings?.map((mapping) => `${mapping.name}:${mapping.sorted}`))
      .toStrictEqual(['balances:true']);
    expect(graph.artifacts.Vault?.events?.map((event) => event.signature)).toStrictEqual(['Released(int256)']);
    const claim = entriesOf(graph.artifacts, 'Claimer')
      .find((entry) => entry.functionName === entryName('Claimer', 'claim'))!;
    expect(claim.calls.map((call) => call.functionName)).toStrictEqual(['markClaimed', 'pay', 'pay']);
  });

  it('derives the whole graph and is accepted at every contract input', () => {
    const { draft, completed, error, verdicts, vaultNodeIndex, tokenNodeIndex, eventIndex } = sharedGraph();

    // Every hop runs on its own master, callee before caller.
    expect(error).toBeUndefined();
    expect(completed).toStrictEqual([
      'markClaimed-1', 'transfer-1', 'pay-1', 'transfer-2', 'pay-2', 'claim-1', 'release-1',
    ]);

    // Every participant - the seven masters, the validator, the vault record and the token's node - is accepted.
    const rejected = verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    expect(verdicts.map((verdict) => verdict.participant)).toStrictEqual([
      'release-1', 'markClaimed-1', 'pay-1', 'pay-2', 'validator', 'validator/1', 'vaultNode', 'claim-1',
      'transfer-1', 'transfer-2', 'tokenNode',
    ]);
    expect(participant(draft.layout, 'vaultNode').index).toBe(vaultNodeIndex);
    expect(participant(draft.layout, 'tokenNode').index).toBe(tokenNodeIndex);
    expect(draft.trailingOutputs.map((placed) => placed.index)).toStrictEqual([eventIndex]);
  });

  it('chains each record\'s views across every frame that runs on it', () => {
    const { draft, vaultNodeIndex, tokenNodeIndex, vaultRelease, vaultWritten, balanceWritten } = sharedGraph();
    const program = draft.programFor('release-1');

    // The vault record the transaction spends and writes, read back through the shipped encoder, and the two
    // frames that touch it: `release` writes 1, and `markClaimed` carries on from 1 to 2.
    expect(program.sourceOutputs[vaultNodeIndex]!.token?.nft?.commitment)
      .toStrictEqual(encodeEntryCommitment(keyToSlotMulti([encodeIntegerValue(ID)]), ZERO_SLOT, encodeIntegerValue(0n)));
    expect(program.transaction.outputs[vaultNodeIndex]!.token?.nft?.commitment).toStrictEqual(vaultWritten);
    expect(draft.blockOf('release-1').segments[0]![0]).toStrictEqual({
      in: vaultNodeIndex, out: vaultNodeIndex,
      viewIn: encodeEntryCommitment(keyToSlotMulti([encodeIntegerValue(ID)]), ZERO_SLOT, encodeIntegerValue(0n)),
      viewOut: vaultRelease,
    });
    expect(draft.blockOf('markClaimed-1').segments[0]![0]).toStrictEqual({
      in: vaultNodeIndex, out: vaultNodeIndex, viewIn: vaultRelease, viewOut: vaultWritten,
    });

    // The token's balance node, held at 0: the first transfer closes it at 1 and the second reads 1 and closes it
    // at 3, all read back from the transaction the machine evaluates and the shipped encoders.
    expect(program.sourceOutputs[tokenNodeIndex]!.token?.nft?.commitment).toStrictEqual(balanceNode(0n));
    expect(program.transaction.outputs[tokenNodeIndex]!.token?.nft?.commitment).toStrictEqual(balanceWritten);
    expect(balanceWritten).toStrictEqual(balanceNode(BALANCE_AFTER));
    expect(draft.blockOf('transfer-1').segments[0]![0]).toStrictEqual({
      in: tokenNodeIndex, out: tokenNodeIndex, viewIn: balanceNode(0n), viewOut: balanceNode(AMOUNTS[0]),
    });
    expect(draft.blockOf('transfer-2').segments[0]![0]).toStrictEqual({
      in: tokenNodeIndex, out: tokenNodeIndex, viewIn: balanceNode(AMOUNTS[0]), viewOut: balanceWritten,
    });
  });

  it('emits the value the claimer returned and records it in the callers\' frames', () => {
    const { draft, eventIndex } = sharedGraph();
    const program = draft.programFor('release-1');

    // The event `release` emits carries the value `claim` returned, at the layout's first trailing output, read
    // back through the shipped event encoder.
    expect(draft.blockOf('release-1').events).toStrictEqual([eventIndex]);
    const event = graph.artifacts.Vault!.events![0]!;
    expect(program.transaction.outputs[eventIndex]!.token?.nft).toStrictEqual({
      capability: 'none', commitment: encodeEventCommitment(event.parameters, [1n]),
    });

    // `claim` returns the value, so its own `retval` and `release`'s call record carry it, read back through the
    // shipped result encoding.
    const returned = encodeResultList([encodeIntegerValue(1n)]);
    expect(blockOf(draft.unlockingBytecodeOf('claim-1')).retval).toStrictEqual(returned);
    expect(blockOf(draft.unlockingBytecodeOf('release-1')).calls[0]!.result).toStrictEqual(returned);
  });

  it('refuses a transaction whose vault record output is not what the last declaration ends at', () => {
    // The control on the same composition: every frame keeps its own declaration and the body computes what it
    // closes against, so the masters are self-consistent; the settlement is what holds the chain's last
    // declaration to the commitment the transaction writes, and it refuses. Only the vault record's output changes.
    const honest = sharedGraph();
    const written = encodeEntryCommitment(
      keyToSlotMulti([encodeIntegerValue(ID)]), ZERO_SLOT, encodeIntegerValue(9n),
    );
    const program = honest.draft.programFor('release-1');
    const transaction = {
      ...program.transaction,
      outputs: program.transaction.outputs.map((output, index) => (index === honest.vaultNodeIndex
        ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: written } } }
        : output)),
    };
    const accepts = (id: string): boolean => {
      const vm = compositionMachine();
      return vm.stateSuccess(vm.evaluate({
        inputIndex: participant(honest.draft.layout, id).index, sourceOutputs: program.sourceOutputs, transaction,
      })) === true;
    };

    expect(verdictOf(honest, 'validator').accepted).toBe(true);
    // `release` and `markClaimed` still accept: each reads its own declaration, and the transaction's output is not
    // what either of them closes against.
    expect(accepts('release-1')).toBe(true);
    expect(accepts('markClaimed-1')).toBe(true);
    expect(accepts('validator')).toBe(false);
  });
});

/**
 * The read-back the same graph's claimer makes, and the hop it settles.
 *
 * `Vault.release` writes its record and calls `Claimer.claim`, which reads the record back through the read-only
 * `get` and returns what it read. The composition is otherwise the smallest that carries the hop: the vault's two
 * masters and record, the claimer's master, one validator and the user. Every participant is accepted by the
 * machine and the derivation completes the reading frame, then the claimer, then the entry that made the call.
 *
 * A read-only frame declares the record it reads the same way a writing frame declares one, and its `viewIn` for a
 * record it does not write is that record's current view. The frame's records are separate UTXOs, so an entry does
 * not sit at a fixed offset from the input the frame runs on: the body addresses the record block the frame's own
 * witness block declares, which is the base the head parks, exactly as a state read does. A read that addressed its
 * own input instead matched no declared record, so the declared-view read came back empty and its non-emptiness
 * guard failed. The control below shows the read resolving that declaration rather than the spent commitment.
 */
const READBACK_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IVault { function get(int id) view returns (int); }'
  + ' interface IClaimer { function claim(int id) returns (int); }'
  + ' contract Vault {'
  + '   mapping(int => int) public recs;'
  + '   event Released(int first);'
  + '   function release(int id) {'
  + '     this.recs[id] = 1;'
  + `     int first = IClaimer(0x${CLAIMER}).claim(id);`
  + '     emit Released(first);'
  + '     require(true);'
  + '   }'
  + '   function get(int id) view returns (int) { return this.recs[id]; }'
  + ' }'
  + ' contract Claimer {'
  + '   function claim(int id) returns (int) {'
  + `     int s = IVault(0x${VAULT}).get(id);`
  + '     require(s == 1);'
  + '     return s;'
  + '   }'
  + ' }';

/** The smallest composition carrying the read-back hop: release's write, the read-only get, and the return. */
function driveReadBack(): GraphOutcome {
  const { artifacts, contracts } = compileAndDeploy(READBACK_SOURCE, { Vault: VAULT_LABEL, Claimer: CLAIMER_LABEL });
  const vault = contracts.Vault!;
  const claimer = contracts.Claimer!;
  const validator = validatorFor(vault.category);

  const idPush = encodeIntegerValue(ID);
  const slot = keyToSlotMulti([idPush]);
  const before = encodeEntryCommitment(slot, ZERO_SLOT, encodeIntegerValue(0n));
  const releaseCommitment = encodeEntryCommitment(slot, ZERO_SLOT, encodeIntegerValue(1n));
  const releaseWrite = planMappingWrite({
    keys: [idPush], value: 1n, inventory: [before], encodeValue: (value) => encodeIntegerValue(value),
  });

  const blocks: CompositionDraftPlan['blocks'] = [
    {
      contract: 'Vault', masters: ['release-1', 'get-1'],
      validator: { id: 'validator', settles: [] }, state: ['vaultNode'],
    },
    { contract: 'Claimer', masters: ['claim-1'], state: [] },
  ];
  const layout = layoutWithFacets(blocks);
  const vaultNodeIndex = participant(layout, 'vaultNode').index;
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(slot), { in: vaultNodeIndex, out: vaultNodeIndex }],
  ]);
  const releaseSegments = layOutMappingWrites([[releaseWrite]], {
    placementOf: (candidate) => placements.get(bytesToHex(candidate)),
  });

  const releaseSelector = selectorOf(artifacts, 'Vault', 'release');
  const getSelector = selectorOf(artifacts, 'Vault', 'get');
  const claimSelector = selectorOf(artifacts, 'Claimer', 'claim');
  const entryScript = buildEntryNftCovenantScript(
    vault.category, computeCollectionHash(artifacts.Vault!.stateLayout!.collections![0]!.signature),
  );
  const lock = scriptToLockingBytecode(entryScript, 'p2sh32');
  const eventIndex = layout.participantCount;
  const vaultEvent = artifacts.Vault!.events![0]!;
  const releaseIndex = participant(layout, 'release-1').index;

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [{ id: 'user', index: layout.participantCount }],
    masters: [
      {
        ...master({
          master: 'release-1', contract: 'Vault', entry: 'release', program: vault.program,
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: vault.address, value: 0n },
          facts: {
            contract: 'Vault', functionName: 'release', kind: FrameKind.ROOT, callerIsUser: true,
            originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 2,
          },
          enteredBy: 'user', origin: 'user', argumentPushes: [releaseSelector, idPush], dispatches: true,
          calls: [{
            kind: FrameKind.CALL, callee: 'claim-1', target: claimer.address, value: 0n,
            argumentPushes: [claimSelector, idPush],
          }],
          segments: [releaseSegments[0]!, []],
        }),
        events: [eventIndex],
      },
      {
        ...master({
          master: 'get-1', contract: 'Vault', entry: 'get', program: vault.program,
          frame: { kind: FrameKind.STATIC, sender: claimer.address, self: vault.address, value: 0n },
          facts: {
            contract: 'Vault', functionName: 'get', kind: FrameKind.STATIC, callerIsUser: false,
            originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
          },
          enteredBy: 'claim-1', origin: 'user', argumentPushes: [getSelector, idPush],
          // The read-only frame declares the record it reads, at the coordinate the writing frames use.
          segments: [[{ in: vaultNodeIndex, out: vaultNodeIndex, viewIn: releaseCommitment, viewOut: releaseCommitment }]],
        }),
        retval: encodeResultList([encodeIntegerValue(1n)]),
      },
      {
        ...master({
          master: 'claim-1', contract: 'Claimer', entry: 'claim', program: claimer.program,
          frame: { kind: FrameKind.CALL, sender: vault.address, self: claimer.address, value: 0n },
          facts: {
            contract: 'Claimer', functionName: 'claim', kind: FrameKind.CALL, callerIsUser: false,
            originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
          },
          enteredBy: 'release-1', origin: 'user', argumentPushes: [claimSelector, idPush],
          calls: [{
            kind: FrameKind.STATIC, callee: 'get-1', target: vault.address, value: 0n,
            argumentPushes: [getSelector, idPush],
          }],
        }),
        retval: encodeResultList([encodeIntegerValue(1n)]),
      },
    ],
    inputs: {
      'release-1': { source: masterInput(vault) },
      'get-1': { source: masterInput(vault) },
      'claim-1': { source: masterInput(claimer) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable') },
      },
      vaultNode: {
        source: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable', before) },
        output: {
          lockingBytecode: lock, valueSatoshis: 20_000n,
          token: token(vault.category, 'mutable', releaseWrite.written[0]!.after),
        },
        unlockingBytecode: entryNodeUnlocking(entryScript, releaseIndex),
      },
      user: userInput(),
    },
    trailingOutputs: [
      eventOutput(vault.category, vaultEvent.signature, encodeEventCommitment(vaultEvent.parameters, [1n])),
    ],
    validator: {
      id: 'validator', covers: ['Claimer'],
      settles: [{ category: vault.category, stateInputs: ['vaultNode'] }],
      redeemScript: validator.redeem,
    },
  };

  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Vault!, artifacts.Claimer!], plan,
  });
  let completed: readonly string[] = [];
  let error: string | undefined;
  try {
    completed = deriveDepthFirst(rootOf('Vault', 'release', 'release-1'), host)
      .completed.map((frame) => frame.master);
  } catch (caught) {
    error = (caught as Error).message;
  }
  return {
    draft, completed, error, verdicts: verdictsOf(draft),
    vaultNodeIndex, tokenNodeIndex: -1, eventIndex,
    vaultRelease: releaseCommitment, vaultWritten: releaseWrite.written[0]!.after, balanceWritten: new Uint8Array(0),
  };
}

describe('the claimer\'s read-back of the record `release` wrote', () => {
  it('settles the hop: the read-only frame resolves the record its segment declares', () => {
    const { draft, completed, error, verdicts, vaultNodeIndex } = driveReadBack();

    // The reading frame runs first, then the claimer that called it, then the entry that made the call; no frame
    // is refused, so the read-back is part of the graph rather than its end.
    expect(error).toBeUndefined();
    expect(completed).toStrictEqual(['get-1', 'claim-1', 'release-1']);

    // The reading frame declares the record at the index the transaction holds it at and reads its own
    // declaration for both sides: it neither writes the record nor names a coordinate of its own.
    expect(draft.blockOf('get-1').segments[0]).toStrictEqual([
      { in: vaultNodeIndex, out: vaultNodeIndex, viewIn: releaseView(1n), viewOut: releaseView(1n) },
    ]);

    // Every participant is accepted: the writing entry and its call, the reading frame, the validator that covers
    // the composition and the record UTXO itself.
    const refused = verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(refused).toStrictEqual([]);
    expect(verdicts.map((verdict) => `${verdict.participant}:${verdict.accepted}`)).toStrictEqual([
      'release-1:true', 'get-1:true', 'validator:true', 'validator/1:true', 'vaultNode:true', 'claim-1:true',
    ]);
  });

  it('reads the declaration its segment carries, not the commitment the transaction spends', () => {
    // The control: the reading frame's body resolves the record through its own segment's declaration, so a
    // declaration carrying another value reaches the body's `require(s == 1)` and fails there.
    const { draft } = driveReadBack();
    draft.blockOf('get-1').segments[0]![0]!.viewIn = releaseView(2n);
    expect(verdictAt(draft, 'get-1')).toBe('refused: Program failed an OP_VERIFY operation.');

    // The other control: a frame that declares no record has nothing to resolve, so the read fails rather than
    // falling back to the spent commitment.
    const empty = driveReadBack();
    empty.draft.blockOf('get-1').segments[0] = [];
    expect(verdictAt(empty.draft, 'get-1')).toBe('refused: Program failed an OP_VERIFY operation.');
  });
});

/** The read-back shape without an event, so the created node's trailing output follows the participants directly. */
const CREATED_READBACK_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IVault { function get(int id) view returns (int); }'
  + ' interface IClaimer { function claim(int id) returns (int); }'
  + ' contract Vault {'
  + '   mapping(int => int) public recs;'
  + '   function release(int id) {'
  + '     this.recs[id] = 1;'
  + `     int first = IClaimer(0x${CLAIMER}).claim(id);`
  + '     require(first == 1);'
  + '     require(true);'
  + '   }'
  + '   function get(int id) view returns (int) { return this.recs[id]; }'
  + ' }'
  + ' contract Claimer {'
  + '   function claim(int id) returns (int) {'
  + `     int s = IVault(0x${VAULT}).get(id);`
  + '     require(s == 1);'
  + '     return s;'
  + '   }'
  + ' }';

/**
 * The same read-back against a record an earlier frame created.
 *
 * `Vault.release` inserts into an empty list, so the record has no input at all: the creating segment declares the
 * head sentinel relinked in place and the created node as a trailing output. `Claimer.claim` reads it back through
 * `Vault.get`, whose segment declares the created node with the no-index sentinel on its input side, carrying the
 * node the creator left. The reading frame addresses its declaration the same way a read of a spent record does, so
 * the read resolves what the earlier frame created rather than a UTXO the transaction does not hold.
 */
function driveCreatedReadBack(): {
  readonly draft: CompositionDraft;
  readonly completed: readonly string[];
  readonly error?: string;
  readonly createdIndex: number;
  readonly headIndex: number;
} {
  const { artifacts, contracts } = compileAndDeploy(CREATED_READBACK_SOURCE, { Vault: VAULT_LABEL, Claimer: CLAIMER_LABEL });
  const vault = contracts.Vault!;
  const claimer = contracts.Claimer!;
  const validator = validatorFor(vault.category);

  const idPush = encodeIntegerValue(ID);
  const slot = keyToSlotMulti([idPush]);
  const encodeValue = (value: bigint): Uint8Array => encodeIntegerValue(value);
  const head = headSentinelCommitment();
  const release = planMappingWrite({ keys: [idPush], value: 1n, inventory: [head], encodeValue });
  const createdNode = release.written[1]!;

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Vault', masters: ['release-1', 'get-1'], validator: { id: 'validator', settles: [] }, state: [] },
    { contract: 'Claimer', masters: ['claim-1'], state: [] },
  ];
  const layout = layoutWithFacets(blocks);
  const createdIndex = layout.participantCount;
  const headIndex = createdIndex + 1;
  const userIndex = headIndex + 1;
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(new Uint8Array(32)), { in: headIndex, out: headIndex }],
    [bytesToHex(slot), { out: createdIndex }],
  ]);
  const releaseSegments = layOutMappingWrites([[release]], {
    placementOf: (candidate) => placements.get(bytesToHex(candidate)),
  });

  const releaseSelector = selectorOf(artifacts, 'Vault', 'release');
  const getSelector = selectorOf(artifacts, 'Vault', 'get');
  const claimSelector = selectorOf(artifacts, 'Claimer', 'claim');
  const entryScript = buildEntryNftCovenantScript(
    vault.category, computeCollectionHash(artifacts.Vault!.stateLayout!.collections![0]!.signature),
  );
  const lock = scriptToLockingBytecode(entryScript, 'p2sh32');
  const releaseIndex = participant(layout, 'release-1').index;

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [
      { id: 'site', index: createdIndex },
      { id: 'head', index: headIndex },
      { id: 'user', index: userIndex },
    ],
    masters: [
      master({
        master: 'release-1', contract: 'Vault', entry: 'release', program: vault.program,
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: vault.address, value: 0n },
        facts: {
          contract: 'Vault', functionName: 'release', kind: FrameKind.ROOT, callerIsUser: true,
          originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 2,
        },
        enteredBy: 'user', origin: 'user', argumentPushes: [releaseSelector, idPush], dispatches: true,
        calls: [{
          kind: FrameKind.CALL, callee: 'claim-1', target: claimer.address, value: 0n,
          argumentPushes: [claimSelector, idPush],
        }],
        segments: [releaseSegments[0]!, []],
      }),
      {
        ...master({
          master: 'get-1', contract: 'Vault', entry: 'get', program: vault.program,
          frame: { kind: FrameKind.STATIC, sender: claimer.address, self: vault.address, value: 0n },
          facts: {
            contract: 'Vault', functionName: 'get', kind: FrameKind.STATIC, callerIsUser: false,
            originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
          },
          enteredBy: 'claim-1', origin: 'user', argumentPushes: [getSelector, idPush],
          // The created node carries no input index, so the reading frame declares it with the sentinel the
          // creator's own segment used and carries on from the node that segment left.
          segments: [[
            { in: 0xffff, out: createdIndex, viewIn: createdNode.after, viewOut: createdNode.after },
          ]],
        }),
        retval: encodeResultList([encodeIntegerValue(1n)]),
      },
      {
        ...master({
          master: 'claim-1', contract: 'Claimer', entry: 'claim', program: claimer.program,
          frame: { kind: FrameKind.CALL, sender: vault.address, self: claimer.address, value: 0n },
          facts: {
            contract: 'Claimer', functionName: 'claim', kind: FrameKind.CALL, callerIsUser: false,
            originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
          },
          enteredBy: 'release-1', origin: 'user', argumentPushes: [claimSelector, idPush],
          calls: [{
            kind: FrameKind.STATIC, callee: 'get-1', target: vault.address, value: 0n,
            argumentPushes: [getSelector, idPush],
          }],
        }),
        retval: encodeResultList([encodeIntegerValue(1n)]),
      },
    ],
    inputs: {
      'release-1': { source: masterInput(vault) },
      'get-1': { source: masterInput(vault) },
      'claim-1': { source: masterInput(claimer) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable') },
      },
      site: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        output: {
          lockingBytecode: lock, valueSatoshis: 20_000n,
          token: token(vault.category, 'mutable', createdNode.after),
        },
        unlockingBytecode: userInput().unlockingBytecode,
      },
      head: {
        source: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable', head) },
        output: {
          lockingBytecode: lock, valueSatoshis: 20_000n,
          token: token(vault.category, 'mutable', release.written[0]!.after),
        },
        unlockingBytecode: entryNodeUnlocking(entryScript, releaseIndex),
      },
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: ['Claimer'],
      settles: [{ category: vault.category, stateInputs: ['head'] }],
      redeemScript: validator.redeem,
    },
  };

  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Vault!, artifacts.Claimer!], plan,
  });
  let completed: readonly string[] = [];
  let error: string | undefined;
  try {
    completed = deriveDepthFirst(rootOf('Vault', 'release', 'release-1'), host)
      .completed.map((frame) => frame.master);
  } catch (caught) {
    error = (caught as Error).message;
  }
  return { draft, completed, error, createdIndex, headIndex };
}

describe('the claimer\'s read-back of a record an earlier frame created', () => {
  it('settles the hop: the reading frame resolves the node the creating segment declared', () => {
    const { draft, completed, error, createdIndex, headIndex } = driveCreatedReadBack();

    // The creating frame runs first, then the reading frame, then the claimer that called it, then the entry.
    expect(error).toBeUndefined();
    expect(completed).toStrictEqual(['get-1', 'claim-1', 'release-1']);

    // The created node is a trailing output with no input to read it at; the creating segment names it with the
    // sentinel, and the reading frame's own segment carries on from the node that segment left.
    const created = draft.blockOf('get-1').segments[0]![0]!;
    expect(created).toStrictEqual({
      in: 0xffff, out: createdIndex,
      viewIn: draft.blockOf('release-1').segments[0]![1]!.viewOut,
      viewOut: draft.blockOf('release-1').segments[0]![1]!.viewOut,
    });

    // Every contract input is accepted, and so is the relinked head's own UTXO, which is the other record the
    // creating frame wrote. (The inputs that fund the created node are the harness's own spends, whose filler
    // signatures cannot satisfy a P2PKH, so they are not what this asks.)
    const accepted = ['release-1', 'get-1', 'validator', 'claim-1'].map((id) => `${id}: ${verdictAt(draft, id)}`);
    expect(accepted).toStrictEqual([
      'release-1: accepted', 'get-1: accepted', 'validator: accepted', 'claim-1: accepted',
    ]);
    expect(verdictAtIndex(draft, headIndex)).toBe('accepted');
  });
});
