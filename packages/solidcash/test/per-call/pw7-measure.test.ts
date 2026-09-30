/**
 * PW7 measurement harness (read-only; drives the shipped composer/derivation and prints numbers).
 *
 * The machine is wrapped in a Proxy that counts every `evaluate` call, attributed to a master by the input index the
 * run evaluates, so the counts are the shipped host's own runs. Writes a JSON summary to `process.env.PW7_OUT`
 * (default `/tmp/pw7-measure.json`). Nothing here is shipped code; it is a measurement instrument.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { encodeTransaction } from '@bitauth/libauth';
import {
  FrameKind,
  buildEntryNftCovenantScript,
  buildPushdataCommitment,
  bytesToHex,
  computeCollectionHash,
  encodeEventCommitment,
  encodeIntegerValue,
  encodePushdataValue,
  encodeResultList,
  scriptToBytecode,
  splitValueIntoValueChunks,
  type RecordEntry,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import { compositionMachine } from '../../../solidc/test/per-call/machine.js';
import { eventOutput } from '../../../solidc/test/per-call/master/event-input.js';
import { createUnlockingBytecode, scriptToLockingBytecode } from '../../src/utils.js';
import { encodeFunctionArgument } from '../../src/Argument.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../src/stateful/SortedList.js';
import {
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../src/per-call/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveComposition,
  deriveDepthFirst,
  layOutMappingWrites,
  participant,
  planMappingWrite,
  type CompositionDraft,
  type CompositionDraftPlan,
  type DraftMaster,
  type MappingNodePlacement,
} from '../../src/per-call/composer/index.js';
import {
  USER_LOCK,
  compileAndDeploy,
  entryName,
  hexOf,
  layoutWithFacets,
  master,
  masterInput,
  rootOf,
  seededAddress,
  selectorOf,
  token,
  userInput,
  userInputs,
  validatorFor,
} from './shapes/harness.js';
import type { ArtifactMap } from './shapes/harness.js';

type Machine = ReturnType<typeof compositionMachine>;

/** A machine whose `evaluate` calls are counted, keyed by the input index each program evaluates. */
function countingMachine(): { readonly vm: Machine; readonly total: () => number; readonly perInput: Map<number, number> } {
  const base = compositionMachine();
  const perInput = new Map<number, number>();
  let total = 0;
  const vm = new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === 'evaluate') {
        return (program: { readonly inputIndex: number }): unknown => {
          total += 1;
          perInput.set(program.inputIndex, (perInput.get(program.inputIndex) ?? 0) + 1);
          return (target.evaluate as (p: unknown) => unknown)(program);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as Machine;
  return { vm, total: () => total, perInput };
}

/** Per-master evaluation counts, from the input indices the layout placed. */
function byMaster(draft: CompositionDraft, perInput: Map<number, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const placed of draft.layout.participants) {
    const count = perInput.get(placed.index);
    if (count !== undefined) out[placed.id] = count;
  }
  return out;
}

/** The transaction size in bytes, through the shipped encoder. */
function transactionBytes(transaction: Parameters<typeof encodeTransaction>[0]): number {
  return encodeTransaction(transaction).length;
}

// ---------------------------------------------------------------------------------------------------------------
// Y6: fan-in (Hub approves Vault on Token; Vault.pull calls Token.transferFrom).
// ---------------------------------------------------------------------------------------------------------------

const Y6_TOKEN_LABEL = 'fan in token';
const Y6_VAULT_LABEL = 'fan in vault';
const Y6_HUB_LABEL = 'fan in hub';
const Y6_TOKEN = hexOf(seededAddress(Y6_TOKEN_LABEL));
const Y6_VAULT = hexOf(seededAddress(Y6_VAULT_LABEL));
const Y6_HUB = hexOf(seededAddress(Y6_HUB_LABEL));
const Y6_SPENDER = seededAddress(Y6_VAULT_LABEL);
const Y6_HOLDER = seededAddress(Y6_HUB_LABEL);
const Y6_AMOUNT = 40n;
const Y6_PREVIOUS = 7n;
const Y6_NODE_INDEX = 6;
const Y6_ZERO_SLOT = new Uint8Array(32);

