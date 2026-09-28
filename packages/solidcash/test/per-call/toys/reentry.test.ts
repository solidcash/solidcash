import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  buildEntryNftCovenantScript,
  computeCollectionHash,
  decodeIntegerValue,
  decodeWitnessBlock,
  encodeIntegerValue,
  encodeResultList,
  splitFirstPush,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';
import { scriptToLockingBytecode } from '../../../src/utils.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  USER_LOCK, compileAndDeploy, entryName, hexOf, master, masterInput, rootOf, seededAddress, selectorOf, token,
  userInput, validatorFor,
} from '../shapes/harness.js';
import {
  createComposedDerivationHost, createShippedDerivationHost, deriveDepthFirst, layOutMappingWrites, participant,
  planMappingWrite, type CompositionDraftPlan, type DraftMaster, type MappingNodePlacement,
} from '../../../src/per-call/composer/index.js';
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

/** The shape's source. `claim` returns one amount, or the pair `release` reads back and emits. */
function source(returns: 'amount' | 'amounts'): string {
  const two = returns === 'amounts';
  const signature = two ? '(int, int)' : '(int)';
  const unpack = two ? '(int first, int second)' : 'int first';
  const event = two ? 'Released(int first, int second)' : 'Released(int first)';
  const emitted = two ? 'Released(first, second)' : 'Released(first)';
  const returned = two ? '(1, 2)' : '1';
  return 'pragma solidcash ^0.13.0;'
    + ' interface IToken { function transfer(address to, int amount); }'
    + ' interface IVault {'
    + '   function get(int id) view returns (int);'
    + '   function markClaimed(int id);'
    + '   function pay(address to, int amount);'
    + ' }'
    + ` interface IClaimer { function claim(int id) returns ${signature}; }`
    + ' contract Token {'
    + '   mapping(address => int) public balances;'
    + '   function transfer(address to, int amount) {'
    + '     this.balances[to] = this.balances[to] + amount;'
    + '     require(this.balances[to] >= amount);'
    + '   }'
    + ' }'
    + ' contract Vault {'
    + '   struct Rec { int state; bool claimed; }'
    + '   mapping(int => Rec) public recs;'
    + `   event ${event};`
    + '   function release(int id) {'
    + '     this.recs[id].state = 1;'
    + `     ${unpack} = IClaimer(0x${CLAIMER}).claim(id);`
    + `     emit ${emitted};`
    + '     require(true);'
    + '   }'
    + '   function markClaimed(int id) { this.recs[id].claimed = true; require(true); }'
    + `   function pay(address to, int amount) { IToken(0x${TOKEN}).transfer(to, amount); require(true); }`
    + '   function get(int id) view returns (int) { return this.recs[id].state; }'
    + ' }'
    + ' contract Claimer {'
    + `   function claim(int id) returns ${signature} {`
    + `     int s = IVault(0x${VAULT}).get(id);`
    + '     require(s == 1);'
    + `     IVault(0x${VAULT}).markClaimed(id);`
    + `     IVault(0x${VAULT}).pay(0x${USER}, 1);`
    + `     IVault(0x${VAULT}).pay(0x${USER}, 2);`
    + `     return ${returned};`
    + '   }'
    + ' }';
}

/** The write-then-call half of the shape, without the payments and the read-back. */
const SETTLED_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IClaimer { function claim(int id); }'
  + ' interface IVault { function markClaimed(int id); }'
  + ' contract Claimer {'
  + `   function claim(int id) { IVault(0x${VAULT}).markClaimed(id); require(true); }`
  + ' }'
  + ' contract Vault {'
  + '   mapping(int => int) recs;'
  + '   function release(int id) {'
  + '     this.recs[id] = 1;'
  + `     IClaimer(0x${CLAIMER}).claim(id);`
  + '     require(true);'
  + '   }'
  + '   function markClaimed(int id) { this.recs[id] = 2; require(true); }'
  + ' }';