const Y6_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IToken {'
  + '   function approve(address spender, int amount);'
  + '   function transferFrom(address holder, address recipient, int amount);'
  + ' }'
  + ' interface IPull { function pull(); }'
  + ' contract Token {'
  + '   mapping(address => int) allowance;'
  + '   function approve(address spender, int amount) { this.allowance[spender] = amount; require(true); }'
  + '   function transferFrom(address holder, address recipient, int amount) {'
  + '     require(this.allowance[recipient] >= amount);'
  + '     this.allowance[recipient] = this.allowance[recipient] - amount;'
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Vault {'
  + `   function pull() { IToken(0x${Y6_TOKEN}).transferFrom(0x${Y6_HUB}, 0x${Y6_VAULT}, 40); require(true); }`
  + ' }'
  + ' contract Hub {'
  + `   function go() { IToken(0x${Y6_TOKEN}).approve(0x${Y6_VAULT}, 40); IPull(0x${Y6_VAULT}).pull(); require(true); }`
  + ' }';

function y6Node(slot: Uint8Array, value: bigint): Uint8Array {
  return encodeEntryCommitment(slot, Y6_ZERO_SLOT, encodeIntegerValue(value));
}

/** Builds Y6's plan and drives it with the counting machine; returns the raw counters and the wall time. */
function driveY6(): {
  readonly compileMs: number;
  readonly buildMs: number;
  readonly deriveMs: number;
  readonly totalEvals: number;
  readonly perMaster: Record<string, number>;
  readonly transactionBytes: number;
  readonly completed: readonly string[];
  readonly draws: number;
} {
  const compileStart = performance.now();
  const { artifacts, contracts } = compileAndDeploy(Y6_SOURCE, {
    Token: Y6_TOKEN_LABEL, Vault: Y6_VAULT_LABEL, Hub: Y6_HUB_LABEL,
  });
  const compileMs = performance.now() - compileStart;
  const tokenContract = contracts.Token!;
  const vaultContract = contracts.Vault!;
  const hubContract = contracts.Hub!;
  const validator = validatorFor(hubContract.category);

  const slot = keyToSlotMulti([Y6_SPENDER]);
  const approveWrite = planMappingWrite({
    keys: [Y6_SPENDER], value: Y6_AMOUNT, inventory: [y6Node(slot, Y6_PREVIOUS)],
    encodeValue: (n) => encodeIntegerValue(n),
  });
  const transferWrite = planMappingWrite({
    keys: [Y6_SPENDER], value: 0n, inventory: [approveWrite.written[0]!.after],
    encodeValue: (n) => encodeIntegerValue(n),
  });
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(slot), { in: Y6_NODE_INDEX, out: Y6_NODE_INDEX }],
  ]);
  const approveSegments = layOutMappingWrites([[approveWrite]], { placementOf: (s) => placements.get(bytesToHex(s)) });
  const transferSegments = layOutMappingWrites([[transferWrite]], { placementOf: (s) => placements.get(bytesToHex(s)) });

  const approveSelector = selectorOf(artifacts, 'Token', 'approve');
  const transferSelector = selectorOf(artifacts, 'Token', 'transferFrom');
  const pullSelector = selectorOf(artifacts, 'Vault', 'pull');
  const amountPush = encodeIntegerValue(Y6_AMOUNT);

  const facts = (
    contract: string, functionName: string, kind: number, mastersOfContract: number, makesExternalCall: boolean,
  ): DraftMaster['facts'] => ({
    contract, functionName, kind, callerIsUser: kind === FrameKind.ROOT, originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall, mastersOfContract,
  });

  const hub: DraftMaster = master({
    master: 'hub-1', contract: 'Hub', entry: 'go', program: hubContract.program,
    facts: facts('Hub', 'go', FrameKind.ROOT, 1, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hubContract.address, value: 0n },
    enteredBy: 'user', origin: 'user',
    calls: [
      { kind: FrameKind.CALL, callee: 'approve-1', target: tokenContract.address, value: 0n,
        argumentPushes: [approveSelector, amountPush, Y6_SPENDER] },
      { kind: FrameKind.CALL, callee: 'vault-1', target: vaultContract.address, value: 0n,
        argumentPushes: [pullSelector] },
    ],
    segments: [[], [], []],
  });
  const vault: DraftMaster = master({
    master: 'vault-1', contract: 'Vault', entry: 'pull', program: vaultContract.program,
    facts: facts('Vault', 'pull', FrameKind.CALL, 1, true),
    frame: { kind: FrameKind.CALL, sender: hubContract.address, self: vaultContract.address, value: 0n },
    enteredBy: 'hub-1', origin: 'user',
    calls: [{ kind: FrameKind.CALL, callee: 'transferFrom-1', target: tokenContract.address, value: 0n,
      argumentPushes: [transferSelector, amountPush, Y6_SPENDER, Y6_HOLDER] }],
    argumentPushes: [pullSelector], segments: [[], []],
  });
  const approve: DraftMaster = {
    ...master({
      master: 'approve-1', contract: 'Token', entry: 'approve', program: tokenContract.program,
      facts: facts('Token', 'approve', FrameKind.CALL, 2, false),
      frame: { kind: FrameKind.CALL, sender: hubContract.address, self: tokenContract.address, value: 0n },
      enteredBy: 'hub-1', origin: 'user',
      segments: approveSegments, argumentPushes: [approveSelector, amountPush, Y6_SPENDER],
    }),
    dispatches: true,
  };
  const transfer: DraftMaster = {
    ...master({
      master: 'transferFrom-1', contract: 'Token', entry: 'transferFrom', program: tokenContract.program,
      facts: facts('Token', 'transferFrom', FrameKind.CALL, 2, false),
      frame: { kind: FrameKind.CALL, sender: vaultContract.address, self: tokenContract.address, value: 0n },
      enteredBy: 'vault-1', origin: 'user',
      segments: transferSegments, argumentPushes: [transferSelector, amountPush, Y6_SPENDER, Y6_HOLDER],
    }),
    dispatches: true,
  };

  const allowanceSignature = artifacts.Token!.stateLayout!.collections![0]!.signature;
  const entryLock = scriptToLockingBytecode(
    buildEntryNftCovenantScript(tokenContract.category, computeCollectionHash(allowanceSignature)), 'p2sh32',
  );
  const nodeSource = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n,
    token: token(tokenContract.category, 'mutable', y6Node(slot, Y6_PREVIOUS)),
  };
  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Hub', masters: ['hub-1'], validator: { id: 'validator', settles: [] }, state: [] },
      { contract: 'Vault', masters: ['vault-1'], state: [] },
      { contract: 'Token', masters: ['approve-1', 'transferFrom-1'], state: ['node'] },
    ],
    userInputs: userInputs(['user'], Y6_NODE_INDEX + 1),
    masters: [hub, vault, approve, transfer],
    inputs: {
      'hub-1': { source: masterInput(hubContract) },
      'vault-1': { source: masterInput(vaultContract) },
      'approve-1': { source: masterInput(tokenContract) },
      'transferFrom-1': { source: masterInput(tokenContract) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(hubContract.category, 'mutable') },
      },
      node: {
        source: nodeSource,
        output: { ...nodeSource, token: token(tokenContract.category, 'mutable', transferWrite.written[0]!.after) },
        unlockingBytecode: new Uint8Array([1]),
      },
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: ['Vault', 'Token'],
      settles: [{ category: tokenContract.category, stateInputs: ['node'] }],
      redeemScript: validator.redeem,
    },
  };

  const counter = countingMachine();
  const buildStart = performance.now();
  const { host, draft } = createComposedDerivationHost({
    vm: counter.vm, artifacts: [artifacts.Hub!, artifacts.Vault!, artifacts.Token!], plan,
  });
  const deriveStart = performance.now();
  const derived = deriveComposition(
    [{ contract: 'Hub', functionName: entryName('Hub', 'go'), kind: FrameKind.ROOT, master: 'hub-1' }],
    host,
  );
  const deriveMs = performance.now() - deriveStart;
  return {
    compileMs,
    buildMs: deriveStart - buildStart,
    deriveMs,
    totalEvals: counter.total(),
    perMaster: byMaster(draft, counter.perInput),
    transactionBytes: transactionBytes(draft.programFor('hub-1').transaction),
    completed: derived.completed.map((frame) => frame.master),
    draws: derived.runs.length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Y2: re-entry (Vault.release writes its record and calls Claimer.claim, which re-enters markClaimed).
// ---------------------------------------------------------------------------------------------------------------

const Y2_TOKEN_LABEL = 'reentry token';
const Y2_VAULT_LABEL = 'reentry vault';
const Y2_CLAIMER_LABEL = 'reentry claimer';
const Y2_VAULT = hexOf(seededAddress(Y2_VAULT_LABEL));
const Y2_CLAIMER = hexOf(seededAddress(Y2_CLAIMER_LABEL));
const Y2_TOKEN = hexOf(seededAddress(Y2_TOKEN_LABEL));
const Y2_USER = hexOf(new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]));
const Y2_LABELS = { Token: Y2_TOKEN_LABEL, Vault: Y2_VAULT_LABEL, Claimer: Y2_CLAIMER_LABEL };
const Y2_ID = 1n;
const Y2_ZERO_SLOT = new Uint8Array(32);

const Y2_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IClaimer { function claim(int id) returns (int, int); }'
  + ' interface IVault { function markClaimed(int id); }'
  + ' contract Claimer {'
  + `   function claim(int id) returns (int, int) { IVault(0x${Y2_VAULT}).markClaimed(id); return (1, 2); }`
  + ' }'
  + ' contract Vault {'
  + '   mapping(int => int) recs;'
  + '   function release(int id) {'
  + '     this.recs[id] = 1;'
  + `     int first, int second = IClaimer(0x${Y2_CLAIMER}).claim(id);`
  + '     require(first == 1); require(second == 2); require(true);'
  + '   }'
  + '   function markClaimed(int id) { this.recs[id] = 2; require(true); }'
  + ' }';

/** Builds Y2's plan and drives it with the counting machine; returns the raw counters and the wall time. */
function driveY2(): {
  readonly compileMs: number;
  readonly buildMs: number;
  readonly deriveMs: number;
  readonly totalEvals: number;
  readonly perMaster: Record<string, number>;
  readonly transactionBytes: number;
  readonly completed: readonly string[];
  readonly draws: number;
} {
  const compileStart = performance.now();
  const { artifacts, contracts } = compileAndDeploy(Y2_SOURCE, { Vault: Y2_VAULT_LABEL, Claimer: Y2_CLAIMER_LABEL });
  const compileMs = performance.now() - compileStart;
  const vault = contracts.Vault!;
  const claimer = contracts.Claimer!;
  const validator = validatorFor(vault.category);
  const idPush = encodeIntegerValue(Y2_ID);
  const slot = keyToSlotMulti([idPush]);
  const encodeValue = (value: bigint): Uint8Array => encodeIntegerValue(value);

  const before = encodeEntryCommitment(slot, Y2_ZERO_SLOT, encodeIntegerValue(0n));
  const release = planMappingWrite({ keys: [idPush], value: 1n, inventory: [before], encodeValue });
  const mark = planMappingWrite({ keys: [idPush], value: 2n, inventory: [release.written[0]!.after], encodeValue });

  const participantCount = 2 + 1 + 1 + 1 + 1;
  const nodeIndex = 4;
  const userIndex = participantCount;
  const placements = new Map<string, MappingNodePlacement>([
    [Buffer.from(slot).toString('hex'), { in: nodeIndex, out: nodeIndex }],
  ]);
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
    calls: [{ kind: FrameKind.CALL, callee: 'claim-1', target: claimer.address, value: 0n,
      argumentPushes: [claimSelector, idPush] }],
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
    calls: [{ kind: FrameKind.CALL, callee: 'markClaimed-1', target: vault.address, value: 0n,
      argumentPushes: [markSelector, idPush] }],
    segments: [[], []],
  });
  const claimMaster: DraftMaster = {
    ...claimBase, retval: encodeResultList([1n, 2n].map((value) => encodeIntegerValue(value))),
  };

  const vaultInput = (commitment: Uint8Array, output: Uint8Array): CompositionDraftPlan['inputs'][string] => ({
    source: { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable', commitment) },
    output: { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable', output) },
    unlockingBytecode: new Uint8Array([0x51]),
  });

  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Vault', masters: ['release-1', 'markClaimed-1'], validator: { id: 'validator', settles: [] }, state: ['node'] },
      { contract: 'Claimer', masters: ['claim-1'], state: [] },
    ],
    userInputs: [{ id: 'user', index: userIndex }],
    masters: [releaseMaster, markMaster, claimMaster],
    inputs: {
      'release-1': { source: masterInput(vault) },
      'markClaimed-1': { source: masterInput(vault) },
      'claim-1': { source: masterInput(claimer) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(vault.category, 'mutable') },
      },
      node: vaultInput(before, mark.written[0]!.after),
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: ['Claimer'],
      settles: [{ category: vault.category, stateInputs: ['node'] }],
      redeemScript: validator.redeem,
    },
  };

  const counter = countingMachine();
  const buildStart = performance.now();
  const { host, draft } = createComposedDerivationHost({
    vm: counter.vm, artifacts: [artifacts.Vault!, artifacts.Claimer!], plan,
  });
  const deriveStart = performance.now();
  const derived = deriveDepthFirst(rootOf('Vault', 'release', 'release-1'), host);
  const deriveMs = performance.now() - deriveStart;
  return {
    compileMs,
    buildMs: deriveStart - buildStart,
    deriveMs,
    totalEvals: counter.total(),
    perMaster: byMaster(draft, counter.perInput),
    transactionBytes: transactionBytes(draft.programFor('release-1').transaction),
    completed: derived.completed.map((frame) => frame.master),
    draws: derived.runs.length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Y2 (fuller variant): the vault graph (release, two payments through the token and the emit).
// ---------------------------------------------------------------------------------------------------------------

const Y2_GRAPH_SOURCE = 'pragma solidcash ^0.13.0;'
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
  + `     int first = IClaimer(0x${Y2_CLAIMER}).claim(id);`
  + '     emit Released(first);'
  + '     require(true);'
  + '   }'
  + '   function markClaimed(int id) { this.recs[id] = 2; require(true); }'
  + `   function pay(address to, int amount) { IToken(0x${Y2_TOKEN}).transfer(to, amount); require(true); }`
  + ' }'
  + ' contract Claimer {'
  + '   function claim(int id) returns (int) {'
  + `     IVault(0x${Y2_VAULT}).markClaimed(id);`
  + `     IVault(0x${Y2_VAULT}).pay(0x${Y2_USER}, 1);`
  + `     IVault(0x${Y2_VAULT}).pay(0x${Y2_USER}, 2);`
  + '     return 1;'
  + '   }'
  + ' }';

const Y2G_AMOUNTS = [1n, 2n] as const;
const Y2G_BALANCE_AFTER = Y2G_AMOUNTS[0] + Y2G_AMOUNTS[1];

function y2gBalanceNode(value: bigint): Uint8Array {
  return encodeEntryCommitment(keyToSlotMulti([USER_LOCK]), Y2_ZERO_SLOT, encodeIntegerValue(value));
}

function y2gEntryNodeUnlocking(
  script: ReturnType<typeof buildEntryNftCovenantScript>, masterInputIndex: number,
): Uint8Array {
  const args = [1n, BigInt(masterInputIndex)]
    .map((value) => encodeFunctionArgument(value, 'bigint') as Uint8Array);
  return createUnlockingBytecode('p2sh32', scriptToBytecode(script), args);
}

/** Builds the vault graph and derives it with the counting machine. */
function driveY2Graph(): {
  readonly compileMs: number;
  readonly buildMs: number;
  readonly deriveMs: number;
  readonly totalEvals: number;
  readonly perMaster: Record<string, number>;
  readonly transactionBytes: number;
  readonly completed: readonly string[];
  readonly draws: number;
} {
  const compileStart = performance.now();
  const { artifacts, contracts } = compileAndDeploy(Y2_GRAPH_SOURCE, Y2_LABELS);
  const compileMs = performance.now() - compileStart;
  const vault = contracts.Vault!;
  const claimer = contracts.Claimer!;
  const tokenContract = contracts.Token!;
  const validator = validatorFor(vault.category);

  const idPush = encodeIntegerValue(Y2_ID);
  const slot = keyToSlotMulti([idPush]);
  const encodeValue = (value: bigint): Uint8Array => encodeIntegerValue(value);

  const recordSpent = encodeEntryCommitment(slot, Y2_ZERO_SLOT, encodeValue(0n));
  const vaultRelease = encodeEntryCommitment(slot, Y2_ZERO_SLOT, encodeValue(1n));
  const vaultWritten = encodeEntryCommitment(slot, Y2_ZERO_SLOT, encodeValue(2n));
  const releaseWrite = planMappingWrite({ keys: [idPush], value: 1n, inventory: [recordSpent], encodeValue });
  const markWrite = planMappingWrite({
    keys: [idPush], value: 2n, inventory: [releaseWrite.written[0]!.after], encodeValue,
  });

  const balanceSpent = y2gBalanceNode(0n);
  const firstTransfer = planMappingWrite({
    keys: [USER_LOCK], value: Y2G_AMOUNTS[0], inventory: [balanceSpent], encodeValue,
  });
  const secondTransfer = planMappingWrite({
    keys: [USER_LOCK], value: Y2G_BALANCE_AFTER, inventory: [firstTransfer.written[0]!.after], encodeValue,
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
    argumentPushes: [paySelector, encodeValue(Y2G_AMOUNTS[index]!), USER_LOCK],
    calls: [{
      kind: FrameKind.CALL, callee: `transfer-${index + 1}`, target: tokenContract.address, value: 0n,
      argumentPushes: [transferSelector, encodeValue(Y2G_AMOUNTS[index]!), USER_LOCK],
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
        { kind: FrameKind.CALL, callee: 'markClaimed-1', target: vault.address, value: 0n,
          argumentPushes: [markSelector, idPush] },
        { kind: FrameKind.CALL, callee: 'pay-1', target: vault.address, value: 0n,
          argumentPushes: [paySelector, encodeValue(Y2G_AMOUNTS[0]!), USER_LOCK] },
        { kind: FrameKind.CALL, callee: 'pay-2', target: vault.address, value: 0n,
          argumentPushes: [paySelector, encodeValue(Y2G_AMOUNTS[1]!), USER_LOCK] },
      ],
    }),
    retval: encodeResultList([encodeValue(1n)]),
  };
  const transferMaster = (index: number): DraftMaster => master({
    master: `transfer-${index + 1}`, contract: 'Token', entry: 'transfer', program: tokenContract.program,
    frame: { kind: FrameKind.CALL, sender: vault.address, self: tokenContract.address, value: 0n },
    facts: tokenFacts(),
    enteredBy: `pay-${index + 1}`, origin: 'user',
    argumentPushes: [transferSelector, encodeValue(Y2G_AMOUNTS[index]!), USER_LOCK],
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
        unlockingBytecode: y2gEntryNodeUnlocking(vaultEntryScript, releaseIndex),
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
        unlockingBytecode: y2gEntryNodeUnlocking(tokenEntryScript, transferIndex),
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

  const counter = countingMachine();
  const buildStart = performance.now();
  const { host, draft } = createComposedDerivationHost({
    vm: counter.vm, artifacts: [artifacts.Vault!, artifacts.Claimer!, artifacts.Token!], plan,
  });
  const deriveStart = performance.now();
  const derived = deriveDepthFirst(rootOf('Vault', 'release', 'release-1'), host);
  const deriveMs = performance.now() - deriveStart;
  return {
    compileMs,
    buildMs: deriveStart - buildStart,
    deriveMs,
    totalEvals: counter.total(),
    perMaster: byMaster(draft, counter.perInput),
    transactionBytes: transactionBytes(draft.programFor('release-1').transaction),
    completed: derived.completed.map((frame) => frame.master),
    draws: derived.runs.length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Dynamic event array: value chunks per append and over 30 updates (fixture-only; shipped encoders).
// ---------------------------------------------------------------------------------------------------------------

const JOB_EVENT_STRUCT: StructDefinitionInfo = {
  name: 'JobEventData',
  fields: [
    { name: 'type_', type: 'uint8' },
    { name: 'address_', type: 'bytes' },
    { name: 'data_', type: 'bytes' },
    { name: 'timestamp_', type: 'uint32' },
  ],
};

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function encString(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  return Uint8Array.from([bytes.length, ...bytes]);
}

function encStringArray(values: readonly string[]): Uint8Array {
  return concat([Uint8Array.from([values.length]), ...values.map((value) => encString(value))]);
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function u256(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let remaining = value;
  for (let index = 0; index < 32; index += 1) { out[index] = Number(remaining & 0xffn); remaining >>= 8n; }
  return out;
}

/** The fixture's Updated-event payload, as the fixture's update entry builds it for the many-updates title. */
function updatedEventData(): Uint8Array {
  return concat([
    encString('New title'),
    Uint8Array.from(Buffer.from('a0b16ada95e7d6bd78efb91c368a3bd6d3b0f6b77cd3f27664475522ee138ae5', 'hex')),
    encStringArray(['DA']),
    u256(200_000_000_000_000_000_000n),
    u32(240),
    new Uint8Array(20).fill(0x33),
    Uint8Array.from([1]),
  ]);
}

function encodedJobEvents(count: number): Uint8Array {
  const element = { type_: 4n, address_: new Uint8Array(0), data_: updatedEventData(), timestamp_: 1_700_000_000n };
  const array = Array.from({ length: count }, () => element);
  return encodePushdataValue(array, 'JobEventData[]', [JOB_EVENT_STRUCT]);
}

interface ChunkRow { readonly events: number; readonly bytes: number; readonly chunks: number; }

function jobEventsChunks(): { readonly rows: readonly ChunkRow[]; readonly cumulative: number } {
  const rows: ChunkRow[] = [];
  let cumulative = 0;
  for (let events = 1; events <= 30; events += 1) {
    const encoded = encodedJobEvents(events);
    const chunks = splitValueIntoValueChunks(encoded).length;
    cumulative += chunks;
    rows.push({ events, bytes: encoded.length, chunks });
  }
  return { rows, cumulative };
}

// ---------------------------------------------------------------------------------------------------------------
// The 24-master composition (the plan's largest named shape). Gated: heavy.
// ---------------------------------------------------------------------------------------------------------------

interface LedgerSpec { readonly contract: string; readonly label: string; readonly entries: number; }

const MS_SOURCE = (specs: readonly LedgerSpec[], calls: readonly string[]): string =>
  'pragma solidcash ^0.13.0;'
  + specs.map((spec) => ` interface I${spec.contract} { function step(); }`).join('')
  + specs.map((spec) => ` contract ${spec.contract} {`
    + '   int public total;'
    + '   function step() { this.total = this.total + 1; require(true); }'
    + ' }').join('')
  + ' contract Hub {'
  + '   function run() {'
  + calls.map((call) => `     ${call}`).join('\n')
  + '     require(true);'
  + '   }'
  + ' }';

function driveManyMasters(): {
  readonly compileMs: number;
  readonly buildMs: number;
  readonly deriveMs: number;
  readonly transactionBytes: number;
  readonly totalEvals: number;
  readonly participantCount: number;
} {
  const specs: readonly LedgerSpec[] = [
    { contract: 'Alpha', label: 'many masters alpha', entries: 8 },
    { contract: 'Beta', label: 'many masters beta', entries: 8 },
    { contract: 'Gamma', label: 'many masters gamma', entries: 8 },
  ];
  const hubLabel = 'many masters hub';
  const calls = specs.flatMap((spec) =>
    Array.from({ length: spec.entries }, () => `I${spec.contract}(0x${hexOf(seededAddress(spec.label))}).step();`));
  const labels: Record<string, string> = { Hub: hubLabel };
  for (const spec of specs) labels[spec.contract] = spec.label;
  const compileStart = performance.now();
  const { artifacts, contracts } = compileAndDeploy(MS_SOURCE(specs, calls), labels);
  const compileMs = performance.now() - compileStart;
  const ledgers = specs.map((spec) => ({
    spec,
    recordId: `${spec.contract}-record`,
    recordOf: (total: bigint): Uint8Array => new Uint8Array(Buffer.from(
      buildPushdataCommitment(artifacts[spec.contract]!.stateLayout!, { total }, 0), 'hex')),
  }));
  const hub = contracts.Hub!;
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Hub', masters: ['hub-1'], validator: { id: 'validator', settles: [] }, state: [] },
    ...ledgers.map((ledger) => ({
      contract: ledger.spec.contract,
      masters: Array.from({ length: ledger.spec.entries }, (_unused, index) => `${ledger.spec.contract}-${index + 1}`),
      state: [ledger.recordId],
    })),
  ];
  const layout = layoutWithFacets(blocks);
  const participantCount = layout.participantCount;
  const ledgerMaster = (spec: LedgerSpec, index: number): string => `${spec.contract}-${index + 1}`;

  const ledgerEntries = ledgers.flatMap((ledger): DraftMaster[] => {
    const contract = contracts[ledger.spec.contract]!;
    const recordIndex = participant(layout, ledger.recordId).index;
    const selector = selectorOf(artifacts, ledger.spec.contract, 'step');
    return Array.from({ length: ledger.spec.entries }, (_unused, index) => master({
      master: ledgerMaster(ledger.spec, index),
      contract: ledger.spec.contract, entry: 'step', program: contract.program,
      facts: {
        contract: ledger.spec.contract, functionName: 'step', kind: FrameKind.CALL,
        callerIsUser: false, originEqualsCaller: false, makesExternalCall: false,
        mastersOfContract: ledger.spec.entries,
      },
      frame: { kind: FrameKind.CALL, sender: hub.address, self: contract.address, value: 0n },
      enteredBy: 'hub-1', origin: 'user',
      argumentPushes: [selector],
      segments: [[{
        in: recordIndex, out: recordIndex,
        viewIn: ledger.recordOf(BigInt(index)), viewOut: ledger.recordOf(BigInt(index + 1)),
      } satisfies RecordEntry]],
    }));
  });

  const hubCalls = ledgers.flatMap((ledger) => {
    const contract = contracts[ledger.spec.contract]!;
    const selector = selectorOf(artifacts, ledger.spec.contract, 'step');
    return Array.from({ length: ledger.spec.entries }, (_unused, index) => ({
      kind: FrameKind.CALL, callee: ledgerMaster(ledger.spec, index), target: contract.address,
      value: 0n, argumentPushes: [selector],
    }));
  });

  const inputs: CompositionDraftPlan['inputs'] = {
    'hub-1': { source: masterInput(hub) },
    validator: {
      source: {
        lockingBytecode: validatorFor(hub.category).lock, valueSatoshis: 20_000n,
        token: token(hub.category, 'mutable'),
      },
    },
    user: userInput(),
  };
  for (const ledger of ledgers) {
    const contract = contracts[ledger.spec.contract]!;
    const categoryHex = bytesToHex(contract.category);
    const lastMaster = participant(layout, ledgerMaster(ledger.spec, ledger.spec.entries - 1)).index;
    for (let index = 0; index < ledger.spec.entries; index += 1) {
      inputs[ledgerMaster(ledger.spec, index)] = { source: masterInput(contract) };
    }
    inputs[ledger.recordId] = {
      source: {
        lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
        token: token(contract.category, 'mutable', ledger.recordOf(0n)),
      },
      output: {
        lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
        token: token(contract.category, 'mutable', ledger.recordOf(BigInt(ledger.spec.entries))),
      },
      unlockingBytecode: stateRecordUnlockingBytecode(categoryHex, lastMaster, 1),
    };
  }

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs(['user'], participantCount),
    masters: [
      master({
        master: 'hub-1', contract: 'Hub', entry: 'run', program: hub.program,
        facts: {
          contract: 'Hub', functionName: 'run', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
        enteredBy: 'user', origin: 'user',
        calls: hubCalls,
        dispatches: true,
      }),
      ...ledgerEntries,
    ],
    inputs,
    validator: {
      id: 'validator', covers: ledgers.map((ledger) => ledger.spec.contract),
      settles: ledgers.map((ledger) => ({
        category: contracts[ledger.spec.contract]!.category, stateInputs: [ledger.recordId],
      })),
      redeemScript: validatorFor(hub.category).redeem,
    },
  };

  const counter = countingMachine();
  const buildStart = performance.now();
  const { host, draft } = createComposedDerivationHost({
    vm: counter.vm, artifacts: [artifacts.Hub!, artifacts.Alpha!, artifacts.Beta!, artifacts.Gamma!], plan,
  });
  const deriveStart = performance.now();
  deriveDepthFirst(rootOf('Hub', 'run', 'hub-1'), host);
  const deriveMs = performance.now() - deriveStart;
  return {
    compileMs,
    buildMs: deriveStart - buildStart,
    deriveMs,
    transactionBytes: transactionBytes(draft.programFor('hub-1').transaction),
    totalEvals: counter.total(),
    participantCount,
  };
}

// ---------------------------------------------------------------------------------------------------------------

function out(value: unknown): void {
  const path = process.env.PW7_OUT ?? '/tmp/pw7-measure.json';
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe('PW7 measurements', () => {
  it('measures Y6, Y2 and the dynamic event array', () => {
    const y6 = driveY6();
    const y2 = driveY2();
    const y2Graph = driveY2Graph();
    const chunks = jobEventsChunks();
    const summary = {
      load: loadavg(),
      cpuCount: 10,
      y6,
      y2,
      y2Graph,
      jobEvents: {
        updatedEventDataBytes: updatedEventData().length,
        perAppendOneEvent: chunks.rows[0],
        perAppendThirtyEvents: chunks.rows[29],
        cumulativeFirstThirtyAppends: chunks.cumulative,
        rows: chunks.rows,
      },
    };
    out(summary);
    expect(y6.completed.length).toBeGreaterThan(0);
    expect(y2.completed.length).toBeGreaterThan(0);
    expect(y2Graph.completed.length).toBeGreaterThan(0);
    expect(chunks.rows.length).toBe(30);
  });

  it.runIf(process.env.PW7_FULL === '1')('measures the 24-master composition', () => {
    const many = driveManyMasters();
    const prior = JSON.parse(readFileSync(process.env.PW7_OUT ?? '/tmp/pw7-measure.json', 'utf8')) as object;
    out({ ...prior, many });
    expect(many.transactionBytes).toBeGreaterThan(0);
  });
});