/** The same shape with `claim` returning a pair and `release` reading it back. */
const PAIRED_SOURCE = 'pragma solidcash ^0.13.0;'
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

const single = compileAndDeploy(source('amount'), LABELS);
const amounts = compileAndDeploy(source('amounts'), LABELS);

/** One entry as the artifact publishes it: its stop sites, and the calls its own code makes. */
interface PublishedEntry {
  readonly functionName: string;
  readonly calls: readonly { readonly callIndex: number; readonly functionName: string; readonly selector: string }[];
}

/** The entries a contract publishes, in the order the artifact lists them. */
function entriesOf(artifacts: ArtifactMap, contract: string): readonly PublishedEntry[] {
  const composition = artifacts[contract]!.composition as { stopSites?: { entries: PublishedEntry[] } };
  return composition.stopSites?.entries ?? [];
}

/** One master's witness block, read back from the unlocking bytecode the composer built, through the shipped codec. */
function blockOf(unlocking: Uint8Array): ReturnType<typeof decodeWitnessBlock> {
  return decodeWitnessBlock(splitFirstPush(unlocking).payload);
}

/** The machine's verdict on one participant's own input of the assembled transaction. */
function verdictAt(draft: ReturnType<typeof createComposedDerivationHost>['draft'], id: string): string {
  const program = draft.programFor('release-1');
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: participant(draft.layout, id).index,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
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
 * With `paired` the same plan drives the shape whose `claim` returns a pair: the master's frame records
 * `recordedPair` in its `retval`, which the honest run takes from the shipped result encoding and the control
 * changes, so `release` reads the record's `result` back and requires each value.
 */
function driveSettled(
  insert = false,
  control = false,
  paired = false,
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
  const { artifacts, contracts } = compileAndDeploy(paired ? PAIRED_SOURCE : SETTLED_SOURCE,
    { Vault: VAULT_LABEL, Claimer: CLAIMER_LABEL });
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
  const participantCount = 2 + 1 + stateCount + 1;
  const nodeIndex = 3;
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
  const claimMaster: DraftMaster = paired
    ? { ...claimBase, retval: encodeResultList(recordedPair.map((value) => encodeIntegerValue(value))) }
    : claimBase;

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

describe('a vault whose release writes its record and calls a claimer that reads it back', () => {
  const { artifacts, contracts } = single;

  it('publishes a per-call descriptor, the sorted record and the event for every contract', () => {
    for (const name of ['Token', 'Vault', 'Claimer']) {
      expect(artifacts[name]?.composition?.convention).toBe('per-call');
    }
    expect(artifacts.Vault?.stateLayout?.mappings?.map((mapping) => mapping.name)).toStrictEqual(['recs']);
    expect(artifacts.Vault?.stateLayout?.mappings?.[0]?.sorted).toBe(true);
    expect(artifacts.Vault?.events?.map((event) => event.signature)).toStrictEqual(['Released(int256)']);
    expect(contracts.Vault!.program.length).toBeGreaterThan(0);
  });

  it('compiles the claimer\'s graph: the read-back, the re-entered claim and the two pays', () => {
    // `claim` reads the vault, requires the record, re-enters the vault and pays twice; the read-only read and the
    // two calls to the same entry are each published as their own site.
    const claim = entriesOf(artifacts, 'Claimer').find((entry) => entry.functionName === entryName('Claimer', 'claim'))!;
    expect(claim.calls.map((call) => call.functionName)).toStrictEqual(['get', 'markClaimed', 'pay', 'pay']);
    expect(claim.calls[2]!.selector).toBe(claim.calls[3]!.selector);
  });

  it('serves the vault entries that write a record and make an external call', () => {
    // `release` writes `recs[id].state`, then calls the claimer, so its record write lands in the segment its own
    // code runs in and the derivation reads it. `markClaimed` writes the same collection and makes no call. Both
    // are emitted; the compiler publishes no refusal for either.
    const refused = publishedRefusals(artifacts as Record<string, { composition?: unknown }>)
      .map((refusal) => refusal.functionName);
    expect(refused).not.toContain(entryName('Vault', 'release'));
    expect(refused).not.toContain(entryName('Vault', 'markClaimed'));
    const served = (contract: string): string[] => entriesOf(artifacts, contract).map((entry) => entry.functionName);
    expect(served('Token')).toStrictEqual([entryName('Token', 'transfer')]);
    expect(served('Vault')).toStrictEqual([
      entryName('Vault', 'release'), entryName('Vault', 'markClaimed'), entryName('Vault', 'pay'), entryName('Vault', 'get'),
    ]);
    expect(artifacts.Token?.stateLayout?.mappings?.map((mapping) => mapping.name)).toStrictEqual(['balances']);
  });

  it('settles the write-then-call shape: the record the transaction holds, its two rewrites and the call', () => {
    const { draft, completed, error, written, nodeIndex } = driveSettled();

    // The callee is derived before its caller, and the call back into the vault runs after the entry it re-enters.
    expect(error).toBeUndefined();
    expect(completed).toStrictEqual(['markClaimed-1', 'claim-1', 'release-1']);

    // The record the entries rewrote is what the transaction writes, read back through the shipped encoder.
    const program = draft.programFor('release-1');
    expect(program.transaction.outputs[nodeIndex]!.token?.nft?.commitment).toStrictEqual(written);
    expect(program.transaction.outputs[nodeIndex]!.token?.nft?.commitment).toStrictEqual(releaseView(2n));

    // Each declared segment closes against the view the shipped plan computed for the write's own segment.
    expect(draft.blockOf('release-1').segments[0]![0]!.viewOut).toStrictEqual(releaseView(1n));
    expect(draft.blockOf('markClaimed-1').segments[0]![0]!.viewOut).toStrictEqual(releaseView(2n));
  });

  it('is accepted by the machine at every contract input of the write-then-call shape', () => {
    const { draft } = driveSettled();
    for (const id of ['release-1', 'markClaimed-1', 'claim-1', 'validator']) {
      expect(`${id}: ${verdictAt(draft, id)}`).toBe(`${id}: accepted`);
    }
  });

  it('settles the write that creates the record: its relinked head, the created node and the call', () => {
    // A write that creates the record has no input to read it at, so the segment declares the list's head sentinel
    // rewritten in place and the created node as a trailing output. The creating frame names the created node by
    // its position in that declaration - the record after the target's own - and the frame one call higher rewrites
    // it, so the chain ends at the commitment the transaction writes.
    const { draft, completed, error, verdicts, written, createdIndex, headIndex } = driveSettled(true);

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
    const { draft, verdicts } = driveSettled(true, true);
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
    // The entry is served: the compiler publishes no refusal for it and the host answers with its stop sites.
    const refused = publishedRefusals(amounts.artifacts as Record<string, { composition?: unknown }>)
      .map((refusal) => refusal.functionName);
    expect(refused).not.toContain(entryName('Claimer', 'claim'));
    const sites = createShippedDerivationHost({
      artifacts: [amounts.artifacts.Vault!, amounts.artifacts.Claimer!, amounts.artifacts.Token!], runs: [],
    }).sitesFor(entryName('Claimer', 'claim'));
    expect(sites.functionName).toBe(entryName('Claimer', 'claim'));
    expect(sites.sites.length).toBeGreaterThan(0);

    // The pair the callee's own `return (1, 2)` computes, in the shipped result encoding.
    const pair = encodeResultList([encodeIntegerValue(1n), encodeIntegerValue(2n)]);
    const { draft, completed, error } = driveSettled(false, false, true);

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
    const swapped = driveSettled(false, false, true, [2n, 1n]);
    expect(verdictAt(swapped.draft, 'claim-1')).toBe('refused: Program failed an OP_VERIFY operation.');
    expect(verdictAt(swapped.draft, 'release-1')).toBe('refused: Program failed an OP_VERIFY operation.');
  });
});
